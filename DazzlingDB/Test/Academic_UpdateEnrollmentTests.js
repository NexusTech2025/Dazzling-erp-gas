/**
 * @file Academic_UpdateEnrollmentTests.js
 * Integration test suite for the Student Enrollment Update Feature (academic_update_enrollment).
 * Verifies pre-flight validations, scalar contract updates, seating batch transfers,
 * automatic seating status cascading, and AtomicPipeline LIFO rollbacks.
 * 
 * Uses ApiTestSeedHook / FixedMockData predefined seeding mechanism:
 * - ENR-001001 (Student STU-001001, Course CRS-PHY001, Allocation BAL-001001, Batch BAT-PHY12A01)
 * - ENR-002002 (Student STU-002002, Package PKG-PCM1201, Allocation BAL-002002, Batch BAT-MAT12A02)
 * 
 * INSTRUCTIONS:
 * Run 'runAcademicUpdateEnrollmentTests' from the Apps Script IDE.
 */

function runAcademicUpdateEnrollmentTests() {
  console.log("===============================================================");
  console.log("🧪 STARTING INTEGRATION SUITE: Academic Enrollment Update (academic_update_enrollment)");
  console.log("===============================================================");

  const originalEnv = (typeof PropertiesService !== 'undefined' && PropertiesService.getScriptProperties())
    ? (PropertiesService.getScriptProperties().getProperty('ENV') || 'DEVELOPMENT')
    : 'DEVELOPMENT';

  if (originalEnv === 'PRODUCTION') {
    throw new Error("❌ Safety Guard: Test suite cannot be executed in the PRODUCTION environment.");
  }

  const timings = {};
  let passedCount = 0;
  let failedCount = 0;

  try {
    // 1. Initialize Sandbox Environment (Rule: TESTING environment mandate)
    const tStart = new Date().getTime();
    if (typeof PropertiesService !== 'undefined' && PropertiesService.getScriptProperties()) {
      PropertiesService.getScriptProperties().setProperty('ENV', 'TESTING');
    }

    // 2. Seed Predefined Mock Dataset via ApiTestSeedHook / FixedMockData
    if (typeof ApiTestSeedHook !== 'undefined') {
      console.log("🌱 Seeding database via ApiTestSeedHook...");
      ApiTestSeedHook.seed({ env: "TESTING" });
    } else if (typeof FixedMockData !== 'undefined') {
      console.log("🌱 Seeding database via FixedMockData...");
      FixedMockData.seedLiveDatabase();
    }

    DBContext.getInstance().bootstrapRepositories();
    const db = DBContext.getInstance();
    timings.sandbox_setup = new Date().getTime() - tStart;

    // 3. Execute Scenarios
    _executeScenario("Scenario 1: Scalar Update & Seating Batch Transfer (ENR-001001)", () => {
      return _testScenario1_ScalarUpdateAndBatchTransfer(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 2: Automatic Seating Status Cascade on Withdrawn (ENR-001001)", () => {
      return _testScenario2_StatusCascadeOnWithdrawn(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 3: Pipeline LIFO Rollback on Course Mismatch Error", () => {
      return _testScenario3_PipelineRollbackOnCourseMismatch(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 4: Pre-Flight Nonexistent Enrollment Guard (ENROLLMENT_NOT_FOUND)", () => {
      return _testScenario4_NonexistentEnrollmentGuard(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 5: Pre-Flight Invalid Status Choice Guard (VALIDATION_FAILURE)", () => {
      return _testScenario5_InvalidStatusGuard(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 6: Pre-Flight Unlinked Allocation Guard (INVALID_BATCH_ALLOCATION)", () => {
      return _testScenario6_UnlinkedAllocationGuard(db);
    }, () => passedCount++, () => failedCount++);

    // 4. Output Performance Benchmarks (Rule N5)
    const totalTime = Object.values(timings).reduce((a, b) => a + b, 0);
    console.log("\n========================================================");
    console.log("⏱️  ENROLLMENT UPDATE BENCHMARK TIMING SUMMARY  ⏱️");
    console.log("========================================================");
    console.log(`- Setup & Hydration Time                : ${timings.sandbox_setup} ms`);
    console.log(`- Total Execution Time                  : ${totalTime} ms`);
    console.log(`- Scenarios Executed                    : ${passedCount + failedCount} (Passed: ${passedCount}, Failed: ${failedCount})`);
    console.log("========================================================\n");

    console.log("🏁 Academic Update Enrollment Tests Complete.");
    return { passedCount: passedCount, failedCount: failedCount };
  } finally {
    // Teardown environment reset (Rule TESTING environment mandate)
    if (typeof PropertiesService !== 'undefined' && PropertiesService.getScriptProperties()) {
      PropertiesService.getScriptProperties().setProperty('ENV', originalEnv);
    }
    DBContext.getInstance().bootstrapRepositories();
  }
}

/**
 * Helper to wrap scenario execution and print formatted status logs.
 */
function _executeScenario(title, fn, onSuccess, onError) {
  console.log(`\n---------------------------------------------------------------`);
  console.log(`▶️ ${title}`);
  console.log(`---------------------------------------------------------------`);
  try {
    const res = fn();
    console.log(`✅ [PASS] ${title}`);
    if (res) console.log("   Result:", JSON.stringify(res));
    if (typeof onSuccess === 'function') onSuccess();
  } catch (err) {
    console.error(`❌ [FAIL] ${title}`);
    console.error(`   Error: ${err.message}`);
    if (err.details) console.error("   Details:", JSON.stringify(err.details));
    if (typeof onError === 'function') onError();
  }
}

/**
 * SCENARIO 1: Scalar properties update & batch allocation seat transfer on ENR-001001
 */
function _testScenario1_ScalarUpdateAndBatchTransfer(db) {
  const enrollmentId = "ENR-001001";
  const allocationId = "BAL-001001";
  // We need a batch belonging to CRS-PHY001. BAT-PHY12A01 is current. Let's create an alternate Physics batch BAT-PHY12B02
  let targetBatch = db.Batch.findById("BAT-PHY12B02");
  if (!targetBatch) {
    targetBatch = db.Batch.insert({
      batch_id: "BAT-PHY12B02",
      course_id: "CRS-PHY001",
      teacher_id: "TCH-PHYS001",
      branch_id: "BRN-MAIN001",
      batch_name: "Physics 12 Evening Batch B",
      batch_type: "Academy",
      status: "active"
    });
  }

  const payload = {
    enrollment_id: enrollmentId,
    roll_number: 1042,
    academic_status: "active",
    metadata: { shift: "evening", notes: "Transferred section" },
    allocations: [
      {
        allocation_id: allocationId,
        batch_id: targetBatch.batch_id,
        remarks: "Switched to Evening Batch B"
      }
    ]
  };

  const context = { db: db, params: { payload: payload }, mutationManifest: [] };
  const action = new UpdateEnrollmentAction();
  const response = action.handle(context);

  if (!response || !response.success) {
    throw new Error(`Scenario 1 Failed: ${JSON.stringify(response)}`);
  }

  const updatedEnr = db.Enrollment.findById(enrollmentId);
  if (updatedEnr.roll_number !== 1042) {
    throw new Error(`Assertion failed: roll_number should be 1042, got ${updatedEnr.roll_number}`);
  }

  const updatedAlloc = db.BatchAllocation.findById(allocationId);
  if (updatedAlloc.batch_id !== targetBatch.batch_id) {
    throw new Error(`Assertion failed: batch_id should be ${targetBatch.batch_id}, got ${updatedAlloc.batch_id}`);
  }

  return { roll_number: updatedEnr.roll_number, batch_id: updatedAlloc.batch_id };
}

/**
 * SCENARIO 2: Automatic status cascade when Enrollment is withdrawn (ENR-001001)
 */
function _testScenario2_StatusCascadeOnWithdrawn(db) {
  const enrollmentId = "ENR-001001";
  const allocationId = "BAL-001001";

  const payload = {
    enrollment_id: enrollmentId,
    status: "withdrawn"
  };

  const context = { db: db, params: { payload: payload }, mutationManifest: [] };
  const action = new UpdateEnrollmentAction();
  const response = action.handle(context);

  if (!response || !response.success) {
    throw new Error(`Scenario 2 Failed: ${JSON.stringify(response)}`);
  }

  const enr = db.Enrollment.findById(enrollmentId);
  if (enr.status !== "withdrawn") {
    throw new Error(`Assertion failed: enrollment status should be withdrawn, got ${enr.status}`);
  }

  const alloc = db.BatchAllocation.findById(allocationId);
  if (alloc.status !== "dropped" || !alloc.dropped_at) {
    throw new Error(`Assertion failed: Allocation should be dropped with dropped_at timestamp. Got status ${alloc.status}`);
  }

  return { enr_status: enr.status, alloc_status: alloc.status, dropped_at: alloc.dropped_at };
}

/**
 * SCENARIO 3: Pipeline LIFO Rollback when batch course_id does not match allocation course_id
 */
function _testScenario3_PipelineRollbackOnCourseMismatch(db) {
  const enrollmentId = "ENR-001001";
  const allocationId = "BAL-001001";
  const mismatchedBatchId = "BAT-MAT12A02"; // Belongs to CRS-MAT003, whereas BAL-001001 is for CRS-PHY001

  // Re-activate enrollment for rollback assertion
  db.Enrollment.update(enrollmentId, { status: "active", roll_number: 2000 });

  const payload = {
    enrollment_id: enrollmentId,
    roll_number: 9999, // Should be rolled back
    allocations: [
      {
        allocation_id: allocationId,
        batch_id: mismatchedBatchId
      }
    ]
  };

  let caughtError = null;
  try {
    const context = { db: db, params: { payload: payload }, mutationManifest: [] };
    const action = new UpdateEnrollmentAction();
    action.handle(context);
  } catch (err) {
    caughtError = err;
  }

  if (!caughtError) {
    throw new Error("Expected AcademicEnrollmentError due to course mismatch, but request succeeded.");
  }

  // Assert LIFO Rollback restored original roll_number 2000
  const afterRollback = db.Enrollment.findById(enrollmentId);
  if (afterRollback.roll_number !== 2000) {
    throw new Error(`Rollback assertion failed: roll_number should be restored to 2000, got ${afterRollback.roll_number}`);
  }

  return { caught_error: caughtError.message, restored_roll_number: afterRollback.roll_number };
}

/**
 * SCENARIO 4: Pre-flight nonexistent enrollment guard (ENROLLMENT_NOT_FOUND)
 */
function _testScenario4_NonexistentEnrollmentGuard(db) {
  const payload = {
    enrollment_id: "ENR-NONEXISTENT-999",
    roll_number: 5555
  };

  let caughtError = null;
  try {
    const context = { db: db, params: { payload: payload }, mutationManifest: [] };
    const action = new UpdateEnrollmentAction();
    action.handle(context);
  } catch (err) {
    caughtError = err;
  }

  if (!caughtError) {
    throw new Error("Expected exception for nonexistent enrollment, but none was thrown.");
  }

  if (caughtError.errorCode !== "ENROLLMENT_NOT_FOUND") {
    throw new Error(`Expected errorCode ENROLLMENT_NOT_FOUND, got ${caughtError.errorCode}`);
  }

  return { caughtCode: caughtError.errorCode, message: caughtError.message };
}

/**
 * SCENARIO 5: Pre-flight invalid status choice guard (VALIDATION_FAILURE)
 */
function _testScenario5_InvalidStatusGuard(db) {
  const payload = {
    enrollment_id: "ENR-001001",
    status: "invalid_status_enum_choice"
  };

  let caughtError = null;
  try {
    const context = { db: db, params: { payload: payload }, mutationManifest: [] };
    const action = new UpdateEnrollmentAction();
    action.handle(context);
  } catch (err) {
    caughtError = err;
  }

  if (!caughtError) {
    throw new Error("Expected exception for invalid status choice, but none was thrown.");
  }

  return { caughtCode: caughtError.errorCode || caughtError.name, message: caughtError.message };
}

/**
 * SCENARIO 6: Pre-flight unlinked allocation guard (INVALID_BATCH_ALLOCATION)
 */
function _testScenario6_UnlinkedAllocationGuard(db) {
  const payload = {
    enrollment_id: "ENR-001001",
    allocations: [
      {
        allocation_id: "BAL-002002", // Belongs to ENR-002002, NOT ENR-001001
        remarks: "Unauthorized transfer attempt"
      }
    ]
  };

  let caughtError = null;
  try {
    const context = { db: db, params: { payload: payload }, mutationManifest: [] };
    const action = new UpdateEnrollmentAction();
    action.handle(context);
  } catch (err) {
    caughtError = err;
  }

  if (!caughtError) {
    throw new Error("Expected exception for unlinked allocation, but none was thrown.");
  }

  if (caughtError.errorCode !== "INVALID_BATCH_ALLOCATION") {
    throw new Error(`Expected errorCode INVALID_BATCH_ALLOCATION, got ${caughtError.errorCode}`);
  }

  return { caughtCode: caughtError.errorCode, message: caughtError.message };
}

// Global scope export for Apps Script execution
globalThis.runAcademicUpdateEnrollmentTests = runAcademicUpdateEnrollmentTests;
