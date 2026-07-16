/**
 * @file ProjectionEngine.js
 * Component: Query Engine - Output Shaping
 * 
 * Responsibility:
 * - Filters columns based on 'select' DSL.
 * - Redacts sensitive data.
 * - Formats Apps Script types (Dates) into JSON-friendly strings.
 */

const ProjectionEngine = (function () {

  /**
   * Projects and formats a dataset.
   * @param {Array<Object>} rows - The data to project.
   * @param {Array<string>} select - Requested columns.
   * @returns {Array<Object>} The shaped dataset.
   */
  function project(rows, select) {
    if (!rows || rows.length === 0) return [];

    return rows.map(row => _projectRow(row, select));
  }

  /**
   * Internal: Resolves the schema for a row object.
   * Checks metadata row.__tableName first (for plain database rows),
   * falling back to row.constructor.schema for instantiated models.
   * 
   * @private
   * @param {Object} row - The row object to inspect.
   * @returns {Object} Schema definition object.
   * @throws {ValidationError} If row is falsy, or if BaseModel instance lacks a schema.
   * @throws {IntegrityError} If plain row lacks __tableName or if registry model is missing.
   */
  function _resolveSchema(row) {
    const ValidationErrorClass = (typeof SheetDB !== 'undefined' && SheetDB.ValidationError) || (typeof ValidationError !== 'undefined' ? ValidationError : Error);
    const IntegrityErrorClass = (typeof SheetDB !== 'undefined' && SheetDB.IntegrityError) || (typeof IntegrityError !== 'undefined' ? IntegrityError : Error);

    if (!row) {
      throw new ValidationErrorClass("Row object is undefined or null", { component: "ProjectionEngine" });
    }

    // 1. If it's a BaseModel instance/class with schema defined, return it
    const schema = row.constructor && row.constructor.schema;
    if (schema) {
      return schema;
    }

    // 2. Plain database row object validation
    const tableName = row.__tableName;
    if (!tableName) {
      throw new IntegrityErrorClass("Data Integrity Violation: Plain row object lacks metadata '__tableName' identification property.", { component: "ProjectionEngine" });
    }

    if (typeof SheetDB === 'undefined' || !SheetDB.ModelRegistry) {
      throw new IntegrityErrorClass("SheetDB ModelRegistry is not defined in scope.", { component: "ProjectionEngine" });
    }

    const modelClass = SheetDB.ModelRegistry.getModel(tableName);
    if (!modelClass) {
      throw new IntegrityErrorClass(`Data Integrity Violation: Model '${tableName}' is not registered in ModelRegistry.`, { component: "ProjectionEngine" });
    }

    const registrySchema = modelClass.schema;
    if (!registrySchema) {
      throw new ValidationErrorClass(`Model '${tableName}' lacks required 'schema' definition in registry`, { component: "ProjectionEngine", tableName });
    }

    return registrySchema;
  }

  /**
   * Internal: Projects a single row recursively (for nested relations).
   * @private
   */
  function _projectRow(row, select) {
    const projected = {};

    // 1. If select is provided, use it. Otherwise use all non-internal keys.
    const keys = select || Object.keys(row).filter(k => !k.startsWith("__"));

    keys.forEach(key => {
      let value = row[key];
      const isDate = value && (value instanceof Date || Object.prototype.toString.call(value) === '[object Date]');

      // 2. Handle Dates (Format to ISO or local date)
      if (isDate) {
        const schema = _resolveSchema(row);
        const field = schema && schema[key];
        if (field && field.type === "date" && typeof SheetDB !== 'undefined' && SheetDB.DateComparator) {
          value = SheetDB.DateComparator.toLocaleDateString(value);
        } else {
          value = value.toISOString();
        }
      }

      // 3. Handle Nested Relations (Recursive Projection)
      // Note: In our DSL, nested relations are already attached to the row by the Hydrator.
      // If the value is an array or object (not a Date), we check if it needs projection.
      if (value !== null && typeof value === 'object' && !isDate) {
        if (Array.isArray(value)) {
          value = value.map(item => _projectRow(item, null)); // Nested select handling can be expanded
        } else {
          value = _projectRow(value, null);
        }
      }

      projected[key] = value;
    });

    return projected;
  }

  return {
    project: project
  };

})();
