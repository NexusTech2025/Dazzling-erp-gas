/**
 * @file PrimaryKeyCache.js
 * Layer: Registries - Performance Cache
 * 
 * Responsibility:
 * - Store sets of active primary keys for each table.
 * - Provide O(1) lookups to check referential integrity.
 * - Lazily load active IDs from worksheets upon first query.
 */

class PrimaryKeyCache {
  /**
   * @param {Object} dbContext - Main SheetDB database facade containing repositories
   */
  constructor(dbContext) {
    this.db = dbContext;
    this._cache = {}; // { tableName: Set<string> }
  }

  /**
   * Returns the set of active primary keys for a given table.
   * Lazily loads from the TableGateway if not cached.
   * @param {string} tableName
   * @returns {Set<string>} Set of stringified primary keys
   */
  get(tableName) {
    if (this._cache[tableName]) {
      return this._cache[tableName];
    }
    
    console.log(`[PrimaryKeyCache] Cache Miss: Compiling active keys for table '${tableName}'...`);
    const repo = this.db[tableName];
    if (!repo) {
      throw new Error(`[PrimaryKeyCache] Repository for table '${tableName}' not found in database facade.`);
    }

    const pkName = this.db._registry.getPrimaryKey(tableName);
    const ids = new Set();
    
    // Fetch raw rows directly (using gateway is much faster than repo.all() as it bypasses hydration)
    const rawRows = repo.gateway.all();
    rawRows.forEach(row => {
      if (row[pkName] !== undefined && row[pkName] !== null) {
        ids.add(String(row[pkName]).trim());
      }
    });

    this._cache[tableName] = ids;
    console.log(`[PrimaryKeyCache] Cached ${ids.size} keys for table '${tableName}'.`);
    return ids;
  }

  /**
   * Dynamically appends a primary key to the cache.
   * @param {string} tableName
   * @param {any} id
   */
  add(tableName, id) {
    if (id === null || id === undefined || id === '') return;
    if (this._cache[tableName]) {
      this._cache[tableName].add(String(id).trim());
    }
  }

  /**
   * Dynamically removes a primary key from the cache.
   * @param {string} tableName
   * @param {any} id
   */
  remove(tableName, id) {
    if (id === null || id === undefined || id === '') return;
    if (this._cache[tableName]) {
      this._cache[tableName].delete(String(id).trim());
    }
  }

  /**
   * Invalidates cached primary keys for a table.
   * @param {string} tableName
   */
  invalidate(tableName) {
    delete this._cache[tableName];
    console.log(`[PrimaryKeyCache] Invalidated keys for table '${tableName}'.`);
  }

  /**
   * Purges the entire PK cache.
   */
  clear() {
    this._cache = {};
    console.log("[PrimaryKeyCache] Purged all cached keys.");
  }
}

// Bind to Global Scope
globalThis.PrimaryKeyCache = PrimaryKeyCache;
