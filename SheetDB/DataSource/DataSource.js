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
    this.requestHeaderCache = new RequestHeaderCache(); // Native RequestScope Cache
  }

  /**
   * Clears in-memory spreadsheet instances and request-scoped header cache.
   */
  purgeCache() {
    this._cache = {};
    this.requestHeaderCache.clear();
    console.log("[SheetDataSource] Master Spreadsheet & RequestHeaderCache purged.");
  }

  /**
   * Retrieves physical headers using ONLY RequestScope caching.
   * Completely bypasses long-term CacheService to eliminate cross-execution stale cache risk.
   * @param {string} categoryName 
   * @param {string} tableName 
   * @returns {Array<string>}
   */
  getHeaders(categoryName, tableName) {
    // 1. RequestScope Cache Check (Fast RAM Read - 0 API Calls)
    if (this.requestHeaderCache.has(categoryName, tableName)) {
      return this.requestHeaderCache.get(categoryName, tableName);
    }

    // 2. RequestCache Miss - Physical Spreadsheet Read (Single Round-Trip per table per request)
    console.log(`[SheetDataSource] RequestCache Miss: Physically reading headers for ${tableName}`);
    try {
      const ss = this._getSpreadsheet(categoryName);
      const sheet = ss.getSheetByName(tableName);

      if (!sheet) throw new Error(`Table '${tableName}' not found in category '${categoryName}'.`);

      const lastCol = sheet.getLastColumn();
      if (lastCol === 0) throw new Error(`Corrupted Table: '${tableName}' has no columns.`);

      const rawHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      const cleanHeaders = rawHeaders.map(h => String(h).trim());

      // 3. Store EXCLUSIVELY in RequestHeaderCache (RAM)
      this.requestHeaderCache.set(categoryName, tableName, cleanHeaders);

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
   * Surgically purges every data row in all sheets inside a designated spreadsheet,
   * keeping the Row 1 column definitions/headers completely intact in a single REST call.
   * @param {string} categoryName - The category/spreadsheet file identification key.
   * @returns {void}
   * @throws {InvalidArgumentError} If categoryName is empty or invalid.
   * @throws {ResourceNotFoundError} If the category file cannot be located on Drive.
   * @throws {StorageEngineError} If Advanced Sheets REST API operations reject execution.
   */
  purgeWorkbookBatch(categoryName) {
    if (!categoryName) {
      throw new InvalidArgumentError("[Purge] Cannot execute batch clear on empty category identifier.");
    }

    return this._withLock(() => {
      // 1. Locate physical Google Sheet via Storage Coordinator metadata
      const fileMeta = this.fs.findByName(categoryName);
      if (!fileMeta) {
        throw new ResourceNotFoundError(`[Purge] Target Category File '${categoryName}' does not exist.`);
      }
      const spreadsheetId = fileMeta.id;

      // 2. Fetch all tab/sheet definitions within this workbook file via Advanced Sheets API
      let spreadsheetMetadata;
      try {
        spreadsheetMetadata = Sheets.Spreadsheets.get(spreadsheetId);
      } catch (err) {
        throw new StorageEngineError(`[Purge] Failed to fetch structural metadata for file ID: ${spreadsheetId}. Error: ${err.message}`);
      }

      const sheets = spreadsheetMetadata.sheets || [];
      if (sheets.length === 0) return;

      // 3. Compile matching A2:Z data grid ranges to safely bypass Row 1 definitions
      const ranges = sheets.map(sheet => {
        const sheetName = sheet.properties.title;
        return `'${sheetName}'!A2:Z`;
      });

      const request = {
        ranges: ranges
      };

      console.log(`[SheetDataSource] Dispatching unified batchClear on workbook '${categoryName}' for ranges:`, ranges);

      // 4. Single execution transaction block boundary
      try {
        Sheets.Spreadsheets.Values.batchClear(request, spreadsheetId);
      } catch (apiErr) {
        throw new StorageEngineError(`[Purge] REST API batchClear execution rejected on file [${spreadsheetId}]: ${apiErr.message}`);
      }
    });
  }

  /**
   * surgically purges specified sheets inside a designated spreadsheet container file,
   * protecting row 1 headers while filtering out sheets that do not physically exist.
   * @param {string} categoryName - The category/spreadsheet file identification key.
   * @param {Array<string>} tables - The table/sheet names to clear.
   * @returns {void}
   */
  purgeTablesBatch(categoryName, tables) {
    if (!categoryName) {
      throw new InvalidArgumentError("[Purge] Cannot execute batch clear on empty category identifier.");
    }
    if (!Array.isArray(tables) || tables.length === 0) return;

    return this._withLock(() => {
      // 1. Locate physical Google Sheet via Storage Coordinator metadata
      const fileMeta = this.fs.findByName(categoryName);
      if (!fileMeta) {
        throw new ResourceNotFoundError(`[Purge] Target Category File '${categoryName}' does not exist.`);
      }
      const spreadsheetId = fileMeta.id;

      // 2. Pre-flight Physical Worksheet Intersection Check (Mitigates Edge Case 2)
      let spreadsheetMetadata;
      try {
        spreadsheetMetadata = Sheets.Spreadsheets.get(spreadsheetId);
      } catch (metaErr) {
        throw new StorageEngineError(`[Purge] Failed to fetch layout shape for workbook [${spreadsheetId}]: ${metaErr.message}`);
      }

      const physicalSheetTitles = (spreadsheetMetadata.sheets || []).map(s => s.properties.title);

      // 3. Filter requested tables against actual physical worksheets
      const verifiedTables = tables.filter(tableName => physicalSheetTitles.includes(tableName));

      if (verifiedTables.length === 0) {
        console.warn(`[SheetDataSource] Zero intersection found between schema criteria and physical sheets for category '${categoryName}'. Skipping REST call.`);
        return;
      }

      // 4. Assemble clean single-quotes ranges to prevent space-parsing drops
      const ranges = verifiedTables.map(tableName => `'${tableName}'!A2:Z`);
      const request = { ranges: ranges };

      console.log(`[SheetDataSource] Dispatching unified batchClear on workbook '${categoryName}' for:`, ranges);

      try {
        Sheets.Spreadsheets.Values.batchClear(request, spreadsheetId);
      } catch (apiErr) {
        throw new StorageEngineError(`[Purge] REST API batchClear execution rejected on file [${spreadsheetId}]: ${apiErr.message}`);
      }
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
