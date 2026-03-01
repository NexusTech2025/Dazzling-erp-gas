/**
 * ==============================================================
 * IdentityMap.gs
 * ==============================================================
 *
 * Responsibility:
 * - Ensure unique model instance per entity + primary key
 * - Prevent duplicate object representations
 *
 * MUST NOT:
 * - Access repositories
 * - Access SpreadsheetApp
 * - Contain business logic
 * ==============================================================
 */

class IdentityMap {

  constructor() {
    this._store = new Map(); 
    // Structure:
    // Map<entityName, Map<id, modelInstance>>
  }

  /**
   * Get instance if exists
   */
  get(entityName, id) {
    if (!this._store.has(entityName)) return null;
    return this._store.get(entityName).get(id) || null;
  }

  /**
   * Store instance
   */
  set(entityName, id, instance) {
    if (!this._store.has(entityName)) {
      this._store.set(entityName, new Map());
    }

    this._store.get(entityName).set(id, instance);
  }

  /**
   * Check existence
   */
  has(entityName, id) {
    return (
      this._store.has(entityName) &&
      this._store.get(entityName).has(id)
    );
  }

  /**
   * Clear entire map (end of request lifecycle)
   */
  clear() {
    this._store.clear();
  }

  /**
   * Debug statistics
   */
  stats() {
    const summary = {};
    this._store.forEach((entityMap, entity) => {
      summary[entity] = entityMap.size;
    });
    return summary;
  }
}