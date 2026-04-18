/**
 * @file Registries.js
 * Layer: Structural Metadata Provider
 * 
 * Responsibility:
 * - Provide a high-level API to query the Schema V1 JSON structure.
 * - Resolve table names to their respective Categories (Spreadsheets).
 * - Extract column and primary key metadata for the TableGateway.
 */

class SchemaRegistry {
  /**
   * @param {Object} schema - The Schema V1 JSON object.
   */
  constructor(schema) {
    if (!schema || !schema.categories) {
      throw new Error("Invalid Schema: A canonical Schema V1 object is required.");
    }
    this._schema = schema;
    this._tableMap = this._buildTableMap();
  }

  /**
   * Internal helper to build a flat map of Table -> Category for O(1) lookups.
   * @private
   */
  _buildTableMap() {
    const map = {};
    for (const [catName, catData] of Object.entries(this._schema.categories)) {
      for (const tableName of Object.keys(catData.tables)) {
        map[tableName] = catName;
      }
    }
    return map;
  }

  getCategoryForTable(tableName) {
    const category = this._tableMap[tableName];
    if (!category) throw new Error(`Table '${tableName}' not found in schema.`);
    return category;
  }

  getTableSchema(tableName) {
    const category = this.getCategoryForTable(tableName);
    return this._schema.categories[category].tables[tableName];
  }

  getPrimaryKey(tableName) {
    const table = this.getTableSchema(tableName);
    return table.primaryKey;
  }

  getColumns(tableName) {
    const table = this.getTableSchema(tableName);
    return table.columns;
  }

  /**
   * Returns the relations block for a specific table.
   * @param {string} tableName
   * @returns {Object} Relation definitions or empty object.
   */
  getRelations(tableName) {
    const table = this.getTableSchema(tableName);
    return table.relations || {};
  }

  /**
   * Returns a list of all table names across all categories.
   */
  listAllTables() {
    return Object.keys(this._tableMap);
  }

  getSchemaVersion() {
    return this._schema.version;
  }
}
