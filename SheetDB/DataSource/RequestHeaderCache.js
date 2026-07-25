/**
 * @file RequestHeaderCache.js
 * Protocol & Interface for Request-Scoped Header Caching in SheetDB.
 * Manages in-memory header caching strictly scoped to the active execution context.
 */

class RequestHeaderCache {
  constructor() {
    this._store = new Map();
  }

  /**
   * Generates internal composite key.
   * @private
   */
  _getKey(categoryName, tableName) {
    return `${categoryName}_${tableName}`;
  }

  /**
   * Retrieves cached headers for target table within active request scope.
   * @param {string} categoryName
   * @param {string} tableName
   * @returns {Array<string>|null} Array of string headers or null if miss.
   */
  get(categoryName, tableName) {
    const key = this._getKey(categoryName, tableName);
    const cached = this._store.get(key);
    return cached ? [...cached] : null;
  }

  /**
   * Caches headers for target table in RAM.
   * @param {string} categoryName
   * @param {string} tableName
   * @param {Array<string>} headers
   */
  set(categoryName, tableName, headers) {
    if (!Array.isArray(headers)) return;
    const key = this._getKey(categoryName, tableName);
    this._store.set(key, [...headers]);
  }

  /**
   * Checks if key exists in request cache.
   * @param {string} categoryName
   * @param {string} tableName
   * @returns {boolean}
   */
  has(categoryName, tableName) {
    const key = this._getKey(categoryName, tableName);
    return this._store.has(key);
  }

  /**
   * Flushes all request-scoped cached headers.
   */
  clear() {
    this._store.clear();
  }
}
