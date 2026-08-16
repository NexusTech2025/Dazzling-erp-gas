/**
 * @file FeeAccount_InstallmentConstraintTests.js
 * Path: DazzlingDB/Test/FeeAccount_InstallmentConstraintTests.js
 *
 * Diagnostic & Behavioral Test Suite for:
 * - Relational Static/Dynamic Graph Deletion Constraints on 'StudentFeeAccount' and 'Installment'
 * - Verifying 'protect' policy enforcement (Cannot delete parent if referencing child records exist)
 * - Verifying Partial vs Full Leaf-First Child Deletion workflows
 *
 * Uses ApiTestSeedHook / FixedMockData predefined dataset:
 * - SFA-002002 (linked to ENR-002002, has installments INS-002001 and INS-002002)
 * - SFA-001001 (linked to ENR-001001, has installments INS-001001, INS-001002, and Payment PAY-001001)
 *
 * INSTRUCTIONS:
 * Run 'runFeeAccountInstallmentConstraintTests' from the Apps Script IDE.
 */

function runFeeAccountInstallmentConstraintTests() {
  console.log("==========================================================================");
  console.log("🧪 STARTING INTEGRATION SUITE: StudentFeeAccount <-> Installment Constraints");
  console.log("==========================================================================");

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

    // 2. Seed Predefined Mock Dataset
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

    // 3. Execute Diagnostic Constraint Scenarios
    _executeScenario("Scenario 1: Direct StudentFeeAccount Deletion Blocked by Active Installments (SFA-002002)", () => {
      return _testScenario1_DirectFeeAccountDeleteBlocked(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 2: Partial Installment Deletion Still Blocks StudentFeeAccount Deletion", () => {
      return _testScenario2_PartialInstallmentDeleteStillBlocks(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 3: Complete Leaf-First Deletion Allows StudentFeeAccount Removal", () => {
      return _testScenario3_CompleteLeafFirstDeleteSucceeds(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 4: Batch deleteMany on Installments Followed by StudentFeeAccount Removal", () => {
      return _testScenario4_BatchDeleteManyWorkflow(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 5: Direct Student Deletion Blocked by Cascaded Protected Fee Accounts (STU-001001)", () => {
      return _testScenario5_DirectStudentDeleteBlockedByProtectedFees(db);
    }, () => passedCount++, () => failedCount++);

    // 4. Output Summary
    const totalTime = Object.values(timings).reduce((a, b) => a + b, 0);
    console.log("\n========================================================");
    console.log("⏱️  CONSTRAINT TEST BENCHMARK TIMING SUMMARY  ⏱️");
    console.log("========================================================");
    console.log(`- Setup & Hydration Time                : ${timings.sandbox_setup} ms`);
    console.log(`- Total Execution Time                  : ${totalTime} ms`);
    console.log(`- Scenarios Executed                    : ${passedCount + failedCount} (Passed: ${passedCount}, Failed: ${failedCount})`);
    console.log("========================================================\n");

    console.log("🏁 StudentFeeAccount <-> Installment Constraint Tests Complete.");
    return { passedCount: passedCount, failedCount: failedCount };
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
    if (err.context) console.error("   Constraint Context:", JSON.stringify(err.context));
    if (err.details) console.error("   Details:", JSON.stringify(err.details));
    if (err.stack) console.error(err.stack);
    if (typeof onError === 'function') onError();
  }
}

/**
 * SCENARIO 1: Direct StudentFeeAccount Deletion Blocked by Active Installments (SFA-002002)
 *
 * SFA-002002 has 2 active installments: INS-002001 and INS-002002.
 * Calling db.StudentFeeAccount.remove('SFA-002002') MUST throw an IntegrityError.
 */
function _testScenario1_DirectFeeAccountDeleteBlocked(db) {
  const targetSfaId = "SFA-002002";
  const initialInstallments = db.Installment.where({ student_fee_id: targetSfaId });

  if (initialInstallments.length !== 2) {
    throw new Error(`Prerequisite Failed: Expected 2 installments for ${targetSfaId}, found ${initialInstallments.length}`);
  }

  let caught = false;
  let interceptedError = null;

  try {
    db.StudentFeeAccount.remove(targetSfaId);
  } catch (err) {
    caught = true;
    interceptedError = err;
  }

  if (!caught) {
    throw new Error(`Expected deletion of ${targetSfaId} to be blocked by 'protect' constraint, but remove() succeeded!`);
  }

  const isIntegrityError = interceptedError.name === "IntegrityError" ||
    (typeof SheetDB !== 'undefined' && interceptedError instanceof SheetDB.IntegrityError) ||
    interceptedError.message.includes("Delete Protected") ||
    interceptedError.message.includes("Installment");

  if (!isIntegrityError) {
    throw new Error(`Expected IntegrityError / Delete Protected message, got: ${interceptedError.message}`);
  }

  // Verify SFA still exists in database
  const sfaCheck = db.StudentFeeAccount.findById(targetSfaId);
  if (!sfaCheck) {
    throw new Error(`Data corruption: ${targetSfaId} was deleted despite throwing constraint violation!`);
  }

  return {
    blocked: true,
    sfa_id: targetSfaId,
    active_referencing_installments: initialInstallments.map(i => i.installment_id),
    error_message: interceptedError.message
  };
}

/**
 * SCENARIO 2: Partial Installment Deletion Still Blocks StudentFeeAccount Deletion
 *
 * Delete only 1 installment (INS-002001).
 * SFA-002002 still has 1 active installment (INS-002002).
 * Attempting db.StudentFeeAccount.remove('SFA-002002') MUST STILL throw an IntegrityError.
 */
function _testScenario2_PartialInstallmentDeleteStillBlocks(db) {
  const targetSfaId = "SFA-002002";
  const installmentToDelete = "INS-002001";
  const remainingInstallment = "INS-002002";

  // Delete 1st installment
  db.Installment.remove(installmentToDelete);

  const remaining = db.Installment.where({ student_fee_id: targetSfaId });
  if (remaining.length !== 1 || remaining[0].installment_id !== remainingInstallment) {
    throw new Error(`Expected exactly 1 remaining installment (${remainingInstallment}), found: ${JSON.stringify(remaining)}`);
  }

  let caught = false;
  let interceptedError = null;

  try {
    db.StudentFeeAccount.remove(targetSfaId);
  } catch (err) {
    caught = true;
    interceptedError = err;
  }

  if (!caught) {
    throw new Error(`Expected deletion of ${targetSfaId} to be blocked by remaining installment ${remainingInstallment}, but it succeeded!`);
  }

  // Verify SFA still exists
  const sfaCheck = db.StudentFeeAccount.findById(targetSfaId);
  if (!sfaCheck) {
    throw new Error(`Data corruption: ${targetSfaId} was deleted despite 1 remaining installment!`);
  }

  return {
    blocked: true,
    sfa_id: targetSfaId,
    remaining_installment: remainingInstallment,
    error_message: interceptedError.message
  };
}

/**
 * SCENARIO 3: Complete Leaf-First Deletion Allows StudentFeeAccount Removal
 *
 * Delete the remaining installment (INS-002002).
 * SFA-002002 now has ZERO active installments.
 * Attempting db.StudentFeeAccount.remove('SFA-002002') MUST SUCCEED cleanly!
 */
function _testScenario3_CompleteLeafFirstDeleteSucceeds(db) {
  const targetSfaId = "SFA-002002";
  const lastInstallment = "INS-002002";

  // Delete last installment
  db.Installment.remove(lastInstallment);

  const remaining = db.Installment.where({ student_fee_id: targetSfaId });
  if (remaining.length !== 0) {
    throw new Error(`Expected 0 remaining installments for ${targetSfaId}, found ${remaining.length}`);
  }

  // Now delete the fee account
  const removeSuccess = db.StudentFeeAccount.remove(targetSfaId);

  if (!removeSuccess) {
    throw new Error(`Expected remove(${targetSfaId}) to return true, got false`);
  }

  // Verify SFA is permanently removed
  const sfaCheck = db.StudentFeeAccount.findById(targetSfaId);
  if (sfaCheck) {
    throw new Error(`Expected ${targetSfaId} to be deleted from database, but it still exists.`);
  }

  return {
    success: true,
    sfa_id: targetSfaId,
    purged: true
  };
}

/**
 * SCENARIO 4: Batch deleteMany on Installments Followed by StudentFeeAccount Removal
 *
 * Setup fresh mock SFA with 2 installments.
 * Call db.Installment.deleteMany([ins1, ins2]).
 * Then call db.StudentFeeAccount.remove(sfa).
 * Both must execute without constraint violations.
 */
function _testScenario4_BatchDeleteManyWorkflow(db) {
  const mockSfaId = "SFA-BATCH-TEST";
  const mockIns1 = "INS-BATCH-001";
  const mockIns2 = "INS-BATCH-002";

  // Insert mock records
  db.StudentFeeAccount.insert({
    student_fee_id: mockSfaId,
    enrollment_id: "ENR-001001",
    total_fee: 10000,
    amount_paid: 0,
    balance_due: 10000,
    status: "active"
  });

  db.Installment.insert({
    installment_id: mockIns1,
    student_fee_id: mockSfaId,
    installment_number: 1,
    due_amount: 5000,
    due_date: "2026-09-01",
    status: "pending"
  });

  db.Installment.insert({
    installment_id: mockIns2,
    student_fee_id: mockSfaId,
    installment_number: 2,
    due_amount: 5000,
    due_date: "2026-10-01",
    status: "pending"
  });

  // Verify direct delete is blocked
  let directBlocked = false;
  try {
    db.StudentFeeAccount.remove(mockSfaId);
  } catch (e) {
    directBlocked = true;
  }
  if (!directBlocked) throw new Error("Expected direct delete of mock SFA to be blocked before batch child delete.");

  // Execute batch deleteMany on installments
  const deletedCount = db.Installment.deleteMany([mockIns1, mockIns2]);
  if (deletedCount !== 2) {
    throw new Error(`Expected deleteMany to return 2, got ${deletedCount}`);
  }

  // Now delete fee account
  const sfaDeleted = db.StudentFeeAccount.remove(mockSfaId);
  if (!sfaDeleted) throw new Error("Failed to delete mock SFA after batch installment removal.");

  return {
    batch_installments_purged: deletedCount,
    sfa_purged: true
  };
}

/**
 * SCENARIO 5: Direct Student Deletion Blocked by Cascaded Protected Fee Accounts (STU-001001)
 *
 * STU-001001 -> ENR-001001 -> SFA-001001 -> INS-001001 / INS-001002 (protect)
 * Attempting db.Student.remove('STU-001001') directly MUST be blocked by the graph constraint engine.
 */
function _testScenario5_DirectStudentDeleteBlockedByProtectedFees(db) {
  const targetStudentId = "STU-001001";

  let caught = false;
  let interceptedError = null;

  try {
    db.Student.remove(targetStudentId);
  } catch (err) {
    caught = true;
    interceptedError = err;
  }

  if (!caught) {
    throw new Error(`Expected direct deletion of ${targetStudentId} to be blocked by downstream protect constraints, but it succeeded!`);
  }

  // Verify Student STU-001001 still exists
  const studentCheck = db.Student.findById(targetStudentId);
  if (!studentCheck) {
    throw new Error(`Student ${targetStudentId} was deleted despite protect constraint failure!`);
  }

  return {
    blocked: true,
    student_id: targetStudentId,
    error_message: interceptedError.message
  };
}

// Bind top-level entry point to global namespace for Apps Script execution
globalThis.runFeeAccountInstallmentConstraintTests = runFeeAccountInstallmentConstraintTests;
