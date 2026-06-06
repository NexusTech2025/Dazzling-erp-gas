/**
 * @file BackwardRefRule.js
 * Rule strategy validating relational symmetry and warning on missing reverse relations.
 */

const BaseRule = require('./BaseRule');
const Logger = require('../../logger/Logger');

class BackwardRefRule extends BaseRule {
  constructor() {
    super('BackwardRefRule');
  }

  execute(tableName, schema, allSchemas, context) {
    for (const [colName, colSchema] of Object.entries(schema.columns)) {
      if (colSchema.type === 'foreign_key') {
        const targetTable = colSchema.target;
        
        if (!targetTable) continue;

        if (colSchema.unidirectional === true) {
          Logger.logEvent({
            level: 'debug',
            category: 'linter',
            message: `[BackwardRefRule] [${tableName}.${colName}] marked unidirectional. Skipping symmetry check.`
          });
          continue;
        }

        Logger.logEvent({
          level: 'debug',
          category: 'linter',
          message: `[BackwardRefRule] Verifying reverse reference from [${targetTable}] back to [${tableName}] via [${colName}]`
        });

        const targetSchema = allSchemas[targetTable];
        if (!targetSchema) continue;

        // Search parent table for corresponding hasMany / hasOne relation
        let hasBackwardRef = false;
        if (targetSchema.relations) {
          for (const rel of Object.values(targetSchema.relations)) {
            if (rel.target === tableName && rel.foreignKey === colName) {
              if (rel.type === 'hasMany' || rel.type === 'hasOne') {
                hasBackwardRef = true;
                break;
              }
            }
          }
        }

        if (!hasBackwardRef) {
          context.warnings.push(`[${tableName}.${colName}] BackwardRefWarning: Parent table '${targetTable}' does not declare a reverse relationship (hasMany/hasOne) referencing '${tableName}' via foreignKey '${colName}'.`);
        }
      }
    }
  }
}

module.exports = BackwardRefRule;
