/**
 * @file AtomicPipeline.js
 * Declarative, fluent transaction pipeline for structural database operations.
 * Bypasses redundant boilerplate and ensures atomic, all-or-nothing mutations.
 */

/**
 * Internal wrapper that intercepts repository mutation calls to automatically
 * log rollback operations without consumer intervention.
 */
class TrackingRepository {
  /**
   * @param {Object} rawRepository - The active DynamicRepository instance.
   * @param {TransactionTracker} transactionTracker - Active pipeline transaction tracker.
   */
  constructor(rawRepository, transactionTracker) {
    this.repo = rawRepository;
    this.tx = transactionTracker;
    this.entityName = rawRepository.entityName;
    this.registry = rawRepository.registry;
  }

  /**
   * Intercepts single insert to log delete rollback.
   * @param {Object} payload - The record payload to insert.
   * @returns {Object} The inserted record instance.
   */
  insert(payload) {
    const record = this.repo.insert(payload);
    const pkName = this.repo.registry.getPrimaryKey(this.repo.entityName) || `${this.repo.entityName.toLowerCase()}_id`;
    this.tx.trackInsert(this.repo, record[pkName]);
    return record;
  }

  /**
   * Intercepts bulk inserts to log bulk delete rollback.
   * @param {Array<Object>} payloads - The records to insert.
   * @returns {Array<Object>} The inserted record instances.
   */
  insertMany(payloads) {
    const records = this.repo.insertMany(payloads);
    const pkName = this.repo.registry.getPrimaryKey(this.repo.entityName) || `${this.repo.entityName.toLowerCase()}_id`;
    const ids = records.map(r => r[pkName]);
    this.tx.trackInsertMany(this.repo, ids);
    return records;
  }

  /**
   * Intercepts updates to log backup-state restore rollback.
   * @param {string|number} id - Target primary key value.
   * @param {Object} payload - The fields to update.
   * @returns {Object} The updated record instance.
   */
  update(id, payload) {
    const original = this.repo.findById(id);
    const originalRow = original ? original.toDatabaseRow() : null;
    const updated = this.repo.update(id, payload);
    if (originalRow) {
      this.tx.trackUpdate(this.repo, id, originalRow);
    }
    return updated;
  }

  /**
   * Intercepts batch updates to log rollback snapshots for each record.
   * @param {Object} updatesMap - Map of { id: { column: value } }
   * @returns {Array<Object>} Updated and hydrated record instances.
   */
  updateMany(updatesMap) {
    const ids = Object.keys(updatesMap);
    const backups = [];
    ids.forEach(id => {
      const original = this.repo.findById(id);
      const originalRow = original ? original.toDatabaseRow() : null;
      if (originalRow) {
        backups.push({ id, originalRow });
      }
    });

    const result = this.repo.updateMany(updatesMap);
    backups.forEach(({ id, originalRow }) => {
      this.tx.trackUpdate(this.repo, id, originalRow);
    });
    return result;
  }

  /**
   * Intercepts deletes to log insert rollback with backup model.
   * @param {string|number} id - Target primary key value.
   * @returns {boolean} True on success.
   */
  remove(id) {
    const backupModel = this.repo.findById(id);
    const result = this.repo.remove(id);
    if (backupModel) {
      this.tx.trackDelete(this.repo, backupModel);
    }
    return result;
  }

  /**
   * Intercepts batch deletions to log inserts rollbacks for each backup model.
   * @param {Array<any>} ids - Target primary keys.
   * @param {Object} [options] - Deletion constraints options.
   * @returns {number} Count of successfully deleted records.
   */
  deleteMany(ids, options = {}) {
    const backups = ids.map(id => this.repo.findById(id)).filter(Boolean);
    const result = this.repo.deleteMany(ids, options);
    backups.forEach(backupModel => {
      this.tx.trackDelete(this.repo, backupModel);
    });
    return result;
  }

  findById(id) { return this.repo.findById(id); }
  where(filters) { return this.repo.where(filters); }
  all() { return this.repo.all(); }
}

class AtomicPipeline {
  /**
   * Initializes a new transaction pipeline.
   * @param {Object} dbContext - Singleton database context instance (DBContext).
   * @param {Object} mutationContext - Predefined context interface contract.
   * @throws {ValidationError} If the context does not satisfy PipelineContext contract.
   */
  constructor(dbContext, mutationContext) {
    this.db = dbContext;
    
    // Enforce dedicated context contract (duck-typed method presence check)
    if (!mutationContext || typeof mutationContext.trackMutation !== "function") {
      throw new ValidationError(
        "AtomicPipeline Initialization Failed: The provided context does not satisfy " +
        "the required PipelineContext interface contract."
      );
    }
    
    this.context = mutationContext;
    this.tx = new TransactionTracker();
    this.state = {};
    // Seed the chain with a resolved SyncPromise (internal library reference)
    this.promise = SyncPromise.resolve(this.state);
  }

  /**
   * Static initiator factory to begin a transaction block.
   * @param {Object} db - Database facade instance.
   * @param {Object} context - Execution context payload.
   * @returns {AtomicPipeline}
   */
  static begin(db, context) {
    return new AtomicPipeline(db, context);
  }

  /**
   * Appends an operational execution block to the pipeline chain.
   * If any previous block has failed, subsequent calls short-circuit immediately.
   * Leverages an eager fluent chain with automatic thenable wrapping to intercept
   * errors at the step boundary and trigger LIFO rollback prior to consumer caught recovery.
   * 
   * @param {function(Object, Object, AtomicPipeline): *} executionBlock - Callback processing (state, db, pipeline).
   * @returns {AtomicPipeline}
   * @throws {Error} Propagates any error thrown within the execution block or rollback failure.
   */
  then(executionBlock) {
    this.promise = this.promise.then((state) => {
      try {
        const result = executionBlock(state, this.db, this);
        
        // Wrap synchronous results or evaluate SyncPromise at the step boundary
        const promiseResult = isThenable(result) 
          ? result 
          : SyncPromise.resolve(result);

        return promiseResult.catch((error) => {
          console.error(`[PIPELINE FRACTURE] Boundary exception intercepted. Rolling back...`);
          try {
            this.tx.rollback();
            console.log(`[PIPELINE FRACTURE] Rollback completed at step fracture point.`);
          } catch (rollbackError) {
            console.error(`[PIPELINE FRACTURE] CRITICAL: Rollback failed: ${rollbackError.message}`);
          }
          throw error;
        }).then(() => state);
        
      } catch (boundaryException) {
        // Handle immediate synchronous failures inside executionBlock
        console.error(`[PIPELINE FRACTURE] Synchronous exception intercepted. Rolling back...`);
        try {
          this.tx.rollback();
          console.log(`[PIPELINE FRACTURE] Rollback completed at step fracture point.`);
        } catch (rollbackError) {
          console.error(`[PIPELINE FRACTURE] CRITICAL: Rollback failed: ${rollbackError.message}`);
        }
        throw boundaryException;
      }
    });
    return this;
  }

  /**
   * Generically executes a database operation block with automated rollback tracking.
   * The callback is passed a tracked repository facade that auto-registers mutations.
   * 
   * @param {string} repositoryName - The uppercase name of the target database model.
   * @param {function(TrackingRepository, Object, Object): void} operationBlock - Callback (repo, state, context).
   * @returns {AtomicPipeline}
   * @throws {ValidationError} If the repository name is invalid.
   */
  addStep(repositoryName, operationBlock) {
    return this.then((state, db) => {
      const rawRepo = db[repositoryName];
      if (!rawRepo) {
        throw new ValidationError(`Orchestration failed: Repository '${repositoryName}' not found in database facade.`);
      }

      // Wrap raw repository to automatically intercept and track database changes
      const trackingRepo = new TrackingRepository(rawRepo, this.tx);

      operationBlock(trackingRepo, state, this.context);

      // Register mutation dynamically via context interface
      this.context.trackMutation(repositoryName);
    });
  }

  /**
   * Finalizes the fluent chain execution, transforming and returning the output state payload.
   * @param {function(Object): any} [outputSelector] - Callback to format final returning state mapping.
   * @returns {any} The resolved output state.
   * @throws {Error} If the pipeline execution resulted in a rejected promise.
   */
  execute(outputSelector) {
    let result;
    let executionError;

    this.promise.then(
      (finalState) => {
        result = typeof outputSelector === "function" ? outputSelector(finalState) : finalState;
      },
      (err) => {
        executionError = err;
      }
    );

    if (executionError) {
      throw executionError;
    }
    return result;
  }
}

globalThis.AtomicPipeline = AtomicPipeline;
