/**
 * ==============================================================
 * DataSource.gs
 * ==============================================================
 *
 * Layer: Infrastructure
 * Responsibility: Low-level interaction with Google Sheets.
 *
 * This class is the ONLY layer allowed to directly use
 * SpreadsheetApp and related GAS APIs.
 *
 * Architectural Contract:
 * - Must NOT contain domain logic
 * - Must NOT contain filtering logic
 * - Must NOT wrap models
 * - Must NOT resolve relations
 * - Must NOT know about ORM or repositories
 *
 * It ONLY reads structured raw data from a sheet and returns:
 *  - 2D arrays (raw)
 *  - OR structured row objects (header-mapped)
 *
 * MVP Scope:
 * - Read entire sheet
 * - Map header row
 * - Return array of objects
 *
 * ==============================================================
 */

/**
 * Custom error class for DataSource layer.
 * Ensures infrastructure errors are distinguishable.
 */
class DataSourceError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = "DataSourceError";
    this.meta = meta;
  }
}

/**
 * SheetDataSource
 * --------------------------------------------------------------
 * Production-ready infrastructure adapter for Google Sheets.
 */
class SheetDataSource {
  /**
   * @param {string} spreadsheetId - Target spreadsheet ID.
   * NOTE:
   * For testability and advanced usage, prefer using the static
   * factory methods instead of calling this constructor directly.
   */
  constructor(spreadsheetId) {
    if (!spreadsheetId) {
      throw new DataSourceError("Spreadsheet ID is required.");
    }

    this.spreadsheetId = spreadsheetId;
    this._spreadsheet = null;
  }

  /**
   * --------------------------------------------------------------
   * STATIC FACTORY: fromActiveSpreadsheet
   * --------------------------------------------------------------
   *
   * Creates a SheetDataSource instance using the currently
   * active spreadsheet via:
   *    SpreadsheetApp.getActiveSpreadsheet()
   *
   * This is useful when:
   *  - Script is container-bound
   *  - Working inside a single spreadsheet project
   *  - Rapid prototyping
   *
   * Architectural Note:
   * This does NOT break layering because SpreadsheetApp
   * usage is still isolated inside this Infrastructure layer.
   *
   * @returns {SheetDataSource}
   */
  static fromActiveSpreadsheet() {
    try {
      const active = SpreadsheetApp.getActiveSpreadsheet();

      if (!active) {
        throw new DataSourceError("No active spreadsheet found.");
      }

      const instance = new SheetDataSource(active.getId());
      instance._spreadsheet = active; // reuse already opened instance
      return instance;

    } catch (error) {
      if (error instanceof DataSourceError) throw error;

      throw new DataSourceError("Failed to initialize from active spreadsheet.", {
        cause: error.message
      });
    }
  

    this.spreadsheetId = spreadsheetId;
    this._spreadsheet = null;
  }

  /**
   * Lazily opens spreadsheet connection.
   * @private
   */
  _getSpreadsheet() {
    try {
      if (!this._spreadsheet) {
        this._spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
      }
      return this._spreadsheet;
    } catch (error) {
      throw new DataSourceError("Failed to open spreadsheet.", {
        spreadsheetId: this.spreadsheetId,
        cause: error.message
      });
    }
  }

  /**
   * Retrieves a sheet by name.
   * @param {string} sheetName
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  getSheet(sheetName) {
    if (!sheetName) {
      throw new DataSourceError("Sheet name must be provided.");
    }

    const spreadsheet = this._getSpreadsheet();
    const sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      throw new DataSourceError(`Sheet '${sheetName}' not found.`, {
        sheetName
      });
    }

    return sheet;
  }

  /**
   * Reads full sheet data as raw 2D array.
   *
   * @param {string} sheetName
   * @returns {Array<Array<any>>}
   */
  readRaw(sheetName) {
    try {
      const sheet = this.getSheet(sheetName);
      const range = sheet.getDataRange();
      const values = range.getValues();

      if (!values || values.length === 0) {
        return [];
      }

      return values;
    } catch (error) {
      if (error instanceof DataSourceError) throw error;

      throw new DataSourceError("Failed to read raw sheet data.", {
        sheetName,
        cause: error.message
      });
    }
  }

  /**
   * Reads sheet and converts rows to object array using header row.
   * Assumes:
   *  - First row is header
   *  - Remaining rows are data
   *  - Each sheet contains exactly one logical table
   *
   * @param {string} sheetName
   * @returns {Array<Object>}
   */
  readTable(sheetName) {
    try {
      const values = this.readRaw(sheetName);

      if (values.length < 2) {
        return [];
      }

      const headers = values[0];
      const rows = values.slice(1);

      this._validateHeaders(headers, sheetName);

      return rows.map((row, rowIndex) => {
        const record = {};
        headers.forEach((header, colIndex) => {
          record[header] = row[colIndex];
        });
        
        // Internal tracking of row number for surgical updates
        record.__rowNumber = rowIndex + 2; 
        
        return record;
      });

    } catch (error) {
      if (error instanceof DataSourceError) throw error;

      throw new DataSourceError("Failed to read structured table.", {
        sheetName,
        cause: error.message
      });
    }
  }

  /**
   * Executes a callback within a Script Lock to prevent race conditions.
   * 
   * Architectural Reasoning:
   * GAS is multi-threaded across concurrent users. Locking ensures 
   * data integrity during write operations (LastRow calculation, etc.)
   * 
   * @private
   */
  _withLock(callback) {
    const lock = LockService.getScriptLock();
    try {
      // Wait up to 10 seconds for concurrent requests to clear
      lock.waitLock(10000); 
      return callback();
    } catch (e) {
      throw new DataSourceError("Database is currently busy. Please try again in a moment.", {
        type: "LockTimeout",
        cause: e.message
      });
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Efficiently inserts multiple rows using a single API call.
   * 
   * @param {string} sheetName
   * @param {Array<Array<any>>} rows2D - Data in 2D array format
   */
  insertRows(sheetName, rows2D) {
    if (!Array.isArray(rows2D) || rows2D.length === 0) return;

    return this._withLock(() => {
      const sheet = this.getSheet(sheetName);
      const lastRow = sheet.getLastRow();
      const colCount = rows2D[0].length;

      sheet.getRange(lastRow + 1, 1, rows2D.length, colCount)
           .setValues(rows2D);
    });
  }

  /**
   * Overwrites a specific row by its row number.
   * 
   * @param {string} sheetName
   * @param {number} rowNumber - 1-based index of the row
   * @param {Array<any>} rowData - Ordered array of cell values
   */
  updateRow(sheetName, rowNumber, rowData) {
    if (!rowNumber || rowNumber < 2) {
      throw new DataSourceError("Invalid row number for update.", { rowNumber });
    }

    return this._withLock(() => {
      const sheet = this.getSheet(sheetName);
      sheet.getRange(rowNumber, 1, 1, rowData.length)
           .setValues([rowData]);
    });
  }

  /**
   * Validates header integrity.
   * @private
   */
  _validateHeaders(headers, sheetName) {
    if (!Array.isArray(headers) || headers.length === 0) {
      throw new DataSourceError("Header row is missing or invalid.", {
        sheetName
      });
    }

    headers.forEach((header, index) => {
      if (!header || header.toString().trim() === "") {
        throw new DataSourceError("Invalid empty column name detected.", {
          sheetName,
          columnIndex: index
        });
      }
    });
  }
}

/**
 * ==============================================================
 * Future Enhancements (Post-MVP Roadmap)
 * ==============================================================
 *
 * 1. Caching Layer
 *    - In-memory caching of sheet reads per request
 *    - Time-based cache invalidation
 *
 * 2. Partial Range Reads
 *    - Allow reading specific columns only
 *    - Allow reading specific row ranges
 *
 * 3. Schema Validation
 *    - Validate header structure against DATABASE_SCHEMA
 *
 * 4. Snapshot Optimization
 *    - Batch read all required sheets once per request
 *
 * 5. Read Performance Logging
 *    - Measure execution time for sheet reads
 *
 * 6. Soft Failure Recovery
 *    - Fallback behavior for temporary quota issues
 *
 * 7. Write Support (Future Phase)
 *    - insert()
 *    - update()
 *    - delete()
 *
 * ==============================================================
 */
