/**
 * AutoKeyField_Override_Policy
 * Coordinates identity safeguard boundaries at the controller/API edge.
 */
const AutoKeyField_Override_Policy = (() => {
  /**
   * Evaluates override constraints and conditionally clears manual IDs in production.
   * @param {string} tableName - Collection target name.
   * @param {Object} data - Input payload mutations.
   * @param {Object} db - Active database instance for config lookup.
   * @param {Object} tableSchema - Configured table schema attributes.
   * @returns {void}
   */
  function evaluate(tableName, data, db, tableSchema) {
    if (!tableSchema || !tableSchema.primaryKey) return;

    const primaryKeyField = tableSchema.primaryKey;
    const pkConfig = tableSchema.columns[primaryKeyField];

    // Enforce guardrail only on auto-generated primary key fields
    if (pkConfig && pkConfig.type === "auto") {
      const hasProvidedId = data[primaryKeyField] !== undefined && data[primaryKeyField] !== null && data[primaryKeyField] !== "";

      if (hasProvidedId) {
        const allowOverride = db && db._config && db._config.allowAutoOverride === true;
        if (!allowOverride) {
          console.warn(`[AutoKeyField_Override_Policy] Client-supplied primary key override detected for '${tableName}.${primaryKeyField}' in PRODUCTION. Clearing value to enforce safe auto-generation.`);
          
          // Clear/delete the overridden value to prevent downstream ORM validation errors
          delete data[primaryKeyField];
        }
      }
    }
  }

  return { evaluate };
})();

// Export to Global Namespace for Google Apps Script execution context
globalThis.AutoKeyField_Override_Policy = AutoKeyField_Override_Policy;
