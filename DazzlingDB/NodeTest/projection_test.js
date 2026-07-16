/**
 * @file projection_test.js
 * Node.js test to verify that ProjectionEngine.project correctly processes and formats
 * Date objects depending on the field type metadata ('date' vs. 'datetime').
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log("🚀 STARTING PROJECTION ENGINE TEST RUNNER (NODE.JS)...");

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
  if (relativePath.includes('ProjectionEngine.js')) {
    code = code.replace('const ProjectionEngine =', 'global.ProjectionEngine =');
  }
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

// Mock SheetDB global object
global.SheetDB = {
  DateComparator: globalThis.DateComparator,
  DateComparisonPolicy: globalThis.DateComparisonPolicy
};

// Load ProjectionEngine
loadSourceFile('DazzlingDB/QueryEngine/ProjectionEngine.js');

// 2. Define a Dummy Model with date and datetime fields
class DummyModel extends BaseModel {}
DummyModel.schema = {
  id: new AutoField({ name: "id", prefix: "DMY" }),
  name: new CharField({ name: "name" }),
  only_date: new DateTimeField({ name: "only_date", type: "date" }),
  full_datetime: new DateTimeField({ name: "full_datetime", type: "datetime" })
};

// 3. Run Test cases
try {
  console.log("\n--- Running ProjectionEngine.project check ---");

  // Create a local midnight Date representing 2026-07-15
  const testDate = new Date(2026, 6, 15); // July 15 (0-indexed month)
  
  // Create instances
  const record1 = new DummyModel({
    id: "DMY-001",
    name: "Projection test 1",
    only_date: testDate,
    full_datetime: testDate
  });

  const record2 = new DummyModel({
    id: "DMY-002",
    name: "Projection test 2",
    only_date: testDate,
    full_datetime: testDate
  });

  // Project the records
  const projected = ProjectionEngine.project([record1, record2]);
  console.log("Projected payload:", JSON.stringify(projected, null, 2));

  // Assertions
  assert.strictEqual(projected.length, 2, "Should return 2 projected rows");
  
  projected.forEach((row, index) => {
    // only_date must match YYYY-MM-DD local representation: "2026-07-15"
    assert.strictEqual(row.only_date, "2026-07-15", `Row ${index + 1}: only_date field should be formatted to '2026-07-15', got: ${row.only_date}`);
    
    // full_datetime must match ISO representation
    assert.strictEqual(row.full_datetime, testDate.toISOString(), `Row ${index + 1}: full_datetime field should be ISO string, got: ${row.full_datetime}`);
  });

  console.log("✅ All ProjectionEngine date projection assertions passed successfully.");

  // Test case 2: Projection with explicit select columns
  console.log("\n--- Running ProjectionEngine.project select filter check ---");
  const selectedProjected = ProjectionEngine.project([record1], ["id", "only_date"]);
  console.log("Selected projected payload:", JSON.stringify(selectedProjected, null, 2));

  assert.strictEqual(selectedProjected.length, 1, "Should return 1 selected row");
  const selectedRow = selectedProjected[0];
  assert.strictEqual(Object.keys(selectedRow).length, 2, "Should contain exactly 2 fields (id and only_date)");
  assert.ok(selectedRow.id && selectedRow.only_date, "Should contain selected properties");
  assert.strictEqual(selectedRow.only_date, "2026-07-15", "only_date in select projection should match '2026-07-15'");
  assert.strictEqual(selectedRow.name, undefined, "Non-selected property 'name' should be omitted");

  console.log("✅ All select column projection assertions passed successfully.");

  console.log("\n🎉 ALL PROJECTION TESTS PASSED SUCCESSFULLY! 🎉\n");
} catch (error) {
  console.error("❌ Test assertion failed:", error.message);
  process.exit(1);
}
