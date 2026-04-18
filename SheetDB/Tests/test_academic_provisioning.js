/**
 * @file test_academic_provisioning.js
 * Comprehensive integration tests for the Academic category provisioning.
 * 
 * Scenarios covered:
 * 1. Fresh Provisioning
 * 2. Idempotency
 * 3. Incremental Update (Append)
 * 4. Drift Recovery (Missing Header)
 * 5. Data Corruption Guard (Error Op)
 * 6. Force Mode (Backup & Recreate)
 * 7. Category Isolation
 */

// GLOBAL CONFIGURATION
const TEST_ROOT_FOLDER_ID = "REPLACE_WITH_YOUR_TEST_FOLDER_ID";

/**
 * Main Test Runner
 */
function runAcademicProvisioningTests() {
  const schema = getAcademicSchema();
  
  console.log("📂 Root Folder ID: " + TEST_ROOT_FOLDER_ID);
  console.log("🚀 Starting Academic Provisioning Test Suite...");

  try {
    // SCENARIO 1: Fresh Provisioning
    testFreshProvisioning(schema);

    // SCENARIO 2: Idempotency
    testIdempotency(schema);

    // SCENARIO 3: Incremental Update (Append)
    testIncrementalUpdate(schema);

    // SCENARIO 4: Drift Recovery (Missing Header)
    testDriftRecovery(schema);

    // SCENARIO 5: Data Corruption Guard
    testDataCorruptionGuard(schema);

    // SCENARIO 6: Force Mode (Backup & Recreate)
    testForceMode(schema);

    // SCENARIO 7: Category Isolation
    testCategoryIsolation(schema);

    console.log("\n✅ ALL TEST SCENARIOS COMPLETED SUCCESSFULLY!");

  } catch (e) {
    console.error("\n❌ TEST SUITE FAILED: " + e.message);
    if (e.stack) console.error(e.stack);
  }
}

// ==========================================
// 🧪 SCENARIO IMPLEMENTATIONS
// ==========================================

function testFreshProvisioning(schema) {
  console.log("\n--- Scenario 1: Fresh Provisioning ---");
  
  const plan = previewSchema(TEST_ROOT_FOLDER_ID, schema);
  logPlanWithCheckboxes(plan);

  const result = provisionSchemaSafe(TEST_ROOT_FOLDER_ID, schema);
  logExecutionResult(result);

  assert(result.createdFiles.includes("Academic"), "Should create Academic spreadsheet");
  assert(result.createdSheets.length >= 7, "Should create at least 7 tables");
  console.log("Success: Academic ecosystem built from scratch.");
}

function testIdempotency(schema) {
  console.log("\n--- Scenario 2: Idempotency ---");
  
  const plan = previewSchema(TEST_ROOT_FOLDER_ID, schema);
  logPlanWithCheckboxes(plan);

  const result = provisionSchemaSafe(TEST_ROOT_FOLDER_ID, schema);
  logExecutionResult(result);

  assert(result.isChanged === false, "Second run should make no changes");
  console.log("Success: Engine is idempotent.");
}

function testIncrementalUpdate(schema) {
  console.log("\n--- Scenario 3: Incremental Update (Append) ---");
  // Modify schema locally to add a new column
  const modifiedSchema = JSON.parse(JSON.stringify(schema));
  modifiedSchema.categories.Academic.tables.Course.columns["test_tag"] = { type: "string", description: "Internal Test Tag" };
  
  const plan = previewSchema(TEST_ROOT_FOLDER_ID, modifiedSchema);
  logPlanWithCheckboxes(plan);

  const result = provisionSchemaSafe(TEST_ROOT_FOLDER_ID, modifiedSchema);
  logExecutionResult(result);

  assert(result.updatedHeaders.some(h => h.includes("Course")), "Should update Course headers");
  console.log("Success: New column appended safely.");
}

function testDriftRecovery(schema) {
  console.log("\n--- Scenario 4: Drift Recovery (Restore Missing Header) ---");
  // Manually mess with the sheet (Simulate user error)
  const fs = createFileSystem(TEST_ROOT_FOLDER_ID);
  const fileMeta = fs.findByName("Academic");
  const ss = fs.open(fileMeta.id);
  const sheet = ss.getSheetByName("Course");
  
  // Clear the first few headers
  sheet.getRange(1, 1, 1, 2).clearContent(); 
  
  const plan = previewSchema(TEST_ROOT_FOLDER_ID, schema);
  logPlanWithCheckboxes(plan);

  const result = provisionSchemaSafe(TEST_ROOT_FOLDER_ID, schema);
  logExecutionResult(result);

  assert(result.updatedHeaders.some(h => h.includes("Course")), "Should detect drift and restore headers");
  console.log("Success: Missing headers recovered.");
}

function testDataCorruptionGuard(schema) {
  console.log("\n--- Scenario 5: Data Corruption Guard ---");
  const fs = createFileSystem(TEST_ROOT_FOLDER_ID);
  const fileMeta = fs.findByName("Academic");
  const ss = fs.open(fileMeta.id);
  const sheet = ss.getSheetByName("Course");
  
  // DESTRUCTIVE ACTION: Remove Row 1 but add Row 2 data
  sheet.deleteRow(1);
  sheet.getRange(1, 1).setValue("Orphaned Data (No Header)"); 
  
  const plan = previewSchema(TEST_ROOT_FOLDER_ID, schema);
  logPlanWithCheckboxes(plan);

  const hasCorruptionError = plan.operations.some(op => op.type === 'ERROR' && op.payload.message.includes("CORRUPTION"));
  
  assert(hasCorruptionError, "Should detect data corruption risk");
  console.log("Success: Shield triggered. Execution blocked as expected.");
  
  // CLEANUP: Reset sheet for next test
  ss.deleteSheet(sheet);
  ss.insertSheet("Course"); // Just recreate empty
}

function testForceMode(schema) {
  console.log("\n--- Scenario 6: Force Mode (Backup & Recreate) ---");
  
  const plan = previewSchema(TEST_ROOT_FOLDER_ID, schema);
  logPlanWithCheckboxes(plan);

  const result = provisionSchemaForce(TEST_ROOT_FOLDER_ID, schema);
  logExecutionResult(result);

  assert(result.updatedHeaders.some(h => h.includes("Recreated")), "Result should indicate Recreated");
  
  const fs = createFileSystem(TEST_ROOT_FOLDER_ID);
  const fileMeta = fs.findByName("Academic");
  const ss = fs.open(fileMeta.id);
  const backupSheet = ss.getSheets().find(s => s.getName().includes("Course_backup"));
  
  assert(!!backupSheet, "Backup sheet should exist in the spreadsheet");
  console.log("Success: Old sheet preserved as backup: " + backupSheet.getName());
}

function testCategoryIsolation(schema) {
  console.log("\n--- Scenario 7: Category Isolation ---");
  // Create a separate schema that ONLY has Finance
  const financeOnlySchema = {
    version: "1.0.0",
    categories: {
      Finance: {
        tables: {
          PromoCode: {
            primaryKey: "promo_id",
            columns: { "promo_id": { type: "string" }, "code": { type: "string" } }
          }
        }
      }
    }
  };
  
  const plan = previewSchema(TEST_ROOT_FOLDER_ID, financeOnlySchema);
  logPlanWithCheckboxes(plan);

  const affectsAcademic = plan.operations.some(op => op.target.category === "Academic");
  
  assert(!affectsAcademic, "Finance setup should not affect Academic category");
  console.log("Success: Categories are isolated.");
}

// ==========================================
// 📊 LOGGING HELPERS
// ==========================================

/**
 * Visualizes the Execution Plan
 */
function logPlanWithCheckboxes(plan) {
  console.log("\n📝 [EXECUTION PLAN]");
  
  if (plan.operations.length === 0) {
    console.log("  ✅ Everything matches. No operations required.");
    return;
  }

  plan.operations.forEach(op => {
    const icon = op.type === 'ERROR' ? '❌' : '⬜';
    const target = op.target.table !== 'N/A' ? `${op.target.category}.${op.target.table}` : op.target.category;
    console.log(`  ${icon} ${op.type}: [${target}] - ${op.meta.reason || op.payload.message || ''}`);
  });

  console.log(`\n  Summary: ${plan.summary.createFile} Files, ${plan.summary.createSheet} Sheets, ${plan.summary.ensureHeader} Headers, ${plan.summary.errors} Errors.`);
}

/**
 * Visualizes the Execution Result
 */
function logExecutionResult(result) {
  console.log("\n🏁 [EXECUTION RESULT]");
  
  if (!result.isChanged && result.errors.length === 0) {
    console.log("  ✅ Completed: No changes made.");
    return;
  }

  if (result.createdFiles.length > 0) result.createdFiles.forEach(f => console.log(`  ✅ Created File: ${f}`));
  if (result.createdSheets.length > 0) result.createdSheets.forEach(s => console.log(`  ✅ Created Sheet: ${s}`));
  if (result.updatedHeaders.length > 0) result.updatedHeaders.forEach(h => console.log(`  ✅ Updated Header: ${h}`));
  if (result.metaUpdated.length > 0) result.metaUpdated.forEach(m => console.log(`  ✅ Updated Meta: ${m}`));
  
  if (result.errors.length > 0) {
    result.errors.forEach(e => console.log(`  ❌ ERROR: ${e}`));
  }

  console.log(result.isChanged ? "  🚀 SUCCESS: Database state updated." : "  ℹ️ FINISHED: No structural changes applied.");
}

// ==========================================
// 🛠️ HELPERS
// ==========================================

function assert(condition, message) {
  if (!condition) throw new Error("Assertion Failed: " + message);
}

function getAcademicSchema() {
  return {
    "version": "1.0.0",
    "database": "DazzlingDB",
    "categories": {
      "Academic": {
        "description": "Curriculum, offerings, and institutional structure",
        "tables": {
          "Course": {
            "primaryKey": "course_id",
            "columns": {
              "course_id": { "type": "string" },
              "segment_id": { "type": "string" },
              "entity_type": { "type": "enum" },
              "name": { "type": "string" },
              "short_code": { "type": "string" },
              "language_medium": { "type": "enum" },
              "description": { "type": "string" },
              "duration_value": { "type": "number" },
              "duration_unit": { "type": "enum" },
              "base_fee": { "type": "number" },
              "default_installment_count": { "type": "number" },
              "status": { "type": "enum" },
              "metadata": { "type": "json" }
            }
          },
          "CourseType": {
            "primaryKey": "segment_id",
            "columns": {
              "segment_id": { "type": "string" },
              "segment_name": { "type": "string" },
              "entity_label": { "type": "string" },
              "description": { "type": "string" },
              "status": { "type": "enum" }
            }
          },
          "Package": {
            "primaryKey": "package_id",
            "columns": {
              "package_id": { "type": "string" },
              "name": { "type": "string" },
              "description": { "type": "string" },
              "target_class": { "type": "string" },
              "board": { "type": "string" },
              "month": { "type": "number" },
              "package_fee": { "type": "number" },
              "discount_percent": { "type": "number" },
              "status": { "type": "enum" }
            }
          },
          "PackageCourse": {
            "primaryKey": "package_course_id",
            "columns": {
              "package_course_id": { "type": "string" },
              "package_id": { "type": "string" },
              "course_id": { "type": "string" }
            }
          },
          "PackagePerk": {
            "primaryKey": "perk_id",
            "columns": {
              "perk_id": { "type": "string" },
              "package_id": { "type": "string" },
              "perk_title": { "type": "string" },
              "perk_description": { "type": "string" },
              "icon": { "type": "string" },
              "display_order": { "type": "number" }
            }
          },
          "Batch": {
            "primaryKey": "batch_id",
            "columns": {
              "batch_id": { "type": "string" },
              "item_id": { "type": "string" },
              "teacher_id": { "type": "string" },
              "branch_id": { "type": "string" },
              "batch_name": { "type": "string" },
              "start_date": { "type": "date" },
              "end_date": { "type": "date" },
              "capacity": { "type": "number" },
              "status": { "type": "enum" },
              "schedule": { "type": "json" }
            }
          },
          "Branch": {
            "primaryKey": "branch_id",
            "columns": {
              "branch_id": { "type": "string" },
              "branch_name": { "type": "string" },
              "location": { "type": "string" },
              "status": { "type": "enum" }
            }
          }
        }
      }
    }
  };
}
