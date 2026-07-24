/**
 * @file TableGatway.js
 * Layer: Table Abstraction Layer
 * 
 * Responsibility:
 * - Represent one sheet as one logical table.
 * - Handle data normalization (type casting) using schema metadata.
 * - Perform CRUD operations via the SheetDataSource.
 * - Manage row-to-object mapping for reading and writing.
 */

class TableGateway {
  /**
   * @param {string} tableName - The logical table name.
   * @param {Object} registry - Instance of SchemaRegistry.
   * @param {Object} dataSource - Instance of SheetDataSource.
   */
  constructor(tableName, registry, dataSource, db) {
    this.tableName = tableName;
    this.registry = registry;
    this.dataSource = dataSource;
    this.db = db || null;

    // Self-Configure from Schema
    this.category = registry.getCategoryForTable(tableName);
    this.primaryKey = registry.getPrimaryKey(tableName);
    this.columns = registry.getColumns(tableName);
  }

  /**
   * Fetch all records as normalized objects.
   */
  all() {
    try {
      const rawRows = this.dataSource.readTable(this.category, this.tableName);
      return rawRows.map(row => this._normalizeRow(row));
    } catch (e) {
      if (e.message.includes("Category file") || e.message.includes("not found")) {
        throw new TableNotFoundError(this.tableName, this.category);
      }
      throw e;
    }
  }

  /**
   * Check if the table physically exists in the spreadsheet.
   * @returns {boolean}
   */
  isTableExist() {
    try {
      // 1. Check if the spreadsheet file exists
      const fileMeta = this.dataSource.fs.findByName(this.category);
      if (!fileMeta) return false;

      // 2. Check if the sheet (table) exists inside the file
      const ss = this.dataSource.fs.open(fileMeta.id);
      return !!ss.getSheetByName(this.tableName);
    } catch (e) {
      return false;
    }
  }

  /**
   * Find a single record by its primary key.
   */
  find(id) {
    const all = this.all();
    return all.find(row => row[this.primaryKey] == id) || null;
  }

  /**
   * Basic equality filtering.
   */
  where(filters = {}) {
    const all = this.all();
    return all.filter(row => {
      return Object.entries(filters).every(([key, value]) => {
        const rowVal = row[key];
        if (isDate(rowVal) || (typeof value === 'string' && value.match(/^(\d{4})[-/]/))) {
          const hasDateType = isDate(rowVal) || (typeof rowVal === 'string' && rowVal.match(/^(\d{4})[-/]/));
          if (hasDateType) {
            return DateComparator.compare(rowVal, value, DateComparisonPolicy.DATE_ONLY);
          }
        }
        return rowVal === value;
      });
    });
  }

  /**
   * Finds the first record matching the filters.
   * @param {Object} filters 
   * @returns {Object|null} Raw row object or null.
   */
  findOne(filters = {}) {
    const all = this.all();
    return all.find(row => {
      return Object.entries(filters).every(([key, value]) => {
        const rowVal = row[key];
        if (isDate(rowVal) || (typeof value === 'string' && value.match(/^(\d{4})[-/]/))) {
          const hasDateType = isDate(rowVal) || (typeof rowVal === 'string' && rowVal.match(/^(\d{4})[-/]/));
          if (hasDateType) {
            return DateComparator.compare(rowVal, value, DateComparisonPolicy.DATE_ONLY);
          }
        }
        return rowVal === value;
      });
    }) || null;
  }

  /**
   * Counts records matching the filters.
   * @param {Object} filters 
   * @returns {number}
   */
  count(filters = {}) {
    return this.where(filters).length;
  }

  /**
   * Insert a new record.
   */
  insert(data) {
    if (!data[this.primaryKey]) throw new Error(`Insert failed: Missing primary key '${this.primaryKey}'.`);

    const rowArray = this._mapObjectToRow(data);
    this.dataSource.insertRows(this.category, this.tableName, [rowArray]);

    // Sync PrimaryKeyCache
    if (this.db && this.db._pkCache) {
      this.db._pkCache.add(this.tableName, data[this.primaryKey]);
    }

    return this._normalizeRow(data);
  }

  /**
   * Performs an optimized batch insertion of multiple records.
   * @param {Array<Object>} dataArray - Array of records.
   * @returns {Array<Object>} Normalized results.
   */
  insertBatch(dataArray) {
    if (!dataArray || dataArray.length === 0) return [];

    // Map objects to 2D array
    const rows2D = dataArray.map(obj => this._mapObjectToRow(obj));

    // Batch Write
    this.dataSource.insertRows(this.category, this.tableName, rows2D);

    // Sync PrimaryKeyCache
    if (this.db && this.db._pkCache) {
      dataArray.forEach(data => {
        this.db._pkCache.add(this.tableName, data[this.primaryKey]);
      });
    }

    return dataArray.map(data => this._normalizeRow(data));
  }

  /**
   * Update an existing record by ID.
   */
  update(id, updates) {
    // 1. Find the row number using raw data
    const rawRows = this.dataSource.readTable(this.category, this.tableName);
    const existingRaw = rawRows.find(row => row[this.primaryKey] == id);

    if (!existingRaw) throw new Error(`Update failed: Record '${id}' not found.`);

    // 2. Merge and Map
    const merged = { ...existingRaw, ...updates };
    const rowNumber = existingRaw.__rowNumber;
    delete merged.__rowNumber;

    const rowArray = this._mapObjectToRow(merged);
    this.dataSource.updateRow(this.category, this.tableName, rowNumber, rowArray);

    return this._normalizeRow(merged);
  }

  /**
   * Physically remove a record by ID.
   */
  remove(id) {
    const rawRows = this.dataSource.readTable(this.category, this.tableName);
    const existing = rawRows.find(row => row[this.primaryKey] == id);

    if (!existing) throw new Error(`Delete failed: Record '${id}' not found.`);

    this.dataSource.deleteRow(this.category, this.tableName, existing.__rowNumber);

    // Sync PrimaryKeyCache
    if (this.db && this.db._pkCache) {
      this.db._pkCache.remove(this.tableName, id);
    }

    return true;
  }

  /**
   * Delete multiple records by their primary keys.
   * @param {Array<any>} ids - Array of primary key values to delete.
   * @returns {number} Count of successfully deleted records.
   */
  deleteMany(ids) {
    console.log(`[TableGateway:${this.tableName}] Initiating deleteMany operation.`);

    // Input validation
    if (!ids) {
      throw new BatchDeleteError("Batch delete failed: 'ids' parameter is required.");
    }
    if (!Array.isArray(ids)) {
      throw new BatchDeleteError(`Batch delete failed: 'ids' must be an Array. Received type: ${typeof ids}`, { ids });
    }
    if (ids.length === 0) {
      console.log(`[TableGateway:${this.tableName}] Empty ID list passed. Returning 0.`);
      return 0;
    }

    try {
      // 1. Delegate batch deletion to data source
      const deleteCount = this.dataSource.deleteRowsBatch(this.category, this.tableName, this.primaryKey, ids);

      if (deleteCount > 0) {
        // 2. Sync the PrimaryKeyCache
        if (this.db && this.db._pkCache) {
          console.log(`[TableGateway:${this.tableName}] Syncing PrimaryKeyCache for ${ids.length} IDs.`);
          ids.forEach(id => {
            this.db._pkCache.remove(this.tableName, id);
          });
        }
      }

      console.log(`[TableGateway:${this.tableName}] deleteMany complete. Deleted rows: ${deleteCount}.`);
      return deleteCount;
    } catch (e) {
      console.error(`[TableGateway:${this.tableName}] Exception caught during deleteMany: ${e.message}`);
      if (e instanceof SheetDBError) throw e;
      throw new BatchDeleteError(`System error during batch delete on '${this.tableName}': ${e.message}`, { originalError: e });
    }
  }

  /**
   * Batch update multiple records.
   * @param {Object} updatesMap - Map of { id: { column: value } }
   * @returns {Array<Object>} List of updated, normalized row objects.
   */
  updateMany(updatesMap) {
    if (!updatesMap || typeof updatesMap !== 'object') {
      throw new Error("Batch update failed: 'updatesMap' must be an object.");
    }

    const ids = Object.keys(updatesMap);
    if (ids.length === 0) return [];

    // Pre-serialize values for sheet compatibility
    const serializedUpdates = {};
    for (const [id, fields] of Object.entries(updatesMap)) {
      serializedUpdates[id] = {};
      for (const [colName, val] of Object.entries(fields)) {
        // Enforce PK isolation - do not allow PK alterations (TC 2)
        if (colName === this.primaryKey) continue;

        const colSchema = this.columns[colName];
        const type = colSchema ? colSchema.type : "string";
        serializedUpdates[id][colName] = this._prepareForWrite(val, type);
      }
    }

    // Call batch update on datasource
    const count = this.dataSource.updateRowsBatch(this.category, this.tableName, this.primaryKey, serializedUpdates);

    // Fetch and return the newly updated rows
    if (count > 0) {
      const allRows = this.all();
      return allRows.filter(row => ids.includes(String(row[this.primaryKey])));
    }
    return [];
  }

  // ==========================================
  // ⚙️ INTERNAL MAPPING & NORMALIZATION
  // ==========================================

  /**
   * Maps an object to a 2D row array based on the physical spreadsheet header order.
   * @private
   */
  _mapObjectToRow(obj) {
    try {
      let physicalHeaders = this.dataSource.getHeaders(this.category, this.tableName);
      const physicalSet = new Set(physicalHeaders);

      const schemaHeaders = Object.keys(this.columns);
      const hasMissing = schemaHeaders.some(col => !physicalSet.has(col));

      if (hasMissing) {
        physicalHeaders = handleMissingPhysicalHeaders(this, physicalHeaders);
      }

      return mapObjectToPhysicalRowArray(this, obj, physicalHeaders);
    } catch (e) {
      console.error(`[TableGateway] FATAL Error building row for ${this.tableName}: ${e.message}`);
      throw new IntegrityError(`Failed to map object to row: ${e.message}`);
    }
  }

  /**
   * Casts raw spreadsheet values to schema-defined types.
   * @private
   */
  _normalizeRow(row) {
    const normalized = {};
    Object.keys(this.columns).forEach(col => {
      try {

        normalized[col] = this._castValue(row[col], this.columns[col].type);
      }
      catch (e) {
        console.error(`[TableGateway] Error casting column ${col}: ${e.message}`);
        throw new IntegrityError(`Failed to cast column ${col}: ${e.message}`);
      }
    });
    // Preserve row number for downstream use (e.g., repository tracking)
    if (row.__rowNumber) normalized.__rowNumber = row.__rowNumber;
    return normalized;
  }

  /**
   * Type casting engine.
   * @private
   */
  _castValue(value, type) {
    if (value === null || value === undefined || value === "") return null;
    switch (type) {
      case "number":
        try { return Number(value); } catch (e) { return value; }
      case "boolean":
        try { return Boolean(value); } catch (e) { return value; }
      case "date": {
        const d = DateComparator._normalizeToDate(value);
        return d ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0) : null;
      }
      case "datetime": {
        return DateComparator._normalizeToDate(value);
      }
      case "json":
        try { return typeof value === "string" ? JSON.parse(value) : value; } catch (e) { return value; }
      default:
        return String(value);
    }
  }

  /**
   * Pre-write serialization.
   * @private
   */
  _prepareForWrite(value, type) {
    if (value === null || value === undefined) return "";
    if (type === "json") return JSON.stringify(value);
    return value;
  }
}

/**
 * Evicts stale caches and re-reads headers directly from Google Sheets when columns are missing.
 * @param {Object} gateway - The TableGateway instance.
 * @returns {Array<string>} Re-fetched clean physical headers list.
 */
function handleMissingPhysicalHeaders(gateway) {
  console.warn(`[TableGateway] Stale headers cache detected for '${gateway.tableName}'. Purging RequestCache and re-fetching...`);
  if (gateway.dataSource && gateway.dataSource.requestHeaderCache) {
    gateway.dataSource.requestHeaderCache.clear();
  }
  return gateway.dataSource.getHeaders(gateway.category, gateway.tableName);
}

/**
 * Decoupled row mapper translating key-value objects into sheet-indexed arrays.
 * @param {Object} gateway - The TableGateway instance.
 * @param {Object} obj - The target object containing write values.
 * @param {Array<string>} physicalHeaders - Ordered sheet column headers.
 * @returns {Array<any>} A flat array of values prepared for cell write.
 */
function mapObjectToPhysicalRowArray(gateway, obj, physicalHeaders) {
  return physicalHeaders.map(headerName => {
    const rawValue = obj[headerName];
    const columnSchema = gateway.columns[headerName];

    if (!columnSchema) {
      const systemColumns = new Set(['__tx_id', '__tx_status', '__created_at']);
      if (!systemColumns.has(headerName)) {
        console.warn(`[TableGateway] Warning: Writing to undeclared physical column '${headerName}' in table '${gateway.tableName}'.`);
      }
    }

    const type = columnSchema ? columnSchema.type : "string";
    return gateway._prepareForWrite(rawValue, type);
  });
}
