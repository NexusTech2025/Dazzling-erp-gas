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
