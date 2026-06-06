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
   * Deletes multiple rows by matching primary key values.
   * 
   * @param {string} categoryName 
   * @param {string} tableName 
   * @param {string} primaryKeyName 
   * @param {Array<any>} ids - Array of target primary key values to remove.
   * @returns {number} The count of records deleted.
   */
  deleteRowsBatch(categoryName, tableName, primaryKeyName, ids) {
    console.log(`[SheetDataSource] Starting batch delete in '${tableName}' for ${ids.length} IDs.`);
    const idsToMatch = new Set(ids.map(id => String(id).trim()));

    return this._withLock(() => {
      const ss = this._getSpreadsheet(categoryName);
      const sheet = ss.getSheetByName(tableName);
      if (!sheet) {
        throw new TableNotFoundError(tableName, categoryName);
      }

      // 1. Read all rows including headers
      const values = sheet.getDataRange().getValues();
      if (values.length < 2) {
        console.log(`[SheetDataSource] Table '${tableName}' is empty or only has headers. Aborting.`);
        return 0; 
      }

      const headers = values[0];
      const dataRows = values.slice(1);
      const pkIndex = headers.indexOf(primaryKeyName);
      if (pkIndex === -1) {
        throw new BatchDeleteError(`Data Integrity Error: Primary key '${primaryKeyName}' not found in headers for table '${tableName}'.`, { tableName, headers });
      }

      // 2. Filter in JS Memory
      const remainingRows = [];
      let deleteCount = 0;

      dataRows.forEach((row, index) => {
        const rowId = String(row[pkIndex]).trim();
        if (idsToMatch.has(rowId)) {
          deleteCount++;
          console.log(`[SheetDataSource] [Debug] Match found for deletion at row index ${index + 2}: ID '${rowId}'`);
        } else {
          remainingRows.push(row);
        }
      });

      console.log(`[SheetDataSource] Scan finished. Matches to delete: ${deleteCount}/${dataRows.length}. Remaining rows: ${remainingRows.length}`);

      if (deleteCount === 0) {
        console.log(`[SheetDataSource] No matching records found for deletion. Skipping write.`);
        return 0; 
      }

      // 3. Clear data rows (retaining header in row 1)
      console.log(`[SheetDataSource] Clearing data rows in sheet '${tableName}'...`);
      sheet.getRange(2, 1, values.length - 1, headers.length).clearContent();

      // 4. Bulk Write remaining data rows back
      if (remainingRows.length > 0) {
        console.log(`[SheetDataSource] Bulk writing ${remainingRows.length} remaining rows back to sheet '${tableName}'...`);
        sheet.getRange(2, 1, remainingRows.length, headers.length).setValues(remainingRows);
      }

      console.log(`[SheetDataSource] Batch delete write sequence completed successfully.`);
      return deleteCount;
    });
  }

  /**
   * Updates multiple rows in a single batch write operation.
   * @param {string} categoryName 
   * @param {string} tableName 
   * @param {string} primaryKeyName 
   * @param {Object} updatesMap - Map of { id: { columnName: newValue } }
   * @returns {number} Count of records successfully updated.
   */
  updateRowsBatch(categoryName, tableName, primaryKeyName, updatesMap) {
    console.log(`[SheetDataSource] Starting batch update in '${tableName}' for ${Object.keys(updatesMap).length} IDs.`);
    const idsToMatch = new Set(Object.keys(updatesMap).map(id => String(id).trim()));

    return this._withLock(() => {
      const ss = this._getSpreadsheet(categoryName);
      const sheet = ss.getSheetByName(tableName);
      if (!sheet) {
        throw new TableNotFoundError(tableName, categoryName);
      }

      const values = sheet.getDataRange().getValues();
      if (values.length < 2) return 0; // Only headers present

      const headers = values[0];
      const dataRows = values.slice(1);
      const pkIndex = headers.indexOf(primaryKeyName);
      if (pkIndex === -1) {
        throw new Error(`Primary key '${primaryKeyName}' not found in table '${tableName}' headers.`);
      }

      let updateCount = 0;
      const updatedDataRows = dataRows.map((row) => {
        const rowId = String(row[pkIndex]).trim();
        if (idsToMatch.has(rowId)) {
          const rowUpdates = updatesMap[rowId];
          const updatedRow = [...row];
          
          // Apply changes to respective column indices
          Object.entries(rowUpdates).forEach(([colName, newVal]) => {
            const colIndex = headers.indexOf(colName);
            if (colIndex !== -1 && colName !== primaryKeyName) {
              updatedRow[colIndex] = newVal;
            }
          });
          
          updateCount++;
          return updatedRow;
        }
        return row;
      });

      if (updateCount === 0) {
        console.log(`[SheetDataSource] No matching records found for batch update. Skipping write.`);
        return 0;
      }

      // Overwrite the data range in a single range write (no clearContent required)
      sheet.getRange(2, 1, updatedDataRows.length, headers.length).setValues(updatedDataRows);
      
      console.log(`[SheetDataSource] Batch update complete. Updated ${updateCount} rows.`);
      return updateCount;
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
