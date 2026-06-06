/**
 * @file BaseRule.js
 * Abstract strategy class for defining linter rules.
 */

class BaseRule {
  constructor(name) {
    this.name = name;
  }

  /**
   * Executed by the SchemaLinter to validate a specific constraint.
   * @param {string} tableName - Current table being evaluated.
   * @param {Object} schema - Schema definition of the table.
   * @param {Object} allSchemas - Map of all parsed schemas in the system.
   * @param {Object} context - Compilation warnings/errors state tracking.
   */
  execute(tableName, schema, allSchemas, context) {
    throw new Error("BaseRule.execute() must be implemented.");
  }
}

module.exports = BaseRule;
