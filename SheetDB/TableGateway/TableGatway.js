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
    const rawRows = this.dataSource.readTable(this.category, this.tableName);
    return rawRows.map(row => this._normalizeRow(row));
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
   * Insert a new record.
   */
  insert(data) {
    if (!data[this.primaryKey]) throw new Error(`Insert failed: Missing primary key '${this.primaryKey}'.`);
    
    const rowArray = this._mapObjectToRow(data);
    this.dataSource.insertRows(this.category, this.tableName, [rowArray]);
    return this._normalizeRow(data);
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
   * Maps an object to a 2D row array based on schema column order.
   * @private
   */
  _mapObjectToRow(obj) {
    return Object.keys(this.columns).map(colKey => {
      const val = obj[colKey];
      return this._prepareForWrite(val, this.columns[colKey].type);
    });
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
