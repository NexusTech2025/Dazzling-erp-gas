/**
 * @file MockTableGateway.js
 * Mock implementation of TableGateway to perform read/write actions on in-memory 2D arrays.
 */
class MockTableGateway {
  /**
   * @param {string} tableName - Logical table name.
   * @param {Object} registry - Instance of SchemaRegistry.
   * @param {Object} dataSource - Injected datasource or DBContext.
   * @param {Object} [db=null] - Injected DBContext facade instance.
   */
  constructor(tableName, registry, dataSource, db) {
    this.tableName = tableName;
    this.registry = registry;
    this.db = db || dataSource || null;

    this.category = registry.getCategoryForTable(tableName);
    this.primaryKey = registry.getPrimaryKey(tableName);
    this.columns = registry.getColumns(tableName);

    // Dynamic import of shared virtual database sheets
    const { getTableData } = require('./database');
    this.sheet = getTableData(this.category, this.tableName);
  }

  /**
   * Initialize headers row if empty.
   */
  _ensureHeaders() {
    if (this.sheet.length === 0) {
      const headers = Object.keys(this.columns);
      this.sheet.push(headers);
    }
  }

  /**
   * Map row values back to raw key-value objects.
   */
  _normalizeRow(row, rowIdx) {
    const headers = this.sheet[0];
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = row[idx] !== undefined ? row[idx] : null;
    });
    obj.__rowNumber = rowIdx + 2; // Mimics sheet row numbering (1-indexed headers + 1 offset)
    return obj;
  }

  all() {
    this._ensureHeaders();
    return this.sheet.slice(1).map((row, idx) => this._normalizeRow(row, idx));
  }

  isTableExist() {
    return this.sheet.length > 0;
  }

  find(id) {
    return this.all().find(row => String(row[this.primaryKey]) === String(id)) || null;
  }

  where(filters = {}) {
    return this.all().filter(row => {
      return Object.entries(filters).every(([key, value]) => String(row[key]) === String(value));
    });
  }

  findOne(filters = {}) {
    return this.all().find(row => {
      return Object.entries(filters).every(([key, value]) => String(row[key]) === String(value));
    }) || null;
  }

  count(filters = {}) {
    return this.where(filters).length;
  }

  insert(data) {
    this._ensureHeaders();
    const headers = this.sheet[0];

    // Simulate auto-generated ID if schema defines auto field
    const pkSchema = this.columns[this.primaryKey];
    if (pkSchema && pkSchema.type === "auto" && (!data[this.primaryKey] || data[this.primaryKey] === "")) {
      const prefix = pkSchema.idPrefix || "ID";
      const existingCount = this.sheet.length - 1;
      data[this.primaryKey] = `${prefix}-${1000 + existingCount}`;
    }

    if (!data[this.primaryKey]) {
      throw new Error(`Insert failed: Missing primary key '${this.primaryKey}'`);
    }

    const newRow = headers.map(header => data[header] !== undefined ? data[header] : null);
    this.sheet.push(newRow);

    if (this.db && this.db._pkCache) {
      this.db._pkCache.add(this.tableName, data[this.primaryKey]);
    }

    return data;
  }

  insertBatch(dataArray) {
    return dataArray.map(data => this.insert(data));
  }

  update(id, updates) {
    this._ensureHeaders();
    const headers = this.sheet[0];
    const pkIdx = headers.indexOf(this.primaryKey);

    for (let i = 1; i < this.sheet.length; i++) {
      if (String(this.sheet[i][pkIdx]) === String(id)) {
        headers.forEach((header, idx) => {
          if (updates[header] !== undefined) {
            this.sheet[i][idx] = updates[header];
          }
        });
        return this._normalizeRow(this.sheet[i], i - 1);
      }
    }
    throw new Error(`Update failed: Record '${id}' not found.`);
  }

  remove(id) {
    this._ensureHeaders();
    const headers = this.sheet[0];
    const pkIdx = headers.indexOf(this.primaryKey);

    for (let i = 1; i < this.sheet.length; i++) {
      if (String(this.sheet[i][pkIdx]) === String(id)) {
        this.sheet.splice(i, 1);
        if (this.db && this.db._pkCache) {
          this.db._pkCache.remove(this.tableName, id);
        }
        return true;
      }
    }
    return false;
  }

  deleteMany(ids) {
    let deletedCount = 0;
    ids.forEach(id => {
      if (this.remove(id)) deletedCount++;
    });
    return deletedCount;
  }

  updateMany(updatesMap) {
    const results = [];
    Object.entries(updatesMap).forEach(([id, updates]) => {
      results.push(this.update(id, updates));
    });
    return results;
  }
}

module.exports = { MockTableGateway };
