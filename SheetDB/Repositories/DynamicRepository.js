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
    // 1. Resolve StaticGraph (lazy compile and cache on root db instance)
    const db = this.resolver.db;
    if (!db._staticGraph) {
      const StaticGraphBuilder = globalThis.Graph ? globalThis.Graph.StaticGraphBuilder : null;
      if (StaticGraphBuilder) {
        db._staticGraph = StaticGraphBuilder.compile(db._schema);
      }
    }

    if (!db._staticGraph) {
      throw new DependencyGraphError("Static schema graph is not compiled. StaticGraph is required for constraint enforcement.");
    }

    // 2. Fetch the target parent record
    const record = this.findById(id);
    if (!record) {
      throw new EntityNotFoundError(this.entityName, id);
    }

    // 3. Build Dynamic Graph from this root record
    const DynamicGraphBuilder = globalThis.Graph ? globalThis.Graph.DynamicGraphBuilder : null;
    const DeletionValidationRegistry = globalThis.Graph ? globalThis.Graph.DeletionValidationRegistry : null;

    if (!DynamicGraphBuilder || !DeletionValidationRegistry) {
      throw new DependencyGraphError("Graph validation components are missing. DynamicGraphBuilder and DeletionValidationRegistry are required.");
    }

    const queryDelegate = (table, fk, parentId) => {
      const targetRepo = db[table];
      return targetRepo ? targetRepo.where({ [fk]: parentId }) : [];
    };

    const builder = new DynamicGraphBuilder(db._staticGraph, queryDelegate);
    const dynamicGraph = builder.build(this.entityName, id, record);

    // 4. Dry-Run Validation Phase
    DeletionValidationRegistry.validate(dynamicGraph, this.entityName, id);

    // 5. Execution Phase (Cascade Deletions & Set-Null Updates)
    // Identify which nodes are slated for deletion (BFS cascade path)
    const deleteNodes = [];
    const deleteNodeKeys = new Set();
    const queue = [dynamicGraph.getNode(this.entityName, id)];
    const visited = new Set([`${this.entityName}:${id}`]);

    while (queue.length > 0) {
      const current = queue.shift();
      deleteNodes.push(current);
      deleteNodeKeys.add(`${current.entityName}:${current.id}`);

      for (const edge of current.outgoing) {
        if (edge.onDelete === 'cascade') {
          const childKey = `${edge.toNode.entityName}:${edge.toNode.id}`;
          if (!visited.has(childKey)) {
            visited.add(childKey);
            queue.push(edge.toNode);
          }
        }
      }
    }

    // 5a. Execute set_null updates first for affected child edges
    for (const edge of dynamicGraph.edges) {
      const parentKey = `${edge.fromNode.entityName}:${edge.fromNode.id}`;
      if (deleteNodeKeys.has(parentKey) && edge.onDelete === 'set_null') {
        const targetRepo = db[edge.toNode.entityName];
        if (targetRepo) {
          const updates = {};
          const ModelClass = typeof ModelRegistry !== 'undefined' ? ModelRegistry.getModel(targetRepo.entityName) : null;
          const schema = ModelClass ? ModelClass.schema : null;
          const fkField = schema ? schema[edge.foreignKey] : null;
          const typeField = fkField ? fkField.typeField : null;

          edge.toNode.ids.forEach(childId => {
            const updatePayload = { [edge.foreignKey]: null };
            if (typeField) {
              updatePayload[typeField] = null;
            }
            updates[childId] = updatePayload;
          });
          targetRepo.updateMany(updates);
        }
      }
    }

    // 5b. Execute cascading deletes in reverse topological order (bottom-up)
    deleteNodes.reverse().forEach(node => {
      // Skip the root parent node (the caller remove() will delete it physically in the spreadsheet gateway)
      if (node.entityName === this.entityName && node.ids.includes(id)) {
        return;
      }
      const targetRepo = db[node.entityName];
      if (targetRepo) {
        targetRepo.gateway.deleteMany(node.ids);
      }
    });
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
   * Enforces batch relational database constraints (protect, cascade, set_null) on deletion.
   * Implements the memory-optimized Surgical Graph Rollback strategy.
   * 
   * @param {Array<any>} ids - Array of parent record primary keys to delete.
   * @param {Object} [options] - Configuration options.
   * @param {boolean} [options.dryRun=true] - If true, only validate without mutating.
   * @param {boolean} [options.failFast=false] - If true, halt on first validation error.
   * @returns {Object} Manifest detailing deleted, skipped, and failed IDs.
   */
  enforceDeleteConstraintsBatch(ids, options = {}) {
    const dryRun = options.dryRun !== false; // default to true
    const failFast = !!options.failFast;

    const manifest = {
      success: true,
      dryRun: dryRun,
      deleted: [],
      skipped: [],
      failed: {}
    };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return manifest;
    }

    const db = this.resolver.db;
    const pkName = this.registry.getPrimaryKey(this.entityName);

    // --- STAGE 1: Deduplication & Pre-existence Check (Soft Filtering) ---
    const uniqueIds = [...new Set(ids.map(id => String(id).trim()))];
    
    // Resolve all active parent keys in O(1) from PrimaryKeyCache
    const activeParentKeys = db._pkCache.get(this.entityName);
    
    const validIds = [];
    const validRecords = [];

    uniqueIds.forEach(id => {
      if (activeParentKeys.has(id)) {
        validIds.push(id);
        const record = this.findById(id);
        if (record) {
          validRecords.push(record);
        }
      } else {
        manifest.skipped.push(id);
      }
    });

    if (validIds.length === 0) {
      return manifest;
    }

    // Ensure static schema graph is compiled
    if (!db._staticGraph) {
      const StaticGraphBuilder = globalThis.Graph ? globalThis.Graph.StaticGraphBuilder : null;
      if (StaticGraphBuilder) {
        db._staticGraph = StaticGraphBuilder.compile(db._schema);
      }
    }
    if (!db._staticGraph) {
      throw new Error("Static schema graph is not compiled. StaticGraph is required for batch constraint enforcement.");
    }

    // --- STAGE 2: Table Pre-loading & Graph Building ---
    // Discover the scope of descendant tables in the cascade tree
    const targetTables = new Set();
    const discoverDescendants = (tableName) => {
      const staticNode = db._staticGraph.getNode(tableName);
      if (staticNode) {
        staticNode.outgoing.forEach(edge => {
          const targetTable = edge.toNode.entityName;
          if (!targetTables.has(targetTable)) {
            targetTables.add(targetTable);
            discoverDescendants(targetTable); // Recursively trace
          }
        });
      }
    };
    discoverDescendants(this.entityName);

    // Single-Pass pre-loading from Drive (Disk -> RAM)
    const loadedTables = {};
    loadedTables[this.entityName] = JSON.parse(JSON.stringify(this.gateway.all())); // cache root parent raw rows
    targetTables.forEach(tableName => {
      const targetRepo = db[tableName];
      if (targetRepo) {
        loadedTables[tableName] = JSON.parse(JSON.stringify(targetRepo.gateway.all()));
      }
    });

    // Custom in-memory query delegate referencing pre-loaded tables
    const inMemoryQueryDelegate = (table, fk, parentId) => {
      const allRows = loadedTables[table] || [];
      const parentIdStr = String(parentId).trim();
      const filtered = allRows.filter(row => String(row[fk]).trim() === parentIdStr);
      
      const ModelClass = typeof ModelRegistry !== 'undefined' ? ModelRegistry.getModel(table) : null;
      if (!ModelClass) return [];
      
      const targetRepo = db[table];
      return filtered.map(row => new ModelClass(row, {
        gateway: targetRepo.gateway,
        registry: targetRepo.registry,
        resolver: targetRepo.resolver,
        isNew: false
      }));
    };

    // Hydrate separate dynamic graphs for each parent ID
    const DynamicGraphBuilder = globalThis.Graph ? globalThis.Graph.DynamicGraphBuilder : null;
    if (!DynamicGraphBuilder) {
      throw new Error("DynamicGraphBuilder is missing. Graph validation components are required.");
    }

    const graphs = {};
    validIds.forEach((id, idx) => {
      const record = validRecords[idx];
      const builder = new DynamicGraphBuilder(db._staticGraph, inMemoryQueryDelegate);
      graphs[id] = builder.build(this.entityName, id, record);
    });

    // --- STAGE 3: Pre-flight Validation ---
    // 3a. Global Deletion Key Aggregation (Pre-scan)
    const globalDeleteNodeKeys = new Set();
    validIds.forEach(id => {
      const graph = graphs[id];
      const rootKey = `${this.entityName}:${id}`;
      globalDeleteNodeKeys.add(rootKey);
      
      const rootNode = graph.getNode(this.entityName, id);
      if (!rootNode) return;

      const queue = [rootNode];
      const visited = new Set([rootKey]);
      while (queue.length > 0) {
        const current = queue.shift();
        for (const edge of current.outgoing) {
          if (edge.onDelete === 'cascade') {
            const childKey = `${edge.toNode.entityName}:${edge.toNode.id}`;
            if (!visited.has(childKey)) {
              visited.add(childKey);
              globalDeleteNodeKeys.add(childKey);
              queue.push(edge.toNode);
            }
          }
        }
      }
    });

    // 3b. Loop and Validate each graph in RAM
    const DeletionValidationRegistry = globalThis.Graph ? globalThis.Graph.DeletionValidationRegistry : null;
    if (!DeletionValidationRegistry) {
      throw new Error("DeletionValidationRegistry is missing.");
    }

    const errors = {};
    validIds.forEach(id => {
      const graph = graphs[id];
      try {
        DeletionValidationRegistry.validate(graph, this.entityName, id, globalDeleteNodeKeys);
        manifest.deleted.push(id);
      } catch (err) {
        errors[id] = err.message;
        manifest.failed[id] = err.message;
      }
    });

    // If dryRun, return manifest without making changes
    if (dryRun) {
      manifest.success = Object.keys(manifest.failed).length === 0;
      return manifest;
    }

    // If execution mode (dryRun = false) and any error exists:
    if (Object.keys(manifest.failed).length > 0) {
      manifest.success = false;
      if (failFast) {
        const firstId = Object.keys(manifest.failed)[0];
        throw new ValidationError(`Batch Delete Failed (Fail-Fast): ID '${firstId}' failed: ${manifest.failed[firstId]}`);
      } else {
        throw new ValidationError(`Batch Delete Failed (Aggregated): ${JSON.stringify(manifest.failed)}`);
      }
    }

    // --- MUTATION EXECUTION BLOCK ---
    const touchedTables = new Set();
    const deleteIdsByTable = {};
    try {
      // --- STAGE 4: Aggregating & Executing set_null Updates in Bulk ---
      const updatesByTable = {};
      validIds.forEach(id => {
        const graph = graphs[id];
        for (const edge of graph.edges) {
          const parentKey = `${edge.fromNode.entityName}:${edge.fromNode.id}`;
          if (globalDeleteNodeKeys.has(parentKey) && edge.onDelete === 'set_null') {
            const targetTable = edge.toNode.entityName;
            if (!updatesByTable[targetTable]) {
              updatesByTable[targetTable] = {};
            }
            touchedTables.add(targetTable);

            const targetRepo = db[targetTable];
            const ModelClass = typeof ModelRegistry !== 'undefined' ? ModelRegistry.getModel(targetTable) : null;
            const schema = ModelClass ? ModelClass.schema : null;
            const fkField = schema ? schema[edge.foreignKey] : null;
            const typeField = fkField ? fkField.typeField : null;

            edge.toNode.ids.forEach(childId => {
              if (!updatesByTable[targetTable][childId]) {
                updatesByTable[targetTable][childId] = {};
              }
              updatesByTable[targetTable][childId][edge.foreignKey] = null;
              if (typeField) {
                updatesByTable[targetTable][childId][typeField] = null;
              }
            });
          }
        }
      });

      // Execute bulk updates per table
      Object.entries(updatesByTable).forEach(([tableName, updatesMap]) => {
        const targetRepo = db[tableName];
        if (targetRepo && Object.keys(updatesMap).length > 0) {
          targetRepo.updateMany(updatesMap);
        }
      });

      // --- STAGE 5: Aggregating & Executing Cascading Deletions in Bulk (Bottom-Up) ---
      validIds.forEach(id => {
        const graph = graphs[id];
        const rootKey = `${this.entityName}:${id}`;
        
        const rootNode = graph.getNode(this.entityName, id);
        if (!rootNode) return;

        const queue = [rootNode];
        const visited = new Set([rootKey]);
        while (queue.length > 0) {
          const current = queue.shift();
          
          if (current.entityName !== this.entityName || !current.ids.includes(id)) {
            const tbl = current.entityName;
            if (!deleteIdsByTable[tbl]) {
              deleteIdsByTable[tbl] = new Set();
            }
            touchedTables.add(tbl);
            current.ids.forEach(cid => deleteIdsByTable[tbl].add(cid));
          }

          for (const edge of current.outgoing) {
            if (edge.onDelete === 'cascade') {
              const childKey = `${edge.toNode.entityName}:${edge.toNode.id}`;
              if (!visited.has(childKey)) {
                visited.add(childKey);
                queue.push(edge.toNode);
              }
            }
          }
        }
      });

      // Sort tables in reverse topological order (leaves first)
      const sortedTables = [];
      const visitedSort = new Set();
      const sortHelper = (tableName) => {
        if (visitedSort.has(tableName)) return;
        visitedSort.add(tableName);
        
        const staticNode = db._staticGraph.getNode(tableName);
        if (staticNode) {
          staticNode.outgoing.forEach(edge => {
            sortHelper(edge.toNode.entityName);
          });
        }
        if (deleteIdsByTable[tableName]) {
          sortedTables.push(tableName);
        }
      };
      const staticRoot = db._staticGraph.getNode(this.entityName);
      if (staticRoot) {
        staticRoot.outgoing.forEach(edge => {
          sortHelper(edge.toNode.entityName);
        });
      }

      // Execute bulk deletes bottom-up
      sortedTables.forEach(tableName => {
        const targetRepo = db[tableName];
        const idsToDelete = [...deleteIdsByTable[tableName]];
        if (targetRepo && idsToDelete.length > 0) {
          targetRepo.gateway.deleteMany(idsToDelete);
        }
      });

    } catch (error) {
      // --- STAGE 6: Transactional Recovery & Rollback (Surgical Graph Rollback) ---
      console.error("[Transaction] Error during batch delete execution. Initiating surgical rollback...", error);
      
      try {
        // Restoring deleted rows topologically (parents first, then children)
        const sortedRecoveryTables = [];
        const visitedRecSort = new Set();
        const sortRecHelper = (tableName) => {
          if (visitedRecSort.has(tableName)) return;
          visitedRecSort.add(tableName);
          if (deleteIdsByTable[tableName]) {
            sortedRecoveryTables.push(tableName);
          }
          const staticNode = db._staticGraph.getNode(tableName);
          if (staticNode) {
            staticNode.outgoing.forEach(edge => {
              sortRecHelper(edge.toNode.entityName);
            });
          }
        };
        sortRecHelper(this.entityName);

        sortedRecoveryTables.forEach(tableName => {
          const targetRepo = db[tableName];
          if (targetRepo && deleteIdsByTable[tableName]) {
            const idsToRestore = [...deleteIdsByTable[tableName]];
            const childPkName = targetRepo.gateway.primaryKey;
            const originalRows = loadedTables[tableName].filter(row => idsToRestore.includes(String(row[childPkName])));
            if (originalRows.length > 0) {
              const physicalRows2D = originalRows.map(row => targetRepo.gateway._mapObjectToRow(row));
              targetRepo.gateway.dataSource.insertRows(targetRepo.gateway.category, tableName, physicalRows2D);
              db._pkCache.invalidate(tableName);
            }
          }
        });

        // Restoring nullified columns in bulk
        const restoredUpdatesByTable = {};
        validIds.forEach(id => {
          const graph = graphs[id];
          
          for (const edge of graph.edges) {
            const parentKey = `${edge.fromNode.entityName}:${edge.fromNode.id}`;
            if (globalDeleteNodeKeys.has(parentKey) && edge.onDelete === 'set_null') {
              const targetTable = edge.toNode.entityName;
              if (!restoredUpdatesByTable[targetTable]) {
                restoredUpdatesByTable[targetTable] = {};
              }

              const targetRepo = db[targetTable];
              const ModelClass = typeof ModelRegistry !== 'undefined' ? ModelRegistry.getModel(targetTable) : null;
              const schema = ModelClass ? ModelClass.schema : null;
              const fkField = schema ? schema[edge.foreignKey] : null;
              const typeField = fkField ? fkField.typeField : null;

              edge.toNode.ids.forEach(childId => {
                const originalRow = (loadedTables[targetTable] || []).find(r => String(r[targetRepo.gateway.primaryKey]) === String(childId));
                if (originalRow) {
                  if (!restoredUpdatesByTable[targetTable][childId]) {
                    restoredUpdatesByTable[targetTable][childId] = {};
                  }
                  restoredUpdatesByTable[targetTable][childId][edge.foreignKey] = originalRow[edge.foreignKey];
                  if (typeField) {
                    restoredUpdatesByTable[targetTable][childId][typeField] = originalRow[typeField];
                  }
                }
              });
            }
          }
        });

        Object.entries(restoredUpdatesByTable).forEach(([tableName, updatesMap]) => {
          const targetRepo = db[tableName];
          if (targetRepo && Object.keys(updatesMap).length > 0) {
            targetRepo.updateMany(updatesMap);
          }
        });

      } catch (rollbackError) {
        console.error("FATAL: Rollback recovery failed. Database is in a partially mutated state.", rollbackError);
      }
      
      throw error;
    }

    return manifest;
  }

  /**
   * Deletes multiple records by their primary keys.
   * @param {Array<any>} ids - Array of primary key values to delete.
   * @param {Object} [options] - Optional configurations.
   * @returns {number} Count of successfully deleted records.
   */
  deleteMany(ids, options = {}) {
    if (!ids || !Array.isArray(ids) || ids.length === 0) return 0;
    
    // Call batch constraints checker with dryRun: false
    const batchOptions = { ...options, dryRun: false };
    const manifest = this.enforceDeleteConstraintsBatch(ids, batchOptions);
    
    // Execute parent physical deletions (only for validated deleted IDs)
    const idsToDelete = manifest.deleted;
    if (idsToDelete.length > 0) {
      this.gateway.deleteMany(idsToDelete);
    }
    return idsToDelete.length;
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

globalThis.DynamicRepository = DynamicRepository;
