/**
 * @file Student_DeleteUntouchedTests.js
 * Path: DazzlingDB/Test/Student_DeleteUntouchedTests.js
 *
 * Integration & Diagnostic Test Suite for:
 * - Student Delete Untouched Action (`student_delete_untouched`)
 * - StudentService.deleteUntouchedStudent
 * - StudentDeleteUntouchedValidationPipeline & ValidationEngine rules
 *
 * Verifies leaf-first LIFO cascade deletion of untouched student profiles with 0 payments
 * and asserts financial protection guards when payment receipts exist.
 */

function runStudentDeleteUntouchedTests() {
  console.log("===============================================================");
  console.log("🧪 STARTING INTEGRATION SUITE: Delete Untouched Student (student_delete_untouched)");
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
    db.bootstrapRepositories();

    // Execute Test Scenarios
    _executeScenario("Scenario 1: Purge Untouched Student (STU-002002 - 0 payments)", () => {
      return _testScenario1_PurgeUntouchedStudent(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 2: Financial Protection Guard Failure (STU-001001 - has payments)", () => {
      return _testScenario2_FinancialProtectionGuardFailure(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 3: Entity Not Found Guard (STU-999999)", () => {
      return _testScenario3_EntityNotFoundGuard(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 4: Action Authorization Guard (unprivileged user)", () => {
      return _testScenario4_ActionAuthorizationGuard(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 5: API Dispatcher Integration (student_delete_untouched)", () => {
      return _testScenario5_ApiDispatcherIntegration(db);
    }, () => passedCount++, () => failedCount++);

  } finally {
    // Teardown / reset environment
    if (typeof ApiTestSeedHook !== 'undefined') {
      ApiTestSeedHook.purgeAll();
    } else if (typeof FixedMockData !== 'undefined') {
      FixedMockData.purgeFromLiveDatabase();
    }

    if (typeof PropertiesService !== 'undefined' && PropertiesService.getScriptProperties()) {
      PropertiesService.getScriptProperties().setProperty('ENV', originalEnv);
    }

    console.log("===============================================================");
    console.log(`📊 TEST SUITE SUMMARY: ${passedCount} Passed, ${failedCount} Failed`);
    console.log("===============================================================");
  }
}

function _executeScenario(name, scenarioFn, onPass, onFail) {
  const startTime = Date.now();
  try {
    scenarioFn();
    const duration = Date.now() - startTime;
    console.log(`  ✅ PASSED: ${name} (${duration}ms)`);
    onPass();
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`  ❌ FAILED: ${name} (${duration}ms)`);
    console.error(`     Error: ${err.message}`);
    if (err.stack) console.error(err.stack);
    onFail();
  }
}

function _testScenario1_PurgeUntouchedStudent(db) {
  const targetId = "STU-002002";
  const tStart = Date.now();

  const result = StudentService.deleteUntouchedStudent({ student_id: targetId }, {});
  const elapsed = Date.now() - tStart;

  console.log(`     ⏱️ Benchmark Execution Time: ${elapsed}ms (Constraint: < 1500ms)`);

  if (!result || result.student_id !== targetId) {
    throw new Error(`Expected result.student_id '${targetId}', got '${result ? result.student_id : null}'`);
  }

  // Assert target student is physically removed
  const deletedStudent = db.Student.findById(targetId);
  if (deletedStudent) {
    throw new Error(`Student '${targetId}' still exists in database after purge.`);
  }

  // Assert linked enrollment is removed
  const linkedEnr = db.Enrollment.where({ student_id: targetId });
  if (linkedEnr.length > 0) {
    throw new Error(`Found ${linkedEnr.length} orphaned Enrollment rows after purge.`);
  }

  // Assert linked allocations are removed
  const linkedAlloc = db.BatchAllocation.where({ student_id: targetId });
  if (linkedAlloc.length > 0) {
    throw new Error(`Found ${linkedAlloc.length} orphaned BatchAllocation rows after purge.`);
  }
}

function _testScenario2_FinancialProtectionGuardFailure(db) {
  // STU-001001 has active payment receipts in FixedMockData
  const targetId = "STU-001001";
  let caught = false;

  try {
    StudentService.deleteUntouchedStudent({ student_id: targetId }, {});
  } catch (err) {
    caught = true;
    if (!err.message || !err.message.includes("Financial Integrity Breach")) {
      throw new Error(`Expected Financial Integrity Breach error, got '${err.message}'`);
    }
  }

  if (!caught) {
    throw new Error("Expected ValidationError to be thrown for student with active payments.");
  }

  // Assert student STU-001001 is untouched
  const student = db.Student.findById(targetId);
  if (!student) {
    throw new Error("Student STU-001001 was improperly deleted during failed validation.");
  }
}

function _testScenario3_EntityNotFoundGuard(db) {
  let caught = false;
  try {
    StudentService.deleteUntouchedStudent({ student_id: "STU-999999" }, {});
  } catch (err) {
    caught = true;
    if (!err.message || !err.message.includes("Student record not found")) {
      throw new Error(`Expected 'Student record not found' error message, got '${err.message}'`);
    }
  }

  if (!caught) {
    throw new Error("Expected ValidationError for nonexistent student_id.");
  }
}

function _testScenario4_ActionAuthorizationGuard(db) {
  const action = new DeleteUntouchedStudentAction();
  let caught = false;

  try {
    action.run({
      db: db,
      params: { payload: { student_id: "STU-002002" } },
      user: { username: "unprivileged_user", role: "guest" }
    });
  } catch (err) {
    caught = true;
    if (err.name !== "ActionAuthorizationError" && !err.message.includes("Access denied")) {
      throw new Error(`Expected ActionAuthorizationError, got '${err.message}'`);
    }
  }

  if (!caught) {
    throw new Error("Expected ActionAuthorizationError for unprivileged user.");
  }
}

function _testScenario5_ApiDispatcherIntegration(db) {
  // Seed a temporary untouched student STU-003003 for API dispatcher test
  const tempStudent = db.Student.insert({
    student_id: "STU-003003",
    student_name: "Temp Untouched Student",
    status: "active"
  });

  const tempEnr = db.Enrollment.insert({
    enrollment_id: "ENR-003003",
    student_id: "STU-003003",
    enrollment_type: "course",
    item_id: "CRS-PHY001",
    status: "active"
  });

  const tempSfa = db.StudentFeeAccount.insert({
    student_fee_id: "SFA-003003",
    enrollment_id: "ENR-003003",
    total_fee: 10000,
    amount_paid: 0,
    balance_due: 10000,
    status: "active"
  });

  const action = new DeleteUntouchedStudentAction();
  const mockContext = {
    db: db,
    params: {
      action: "student_delete_untouched",
      payload: { student_id: "STU-003003" }
    },
    user: { username: "admin_tester", role: "admin" }
  };

  const response = action.run(mockContext);

  if (!response.success) {
    throw new Error(`Action execution failed: ${JSON.stringify(response.error)}`);
  }
  if (!response.data || response.data.student_id !== "STU-003003") {
    throw new Error(`Expected response data student_id 'STU-003003'`);
  }
}

// Bind top-level entry point to global namespace for Apps Script execution
globalThis.runStudentDeleteUntouchedTests = runStudentDeleteUntouchedTests;
