/**
 * Production-Ready TableLogger for Google Apps Script
 * Features:
 *  - ASCII table rendering
 *  - Nested object flattening
 *  - Column filtering
 *  - Row limiting
 *  - Output control (Logger / console)
 */

class TableLogger {

  constructor(options = {}) {
    this.maxRows = options.maxRows || 50;
    this.flatten = options.flatten !== false; // default true
    this.columns = options.columns || null;   // explicit column order
    this.output = options.output || 'logger'; // 'logger' | 'console' | 'both'
  }

  /**
   * Public method
   */
  log(data) {
    if (!Array.isArray(data) || data.length === 0) {
      this._print("⚠ Empty or invalid data");
      return;
    }

    let rows = this.flatten
      ? data.map(obj => this._flattenObject(obj))
      : data;

    if (rows.length > this.maxRows) {
      this._print(`⚠ Showing first ${this.maxRows} rows out of ${rows.length}`);
      rows = rows.slice(0, this.maxRows);
    }

    const headers = this.columns || this._collectHeaders(rows);
    const table = this._buildTable(headers, rows);

    this._print(table);
  }

  /**
   * Flatten nested object (dot notation)
   */
  _flattenObject(obj, prefix = '', res = {}) {
    for (let key in obj) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];

      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        this._flattenObject(value, newKey, res);
      } else {
        res[newKey] = value;
      }
    }
    return res;
  }

  /**
   * Collect all unique headers
   */
  _collectHeaders(rows) {
    const headerSet = new Set();
    rows.forEach(row => {
      Object.keys(row).forEach(key => headerSet.add(key));
    });
    return Array.from(headerSet);
  }

  /**
   * Build ASCII table
   */
  _buildTable(headers, rows) {
    const colWidths = headers.map(h =>
      Math.max(
        h.length,
        ...rows.map(r => String(r[h] ?? '').length)
      )
    );

    const divider = '+' + colWidths.map(w => '-'.repeat(w + 2)).join('+') + '+';

    const headerRow =
      '|' +
      headers
        .map((h, i) => ` ${h.padEnd(colWidths[i])} `)
        .join('|') +
      '|';

    const dataRows = rows.map(row =>
      '|' +
      headers
        .map((h, i) =>
          ` ${String(row[h] ?? '').padEnd(colWidths[i])} `
        )
        .join('|') +
      '|'
    );

    return [
      divider,
      headerRow,
      divider,
      ...dataRows,
      divider
    ].join('\n');
  }

  /**
 * Output handler
   */
  _print(message) {
    if (this.output === 'logger' || this.output === 'both') {
      Logger.log('\n' + message);
    }
    if (this.output === 'console' || this.output === 'both') {
      console.log('\n' + message);
    }
  }
}

/**
 * ==============================================================
 * SchemaIntegrityChecker.gs
 * ==============================================================
 * 
 * Responsibility:
 * - Cross-reference DATABASE_SCHEMA with physical Spreadsheet structure.
 * - Identify missing sheets.
 * - Identify missing or mismatched columns.
 * - Provide a summarized diagnostic report.
 * ==============================================================
 */
class SchemaIntegrityChecker {

  /**
   * @param {SchemaRegistry} schemaRegistry
   * @param {SheetDataSource} dataSource
   */
  constructor(schemaRegistry, dataSource) {
    this.registry = schemaRegistry;
    this.dataSource = dataSource;
  }

  /**
   * Run full system diagnostic.
   */
  verifyAll() {
    Logger.log("🔍 Starting Schema Integrity Check...");
    
    const entities = DATABASE_SCHEMA; // Direct access to global config
    const results = [];

    for (const entityName in entities) {
      const report = {
        entity: entityName,
        status: "OK",
        issues: []
      };

      try {
        const tableName = this.registry.getTableName(entityName);
        const schemaColumns = Object.keys(this.registry.getColumns(entityName));
        
        // 1. Check sheet existence
        const sheet = this.dataSource.getSheet(tableName);
        
        // 2. Check headers
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        
        // Find missing columns
        schemaColumns.forEach(col => {
          if (!headers.includes(col)) {
            report.issues.push(`Missing column: "${col}"`);
          }
        });

        // Find extra columns in sheet not in schema (optional info)
        headers.forEach(header => {
          if (header && !schemaColumns.includes(header)) {
            // report.issues.push(`Extra column found: "${header}"`);
          }
        });

        if (report.issues.length > 0) {
          report.status = "MISMATCH";
        }

      } catch (e) {
        report.status = "FAILED";
        report.issues.push(e.message);
      }

      results.push(report);
    }

    this._printReport(results);
    return results;
  }

  /**
   * Internal reporter utilizing TableLogger for beauty.
   */
  _printReport(results) {
    const logger = new TableLogger({
      columns: ["entity", "status", "issues"]
    });

    // Flatten issues array for the table display
    const flattened = results.map(r => ({
      ...r,
      issues: r.issues.length > 0 ? r.issues.join(", ") : "None"
    }));

    logger.log(flattened);
  }
}

/**
 * Manual Trigger for Developers
 */
function runIntegrityCheck() {
  const orm = bootstrapORM();
  const checker = new SchemaIntegrityChecker(
    getGlobalSchemaRegistry(),
    SheetDataSource.fromActiveSpreadsheet()
  );
  
  checker.verifyAll();
}

/**
 * ==============================================================
 * ServerLogger.gs
 * ==============================================================
 * 
 * Responsibility:
 * - Standardize transaction logging across the server.
 * - Provide levels (DEBUG, INFO, SUCCESS, WARN, ERROR).
 * - Maintain transaction context via ID.
 */
class ServerLogger {
  
  static get LEVELS() {
    return {
      DEBUG:   "🔍 DEBUG  ",
      INFO:    "🔹 INFO   ",
      SUCCESS: "✅ SUCCESS",
      WARN:    "⚠️ WARN   ",
      ERROR:   "❌ ERROR  "
    };
  }

  /**
   * @param {string} transactionId - Unique ID for the request lifecycle
   */
  constructor(transactionId = "system") {
    this.txId = transactionId;
  }

  debug(category, message)   { this._log("DEBUG", category, message); }
  info(category, message)    { this._log("INFO", category, message); }
  success(category, message) { this._log("SUCCESS", category, message); }
  warn(category, message)    { this._log("WARN", category, message); }
  error(category, message)   { this._log("ERROR", category, message); }

  /**
   * Log a JSON object with masking for sensitive keys.
   */
  json(category, label, data) {
    const masked = this._maskSensitive(data);
    this._log("DEBUG", category, `${label}: ${JSON.stringify(masked)}`);
  }

  /**
   * Internal formatting logic
   */
  _log(level, category, message) {
    const levelLabel = ServerLogger.LEVELS[level] || level;
    const catLabel = String(category).toUpperCase().padEnd(8);
    
    const output = `[${levelLabel}] [${this.txId}] [${catLabel}] ${message}`;
    Logger.log(output);
  }

  /**
   * Simple security mask for logs.
   * Avoids deep recursion by only checking top-level and 
   * one-level nested objects (like userData/profileData).
   */
  _maskSensitive(obj) {
    if (!obj || typeof obj !== 'object' || obj === null) return obj;
    
    const sensitiveKeys = ['password', 'token', 'setupKey', 'setup_key', 'password_hash'];
    const clone = Array.isArray(obj) ? [...obj] : { ...obj };
    
    Object.keys(clone).forEach(key => {
      if (sensitiveKeys.includes(key)) {
        clone[key] = "********";
      } 
      // Handle known one-level nested containers
      else if ((key === 'userData' || key === 'profileData') && typeof clone[key] === 'object' && clone[key] !== null) {
        const sub = { ...clone[key] };
        Object.keys(sub).forEach(k => {
          if (sensitiveKeys.includes(k)) sub[k] = "********";
        });
        clone[key] = sub;
      }
    });
    
    return clone;
  }

  /**
   * Helper to generate a short request ID
   */
  static generateId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}
