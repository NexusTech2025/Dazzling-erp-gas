/**
 * @file Academic_MigrateEnrollmentTests.js
 * Path: DazzlingDB/Test/Academic_MigrateEnrollmentTests.js
 * 
 * Google Apps Script Integration & Diagnostic Test Suite for:
 * Academic Enrollment Migration (`academic_migrate_enrollment`) & AcademicEnrollmentService.migrateEnrollment.
 * 
 * Leverages ApiTestSeedHook / FixedMockData predefined seeding mechanism:
 * - ENR-001001 (Student STU-001001, Course CRS-PHY001, SFA-001001, amount_paid: 2000, INS-001001: 2000/7500, INS-001002: 0/7500)
 * - ENR-002002 (Student STU-002002, Package PKG-PCM1201, SFA-002002, amount_paid: 0, INS-002001 & INS-002002: pending 0/17500)
 */

function runAcademicMigrateEnrollmentTests() {
  console.log("===============================================================");
  console.log("🧪 STARTING INTEGRATION SUITE: Academic Enrollment Migration (academic_migrate_enrollment)");
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
    _executeScenario("Scenario 1: Course to Package Migration with Payment Rollover (ENR-001001 -> PKG-PCM1201)", () => {
      return _testScenario1_CourseToPackageMigrationWithRollover(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 2: Course to Package Migration without Payment Rollover (ENR-001001 -> PKG-PCM1201)", () => {
      return _testScenario2_CourseToPackageMigrationWithoutRollover(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 3: Package to Course Downward Migration (ENR-002002 -> CRS-CHE002)", () => {
      return _testScenario3_PackageToCourseMigration(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 4: Batch Allocation Assignment Mapping Verification", () => {
      return _testScenario4_BatchAllocationAssignmentMapping(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 5: Installment Plan Schedule Provisioning Verification", () => {
      return _testScenario5_InstallmentPlanScheduleProvisioning(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 6: Source Enrollment Not Found Guard Enforcement (ENROLLMENT_NOT_FOUND)", () => {
      return _testScenario6_SourceEnrollmentNotFoundGuard(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 7: Already Closed Enrollment Guard Enforcement (ALREADY_CLOSED)", () => {
      return _testScenario7_AlreadyClosedEnrollmentGuard(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 8: Target Same as Source Guard Enforcement (TARGET_SAME_AS_SOURCE)", () => {
      return _testScenario8_TargetSameAsSourceGuard(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 9: Target Package/Course Not Found Guard Enforcement (TARGET_NOT_FOUND)", () => {
      return _testScenario9_TargetNotFoundGuard(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 10: Invalid Target Type Action Validation", () => {
      return _testScenario10_InvalidTargetTypeActionValidation(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 11: ApiDispatcher Controller Routing Verification (academic_migrate_enrollment)", () => {
      return _testScenario11_ApiDispatcherRouting(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 12: Metadata Course Fees Snapshot Verification", () => {
      return _testScenario12_MetadataCourseFeesSnapshotVerification(db);
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

function _testScenario1_CourseToPackageMigrationWithRollover(db) {
  const service = AcademicEnrollmentService.getInstance();

  const result = service.migrateEnrollment({
    enrollment_id: "ENR-001001",
    target_type: "package",
    target_id: "PKG-PCM1201",
    rollover_payments: true,
    new_fee: 40000,
    remarks: "Upgraded to Grade 12 PCM package"
  }, {});

  if (!result.success) throw new Error("Expected result.success === true");
  if (result.data.old_contract.status !== "withdrawn") throw new Error(`Expected old contract status 'withdrawn', got '${result.data.old_contract.status}'`);
  if (result.data.new_contract.enrollment_type !== "package") throw new Error(`Expected new enrollment_type 'package', got '${result.data.new_contract.enrollment_type}'`);
  if (result.data.new_contract.amount_paid !== 2000) throw new Error(`Expected rollover amount_paid 2000, got ${result.data.new_contract.amount_paid}`);
  if (result.data.new_contract.balance_due !== 38000) throw new Error(`Expected balance_due 38000, got ${result.data.new_contract.balance_due}`);

  // Assert DB State
  const oldEnr = db.Enrollment.findById("ENR-001001");
  if (oldEnr.status !== "withdrawn") throw new Error(`Expected old Enrollment status 'withdrawn', got '${oldEnr.status}'`);

  const oldSfa = db.StudentFeeAccount.findOne({ enrollment_id: "ENR-001001" });
  if (oldSfa.status !== "completed") throw new Error(`Expected old SFA status 'completed', got '${oldSfa.status}'`);
  if (Number(oldSfa.balance_due) !== 0) throw new Error(`Expected old SFA balance_due 0, got ${oldSfa.balance_due}`);

  const oldAlloc = db.BatchAllocation.findOne({ enrollment_id: "ENR-001001" });
  if (oldAlloc.status !== "dropped") throw new Error(`Expected old allocation status 'dropped', got '${oldAlloc.status}'`);

  const newEnr = db.Enrollment.findById(result.data.new_contract.enrollment_id);
  if (!newEnr) throw new Error("Expected new Enrollment record in DB");
  if (newEnr.status !== "active") throw new Error(`Expected new Enrollment status 'active', got '${newEnr.status}'`);

  const newAllocations = db.BatchAllocation.where({ enrollment_id: newEnr.enrollment_id });
  if (newAllocations.length === 0) throw new Error("Expected new BatchAllocations created for package courses");
}

function _testScenario2_CourseToPackageMigrationWithoutRollover(db) {
  const service = AcademicEnrollmentService.getInstance();

  const result = service.migrateEnrollment({
    enrollment_id: "ENR-001002",
    target_type: "package",
    target_id: "PKG-PCM1201",
    rollover_payments: false
  }, {});

  if (!result.success) throw new Error("Expected result.success === true");
  if (result.data.new_contract.amount_paid !== 0) throw new Error(`Expected amount_paid 0 without rollover, got ${result.data.new_contract.amount_paid}`);
  if (result.data.new_contract.balance_due !== 40000) throw new Error(`Expected balance_due 40000, got ${result.data.new_contract.balance_due}`);
}

function _testScenario3_PackageToCourseMigration(db) {
  const service = AcademicEnrollmentService.getInstance();

  const result = service.migrateEnrollment({
    enrollment_id: "ENR-002002",
    target_type: "course",
    target_id: "CRS-CHE002",
    rollover_payments: false
  }, {});

  if (!result.success) throw new Error("Expected result.success === true");
  if (result.data.new_contract.enrollment_type !== "course") throw new Error(`Expected new enrollment_type 'course', got '${result.data.new_contract.enrollment_type}'`);
  if (result.data.new_contract.allocations_created !== 1) throw new Error(`Expected 1 allocation created for single course, got ${result.data.new_contract.allocations_created}`);
}

function _testScenario4_BatchAllocationAssignmentMapping(db) {
  const service = AcademicEnrollmentService.getInstance();

  const result = service.migrateEnrollment({
    enrollment_id: "ENR-001004",
    target_type: "package",
    target_id: "PKG-PCM1201",
    batch_assignments: [
      { course_id: "CRS-PHY001", batch_id: "BAT-PHY12A01" }
    ]
  }, {});

  const newAllocations = db.BatchAllocation.where({ enrollment_id: result.data.new_contract.enrollment_id });
  const phyAlloc = newAllocations.find(a => a.course_id === "CRS-PHY001");
  if (!phyAlloc) throw new Error("Expected BatchAllocation for CRS-PHY001");
  if (phyAlloc.batch_id !== "BAT-PHY12A01") throw new Error(`Expected batch_id 'BAT-PHY12A01', got '${phyAlloc.batch_id}'`);
}

function _testScenario5_InstallmentPlanScheduleProvisioning(db) {
  const service = AcademicEnrollmentService.getInstance();

  const result = service.migrateEnrollment({
    enrollment_id: "ENR-001005",
    target_type: "package",
    target_id: "PKG-PCM1201",
    rollover_payments: true,
    new_fee: 40000,
    installment_plan: [
      { due_date: "2026-09-01", due_amount: 19000 },
      { due_date: "2026-10-01", due_amount: 19000 }
    ]
  }, {});

  if (result.data.new_contract.installments_created !== 2) {
    throw new Error(`Expected 2 installments created, got ${result.data.new_contract.installments_created}`);
  }

  const newInsts = db.Installment.where({ student_fee_id: result.data.new_contract.fee_account_id });
  if (newInsts.length !== 2) throw new Error(`Expected 2 Installment records in DB, found ${newInsts.length}`);
  if (Number(newInsts[0].due_amount) !== 19000) throw new Error(`Expected installment 1 due_amount 19000, got ${newInsts[0].due_amount}`);
}

function _testScenario6_SourceEnrollmentNotFoundGuard(db) {
  const service = AcademicEnrollmentService.getInstance();

  let caught = false;
  try {
    service.migrateEnrollment({
      enrollment_id: "ENR-NONEXISTENT",
      target_type: "package",
      target_id: "PKG-PCM1201"
    }, {});
  } catch (err) {
    caught = true;
    if (err.errorCode !== "ENROLLMENT_NOT_FOUND") {
      throw new Error(`Expected ENROLLMENT_NOT_FOUND error code, got '${err.errorCode}'`);
    }
  }
  if (!caught) throw new Error("Expected ENROLLMENT_NOT_FOUND error to be thrown");
}

function _testScenario7_AlreadyClosedEnrollmentGuard(db) {
  const service = AcademicEnrollmentService.getInstance();

  service.discardEnrollment({ enrollment_id: "ENR-001007", discard_mode: "no_refund" }, {});

  let caught = false;
  try {
    service.migrateEnrollment({
      enrollment_id: "ENR-001007",
      target_type: "package",
      target_id: "PKG-PCM1201"
    }, {});
  } catch (err) {
    caught = true;
    if (err.errorCode !== "ALREADY_CLOSED") {
      throw new Error(`Expected ALREADY_CLOSED error code, got '${err.errorCode}'`);
    }
  }
  if (!caught) throw new Error("Expected ALREADY_CLOSED error to be thrown");
}

function _testScenario8_TargetSameAsSourceGuard(db) {
  const service = AcademicEnrollmentService.getInstance();

  let caught = false;
  try {
    service.migrateEnrollment({
      enrollment_id: "ENR-001008",
      target_type: "course",
      target_id: "CRS-PHY001"
    }, {});
  } catch (err) {
    caught = true;
    if (err.errorCode !== "TARGET_SAME_AS_SOURCE") {
      throw new Error(`Expected TARGET_SAME_AS_SOURCE error code, got '${err.errorCode}'`);
    }
  }
  if (!caught) throw new Error("Expected TARGET_SAME_AS_SOURCE error to be thrown");
}

function _testScenario9_TargetNotFoundGuard(db) {
  const service = AcademicEnrollmentService.getInstance();

  let caught = false;
  try {
    service.migrateEnrollment({
      enrollment_id: "ENR-001009",
      target_type: "package",
      target_id: "PKG-INVALID"
    }, {});
  } catch (err) {
    caught = true;
    if (err.errorCode !== "TARGET_NOT_FOUND") {
      throw new Error(`Expected TARGET_NOT_FOUND error code, got '${err.errorCode}'`);
    }
  }
  if (!caught) throw new Error("Expected TARGET_NOT_FOUND error to be thrown");
}

function _testScenario10_InvalidTargetTypeActionValidation(db) {
  const action = new MigrateEnrollmentAction();

  const response = action.run({
    db: db,
    params: {
      payload: {
        enrollment_id: "ENR-001001",
        target_type: "invalid_type",
        target_id: "PKG-PCM1201"
      }
    }
  });

  if (response.success !== false) {
    throw new Error("Expected response.success === false for invalid target_type");
  }
  if (!response.error || !response.error.message || !response.error.message.includes("target_type")) {
    throw new Error(`Expected target_type validation error message in envelope, got '${response.error ? response.error.message : null}'`);
  }
}

function _testScenario11_ApiDispatcherRouting(db) {
  const action = new MigrateEnrollmentAction();

  const mockRequestContext = {
    db: db,
    params: {
      action: "academic_migrate_enrollment",
      payload: {
        enrollment_id: "ENR-001011",
        target_type: "package",
        target_id: "PKG-PCM1201",
        rollover_payments: true
      }
    },
    user: { username: "admin_tester", role: "admin" }
  };

  const response = action.run(mockRequestContext);

  if (!response.success) throw new Error(`Action execution failed: ${JSON.stringify(response.error)}`);
  if (!response.data.old_contract || response.data.old_contract.status !== "withdrawn") {
    throw new Error("Expected old_contract.status 'withdrawn'");
  }
  if (!response.data.new_contract || response.data.new_contract.status !== "active") {
    throw new Error("Expected new_contract.status 'active'");
  }
}

function _testScenario12_MetadataCourseFeesSnapshotVerification(db) {
  const service = AcademicEnrollmentService.getInstance();

  const result = service.migrateEnrollment({
    enrollment_id: "ENR-001012",
    target_type: "package",
    target_id: "PKG-PCM1201"
  }, {});

  const newEnr = db.Enrollment.findById(result.data.new_contract.enrollment_id);
  const metadata = typeof newEnr.metadata === 'string' ? JSON.parse(newEnr.metadata) : newEnr.metadata;

  if (!metadata || !metadata.course_fees) throw new Error("Expected course_fees in new Enrollment metadata");
  if (metadata.migrated_from !== "ENR-001012") throw new Error(`Expected migrated_from 'ENR-001012', got '${metadata.migrated_from}'`);
  if (typeof metadata.course_fees["CRS-PHY001"] === 'undefined') throw new Error("Expected CRS-PHY001 in course_fees map");
}

// Bind top-level entry point to global namespace for Apps Script execution
globalThis.runAcademicMigrateEnrollmentTests = runAcademicMigrateEnrollmentTests;
