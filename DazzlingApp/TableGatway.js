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
      const missing = [!entityName && "entityName", !schemaRegistry && "schemaRegistry", !dataSource && "dataSource"].filter(Boolean);
      Logger.log(`[TableGateway.constructor] Error: Missing dependencies: ${missing.join(", ")}`);
      throw new TableGatewayError("Critical dependencies missing during initialization.", {
        missing
      });
    }

    this._entityName = entityName;
    this.schemaRegistry = schemaRegistry;
    this.dataSource = dataSource;

    try {
      this.tableName = schemaRegistry.getTableName(entityName);
      this.primaryKey = schemaRegistry.getPrimaryKey(entityName);
      this.columns = schemaRegistry.getColumns(entityName);
    } catch (e) {
      Logger.log(`[TableGateway.constructor] Schema resolution failure for "${entityName}": ${e.message}`);
      throw new TableGatewayError(`Schema resolution failed for '${entityName}'.`, {
        entity: entityName,
        cause: e.message
      });
    }
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
      Logger.log(`[TableGateway.getAll] Error for "${this._entityName}": ${error.message}`);
      throw new TableGatewayError(`Critical data access failure for '${this._entityName}'.`, {
        operation: "getAll",
        tableName: this.tableName,
        cause: error.message,
        details: error.meta || {}
      });
    }
  }

  /**
   * Find by primary key
   */
  findById(value) {
    try {
      const normalizedValue = this._normalizeValue(value, this.columns[this.primaryKey].type);
      const results = this.filter({ [this.primaryKey]: normalizedValue });
      return results.length > 0 ? results[0] : null;
    } catch (e) {
      Logger.log(`[TableGateway.findById] Error for "${this._entityName}" with ID "${value}": ${e.message}`);
      throw new TableGatewayError(`ID lookup failed for '${this._entityName}'.`, {
        operation: "findById",
        idValue: value,
        cause: e.message
      });
    }
  }

  /**
   * MVP: Equality-based filtering only
   */
  filter(filters = {}) {
    try {
      this.schemaRegistry.validateFilter(this._entityName, filters);

      const rows = this.getAll();

      return rows.filter(row => {
        return Object.keys(filters).every(key => {
          const expected = this._normalizeValue(filters[key], this.columns[key].type);
          return row[key] === expected;
        });
      });

    } catch (error) {
      Logger.log(`[TableGateway.filter] Error for "${this._entityName}" with filters ${JSON.stringify(filters)}: ${error.message}`);
      if (error instanceof TableGatewayError) throw error;
      throw new TableGatewayError(`Filtering engine failure for '${this._entityName}'.`, {
        operation: "filter",
        appliedFilters: filters,
        cause: error.message
      });
    }
  }

  /**
   * Insert a single record
   */
  insert(data) {
    try {
      if (!data[this.primaryKey]) {
        throw new TableGatewayError(`Primary key '${this.primaryKey}' is missing in payload.`, {
          entity: this._entityName,
          payload: data
        });
      }

      const rowArray = this._mapObjectToRow(data);
      this.dataSource.insertRows(this.tableName, [rowArray]);

      return this._normalizeRow(data);

    } catch (error) {
      Logger.log(`[TableGateway.insert] Error for "${this._entityName}": ${error.message}`);
      if (error instanceof TableGatewayError) throw error;
      throw new TableGatewayError(`Insert transaction failed for '${this._entityName}'.`, {
        operation: "insert",
        tableName: this.tableName,
        cause: error.message
      });
    }
  }

  /**
   * Update a record by primary key
   */
  update(id, updates) {
    try {
      // Find the existing record directly from DataSource to get metadata
      const rawRows = this.dataSource.readTable(this.tableName);
      const existing = rawRows.find(row => 
        this._normalizeValue(row[this.primaryKey], this.columns[this.primaryKey].type) == id
      );

      if (!existing) {
        throw new TableGatewayError(`Update rejected: Record '${id}' not found in '${this._entityName}'.`, {
          id,
          tableName: this.tableName
        });
      }

      const rowNumber = existing.__rowNumber;
      const merged = { ...existing, ...updates };
      delete merged.__rowNumber;

      const rowArray = this._mapObjectToRow(merged);
      this.dataSource.updateRow(this.tableName, rowNumber, rowArray);

      return this._normalizeRow(merged);

    } catch (error) {
      Logger.log(`[TableGateway.update] Error for "${this._entityName}" with ID "${id}": ${error.message}`);
      if (error instanceof TableGatewayError) throw error;
      throw new TableGatewayError(`Update transaction failed for '${this._entityName}'.`, {
        operation: "update",
        id,
        cause: error.message
      });
    }
  }

  /**
   * Delete a record by primary key
   * 
   * @param {any} id
   */
  remove(id) {
    try {
      // 1. Find the existing record to get its row number
      const rawRows = this.dataSource.readTable(this.tableName);
      const existing = rawRows.find(row => 
        this._normalizeValue(row[this.primaryKey], this.columns[this.primaryKey].type) == id
      );

      if (!existing) {
        throw new TableGatewayError(`Delete rejected: Record '${id}' not found in '${this._entityName}'.`, {
          id,
          tableName: this.tableName
        });
      }

      const rowNumber = existing.__rowNumber;

      // 2. Perform physical deletion
      this.dataSource.deleteRow(this.tableName, rowNumber);

    } catch (error) {
      Logger.log(`[TableGateway.remove] Error for "${this._entityName}" with ID "${id}": ${error.message}`);
      if (error instanceof TableGatewayError) throw error;
      throw new TableGatewayError(`Delete transaction failed for '${this._entityName}'.`, {
        operation: "delete",
        id,
        cause: error.message
      });
    }
  }

  /**
   * Map object to row array
   * @private
   */
  _mapObjectToRow(obj) {
    try {
      return Object.keys(this.columns).map(colKey => {
        const val = obj[colKey];
        return val !== undefined ? this._prepareForWrite(val, this.columns[colKey].type) : "";
      });
    } catch (e) {
      Logger.log(`[TableGateway._mapObjectToRow] Mapping failure for "${this._entityName}": ${e.message}`);
      throw new TableGatewayError(`Row mapping failed for '${this._entityName}'. Check schema alignment.`, {
        cause: e.message
      });
    }
  }

  /**
   * @private
   */
  _prepareForWrite(value, type) {
    if (value === null || value === undefined) return "";
    if (type === "json") return JSON.stringify(value);
    return value;
  }

  /**
   * Normalize entire row
   * @private
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
   * @private
   */
  _normalizeValue(value, type) {
    if (value === null || value === undefined || value === "") return null;

    try {
      switch (type) {
        case "number":  return Number(value);
        case "string":  return String(value);
        case "boolean": return Boolean(value);
        case "date":    return value instanceof Date ? value : new Date(value);
        case "json":    return typeof value === "string" ? JSON.parse(value) : value;
        default:        return value;
      }
    } catch (e) {
      return value; // Fallback to raw if cast fails
    }
  }

  /**
   * @private
   */
  _validateSheetStructure(rows) {
    if (!rows || rows.length === 0) return;
    const row = rows[0];
    Object.keys(this.columns).forEach(column => {
      if (!(column in row)) {
        const err = `Infrastructure mismatch: Column '${column}' not found in sheet '${this.tableName}'.`;
        Logger.log(`[TableGateway._validateSheetStructure] Error: ${err}`);
        throw new TableGatewayError(err, {
          entity: this._entityName,
          missingColumn: column
        });
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
