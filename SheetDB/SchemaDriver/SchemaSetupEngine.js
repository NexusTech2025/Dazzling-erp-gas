/**
 * SchemaSetupEngine
 * A deterministic, idempotent provisioning engine using a Plan-Execute architecture.
 * Safely translates a JSON schema into structured Google Spreadsheets.
 */
class SchemaSetupEngine {
  /**
   * @param {Object} fileSystem - An initialized instance of SpreadsheetFileSystem
   * @param {Object} schema - The database schema JSON object
   * @param {Object} registry - (Optional) An instance of SchemaRegistry
   * @param {Object} dataSource - (Optional) An instance of SheetDataSource for cache invalidation
   * @param {Object} config - Execution configuration overrides
   */
  constructor(fileSystem, schema, registry, dataSource = null, config = {}) {
    if (!fileSystem) throw new Error("SpreadsheetFileSystem instance is required.");
    if (!schema) throw new Error("Schema definition is required.");

    this.fs = fileSystem;
    this.schema = schema;
    this.registry = registry || new SchemaRegistry(schema); 
    this.dataSource = dataSource; // For cache invalidation
    
    // Instantiate the dedicated Read Adapter
    this.inspector = new SchemaInspector(fileSystem);

    // Default configuration
    this.config = {
      mode: config.mode || 'safe', 
      dryRun: config.dryRun || false,
      continueOnError: config.continueOnError || false,
      verbose: config.verbose !== undefined ? config.verbose : true
    };
  }

  // ==========================================
  // 🔷 2. ORCHESTRATOR LAYER
  // ==========================================

  /**
   * provision()
   * Single entry point to orchestrate the lifecycle: Plan -> (DryRun?) -> Execute
   */
  provision() {
    this._log('INFO', 'INIT', 'Engine', 'START', 'Starting schema provisioning...');
    
    const lock = LockService.getScriptLock();
    let hasLock = false;
    
    try {
      // Concurrency Lock: Prevent parallel executions
      hasLock = lock.tryLock(30000); 
      if (!hasLock) throw new Error("Concurrency Lock Failed: Another process is running.");

      // STEP 1: Generate Plan (Pure Intent)
      this._log('INFO', 'PLAN', 'Engine', 'START', 'Analyzing schema against current filesystem...');
      const plan = this.plan();

      // STEP 2: Handle Dry Run
      if (this.config.dryRun) {
        this._log('INFO', 'DRY_RUN', 'Engine', 'COMPLETE', 'Dry run enabled. Returning plan without mutating.');
        return plan;
      }

      // Pre-Execution Safety Check
      if (plan.summary.errors > 0 && !this.config.continueOnError) {
        throw new Error(`Provisioning blocked: Plan contains ${plan.summary.errors} critical errors.`);
      }

      // STEP 3: Execute Plan
      this._log('INFO', 'EXECUTE', 'Engine', 'START', 'Applying plan operations...');
      const result = this.execute(plan);

      this._log('INFO', 'COMPLETE', 'Engine', 'SUCCESS', 'Schema provisioning finished.');
      return result;
      
    } finally {
      if (hasLock) lock.releaseLock();
    }
  }

  // ==========================================
  // 🔷 1. DECISION ENGINE (PURE FUNCTION)
  // ==========================================

  /**
   * plan()
   * Pure decision engine. Evaluates Physical Snapshot against Schema and outputs intent.
   * NEVER mutates the filesystem.
   * @returns {Object} Structured execution plan
   */
  plan() {
    const plan = {
      operations: [],
      summary: { createFile: 0, createSheet: 0, ensureHeader: 0, metaUpdates: 0, errors: 0 }
    };

    // Step 0: Base Schema Validation
    const validationErrors = this._validateSchema();
    if (validationErrors.length > 0) {
      validationErrors.forEach(err => {
        plan.operations.push({ type: 'ERROR', target: { category: 'ALL', table: 'N/A' }, payload: { message: err }, meta: { severity: 'CRITICAL' } });
        plan.summary.errors++;
      });
      return plan; // Abort deep planning if schema is fundamentally broken
    }

    // Step 1: Capture Physical Snapshot (The only impure call, isolated at start)
    const physicalSnapshot = this.inspector.getPhysicalSnapshot(this.schema.categories);

    // Step 2: Compare Desired State (Schema) vs Actual State (Snapshot)
    for (const [categoryName, catSchema] of Object.entries(this.schema.categories)) {
      const physicalCat = physicalSnapshot[categoryName];

      if (!physicalCat) {
        // Scenario A: Spreadsheet missing. Plan full setup.
        this._planFullProvisioning(plan, categoryName, catSchema);
      } else {
        // Scenario B: Spreadsheet exists. Plan incremental updates.
        this._planIncrementalUpdate(plan, categoryName, catSchema, physicalCat);
      }
    }

    return plan;
  }

  /**
   * Internal: Plans full setup for a missing category.
   * @private
   */
  _planFullProvisioning(plan, categoryName, catSchema) {
    plan.operations.push(this._createFileOp(categoryName));
    plan.summary.createFile++;

    for (const tableName of Object.keys(catSchema.tables)) {
      // Use Registry to get merged (System + Table) columns
      const headers = Object.keys(this.registry.getColumns(tableName));
      plan.operations.push(this._createSheetOp(categoryName, tableName, headers));
      plan.summary.createSheet++;
    }

    plan.operations.push(this._ensureMetaOp(categoryName, this.schema.version));
    plan.summary.metaUpdates++;
  }

  /**
   * Internal: Plans updates for an existing spreadsheet (Idempotency check).
   * @private
   */
  _planIncrementalUpdate(plan, categoryName, catSchema, physicalCat) {
    for (const [tableName, tableSchema] of Object.entries(catSchema.tables)) {
      const physicalTable = physicalCat.tables[tableName];
      
      // Use Registry to get merged (System + Table) columns
      const expectedHeaders = Object.keys(this.registry.getColumns(tableName));

      if (!physicalTable) {
        // Table missing from existing file
        plan.operations.push(this._createSheetOp(categoryName, tableName, expectedHeaders));
        plan.summary.createSheet++;
      } else {
        // Table exists, check for Header Mismatch
        const actualHeaders = physicalTable.headers;
        const normalizedActual = this._normalizeHeaders(actualHeaders);
        const normalizedExpected = this._normalizeHeaders(expectedHeaders);

        // Guard: Detect Row 1 Data Corruption (Deleted Headers but data exists)
        // Logic: If data exists but ZERO headers match the schema, we are likely looking at orphaned data.
        const validHeaderMatches = normalizedActual.filter(h => normalizedExpected.includes(h));
        
        if (physicalTable.lastRow > 0 && validHeaderMatches.length === 0) {
          plan.operations.push({
            type: 'ERROR',
            target: { category: categoryName, table: tableName },
            payload: { message: `CRITICAL DATA CORRUPTION RISK: No valid schema headers found in '${tableName}' but data exists. Execution blocked to protect Row 1.` },
            meta: { severity: 'CRITICAL' }
          });
          plan.summary.errors++;
          continue;
        }

        if (!this._arraysEqual(expectedHeaders, actualHeaders)) {
          plan.operations.push(this._ensureHeaderOp(categoryName, tableName, expectedHeaders, actualHeaders));
          plan.summary.ensureHeader++;
        }
      }
    }

    // Check Meta version
    const currentVersion = physicalCat.meta ? physicalCat.meta.schemaVersion : null;
    if (currentVersion !== this.schema.version) {
      plan.operations.push(this._ensureMetaOp(categoryName, this.schema.version));
      plan.summary.metaUpdates++;
    }
  }

  // ==========================================
  // 🔷 3. ACTION LAYER (DUMB EXECUTOR)
  // ==========================================

  /**
   * execute(plan)
   * Applies the operations defined in the plan. Enforces config modes (safe/force).
   * @param {Object} plan 
   * @returns {Object} Structured execution result
   */
  execute(plan) {
    const result = {
      createdFiles: [], createdSheets: [], updatedHeaders: [], 
      metaUpdated: [], errors: [], isChanged: false
    };

    const ssCache = {}; 

    for (const op of plan.operations) {
      try {
        switch (op.type) {
          case 'CREATE_FILE':
            const fileMeta = this.fs.create(op.target.category, { avoidDuplicate: true });
            ssCache[op.target.category] = this.fs.open(fileMeta.id);
            result.createdFiles.push(op.target.category);
            break;
            
          case 'CREATE_SHEET':
            this._execCreateSheet(op, ssCache, result);
            break;

          case 'ENSURE_HEADER':
            this._execEnsureHeader(op, ssCache, result);
            break;

          case 'ENSURE_META_SHEET':
            this._execEnsureMeta(op, ssCache, result);
            break;

          case 'ERROR':
            result.errors.push(`[${op.target.category || 'ALL'}] ${op.payload.message}`);
            break;
        }
      } catch (e) {
        this._log('ERROR', 'EXECUTION', op.type, 'FAILED', e.message);
        result.errors.push(e.message);
        if (!this.config.continueOnError) throw e;
      }
    }

    result.isChanged = (result.createdFiles.length + result.createdSheets.length + result.updatedHeaders.length + result.metaUpdated.length) > 0;

    // --- Physical & Logical Synchronization ---
    if (result.isChanged) {
      this._log('INFO', 'SYNC', 'Engine', 'START', 'Flushing spreadsheet buffer and purging memory cache...');
      SpreadsheetApp.flush();
      if (this.dataSource) {
        this.dataSource.purgeCache();
      }
    }

    return result;
  }

  // ==========================================
  // ⚙️ EXECUTOR HANDLERS & INTERNAL UTILS
  // ==========================================

  _getSpreadsheet(categoryName, ssCache) {
    if (ssCache[categoryName]) return ssCache[categoryName];
    const fileMeta = this.fs.findByName(categoryName);
    if (!fileMeta) throw new Error(`Spreadsheet ${categoryName} not found during execution.`);
    ssCache[categoryName] = this.fs.open(fileMeta.id);
    return ssCache[categoryName];
  }

  _execCreateSheet(op, ssCache, result) {
    const ss = this._getSpreadsheet(op.target.category, ssCache);
    const sheetName = op.target.table;
    const sheet = ss.insertSheet(sheetName);
    
    this._applyColumns(sheet, op.payload.headers, 1);
    result.createdSheets.push(`${op.target.category}.${sheetName}`);

    const defaultSheet = ss.getSheetByName("Sheet1");
    if (defaultSheet && ss.getSheets().length > 1) {
      ss.deleteSheet(defaultSheet);
    }
  }

  _execEnsureHeader(op, ssCache, result) {
    const ss = this._getSpreadsheet(op.target.category, ssCache);
    const { expected, actual } = op.payload;
    let sheet = ss.getSheetByName(op.target.table);

    if (this.config.mode === 'force') {
      this._log('WARN', 'EXECUTION', op.target.table, 'FORCE_RECREATE', 'Force mode: Moving old sheet to backup and recreating.');
      const oldSheet = sheet;
      oldSheet.setName(`${op.target.table}_backup_${Date.now()}`); // Actual Backup (Fixes Issue 5)
      sheet = ss.insertSheet(op.target.table);
      this._applyColumns(sheet, expected, 1);
      result.updatedHeaders.push(`${op.target.category}.${op.target.table} (Recreated)`);
      return;
    }

    const missingHeaders = expected.filter(h => !this._normalizeHeaders([h])[0] || !this._normalizeHeaders(actual).includes(this._normalizeHeaders([h])[0]));
    
    if (missingHeaders.length > 0) {
      const startCol = actual.length > 0 ? actual.length + 1 : 1;
      this._applyColumns(sheet, missingHeaders, startCol);
      result.updatedHeaders.push(`${op.target.category}.${op.target.table} (Appended)`);
    }
  }

  _execEnsureMeta(op, ssCache, result) {
    const ss = this._getSpreadsheet(op.target.category, ssCache);
    let metaSheet = ss.getSheetByName('__meta__');
    if (!metaSheet) {
      metaSheet = ss.insertSheet('__meta__');
      metaSheet.hideSheet();
    }

    const metaObj = {
      schemaVersion: op.payload.version,
      lastUpdated: new Date().toISOString(),
      tables: Object.keys(this.schema.categories[op.target.category].tables)
    };

    metaSheet.getRange('A1').setValue('__SCHEMA_META__');
    metaSheet.getRange('B1').setValue(JSON.stringify(metaObj));
    result.metaUpdated.push(op.target.category);
  }

  // ==========================================
  // 🧩 OPERATION FACTORIES & VALIDATION
  // ==========================================

  _createFileOp(category) {
    return { type: 'CREATE_FILE', target: { category, table: 'N/A' }, payload: { fileName: category }, meta: { reason: 'File missing' } };
  }
  _createSheetOp(category, table, headers) {
    return { type: 'CREATE_SHEET', target: { category, table }, payload: { headers }, meta: { reason: 'Sheet missing' } };
  }
  _ensureHeaderOp(category, table, expected, actual) {
    return { type: 'ENSURE_HEADER', target: { category, table }, payload: { expected, actual }, meta: { reason: 'Header mismatch' } };
  }
  _ensureMetaOp(category, version) {
    return { type: 'ENSURE_META_SHEET', target: { category, table: '__meta__' }, payload: { version }, meta: { reason: 'Meta sheet missing or outdated' } };
  }

  _validateSchema() {
    const errors = [];
    if (!this.schema.version) errors.push("Schema missing 'version'");
    if (!this.schema.categories) errors.push("Schema missing 'categories' object");
    
    if (errors.length === 0) {
      for (const [catName, catData] of Object.entries(this.schema.categories)) {
        if (!catData.tables) errors.push(`Category '${catName}' missing 'tables'`);
        else {
          for (const [tableName, tableData] of Object.entries(catData.tables)) {
            if (tableName.length > 100) errors.push(`Table '${tableName}' name too long.`);
            if (/[\[\]:*?/\\]/.test(tableName)) errors.push(`Table '${tableName}' has illegal characters.`);
            if (!tableData.columns) errors.push(`Table '${tableName}' missing 'columns'`);
            if (!tableData.primaryKey) errors.push(`Table '${tableName}' missing 'primaryKey'`);
          }
        }
      }
    }
    return errors;
  }

  _normalizeHeaders(headers) {
    return headers.map(h => String(h).trim()); // Issue 2 fix
  }

  _arraysEqual(arr1, arr2) {
    const n1 = this._normalizeHeaders(arr1);
    const n2 = this._normalizeHeaders(arr2);
    return n1.length === n2.length && n1.every((v, i) => v === n2[i]);
  }

  _applyColumns(sheet, headers, startCol) {
    if (headers.length === 0) return;
    const range = sheet.getRange(1, startCol, 1, headers.length);
    range.setValues([headers]);
    range.setFontWeight("bold").setBackground("#f3f3f3");
    if (sheet.getFrozenRows() === 0) sheet.setFrozenRows(1);
  }

  _log(level, step, entity, status, details = '') {
    if (!this.config.verbose && level === 'INFO') return;
    const logStr = JSON.stringify({ timestamp: new Date().toISOString(), level, step, entity, status, details });
    if (level === 'ERROR') console.error(logStr);
    else if (level === 'WARN') console.warn(logStr);
    else console.log(logStr);
  }
}
