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
    if (!schema.relations) return;

    for (const [relName, relSchema] of Object.entries(schema.relations)) {
      if (relSchema.type === 'belongsTo') {
        const targetTable = relSchema.target;
        const fk = relSchema.foreignKey;
        
        if (!targetTable || !fk) continue;

        if (relSchema.unidirectional === true) {
          Logger.logEvent({
            level: 'debug',
            category: 'linter',
            message: `[BackwardRefRule] [${tableName}.relations.${relName}] marked unidirectional. Skipping symmetry check.`
          });
          continue;
        }

        Logger.logEvent({
          level: 'debug',
          category: 'linter',
          message: `[BackwardRefRule] Verifying reverse reference from [${targetTable}] back to [${tableName}] via foreignKey [${fk}]`
        });

        const targetSchema = allSchemas[targetTable];
        if (!targetSchema) continue;

        // Search parent table for corresponding hasMany / hasOne relation
        let hasBackwardRef = false;
        if (targetSchema.relations) {
          for (const rel of Object.values(targetSchema.relations)) {
            if (rel.target === tableName && rel.foreignKey === fk) {
              if (rel.type === 'hasMany' || rel.type === 'hasOne') {
                hasBackwardRef = true;
                break;
              }
            }
          }
        }

        if (!hasBackwardRef) {
          context.warnings.push(`[${tableName}.relations.${relName}] BackwardRefWarning: Parent table '${targetTable}' does not declare a reverse relationship (hasMany/hasOne) referencing '${tableName}' via foreignKey '${fk}'.`);
        }
      }
    }
  }
}

module.exports = BackwardRefRule;
