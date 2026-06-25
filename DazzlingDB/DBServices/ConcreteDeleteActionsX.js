/**
 * @file ConcreteDeleteActionsX.js
 * Specialized module for non-disruptive bulk deletion actions with relational violation isolation.
 */

/**
 * Abstract Base Architecture for Bulk Record Operations
 * Pattern: Non-Disruptive Bulk Deletion Manifests (with Relational Violation Isolation)
 * @abstract
 * @extends {BaseAction}
 */
class AbstractDeleteManyRecordsAction extends BaseAction {
  constructor(params, db, user) {
    super(ActionType.DELETE);
    if (this.constructor === AbstractDeleteManyRecordsAction) {
      throw new Error("Abstract class 'AbstractDeleteManyRecordsAction' cannot be instantiated directly.");
    }
    this._actionName = "data_delete_many";
  }

  /**
   * Hook 1: Dictates which core schema configuration entity the gateway must point to at runtime.
   * @abstract
   * @protected
   * @returns {string} The database model/table name literal (e.g., "CourseType", "Course").
   */
  _getTargetTable() {
    throw new Error("Subclasses must declare an explicit target table mapping.");
  }

  /**
   * Hook 2: Executes custom validation or permission rules on an individual record BEFORE checking relations.
   * @protected
   * @param {any} id - The primary key value of the record slated for validation.
   * @throws {ActionValidationError} On immediate policy or state failures.
   */
  _beforeCheck(id) {
    // Optional extension hook
  }

  /**
   * Hook 3: Callback triggered immediately after constraint verification evaluates for an individual record.
   * @protected
   * @param {any} id - The primary key value of the record evaluated.
   * @param {boolean} isClean - True if the record passed constraint checks, false if it failed.
   * @param {Error|null} error - The validation error object caught on failure, or null on success.
   */
  _afterCheck(id, isClean, error) {
    // Optional extension hook
  }

  /**
   * Hook 4: Intercepts raw database IntegrityError responses and maps them into a structured delivery format.
   * @protected
   * @param {any} id - The primary key value of the failed record.
   * @param {IntegrityError} error - The caught database integrity error.
   * @returns {Object} Structured metadata tracking object mapping to failed[id].
   */
  _formatViolation(id, error) {
    return {
      message: error.message,
      violations: error.context ? error.context.violations : []
    };
  }

  /**
   * Hook 5: Fires atomic side-effects (e.g., flushes, audit logs) after physical commit completes.
   * @protected
   * @param {Array<any>} ids - The array of primary keys that were successfully deleted.
   */
  _onCommitSuccess(ids) {
    // Optional extension hook
  }

  _validate() {
    this._requireParam("payload");
    const { ids } = this._params.payload;
    if (!ids || !Array.isArray(ids)) {
      throw new ActionValidationError("Payload must contain 'ids' array parameter.");
    }
    if (ids.length === 0) {
      throw new ActionValidationError("Payload 'ids' array must contain at least one ID.");
    }
  }

  _execute() {
    const tableName = this._getTargetTable();
    const { ids } = this._params.payload;
    const dryRun = this._params.payload.dryRun !== false;
    
    let deletedCount = 0;
    const failed = {};
    const safeToQuery = [];
    const tableGateway = this._db[tableName];

    if (!tableGateway) {
      throw new SystemError(`Relational Structuring Gap: Gateway context for '${tableName}' not registered.`);
    }

    if (!dryRun) {
      // Live RAM-bound single-pass deletion rewrite execution path
      try {
        deletedCount = tableGateway.deleteMany(ids);
        this._onCommitSuccess(ids); // Fire post-commit automation hooks safely
      } catch (e) {
        if (e instanceof SheetDB.IntegrityError || e.name === "IntegrityError" || e instanceof SheetDB.ValidationError || e.name === "ValidationError") {
          throw new ActionValidationError(e.message, { details: e.context });
        }
        throw e;
      }
    } else {
      // Controlled, non-crashing loop evaluating individual relational blockages
      ids.forEach(id => {
        try {
          this._beforeCheck(id); // Run custom validation checks
          
          tableGateway.enforceDeleteConstraints(id);
          safeToQuery.push(id);
          
          this._afterCheck(id, true, null);
        } catch (e) {
          if (e instanceof SheetDB.IntegrityError || e.name === "IntegrityError") {
            failed[id] = this._formatViolation(id, e); // Format isolated error metadata
            this._afterCheck(id, false, e);
          } else {
            throw e;
          }
        }
      });
    }

    return {
      success: true,
      dryRun: dryRun,
      deletedCount: dryRun ? 0 : deletedCount,
      manifest: {
        deleted: dryRun ? safeToQuery : ids,
        skipped: [],
        failed: failed
      }
    };
  }
}
globalThis.AbstractDeleteManyRecordsAction = AbstractDeleteManyRecordsAction;

/**
 * Academic Domain: Delete many course segments
 * @extends {AbstractDeleteManyRecordsAction}
 */
class DeleteManyCourseTypeAction extends AbstractDeleteManyRecordsAction {
  _getTargetTable() {
    return "CourseType";
  }
}
globalThis.DeleteManyCourseTypeAction = DeleteManyCourseTypeAction;

/**
 * Catalog Domain: Delete many courses
 * @extends {AbstractDeleteManyRecordsAction}
 */
class DeleteManyCoursesAction extends AbstractDeleteManyRecordsAction {
  _getTargetTable() {
    return "Course";
  }
}
globalThis.DeleteManyCoursesAction = DeleteManyCoursesAction;

/**
 * Academic Domain: Delete many packages
 * @extends {AbstractDeleteManyRecordsAction}
 */
class DeleteManyPackagesAction extends AbstractDeleteManyRecordsAction {
  _getTargetTable() {
    return "Package";
  }
}
globalThis.DeleteManyPackagesAction = DeleteManyPackagesAction;

