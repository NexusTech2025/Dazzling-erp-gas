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
    if (!schema.relations) return;

    for (const [relName, relSchema] of Object.entries(schema.relations)) {
      if (relSchema.type === 'belongsTo') {
        const fk = relSchema.foreignKey;
        if (!fk) continue;

        const colSchema = schema.columns ? schema.columns[fk] : null;
        if (!colSchema) continue;

        const onDelete = relSchema.onDelete || 'protect';
        
        Logger.logEvent({
          level: 'debug',
          category: 'linter',
          message: `[NullabilityRule] Checking [${tableName}.${fk}] onDelete policy: [${onDelete}]`
        });

        if (onDelete === 'set_null') {
          // Prevent set_null on PK or Auto fields (TC 14)
          if (fk === schema.primaryKey || colSchema.type === 'auto') {
            context.errors.push(`[${tableName}.${fk}] NullabilityError: Cannot set onDelete to 'set_null' on primary key or auto-generated fields.`);
            continue;
          }

          if (colSchema.required === true) {
            context.errors.push(`[${tableName}.${fk}] NullabilityError: The relation '${relName}' onDelete policy is set to 'set_null', but the foreign key column '${fk}' is marked as 'required: true'. Required columns cannot be nullified.`);
          }
        }
      }
    }
  }
}

module.exports = NullabilityRule;
