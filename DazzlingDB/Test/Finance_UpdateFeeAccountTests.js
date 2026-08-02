/**
 * @file Finance_UpdateFeeAccountTests.js
 * Path: DazzlingDB/Test/Finance_UpdateFeeAccountTests.js
 * 
 * Comprehensive Integration & Diagnostic Test Suite for:
 * 1. Direct Fee Account Update (`finance_update_fee_account`)
 * 2. Post-Enrollment Fee Adjustment (`finance_adjust_fee` / `finance_apply_discount`)
 * 3. Service Delegation Architecture (updateFeeAccount -> adjustFee)
 * 4. Protection of Fully Paid Installments
 * 5. Collected Cash Floor Protection Guard & Custom Error Codes
 * 6. ApiDispatcher Action Controller Routing
 */

function runFinanceUpdateFeeAccountTests() {
  console.log("===============================================================");
  console.log("🧪 STARTING INTEGRATION SUITE: Student Fee Account Update & Adjustment");
  console.log("===============================================================");
  
  const originalEnv = PropertiesService.getScriptProperties().getProperty('ENV') || 'DEVELOPMENT';
  PropertiesService.getScriptProperties().setProperty('ENV', 'TESTING');

  let passedCount = 0;
  let failedCount = 0;

  try {
    const db = DBContext.getInstance();
    db.bootstrapRepositories();

    // Reset Sandbox Accounts before testing
    _resetFeeAccountSandbox(db, "SFA-001001");

    // Execute Test Scenarios
    _executeScenario("Scenario 1: Direct Account Fee Update (total_fee ₹5000 -> ₹4000)", () => {
      return _testScenario1_DirectFeeAccountUpdate(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 2: Post-Enrollment Fee Adjustment (₹500 Scholarship)", () => {
      return _testScenario2_PostEnrollmentFeeAdjustment(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 3: Integrated Delegation (updateFeeAccount with nested adjustment)", () => {
      return _testScenario3_IntegratedDelegation(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 4: Fully Paid Installment Protection Enforcement", () => {
      return _testScenario4_PaidInstallmentProtection(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 5: Collected Cash Floor Protection Assertion", () => {
      return _testScenario5_CashFloorProtection(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 6: Invalid Adjustment Amount & Type Handling", () => {
      return _testScenario6_InvalidParametersHandling(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 7: ApiDispatcher Endpoint Routing Verification", () => {
      return _testScenario7_ApiDispatcherRouting(db);
    }, () => passedCount++, () => failedCount++);

  } catch (err) {
    console.error("🔴 CRITICAL SUITE EXECUTION EXCEPTION: " + err.message, err.stack);
  } finally {
    PropertiesService.getScriptProperties().setProperty('ENV', originalEnv);
    console.log("===============================================================");
    console.log(`🏁 SUITE COMPLETED: Total: ${passedCount + failedCount} | Passed: 🟢 ${passedCount} | Failed: 🔴 ${failedCount}`);
    console.log("===============================================================");
  }
}

function _executeScenario(title, scenarioFn, onPass, onFail) {
  console.log(`\n--- [TEST] ${title} ---`);
  try {
    scenarioFn();
    console.log(`🟢 PASSED: ${title}`);
    onPass();
  } catch (err) {
    console.error(`🔴 FAILED: ${title}`);
    console.error(`   Error: ${err.message}`, err.details ? `Details: ${JSON.stringify(err.details)}` : '');
    onFail();
  }
}

function _resetFeeAccountSandbox(db, studentFeeId) {
  // Provision clean testing account with 2 installments
  let feeAccount = db.StudentFeeAccount.findById(studentFeeId);
  if (!feeAccount) {
    feeAccount = db.StudentFeeAccount.insert({
      student_fee_id: studentFeeId,
      enrollment_id: "ENR-001001",
      total_fee: 5000,
      discount: 0,
      final_fee: 5000,
      amount_paid: 0,
      balance_due: 5000,
      status: "active",
      adjustment_type: "none"
    });
  } else {
    db.StudentFeeAccount.update(studentFeeId, {
      total_fee: 5000,
      discount: 0,
      final_fee: 5000,
      amount_paid: 0,
      balance_due: 5000,
      status: "active",
      adjustment_type: "none"
    });
  }

  // 1. Clear child Payment records FIRST (leaf-first LIFO cascade order to satisfy onDelete protect constraints)
  if (db.Payment) {
    const existingPayments = typeof db.Payment.where === 'function'
      ? db.Payment.where({ student_fee_id: studentFeeId })
      : (typeof db.Payment.all === 'function' ? db.Payment.all().filter(p => p.student_fee_id === studentFeeId) : []);
    existingPayments.forEach(p => db.Payment.remove(p.payment_id));
  }

  // 2. Clear existing FeeAdjustment records for this account
  if (db.FeeAdjustment) {
    const existingAdjs = typeof db.FeeAdjustment.where === 'function'
      ? db.FeeAdjustment.where({ student_fee_id: studentFeeId })
      : (typeof db.FeeAdjustment.all === 'function' ? db.FeeAdjustment.all().filter(a => a.student_fee_id === studentFeeId) : []);
    existingAdjs.forEach(adj => db.FeeAdjustment.remove(adj.adjustment_id));
  }

  // 3. Clear existing Installments for this account
  const existingInsts = typeof db.Installment.where === 'function'
    ? db.Installment.where({ student_fee_id: studentFeeId })
    : (typeof db.Installment.all === 'function' ? db.Installment.all().filter(i => i.student_fee_id === studentFeeId) : []);
  existingInsts.forEach(inst => db.Installment.remove(inst.installment_id));

  db.Installment.insert({
    student_fee_id: studentFeeId,
    installment_number: 1,
    due_amount: 2500,
    paid_amount: 0,
    due_date: "2026-08-15",
    status: "pending"
  });

  db.Installment.insert({
    student_fee_id: studentFeeId,
    installment_number: 2,
    due_amount: 2500,
    paid_amount: 0,
    due_date: "2026-09-15",
    status: "pending"
  });
}

function _testScenario1_DirectFeeAccountUpdate(db) {
  _resetFeeAccountSandbox(db, "SFA-001001");
  const service = AcademicEnrollmentService.getInstance();
  const context = { db: db, mutationManifest: [] };

  const result = service.updateFeeAccount({
    student_fee_id: "SFA-001001",
    total_fee: 4000,
    remarks: "Corrected base fee from 5000 to 4000"
  }, context);

  if (!result.success) throw new Error("Result success should be true");
  if (result.data.final_fee !== 4000) throw new Error(`Expected final_fee 4000, got ${result.data.final_fee}`);

  const updatedInstallments = db.Installment.where({ student_fee_id: "SFA-001001" });
  const sumDue = updatedInstallments.reduce((acc, inst) => acc + Number(inst.due_amount), 0);
  if (Math.abs(sumDue - 4000) >= 0.01) throw new Error(`Sum of installment due amounts (₹${sumDue}) does not match final fee ₹4000`);
}

function _testScenario2_PostEnrollmentFeeAdjustment(db) {
  _resetFeeAccountSandbox(db, "SFA-001001");
  const service = AcademicEnrollmentService.getInstance();
  const context = { db: db, mutationManifest: [] };

  const result = service.adjustFee({
    student_fee_id: "SFA-001001",
    adjustment_type: "scholarship",
    amount: 500,
    reason: "Merit Scholarship Awarded"
  }, context);

  if (!result.success) throw new Error("Result success should be true");
  if (result.data.discount !== 500) throw new Error(`Expected discount 500, got ${result.data.discount}`);
  if (result.data.final_fee !== 4500) throw new Error(`Expected final_fee 4500, got ${result.data.final_fee}`);

  // Verify FeeAdjustment audit record created
  const adjs = db.FeeAdjustment.where({ student_fee_id: "SFA-001001" });
  if (adjs.length === 0) throw new Error("FeeAdjustment audit record was not created in database");
  if (Number(adjs[0].amount) !== 500) throw new Error(`FeeAdjustment amount expected 500, got ${adjs[0].amount}`);
}

function _testScenario3_IntegratedDelegation(db) {
  _resetFeeAccountSandbox(db, "SFA-001001");
  const service = AcademicEnrollmentService.getInstance();
  const context = { db: db, mutationManifest: [] };

  const result = service.updateFeeAccount({
    student_fee_id: "SFA-001001",
    adjustment: {
      adjustment_type: "coupon",
      amount: 300,
      reason: "Early Bird Coupon"
    }
  }, context);

  if (!result.success) throw new Error("Result success should be true");
  if (result.data.discount !== 300) throw new Error(`Expected discount 300, got ${result.data.discount}`);

  const adjs = db.FeeAdjustment.where({ student_fee_id: "SFA-001001" });
  if (adjs.length === 0) throw new Error("Delegated adjustment should create FeeAdjustment audit row");
}

function _testScenario4_PaidInstallmentProtection(db) {
  _resetFeeAccountSandbox(db, "SFA-001001");

  // Mark installment 1 as paid
  const insts = db.Installment.where({ student_fee_id: "SFA-001001" });
  const paidInstId = insts[0].installment_id;
  db.Installment.update(paidInstId, {
    due_amount: 2500,
    paid_amount: 2500,
    status: "paid"
  });
  db.StudentFeeAccount.update("SFA-001001", { amount_paid: 2500, balance_due: 2500 });

  const service = AcademicEnrollmentService.getInstance();
  const context = { db: db, mutationManifest: [] };

  // Adjust fee by 500 (total_fee 5000 - 500 = 4500)
  service.adjustFee({
    student_fee_id: "SFA-001001",
    adjustment_type: "scholarship",
    amount: 500,
    reason: "Mid-term Scholarship"
  }, context);

  // Check that paid installment 1 remains untouched (due_amount 2500, paid_amount 2500)
  const recheckedInst1 = db.Installment.findById(paidInstId);
  if (Number(recheckedInst1.due_amount) !== 2500 || Number(recheckedInst1.paid_amount) !== 2500) {
    throw new Error(`Paid installment was modified! expected due 2500/paid 2500, got due ${recheckedInst1.due_amount}/paid ${recheckedInst1.paid_amount}`);
  }

  // Check that installment 2 absorbed the entire reduction (due_amount 2000)
  const unpaidInst = insts.find(i => i.installment_id !== paidInstId);
  const recheckedInst2 = db.Installment.findById(unpaidInst.installment_id);
  if (Number(recheckedInst2.due_amount) !== 2000) {
    throw new Error(`Unpaid installment expected due 2000, got ${recheckedInst2.due_amount}`);
  }
}

function _testScenario5_CashFloorProtection(db) {
  _resetFeeAccountSandbox(db, "SFA-001001");

  // Set account amount_paid = 3000
  db.StudentFeeAccount.update("SFA-001001", { amount_paid: 3000, balance_due: 2000 });

  const service = AcademicEnrollmentService.getInstance();
  const context = { db: db, mutationManifest: [] };

  let thrown = false;
  try {
    // Attempt to reduce final_fee to 2000 (below amount_paid 3000)
    service.updateFeeAccount({
      student_fee_id: "SFA-001001",
      total_fee: 2000
    }, context);
  } catch (err) {
    thrown = true;
    if (err.errorCode !== "CASH_FLOOR_VIOLATION" && err.name !== "AcademicEnrollmentError") {
      throw new Error(`Expected CASH_FLOOR_VIOLATION error code, got ${err.errorCode || err.name}`);
    }
  }

  if (!thrown) throw new Error("Lowering final_fee below collected cash did not throw CASH_FLOOR_VIOLATION exception!");
}

function _testScenario6_InvalidParametersHandling(db) {
  _resetFeeAccountSandbox(db, "SFA-001001");
  const service = AcademicEnrollmentService.getInstance();
  const context = { db: db, mutationManifest: [] };

  // Negative amount test
  let thrownAmount = false;
  try {
    service.adjustFee({
      student_fee_id: "SFA-001001",
      adjustment_type: "scholarship",
      amount: -100
    }, context);
  } catch (err) {
    thrownAmount = true;
    if (err.errorCode !== "INVALID_ADJUSTMENT_AMOUNT") {
      throw new Error(`Expected INVALID_ADJUSTMENT_AMOUNT, got ${err.errorCode}`);
    }
  }
  if (!thrownAmount) throw new Error("Negative adjustment amount did not throw exception!");

  // Invalid adjustment type test
  let thrownType = false;
  try {
    service.adjustFee({
      student_fee_id: "SFA-001001",
      adjustment_type: "invalid_type",
      amount: 100
    }, context);
  } catch (err) {
    thrownType = true;
    if (err.errorCode !== "INVALID_ADJUSTMENT_TYPE") {
      throw new Error(`Expected INVALID_ADJUSTMENT_TYPE, got ${err.errorCode}`);
    }
  }
  if (!thrownType) throw new Error("Invalid adjustment type did not throw exception!");
}

function _testScenario7_ApiDispatcherRouting(db) {
  _resetFeeAccountSandbox(db, "SFA-001001");
  const context = { db: db, headers: {}, params: {} };

  function unwrap(output) {
    if (!output) return null;
    return typeof output.getContent === 'function' ? JSON.parse(output.getContent()) : output;
  }

  // Dispatch finance_update_fee_account
  const req1 = {
    action: "finance_update_fee_account",
    payload: {
      student_fee_id: "SFA-001001",
      total_fee: 4500
    }
  };
  const res1 = unwrap(ApiDispatcher.dispatch(req1));
  if (!res1 || !res1.success) throw new Error("ApiDispatcher finance_update_fee_account dispatch failed: " + (res1?.error?.message || "Unknown error"));

  // Dispatch finance_adjust_fee
  const req2 = {
    action: "finance_adjust_fee",
    payload: {
      student_fee_id: "SFA-001001",
      adjustment_type: "referral",
      amount: 200
    }
  };
  const res2 = unwrap(ApiDispatcher.dispatch(req2));
  if (!res2 || !res2.success) throw new Error("ApiDispatcher finance_adjust_fee dispatch failed: " + (res2?.error?.message || "Unknown error"));

  // Dispatch finance_apply_discount (alias)
  const req3 = {
    action: "finance_apply_discount",
    payload: {
      student_fee_id: "SFA-001001",
      adjustment_type: "coupon",
      amount: 100
    }
  };
  const res3 = unwrap(ApiDispatcher.dispatch(req3));
  if (!res3 || !res3.success) throw new Error("ApiDispatcher finance_apply_discount dispatch failed: " + (res3?.error?.message || "Unknown error"));
}

globalThis.runFinanceUpdateFeeAccountTests = runFinanceUpdateFeeAccountTests;
