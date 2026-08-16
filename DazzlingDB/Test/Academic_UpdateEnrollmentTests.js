/**
 * @file Academic_UpdateEnrollmentTests.js
 * Path: DazzlingDB/Test/Academic_UpdateEnrollmentTests.js
 *
 * Integration & Diagnostic Test Suite for:
 * - Academic Enrollment Update Action (`academic_update_enrollment`)
 * - AcademicEnrollmentService.updateEnrollment
 * - FinancialSettlementStrategyRegistry ('waive_unpaid', 'settle_liability', 'refund', 'prorated_refund', 'retain_ledger')
 * - EnrollmentUpdateValidationPipeline & ValidationEngine rules
 *
 * Verifies scalar contract updates, seating batch transfers, automatic seating cascades,
 * single-installment liability rescheduling, financial settlement policies, and AtomicPipeline LIFO rollbacks.
 *
 * Uses ApiTestSeedHook / FixedMockData predefined seeding mechanism:
 * - ENR-001001 (Student STU-001001, Course CRS-PHY001, Allocation BAL-001001, Batch BAT-PHY12A01, SFA-001001: ₹2,000 paid)
 * - ENR-002002 (Student STU-002002, Package PKG-PCM1201, Allocation BAL-002002, Batch BAT-MAT12A02, SFA-002002: ₹0 paid)
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
    _executeScenario("Scenario 1: Scalar Properties Update & Batch Seat Transfer (ENR-001001)", () => {
      return _testScenario1_ScalarUpdateAndBatchTransfer(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 2: Automatic Seating Cascade & Default waive_unpaid on Withdrawn (ENR-001001)", () => {
      return _testScenario2_DefaultWaiveUnpaidOnWithdrawn(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 3: settle_liability Policy on Zero-Paid Enrollment (ENR-002002)", () => {
      return _testScenario3_SettleLiabilityZeroPaid(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 4: settle_liability Policy on Partially-Paid Enrollment (ENR-001001)", () => {
      return _testScenario4_SettleLiabilityPartiallyPaid(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 5: refund Policy on Withdrawn (ENR-001001 - Negative Payment Created)", () => {
      return _testScenario5_RefundPolicyOnWithdrawn(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 6: prorated_refund Policy on Withdrawn (ENR-001001)", () => {
      return _testScenario6_ProratedRefundPolicy(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 7: retain_ledger Policy on Withdrawn (ENR-001001)", () => {
      return _testScenario7_RetainLedgerPolicy(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 8: Guard - Missing/Negative required_amount in settle_liability", () => {
      return _testScenario8_InvalidSettleLiabilityGuard(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 9: Guard - Refund Amount Exceeds Amount Paid", () => {
      return _testScenario9_RefundExceedsPaidGuard(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 10: Guard - Invalid Status Choice", () => {
      return _testScenario10_InvalidStatusGuard(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 11: Guard - Nonexistent Enrollment", () => {
      return _testScenario11_NonexistentEnrollmentGuard(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 12: Pipeline LIFO Rollback on Course Mismatch Error", () => {
      return _testScenario12_PipelineRollbackOnCourseMismatch(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 13: ApiDispatcher Routing Integration (academic_update_enrollment)", () => {
      return _testScenario13_ApiDispatcherIntegration(db);
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
 * SCENARIO 1: Scalar properties update & batch allocation seat transfer on ENR-001001
 */
function _testScenario1_ScalarUpdateAndBatchTransfer(db) {
  const enrollmentId = "ENR-001001";
  const allocationId = "BAL-001001";

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
  const service = AcademicEnrollmentService.getInstance();
  const response = service.updateEnrollment(payload, context);

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
 * SCENARIO 2: Automatic seating status cascade & default waive_unpaid policy when Enrollment is withdrawn (ENR-001001)
 */
function _testScenario2_DefaultWaiveUnpaidOnWithdrawn(db) {
  const enrollmentId = "ENR-001001";
  const allocationId = "BAL-001001";

  const payload = {
    enrollment_id: enrollmentId,
    status: "withdrawn"
  };

  const context = { db: db, params: { payload: payload }, mutationManifest: [] };
  const service = AcademicEnrollmentService.getInstance();
  const response = service.updateEnrollment(payload, context);

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

  // Assert default waive_unpaid policy: SFA completed, balance_due 0, unpaid installments cancelled
  const sfa = db.StudentFeeAccount.findOne({ enrollment_id: enrollmentId });
  if (sfa) {
    if (sfa.status !== "completed") {
      throw new Error(`Expected SFA status 'completed', got '${sfa.status}'`);
    }
    if (sfa.balance_due !== 0) {
      throw new Error(`Expected SFA balance_due 0, got ${sfa.balance_due}`);
    }

    const installments = db.Installment.where({ student_fee_id: sfa.student_fee_id });
    installments.forEach(function (inst) {
      if (inst.paid_amount === 0 && inst.status !== "cancelled") {
        throw new Error(`Expected unpaid installment ${inst.installment_id} to be 'cancelled', got '${inst.status}'`);
      }
    });
  }

  return { enr_status: enr.status, alloc_status: alloc.status, sfa_status: sfa ? sfa.status : null };
}

/**
 * SCENARIO 3: settle_liability Policy on Zero-Paid Enrollment (ENR-002002)
 * Drops course, reschedules Installment #1 with required_amount (e.g. ₹3,000), cancels Installments #2..n
 */
function _testScenario3_SettleLiabilityZeroPaid(db) {
  const enrollmentId = "ENR-002002";
  const requiredAmount = 3000;

  const payload = {
    enrollment_id: enrollmentId,
    status: "withdrawn",
    financial_settlement: {
      policy: "settle_liability",
      required_amount: requiredAmount,
      due_date: "2026-09-15",
      remarks: "Drop penalty for 30 days attendance"
    }
  };

  const context = { db: db, params: { payload: payload }, mutationManifest: [] };
  const service = AcademicEnrollmentService.getInstance();
  const response = service.updateEnrollment(payload, context);

  if (!response || !response.success) {
    throw new Error(`Scenario 3 Failed: ${JSON.stringify(response)}`);
  }

  const sfa = db.StudentFeeAccount.findOne({ enrollment_id: enrollmentId });
  if (!sfa) throw new Error("SFA-002002 not found");

  if (sfa.final_fee !== requiredAmount) {
    throw new Error(`Expected SFA final_fee ${requiredAmount}, got ${sfa.final_fee}`);
  }
  if (sfa.balance_due !== requiredAmount) {
    throw new Error(`Expected SFA balance_due ${requiredAmount}, got ${sfa.balance_due}`);
  }
  if (sfa.status !== "active") {
    throw new Error(`Expected SFA status 'active' for pending liability, got '${sfa.status}'`);
  }

  const installments = db.Installment.where({ student_fee_id: sfa.student_fee_id });
  const sortedInst = installments.sort((a, b) => Number(a.installment_number || 1) - Number(b.installment_number || 1));

  if (sortedInst.length > 0) {
    const inst1 = sortedInst[0];
    if (inst1.due_amount !== requiredAmount) {
      throw new Error(`Expected Installment #1 due_amount ${requiredAmount}, got ${inst1.due_amount}`);
    }
    const dueDateStr = (typeof SheetDB !== 'undefined' && SheetDB.DateComparator)
      ? SheetDB.DateComparator.getLocalDateString(inst1.due_date)
      : ((typeof DateComparator !== 'undefined' && DateComparator.getLocalDateString)
        ? DateComparator.getLocalDateString(inst1.due_date)
        : (inst1.due_date instanceof Date ? inst1.due_date.toISOString().slice(0, 10) : String(inst1.due_date)));
    if (dueDateStr !== "2026-09-15") {
      throw new Error(`Expected Installment #1 due_date '2026-09-15', got '${dueDateStr}'`);
    }

    for (let i = 1; i < sortedInst.length; i++) {
      if (sortedInst[i].status !== "cancelled") {
        throw new Error(`Expected Installment #${i + 1} status 'cancelled', got '${sortedInst[i].status}'`);
      }
    }
  }

  return { final_fee: sfa.final_fee, balance_due: sfa.balance_due, inst1_due: sortedInst[0]?.due_amount };
}

/**
 * SCENARIO 4: settle_liability Policy on Partially-Paid Enrollment (ENR-001001)
 * Paid amount is ₹2,000, required liability is ₹5,000 -> balance_due should be ₹3,000
 */
function _testScenario4_SettleLiabilityPartiallyPaid(db) {
  const enrollmentId = "ENR-001001";
  const requiredAmount = 5000;

  // Restore SFA-001001 to active partially-paid state for test isolation
  const sfa = db.StudentFeeAccount.findOne({ enrollment_id: enrollmentId });
  if (sfa) {
    db.StudentFeeAccount.update(sfa.student_fee_id, {
      total_fee: 15000,
      final_fee: 15000,
      amount_paid: 2000,
      balance_due: 13000,
      status: "active"
    });
  }

  const payload = {
    enrollment_id: enrollmentId,
    status: "withdrawn",
    financial_settlement: {
      policy: "settle_liability",
      required_amount: requiredAmount,
      remarks: "Partial liability settlement"
    }
  };

  const context = { db: db, params: { payload: payload }, mutationManifest: [] };
  const service = AcademicEnrollmentService.getInstance();
  const response = service.updateEnrollment(payload, context);

  if (!response || !response.success) {
    throw new Error(`Scenario 4 Failed: ${JSON.stringify(response)}`);
  }

  const updatedSfa = db.StudentFeeAccount.findOne({ enrollment_id: enrollmentId });
  if (updatedSfa.final_fee !== requiredAmount) {
    throw new Error(`Expected SFA final_fee ${requiredAmount}, got ${updatedSfa.final_fee}`);
  }
  if (updatedSfa.balance_due !== (requiredAmount - 2000)) {
    throw new Error(`Expected SFA balance_due ${requiredAmount - 2000}, got ${updatedSfa.balance_due}`);
  }

  return { final_fee: updatedSfa.final_fee, amount_paid: updatedSfa.amount_paid, balance_due: updatedSfa.balance_due };
}

/**
 * SCENARIO 5: refund Policy on Withdrawn (ENR-001001 - Negative Payment Created)
 */
function _testScenario5_RefundPolicyOnWithdrawn(db) {
  const enrollmentId = "ENR-001001";

  // Restore SFA-001001 with ₹2,000 paid
  const sfa = db.StudentFeeAccount.findOne({ enrollment_id: enrollmentId });
  if (sfa) {
    db.StudentFeeAccount.update(sfa.student_fee_id, {
      amount_paid: 2000,
      balance_due: 13000,
      status: "active"
    });
  }

  const payload = {
    enrollment_id: enrollmentId,
    status: "withdrawn",
    financial_settlement: {
      policy: "refund",
      refund_amount: 2000,
      payment_method: "bank_transfer",
      remarks: "Full refund issued on medical drop"
    }
  };

  const context = { db: db, params: { payload: payload }, user: { username: "admin_tester" }, mutationManifest: [] };
  const service = AcademicEnrollmentService.getInstance();
  const response = service.updateEnrollment(payload, context);

  if (!response || !response.success) {
    throw new Error(`Scenario 5 Failed: ${JSON.stringify(response)}`);
  }

  const updatedSfa = db.StudentFeeAccount.findOne({ enrollment_id: enrollmentId });
  if (updatedSfa.status !== "refunded") {
    throw new Error(`Expected SFA status 'refunded', got '${updatedSfa.status}'`);
  }
  if (updatedSfa.amount_paid !== 0) {
    throw new Error(`Expected SFA amount_paid 0 after refund, got ${updatedSfa.amount_paid}`);
  }

  // Assert negative refund payment was inserted
  const payments = db.Payment.where({ student_fee_id: sfa.student_fee_id });
  const refundPmt = payments.find(p => Number(p.amount_paid) < 0);
  if (!refundPmt || Number(refundPmt.amount_paid) !== -2000) {
    throw new Error(`Expected refund payment of -2000, got ${refundPmt ? refundPmt.amount_paid : 'none'}`);
  }

  return { sfa_status: updatedSfa.status, refund_payment_id: refundPmt.payment_id, refund_amount: refundPmt.amount_paid };
}

/**
 * SCENARIO 6: prorated_refund Policy on Withdrawn (ENR-001001)
 */
function _testScenario6_ProratedRefundPolicy(db) {
  const enrollmentId = "ENR-001001";

  // Setup SFA with ₹2,000 paid, retain ₹500, refund ₹1,500
  const sfa = db.StudentFeeAccount.findOne({ enrollment_id: enrollmentId });
  if (sfa) {
    db.StudentFeeAccount.update(sfa.student_fee_id, {
      amount_paid: 2000,
      balance_due: 13000,
      status: "active"
    });
  }

  const payload = {
    enrollment_id: enrollmentId,
    status: "withdrawn",
    financial_settlement: {
      policy: "prorated_refund",
      retained_amount: 500,
      refund_amount: 1500,
      remarks: "Prorated 1-week attendance fee deduction"
    }
  };

  const context = { db: db, params: { payload: payload }, user: { username: "admin_tester" }, mutationManifest: [] };
  const service = AcademicEnrollmentService.getInstance();
  const response = service.updateEnrollment(payload, context);

  if (!response || !response.success) {
    throw new Error(`Scenario 6 Failed: ${JSON.stringify(response)}`);
  }

  const updatedSfa = db.StudentFeeAccount.findOne({ enrollment_id: enrollmentId });
  if (updatedSfa.final_fee !== 500) {
    throw new Error(`Expected SFA final_fee 500, got ${updatedSfa.final_fee}`);
  }
  if (updatedSfa.amount_paid !== 500) {
    throw new Error(`Expected SFA amount_paid 500, got ${updatedSfa.amount_paid}`);
  }
  if (updatedSfa.balance_due !== 0) {
    throw new Error(`Expected SFA balance_due 0, got ${updatedSfa.balance_due}`);
  }

  return { sfa_final_fee: updatedSfa.final_fee, sfa_amount_paid: updatedSfa.amount_paid };
}

/**
 * SCENARIO 7: retain_ledger Policy on Withdrawn (ENR-001001)
 */
function _testScenario7_RetainLedgerPolicy(db) {
  const enrollmentId = "ENR-001001";

  const payload = {
    enrollment_id: enrollmentId,
    status: "withdrawn",
    financial_settlement: {
      policy: "retain_ledger",
      remarks: "Audit review pending by accounts"
    }
  };

  const context = { db: db, params: { payload: payload }, mutationManifest: [] };
  const service = AcademicEnrollmentService.getInstance();
  const response = service.updateEnrollment(payload, context);

  if (!response || !response.success) {
    throw new Error(`Scenario 7 Failed: ${JSON.stringify(response)}`);
  }

  const enr = db.Enrollment.findById(enrollmentId);
  if (enr.status !== "withdrawn") {
    throw new Error(`Expected Enrollment status 'withdrawn', got '${enr.status}'`);
  }

  return { enr_status: enr.status, policy: "retain_ledger" };
}

/**
 * SCENARIO 8: Pre-flight validation guard: Missing or negative required_amount in settle_liability
 */
function _testScenario8_InvalidSettleLiabilityGuard(db) {
  const payload = {
    enrollment_id: "ENR-001001",
    status: "withdrawn",
    financial_settlement: {
      policy: "settle_liability",
      required_amount: -500 // Negative value prohibited
    }
  };

  let caught = false;
  try {
    const service = AcademicEnrollmentService.getInstance();
    service.updateEnrollment(payload, {});
  } catch (err) {
    caught = true;
    if (err.errorCode !== "INVALID_FINANCIAL_SETTLEMENT" && err.name !== "AcademicEnrollmentError") {
      throw new Error(`Expected INVALID_FINANCIAL_SETTLEMENT, got '${err.errorCode}'`);
    }
  }

  if (!caught) {
    throw new Error("Expected exception for negative required_amount in settle_liability.");
  }
}

/**
 * SCENARIO 9: Pre-flight validation guard: refund_amount exceeds accumulated amount_paid
 */
function _testScenario9_RefundExceedsPaidGuard(db) {
  const sfa = db.StudentFeeAccount.findOne({ enrollment_id: "ENR-001001" });
  const totalPaid = sfa ? Number(sfa.amount_paid || 0) : 0;

  const payload = {
    enrollment_id: "ENR-001001",
    status: "withdrawn",
    financial_settlement: {
      policy: "refund",
      refund_amount: totalPaid + 50000 // Exceeds paid amount
    }
  };

  let caught = false;
  try {
    const service = AcademicEnrollmentService.getInstance();
    service.updateEnrollment(payload, {});
  } catch (err) {
    caught = true;
    if (err.errorCode !== "INVALID_FINANCIAL_SETTLEMENT" && err.name !== "AcademicEnrollmentError") {
      throw new Error(`Expected INVALID_FINANCIAL_SETTLEMENT, got '${err.errorCode}'`);
    }
  }

  if (!caught) {
    throw new Error("Expected exception when refund_amount exceeds amount_paid.");
  }
}

/**
 * SCENARIO 10: Pre-flight invalid status choice guard (VALIDATION_FAILURE)
 */
function _testScenario10_InvalidStatusGuard(db) {
  const payload = {
    enrollment_id: "ENR-001001",
    status: "invalid_status_enum_choice"
  };

  let caught = false;
  try {
    const service = AcademicEnrollmentService.getInstance();
    service.updateEnrollment(payload, {});
  } catch (err) {
    caught = true;
  }

  if (!caught) {
    throw new Error("Expected exception for invalid status choice, but none was thrown.");
  }
}

/**
 * SCENARIO 11: Pre-flight nonexistent enrollment guard (ENROLLMENT_NOT_FOUND)
 */
function _testScenario11_NonexistentEnrollmentGuard(db) {
  const payload = {
    enrollment_id: "ENR-NONEXISTENT-999",
    roll_number: 5555
  };

  let caught = false;
  try {
    const service = AcademicEnrollmentService.getInstance();
    service.updateEnrollment(payload, {});
  } catch (err) {
    caught = true;
    if (err.errorCode !== "ENROLLMENT_NOT_FOUND") {
      throw new Error(`Expected errorCode ENROLLMENT_NOT_FOUND, got '${err.errorCode}'`);
    }
  }

  if (!caught) {
    throw new Error("Expected exception for nonexistent enrollment, but none was thrown.");
  }
}

/**
 * SCENARIO 12: Pipeline LIFO Rollback when batch course_id does not match allocation course_id
 */
function _testScenario12_PipelineRollbackOnCourseMismatch(db) {
  const enrollmentId = "ENR-001001";
  const allocationId = "BAL-001001";
  const mismatchedBatchId = "BAT-MAT12A02"; // Belongs to CRS-MAT003, whereas BAL-001001 is for CRS-PHY001

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

  let caught = false;
  try {
    const service = AcademicEnrollmentService.getInstance();
    service.updateEnrollment(payload, {});
  } catch (err) {
    caught = true;
  }

  if (!caught) {
    throw new Error("Expected exception due to course mismatch, but request succeeded.");
  }

  const afterRollback = db.Enrollment.findById(enrollmentId);
  if (afterRollback.roll_number !== 2000) {
    throw new Error(`Rollback assertion failed: roll_number should be restored to 2000, got ${afterRollback.roll_number}`);
  }
}

/**
 * SCENARIO 13: ApiDispatcher routing integration (academic_update_enrollment)
 */
function _testScenario13_ApiDispatcherIntegration(db) {
  const payload = {
    enrollment_id: "ENR-001001",
    roll_number: 8888
  };

  const action = new UpdateEnrollmentAction();
  const mockContext = {
    db: db,
    params: {
      action: "academic_update_enrollment",
      payload: payload
    },
    user: { username: "admin_tester", role: "admin" }
  };

  const response = action.run(mockContext);

  if (!response.success) {
    throw new Error(`Action execution failed: ${JSON.stringify(response.error)}`);
  }
  const resData = (response.data && response.data.data) ? response.data.data : response.data;
  if (!resData || !resData.enrollment || resData.enrollment.roll_number !== 8888) {
    throw new Error(`Expected response enrollment roll_number 8888, got '${resData ? resData.enrollment?.roll_number : null}'`);
  }
}

// Bind top-level entry point to global namespace for Apps Script execution
globalThis.runAcademicUpdateEnrollmentTests = runAcademicUpdateEnrollmentTests;

