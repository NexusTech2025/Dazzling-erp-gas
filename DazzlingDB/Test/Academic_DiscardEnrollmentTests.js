/**
 * @file Academic_DiscardEnrollmentTests.js
 * Path: DazzlingDB/Test/Academic_DiscardEnrollmentTests.js
 * 
 * Google Apps Script Integration & Diagnostic Test Suite for:
 * Academic Enrollment Discard (`academic_discard_enrollment`) & AcademicEnrollmentService.discardEnrollment.
 * 
 * Leverages ApiTestSeedHook / FixedMockData predefined seeding mechanism:
 * - ENR-001001 (Student STU-001001, Course CRS-PHY001, SFA-001001, amount_paid: 2000, INS-001001: 2000/7500, INS-001002: 0/7500)
 * - ENR-002002 (Student STU-002002, Package PKG-PCM1201, SFA-002002, amount_paid: 0, INS-002001 & INS-002002: pending 0/17500)
 */

function runAcademicDiscardEnrollmentTests() {
  console.log("===============================================================");
  console.log("🧪 STARTING INTEGRATION SUITE: Academic Enrollment Discard (academic_discard_enrollment)");
  console.log("===============================================================");

  const originalEnv = (typeof PropertiesService !== 'undefined' && PropertiesService.getScriptProperties())
    ? (PropertiesService.getScriptProperties().getProperty('ENV') || 'DEVELOPMENT')
    : 'DEVELOPMENT';

  if (typeof PropertiesService !== 'undefined' && PropertiesService.getScriptProperties()) {
    PropertiesService.getScriptProperties().setProperty('ENV', 'TESTING');
  }

  let passedCount = 0;
  let failedCount = 0;

  try {
    // 1. Seed predefined mock dataset via ApiTestSeedHook / FixedMockData
    if (typeof ApiTestSeedHook !== 'undefined') {
      console.log("🌱 Seeding database via ApiTestSeedHook...");
      ApiTestSeedHook.seed({ env: "TESTING" });
    } else if (typeof FixedMockData !== 'undefined') {
      console.log("🌱 Seeding database via FixedMockData...");
      FixedMockData.seedLiveDatabase();
    }

    const db = DBContext.getInstance();

    // Execute Test Scenarios
    _executeScenario("Scenario 1: Refund Discard Mode on Paid Enrollment (ENR-001001)", () => {
      return _testScenario1_RefundDiscardPaidEnrollment(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 2: No-Refund Discard Mode on Paid Enrollment (ENR-001001)", () => {
      return _testScenario2_NoRefundDiscardPaidEnrollment(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 3: No-Refund Discard Mode on Zero-Paid Enrollment (ENR-002002)", () => {
      return _testScenario3_NoRefundDiscardZeroPaidEnrollment(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 4: Non-Existent Enrollment Guard Enforcement (ENROLLMENT_NOT_FOUND)", () => {
      return _testScenario4_NonExistentEnrollmentGuard(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 5: Already Discarded Guard Enforcement (ALREADY_DISCARDED)", () => {
      return _testScenario5_AlreadyDiscardedGuard(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 6: Invalid Discard Mode Action Validation", () => {
      return _testScenario6_InvalidDiscardModeActionValidation(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 7: Missing Enrollment ID Action Validation", () => {
      return _testScenario7_MissingEnrollmentIdActionValidation(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 8: ApiDispatcher Controller Routing Verification (academic_discard_enrollment)", () => {
      return _testScenario8_ApiDispatcherRouting(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 9: Seating Allocation Dropped Timestamp Verification", () => {
      return _testScenario9_SeatingAllocationDroppedVerification(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 10: Mutation Manifest Audit Verification", () => {
      return _testScenario10_MutationManifestAuditVerification(db);
    }, () => passedCount++, () => failedCount++);

  } finally {
    // Teardown & Restore Environment
    console.log("\n🧹 Cleaning up test database...");
    if (typeof FixedMockData !== 'undefined') {
      FixedMockData.purgeFromLiveDatabase();
    }
    if (typeof PropertiesService !== 'undefined' && PropertiesService.getScriptProperties()) {
      PropertiesService.getScriptProperties().setProperty('ENV', originalEnv);
      console.log(`   ✅ Restored environment state to: ${originalEnv}`);
    }

    console.log("\n===============================================================");
    console.log(`📊 TEST SUITE SUMMARY: Passed: ${passedCount} | Failed: ${failedCount}`);
    console.log("===============================================================\n");
  }
}

// -----------------------------------------------------------------------------
// SCENARIO IMPLEMENTATIONS
// -----------------------------------------------------------------------------

function _executeScenario(name, scenarioFn, onSuccess, onFailure) {
  console.log(`\n▶️ [Test] ${name}`);
  try {
    scenarioFn();
    console.log(`   ✅ PASSED: ${name}`);
    if (onSuccess) onSuccess();
  } catch (err) {
    console.error(`   ❌ FAILED: ${name}`);
    console.error(`      Reason: ${err.message}`);
    if (onFailure) onFailure();
  }
}

function _reseedDatabase() {
  if (typeof FixedMockData !== 'undefined') {
    FixedMockData.purgeFromLiveDatabase();
    FixedMockData.seedLiveDatabase();
  }
}

function _testScenario1_RefundDiscardPaidEnrollment(db) {
  _reseedDatabase();
  const service = AcademicEnrollmentService.getInstance();
  
  const result = service.discardEnrollment({
    enrollment_id: "ENR-001001",
    discard_mode: "refund",
    remarks: "Full refund issued per customer request"
  }, {});

  if (!result.success) throw new Error("Expected result.success === true");
  if (result.data.status !== "discarded") throw new Error(`Expected status 'discarded', got '${result.data.status}'`);
  if (result.data.refund_amount !== 2000) throw new Error(`Expected refund_amount 2000, got ${result.data.refund_amount}`);

  // Assert DB State
  const enr = db.Enrollment.findById("ENR-001001");
  if (enr.status !== "discarded") throw new Error(`Expected Enrollment status 'discarded', got '${enr.status}'`);
  if (enr.academic_status !== "withdrawn") throw new Error(`Expected Enrollment academic_status 'withdrawn', got '${enr.academic_status}'`);

  const sfa = db.StudentFeeAccount.findOne({ enrollment_id: "ENR-001001" });
  if (sfa.status !== "refunded") throw new Error(`Expected SFA status 'refunded', got '${sfa.status}'`);
  if (Number(sfa.amount_paid) !== 0) throw new Error(`Expected SFA amount_paid 0, got ${sfa.amount_paid}`);
  if (Number(sfa.balance_due) !== 0) throw new Error(`Expected SFA balance_due 0, got ${sfa.balance_due}`);

  const payments = db.Payment.where({ student_fee_id: sfa.student_fee_id });
  const refundPayment = payments.find(p => Number(p.amount_paid) === -2000);
  if (!refundPayment) throw new Error("Expected negative refund payment record (-2000) in Payment table");

  const alloc = db.BatchAllocation.findOne({ enrollment_id: "ENR-001001" });
  if (alloc.status !== "dropped") throw new Error(`Expected allocation status 'dropped', got '${alloc.status}'`);
  if (!alloc.dropped_at) throw new Error("Expected dropped_at timestamp on BatchAllocation");

  const inst2 = db.Installment.findById("INS-001002");
  if (inst2.status !== "cancelled") throw new Error(`Expected unpaid installment status 'cancelled', got '${inst2.status}'`);
}

function _testScenario2_NoRefundDiscardPaidEnrollment(db) {
  _reseedDatabase();
  const service = AcademicEnrollmentService.getInstance();

  const result = service.discardEnrollment({
    enrollment_id: "ENR-001001",
    discard_mode: "no_refund",
    remarks: "Discarded without refund per policy"
  }, {});

  if (!result.success) throw new Error("Expected result.success === true");
  if (result.data.status !== "discarded") throw new Error(`Expected status 'discarded', got '${result.data.status}'`);
  if (result.data.refund_amount !== 0) throw new Error(`Expected refund_amount 0, got ${result.data.refund_amount}`);

  const sfa = db.StudentFeeAccount.findOne({ enrollment_id: "ENR-001001" });
  if (sfa.status !== "cancelled") throw new Error(`Expected SFA status 'cancelled', got '${sfa.status}'`);
  if (Number(sfa.amount_paid) !== 2000) throw new Error(`Expected SFA amount_paid 2000 preserved, got ${sfa.amount_paid}`);
  if (Number(sfa.balance_due) !== 0) throw new Error(`Expected SFA balance_due 0, got ${sfa.balance_due}`);

  const inst2 = db.Installment.findById("INS-001002");
  if (inst2.status !== "cancelled") throw new Error(`Expected unpaid installment status 'cancelled', got '${inst2.status}'`);
}

function _testScenario3_NoRefundDiscardZeroPaidEnrollment(db) {
  _reseedDatabase();
  const service = AcademicEnrollmentService.getInstance();

  const result = service.discardEnrollment({
    enrollment_id: "ENR-002002",
    discard_mode: "no_refund"
  }, {});

  if (!result.success) throw new Error("Expected result.success === true");

  const sfa = db.StudentFeeAccount.findOne({ enrollment_id: "ENR-002002" });
  if (sfa.status !== "cancelled") throw new Error(`Expected SFA status 'cancelled', got '${sfa.status}'`);
  if (Number(sfa.balance_due) !== 0) throw new Error(`Expected SFA balance_due 0, got ${sfa.balance_due}`);

  const inst1 = db.Installment.findById("INS-002001");
  const inst2 = db.Installment.findById("INS-002002");
  if (inst1.status !== "cancelled" || inst2.status !== "cancelled") {
    throw new Error(`Expected both installments cancelled, got INS-002001: ${inst1.status}, INS-002002: ${inst2.status}`);
  }
}

function _testScenario4_NonExistentEnrollmentGuard(db) {
  _reseedDatabase();
  const service = AcademicEnrollmentService.getInstance();

  let caught = false;
  try {
    service.discardEnrollment({ enrollment_id: "ENR-NONEXISTENT", discard_mode: "refund" }, {});
  } catch (err) {
    caught = true;
    if (err.errorCode !== "ENROLLMENT_NOT_FOUND") {
      throw new Error(`Expected ENROLLMENT_NOT_FOUND error code, got '${err.errorCode}'`);
    }
  }
  if (!caught) throw new Error("Expected ENROLLMENT_NOT_FOUND error to be thrown");
}

function _testScenario5_AlreadyDiscardedGuard(db) {
  _reseedDatabase();
  const service = AcademicEnrollmentService.getInstance();

  service.discardEnrollment({ enrollment_id: "ENR-001001", discard_mode: "refund" }, {});

  let caught = false;
  try {
    service.discardEnrollment({ enrollment_id: "ENR-001001", discard_mode: "refund" }, {});
  } catch (err) {
    caught = true;
    if (err.errorCode !== "ALREADY_DISCARDED") {
      throw new Error(`Expected ALREADY_DISCARDED error code, got '${err.errorCode}'`);
    }
  }
  if (!caught) throw new Error("Expected ALREADY_DISCARDED error to be thrown");
}

function _testScenario6_InvalidDiscardModeActionValidation(db) {
  _reseedDatabase();
  const action = new DiscardEnrollmentAction();

  let caught = false;
  try {
    action.run({
      db: db,
      params: {
        payload: { enrollment_id: "ENR-001001", discard_mode: "invalid_mode" }
      }
    });
  } catch (err) {
    caught = true;
    if (!err.message || !err.message.includes("discard_mode")) {
      throw new Error(`Expected discard_mode validation error message, got '${err.message}'`);
    }
  }
  if (!caught) throw new Error("Expected ActionValidationError to be thrown");
}

function _testScenario7_MissingEnrollmentIdActionValidation(db) {
  _reseedDatabase();
  const action = new DiscardEnrollmentAction();

  let caught = false;
  try {
    action.run({
      db: db,
      params: {
        payload: { discard_mode: "refund" }
      }
    });
  } catch (err) {
    caught = true;
    if (!err.message || !err.message.includes("enrollment_id")) {
      throw new Error(`Expected enrollment_id validation error message, got '${err.message}'`);
    }
  }
  if (!caught) throw new Error("Expected ActionValidationError to be thrown");
}

function _testScenario8_ApiDispatcherRouting(db) {
  _reseedDatabase();
  const action = new DiscardEnrollmentAction();

  const mockRequestContext = {
    db: db,
    params: {
      action: "academic_discard_enrollment",
      payload: {
        enrollment_id: "ENR-002002",
        discard_mode: "no_refund",
        remarks: "Dispatched via ApiDispatcher"
      }
    },
    user: { username: "admin_tester", role: "admin" }
  };

  const response = action.run(mockRequestContext);

  if (!response.success) throw new Error(`Action execution failed: ${JSON.stringify(response.error)}`);
  if (response.data.status !== "discarded") throw new Error(`Expected status 'discarded', got '${response.data.status}'`);
}

function _testScenario9_SeatingAllocationDroppedVerification(db) {
  _reseedDatabase();
  const service = AcademicEnrollmentService.getInstance();

  service.discardEnrollment({ enrollment_id: "ENR-001001", discard_mode: "no_refund" }, {});

  const alloc = db.BatchAllocation.findOne({ enrollment_id: "ENR-001001" });
  if (alloc.status !== "dropped") throw new Error(`Expected allocation status 'dropped', got '${alloc.status}'`);
  if (!alloc.dropped_at) throw new Error("Expected dropped_at timestamp to be recorded");

  const droppedDate = new Date(alloc.dropped_at);
  if (isNaN(droppedDate.getTime())) throw new Error("Expected valid ISO date timestamp for dropped_at");
}

function _testScenario10_MutationManifestAuditVerification(db) {
  _reseedDatabase();
  const service = AcademicEnrollmentService.getInstance();

  const reqCtx = { mutationManifest: [] };
  service.discardEnrollment({ enrollment_id: "ENR-001001", discard_mode: "refund" }, reqCtx);

  const manifest = reqCtx.mutationManifest || [];
  if (!manifest.includes("Enrollment")) throw new Error("Expected 'Enrollment' in mutationManifest");
  if (!manifest.includes("BatchAllocation")) throw new Error("Expected 'BatchAllocation' in mutationManifest");
  if (!manifest.includes("StudentFeeAccount")) throw new Error("Expected 'StudentFeeAccount' in mutationManifest");
  if (!manifest.includes("Installment")) throw new Error("Expected 'Installment' in mutationManifest");
  if (!manifest.includes("Payment")) throw new Error("Expected 'Payment' in mutationManifest");
}

// Bind top-level entry point to global namespace for Apps Script execution
globalThis.runAcademicDiscardEnrollmentTests = runAcademicDiscardEnrollmentTests;
