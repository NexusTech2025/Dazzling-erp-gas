/**
 * @file DataSource.js
 * Layer: Low-level Infrastructure Adapter
 * 
 * Responsibility:
 * - Handle direct Google Sheets I/O (Read/Write).
 * - "Roaming" Capability: Dynamically resolves Spreadsheet IDs using the FileSystem.
 * - Enforce Script Locking for write operations to ensure data integrity.
 */

class SheetDataSource {
  /**
   * @param {Object} fileSystem - Instance of SpreadsheetFileSystem.
   */
  constructor(fileSystem) {
    this.fs = fileSystem;
    this._cache = {}; // Local instance cache for open spreadsheets
  }

  /**
   * Clears the internal spreadsheet cache.
   * Forces the next read to perform a fresh open from Drive.
   */
  purgeCache() {
    this._cache = {}; // Clear in-memory instances
    CacheService.getScriptCache().remove("dazzling_db_headers_v2"); // Clear cross-execution cache
    console.log("[SheetDataSource] Master Spreadsheet & Header caches purged.");
  }

  /**
   * Retrieves physical headers, utilizing CacheService for cross-execution performance.
   * @param {string} categoryName 
   * @param {string} tableName 
   */
  getHeaders(categoryName, tableName) {
    const CACHE_KEY = "dazzling_db_headers_v2";
    const cache = CacheService.getScriptCache();
    const cacheKeyForTable = `${categoryName}_${tableName}`;
    
    // 1. Try Cache First (Blazing Fast)
    const cachedDataStr = cache.get(CACHE_KEY);
    let allHeaders = cachedDataStr ? JSON.parse(cachedDataStr) : {};
    
    if (allHeaders[cacheKeyForTable]) {
      return allHeaders[cacheKeyForTable]; // O(1) Cache Hit!
    }

    // 2. Cache Miss - Physical Read
    console.log(`[SheetDataSource] Cache Miss: Physically reading headers for ${tableName}`);
    try {
      const ss = this._getSpreadsheet(categoryName);
      const sheet = ss.getSheetByName(tableName);
      
      if (!sheet) throw new Error(`Table '${tableName}' not found in category '${categoryName}'.`);

      const lastCol = sheet.getLastColumn();
      if (lastCol === 0) throw new Error(`Corrupted Table: '${tableName}' has no columns.`);

      const rawHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      const cleanHeaders = rawHeaders.map(h => String(h).trim());

      // 3. Update Cache Payload
      allHeaders[cacheKeyForTable] = cleanHeaders;
      
      // Store for 6 hours (Max allowed by Apps Script). 
      // Safe because columns rarely change in production.
      cache.put(CACHE_KEY, JSON.stringify(allHeaders), 21600); 

      return cleanHeaders;

    } catch (e) {
      console.error(`[SheetDataSource] Fatal Error resolving headers: ${e.message}`);
      // Throwing IntegrityError ensures the ORM aborts the operation safely
      throw new IntegrityError(`Failed to resolve physical headers for ${tableName}. ${e.message}`);
    }
  }

  /**
   * Resolves a category name to a Spreadsheet object.
   * @private
   */
  _getSpreadsheet(categoryName) {
    if (this._cache[categoryName]) return this._cache[categoryName];

    const fileMeta = this.fs.findByName(categoryName);
    if (!fileMeta) {
      throw new Error(`Data Source Error: Category file '${categoryName}' not found in Drive.`);
    }

    const ss = this.fs.open(fileMeta.id);
    this._cache[categoryName] = ss;
    return ss;
  }

  /**
   * Reads an entire sheet and returns an array of objects.
   * @param {string} categoryName - Spreadsheet Name.
   * @param {string} tableName - Sheet Name.
   */
  readTable(categoryName, tableName) {
    const ss = this._getSpreadsheet(categoryName);
    const sheet = ss.getSheetByName(tableName);
    if (!sheet) throw new Error(`Table '${tableName}' not found in category '${categoryName}'.`);

    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return [];

    const headers = values[0];
    const data = values.slice(1);

    return data.map((row, index) => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      obj.__rowNumber = index + 2; // Track physical row for updates
      return obj;
    });
  }

  /**
   * Inserts multiple rows efficiently.
   */
  insertRows(categoryName, tableName, rows2D) {
    if (!rows2D || rows2D.length === 0) return;

    return this._withLock(() => {
      const ss = this._getSpreadsheet(categoryName);
      const sheet = ss.getSheetByName(tableName);
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, rows2D.length, rows2D[0].length).setValues(rows2D);
    });
  }

  /**
   * Updates a specific row physically.
   */
  updateRow(categoryName, tableName, rowNumber, rowArray) {
    return this._withLock(() => {
      const ss = this._getSpreadsheet(categoryName);
      const sheet = ss.getSheetByName(tableName);
      sheet.getRange(rowNumber, 1, 1, rowArray.length).setValues([rowArray]);
    });
  }

  /**
   * Deletes a specific row physically.
   */
  deleteRow(categoryName, tableName, rowNumber) {
    return this._withLock(() => {
      const ss = this._getSpreadsheet(categoryName);
      const sheet = ss.getSheetByName(tableName);
      sheet.deleteRow(rowNumber);
    });
  }

  /**
   * Internal wrapper for concurrency safety.
   * @private
   */
  _withLock(fn) {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000); // 10s timeout
      return fn();
    } finally {
      lock.releaseLock();
    }
  }
}
