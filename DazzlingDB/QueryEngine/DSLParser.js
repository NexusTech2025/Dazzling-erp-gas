/**
 * @file DSLParser.js
 * Component: Query Engine - Parser & Validator
 * 
 * Responsibility:
 * - Sanitizes incoming JSON DSL payloads.
 * - Validates tables and columns against full_schema.json.
 * - Strips sensitive system fields.
 */

const DSLParser = (function() {

  /**
   * Main entry point for parsing and validating a query.
   * @param {Object} query - The raw DSL payload.
   * @returns {Object} Validated and sanitized query object.
   */
  function parse(query) {
    if (!query.target) {
      throw new Error("Query Engine Error: 'target' table is required.");
    }

    // 1. Verify Target Table exists in Schema
    const schema = _getSchema();
    const tableSchema = _findTableSchema(query.target, schema);
    if (!tableSchema) {
      throw new Error(`Query Engine Error: Target table '${query.target}' not found in schema.`);
    }

    // 2. Sanitize Components
    const sanitized = {
      target: query.target,
      select: _sanitizeSelect(query.select, tableSchema),
      where: _sanitizeWhere(query.where, tableSchema),
      include: _sanitizeInclude(query.include, tableSchema, schema),
      sort: _sanitizeSort(query.sort, tableSchema),
      pagination: _sanitizePagination(query.pagination)
    };

    return Object.freeze(sanitized);
  }

  /**
   * Internal: Retrieves the global schema object.
   * @private
   */
  function _getSchema() {
    if (typeof DATABASE_SCHEMA === 'undefined') {
      throw new Error("Query Engine Error: DATABASE_SCHEMA is not defined.");
    }
    return DATABASE_SCHEMA;
  }

  /**
   * Internal: Finds a table definition across all categories.
   * @private
   */
  function _findTableSchema(tableName, schema) {
    for (const category in schema.categories) {
      if (schema.categories[category].tables[tableName]) {
        return schema.categories[category].tables[tableName];
      }
    }
    return null;
  }

  /**
   * Internal: Ensures only valid and non-sensitive columns are selected.
   * @private
   */
  function _sanitizeSelect(selectArray, tableSchema) {
    if (!selectArray || !Array.isArray(selectArray)) return null;

    const validColumns = Object.keys(tableSchema.columns);
    const sensitiveFields = ["password_hash", "password_salt", "failed_attempts"];

    return selectArray.filter(col => {
      return validColumns.includes(col) && !sensitiveFields.includes(col);
    });
  }

  /**
   * Internal: Basic validation for the 'where' clause.
   * Detailed operator validation happens in the PredicateBuilder.
   * @private
   */
  function _sanitizeWhere(whereClause, tableSchema) {
    if (!whereClause || typeof whereClause !== 'object') return {};

    const validColumns = Object.keys(tableSchema.columns);
    const sanitizedWhere = {};

    for (const key in whereClause) {
      if (validColumns.includes(key)) {
        sanitizedWhere[key] = whereClause[key];
      }
    }

    return sanitizedWhere;
  }

  /**
   * Internal: Validates and shapes the 'include' relations.
   * @private
   */
  function _sanitizeInclude(include, tableSchema, schema) {
    if (!include) return null;

    // Convert array format to object format for internal consistency
    const includeObj = Array.isArray(include) 
      ? include.reduce((acc, rel) => ({ ...acc, [rel]: {} }), {})
      : include;

    const sanitizedInclude = {};
    const validRelations = tableSchema.relations || {};

    for (const relKey in includeObj) {
      if (validRelations[relKey]) {
        const targetTable = validRelations[relKey].target;
        const targetTableSchema = _findTableSchema(targetTable, schema);
        
        // Recursively sanitize nested queries inside the include
        sanitizedInclude[relKey] = {
          target: targetTable,
          ...includeObj[relKey],
          // Ensure nested select and include are also sanitized
          select: _sanitizeSelect(includeObj[relKey].select, targetTableSchema),
          include: _sanitizeInclude(includeObj[relKey].include, targetTableSchema, schema)
        };
      }
    }

    return sanitizedInclude;
  }

  /**
   * Internal: Validates sort structure.
   * @private
   */
  function _sanitizeSort(sort, tableSchema) {
    if (!sort) return null;
    const sortArray = Array.isArray(sort) ? sort : [sort];
    const validColumns = Object.keys(tableSchema.columns);

    return sortArray.filter(s => {
      return s.field && validColumns.includes(s.field);
    }).map(s => ({
      field: s.field,
      order: (s.order || "ASC").toUpperCase()
    }));
  }

  /**
   * Internal: Enforces pagination limits.
   * @private
   */
  function _sanitizePagination(p) {
    const pagination = p || {};
    return {
      limit: Math.min(Number(pagination.limit) || 50, 1000), // Max 1000 rows per trip
      offset: Math.max(Number(pagination.offset) || 0, 0)
    };
  }

  return {
    parse: parse
  };

})();
