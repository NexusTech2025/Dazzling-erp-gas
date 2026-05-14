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
  constructor(tableName, registry, dataSource) {
    this.tableName = tableName;
    this.registry = registry;
    this.dataSource = dataSource;

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
      return Object.entries(filters).every(([key, value]) => row[key] === value);
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
      return Object.entries(filters).every(([key, value]) => row[key] === value);
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
    return true;
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
      // 1. Ask DataSource for the Absolute Truth (Physical Headers)
      const physicalHeaders = this.dataSource.getHeaders(this.category, this.tableName);
      
      // 2. Map data EXACTLY to physical layout
      return physicalHeaders.map(headerName => {
        // Extract the value meant for this column
        const rawValue = obj[headerName];
        
        // Get schema rules for this column (Fallback to string if not in schema)
        const columnSchema = this.columns[headerName];
        const type = columnSchema ? columnSchema.type : "string";
        
        // Serialize safely
        return this._prepareForWrite(rawValue, type);
      });
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
      normalized[col] = this._castValue(row[col], this.columns[col].type);
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
    try {
      switch (type) {
        case "number":   return Number(value);
        case "boolean":  return Boolean(value);
        case "date":     
        case "datetime": return value instanceof Date ? value : new Date(value);
        case "json":     return typeof value === "string" ? JSON.parse(value) : value;
        default:         return String(value);
      }
    } catch (e) { return value; }
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
