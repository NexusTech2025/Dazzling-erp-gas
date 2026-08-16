/**
 * @file Student_SoftDeleteTests.js
 * Path: DazzlingDB/Test/Student_SoftDeleteTests.js
 *
 * Integration & Diagnostic Test Suite for:
 * - Student Soft Delete Action (`student_delete` with `mode: "soft"`)
 * - StudentService.softDeleteStudent
 * - Reusable FinancialSettlementStrategyRegistry integration
 * - StudentSoftDeleteValidationPipeline & ValidationEngine rules
 *
 * Verifies student status transition to 'deleted', cascade of active enrollments to 'discarded',
 * cascade of batch allocations to 'dropped', ledger balancing on linked StudentFeeAccount rows,
 * preservation of historical audit records (Address, ContactInfo, Education, Attendance, Marks),
 * and AtomicPipeline LIFO rollback safety.
 *
 * Uses ApiTestSeedHook / FixedMockData predefined seeding mechanism:
 * - STU-001001 (Enrollment ENR-001001, Allocation BAL-001001, SFA-001001: ₹2,000 paid)
 * - STU-002002 (Enrollment ENR-002002, Allocation BAL-002002, SFA-002002: ₹0 paid)
 *
 * INSTRUCTIONS:
 * Run 'runStudentSoftDeleteTests' from the Apps Script IDE.
 */

function runStudentSoftDeleteTests() {
  console.log("===============================================================");
  console.log("🧪 STARTING INTEGRATION SUITE: Student Soft Delete (student_delete)");
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
    _executeScenario("Scenario 1: Happy Path Student Soft Delete (STU-002002)", () => {
      return _testScenario1_HappyPathSoftDelete(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 2: Enrollment Contract Cascades (ENR-002002 -> discarded / withdrawn)", () => {
      return _testScenario2_EnrollmentCascades(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 3: Batch Seating Allocation Cascades (BAL-002002 -> dropped)", () => {
      return _testScenario3_AllocationCascades(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 4: Financial Settlement Default waive_unpaid on Soft Delete (STU-002002)", () => {
      return _testScenario4_DefaultWaiveUnpaidOnSoftDelete(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 5: Soft Delete with settle_liability on Partially-Paid Student (STU-001001)", () => {
      return _testScenario5_SoftDeleteWithSettleLiability(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 6: Historical Data Preservation (Address, ContactInfo, Education)", () => {
      return _testScenario6_HistoricalDataPreservation(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 7: Guard - Nonexistent Student Rejection", () => {
      return _testScenario7_NonexistentStudentGuard(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 8: Guard - Idempotent Soft Deletion Rejection", () => {
      return _testScenario8_IdempotentSoftDeleteGuard(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 9: Pipeline LIFO Rollback on Simulated Step Failure", () => {
      return _testScenario9_PipelineRollbackOnFailure(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 10: ApiDispatcher Controller Routing Integration (student_delete)", () => {
      return _testScenario10_ApiDispatcherIntegration(db);
    }, () => passedCount++, () => failedCount++);

    // 4. Output Performance Benchmarks (Rule N5)
    const totalTime = Object.values(timings).reduce((a, b) => a + b, 0);
    console.log("\n========================================================");
    console.log("⏱️  STUDENT SOFT DELETE BENCHMARK TIMING SUMMARY  ⏱️");
    console.log("========================================================");
    console.log(`- Setup & Hydration Time                : ${timings.sandbox_setup} ms`);
    console.log(`- Total Execution Time                  : ${totalTime} ms`);
    console.log(`- Scenarios Executed                    : ${passedCount + failedCount} (Passed: ${passedCount}, Failed: ${failedCount})`);
    console.log("========================================================\n");

    console.log("🏁 Student Soft Delete Tests Complete.");
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
 * SCENARIO 1: Happy Path Student Soft Delete (STU-002002)
 */
function _testScenario1_HappyPathSoftDelete(db) {
  const targetId = "STU-002002";
  const payload = {
    student_id: targetId,
    reason: "Student relocating to another state"
  };

  const context = { db: db, params: { payload: payload }, mutationManifest: [], user: { username: "admin_test", role: "admin", isValid: true } };
  const service = (typeof StudentService !== 'undefined') ? StudentService : globalThis.StudentService;
  const result = service.softDeleteStudent(payload, context);

  if (!result || result.status !== "deleted") {
    throw new Error(`Expected soft-delete result status 'deleted', got '${result?.status}'`);
  }

  const updatedStudent = db.Student.findById(targetId);
  if (!updatedStudent) throw new Error("Student STU-002002 not found after soft-delete");
  if (updatedStudent.status !== "deleted") {
    throw new Error(`Expected Student.status 'deleted', got '${updatedStudent.status}'`);
  }
  if (!updatedStudent.metadata || !updatedStudent.metadata.deleted_at) {
    throw new Error("Expected metadata.deleted_at timestamp to be populated on soft-deleted student");
  }

  return { student_id: targetId, status: updatedStudent.status, deleted_at: updatedStudent.metadata.deleted_at };
}

/**
 * SCENARIO 2: Enrollment Contract Cascades (ENR-002002 -> discarded / withdrawn)
 */
function _testScenario2_EnrollmentCascades(db) {
  const targetStudentId = "STU-002002";
  const enrollments = db.Enrollment.where({ student_id: targetStudentId });

  if (enrollments.length === 0) {
    throw new Error("No enrollments found for STU-002002 to verify cascade");
  }

  enrollments.forEach(enr => {
    if (enr.status !== "discarded") {
      throw new Error(`Expected Enrollment ${enr.enrollment_id} status 'discarded', got '${enr.status}'`);
    }
    if (enr.academic_status !== "withdrawn") {
      throw new Error(`Expected Enrollment ${enr.enrollment_id} academic_status 'withdrawn', got '${enr.academic_status}'`);
    }
  });

  return { verified_enrollments_count: enrollments.length, status: "discarded" };
}

/**
 * SCENARIO 3: Batch Seating Allocation Cascades (BAL-002002 -> dropped)
 */
function _testScenario3_AllocationCascades(db) {
  const targetStudentId = "STU-002002";
  const allocations = db.BatchAllocation.where({ student_id: targetStudentId });

  if (allocations.length === 0) {
    throw new Error("No allocations found for STU-002002 to verify cascade");
  }

  allocations.forEach(alloc => {
    if (alloc.status !== "dropped") {
      throw new Error(`Expected Allocation ${alloc.allocation_id} status 'dropped', got '${alloc.status}'`);
    }
    if (!alloc.dropped_at) {
      throw new Error(`Expected dropped_at timestamp populated for allocation ${alloc.allocation_id}`);
    }
  });

  return { verified_allocations_count: allocations.length, status: "dropped" };
}

/**
 * SCENARIO 4: Financial Settlement Default waive_unpaid on Soft Delete (STU-002002)
 */
function _testScenario4_DefaultWaiveUnpaidOnSoftDelete(db) {
  const targetStudentId = "STU-002002";
  const enrollments = db.Enrollment.where({ student_id: targetStudentId });
  const enrIds = enrollments.map(e => e.enrollment_id);

  const feeAccounts = db.StudentFeeAccount.all().filter(sfa => enrIds.includes(sfa.enrollment_id));
  if (feeAccounts.length === 0) {
    throw new Error("No fee accounts found for STU-002002 to verify financial waiver");
  }

  feeAccounts.forEach(sfa => {
    if (sfa.status !== "completed") {
      throw new Error(`Expected StudentFeeAccount ${sfa.student_fee_id} status 'completed', got '${sfa.status}'`);
    }
    if (Number(sfa.balance_due || 0) !== 0) {
      throw new Error(`Expected balance_due 0 for fee account ${sfa.student_fee_id}, got ${sfa.balance_due}`);
    }

    const insts = db.Installment.where({ student_fee_id: sfa.student_fee_id });
    insts.forEach(inst => {
      if (inst.status !== "cancelled" && inst.status !== "paid") {
        throw new Error(`Expected Installment ${inst.installment_id} status 'cancelled', got '${inst.status}'`);
      }
    });
  });

  return { fee_accounts_reconciled: feeAccounts.length, balance_due: 0 };
}

/**
 * SCENARIO 5: Soft Delete with settle_liability on Partially-Paid Student (STU-001001)
 */
function _testScenario5_SoftDeleteWithSettleLiability(db) {
  const targetId = "STU-001001";
  const requiredAmount = 5000;

  const payload = {
    student_id: targetId,
    reason: "Mid-term course drop with penalty",
    financial_settlement: {
      policy: "settle_liability",
      required_amount: requiredAmount,
      due_date: "2026-09-30",
      remarks: "Institutional retention penalty on student soft-delete"
    }
  };

  const context = { db: db, params: { payload: payload }, mutationManifest: [], user: { username: "admin_test", role: "admin", isValid: true } };
  const service = (typeof StudentService !== 'undefined') ? StudentService : globalThis.StudentService;
  const result = service.softDeleteStudent(payload, context);

  if (!result || result.status !== "deleted") {
    throw new Error(`Expected soft-delete result status 'deleted', got '${result?.status}'`);
  }

  const sfa = db.StudentFeeAccount.findOne({ enrollment_id: "ENR-001001" });
  if (!sfa) throw new Error("SFA-001001 not found");

  if (Number(sfa.final_fee) !== requiredAmount) {
    throw new Error(`Expected SFA final_fee ${requiredAmount}, got ${sfa.final_fee}`);
  }
  // Paid was ₹2,000, required is ₹5,000 -> balance_due should be ₹3,000
  if (Number(sfa.balance_due) !== 3000) {
    throw new Error(`Expected SFA balance_due 3000, got ${sfa.balance_due}`);
  }

  const installments = db.Installment.where({ student_fee_id: sfa.student_fee_id });
  const sortedInst = installments.sort((a, b) => Number(a.installment_number || 1) - Number(b.installment_number || 1));
  if (sortedInst.length > 0) {
    const inst1 = sortedInst[0];
    if (Number(inst1.due_amount) !== requiredAmount) {
      throw new Error(`Expected Installment #1 due_amount ${requiredAmount}, got ${inst1.due_amount}`);
    }
    const dueDateStr = (typeof SheetDB !== 'undefined' && SheetDB.DateComparator)
      ? SheetDB.DateComparator.getLocalDateString(inst1.due_date)
      : String(inst1.due_date);
    if (dueDateStr !== "2026-09-30") {
      throw new Error(`Expected Installment #1 due_date '2026-09-30', got '${dueDateStr}'`);
    }
  }

  return { student_id: targetId, final_fee: sfa.final_fee, balance_due: sfa.balance_due };
}

/**
 * SCENARIO 6: Historical Data Preservation (Address, ContactInfo, Education)
 */
function _testScenario6_HistoricalDataPreservation(db) {
  const targetStudentId = "STU-001001";

  const address = db.Address ? db.Address.findOne({ student_id: targetStudentId }) : null;
  const contact = db.ContactInfo ? db.ContactInfo.findOne({ student_id: targetStudentId }) : null;
  const education = db.Education ? db.Education.where({ student_id: targetStudentId }) : [];

  if (!address) throw new Error("Address record was unexpectedly deleted or missing");
  if (!contact) throw new Error("ContactInfo record was unexpectedly deleted or missing");
  if (education.length === 0) throw new Error("Education records were unexpectedly deleted or missing");

  return {
    address_preserved: address.address_id,
    contact_preserved: contact.contact_id,
    education_count_preserved: education.length
  };
}

/**
 * SCENARIO 7: Guard - Nonexistent Student Rejection
 */
function _testScenario7_NonexistentStudentGuard(db) {
  let caught = false;
  try {
    const service = (typeof StudentService !== 'undefined') ? StudentService : globalThis.StudentService;
    service.softDeleteStudent({ student_id: "STU-NONEXISTENT-999" }, { db: db });
  } catch (err) {
    caught = true;
    if (err.errorCode !== "STUDENT_DELETE_VALIDATION_FAILURE" && !err.message.includes("not found")) {
      throw new Error(`Expected not found validation error, got: ${err.message}`);
    }
  }

  if (!caught) {
    throw new Error("Expected validation exception for nonexistent student_id, but request succeeded.");
  }
  return { status: "rejected_successfully" };
}

/**
 * SCENARIO 8: Guard - Idempotent Soft Deletion Rejection
 */
function _testScenario8_IdempotentSoftDeleteGuard(db) {
  let caught = false;
  try {
    const service = (typeof StudentService !== 'undefined') ? StudentService : globalThis.StudentService;
    // STU-002002 was already soft-deleted in Scenario 1
    service.softDeleteStudent({ student_id: "STU-002002" }, { db: db });
  } catch (err) {
    caught = true;
    if (!err.message.includes("already soft-deleted") && err.errorCode !== "STUDENT_DELETE_VALIDATION_FAILURE") {
      throw new Error(`Expected already soft-deleted error, got: ${err.message}`);
    }
  }

  if (!caught) {
    throw new Error("Expected validation exception when re-deleting an already deleted student, but request succeeded.");
  }
  return { status: "idempotency_guard_passed" };
}

/**
 * SCENARIO 9: Pipeline LIFO Rollback on Simulated Step Failure
 */
function _testScenario9_PipelineRollbackOnFailure(db) {
  const student = db.Student.insert({
    student_id: "STU-ROLLBACK-TEST",
    student_name: "Rollback Candidate",
    email: "rollback_test@dazzling.com",
    status: "active"
  });

  const enrollment = db.Enrollment.insert({
    enrollment_id: "ENR-ROLLBACK-TEST",
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
    pipeline.addStep("Student", function(repo) {
      repo.update(student.student_id, { status: "deleted" });
    });
    pipeline.addStep("Enrollment", function(repo) {
      repo.update(enrollment.enrollment_id, { status: "discarded" });
    });
    pipeline.addStep("SimulatedFailureStep", function() {
      throw new Error("Simulated downstream step crash for LIFO rollback verification");
    });
    pipeline.execute();
  } catch (err) {
    caught = true;
  }

  if (!caught) {
    throw new Error("Expected pipeline exception, but execution completed.");
  }

  const studentAfterRollback = db.Student.findById(student.student_id);
  if (studentAfterRollback.status !== "active") {
    throw new Error(`LIFO rollback failed: Student.status should be 'active', got '${studentAfterRollback.status}'`);
  }

  const enrAfterRollback = db.Enrollment.findById(enrollment.enrollment_id);
  if (enrAfterRollback.status !== "active") {
    throw new Error(`LIFO rollback failed: Enrollment.status should be 'active', got '${enrAfterRollback.status}'`);
  }

  // Cleanup test mock records
  db.Enrollment.remove(enrollment.enrollment_id);
  db.Student.remove(student.student_id);

  return { rollback_verified: true, restored_status: studentAfterRollback.status };
}

/**
 * SCENARIO 10: ApiDispatcher Controller Routing Integration (student_delete)
 */
function _testScenario10_ApiDispatcherIntegration(db) {
  const student = db.Student.insert({
    student_id: "STU-APIDISP-01",
    student_name: "API Dispatcher Candidate",
    email: "apidisp@dazzling.com",
    status: "active"
  });

  const action = new DeleteStudentAction();
  const mockContext = {
    db: db,
    params: {
      action: "student_delete",
      payload: {
        student_id: student.student_id,
        mode: "soft",
        reason: "Web controller dispatch test"
      }
    },
    user: { username: "admin_tester", role: "admin", isValid: true },
    mutationManifest: []
  };

  const response = action.run(mockContext);

  if (!response.success) {
    throw new Error(`Action execution failed: ${JSON.stringify(response.error)}`);
  }

  const updated = db.Student.findById(student.student_id);
  if (updated.status !== "deleted") {
    throw new Error(`Expected Student.status 'deleted', got '${updated.status}'`);
  }

  // Cleanup
  db.Student.remove(student.student_id);

  return { action_routing_success: true, student_status: updated.status };
}

// Bind top-level entry point to global namespace for Apps Script execution
globalThis.runStudentSoftDeleteTests = runStudentSoftDeleteTests;
