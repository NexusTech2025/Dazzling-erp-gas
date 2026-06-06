/**
 * @file NullabilityRule.js
 * Rule strategy enforcing nullability for SET_NULL deletion policies.
 */

const BaseRule = require('./BaseRule');
const Logger = require('../../logger/Logger');

class NullabilityRule extends BaseRule {
  constructor() {
    super('NullabilityRule');
  }

  execute(tableName, schema, allSchemas, context) {
    for (const [colName, colSchema] of Object.entries(schema.columns)) {
      if (colSchema.type === 'foreign_key') {
        const onDelete = colSchema.onDelete || 'protect';
        
        Logger.logEvent({
          level: 'debug',
          category: 'linter',
          message: `[NullabilityRule] Checking [${tableName}.${colName}] onDelete policy: [${onDelete}]`
        });

        if (onDelete === 'set_null') {
          // Prevent set_null on PK or Auto fields (TC 14)
          if (colName === schema.primaryKey || colSchema.type === 'auto') {
            context.errors.push(`[${tableName}.${colName}] NullabilityError: Cannot set onDelete to 'set_null' on primary key or auto-generated fields.`);
            continue;
          }

          if (colSchema.required === true) {
            context.errors.push(`[${tableName}.${colName}] NullabilityError: The column onDelete policy is set to 'set_null', but the field is marked as 'required: true'. Required columns cannot be nullified.`);
          }
        }
      }
    }
  }
}

module.exports = NullabilityRule;
