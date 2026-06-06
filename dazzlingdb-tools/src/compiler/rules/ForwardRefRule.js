/**
 * @file ForwardRefRule.js
 * Rule strategy enforcing that all foreign key target tables exist and are valid.
 */

const BaseRule = require('./BaseRule');
const Logger = require('../../logger/Logger');

class ForwardRefRule extends BaseRule {
  constructor() {
    super('ForwardRefRule');
  }

  execute(tableName, schema, allSchemas, context) {
    for (const [colName, colSchema] of Object.entries(schema.columns)) {
      if (colSchema.type === 'foreign_key') {
        const targetTable = colSchema.target;
        
        Logger.logEvent({
          level: 'debug',
          category: 'linter',
          message: `[ForwardRefRule] Checking [${tableName}.${colName}] -> Target: [${targetTable}]`
        });

        if (targetTable === undefined || targetTable === null) {
          context.errors.push(`[${tableName}.${colName}] ForwardRefError: column of type 'foreign_key' is missing its 'target' table definition.`);
          continue;
        }

        // Validate target is a string (TC 8)
        if (typeof targetTable !== 'string') {
          context.errors.push(`[${tableName}.${colName}] ForwardRefError: Referenced target table name must be a string.`);
          continue;
        }

        if (!allSchemas[targetTable]) {
          context.errors.push(`[${tableName}.${colName}] ForwardRefError: Referenced target table '${targetTable}' does not exist in the schema registry.`);
        }
      }
    }
  }
}

module.exports = ForwardRefRule;
