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
      targetTables: config.targetTables || null,
      targetCategories: config.targetCategories || null,
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

  /**
   * Runs scoped dry-run diagnostics on a specific table.
   * @param {string} tableName
   * @returns {Object} Structured dry-run validation and provisioning plan
   */
  diagnose(tableName) {
    const originalTargetTables = this.config.targetTables;
    const originalDryRun = this.config.dryRun;
    try {
      this.config.targetTables = [tableName];
      this.config.dryRun = true;
      return this.plan();
    } finally {
      this.config.targetTables = originalTargetTables;
      this.config.dryRun = originalDryRun;
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

    // Step 0: Base Schema Validation (Global in-memory structural validation)
    const validationErrors = this._validateSchema();
    if (validationErrors.length > 0) {
      validationErrors.forEach(err => {
        plan.operations.push({ type: 'ERROR', target: { category: 'ALL', table: 'N/A' }, payload: { message: err }, meta: { severity: 'CRITICAL' } });
        plan.summary.errors++;
      });
      return plan; // Abort deep planning if schema is fundamentally broken
    }

    // Step 1: Filter active categories based on target selection settings
    const activeCategories = {};
    for (const [catName, catData] of Object.entries(this.schema.categories)) {
      if (this.config.targetCategories && !this.config.targetCategories.includes(catName)) {
        continue;
      }

      const filteredTables = {};
      for (const [tableName, tableData] of Object.entries(catData.tables)) {
        if (this.config.targetTables && !this.config.targetTables.includes(tableName)) {
          continue;
        }
        filteredTables[tableName] = tableData;
      }

      if (Object.keys(filteredTables).length > 0) {
        activeCategories[catName] = { tables: filteredTables };
      }
    }

    // Step 2: Capture Scoped Physical Snapshot (Incredibly fast, zero-latency inspect on target categories only!)
    const physicalSnapshot = this.inspector.getPhysicalSnapshot(activeCategories);

    // Step 3: Compare Desired State (Active Schema) vs Actual State (Snapshot)
    for (const [categoryName, catSchema] of Object.entries(activeCategories)) {
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
    const mode = this.config.mode || 'safe';
    const policy = HeaderExecutionPolicies[mode];
    if (!policy) {
      throw new Error(`[SchemaSetupEngine] Unsupported header update mode: '${mode}'`);
    }
    policy.execute(this, op, ssCache, result);
  }

  _execMetaUpdate(op, ssCache, result) {
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
      // 1. Gather all tables globally to resolve cross-category targets
      const allTables = {};
      for (const [catName, catData] of Object.entries(this.schema.categories)) {
        if (catData.tables) {
          for (const [tableName, tableData] of Object.entries(catData.tables)) {
            allTables[tableName] = tableData;
          }
        }
      }

      for (const [catName, catData] of Object.entries(this.schema.categories)) {
        if (!catData.tables) {
          errors.push(`Category '${catName}' missing 'tables'`);
          continue;
        }

        for (const [tableName, tableData] of Object.entries(catData.tables)) {
          // Table Name Checks
          if (tableName.length > 100) {
            errors.push(`Table '${tableName}' name too long.`);
          }
          if (/[\[\]:*?/\\]/.test(tableName)) {
            errors.push(`Table '${tableName}' has illegal characters.`);
          }
          if (!tableData.columns) {
            errors.push(`Table '${tableName}' missing 'columns'`);
            continue;
          }
          if (!tableData.primaryKey) {
            errors.push(`Table '${tableName}' missing 'primaryKey'`);
            continue;
          }

          const columns = tableData.columns;

          // 1. Primary Key Validation
          if (!columns[tableData.primaryKey]) {
            errors.push(`Table '${tableName}' primaryKey '${tableData.primaryKey}' must match one of its declared columns.`);
          }

          // 2. Column Configurations & Custom Validation Check
          for (const [colName, colConfig] of Object.entries(columns)) {
            if (!colConfig) continue;

            // Numeric check limits
            if (colConfig.min !== undefined && typeof colConfig.min !== 'number') {
              errors.push(`Table '${tableName}', Column '${colName}': 'min' limit must be a number.`);
            }
            if (colConfig.max !== undefined && typeof colConfig.max !== 'number') {
              errors.push(`Table '${tableName}', Column '${colName}': 'max' limit must be a number.`);
            }

            // String check limits
            if (colConfig.minLength !== undefined && typeof colConfig.minLength !== 'number') {
              errors.push(`Table '${tableName}', Column '${colName}': 'minLength' limit must be a number.`);
            }
            if (colConfig.maxLength !== undefined && typeof colConfig.maxLength !== 'number') {
              errors.push(`Table '${tableName}', Column '${colName}': 'maxLength' limit must be a number.`);
            }

            // Enum choices check
            const choices = colConfig.choices || colConfig.enum;
            if (choices !== undefined && !Array.isArray(choices)) {
              errors.push(`Table '${tableName}', Column '${colName}': 'choices'/'enum' must be an Array.`);
            }

            // Regex pattern check
            if (colConfig.pattern !== undefined) {
              try {
                new RegExp(colConfig.pattern);
              } catch (e) {
                errors.push(`Table '${tableName}', Column '${colName}': regex pattern '/${colConfig.pattern}/' is invalid: ${e.message}`);
              }
            }

            // Custom validation handler registration check
            if (colConfig.handler) {
              if (typeof ValidationRegistry === 'undefined' || !ValidationRegistry.has(colConfig.handler)) {
                errors.push(`Table '${tableName}', Column '${colName}': Custom validation handler '${colConfig.handler}' is not registered in ValidationRegistry.`);
              }
            }
          }

          // 3. Relational Integrity Checks
          const relations = tableData.relations || {};
          for (const [relName, relConfig] of Object.entries(relations)) {
            if (!relConfig) continue;

            if (relConfig.type === 'belongsTo') {
              // foreignKey must exist in the local table columns
              if (!relConfig.foreignKey) {
                errors.push(`Table '${tableName}', Relation '${relName}': missing 'foreignKey' definition.`);
              } else if (!columns[relConfig.foreignKey]) {
                errors.push(`Table '${tableName}', Relation '${relName}': foreignKey '${relConfig.foreignKey}' is not defined locally in table columns.`);
              }
            } else if (relConfig.type === 'hasMany' || relConfig.type === 'hasOne') {
              const targetTableName = relConfig.target;
              if (!targetTableName) {
                errors.push(`Table '${tableName}', Relation '${relName}': missing relation 'target' table.`);
                continue;
              }

              const targetTable = allTables[targetTableName];
              if (!targetTable) {
                errors.push(`Table '${tableName}', Relation '${relName}': target table '${targetTableName}' not found in schema.`);
                continue;
              }

              // The foreignKey must exist in the target table columns
              if (!relConfig.foreignKey) {
                errors.push(`Table '${tableName}', Relation '${relName}': missing relation 'foreignKey' definition.`);
              } else if (!targetTable.columns || !targetTable.columns[relConfig.foreignKey]) {
                errors.push(`Table '${tableName}', Relation '${relName}': target table '${targetTableName}' does not define relation foreignKey '${relConfig.foreignKey}'.`);
              }
            }
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

/**
 * Registry of execution policies for resolving physical sheet headers in force or safe mode.
 * @type {Object<string, {execute: function(Object, Object, Object, Object): void}>}
 */
const HeaderExecutionPolicies = {
  "force": {
    execute(engine, op, ssCache, result) {
      const ss = engine._getSpreadsheet(op.target.category, ssCache);
      const { expected } = op.payload;
      let sheet = ss.getSheetByName(op.target.table);

      engine._log('WARN', 'EXECUTION', op.target.table, 'FORCE_RECREATE', 'Force mode: Moving old sheet to backup and recreating.');
      const oldSheet = sheet;
      oldSheet.setName(`${op.target.table}_backup_${Date.now()}`);
      sheet = ss.insertSheet(op.target.table);
      engine._applyColumns(sheet, expected, 1);
      result.updatedHeaders.push(`${op.target.category}.${op.target.table} (Recreated)`);
    }
  },
  "safe": {
    execute(engine, op, ssCache, result) {
      const ss = engine._getSpreadsheet(op.target.category, ssCache);
      const schemaHeaders = op.payload.expected;
      const physicalHeaders = op.payload.actual;
      let sheet = ss.getSheetByName(op.target.table);

      const normPhysical = engine._normalizeHeaders(physicalHeaders);
      const isPresent = h => normPhysical.includes(engine._normalizeHeaders([h])[0]);
      const missingHeaders = schemaHeaders.filter(h => !isPresent(h));

      // Order differences between schemaHeaders and physicalHeaders are ignored.
      // Only trigger alignment if headers are physically MISSING from the worksheet.
      if (missingHeaders.length > 0) {
        alignPhysicalWorksheetColumns(engine, sheet, schemaHeaders, physicalHeaders, op.target.category, op.target.table, result);
      }
    }
  }
};

/**
 * Reorders physical column data in-memory to match expected schema columns order.
 * Appends any extra columns to the end of the sheet, preventing data loss.
 * Processes all cell mappings in RAM and commits a single batch write.
 * @param {Object} engine - The SchemaSetupEngine instance.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The target sheet object.
 * @param {Array<string>} expected - Expected schema column headers list.
 * @param {Array<string>} actual - Current physical worksheet headers list.
 * @param {string} category - Spreadsheet category name.
 * @param {string} tableName - Target table name.
 * @param {Object} result - Result compilation object.
 */
function alignPhysicalWorksheetColumns(engine, sheet, expected, actual, category, tableName, result) {
  engine._log('INFO', 'EXECUTION', tableName, 'ALIGN_COLUMNS', `Aligning physical columns to match schema order for table '${tableName}'...`);

  const range = sheet.getDataRange();
  const rawValues = range.getValues();

  if (rawValues.length > 0 && rawValues[0].length > 0) {
    const actualHeaders = rawValues[0].map(h => String(h).trim());
    const colIndexMap = {};
    actualHeaders.forEach((h, i) => {
      colIndexMap[h] = i;
    });

    const missingInPhysical = expected.filter(h => !actualHeaders.includes(String(h).trim()));
    const newHeaders = [...actualHeaders, ...missingInPhysical];

    // Remap values to new layout in RAM using decoupled helper function
    remapAndOverwriteSheet(sheet, rawValues, newHeaders, colIndexMap);
    
    // Apply styling via style helper function
    applyStyle(sheet, newHeaders.length);

    result.updatedHeaders.push(`${category}.${tableName} (Aligned)`);
  } else {
    engine._applyColumns(sheet, expected, 1);
    result.updatedHeaders.push(`${category}.${tableName} (Headers Initialized)`);
  }

  if (engine.dataSource) {
    try {
      engine.dataSource.purgeCache();
    } catch (purgeErr) {
      engine._log('WARN', 'EXECUTION', tableName, 'PURGE_FAILED', `Cache purge failed: ${purgeErr.message}`);
    }
  }
}

/**
 * Helper to perform safe, in-memory cell remapping and overwrite the sheet content.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - Target sheet.
 * @param {Array<Array<any>>} rawValues - Current raw spreadsheet values.
 * @param {Array<string>} newHeaders - Ordered list of expected/extra headers.
 * @param {Object<string, number>} colIndexMap - Mapping of column name to old index.
 * @returns {void}
 */
function remapAndOverwriteSheet(sheet, rawValues, newHeaders, colIndexMap) {
  const newValues = rawValues.map((row, rowIndex) => {
    if (rowIndex === 0) return newHeaders;
    return newHeaders.map(headerName => {
      const oldIndex = colIndexMap[String(headerName).trim()];
      return oldIndex !== undefined ? row[oldIndex] : "";
    });
  });

  sheet.getDataRange().clearContent();
  sheet.getRange(1, 1, newValues.length, newValues[0].length).setValues(newValues);
}

/**
 * Applies header gray/bold styling and freezes row 1.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - Target sheet.
 * @param {number} colCount - Number of columns to format.
 * @returns {void}
 */
function applyStyle(sheet, colCount) {
  const range = sheet.getRange(1, 1, 1, colCount);
  range.setFontWeight("bold").setBackground("#f3f3f3");
  if (sheet.getFrozenRows() === 0) sheet.setFrozenRows(1);
}
