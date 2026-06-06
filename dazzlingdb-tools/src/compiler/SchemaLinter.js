/**
 * @file SchemaLinter.js
 * Runner class that loads and executes validation rules against schemas.
 */

const PKRule = require('./rules/PKRule');
const ForwardRefRule = require('./rules/ForwardRefRule');
const BackwardRefRule = require('./rules/BackwardRefRule');
const NullabilityRule = require('./rules/NullabilityRule');
const Logger = require('../logger/Logger');

class SchemaLinter {
  /**
   * @param {Object} schemas - Map of { TableName: SchemaObject }
   */
  constructor(schemas) {
    this.schemas = schemas;
    
    // Register linter rules
    this.rules = [
      new PKRule(),
      new ForwardRefRule(),
      new BackwardRefRule(),
      new NullabilityRule()
    ];
  }

  /**
   * Executes all registered validation strategies.
   * @returns {Object} { isValid: boolean, errors: string[], warnings: string[] }
   */
  lint() {
    const context = {
      errors: [],
      warnings: []
    };

    for (const [tableName, schema] of Object.entries(this.schemas)) {
      Logger.logEvent({
        level: 'verbose',
        category: 'linter',
        message: `Linting table [${tableName}]`
      });

      this.rules.forEach(rule => {
        try {
          Logger.logEvent({
            level: 'debug',
            category: 'linter',
            message: `Executing rule [${rule.name}] on table [${tableName}]`
          });
          rule.execute(tableName, schema, this.schemas, context);
        } catch (e) {
          const crashMsg = `[${tableName}] Unexpected crash in rule '${rule.name}': ${e.message}`;
          Logger.logEvent({
            level: 'error',
            category: 'linter',
            message: crashMsg
          });
          context.errors.push(crashMsg);
        }
      });
    }

    return {
      isValid: context.errors.length === 0,
      errors: context.errors,
      warnings: context.warnings
    };
  }
}

module.exports = SchemaLinter;
