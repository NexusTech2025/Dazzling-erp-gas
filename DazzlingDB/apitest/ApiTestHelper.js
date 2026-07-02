/**
 * @file ApiTestHelper.js
 * Reusable utilities for API testing in the Apps Script environment.
 * 
 * Provides a standardized logging interface and a unified mock dispatcher
 * so that all API tests share the same robust execution environment.
 */

const ApiTestHelper = (function() {
  
  const logger = {
    phase: (msg) => console.log(`\n=========================================\n🚀 PHASE: ${msg}\n=========================================`),
    action: (msg) => console.log(`   ▶️ ${msg}`),
    detail: (msg) => console.log(`      ↳ ${msg}`),
    success: (msg) => console.log(`   ✅ SUCCESS: ${msg}`),
    error: (msg) => console.error(`   ❌ ERROR: ${msg}`),
    data: (label, obj) => console.log(`   📦 ${label}:\n`, JSON.stringify(obj, null, 2))
  };

  /**
   * Simulates a Web Request to the ApiDispatcher.
   * 
   * @param {string} action - The action key (e.g., 'student_register').
   * @param {Object} payload - The request parameters.
   * @param {string} [token=null] - Optional auth token.
   * @returns {Object} The successfully returned data payload.
   * @throws {Error} If the API response indicates failure.
   */
  function callApi(action, payload, token = null) {
    const mockEvent = {
      postData: {
        contents: JSON.stringify({
          action: action,
          token: token,
          payload: payload 
        })
      }
    };
    
    const output = ApiDispatcher.dispatch(mockEvent);
    let response;
    
    if (output.getContent) {
      response = JSON.parse(output.getContent());
    } else {
      response = output;
    }

    if (!response.success) {
      const errMsg = response.error ? response.error.message : 'Unknown Error';
      const details = response.error ? response.error.details : null;
      console.error(`   ❌ API Error: ${action} failed`);
      console.error(`      ↳ Message: ${errMsg}`);
      if (details) {
        console.error(`      ↳ Details:`, JSON.stringify(details, null, 2));
      }
      throw new Error(`[API Error] Action '${action}' failed: ${errMsg}${details ? ' | Details: ' + JSON.stringify(details) : ''}`);
    }
    return response.data;
  }

  /**
   * Formats and prints an object or array of objects as an ASCII table in the console.
   * @param {string} title - The title of the table.
   * @param {Object|Object[]} data - The data payload to format.
   */
  function printTable(title, data) {
    if (!data) {
      console.log(`\n--- ${title}: No Data ---`);
      return;
    }
    const rows = Array.isArray(data) ? data : [data];
    if (rows.length === 0) {
      console.log(`\n--- ${title}: Empty Dataset ---`);
      return;
    }
    // Gather all keys as columns
    const columns = Object.keys(rows[0]);
    // Calculate max widths for each column
    const widths = {};
    columns.forEach(col => {
      widths[col] = col.length;
    });
    rows.forEach(row => {
      columns.forEach(col => {
        const valStr = row[col] !== undefined && row[col] !== null ? String(row[col]) : "";
        if (valStr.length > widths[col]) {
          widths[col] = valStr.length;
        }
      });
    });

    console.log(`\n📊 TABLE: ${title}`);
    const printLine = () => {
      const parts = columns.map(col => "-".repeat(widths[col] + 2));
      console.log("+" + parts.join("+") + "+");
    };

    printLine();
    const headerRow = columns.map(col => ` ${col.padEnd(widths[col])} `).join("|");
    console.log(`|${headerRow}|`);
    printLine();

    rows.forEach(row => {
      const dataRow = columns.map(col => {
        const valStr = row[col] !== undefined && row[col] !== null ? String(row[col]) : "";
        return ` ${valStr.padEnd(widths[col])} `;
      }).join("|");
      console.log(`|${dataRow}|`);
    });
    printLine();
  }

  return {
    logger: logger,
    callApi: callApi,
    printTable: printTable
  };

})();

