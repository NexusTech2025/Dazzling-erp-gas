/**
 * @file TransactionTracker.js
 * Generic LIFO Rollback Transaction Manager for DazzlingDB service operations.
 */

class TransactionTracker {
  constructor() {
    this.steps = [];
  }

  /**
   * Track a new record insert.
   * @param {Object} repository - The active dynamic table repository
   * @param {string|number} id - Primary key value
   */
  trackInsert(repository, id) {
    this.steps.push({ action: 'delete', repository, id });
  }

  /**
   * Track a record update.
   * @param {Object} repository - The active dynamic table repository
   * @param {string|number} id - Primary key value
   * @param {Object} originalState - Copy of original database row data
   */
  trackUpdate(repository, id, originalState) {
    this.steps.push({ action: 'update', repository, id, backup: originalState });
  }

  /**
   * Track a record deletion.
   * @param {Object} repository - The active dynamic table repository
   * @param {BaseModel} backupModel - Hydrated model instance representing the deleted state
   */
  trackDelete(repository, backupModel) {
    this.steps.push({ action: 'insert', repository, backup: backupModel });
  }

  /**
   * Track a bulk association sync (delete + rewrite).
   * @param {Object} repository - The active dynamic table repository
   * @param {Object} deleteFilters - Filter object to clear out new insertions
   * @param {Array<BaseModel>} backupModels - Original records backing up the table state
   */
  trackSync(repository, deleteFilters, backupModels) {
    this.steps.push({ action: 'restore_sync', repository, filters: deleteFilters, backup: backupModels });
  }

  /**
   * Executes rollback steps in reverse chronological order (LIFO).
   */
  rollback() {
    console.warn(`[TransactionTracker] Reverting changes. Running ${this.steps.length} rollback operations...`);
    for (let i = this.steps.length - 1; i >= 0; i--) {
      const step = this.steps[i];
      try {
        if (step.action === 'delete') {
          step.repository.remove(step.id);
          console.log(`[Rollback] Removed record ${step.id} from ${step.repository.entityName}`);
        } else if (step.action === 'update') {
          step.repository.update(step.id, step.backup);
          console.log(`[Rollback] Restored original state for record ${step.id} in ${step.repository.entityName}`);
        } else if (step.action === 'insert') {
          // Re-insert deleted record directly using gateway to preserve primary key ID
          step.repository.gateway.insert(step.backup.toDatabaseRow());
          const pkName = step.repository.registry.getPrimaryKey(step.repository.entityName);
          console.log(`[Rollback] Restored deleted record ${step.backup[pkName]} to ${step.repository.entityName}`);
        } else if (step.action === 'restore_sync') {
          // 1. Delete new insertions
          const newEntries = step.repository.where(step.filters);
          const pkName = step.repository.registry.getPrimaryKey(step.repository.entityName);
          newEntries.forEach(item => step.repository.remove(item[pkName]));

          // 2. Restore backup models directly to Sheet via gateway (avoiding AutoField security triggers)
          step.backup.forEach(item => {
            step.repository.gateway.insert(item.toDatabaseRow());
          });
          console.log(`[Rollback] Restored ${step.backup.length} sync entries to ${step.repository.entityName}`);
        }
      } catch (err) {
        console.error(`[Rollback] Failed to execute step: ${err.message}`, err);
      }
    }
  }
}

// Register globally for GAS environment
globalThis.TransactionTracker = TransactionTracker;
