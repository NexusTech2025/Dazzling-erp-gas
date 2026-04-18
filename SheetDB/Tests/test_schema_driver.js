/**
 * @file test_schema_driver.js
 * Integration tests for the SchemaDriver lifecycle.
 */

function runSchemaDriverTests() {
  const rootFolderId = "REPLACE_WITH_YOUR_TEST_FOLDER_ID"; // IMPORTANT: Use a dedicated test folder
  
  const testSchema = {
    "version": "1.0.0",
    "database": "TestDB",
    "categories": {
      "TestCategory": {
        "tables": {
          "TestTable": {
            "primaryKey": "id",
            "columns": {
              "id": { "type": "string", "description": "Primary Key" },
              "name": { "type": "string", "description": "Test Name" },
              "created_at": { "type": "datetime", "description": "Timestamp" }
            }
          }
        }
      }
    }
  };

  console.log("🚀 Starting SchemaDriver Integration Tests...");

  try {
    // 1. Test Inspection (Snapshot)
    console.log("\n--- Testing Stage 1: INSPECT ---");
    const snapshot = inspectSchema(rootFolderId, testSchema);
    console.log("Snapshot captured successfully.");
    console.log("Physical State: " + JSON.stringify(snapshot, null, 2));

    // 2. Test Preview (Planning)
    console.log("\n--- Testing Stage 2: PREVIEW ---");
    const plan = previewSchema(rootFolderId, testSchema);
    console.log("Plan generated successfully.");
    console.log("Plan Summary: " + JSON.stringify(plan.summary, null, 2));
    
    if (plan.operations.length > 0) {
      console.log("Planned Operations: " + plan.operations.map(op => op.type).join(", "));
    } else {
      console.log("ℹ️ No operations planned (Environment already matches schema).");
    }

    // 3. Test Provisioning (Execution)
    console.log("\n--- Testing Stage 3: PROVISION ---");
    const result = provisionSchemaSafe(rootFolderId, testSchema);
    console.log("Provisioning result: " + JSON.stringify(result, null, 2));

    if (result.isChanged) {
      console.log("✅ Success: Changes were applied.");
    } else {
      console.log("ℹ️ Success: No changes were needed.");
    }

    // 4. Test Idempotency (Run again, should be no changes)
    console.log("\n--- Testing Stage 4: IDEMPOTENCY ---");
    const secondResult = provisionSchemaSafe(rootFolderId, testSchema);
    if (!secondResult.isChanged) {
      console.log("✅ Success: System is idempotent (Second run made no changes).");
    } else {
      console.error("❌ Failure: System is not idempotent. It attempted changes on the second run.");
    }

  } catch (e) {
    console.error("❌ Test Suite Failed: " + e.message);
    if (e.stack) console.error(e.stack);
  }
}

/**
 * Utility to test FORCE mode (Destructive update)
 * WARNING: This will rename existing sheets to backups.
 */
function testForceModeUpdate() {
  const rootFolderId = "REPLACE_WITH_YOUR_TEST_FOLDER_ID";
  const schema = {
    "version": "1.1.0", // Increment version
    "categories": {
      "TestCategory": {
        "tables": {
          "TestTable": {
            "primaryKey": "id",
            "columns": {
              "id": { "type": "string" },
              "new_column": { "type": "string" } // Change structure
            }
          }
        }
      }
    }
  };

  console.log("🔥 Starting Force Mode Test...");
  const result = provisionSchemaForce(rootFolderId, schema);
  console.log("Result: " + JSON.stringify(result, null, 2));
}
