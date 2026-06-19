/**
 * @file Academic_BatchUpdateTests.js
 * Automated testing module for editing and updating Batches in the Academic Domain.
 */

function runBatchUpdateTest() {
  console.log("🚀 Starting Academic Batch Update Integration Tests...");

  const db = DBContext.getInstance();
  const results = {};

  const validIds = {
    branch_id: "BRN-3GVP91T",
    course_id: "CRS-D40D4661",
    teacher_id: "TCH-248AE945"
  };

  console.log("\n=========================================");
  results.Scenario1 = executeScenario1_SuccessfulEdit(db, validIds);

  console.log("\n=========================================");
  results.Scenario2 = executeScenario2_ValidationErrorOnEdit(db, validIds);

  console.log("=========================================\n");
  console.log("📊 FINAL TEST RESULTS: \n", JSON.stringify(results, null, 2));
  console.log("🏁 Academic Batch Update Tests Complete.");

  return results;
}

/**
 * Helper to log detailed errors inside catch blocks
 */
function logDetailedError(error) {
  console.error("   ❌ Failed:");
  console.error("      Error Name:   ", error.name || "Error");
  console.error("      Error Message:", error.message);
  if (error.stack) {
    console.error("      Stack Trace:  ", error.stack);
  }
  if (error.context) {
    console.error("      Error Context:", JSON.stringify(error.context, null, 2));
  }
}

/**
 * Scenario 1: Successful Batch Edit (Happy Path)
 */
function executeScenario1_SuccessfulEdit(db, validIds) {
  console.log("▶️ SCENARIO 1: Successful Batch Edit (Happy Path)");
  let createdBatchId = null;
  try {
    // 1. Create a valid batch first
    const createPayload = {
      batch_name: "Original Math Batch",
      branch_id: validIds.branch_id,
      course_id: validIds.course_id,
      teacher_id: validIds.teacher_id,
      batch_type: "Academy",
      status: "active",
      capacity: 30
    };

    const mockContext = {
      actionType: "CREATE",
      mutationManifest: []
    };

    console.log("   ⚙️ Step A: Inserting original batch record...");
    const batchRecord = AcademicService.createBatch(createPayload, mockContext);
    createdBatchId = batchRecord.batch_id;
    console.log(`   ✅ Success! Created Batch ID: ${createdBatchId}`);

    // Verify mutation tracked
    if (!mockContext.mutationManifest.includes("Batch")) {
      throw new Error("Mutation tracking failed: Batch mutation not tracked in manifest.");
    }

    // 2. Perform edit/update using db.Batch.update
    const updatePayload = {
      batch_name: "Math 10th - Advanced Class",
      branch_id: validIds.branch_id,
      course_id: validIds.course_id,
      teacher_id: validIds.teacher_id,
      batch_type: "Academy",
      status: "completed",
      capacity: 25,
      start_date: "2026-06-01",
      end_date: "2026-06-30",
      schedule: {
        days_of_week: ["Mon", "Wed", "Fri"],
        start_time: "10:00",
        end_time: "12:00"
      }
    };

    console.log("   ⚙️ Step B: Updating batch using payload:", JSON.stringify(updatePayload));
    const updatedRecord = db.Batch.update(createdBatchId, updatePayload);

    // 3. Assertions
    if (updatedRecord.batch_name !== "Math 10th - Advanced Class") {
      throw new Error(`Expected batch_name to update to 'Math 10th - Advanced Class', got '${updatedRecord.batch_name}'`);
    }
    if (updatedRecord.capacity !== 25) {
      throw new Error(`Expected capacity to update to 25, got ${updatedRecord.capacity}`);
    }
    if (updatedRecord.status !== "completed") {
      throw new Error(`Expected status to update to 'completed', got '${updatedRecord.status}'`);
    }
    if (!updatedRecord.schedule || updatedRecord.schedule.start_time !== "10:00") {
      throw new Error("Expected schedule object to be updated with new start_time '10:00'");
    }

    console.log("   ✅ Success! Batch updated correctly. Values verified.");
    
    // Clean up
    db.Batch.remove(createdBatchId);
    return "✅ PASSED";
  } catch (error) {
    logDetailedError(error);
    if (createdBatchId) {
      try { db.Batch.remove(createdBatchId); } catch (e) {}
    }
    return `❌ FAILED: ${error.message}`;
  }
}

/**
 * Scenario 2: Validation Failure on Edit
 */
function executeScenario2_ValidationErrorOnEdit(db, validIds) {
  console.log("▶️ SCENARIO 2: Validation Failure on Edit");
  let createdBatchId = null;
  let passed = true;
  let messages = [];

  try {
    // 1. Create a valid batch first
    const createPayload = {
      batch_name: "Original Math Batch 2",
      branch_id: validIds.branch_id,
      course_id: validIds.course_id,
      teacher_id: validIds.teacher_id,
      batch_type: "Academy"
    };

    const mockContext = {
      actionType: "CREATE",
      mutationManifest: []
    };

    console.log("   ⚙️ Step A: Inserting original batch record...");
    const batchRecord = AcademicService.createBatch(createPayload, mockContext);
    createdBatchId = batchRecord.batch_id;
    console.log(`   ✅ Success! Created Batch ID: ${createdBatchId}`);

    // 2. Attempt update with invalid enum choices for batch_type
    const invalidUpdates = {
      batch_type: "Online" // Invalid Choice
    };

    console.log("   ⚙️ Step B: Attempting update with invalid batch_type...");
    db.Batch.update(createdBatchId, invalidUpdates);

    passed = false;
    messages.push("Expected ValidationError due to invalid enum selection, but the update succeeded.");
  } catch (error) {
    if (error.name !== "ValidationError") {
      passed = false;
      messages.push(`Expected ValidationError, but caught ${error.name}: ${error.message}`);
    } else {
      console.log(`   ✅ Success! Correctly caught ValidationError: ${error.message}`);
    }
  } finally {
    if (createdBatchId) {
      try { db.Batch.remove(createdBatchId); } catch (e) {}
    }
  }

  return passed ? "✅ PASSED" : `❌ FAILED: ${messages.join(" | ")}`;
}

/**
 * Main Runner for Batch Update Benchmark Tests.
 * Relies on DazzlingDB scope and DBContext.
 */
function runAllBatchUpdateTests() {
  console.log("🚀 Starting Academic Batch Update Benchmark Tests...");

  const db = DBContext.getInstance();
  const timings = {};

  // 0. Setup Curriculum dependency (Branch, CourseType, etc.)
  console.log("--- Step 0: Bootstrapping Mock Curriculum ---");
  const setupStart = new Date().getTime();
  const mockIds = TestMockData.setupCurriculum(db);
  const setupEnd = new Date().getTime();
  const segmentId = mockIds.courseTypeId; // "SEG-TEST-1"
  timings["Step 0: Bootstrapping Mock Curriculum"] = setupEnd - setupStart;
  console.log(`   ✅ Curriculum setup complete. CourseType ID: ${segmentId} (took ${setupEnd - setupStart}ms)`);

  try {
    // 1. Setup Benchmark Data (Insert 100 Courses)
    console.log("\n--- Scenario 1: Setup 100 Course Records ---");
    const coursesToInsert = [];
    for (let i = 1; i <= 100; i++) {
      coursesToInsert.push({
        segment_id: segmentId,
        entity_type: "course",
        name: "Benchmark Course " + i,
        language_medium: "English",
        base_fee: 1000 + i,
        status: "active"
      });
    }

    console.log("Inserting 100 courses in batch using insertMany...");
    const insertStart = new Date().getTime();
    const insertedCourses = db.Course.insertMany(coursesToInsert);
    const insertEnd = new Date().getTime();
    timings["Scenario 1: Setup 100 Course Records (insertMany)"] = insertEnd - insertStart;
    console.log(`✅ Success: 100 courses inserted in ${insertEnd - insertStart}ms.`);

    const courseIds = insertedCourses.map(c => c.course_id);

    // 2. Run Batch Update Benchmark (updateMany)
    console.log("\n--- Scenario 2: Batch Update 100 Records (updateMany) ---");
    const updatesMap = {};
    courseIds.forEach(id => {
      updatesMap[id] = { status: "inactive" };
    });

    console.log("Dispatching updateMany to update status to 'inactive' for all 100 courses...");
    const updateStart = new Date().getTime();
    const updatedModels = db.Course.updateMany(updatesMap);
    const updateEnd = new Date().getTime();
    const elapsed = updateEnd - updateStart;
    timings["Scenario 2: Batch Update 100 Records (updateMany)"] = elapsed;
    console.log(`⏱️ BENCHMARK COMPLETE: Batch update on 100 records took ${elapsed}ms.`);

    // 3. Verification of values
    console.log("\n--- Scenario 3: Verifying Updated Values ---");
    const verifyStart = new Date().getTime();
    if (updatedModels.length !== 100) {
      throw new Error(`Verification Failed: Expected 100 updated models returned, got ${updatedModels.length}`);
    }

    const allCourses = db.Course.all();
    const benchmarkCourses = allCourses.filter(c => courseIds.includes(c.course_id));
    const inactiveCount = benchmarkCourses.filter(c => c.status === "inactive").length;
    if (inactiveCount !== 100) {
      throw new Error(`Verification Failed: Expected 100 records to be 'inactive', found ${inactiveCount}`);
    }
    const verifyEnd = new Date().getTime();
    timings["Scenario 3: Verifying Updated Values"] = verifyEnd - verifyStart;
    console.log(`⏱️ Verified: All 100 course statuses successfully updated to 'inactive' (took ${verifyEnd - verifyStart}ms).`);

    // 4. Primary Key Protection Test
    console.log("\n--- Scenario 4: Verify Primary Key Protection ---");
    const testId = courseIds[0];
    const pkUpdates = {};
    pkUpdates[testId] = {
      course_id: "CRS-MUTATED-ID", // Attempt to change PK
      name: "Protected Name"
    };
    
    const pkStart = new Date().getTime();
    db.Course.updateMany(pkUpdates);
    
    const courseOne = db.Course.findById(testId);
    if (!courseOne) {
      throw new Error(`Verification Failed: Primary key ${testId} not found.`);
    }
    if (courseOne.name !== "Protected Name") {
      throw new Error("Verification Failed: Valid column updates should still apply.");
    }
    const pkEnd = new Date().getTime();
    timings["Scenario 4: Verify Primary Key Protection"] = pkEnd - pkStart;
    console.log(`⏱️ Verified: Attempts to mutate primary key field were safely ignored (took ${pkEnd - pkStart}ms).`);

    // 5. Cleanup
    console.log("\n--- Scenario 5: Cleanup Test Data ---");
    const deleteStart = new Date().getTime();
    const deletedCount = db.Course.deleteMany(courseIds);
    const deleteEnd = new Date().getTime();
    timings["Scenario 5: Cleanup Test Data (deleteMany)"] = deleteEnd - deleteStart;
    console.log(`✅ Success: Cleaned up ${deletedCount} records in ${deleteEnd - deleteStart}ms.`);

    console.log("\n🎉 ALL BATCH UPDATE TEST SCENARIOS PASSED SUCCESSFULLY!");

    // Print Timing Summary Table at the end
    console.log("\n========================================================");
    console.log("⏱️  BATCH UPDATE BENCHMARK PERFORMANCE TIMING SUMMARY  ⏱️");
    console.log("========================================================");
    let grandTotal = 0;
    Object.keys(timings).forEach(op => {
      const ms = timings[op];
      grandTotal += ms;
      console.log(`- ${op.padEnd(50)}: ${String(ms).padStart(6)} ms`);
    });
    console.log("--------------------------------------------------------");
    console.log(`- ${"Total Execution Time".padEnd(50)}: ${String(grandTotal).padStart(6)} ms`);
    console.log("========================================================\n");

  } catch (e) {
    console.error("\n❌ BATCH UPDATE TEST FAILED: " + e.message);
    if (e.stack) {
      console.error(e.stack);
    }
  }
}
