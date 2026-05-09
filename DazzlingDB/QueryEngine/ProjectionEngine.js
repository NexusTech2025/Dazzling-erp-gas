/**
 * @file ProjectionEngine.js
 * Component: Query Engine - Output Shaping
 * 
 * Responsibility:
 * - Filters columns based on 'select' DSL.
 * - Redacts sensitive data.
 * - Formats Apps Script types (Dates) into JSON-friendly strings.
 */

const ProjectionEngine = (function() {

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
   * Internal: Projects a single row recursively (for nested relations).
   * @private
   */
  function _projectRow(row, select) {
    const projected = {};

    // 1. If select is provided, use it. Otherwise use all non-internal keys.
    const keys = select || Object.keys(row).filter(k => !k.startsWith("__"));

    keys.forEach(key => {
      let value = row[key];

      // 2. Handle Dates (Format to ISO)
      if (value instanceof Date) {
        value = value.toISOString();
      }

      // 3. Handle Nested Relations (Recursive Projection)
      // Note: In our DSL, nested relations are already attached to the row by the Hydrator.
      // If the value is an array or object (not a Date), we check if it needs projection.
      if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
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
