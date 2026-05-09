/**
 * @file ModelRegistry.js
 * Layer: ORM - Dynamic Generation Layer
 * 
 * Responsibility:
 * - Bootstraps the Model ecosystem from the JSON schema.
 * - Dynamically generates named BaseModel subclasses at runtime.
 * - Caches and provides Model constructors for the system.
 */

const ModelRegistry = (function() {
  const _models = {}; // In-memory cache of generated classes

  /**
   * Initializes the registry by parsing the full schema.
   * @param {Object} fullSchema - The database schema object.
   */
  function initialize(fullSchema) {
    console.log("[ModelRegistry] Initializing Dynamic Models...");
    
    for (const catName in fullSchema.categories) {
      const tables = fullSchema.categories[catName].tables;
      
      for (const tableName in tables) {
        const tableMeta = tables[tableName];
        const compiledFields = _compileFields(tableMeta);
        
        // Generate the class using the robust named pattern
        const ModelClass = _createDynamicClass(tableName, compiledFields, catName);
        _models[tableName] = ModelClass;
      }
    }
    
    console.log(`[ModelRegistry] Successfully generated ${Object.keys(_models).length} Models.`);
  }

  /**
   * Retrieves a generated Model constructor.
   * @param {string} tableName - Name of the table.
   * @returns {Function} BaseModel subclass constructor.
   */
  function getModel(tableName) {
    if (!_models[tableName]) {
      throw new Error(`ModelRegistry Error: Model '${tableName}' not found or initialized.`);
    }
    return _models[tableName];
  }

  /**
   * Internal: Translates schema columns into Field instances.
   * @private
   */
  function _compileFields(tableMeta) {
    const fields = {};
    const pk = tableMeta.primaryKey;
    
    for (const [colName, colMeta] of Object.entries(tableMeta.columns)) {
      fields[colName] = FieldMapper.mapToField(colName, colMeta, colName === pk);
    }
    return fields;
  }

  /**
   * Internal: Robust Named Class Factory.
   * Preserves class identity using computed property naming.
   * @private
   */
  function _createDynamicClass(name, schema, category) {
    // 1. Create the named subclass using the closure pattern
    const Cls = {
      [name]: class extends BaseModel {
        constructor(data, context) {
          super(data, context);
        }
      }
    }[name];

    // 2. Attach static metadata using descriptors
    Object.defineProperties(Cls, {
      tableName: { value: name, writable: false, enumerable: true },
      category: { value: category, writable: false, enumerable: true },
      schema: { value: schema, writable: false, enumerable: true }
    });

    // 3. Export to globalThis for library-wide availability
    globalThis[name] = Cls;

    return Cls;
  }

  return {
    initialize: initialize,
    getModel: getModel
  };

})();

globalThis.ModelRegistry = ModelRegistry;
