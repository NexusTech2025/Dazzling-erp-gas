/**
 * @file gateway_date_cast_test.js
 * Node.js test to verify that TableGateway._castValue behaves strictly
 * against empty/invalid date inputs (such as '{}' or empty strings).
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log("🚀 STARTING GATEWAY DATE CAST TEST RUNNER (NODE.JS)...");

// 1. Mock Google Apps Script Globals
global.globalThis = global;
global.isDate = (val) => val instanceof Date && !isNaN(val.getTime());
global.Utilities = {
  getUuid: () => 'mock-uuid-1234'
};

const workspaceRoot = path.resolve(__dirname, '../..'); // e:/NAST/Dazzling/GAS/

function loadSourceFile(relativePath) {
  const filePath = path.join(workspaceRoot, relativePath);
  let code = fs.readFileSync(filePath, 'utf8');
  // Expose top-level classes declared with 'class' to globalThis for Node.js environment compatibility
  code = code.replace(/^class (\w+)/gm, 'globalThis.$1 = class $1');
  global.eval(code);
}

// Load SheetDB files
loadSourceFile('SheetDB/Errors.js');
loadSourceFile('SheetDB/Utils/Utils.js');
loadSourceFile('SheetDB/Utils/DateCmp.js');
loadSourceFile('SheetDB/TableGateway/TableGatway.js');

// Mock SheetDB namespace
global.SheetDB = {
  DateComparator: globalThis.DateComparator,
  DateComparisonPolicy: globalThis.DateComparisonPolicy
};

// 2. Perform Unit Tests on TableGateway.prototype._castValue
const castValue = TableGateway.prototype._castValue;

// Test A: Null, undefined, and empty string should return null
console.log("--- Testing Null/Empty inputs ---");
assert.strictEqual(castValue(null, "date"), null, "null date value should return null");
assert.strictEqual(castValue(undefined, "date"), null, "undefined date value should return null");
assert.strictEqual(castValue("", "date"), null, "empty string date value should return null");
console.log("✅ Passed: Null/empty inputs return null correctly.");

// Test B: Valid date string should parse to local Date at midnight
console.log("--- Testing Valid date string ---");
const validDate = castValue("2026-07-15", "date");
assert.ok(validDate instanceof Date, "Parsed value must be a Date instance");
assert.strictEqual(validDate.getFullYear(), 2026, "Year should be 2026");
assert.strictEqual(validDate.getMonth(), 6, "Month should be 6 (July)");
assert.strictEqual(validDate.getDate(), 15, "Date should be 15");
assert.strictEqual(validDate.getHours(), 0, "Hours should be 0");
assert.strictEqual(validDate.getMinutes(), 0, "Minutes should be 0");
assert.strictEqual(validDate.getSeconds(), 0, "Seconds should be 0");
console.log("✅ Passed: Valid date parses timezone-safely.");

// Test C: Unparseable '{}' and empty object should return null
console.log("--- Testing '{}' and empty object inputs ---");
assert.strictEqual(castValue("{}", "date"), null, "stringified empty object '{}' should return null");
assert.strictEqual(castValue({}, "date"), null, "actual empty object should return null");
console.log("✅ Passed: '{}' and empty object inputs return null correctly.");

// Test D: Invalid string should throw DateTimeError
console.log("--- Testing invalid-date-string input ---");
assert.throws(() => {
  castValue("invalid-date-string", "date");
}, /DateTimeError/, "Expected invalid-date-string to throw DateTimeError");
console.log("✅ Assertion Passed: TableGateway threw DateTimeError for invalid input.");

console.log("\n🎉 ALL GATEWAY DATE CAST TESTS COMPLETED SUCCESSFULLY!");
