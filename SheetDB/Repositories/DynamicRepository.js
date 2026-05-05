/**
 * @file DynamicRepository.js
 * Layer: Repository Layer (Generic)
 * 
 * Responsibility:
 * - Act as a schema-driven manager for a specific entity.
 * - Map raw data from TableGateway into smart BaseModel instances (Hydration).
 * - Provide a consistent, high-level CRUD interface.
 */

class DynamicRepository {
  /**
   * @param {string} entityName - The name of the entity/table.
   * @param {Object} gateway - Instance of TableGateway for I/O.
   * @param {Object} registry - Instance of SchemaRegistry for metadata.
   * @param {Object} resolver - Instance of RelationResolver.
   */
  constructor(entityName, gateway, registry, resolver) {
    if (!entityName || !gateway || !registry) {
      throw new Error("DynamicRepository failed: Missing dependencies.");
    }
    this.entityName = entityName;
    this.gateway = gateway;
    this.registry = registry;
    this.resolver = resolver; // Dependency for relation handling
  }

  /**
   * Internal helper to convert raw data into a BaseModel instance.
   * @private
   */
  _hydrate(rawData) {
    if (!rawData) return null;
    return new BaseModel(rawData, {
      entityName: this.entityName,
      gateway: this.gateway,
      registry: this.registry,
      resolver: this.resolver
    });
  }

  /**
   * Fetches all records from the table.
   * @returns {Array<BaseModel>}
   */
  all() {
    const rawData = this.gateway.all();
    return rawData.map(row => this._hydrate(row));
  }

  /**
   * Finds a single record by its primary key.
   * @param {any} id - The primary key value.
   * @returns {BaseModel|null}
   */
  findById(id) {
    const rawData = this.gateway.find(id);
    return this._hydrate(rawData);
  }

  /**
   * Checks if the table physically exists in the database.
   * @returns {boolean}
   */
  isTableExist() {
    return this.gateway.isTableExist();
  }

  /**
   * Checks if any record matches the filters.
   * Gracefully returns false if the table doesn't exist.
   */
  exists(filters = {}) {
    if (!this.isTableExist()) return false;
    return this.gateway.count(filters) > 0;
  }

  /**
   * Finds the first record matching the filters.
   * @param {Object} filters 
   * @returns {BaseModel|null}
   */
  findOne(filters = {}) {
    const rawData = this.gateway.findOne(filters);
    return this._hydrate(rawData);
  }

  /**
   * Counts records matching the filters.
   * @param {Object} filters 
   * @returns {number}
   */
  count(filters = {}) {
    if (!this.isTableExist()) return 0;
    return this.gateway.count(filters);
  }

  /**
   * Filters records based on simple equality.
   * @param {Object} filters - Key-value map for filtering.
   * @returns {Array<BaseModel>}
   */
  where(filters) {
    const rawData = this.gateway.where(filters);
    return rawData.map(row => this._hydrate(row));
  }

  /**
   * Inserts a new record into the database.
   * @param {Object} dataPayload - Key-value pair matching schema columns.
   * @returns {BaseModel} The newly created and hydrated object.
   */
  insert(dataPayload) {
    const rawSaved = this.gateway.insert(dataPayload);
    return this._hydrate(rawSaved);
  }

  /**
   * MongoDB Style: Inserts a record and all its nested relations.
   * Example: Student with nested 'address' object and 'enrollment' array.
   * 
   * @param {Object} payload - The full document with nested relations.
   * @returns {BaseModel} The primary hydrated model.
   */
  insertOne(payload) {
    const relations = this.registry.getRelations(this.entityName);
    const columns = this.registry.getColumns(this.entityName);

    // 1. Data Splitting: Separate core columns from nested relations
    const mainData = {};
    const nestedData = {};

    Object.keys(payload).forEach(key => {
      if (columns[key]) {
        mainData[key] = payload[key];
      } else if (relations[key]) {
        nestedData[key] = payload[key];
      }
    });

    // 2. Persist the Parent first (to generate/confirm the PK)
    const parent = this.insert(mainData);
    const parentPkName = this.registry.getPrimaryKey(this.entityName);
    const parentPkValue = parent[parentPkName];

    // 3. Process Nested Relations recursively
    Object.entries(nestedData).forEach(([relName, data]) => {
      const relDef = relations[relName];
      const targetRepo = this.resolver.db[relDef.target];

      if (!targetRepo) {
        console.warn(`[DynamicRepository] Warning: Repository for target '${relDef.target}' not found.`);
        return;
      }

      // Standardize input to an array (handles both hasOne and hasMany)
      const dataItems = Array.isArray(data) ? data : [data];

      dataItems.forEach(item => {
        // AUTOMATIC FK INJECTION: Link the child to the parent
        item[relDef.foreignKey] = parentPkValue;
        
        // Recursively insert (allows for multi-level nesting)
        targetRepo.insert(item);
      });
    });

    return parent;
  }

  /**
   * Performs an optimized, prioritized batch insert for multiple nested documents.
   * Uses BatchBucket to group writes by table and respect order.
   * 
   * @param {Array<Object>} payloadArray - Array of documents.
   */
  insertMany(payloadArray) {
    if (!payloadArray || payloadArray.length === 0) return [];

    const bucket = new BatchBucket(this.resolver.db);
    const relations = this.registry.getRelations(this.entityName);
    const columns = this.registry.getColumns(this.entityName);
    const pkName = this.registry.getPrimaryKey(this.entityName);

    // --- Phase 1: Grouping & Transformation (Memory) ---
    payloadArray.forEach(doc => {
      const mainData = {};
      const nested = {};

      // 1. Split columns from relations
      Object.keys(doc).forEach(key => {
        if (columns[key]) mainData[key] = doc[key];
        else if (relations[key]) nested[key] = doc[key];
      });

      // 2. Add Parent to bucket
      bucket.add(this.entityName, mainData);

      // 3. Process relations and add to child buckets
      Object.entries(nested).forEach(([relName, data]) => {
        const relDef = relations[relName];
        const dataItems = Array.isArray(data) ? data : [data];

        dataItems.forEach(item => {
          // Link Child to Parent ID
          item[relDef.foreignKey] = mainData[pkName];
          bucket.add(relDef.target, item);
        });
      });
    });

    // --- Phase 2: Execute (Disk I/O) ---
    // The bucket knows to write Parents before Children based on the sequence
    const results = bucket.execute();

    // --- Phase 3: Hydrate & Return ---
    // Hydrate the main entity results (Parents)
    return results[this.entityName].map(row => this._hydrate(row));
  }

  /**
   * Deletes a record by its primary key.
   * @param {any} id
   * @returns {boolean} Success status.
   */
  remove(id) {
    return this.gateway.remove(id);
  }
}
