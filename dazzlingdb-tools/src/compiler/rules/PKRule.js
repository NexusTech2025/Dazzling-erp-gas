/**
 * @file PKRule.js
 * Rule strategy enforcing valid primaryKey columns and types.
 */

const BaseRule = require('./BaseRule');
const Logger = require('../../logger/Logger');

class PKRule extends BaseRule {
  constructor() {
    super('PrimaryKeyRule');
  }

  execute(tableName, schema, allSchemas, context) {
    const pk = schema.primaryKey;
    
    Logger.logEvent({
      level: 'debug',
      category: 'linter',
      message: `[PrimaryKeyRule] Checking table [${tableName}] primary key [${pk}]`
    });

    if (!pk) {
      context.errors.push(`[${tableName}] PrimaryKeyError: Table does not specify a 'primaryKey'.`);
      return;
    }

    const pkColumn = schema.columns[pk];
    if (!pkColumn) {
      context.errors.push(`[${tableName}] PrimaryKeyError: Specified primary key '${pk}' is not defined in the columns block.`);
      return;
    }

    // Enforce valid primary key type constraints (TC 6)
    if (!['string', 'number', 'auto'].includes(pkColumn.type)) {
      context.errors.push(`[${tableName}] PrimaryKeyError: Primary key '${pk}' cannot be of type '${pkColumn.type}'. PK must be string, number, or auto.`);
    }
  }
}

module.exports = PKRule;
