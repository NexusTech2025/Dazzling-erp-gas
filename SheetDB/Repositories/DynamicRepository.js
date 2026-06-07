/**
 * @file DynamicRepository.js
 * Layer: Repository Layer (Generic)
 * 
 * Responsibility:
 * - Act as a schema-driven manager for a specific entity.
 * - Map raw data from TableGateway into smart BaseModel instances (Hydration).
 * - Provide a consistent, high-level CRUD interface.
 */

const DELETE_STRATEGIES = {
  protect: (targetRepo, dep, id, entityName) => {
    const count = targetRepo.count({ [dep.fk]: id });
    if (count > 0) {
      throw new IntegrityError(`Delete Protected: Cannot delete from '${entityName}' because active records in '${dep.table}' refer to it (FK: '${dep.fk}').`);
    }
  },
  cascade: (targetRepo, dep, id) => {
    const childRecords = targetRepo.where({ [dep.fk]: id });
    if (childRecords.length > 0) {
      const childIds = childRecords.map(r => r[targetRepo.gateway.primaryKey]);
      targetRepo.deleteMany(childIds);
    }
  },
  set_null: (targetRepo, dep, id) => {
    const childRecords = targetRepo.where({ [dep.fk]: id });
    if (childRecords.length > 0) {
      const updates = {};
      childRecords.forEach(r => {
        const childId = r[targetRepo.gateway.primaryKey];
        updates[childId] = { [dep.fk]: null };
      });
      targetRepo.updateMany(updates);
    }
  }
};

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
    const ModelClass = ModelRegistry.getModel(this.entityName);
    
    // Restore full framework context for Active Record support
    return new ModelClass(rawData, { 
      gateway: this.gateway,
      registry: this.registry,
      resolver: this.resolver,
      isNew: false // Mark as existing database record
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
   * @param {Object|BaseModel} dataPayload - Data or Model instance.
   * @returns {BaseModel} The newly created and hydrated object.
   */
  insert(dataPayload) {
    const ModelClass = ModelRegistry.getModel(this.entityName);
    
    // If it's already a model instance, just save it
    if (dataPayload instanceof BaseModel) {
      return dataPayload.save();
    }

    // Otherwise, create a new instance with full context and save
    const instance = new ModelClass(dataPayload, { 
      gateway: this.gateway, 
      registry: this.registry, 
      resolver: this.resolver 
    });

    return instance.save();
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

      // 2. Add Parent to bucket (Implicitly validates/serializes via insert path in later logic)
      // Actually, BatchBucket needs to be updated to handle Models too.
      const ModelClass = ModelRegistry.getModel(this.entityName);
      const instance = new ModelClass(mainData);
      instance.validate();
      const rowData = instance.toDatabaseRow();
      
      bucket.add(this.entityName, rowData);

      // 3. Process relations and add to child buckets
      Object.entries(nested).forEach(([relName, data]) => {
        const relDef = relations[relName];
        const dataItems = Array.isArray(data) ? data : [data];

        dataItems.forEach(item => {
          // Link Child to Parent ID
          // We use the generated PK from the parent if available, or the one about to be generated
          item[relDef.foreignKey] = rowData[pkName]; 
          
          const TargetModelClass = ModelRegistry.getModel(relDef.target);
          const targetInstance = new TargetModelClass(item);
          targetInstance.validate();
          bucket.add(relDef.target, targetInstance.toDatabaseRow());
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
   * Updates an existing record by its primary key.
   * @param {any} id - The primary key value.
   * @param {Object|BaseModel} updates - Key-value map or Model instance.
   * @returns {BaseModel}
   */
  update(id, updates) {
    // 1. Fetch the existing full record to ensure all required fields are present for validation
    const existing = this.findById(id);
    if (!existing) {
      throw new EntityNotFoundError(this.entityName, id);
    }

    // 2. Extract raw data if a Model was passed
    const cleanUpdates = (updates instanceof BaseModel) ? updates.toJSON() : updates;

    // 3. Merge changes and save (which triggers full validation)
    return existing.merge(cleanUpdates).save();
  }

  /**
   * Enforces relational database constraints (protect, cascade, set_null) on deletion.
   * Uses a strategy registry mapping to resolve constraint actions.
   * @param {any} id - The primary key value of the record being deleted.
   */
  enforceDeleteConstraints(id) {
    let graph = null;
    if (this.resolver && this.resolver.db && this.resolver.db._config && this.resolver.db._config.dependencyGraph) {
      graph = this.resolver.db._config.dependencyGraph;
      console.log("[DynamicRepository] Using configured dependency graph for deletion constraints.");
    } else if (typeof DEPENDENCY_GRAPH !== 'undefined') {
      graph = DEPENDENCY_GRAPH;
    }

    if (!graph) {
      throw new DependencyGraphError("Dependency graph is not defined. DependencyGraph is required for constraint enforcement.");
    }

    const dependents = graph[this.entityName] || [];
    for (const dep of dependents) {
      const targetRepo = this.resolver.db[dep.table];
      if (!targetRepo) continue;

      const policy = dep.onDelete || 'protect';
      const strategy = DELETE_STRATEGIES[policy];
      if (strategy) {
        strategy(targetRepo, dep, id, this.entityName);
      } else {
        DELETE_STRATEGIES.protect(targetRepo, dep, id, this.entityName);
      }
    }
  }

  /**
   * Deletes a record by its primary key.
   * @param {any} id
   * @returns {boolean} Success status.
   */
  remove(id) {
    this.enforceDeleteConstraints(id);
    return this.gateway.remove(id);
  }

  /**
   * Deletes multiple records by their primary keys.
   * @param {Array<any>} ids - Array of primary key values to delete.
   * @returns {number} Count of successfully deleted records.
   */
  deleteMany(ids) {
    if (ids && Array.isArray(ids)) {
      ids.forEach(id => this.enforceDeleteConstraints(id));
    }
    return this.gateway.deleteMany(ids);
  }

  /**
   * Batch update multiple records and return hydrated models.
   * @param {Object} updatesMap - Map of { id: { column: value } }
   * @returns {Array<BaseModel>} Array of updated and hydrated Model instances.
   */
  updateMany(updatesMap) {
    const rawRows = this.gateway.updateMany(updatesMap);
    return rawRows.map(row => this._hydrate(row));
  }
}
