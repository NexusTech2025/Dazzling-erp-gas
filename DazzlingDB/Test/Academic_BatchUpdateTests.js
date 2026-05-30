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

    console.log("   ⚙️ Step A: Inserting original batch record...");
    const batchRecord = AcademicService.createBatch(createPayload);
    createdBatchId = batchRecord.batch_id;
    console.log(`   ✅ Success! Created Batch ID: ${createdBatchId}`);

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

    console.log("   ⚙️ Step A: Inserting original batch record...");
    const batchRecord = AcademicService.createBatch(createPayload);
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
