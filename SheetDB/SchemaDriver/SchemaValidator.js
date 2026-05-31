/**
 * @file SchemaValidator.js
 * Pure, stateless rule engine for validating data against a JSON schema.
 * DOES NOT access the database.
 */

class SchemaValidator {
  /**
   * Orchestrates validation over all records in the batch.
   * @param {Object} buckets - The data grouped by table { TableName: [records] }
   * @param {Object} fullSchema - The complete database schema
   * @param {Object} context - Validation context (e.g., pre-fetched Parent PKs)
   * @returns {Object} { isValid: boolean, errors: Array }
   */
  validateAll(buckets, fullSchema, context) {
    const errors = [];

    // Helper to find table schema
    const getTableSchema = (tableName) => {
      for (const cat of Object.values(fullSchema.categories)) {
        if (cat.tables && cat.tables[tableName]) {
          return cat.tables[tableName];
        }
      }
      return null;
    };

    for (const [tableName, records] of Object.entries(buckets)) {
      const tableSchema = getTableSchema(tableName);
      if (!tableSchema) {
        errors.push({
          table: tableName,
          index: -1,
          field: "N/A",
          message: `Table '${tableName}' not found in schema.`,
          value: null
        });
        continue;
      }

      for (let i = 0; i < records.length; i++) {
        const record = records[i];

        // 1. Structural & Value Validation
        const recordErrors = this.validateRecord(record, tableSchema);
        recordErrors.forEach(err => {
          errors.push({
            table: tableName,
            index: i,
            ...err
          });
        });

        // 2. Relational Validation
        if (tableSchema.relations) {
          const relErrors = this.validateRelational(record, tableSchema.relations, context);
          relErrors.forEach(err => {
            errors.push({
              table: tableName,
              index: i,
              ...err
            });
          });
        }
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validates a full row against its table schema.
   * @returns {Array} Array of error objects for this record
   */
  validateRecord(record, tableSchema) {
    const errors = [];
    const columns = tableSchema.columns;

    // Check for required fields
    for (const [colName, colSchema] of Object.entries(columns)) {
      if (colSchema.required && (record[colName] === undefined || record[colName] === null || record[colName] === '')) {
        errors.push({
          field: colName,
          message: "Field is required but missing or empty.",
          value: record[colName]
        });
      }
    }

    // Check for unknown fields and validate known fields
    for (const [key, value] of Object.entries(record)) {
      // Ignore internal framework fields (not in schema)
      if (key === '__rowNumber') continue;
      
      const fieldSchema = columns[key];
      
      if (!fieldSchema) {
        errors.push({
          field: key,
          message: `Unknown field '${key}' not defined in schema.`,
          value: value
        });
        continue;
      }

      // Ignore dynamically injected system fields (e.g., __tx_id)
      if (fieldSchema.system === true) continue;

      const valErrors = this.validateValue(value, fieldSchema);
      valErrors.forEach(msg => {
        errors.push({
          field: key,
          message: msg,
          value: value
        });
      });
    }

    return errors;
  }

  /**
   * Validates foreign key relationships against the provided context.
   */
  validateRelational(record, relationsSchema, context) {
    const errors = [];

    for (const [relName, relDef] of Object.entries(relationsSchema)) {
      if (relDef.type === 'belongsTo') {
        const fkValue = record[relDef.foreignKey];
        
        // If the FK is present, validate it against the pre-fetched Set of valid PKs
        if (fkValue !== undefined && fkValue !== null && fkValue !== '') {
          const targetTable = relDef.target;
          const validPks = context.parentPKs ? context.parentPKs[targetTable] : null;
          const coercedFk = String(fkValue).trim();

          if (!validPks || !validPks.has(coercedFk)) {
            errors.push({
              field: relDef.foreignKey,
              message: `Foreign Key Mismatch: Parent ID '${fkValue}' not found in '${targetTable}'.`,
              value: fkValue
            });
          }
        }
      } else if (relDef.type === 'belongsToPolymorphic') {
        const typeValue = record[relDef.typeField];
        const fkValue = record[relDef.idField];

        if (!typeValue && (fkValue === null || fkValue === undefined || fkValue === '')) {
          continue; // Optional and empty is valid
        }

        if (!typeValue && fkValue) {
          errors.push({
            field: relDef.typeField,
            message: `Polymorphic type must be provided when a dynamic ID is set.`,
            value: typeValue
          });
          continue;
        }

        if (typeValue && !fkValue) {
          errors.push({
            field: relDef.idField,
            message: `Polymorphic ID must be provided when a type is set.`,
            value: fkValue
          });
          continue;
        }

        try {
          if (typeof PolymorphicRegistry !== 'undefined') {
            const targetTable = PolymorphicRegistry.resolve(typeValue);
            const validPks = context.parentPKs ? context.parentPKs[targetTable] : null;
            const coercedFk = String(fkValue).trim();

            if (!validPks || !validPks.has(coercedFk)) {
              errors.push({
                field: relDef.idField,
                message: `Polymorphic ID Mismatch: ID '${fkValue}' not found in dynamically resolved table '${targetTable}' for type '${typeValue}'.`,
                value: fkValue
              });
            }
          }
        } catch (e) {
          errors.push({
            field: relDef.typeField,
            message: `Polymorphic mapping resolution failed: ${e.message}`,
            value: typeValue
          });
        }
      }
    }

    return errors;
  }

  /**
   * The atomic unit. Validates a single value against its field schema.
   * @returns {Array<string>} Array of error messages
   */
  validateValue(value, fieldSchema) {
    const errors = [];

    if (value === undefined || value === null || value === '') {
      return errors; // Required check is handled in validateRecord
    }

    const type = fieldSchema.type;

    // Basic Type Check
    const typeErr = Validate.type(value, type);
    if (typeErr) errors.push(typeErr);

    // Min / Max (Numeric)
    if (type === 'number') {
      const minMaxErr = Validate.minMax(value, fieldSchema.min, fieldSchema.max);
      if (minMaxErr) errors.push(minMaxErr);
    }

    // MinLength / MaxLength / Pattern / Format (String)
    if (type === 'string') {
      const lenErr = Validate.length(value, fieldSchema.minLength, fieldSchema.maxLength);
      if (lenErr) errors.push(lenErr);

      const patErr = Validate.pattern(value, fieldSchema.pattern);
      if (patErr) errors.push(patErr);

      const fmtErr = Validate.format(value, fieldSchema.format);
      if (fmtErr) errors.push(fmtErr);
    }

    // Choices (Enum)
    const choices = fieldSchema.choices || fieldSchema.enum; // Support both naming conventions
    if (type === 'enum' && choices) {
      const choiceErr = Validate.choices(value, choices);
      if (choiceErr) errors.push(choiceErr);
    }

    return errors;
  }
}
