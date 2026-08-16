/**
 * @file Student_HardDeleteTests.js
 * Path: DazzlingDB/Test/Student_HardDeleteTests.js
 *
 * Integration & Diagnostic Test Suite for:
 * - Student Hard Delete Action (`student_delete` with `mode: "hard"`)
 * - StudentService.hardDeleteStudent
 * - StudentHardDeleteValidationPipeline & ValidationEngine rules
 * - Safe Untouched Purge (`force: false`) & Superadmin Force Purge (`force: true`)
 * - Legacy `student_delete_untouched` action backward compatibility
 *
 * Uses ApiTestSeedHook / FixedMockData predefined seeding mechanism:
 * - STU-001001 (Enrollment ENR-001001, Allocation BAL-001001, SFA-001001: ₹2,000 paid)
 * - STU-002002 (Enrollment ENR-002002, Allocation BAL-002002, SFA-002002: ₹0 paid)
 *
 * INSTRUCTIONS:
 * Run 'runStudentHardDeleteTests' from the Apps Script IDE.
 */

function runStudentHardDeleteTests() {
  console.log("===============================================================");
  console.log("🧪 STARTING INTEGRATION SUITE: Student Hard Delete (student_delete)");
  console.log("===============================================================");

  const originalEnv = (typeof PropertiesService !== 'undefined' && PropertiesService.getScriptProperties())
    ? (PropertiesService.getScriptProperties().getProperty('ENV') || 'DEVELOPMENT')
    : 'DEVELOPMENT';

  if (originalEnv === 'PRODUCTION') {
    throw new Error("❌ Safety Guard: Test suite cannot be executed in the PRODUCTION environment.");
  }

  let passedCount = 0;
  let failedCount = 0;
  const timings = {};

  try {
    // 1. Initialize Sandbox Environment (Rule: TESTING environment mandate)
    const tStart = Date.now();
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

    const db = DBContext.getInstance();
    db.bootstrapRepositories();
    timings.sandbox_setup = Date.now() - tStart;

    // 3. Execute Scenarios
    _executeScenario("Scenario 1: Happy Path Untouched Student Hard Delete (force: false, STU-002002)", () => {
      return _testScenario1_HappyPathUntouchedHardDelete(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 2: Financial Integrity Guard Rejection on Paid Student (force: false, STU-001001)", () => {
      return _testScenario2_FinancialGuardRejection(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 3: Superadmin Force Hard Delete on Paid Student (force: true, STU-001001)", () => {
      return _testScenario3_SuperadminForceHardDelete(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 4: Unauthorized Force Hard Delete Rejection (Non-Superadmin with force: true)", () => {
      return _testScenario4_UnauthorizedForceRejection(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 5: Guard - Nonexistent Student Hard Delete Rejection", () => {
      return _testScenario5_NonexistentStudentGuard(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 6: Pipeline LIFO Rollback on Step Failure", () => {
      return _testScenario6_PipelineRollbackOnFailure(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 7: ApiDispatcher Controller Routing Integration (student_delete, mode: 'hard')", () => {
      return _testScenario7_ApiDispatcherHardDeleteIntegration(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 8: Legacy student_delete_untouched Backward Compatibility", () => {
      return _testScenario8_LegacyUntouchedActionCompatibility(db);
    }, () => passedCount++, () => failedCount++);

    // 4. Output Performance Benchmarks (Rule N5)
    const totalTime = Object.values(timings).reduce((a, b) => a + b, 0);
    console.log("\n========================================================");
    console.log("⏱️  STUDENT HARD DELETE BENCHMARK TIMING SUMMARY  ⏱️");
    console.log("========================================================");
    console.log(`- Setup & Hydration Time                : ${timings.sandbox_setup} ms`);
    console.log(`- Total Execution Time                  : ${totalTime} ms`);
    console.log(`- Scenarios Executed                    : ${passedCount + failedCount} (Passed: ${passedCount}, Failed: ${failedCount})`);
    console.log("========================================================\n");

    console.log("🏁 Student Hard Delete Tests Complete.");
    return { passedCount: passedCount, failedCount: failedCount };
  } finally {
    // Teardown / reset environment (Rule TESTING environment mandate)
    if (typeof ApiTestSeedHook !== 'undefined') {
      ApiTestSeedHook.purgeAll();
    } else if (typeof FixedMockData !== 'undefined') {
      FixedMockData.purgeFromLiveDatabase();
    }

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
  const startTime = Date.now();
  try {
    const res = fn();
    const duration = Date.now() - startTime;
    console.log(`  ✅ [PASS] ${title} (${duration}ms)`);
    if (res) console.log("   Result:", JSON.stringify(res));
    if (typeof onSuccess === 'function') onSuccess();
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`  ❌ [FAIL] ${title} (${duration}ms)`);
    console.error(`   Error: ${err.message}`);
    if (err.details) console.error("   Details:", JSON.stringify(err.details));
    if (err.stack) console.error(err.stack);
    if (typeof onError === 'function') onError();
  }
}

/**
 * SCENARIO 1: Happy Path Untouched Student Hard Delete (force: false, STU-002002)
 */
function _testScenario1_HappyPathUntouchedHardDelete(db) {
  const targetId = "STU-002002";
  const payload = {
    student_id: targetId,
    mode: "hard",
    force: false,
    reason: "Untouched profile purge"
  };

  const pipeCtx = (typeof SheetDB !== 'undefined' && SheetDB.PipelineContext)
    ? new SheetDB.PipelineContext({ mutationManifest: [] })
    : { trackMutation: function() {} };
  const context = { db: db, params: { payload: payload }, mutationManifest: [], user: { username: "admin_test", role: "admin", isValid: true } };

  const service = (typeof StudentService !== 'undefined') ? StudentService : globalThis.StudentService;
  const result = service.hardDeleteStudent(payload, context);

  if (!result || result.mode !== "hard") {
    throw new Error(`Expected hard-delete mode 'hard', got '${result?.mode}'`);
  }

  // Verify Student is physically deleted
  const student = db.Student.findById(targetId);
  if (student) throw new Error(`Student ${targetId} still exists after hard-delete`);

  // Verify child records are physically deleted
  const enrollments = db.Enrollment.where({ student_id: targetId });
  if (enrollments.length > 0) throw new Error(`Enrollment records still exist for ${targetId}`);

  const allocations = db.BatchAllocation.where({ student_id: targetId });
  if (allocations.length > 0) throw new Error(`BatchAllocation records still exist for ${targetId}`);

  const sfas = db.StudentFeeAccount.all().filter(s => s.enrollment_id === "ENR-002002");
  if (sfas.length > 0) throw new Error(`StudentFeeAccount records still exist for ${targetId}`);

  return { student_id: targetId, purged_counts: result.purged_counts };
}

/**
 * SCENARIO 2: Financial Integrity Guard Rejection on Paid Student (force: false, STU-001001)
 */
function _testScenario2_FinancialGuardRejection(db) {
  const targetId = "STU-001001";
  const payload = {
    student_id: targetId,
    mode: "hard",
    force: false
  };

  let caught = false;
  try {
    const service = (typeof StudentService !== 'undefined') ? StudentService : globalThis.StudentService;
    service.hardDeleteStudent(payload, { db: db, user: { username: "admin_test", role: "admin", isValid: true } });
  } catch (err) {
    caught = true;
    if (!err.message.includes("Financial Integrity Breach") && err.errorCode !== "STUDENT_HARD_DELETE_VALIDATION_FAILURE") {
      throw new Error(`Expected Financial Integrity Breach error, got: ${err.message}`);
    }
  }

  if (!caught) {
    throw new Error("Expected hard-delete to fail for student with collected payments, but it succeeded.");
  }

  // Verify student is still active
  const student = db.Student.findById(targetId);
  if (!student || student.status !== "active") {
    throw new Error(`Expected student ${targetId} to remain active after rejected hard-delete`);
  }

  return { status: "financial_guard_rejected_cleanly" };
}

/**
 * SCENARIO 3: Superadmin Force Hard Delete on Paid Student (force: true, STU-001001)
 */
function _testScenario3_SuperadminForceHardDelete(db) {
  const targetId = "STU-001001";
  const payload = {
    student_id: targetId,
    mode: "hard",
    force: true,
    reason: "Superadmin permanent account purge"
  };

  const context = {
    db: db,
    params: { payload: payload },
    mutationManifest: [],
    user: { username: "superadmin_tester", role: "superadmin", isValid: true }
  };

  const service = (typeof StudentService !== 'undefined') ? StudentService : globalThis.StudentService;
  const result = service.hardDeleteStudent(payload, context);

  if (!result || result.force !== true) {
    throw new Error("Expected hard delete result with force: true");
  }

  // Verify physical deletion across all child tables
  const student = db.Student.findById(targetId);
  if (student) throw new Error(`Student ${targetId} still exists after force hard-delete`);

  const enrollments = db.Enrollment.where({ student_id: targetId });
  if (enrollments.length > 0) throw new Error("Enrollments still exist after force hard-delete");

  const payments = db.Payment.all().filter(p => p.student_fee_id === "SFA-001001");
  if (payments.length > 0) throw new Error("Payments still exist after force hard-delete");

  return { student_id: targetId, purged_counts: result.purged_counts };
}

/**
 * SCENARIO 4: Unauthorized Force Hard Delete Rejection (Non-Superadmin with force: true)
 */
function _testScenario4_UnauthorizedForceRejection(db) {
  const student = db.Student.insert({
    student_id: "STU-UNAUTH-TEST",
    student_name: "Unauth Target",
    email: "unauth@dazzling.com",
    status: "active"
  });

  const payload = {
    student_id: student.student_id,
    mode: "hard",
    force: true
  };

  let caught = false;
  try {
    const service = (typeof StudentService !== 'undefined') ? StudentService : globalThis.StudentService;
    service.hardDeleteStudent(payload, {
      db: db,
      user: { username: "standard_admin", role: "admin", isValid: true }
    });
  } catch (err) {
    caught = true;
    if (!err.message.includes("superadmin") && err.errorCode !== "STUDENT_HARD_DELETE_VALIDATION_FAILURE") {
      throw new Error(`Expected superadmin authorization error, got: ${err.message}`);
    }
  }

  // Cleanup
  db.Student.remove(student.student_id);

  if (!caught) {
    throw new Error("Expected unauthorized force hard-delete to fail, but it succeeded.");
  }

  return { status: "unauthorized_force_rejected_cleanly" };
}

/**
 * SCENARIO 5: Guard - Nonexistent Student Hard Delete Rejection
 */
function _testScenario5_NonexistentStudentGuard(db) {
  let caught = false;
  try {
    const service = (typeof StudentService !== 'undefined') ? StudentService : globalThis.StudentService;
    service.hardDeleteStudent({ student_id: "STU-NONEXISTENT-999" }, { db: db });
  } catch (err) {
    caught = true;
    if (!err.message.includes("not found") && err.errorCode !== "STUDENT_HARD_DELETE_VALIDATION_FAILURE") {
      throw new Error(`Expected not found error, got: ${err.message}`);
    }
  }

  if (!caught) {
    throw new Error("Expected nonexistent student hard-delete to fail, but it succeeded.");
  }

  return { status: "nonexistent_student_rejected" };
}

/**
 * SCENARIO 6: Pipeline LIFO Rollback on Step Failure
 */
function _testScenario6_PipelineRollbackOnFailure(db) {
  const student = db.Student.insert({
    student_id: "STU-HD-ROLLBACK",
    student_name: "Hard Delete Rollback Candidate",
    email: "hd_rollback@dazzling.com",
    status: "active"
  });

  const enrollment = db.Enrollment.insert({
    enrollment_id: "ENR-HD-ROLLBACK",
    student_id: student.student_id,
    enrollment_type: "course",
    item_id: "CRS-PHY001",
    status: "active",
    academic_status: "active"
  });

  let caught = false;
  try {
    const pipeCtx = (typeof SheetDB !== 'undefined' && SheetDB.PipelineContext)
      ? new SheetDB.PipelineContext({ mutationManifest: [] })
      : { trackMutation: function() {} };
    const pipeline = new SheetDB.AtomicPipeline(db, pipeCtx);

    pipeline.addStep("Enrollment", function(repo) {
      repo.remove(enrollment.enrollment_id);
    });
    pipeline.addStep("SimulatedFailureStep", function() {
      throw new Error("Simulated step failure during hard-delete pipeline");
    });
    pipeline.execute();
  } catch (err) {
    caught = true;
  }

  if (!caught) {
    throw new Error("Expected pipeline failure, but execution succeeded.");
  }

  const enrAfterRollback = db.Enrollment.findById(enrollment.enrollment_id);
  if (!enrAfterRollback) {
    throw new Error("LIFO rollback failed: Enrollment record was permanently deleted during aborted transaction.");
  }

  // Cleanup
  db.Enrollment.remove(enrollment.enrollment_id);
  db.Student.remove(student.student_id);

  return { rollback_verified: true, enrollment_preserved: enrAfterRollback.enrollment_id };
}

/**
 * SCENARIO 7: ApiDispatcher Controller Routing Integration (student_delete, mode: 'hard')
 */
function _testScenario7_ApiDispatcherHardDeleteIntegration(db) {
  const student = db.Student.insert({
    student_id: "STU-APIDISP-HD",
    student_name: "API Dispatcher HD Candidate",
    email: "apidisphd@dazzling.com",
    status: "active"
  });

  const action = new DeleteStudentAction();
  const mockContext = {
    db: db,
    params: {
      action: "student_delete",
      payload: {
        student_id: student.student_id,
        mode: "hard",
        force: false,
        reason: "API controller hard-delete dispatch test"
      }
    },
    user: { username: "admin_tester", role: "admin", isValid: true },
    mutationManifest: []
  };

  const response = action.run(mockContext);

  if (!response.success) {
    throw new Error(`Action execution failed: ${JSON.stringify(response.error)}`);
  }

  const studentCheck = db.Student.findById(student.student_id);
  if (studentCheck) {
    throw new Error("Student still exists after successful API hard-delete controller action");
  }

  return { action_routing_success: true, purged: true };
}

/**
 * SCENARIO 8: Legacy student_delete_untouched Backward Compatibility
 */
function _testScenario8_LegacyUntouchedActionCompatibility(db) {
  const student = db.Student.insert({
    student_id: "STU-LEGACY-UNTOUCHED",
    student_name: "Legacy Untouched Candidate",
    email: "legacy_untouched@dazzling.com",
    status: "active"
  });

  const action = new DeleteUntouchedStudentAction();
  const mockContext = {
    db: db,
    params: {
      action: "student_delete_untouched",
      payload: {
        student_id: student.student_id
      }
    },
    user: { username: "admin_tester", role: "admin", isValid: true },
    mutationManifest: []
  };

  const response = action.run(mockContext);

  if (!response.success) {
    throw new Error(`Legacy action execution failed: ${JSON.stringify(response.error)}`);
  }

  const studentCheck = db.Student.findById(student.student_id);
  if (studentCheck) {
    throw new Error("Student still exists after legacy delete_untouched action");
  }

  return { legacy_action_success: true, purged: true };
}

// Bind top-level entry point to global namespace for Apps Script execution
globalThis.runStudentHardDeleteTests = runStudentHardDeleteTests;
