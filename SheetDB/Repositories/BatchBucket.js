/**
 * @file BatchBucket.js
 * Pattern: Unit of Work / Transaction Buffer
 * 
 * Responsibility:
 * - Collect data for multiple entities in memory.
 * - Maintain insertion sequence (Priority: Parent -> Child).
 * - Perform single-batch writes per table to optimize performance.
 * - Validate integrity before hitting Google Sheets.
 */

class BatchBucket {
  /**
   * @param {Object} dbContext - The main database facade.
   */
  constructor(dbContext) {
    this.db = dbContext;
    this.buckets = {};   // { tableName: [dataObjects] }
    this.sequence = [];  // Ordered list of table names to process
  }

  /**
   * Adds data to a specific table's bucket.
   * Maintains the sequence based on the order of addition.
   */
  add(tableName, data) {
    if (!this.buckets[tableName]) {
      this.buckets[tableName] = [];
      this.sequence.push(tableName);
    }

    if (Array.isArray(data)) {
      this.buckets[tableName].push(...data);
    } else {
      this.buckets[tableName].push(data);
    }
  }

  /**
   * Orchestrates the prioritized batch execution.
   */
  execute() {
    // --- Validation Phase ---
    const context = this._buildValidationContext();
    const validator = new SchemaValidator();
    const report = validator.validateAll(this.buckets, this.db._schema, context);

    if (!report.isValid) {
      throw new Error(`BatchValidationError: ${JSON.stringify(report.errors, null, 2)}`);
    }

    // --- Execution Phase ---
    const results = {};
    
    console.log(`[BatchBucket] Starting execution for ${this.sequence.length} tables...`);

    // Process buckets in the order they were added (Sequence)
    this.sequence.forEach(tableName => {
      const data = this.buckets[tableName];
      const repo = this.db[tableName];

      if (!repo) throw new Error(`Batch execution failed: Repository for '${tableName}' not found.`);

      console.log(`[BatchBucket] Writing ${data.length} rows to ${tableName}...`);
      
      // Execute the batch write via the repository's gateway
      results[tableName] = repo.gateway.insertBatch(data);
    });

    return results;
  }

  /**
   * Builds a validation context containing valid primary keys for parent tables.
   * This prevents the N+1 query problem during relational validation.
   * @private
   */
  _buildValidationContext() {
    const context = { parentPKs: {} };
    
    // Find all 'belongsTo' relations needed by the tables in this batch
    const requiredParents = new Set();
    
    this.sequence.forEach(tableName => {
      const relations = this.db._registry.getRelations(tableName);
      for (const relDef of Object.values(relations)) {
        if (relDef.type === 'belongsTo') {
          requiredParents.add(relDef.target);
        }
      }
    });

    // Pre-fetch primary keys for all required parent tables (ONE full scan per table)
    requiredParents.forEach(parentTable => {
      const repo = this.db[parentTable];
      if (repo) {
        const pkName = this.db._registry.getPrimaryKey(parentTable);
        const parentSet = new Set();

        // 1. Get existing records from the database
        const existingRows = repo.all(); 
        existingRows.forEach(row => {
          if (row[pkName] !== undefined && row[pkName] !== null) {
            parentSet.add(row[pkName]);
          }
        });

        // 2. Add records that are part of this current batch (Pending creation)
        if (this.buckets[parentTable]) {
          this.buckets[parentTable].forEach(row => {
            if (row[pkName] !== undefined && row[pkName] !== null) {
              parentSet.add(row[pkName]);
            }
          });
        }

        context.parentPKs[parentTable] = parentSet;
      }
    });

    return context;
  }

  /**
   * Resets the bucket for a new transaction.
   */
  clear() {
    this.buckets = {};
    this.sequence = [];
  }
}
