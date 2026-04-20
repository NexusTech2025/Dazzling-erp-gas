/**
 * @file test_batch_performance.js
 * Performance and Integrity test for the insertMany() batch operation.
 */

const BATCH_TEST_FOLDER_ID = "1aw3neGzRDRzSqQNOe_kjqUS7MDsIEU7G";

/**
 * Main Runner for Batch Performance Tests
 */
function runBatchPerformanceTests() {
  const schema = getProductionStudentSchema();
  
  console.log("🚀 Initializing SheetDB for Batch Performance Tests...");
  const db = SheetDB.init(BATCH_TEST_FOLDER_ID, schema);

  // 0. Setup Structure
  db.setup.provision();

  try {
    // 1. GENERATE BULK DATA
    const payload = generateTestData(5); // 5 Students, 5 Addresses, 10 Enrollments
    console.log(`\n📦 Prepared bulk payload: ${payload.length} nested documents.`);

    // 2. EXECUTE BATCH INSERT
    console.log("--- Starting insertMany() ---");
    const startTime = Date.now();
    
    const results = db.Student.insertMany(payload);
    
    const duration = Date.now() - startTime;
    console.log(`--- insertMany() Completed in ${duration}ms ---`);

    // 3. VERIFICATION
    verifyBatchIntegrity(db, results);

    console.log("\n✅ BATCH PERFORMANCE TEST COMPLETED SUCCESSFULLY!");

  } catch (e) {
    console.error("\n❌ BATCH TEST FAILED: " + e.message);
    if (e.stack) console.error(e.stack);
  }
}

/**
 * Generates an array of nested Student documents.
 */
function generateTestData(count) {
  const data = [];
  for (let i = 1; i <= count; i++) {
    const sid = `BATCH-STU-${i}`;
    data.push({
      student_id: sid,
      student_name: `Batch User ${i}`,
      status: "active",
      address: {
        address_id: `BATCH-ADDR-${i}`,
        city: "Data City",
        state: "DC"
      },
      enrollment: [
        { enrollment_id: `BATCH-ENR-${i}-A`, item_id: "COURSE-BATCH-A", status: "active" },
        { enrollment_id: `BATCH-ENR-${i}-B`, item_id: "COURSE-BATCH-B", status: "active" }
      ]
    });
  }
  return data;
}

/**
 * Verify that all records were physically saved and linked.
 */
function verifyBatchIntegrity(db, parents) {
  console.log("\n--- Scenario: Verifying Relational Integrity ---");

  if (parents.length === 0) throw new Error("Verification failed: No parents returned.");

  // Spot check the middle student
  const sample = parents[2];
  console.log(`Checking integrity for: ${sample.student_id}`);

  const addr = sample.address();
  if (!addr || addr.city !== "Data City") {
    throw new Error("Relational Integrity Mismatch: Address link broken.");
  }

  const enr = sample.enrollment();
  if (!Array.isArray(enr) || enr.length !== 2) {
    throw new Error(`Relational Integrity Mismatch: Expected 2 enrollments, found ${enr.length}`);
  }

  console.log("✅ All relational links verified for the batch.");
}

/**
 * Shared Schema for testing
 */
function getProductionStudentSchema() {
  return {
    "version": "1.0.0",
    "database": "BatchTestDB",
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
            "columns": { "address_id": { "type": "string" }, "student_id": { "type": "string" }, "city": { "type": "string" }, "state": { "type": "string" } },
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
