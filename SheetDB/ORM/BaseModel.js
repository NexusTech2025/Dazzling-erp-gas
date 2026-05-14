/**
 * @file BaseModel.js
 * Layer: ORM - Data Identity Layer
 * 
 * Responsibility:
 * - Serves as the universal parent for all dynamically generated Models.
 * - Handles data hydration (from Sheet values to JS types).
 * - Orchestrates data validation using Field classes.
 * - Handles serialization for database writes.
 */

class BaseModel {
  /**
   * Universal constructor for all Models.
   * @param {Object} data - Raw data (e.g., from TableGateway or API payload).
   * @param {Object} [context] - Optional framework context (gateway, resolver, etc).
   */
  constructor(data = {}, context = {}) {
    // Determine if this is a new record or fetched from DB
    this._isNew = context.isNew !== undefined ? context.isNew : true;

    // 1. Identify the schema (statically attached by ModelRegistry)
    const schema = this.constructor.schema;
    if (!schema) {
      // If no schema is defined, perform simple assignment
      Object.assign(this, data);
      return;
    }

    // 2. Hydrate properties using the Field system
    Object.keys(schema).forEach(fieldName => {
      const field = schema[fieldName];
      const rawValue = data[fieldName];
      
      // Transform raw sheet value to JS type (or use default)
      this[fieldName] = field.fromSheetValue(rawValue);
    });

    // 3. Preserve Metadata (properties starting with __)
    Object.keys(data).forEach(key => {
      if (key.startsWith("__") && this[key] === undefined) {
        this[key] = data[key];
      }
    });

    // 4. Inject Framework Context
    this._gateway = context.gateway;
    this._registry = context.registry;
    this._resolver = context.resolver;
    
    // Static metadata from ModelRegistry
    this._entityName = this.constructor.tableName;
    this._primaryKey = this._registry ? this._registry.getPrimaryKey(this._entityName) : "id";

    // 5. Dynamic Relation Injection
    if (this._resolver) {
      this._injectRelations();
    }
  }

  /**
   * Automatically attaches methods to the object based on schema relations.
   * @private
   */
  _injectRelations() {
    const registry = this._resolver.registry;
    const relations = registry.getRelations(this._entityName);
    
    Object.keys(relations).forEach(relationName => {
      // Don't overwrite data properties (unless they are null/empty)
      if (this[relationName] !== undefined && this[relationName] !== null && this[relationName] !== "") return;

      // Define the method on the instance
      this[relationName] = () => {
        return this._resolver.resolve(this, relationName);
      };
    });
  }

  /**
   * Returns the logical name of this entity (e.g., "Student").
   */
  getEntityType() {
    return this._entityName;
  }

  /**
   * Merges partial data into the instance, applying type casting via Fields.
   * @param {Object} data - Partial updates.
   * @returns {BaseModel} This instance for chaining.
   */
  merge(data = {}) {
    const schema = this.constructor.schema;
    if (!schema) {
      Object.assign(this, data);
      return this;
    }

    Object.keys(data).forEach(key => {
      if (schema[key]) {
        // Cast the value using the field's logic
        this[key] = schema[key].fromSheetValue(data[key]);
      } else if (!key.startsWith('_')) {
        // Direct assignment for non-internal properties not in schema
        this[key] = data[key];
      }
    });

    return this;
  }

  /**
   * PERSISTENCE: Active Record Save.
   * Validates, serializes, and routes to the TableGateway.
   */
  save() {
    if (!this._gateway) {
      console.error(`[BaseModel] Save failed for ${this.constructor.name}: No TableGateway attached.`);
      throw new Error(`Save failed: No TableGateway attached to model '${this.constructor.name}'.`);
    }

    try {
      this.validate(); // Tier 1, 2, 4 Validation
      const rowData = this.toDatabaseRow(); // Includes Auto-ID and Timestamp generation

      // Route execution based strictly on hydration state, NOT the presence of an ID.
      if (this._isNew) {
        return this._performInsert(rowData);
      } else {
        return this._performUpdate(rowData);
      }
    } catch (e) {
      console.error(`[BaseModel] Error during save() for ${this.constructor.name}: ${e.message}`, e);
      throw e;
    }
  }

  /**
   * Internal helper to execute insertion of a new record.
   * @private
   */
  _performInsert(rowData) {
    console.log(`[BaseModel] Attempting insert for new ${this.constructor.name}...`);
    try {
      const rawSaved = this._gateway.insert(rowData);
      Object.assign(this, rawSaved); // Populate generated ID and created_at
      
      // State Transition: Once safely in the DB, it is no longer new.
      this._isNew = false; 
      
      console.log(`[BaseModel] Successfully inserted new ${this.constructor.name} (ID: ${this[this._primaryKey]}).`);
      return this;
    } catch (e) {
      console.error(`[BaseModel] Insert failed for ${this.constructor.name}: ${e.message}`, e);
      throw new Error(`Failed to insert ${this.constructor.name}: ${e.message}`);
    }
  }

  /**
   * Internal helper to execute update of an existing record.
   * @private
   */
  _performUpdate(rowData) {
    const id = this[this._primaryKey];
    if (!id) {
      const errorMsg = `Fatal: Attempting to update a record missing its Primary Key '${this._primaryKey}'.`;
      console.error(`[BaseModel] ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    console.log(`[BaseModel] Attempting update for ${this.constructor.name} (ID: ${id})...`);
    try {
      const rawUpdated = this._gateway.update(id, rowData);
      Object.assign(this, rawUpdated); // Refresh with any sheet-level changes
      
      console.log(`[BaseModel] Successfully updated ${this.constructor.name} (ID: ${id}).`);
      return this;
    } catch (e) {
      console.error(`[BaseModel] Update failed for ${this.constructor.name} (ID: ${id}): ${e.message}`, e);
      throw new Error(`Failed to update ${this.constructor.name} (ID: ${id}): ${e.message}`);
    }
  }

  /**
   * PERSISTENCE: Physically deletes this record from the spreadsheet.
   */
  delete() {
    if (!this._gateway) throw new Error("Delete failed: No TableGateway attached.");
    const id = this[this._primaryKey];
    if (!id) throw new Error(`Delete failed: Primary key '${this._primaryKey}' is missing.`);

    return this._gateway.remove(id);
  }

  /**
   * Validates all fields against their schema rules.
   * @throws {ValidationError} Aggregated list of field failures.
   */
  validate() {
    const schema = this.constructor.schema;
    if (!schema) return true;

    const errors = [];
    Object.keys(schema).forEach(fieldName => {
      try {
        schema[fieldName].validate(this[fieldName]);
      } catch (e) {
        if (e instanceof FieldError) {
          errors.push(e);
        } else {
          throw e;
        }
      }
    });

    if (errors.length > 0) {
      const messages = errors.map(err => err.message).join("; ");
      throw new ValidationError(`Validation failed for ${this.constructor.name}: ${messages}`, { errors });
    }

    return true;
  }

  /**
   * Prepares the data for a database write.
   * Runs serialization logic (e.g. stringifying JSON, formatting dates).
   * @returns {Object} Flat object safe for Sheet insertion.
   */
  toDatabaseRow() {
    const schema = this.constructor.schema;
    const row = {};

    if (!schema) {
      // Fallback: strip internal properties
      Object.keys(this).forEach(key => {
        if (!key.startsWith('_') && typeof this[key] !== 'function') {
          row[key] = this[key];
        }
      });
      return row;
    }

    Object.keys(schema).forEach(fieldName => {
      const field = schema[fieldName];
      // Transform JS type to Sheet-safe value (triggers auto-gen for IDs/Timestamps)
      row[fieldName] = field.toSheetValue(this[fieldName]);
    });

    return row;
  }

  /**
   * Simplified JSON serialization for API responses.
   * Standardizes dates and removes circular references.
   */
  toJSON() {
    const schema = this.constructor.schema;
    const json = {};

    // 1. Map fields defined in schema
    if (schema) {
      Object.keys(schema).forEach(key => {
        let val = this[key];
        // Ensure dates are ISO in JSON
        if (val instanceof Date) val = val.toISOString();
        json[key] = val;
      });
    }

    // 2. Add eager-loaded relations (properties not starting with _)
    Object.keys(this).forEach(key => {
      if (!key.startsWith('_') && typeof this[key] !== 'function' && json[key] === undefined) {
        json[key] = this[key];
      }
    });

    return json;
  }
}

// Export to global scope
globalThis.BaseModel = BaseModel;
