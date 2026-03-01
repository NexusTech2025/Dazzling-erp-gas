/**
 * ==============================================================
 * TableGateway.gs
 * ==============================================================
 *
 * Layer: Table Abstraction Layer
 *
 * Responsibility:
 * - Represent one sheet as one logical table
 * - Normalize row data types
 * - Validate schema alignment
 * - Execute filtering (MVP: equality only)
 * - Provide primary key lookup
 * - Map objects to row arrays for writing
 * - Orchestrate efficient inserts and updates
 *
 * MUST NOT:
 * - Wrap models
 * - Resolve relations
 * - Contain business logic
 * - Access SpreadsheetApp directly
 *
 * Depends on:
 * - SchemaRegistry
 * - SheetDataSource
 * ==============================================================
 */

class TableGatewayError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = "TableGatewayError";
    this.meta = meta;
  }
}

class TableGateway {
  /**
   * @param {string} entityName
   * @param {SchemaRegistry} schemaRegistry
   * @param {SheetDataSource} dataSource
   */
  constructor(entityName, schemaRegistry, dataSource) {
    if (!entityName || !schemaRegistry || !dataSource) {
      throw new TableGatewayError("entityName, schemaRegistry, and dataSource are required.");
    }

    this.entityName = entityName;
    this.schemaRegistry = schemaRegistry;
    this.dataSource = dataSource;

    this.tableName = schemaRegistry.getTableName(entityName);
    this.primaryKey = schemaRegistry.getPrimaryKey(entityName);
    this.columns = schemaRegistry.getColumns(entityName);
  }

  /**
   * Retrieve all rows (normalized)
   */
  getAll() {
    try {
      const rows = this.dataSource.readTable(this.tableName);
      this._validateSheetStructure(rows);
      return rows.map(row => this._normalizeRow(row));
    } catch (error) {
      if (error instanceof TableGatewayError) throw error;
      throw new TableGatewayError("Failed to retrieve all rows.", {
        entity: this.entityName,
        cause: error.message
      });
    }
  }

  /**
   * Find by primary key
   */
  findById(value) {
    const normalizedValue = this._normalizeValue(value, this.columns[this.primaryKey].type);

    const results = this.filter({ [this.primaryKey]: normalizedValue });
    return results.length > 0 ? results[0] : null;
  }

  /**
   * MVP: Equality-based filtering only
   */
  filter(filters = {}) {
    try {
      this.schemaRegistry.validateFilter(this.entityName, filters);

      const rows = this.getAll();

      return rows.filter(row => {
        return Object.keys(filters).every(key => {
          return row[key] === this._normalizeValue(filters[key], this.columns[key].type);
        });
      });

    } catch (error) {
      if (error instanceof TableGatewayError) throw error;
      throw new TableGatewayError("Filtering failed.", {
        entity: this.entityName,
        cause: error.message
      });
    }
  }

  /**
   * Insert a single record
   * 
   * @param {Object} data
   * @returns {Object} The inserted record (normalized)
   */
  insert(data) {
    try {
      // 1. Ensure primary key exists (or throw if schema requires auto-gen)
      if (!data[this.primaryKey]) {
        throw new TableGatewayError(`Primary key '${this.primaryKey}' is required for insert.`);
      }

      // 2. Map object to ordered row array based on schema
      const rowArray = this._mapObjectToRow(data);

      // 3. Delegate to data source for efficient write
      this.dataSource.insertRows(this.tableName, [rowArray]);

      return this._normalizeRow(data);

    } catch (error) {
      throw new TableGatewayError("Insert operation failed.", {
        entity: this.entityName,
        cause: error.message
      });
    }
  }

  /**
   * Update a record by primary key
   * 
   * @param {any} id
   * @param {Object} updates
   * @returns {Object} The updated record (normalized)
   */
  update(id, updates) {
    try {
      // 1. Find the existing record to get its row number
      // Note: getAll() attaches __rowNumber via DataSource
      const existing = this.dataSource.readTable(this.tableName)
        .find(row => row[this.primaryKey] == id);

      if (!existing) {
        throw new TableGatewayError(`Record with ID '${id}' not found.`);
      }

      const rowNumber = existing.__rowNumber;

      // 2. Merge updates into existing data
      const merged = { ...existing, ...updates };
      delete merged.__rowNumber; // Don't write metadata back

      // 3. Map to row array
      const rowArray = this._mapObjectToRow(merged);

      // 4. Surgical update via data source
      this.dataSource.updateRow(this.tableName, rowNumber, rowArray);

      return this._normalizeRow(merged);

    } catch (error) {
      throw new TableGatewayError("Update operation failed.", {
        entity: this.entityName,
        id,
        cause: error.message
      });
    }
  }

  /**
   * Map a JavaScript object to an ordered row array based on schema columns.
   * @private
   */
  _mapObjectToRow(obj) {
    // We must ensure the order matches the headers in the sheet exactly.
    // Since our schema defines columns, we use the column keys.
    return Object.keys(this.columns).map(colKey => {
      const val = obj[colKey];
      return val !== undefined ? this._prepareForWrite(val, this.columns[colKey].type) : "";
    });
  }

  /**
   * Prepare a value for writing to spreadsheet
   * @private
   */
  _prepareForWrite(value, type) {
    if (value === null || value === undefined) return "";
    
    if (type === "json") {
      return JSON.stringify(value);
    }
    
    return value;
  }

  /**
   * Normalize entire row based on schema types
   */
  _normalizeRow(row) {
    const normalized = {};

    Object.keys(this.columns).forEach(column => {
      const columnDef = this.columns[column];
      normalized[column] = this._normalizeValue(row[column], columnDef.type);
    });

    return normalized;
  }

  /**
   * Normalize individual value
   */
  _normalizeValue(value, type) {
    if (value === null || value === undefined || value === "") return null;

    switch (type) {
      case "number":
        return Number(value);
      case "string":
        return String(value);
      case "boolean":
        return Boolean(value);
      case "date":
        return value instanceof Date ? value : new Date(value);
      case "json":
        return typeof value === "string" ? JSON.parse(value) : value;
      default:
        return value;
    }
  }

  /**
   * Validate sheet headers align with schema
   */
  _validateSheetStructure(rows) {
    if (!rows || rows.length === 0) return;

    const row = rows[0];

    Object.keys(this.columns).forEach(column => {
      if (!(column in row)) {
        throw new TableGatewayError(
          `Column '${column}' missing in sheet for entity '${this.entityName}'.`
        );
      }
    });
  }
}

/**
 * ==============================================================
 * Future Improvements
 * ==============================================================
 *
 * 1. In-memory request cache
 * 2. Column indexing (Map-based)
 * 3. Advanced filter operators (gt, lt, in)
 * 4. Snapshot mode for batch reads
 * 5. Strict schema enforcement mode
 * 6. Performance logging hooks
 * 7. Pluggable FilterEngine abstraction
 * ==============================================================
 */
