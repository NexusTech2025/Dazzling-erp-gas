/**
 * @file BaseModel.js
 * Layer: ORM (Object-Relational Mapping)
 * 
 * Responsibility:
 * - Wrap a single data record in a "Smart Object".
 * - Provide "Active Record" capabilities (self-saving, self-deletion).
 * - Maintain entity identity (Student, Course, etc.) for dynamic routing.
 * - Act as the host for dynamic relation methods.
 */

class BaseModel {
  /**
   * @param {Object} data - The raw key-value data from the TableGateway.
   * @param {Object} context - Internal framework metadata.
   * @param {string} context.entityName - The name of the table (e.g. "Student").
   * @param {Object} context.gateway - Reference to the corresponding TableGateway.
   * @param {Object} context.registry - Reference to the SchemaRegistry.
   * @param {Object} context.resolver - Reference to the RelationResolver.
   */
  constructor(data, context) {
    if (!context || !context.entityName || !context.gateway || !context.registry) {
      throw new Error("BaseModel construction failed: Missing internal context.");
    }

    // Hidden framework properties
    this._entityName = context.entityName;
    this._gateway = context.gateway;
    this._registry = context.registry;
    this._resolver = context.resolver; // Used for relation resolution
    this._primaryKey = this._registry.getPrimaryKey(this._entityName);

    // Hydration: Map data fields directly to properties
    Object.assign(this, data);

    // Dynamic Relation Injection
    if (this._resolver) {
      this._injectRelations();
    }
  }

  /**
   * Automatically attaches methods to the object based on schema relations.
   * Example: If schema has relation 'enrollments', this creates this.enrollments()
   * @private
   */
  _injectRelations() {
    const relations = this._registry.getRelations(this._entityName);
    Object.keys(relations).forEach(relationName => {
      // Don't overwrite existing data properties
      if (this[relationName] !== undefined) return;

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
   * PERSISTENCE: Saves the current state of this object back to the spreadsheet.
   * Uses the internal gateway to route to the correct file and sheet.
   */
  save() {
    const id = this[this._primaryKey];
    if (id === undefined || id === null) {
      throw new Error(`Save failed: Primary key '${this._primaryKey}' is missing on the object.`);
    }

    const updates = this._getCleanData();
    return this._gateway.update(id, updates);
  }

  /**
   * PERSISTENCE: Physically deletes this record from the spreadsheet.
   */
  delete() {
    const id = this[this._primaryKey];
    if (id === undefined || id === null) {
      throw new Error(`Delete failed: Primary key '${this._primaryKey}' is missing on the object.`);
    }

    return this._gateway.remove(id);
  }

  /**
   * Returns a copy of the record data without the internal framework properties.
   * Used before writing back to Google Sheets to ensure schema integrity.
   * @private
   */
  _getCleanData() {
    const clean = {};
    const columns = this._registry.getColumns(this._entityName);
    
    Object.keys(columns).forEach(colKey => {
      // Map only the fields defined in the schema
      clean[colKey] = this[colKey];
    });
    
    return clean;
  }
}

