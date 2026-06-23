/**
 * @file DeleteManyTestSuite.js
 * Integration & Unit Tests for the deleteMany batch deletion mechanism.
 * Focus: Constant-time In-Memory Overwrite, Shifting Guards, PK Cache syncing, Custom Exceptions.
 * 
 * Run 'runDeleteManyTests' from the Apps Script IDE.
 */

const DeleteManyTestSuite = (function () {
  const TEST_FOLDER_ID = DATABASE_ROOT_FOLDER_ID;

  function runAll() {
    const activeEnv = typeof SYSTEM_ENV !== 'undefined' ? SYSTEM_ENV : Environment.DEVELOPMENT;
    if (resolveEnvironmentType(activeEnv) === Environment.PRODUCTION) {
      throw new Error("❌ Safety Guard: Test suite cannot be executed in the PRODUCTION environment.");
    }

    const schema = getTestSchema();
    console.log(`🚀 Initializing Database for deleteMany Tests...`);
    const db = SheetDB.init(TEST_FOLDER_ID, schema, { allowAutoOverride: true });

    // Provision & Setup
    db.setup.provision();
    _teardown(db);

    const results = {};
    let passed = 0;
    let failed = 0;

    const scenarios = [
      { name: "Scenario 1: Basic Deletion", fn: () => testBasicDeletion(db) },
      { name: "Scenario 2: Partially Missing IDs", fn: () => testPartiallyMissingIds(db) },
      { name: "Scenario 3: Shifting Bug Protection", fn: () => testShiftingBugProtection(db) },
      { name: "Scenario 4: PK Cache De-registration", fn: () => testCacheDeregistration(db) },
      { name: "Scenario 5: Exceptions & Type Validation", fn: () => testExceptionsAndValidation(db) }
    ];

    scenarios.forEach(scenario => {
      try {
        scenario.fn();
        console.log(`✅ PASS: ${scenario.name}`);
        results[scenario.name] = "✅ PASSED";
        passed++;
      } catch (e) {
        console.error(`❌ FAIL: ${scenario.name} -> ${e.message}`);
        if (e.stack) console.error(e.stack);
        results[scenario.name] = `❌ FAILED: ${e.message}`;
        failed++;
      }
    });

    // Teardown
    _teardown(db);

    console.log(`=== DELETE MANY TESTS COMPLETE: ${passed} Passed, ${failed} Failed ===`);
    return results;
  }

  function _teardown(db) {
    const keys = ["DEL-1", "DEL-2", "DEL-3", "DEL-4", "DEL-5", "DEL-MISS"];
    const repo = db.Student;
    if (repo) {
      // Use standard remove for teardown to be safe
      keys.forEach(id => {
        try {
          if (repo.findById(id)) {
            repo.remove(id);
          }
        } catch (e) {}
      });
    }
  }

  // --- SCENARIO IMPLEMENTATIONS ---

  function testBasicDeletion(db) {
    _teardown(db);

    // Seed 3 students
    db.Student.insert({ student_id: "DEL-1", student_name: "Student One", email: "one@test.com", status: "active" });
    db.Student.insert({ student_id: "DEL-2", student_name: "Student Two", email: "two@test.com", status: "active" });
    db.Student.insert({ student_id: "DEL-3", student_name: "Student Three", email: "three@test.com", status: "active" });

    // Perform batch delete
    const deletedCount = db.Student.deleteMany(["DEL-1", "DEL-3"]);
    if (deletedCount !== 2) {
      throw new Error(`Expected deleted count to be 2. Received: ${deletedCount}`);
    }

    // Verify deleted rows physically gone
    if (db.Student.findById("DEL-1") !== null) throw new Error("DEL-1 was not physically deleted.");
    if (db.Student.findById("DEL-3") !== null) throw new Error("DEL-3 was not physically deleted.");
    
    // Verify DEL-2 remains intact
    const remaining = db.Student.findById("DEL-2");
    if (!remaining || remaining.student_name !== "Student Two") {
      throw new Error("DEL-2 was corrupted or deleted during batch delete.");
    }
  }

  function testPartiallyMissingIds(db) {
    _teardown(db);

    // Seed 2 students
    db.Student.insert({ student_id: "DEL-1", student_name: "Student One", email: "one@test.com", status: "active" });
    db.Student.insert({ student_id: "DEL-2", student_name: "Student Two", email: "two@test.com", status: "active" });

    // Attempt delete with one non-existent ID
    const deletedCount = db.Student.deleteMany(["DEL-1", "DEL-MISS", "DEL-2"]);
    if (deletedCount !== 2) {
      throw new Error(`Expected deleted count to be 2 (skipping DEL-MISS). Received: ${deletedCount}`);
    }

    // Verify both exist no longer
    if (db.Student.findById("DEL-1") !== null) throw new Error("DEL-1 was not deleted.");
    if (db.Student.findById("DEL-2") !== null) throw new Error("DEL-2 was not deleted.");
  }

  function testShiftingBugProtection(db) {
    _teardown(db);

    // Seed 5 records to assert precise row-shifting guard
    db.Student.insert({ student_id: "DEL-1", student_name: "Student One", email: "one@test.com" });
    db.Student.insert({ student_id: "DEL-2", student_name: "Student Two", email: "two@test.com" });
    db.Student.insert({ student_id: "DEL-3", student_name: "Student Three", email: "three@test.com" });
    db.Student.insert({ student_id: "DEL-4", student_name: "Student Four", email: "four@test.com" });
    db.Student.insert({ student_id: "DEL-5", student_name: "Student Five", email: "five@test.com" });

    // Delete non-contiguous indices (DEL-2 and DEL-4)
    const deletedCount = db.Student.deleteMany(["DEL-2", "DEL-4"]);
    if (deletedCount !== 2) {
      throw new Error(`Expected 2 deletions. Received: ${deletedCount}`);
    }

    // Confirm that DEL-2 and DEL-4 are gone
    if (db.Student.findById("DEL-2") !== null) throw new Error("DEL-2 was not deleted.");
    if (db.Student.findById("DEL-4") !== null) throw new Error("DEL-4 was not deleted.");

    // Validate that DEL-1, DEL-3, and DEL-5 remain untouched and correct
    const s1 = db.Student.findById("DEL-1");
    const s3 = db.Student.findById("DEL-3");
    const s5 = db.Student.findById("DEL-5");

    if (!s1 || s1.student_name !== "Student One") throw new Error("DEL-1 was corrupted.");
    if (!s3 || s3.student_name !== "Student Three") throw new Error("DEL-3 was corrupted.");
    if (!s5 || s5.student_name !== "Student Five") throw new Error("DEL-5 was corrupted.");
  }

  function testCacheDeregistration(db) {
    _teardown(db);

    // Seed
    db.Student.insert({ student_id: "DEL-1", student_name: "Student One", email: "one@test.com" });
    
    // Warm up the PrimaryKeyCache
    const initialCache = db._pkCache.get("Student");
    if (!initialCache.has("DEL-1")) {
      throw new Error("Pre-requisite failed: DEL-1 should be cached.");
    }

    // Delete
    db.Student.deleteMany(["DEL-1"]);

    // Verify cache has de-registered the ID
    const updatedCache = db._pkCache.get("Student");
    if (updatedCache.has("DEL-1")) {
      throw new Error("PrimaryKeyCache failed to invalidate the deleted ID after deleteMany.");
    }
  }

  function testExceptionsAndValidation(db) {
    // 1. Pass string instead of Array -> should throw BatchDeleteError
    try {
      db.Student.deleteMany("DEL-1");
      throw new Error("Validation failed: Passing a string should have thrown BatchDeleteError.");
    } catch (e) {
      if (!(e instanceof BatchDeleteError)) {
        throw new Error(`Expected error instance of BatchDeleteError. Got: ${e.name}`);
      }
      console.log(`   ✅ Caught expected exception: ${e.message}`);
    }

    // 2. Pass null -> should throw BatchDeleteError
    try {
      db.Student.deleteMany(null);
      throw new Error("Validation failed: Passing null should have thrown BatchDeleteError.");
    } catch (e) {
      if (!(e instanceof BatchDeleteError)) {
        throw new Error(`Expected BatchDeleteError. Got: ${e.name}`);
      }
      console.log(`   ✅ Caught expected exception: ${e.message}`);
    }

    // 3. Pass empty list -> should return 0 without throwing
    const count = db.Student.deleteMany([]);
    if (count !== 0) {
      throw new Error(`Expected 0 returned for empty list. Got: ${count}`);
    }
  }

  function getTestSchema() {
    return {
      "version": "1.0.0",
      "database": "DeleteManyTestDB",
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

  return {
    runAll: runAll
  };
})();

function runDeleteManyTests() {
  DeleteManyTestSuite.runAll();
}
