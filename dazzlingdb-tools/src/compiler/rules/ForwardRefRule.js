/**
 * @file ForwardRefRule.js
 * Rule strategy enforcing that all foreign key target tables exist and are valid.
 */

const BaseRule = require('./BaseRule');
const Logger = require('../../logger/Logger');

const RELATION_VALIDATION_REGISTRY = {
  hasOne: (targetColSchema, { tableName, relName, targetTable, fk, context }) => {
    if (targetColSchema.unique !== true) {
      context.errors.push(`[${tableName}.relations.${relName}] ForeignKeyError: Foreign key column '${fk}' in target table '${targetTable}' must have 'unique: true' to enforce 'hasOne' (1-to-1) relationship.`);
    }
  },
  hasMany: (targetColSchema, { tableName, relName, targetTable, fk, context }) => {
    if (targetColSchema.unique === true) {
      context.errors.push(`[${tableName}.relations.${relName}] ForeignKeyError: Foreign key column '${fk}' in target table '${targetTable}' cannot be 'unique: true' for 'hasMany' relationship.`);
    }
  }
};

class ForwardRefRule extends BaseRule {
  constructor() {
    super('ForwardRefRule');
  }

  execute(tableName, schema, allSchemas, context) {
    if (!schema.relations) return;

    for (const [relName, relSchema] of Object.entries(schema.relations)) {
      if (relSchema.type === 'belongsToPolymorphic') {
        const idField = relSchema.idField;
        const typeField = relSchema.typeField;

        if (!idField || !typeField) {
          context.errors.push(`[${tableName}.relations.${relName}] PolymorphicError: Polymorphic relation is missing 'idField' or 'typeField'.`);
          continue;
        }

        if (!schema.columns || !schema.columns[idField]) {
          context.errors.push(`[${tableName}.relations.${relName}] PolymorphicError: Current table '${tableName}' does not define polymorphic ID column '${idField}' in columns.`);
        } else {
          const colSchema = schema.columns[idField];
          if (colSchema.type !== 'foreign_key') {
            context.errors.push(`[${tableName}.relations.${relName}] PolymorphicError: Polymorphic ID column '${idField}' in table '${tableName}' must have type 'foreign_key', but found type '${colSchema.type}'.`);
          } else {
            const relOnDelete = relSchema.onDelete || 'protect';
            if (!colSchema.onDelete) {
              context.errors.push(`[${tableName}.columns.${idField}] ForeignKeyError: Column '${idField}' has type 'foreign_key' but is missing the 'onDelete' policy.`);
            } else if (colSchema.onDelete !== relOnDelete) {
              context.errors.push(`[${tableName}.columns.${idField}] ForeignKeyError: Column '${idField}' onDelete policy '${colSchema.onDelete}' does not match relation '${relName}' onDelete policy '${relOnDelete}'.`);
            }
          }
        }

        if (!schema.columns || !schema.columns[typeField]) {
          context.errors.push(`[${tableName}.relations.${relName}] PolymorphicError: Current table '${tableName}' does not define polymorphic type column '${typeField}' in columns.`);
        }

        if (relSchema.mapping) {
          if (typeof relSchema.mapping !== 'object' || relSchema.mapping === null || Array.isArray(relSchema.mapping)) {
            context.errors.push(`[${tableName}.relations.${relName}] PolymorphicError: 'mapping' must be a JSON object mapping type codes to table names.`);
          } else {
            const typeCol = schema.columns[typeField];
            for (const [typeCode, targetTable] of Object.entries(relSchema.mapping)) {
              if (typeCol && typeCol.choices && !typeCol.choices.includes(typeCode)) {
                context.errors.push(`[${tableName}.relations.${relName}] PolymorphicError: Mapping key '${typeCode}' is not declared in the choices of '${typeField}'.`);
              }
              const targetSchema = allSchemas[targetTable];
              if (!targetSchema) {
                context.errors.push(`[${tableName}.relations.${relName}] PolymorphicError: Polymorphic target table '${targetTable}' in mapping for '${typeCode}' does not exist.`);
              } else if (!targetSchema.primaryKey) {
                context.errors.push(`[${tableName}.relations.${relName}] PolymorphicError: Polymorphic target table '${targetTable}' in mapping for '${typeCode}' is missing a 'primaryKey'.`);
              }
            }
          }
        }
        continue;
      }

      const targetTable = relSchema.target;
      
      if (!targetTable) {
        context.errors.push(`[${tableName}.relations.${relName}] ForwardRefError: Relation is missing the 'target' table definition.`);
        continue;
      }

      Logger.logEvent({
        level: 'debug',
        category: 'linter',
        message: `[ForwardRefRule] Checking [${tableName}.relations.${relName}] -> Target: [${targetTable}]`
      });

      if (typeof targetTable !== 'string') {
        context.errors.push(`[${tableName}.relations.${relName}] ForwardRefError: Referenced target table name must be a string.`);
        continue;
      }

      const targetSchema = allSchemas[targetTable];
      if (!targetSchema) {
        context.errors.push(`[${tableName}.relations.${relName}] ForwardRefError: Referenced target table '${targetTable}' does not exist in the schema registry.`);
        continue;
      }

      const fk = relSchema.foreignKey;
      if (!fk) {
        context.errors.push(`[${tableName}.relations.${relName}] ForeignKeyError: Relation of type '${relSchema.type}' is missing the 'foreignKey' definition.`);
        continue;
      }

      if (!targetSchema.primaryKey) {
        context.errors.push(`[${tableName}.relations.${relName}] RelationError: Target parent table '${targetTable}' does not specify a 'primaryKey' in its schema.`);
        continue;
      }

      if (relSchema.type === 'belongsTo') {
        // The foreign key column MUST exist in the CURRENT table
        if (!schema.columns || !schema.columns[fk]) {
          context.errors.push(`[${tableName}.relations.${relName}] ForeignKeyError: Current table '${tableName}' declares relation '${relName}' but does not define foreign key column '${fk}' in its schema columns.`);
        } else {
          const colSchema = schema.columns[fk];
          if (colSchema.type !== 'foreign_key') {
            context.errors.push(`[${tableName}.relations.${relName}] ForeignKeyError: Foreign key column '${fk}' in table '${tableName}' must have type 'foreign_key', but found type '${colSchema.type}'.`);
          } else {
            const relOnDelete = relSchema.onDelete || 'protect';
            if (!colSchema.onDelete) {
              context.errors.push(`[${tableName}.columns.${fk}] ForeignKeyError: Column '${fk}' has type 'foreign_key' but is missing the 'onDelete' policy.`);
            } else if (colSchema.onDelete !== relOnDelete) {
              context.errors.push(`[${tableName}.columns.${fk}] ForeignKeyError: Column '${fk}' onDelete policy '${colSchema.onDelete}' does not match relation '${relName}' onDelete policy '${relOnDelete}'.`);
            }
          }
        }
      } else if (relSchema.type === 'hasMany' || relSchema.type === 'hasOne') {
        // The foreign key column MUST exist in the TARGET table
        if (!targetSchema.columns || !targetSchema.columns[fk]) {
          context.errors.push(`[${tableName}.relations.${relName}] ForeignKeyError: Target table '${targetTable}' does not define foreign key column '${fk}' referenced by '${tableName}.${relName}'.`);
        } else {
          const targetColSchema = targetSchema.columns[fk];
          if (targetColSchema.type !== 'foreign_key') {
            context.errors.push(`[${tableName}.relations.${relName}] ForeignKeyError: Foreign key column '${fk}' in target table '${targetTable}' must have type 'foreign_key', but found type '${targetColSchema.type}'.`);
          }
          const validator = RELATION_VALIDATION_REGISTRY[relSchema.type];
          if (validator) {
            validator(targetColSchema, { tableName, relName, targetTable, fk, context });
          }
        }
      }
    }
  }
}

module.exports = ForwardRefRule;
