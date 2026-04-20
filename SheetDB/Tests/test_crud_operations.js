/**
 * @file test_crud_operations.js
 * Integration tests for the Data Manipulation Layer (CRUD) with manual pauses.
 */

const CRUD_TEST_FOLDER_ID = "1aw3neGzRDRzSqQNOe_kjqUS7MDsIEU7G";

/**
 * Main Runner for CRUD Tests
 */
function runAllCrudTests() {
  const schema = getTestSchema();
  
  console.log("🚀 Initializing SheetDB for CRUD Tests...");
  const db = SheetDB.init(CRUD_TEST_FOLDER_ID, schema);

  // 0. Provisioning
  console.log("--- Step 0: Provisioning Structure ---");
  db.setup.provision();
  console.log("✅ Structure is ready.");

  const testId = "STU-TEST-999";

  try {
    // 1. ADD
    testAddEntry(db, testId);
    pause(`SCENARIO 1 COMPLETE: Student '${testId}' has been added.\n\nPlease check the 'Students' spreadsheet to verify the row exists.`);

    // 2. UPDATE
    testUpdateEntry(db, testId);
    pause(`SCENARIO 2 COMPLETE: Student email has been updated.\n\nPlease check the sheet to verify the email change.`);

    // 3. DELETE
    testDeleteEntry(db, testId);
    console.log("\n✅ ALL CRUD SCENARIOS PASSED!");

  } catch (e) {
    console.error("\n❌ CRUD TEST FAILED: " + e.message);
  }
}

/**
 * Helper to pause execution and wait for user confirmation.
 */
function pause(message) {
  console.log("\n⏸️ TEST PAUSED: " + message);
  try {
    // Attempt Browser-based pause (Works in Container-bound or active sheet context)
    const response = Browser.msgBox("SheetDB Test Runner", message + "\n\nClick OK to continue, or Cancel to stop.", Browser.Buttons.OK_CANCEL);
    if (response === 'cancel') throw new Error("Test Execution Aborted by User.");
  } catch (e) {
    console.warn("⚠️ UI Pause unavailable in this context. Sleeping for 5 seconds to allow manual check...");
    Utilities.sleep(5000); 
  }
}

/**
 * SCENARIO 1: Adding a new entry
 */
function testAddEntry(db, id) {
  console.log("\n--- Testing: ADD ENTRY ---");
  
  const student = db.Student.insert({
    student_id: id,
    student_name: "Moni Test User",
    email: "test@example.com",
    status: "active"
  });

  console.log(`✅ Success: Student added at row ${student.__rowNumber}.`);
}

/**
 * SCENARIO 2: Updating an existing entry
 */
function testUpdateEntry(db, id) {
  console.log("\n--- Testing: UPDATE ENTRY ---");
  
  const student = db.Student.findById(id);
  const newEmail = "updated_" + Math.floor(Math.random() * 1000) + "@example.com";
  
  student.email = newEmail;
  student.save();

  const updatedStudent = db.Student.findById(id);
  if (updatedStudent.email !== newEmail) {
    throw new Error("Update Verification Failed.");
  }

  console.log(`✅ Success: Student email updated to '${newEmail}'.`);
}

/**
 * SCENARIO 3: Deleting an entry
 */
function testDeleteEntry(db, id) {
  console.log("\n--- Testing: DELETE ENTRY ---");
  
  const student = db.Student.findById(id);
  student.delete();

  const deletedCheck = db.Student.findById(id);
  if (deletedCheck !== null) {
    throw new Error("Delete Verification Failed.");
  }

  console.log(`✅ Success: Student '${id}' removed.`);
}

/**
 * Simple schema for the CRUD tests
 */
function getTestSchema() {
  return {
    "version": "1.0.0",
    "database": "CrudTestDB",
    "categories": {
      "Students": {
        "tables": {
          "Student": {
            "primaryKey": "student_id",
            "columns": {
              "student_id": { "type": "string" },
              "student_name": { "type": "string" },
              "email": { "type": "string" },
              "status": { "type": "string" }
            }
          }
        }
      }
    }
  };
}
