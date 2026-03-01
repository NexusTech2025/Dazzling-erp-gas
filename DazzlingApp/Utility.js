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



