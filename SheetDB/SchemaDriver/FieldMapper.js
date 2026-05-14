/**
 * @file FieldMapper.js
 * Layer: ORM - Field Bridge Layer
 * 
 * Responsibility:
 * - Translate JSON schema configurations into instantiated Field objects.
 * - Map technical metadata (required, default, enum) to Field arguments.
 */

const FieldMapper = (function() {

  /**
   * Translates a JSON column definition into a concrete Field instance.
   * @param {string} colName - Column name.
   * @param {Object} colMeta - Schema metadata for the column.
   * @param {boolean} isPK - Whether this column is the primary key.
   * @returns {BaseField} An instance of a Field class.
   */
  function mapToField(colName, colMeta, isPK) {
    const options = {
      ...colMeta, // Spread all metadata (maxLength, min, autoNow, prefix, etc.)
      name: colName,
      required: colMeta.required || false,
      choices: colMeta.enum || colMeta.choices || null,
      primaryKey: isPK
    };

    // Special Case: Auto-ID generation for Primary Keys
    if (colMeta.type === "auto" || (isPK && colMeta.type === "string" && !colMeta.required)) {
      options.prefix = colMeta.idPrefix || _generatePrefix(colName);
      return new AutoField(options);
    }

    return _switchField(colMeta.type, options);
  }

  /**
   * Internal: Maps a string type identifier to a concrete Field class.
   * @private
   */
  function _switchField(type, options) {
    switch (type) {
      case "string":
        return new CharField(options);
      case "number":
        return new IntegerField(options); // Defaulting to Integer, FloatField also available
      case "boolean":
        return new BooleanField(options);
      case "json":
        return new JSONField(options);
      case "date":
      case "datetime":
        // Special check for auto-timestamp fields
        const colName = options.name;
        const isTimestamp = (colName === "created_at" || colName === "__created_at" || colName === "updated_at");
        return new DateTimeField({ 
          ...options, 
          autoNowAdd: isTimestamp && (colName !== "updated_at"),
          autoNow: (colName === "updated_at")
        });
      default:
        return new CharField(options);
    }
  }

  /**
   * Internal: Generates a 3-character prefix for AutoFields.
   * @private
   */
  function _generatePrefix(colName) {
    if (colName.includes("_")) {
      const parts = colName.split("_");
      return (parts[0].charAt(0) + parts[1].substring(0, 2)).toUpperCase();
    }
    return colName.substring(0, 3).toUpperCase();
  }

  return {
    mapToField: mapToField
  };

})();

globalThis.FieldMapper = FieldMapper;
