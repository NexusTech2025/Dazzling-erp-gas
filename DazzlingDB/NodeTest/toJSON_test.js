/**
 * @file toJSON_test.js
 * Node.js test to verify that BaseModel.toJSON() handles serialization of Date objects
 * timezone-safely based on field types (date vs. datetime).
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log("🚀 STARTING BASEMODEL TOJSON TEST RUNNER (NODE.JS)...");

// 1. Mock Google Apps Script Globals
global.globalThis = global;
global.isDate = (val) => val instanceof Date && !isNaN(val.getTime());
global.Utilities = {
  getUuid: () => 'mock-uuid-1234'
};

const workspaceRoot = path.resolve(__dirname, '../..'); // e:/NAST/Dazzling/GAS/

function loadSourceFile(relativePath) {
  const filePath = path.join(workspaceRoot, relativePath);
  const code = fs.readFileSync(filePath, 'utf8');
  global.eval(code);
}

// Load SheetDB core libraries
loadSourceFile('SheetDB/Errors.js');
loadSourceFile('SheetDB/Utils/Utils.js');
loadSourceFile('SheetDB/Utils/DateCmp.js');
loadSourceFile('SheetDB/Validation/ValidationPipeline.js');
loadSourceFile('SheetDB/Validation/ValidationRules.js');
loadSourceFile('SheetDB/ORM/Fields.js');
loadSourceFile('SheetDB/ORM/BaseModel.js');
loadSourceFile('SheetDB/TableGateway/TableGatway.js');

// Mock SheetDB global object
global.SheetDB = {
  DateComparator: globalThis.DateComparator,
  DateComparisonPolicy: globalThis.DateComparisonPolicy
};

// 2. Define a Test Model with date and datetime fields
class TestModel extends BaseModel { }
TestModel.schema = {
  id: new AutoField({ name: "id", prefix: "TST" }),
  name: new CharField({ name: "name" }),
  // Field type: 'date'
  only_date: new DateTimeField({ name: "only_date", type: "date" }),
  // Field type: 'datetime'
  full_datetime: new DateTimeField({ name: "full_datetime", type: "datetime" })
};

// 3. Run Test cases
try {
  console.log("\n--- Running toJSON serialization checks ---");

  // Create a local midnight Date representing 2026-07-15
  const testDate = new Date("2026-07-15 00:00:00"); // July 15 (0-indexed month)

  // Create model instance
  const instance = new TestModel({
    id: "TST-001",
    name: "Model serialization test",
    only_date: testDate,
    full_datetime: testDate
  });

  // Serialize to JSON
  const serialized = instance.toJSON();
  console.log("Serialized payload:", JSON.stringify(serialized, null, 2));

  // Assertions
  // only_date must match YYYY-MM-DD local representation: "2026-07-15"
  assert.strictEqual(serialized.only_date, "2026-07-15", `only_date field should be serialized to '2026-07-15', got: ${serialized.only_date}`);
  console.log("✅ Assertion Passed: only_date serialized correctly as local 'YYYY-MM-DD'.");

  // full_datetime must match ISO representation
  assert.strictEqual(serialized.full_datetime, testDate.toISOString(), `full_datetime field should be serialized to ISO string, got: ${serialized.full_datetime}`);
  console.log("✅ Assertion Passed: full_datetime serialized correctly to ISO string.");

  // 4. Test TableGateway._castValue parsing
  console.log("\n--- Running TableGateway._castValue parsing checks ---");
  const castDate = TableGateway.prototype._castValue("2026-07-15 15:30:00", "date");
  // The 'date' cast must truncate the time component to local midnight:
  assert.strictEqual(castDate.getFullYear(), 2026);
  assert.strictEqual(castDate.getMonth(), 6);
  assert.strictEqual(castDate.getDate(), 15);
  assert.strictEqual(castDate.getHours(), 0);
  assert.strictEqual(castDate.getMinutes(), 0);
  assert.strictEqual(castDate.getSeconds(), 0);
  console.log("✅ Assertion Passed: TableGateway successfully truncated 'date' to midnight.");

  const castDatetime = TableGateway.prototype._castValue("2026-07-15 15:30:00", "datetime");
  // The 'datetime' cast must preserve the time component:
  assert.strictEqual(castDatetime.getFullYear(), 2026);
  assert.strictEqual(castDatetime.getMonth(), 6);
  assert.strictEqual(castDatetime.getDate(), 15);
  assert.strictEqual(castDatetime.getHours(), 15);
  assert.strictEqual(castDatetime.getMinutes(), 30);
  assert.strictEqual(castDatetime.getSeconds(), 0);
  console.log("✅ Assertion Passed: TableGateway successfully preserved 'datetime' time components.");

  // Test invalid date formatting failure propagation
  console.log("\n--- Running TableGateway._castValue strict error propagation check ---");
  assert.throws(() => {
    TableGateway.prototype._castValue("invalid-date-string", "date");
  }, /DateTimeError/, "Expected invalid-date-string to throw DateTimeError");
  console.log("✅ Assertion Passed: TableGateway threw DateTimeError for invalid input.");

  console.log("\n🎉 ALL TOJSON & GATEWAY CASTING TESTS PASSED SUCCESSFULLY! 🎉\n");
} catch (error) {
  console.error("❌ Test assertion failed:", error.message);
  process.exit(1);
}
