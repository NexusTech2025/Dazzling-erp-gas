/**
 * @file RelationTestSuite.js
 * Integration tests for the Relational Resolver.
 * Focus: Student -> Address (1:1) and Student -> Enrollments (1:N)
 *
 * Run 'runRelationTests' from the Apps Script IDE.
 */

const RelationTestSuite = (function () {
  const REL_TEST_FOLDER_ID = DATABASE_ROOT_FOLDER_ID;

  function runAll_RelationalTest() {
    // Safety guard to prevent running on production
    const activeEnv = typeof SYSTEM_ENV !== 'undefined' ? SYSTEM_ENV : Environment.DEVELOPMENT;
    if (resolveEnvironmentType(activeEnv) === Environment.PRODUCTION) {
      throw new Error("❌ Safety Guard: Relational tests cannot be executed in the PRODUCTION environment.");
    }

    const schema = getProductionStudentSchema();
    console.log(`🚀 Initializing SheetDB for Relational Tests (Env: ${activeEnv.toUpperCase()})...`);
    const db = SheetDB.init(REL_TEST_FOLDER_ID, schema, { allowAutoOverride: true });

    // 0. Provision & Pre-cleanup
    db.setup.provision();
    _teardown(db);

    const testSid = "STU-REL-101";
    const results = {};
    let passed = 0;
    let failed = 0;

    const scenarios = [
      { name: "Scenario 0: Seed Data", fn: () => seedRelationalData(db, testSid) },
      { name: "Scenario 1: 1:1 Relation (Student -> Address)", fn: () => testOneToOneRelation(db, testSid) },
      { name: "Scenario 2: 1:N Relation (Student -> Enrollments)", fn: () => testOneToManyRelation(db, testSid) },
      { name: "Scenario 3: Reverse Relation (Enrollment -> Student)", fn: () => testReverseRelation(db, testSid) },
      { name: "Scenario 4: Nested Insert (insertOne)", fn: () => testNestedInsertOne(db) }
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

    // Post-cleanup to restore clean state
    _teardown(db);

    console.log(`=== TESTS COMPLETE: ${passed} Passed, ${failed} Failed ===`);
    return results;
  }

  /**
   * Safe teardown / cleanup of all test records
   */
  function _teardown(db) {
    console.log("   🧹 Performing teardown/cleanup of test records...");
    const keysToDelete = {
      Student: ["STU-REL-101", "STU-NESTED-999"],
      Address: ["ADDR-101", "ADDR-NESTED-999"],
      Enrollment: ["ENR-001", "ENR-002", "ENR-NESTED-1", "ENR-NESTED-2"]
    };

    Object.entries(keysToDelete).forEach(([tableName, ids]) => {
      const repo = db[tableName];
      if (repo) {
        ids.forEach(id => {
          try {
            const record = repo.findById(id);
            if (record) {
              record.delete();
              console.log(`      Removed ${tableName} record: ${id}`);
            }
          } catch (e) {
            // Ignore if record already deleted or not found
          }
        });
      }
    });
  }

  /**
   * Verify MongoDB style nested insertion
   */
  function testNestedInsertOne(db) {
    console.log("\n--- Scenario 4: NESTED INSERT (insertOne) ---");
    
    const sid = "STU-NESTED-999";

    const payload = {
      student_id: sid,
      student_name: "Nested Moni",
      status: "active",
      address: {
        address_id: "ADDR-NESTED-999",
        city: "San Francisco",
        state: "CA",
        pin_code: "94105"
      },
      enrollment: [
        { enrollment_id: "ENR-NESTED-1", item_id: "COURSE-X", status: "active" },
        { enrollment_id: "ENR-NESTED-2", item_id: "COURSE-Y", status: "active" }
      ]
    };

    // Perform the complex insert
    console.log("Action: Executing db.Student.insertOne(payload)...");
    const student = db.Student.insertOne(payload);

    // Verification 1: Parent check
    if (student.student_name !== "Nested Moni") throw new Error("Parent insert failed.");

    // Verification 2: Child (1:1) check
    const addr = student.address();
    if (!addr || addr.city !== "San Francisco") throw new Error("Nested Address insert/link failed.");

    // Verification 3: Child (1:N) check
    const enrollments = student.enrollment();
    if (!Array.isArray(enrollments) || enrollments.length !== 2) {
      throw new Error(`Nested Enrollment failed: Expected 2, found ${enrollments ? enrollments.length : 0}`);
    }

    console.log(`✅ Success: Nested document saved and linked automatically. Student, Address, and ${enrollments.length} Enrollments are verified.`);
  }

  /**
   * Creates the necessary records for testing.
   */
  function seedRelationalData(db, sid) {
    console.log("\n--- Scenario 0: SEEDING DATA ---");
    
    // Create Student
    db.Student.insert({ student_id: sid, student_name: "Relation Tester", status: "active" });

    // Create Address linked to Student
    db.Address.insert({ address_id: "ADDR-101", student_id: sid, city: "Metropolis", state: "NY", pin_code: "10001" });

    // Create 2 Enrollments linked to Student
    db.Enrollment.insert({ enrollment_id: "ENR-001", student_id: sid, item_id: "COURSE-A", status: "active" });
    db.Enrollment.insert({ enrollment_id: "ENR-002", student_id: sid, item_id: "COURSE-B", status: "active" });

    console.log("✅ Data seeded successfully.");
  }

  /**
   * Verify 1:1 lookup (Student.address)
   */
  function testOneToOneRelation(db, sid) {
    console.log("\n--- Scenario 1: 1:1 RELATION (Student -> Address) ---");
    
    const student = db.Student.findById(sid);
    
    // Test Auto-Injection
    console.log("Testing Auto-Injected method: student.address()...");
    const address = student.address(); 

    if (!address || address.city !== "Metropolis") {
      throw new Error("1:1 Relation failed: Address not found or data mismatch.");
    }
    
    console.log(`✅ Success: Found address in ${address.city} via relation.`);
  }

  /**
   * Verify 1:N lookup (Student.enrollments)
   */
  function testOneToManyRelation(db, sid) {
    console.log("\n--- Scenario 2: 1:N RELATION (Student -> Enrollments) ---");
    
    const student = db.Student.findById(sid);
    
    // Test Auto-Injection
    console.log("Testing Auto-Injected method: student.enrollment()...");
    const enrollments = student.enrollment(); // Key from your schema relations block

    if (!Array.isArray(enrollments) || enrollments.length !== 2) {
      throw new Error(`1:N Relation failed: Expected 2 enrollments, found ${enrollments ? enrollments.length : 0}`);
    }
    
    console.log(`✅ Success: Found ${enrollments.length} enrollments via relation.`);
  }

  /**
   * Verify reverse lookup (Enrollment.student)
   */
  function testReverseRelation(db, sid) {
    console.log("\n--- Scenario 3: REVERSE RELATION (Enrollment -> Student) ---");
    
    const enrollment = db.Enrollment.findById("ENR-001");
    
    // Test Manual Resolution (Mode B)
    console.log("Testing Manual Resolution: db.resolve(enrollment, 'student')...");
    const student = db.resolve(enrollment, 'student');

    if (!student || student.student_id !== sid) {
      throw new Error("Reverse Relation failed: Parent student not found.");
    }

    console.log(`✅ Success: Reverse link from Enrollment leads correctly back to '${student.student_name}'.`);
  }

  /**
   * Helper to pause
   */
  function pause(message) {
    console.log("\n⏸️ PAUSED: " + message);
    try {
      Browser.msgBox("Relation Test", message, Browser.Buttons.OK);
    } catch(e) {
      Utilities.sleep(3000);
    }
  }

  /**
   * Extracts ONLY the Student Category for testing
   */
  function getProductionStudentSchema() {
    return {
      "version": "1.0.0",
      "database": "DazzlingDB",
      "categories": {
        "Students": {
          "tables": {
            "Student": {
              "primaryKey": "student_id",
              "columns": { "student_id": { "type": "string" }, "student_name": { "type": "string" }, "status": { "type": "string" } },
              "relations": {
                "address": { "type": "hasOne", "target": "Address", "foreignKey": "student_id" },
                "enrollment": { "type": "hasMany", "target": "Enrollment", "foreignKey": "student_id" }
              }
            },
            "Address": {
              "primaryKey": "address_id",
              "columns": { "address_id": { "type": "string" }, "student_id": { "type": "string" }, "city": { "type": "string" }, "state": { "type": "string" }, "pin_code": { "type": "string" } },
              "relations": {
                "student": { "type": "belongsTo", "target": "Student", "foreignKey": "student_id" }
              }
            },
            "Enrollment": {
              "primaryKey": "enrollment_id",
              "columns": { "enrollment_id": { "type": "string" }, "student_id": { "type": "string" }, "item_id": { "type": "string" }, "status": { "type": "string" } },
              "relations": {
                "student": { "type": "belongsTo", "target": "Student", "foreignKey": "student_id" }
              }
            }
          }
        }
      }
    };
  }

  return {
    runAll_RelationalTest: runAll_RelationalTest
  };

})();

function runRelationTests() {
  RelationTestSuite.runAll_RelationalTest();
}
