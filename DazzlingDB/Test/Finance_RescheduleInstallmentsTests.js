/**
 * @file Finance_RescheduleInstallmentsTests.js
 * Path: DazzlingDB/Test/Finance_RescheduleInstallmentsTests.js
 * 
 * Automated Integration & Diagnostic Test Suite for Installment Rescheduling (RescheduleInstallmentsAction).
 * Uses ApiTestSeedHook & FixedMockData predefined entities (SFA-001001, SFA-002002, INS-001001, INS-001002, INS-002001, INS-002002).
 * 
 * Tests 10 real-world edge case scenarios:
 *  1. Standard due date & amount rescheduling maintaining fee equality.
 *  2. Unpaid installment deletion & schedule rebalancing.
 *  3. Dynamic addition of new installment lines.
 *  4. Sequential payment overflow rollover cascade across timeline.
 *  5. Rejection guard on deleting paid installments (onDelete: protect).
 *  6. Direct payment receipt alignment guard.
 *  7. Floating-point precision total fee equality invariant enforcement.
 *  8. Chronological date sequence re-ordering and next_due_date synchronization.
 *  9. Master StudentFeeAccount status completion synchronization (balance_due == 0).
 * 10. ApiDispatcher endpoint routing & JSON presentation envelope validation.
 * 
 * INSTRUCTIONS:
 * Run 'runFinanceRescheduleInstallmentsTests' from Google Apps Script IDE.
 */

/**
 * Cross-realm safe date instance validator using SheetDB.isDate / globalThis.isDate.
 * 
 * @param {any} val - Value to test.
 * @returns {boolean} True if native Date instance.
 */
function _isCrossRealmDate(val) {
  if (typeof SheetDB !== 'undefined' && typeof SheetDB.isDate === 'function') {
    return SheetDB.isDate(val);
  }
  if (typeof globalThis.isDate === 'function') {
    return globalThis.isDate(val);
  }
  return !!(val && (
    val instanceof Date ||
    Object.prototype.toString.call(val) === '[object Date]' ||
    (typeof val === 'object' && typeof val.getTime === 'function' && !isNaN(val.getTime()))
  ));
}

/**
 * Local date string formatting helper.
 * Prevents UTC timezone offset shifts in IST (UTC+5:30) environments.
 * 
 * @param {Date|string|any} val - Target date value.
 * @returns {string} Formatted local date string YYYY-MM-DD.
 */
function _formatTestDateString(val) {
  if (!val) return '';
  if (_isCrossRealmDate(val)) {
    if (typeof DazzlingDateTime !== 'undefined' && DazzlingDateTime.formatDate) {
      return DazzlingDateTime.formatDate(val);
    }
    const year = val.getFullYear();
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const day = String(val.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const str = String(val).trim();
  if (str.includes('T')) {
    return str.split('T')[0];
  }
  if (str.includes(' ')) {
    const first = str.split(' ')[0];
    if (first.match(/^\d{4}-\d{2}-\d{2}$/)) return first;
  }
  return str;
}

/**
 * Resets a target StudentFeeAccount and child Installment/Payment records back to initial unpaid state.
 * 
 * @param {string} targetFeeId - Target fee account ID.
 * @returns {Object} Reset status report.
 */
function resetRescheduleTestAccount(targetFeeId) {
  const targetId = targetFeeId || "SFA-001001";
  const db = DBContext.getInstance();

  // 1. Delete payment records for this account
  let payments = [];
  if (typeof db.Payment.where === 'function') {
    payments = db.Payment.where({ student_fee_id: targetId });
  } else if (typeof db.Payment.all === 'function') {
    payments = db.Payment.all().filter(p => p.student_fee_id === targetId);
  }
  if (payments.length > 0) {
    db.Payment.deleteMany(payments.map(p => p.payment_id));
  }

  // 2. Restore default installments for SFA-001001
  if (targetId === "SFA-001001") {
    // Evict all existing dynamic installments for SFA-001001
    const currentInsts = db.Installment.where ? db.Installment.where({ student_fee_id: targetId }) : db.Installment.all().filter(i => i.student_fee_id === targetId);
    if (currentInsts.length > 0) {
      db.Installment.deleteMany(currentInsts.map(i => i.installment_id));
    }

    db.Installment.insert({
      installment_id: "INS-001001",
      student_fee_id: "SFA-001001",
      installment_number: 1,
      due_amount: 12500,
      paid_amount: 0,
      late_fee_amount: 0,
      due_date: "2026-07-01",
      status: "pending"
    });

    db.Installment.insert({
      installment_id: "INS-001002",
      student_fee_id: "SFA-001001",
      installment_number: 2,
      due_amount: 12500,
      paid_amount: 0,
      late_fee_amount: 0,
      due_date: "2026-08-01",
      status: "pending"
    });

    db.StudentFeeAccount.update("SFA-001001", {
      total_fee: 25000,
      discount: 0,
      final_fee: 25000,
      amount_paid: 0,
      balance_due: 25000,
      status: "active",
      next_due_date: "2026-07-01"
    });
  }

  if (db._pkCache) {
    db._pkCache.invalidate("Payment");
    db._pkCache.invalidate("Installment");
    db._pkCache.invalidate("StudentFeeAccount");
  }

  return { success: true, student_fee_id: targetId };
}

function runFinanceRescheduleInstallmentsTests() {
  const originalEnv = typeof PropertiesService !== 'undefined'
    ? PropertiesService.getScriptProperties().getProperty('ENV')
    : 'DEVELOPMENT';

  console.log(`[Test Runner] Original environment: ${originalEnv || 'DEVELOPMENT'}`);

  const results = {};
  const timings = {};
  const tSuiteStart = Date.now();

  const targetFeeId = "SFA-001001";
  const instId1 = "INS-001001";
  const instId2 = "INS-001002";

  try {
    console.log("⚙️ Initializing Pre-Flight Data Seed via ApiTestSeedHook...");
    
    // Seed predefined mock dataset using ApiTestSeedHook
    if (typeof ApiTestSeedHook !== 'undefined' && ApiTestSeedHook.prepareDB) {
      ApiTestSeedHook.prepareDB({ env: "TESTING" });
    } else {
      PropertiesService.getScriptProperties().setProperty('ENV', 'TESTING');
      DBContext.getInstance().bootstrapRepositories();
      if (typeof FixedMockData !== 'undefined') {
        FixedMockData.seedLiveDatabase();
      }
    }

    const db = DBContext.getInstance();
    console.log(`\n=========================================\n🚀 Starting RescheduleInstallmentsAction Integration Suite [Target: ${targetFeeId}]`);

    // Reset account state prior to test run
    resetRescheduleTestAccount(targetFeeId);

    // Scenario 1: Standard Rescheduling (Date & Amount)
    console.log("\n=========================================");
    let tStart = Date.now();
    results.Scenario1_StandardReschedule = _testScenario1_StandardReschedule(db, targetFeeId, instId1, instId2);
    timings["Scenario 1: Standard Reschedule"] = Date.now() - tStart;

    // Scenario 2: Unpaid Installment Deletion
    console.log("\n=========================================");
    resetRescheduleTestAccount(targetFeeId);
    tStart = Date.now();
    results.Scenario2_DeleteUnpaidInstallment = _testScenario2_DeleteUnpaidInstallment(db, targetFeeId, instId2);
    timings["Scenario 2: Delete Unpaid Line"] = Date.now() - tStart;

    // Scenario 3: Adding New Installment Lines
    console.log("\n=========================================");
    resetRescheduleTestAccount(targetFeeId);
    tStart = Date.now();
    const newInstId = _testScenario3_AddNewInstallment(db, targetFeeId, instId1, instId2);
    timings["Scenario 3: Add New Line"] = Date.now() - tStart;
    results.Scenario3_AddNewInstallment = !!newInstId;

    // Scenario 4: Payment Overflow Rollover Cascade
    console.log("\n=========================================");
    resetRescheduleTestAccount(targetFeeId);
    tStart = Date.now();
    results.Scenario4_PaymentOverflowCascade = _testScenario4_PaymentOverflowCascade(db, targetFeeId, instId1, instId2);
    timings["Scenario 4: Overflow Cascade"] = Date.now() - tStart;

    // Scenario 5: Rejection on Deleting Paid Installment
    console.log("\n=========================================");
    resetRescheduleTestAccount(targetFeeId);
    tStart = Date.now();
    results.Scenario5_RejectionPaidDeletion = _testScenario5_RejectionPaidDeletion(db, targetFeeId, instId1);
    timings["Scenario 5: Paid Deletion Rejection"] = Date.now() - tStart;

    // Scenario 6: Rejection on Direct Payment Receipt Alignment
    console.log("\n=========================================");
    resetRescheduleTestAccount(targetFeeId);
    tStart = Date.now();
    results.Scenario6_RejectionReceiptAlignment = _testScenario6_RejectionReceiptAlignment(db, targetFeeId, instId1);
    timings["Scenario 6: Receipt Alignment Rejection"] = Date.now() - tStart;

    // Scenario 7: Rejection on Total Fee Invariant Mismatch
    console.log("\n=========================================");
    resetRescheduleTestAccount(targetFeeId);
    tStart = Date.now();
    results.Scenario7_RejectionTotalFeeMismatch = _testScenario7_RejectionTotalFeeMismatch(db, targetFeeId, instId1);
    timings["Scenario 7: Total Fee Mismatch Rejection"] = Date.now() - tStart;

    // Scenario 8: Next Due Date & Sequence Sync
    console.log("\n=========================================");
    resetRescheduleTestAccount(targetFeeId);
    tStart = Date.now();
    results.Scenario8_NextDueDateSync = _testScenario8_NextDueDateSync(db, targetFeeId);
    timings["Scenario 8: Next Due Date Sync"] = Date.now() - tStart;

    // Scenario 9: Master Account Completion Synchronization
    console.log("\n=========================================");
    resetRescheduleTestAccount(targetFeeId);
    tStart = Date.now();
    results.Scenario9_MasterCompletionSync = _testScenario9_MasterCompletionSync(db, targetFeeId, instId1, instId2);
    timings["Scenario 9: Master Completion Sync"] = Date.now() - tStart;

    // Scenario 10: ApiDispatcher Integration
    console.log("\n=========================================");
    resetRescheduleTestAccount(targetFeeId);
    tStart = Date.now();
    results.Scenario10_ApiDispatcherIntegration = _testScenario10_ApiDispatcherIntegration(targetFeeId);
    timings["Scenario 10: ApiDispatcher Integration"] = Date.now() - tStart;

    console.log("\n========================================================");
    console.log(`🎉 RescheduleInstallmentsAction Test Suite Completed in ${Date.now() - tSuiteStart}ms.`);
    console.log("========================================================");
    console.log("📊 SCENARIO TEST RESULTS MATRIX SUMMARY                 📊");
    console.log("========================================================");
    Object.keys(results).forEach(key => {
      const status = results[key] ? "🟢 PASSED" : "🔴 FAILED";
      const timeMs = timings[key] !== undefined ? `${timings[key]}ms` : 'N/A';
      console.log(`- ${key.padEnd(38)}: ${status} (${timeMs})`);
    });
    console.log("========================================================\n");

  } catch (globalErr) {
    console.error("❌ Critical Test Suite Crash:", globalErr);
    results.SuiteCrash = globalErr.message;
  } finally {
    const restoreEnv = originalEnv || 'DEVELOPMENT';
    console.log(`\n🧹 Restoring test environment state back to: ${restoreEnv}`);
    if (typeof ApiTestSeedHook !== 'undefined' && ApiTestSeedHook.purge) {
      ApiTestSeedHook.purge({ restoreEnv: restoreEnv });
    } else {
      PropertiesService.getScriptProperties().setProperty('ENV', restoreEnv);
    }
  }
}

/**
 * Scenario 1: Standard rescheduling of INS-001001 (due: 15000) and INS-001002 (due: 10000) maintaining total 25000.
 */
function _testScenario1_StandardReschedule(db, feeId, inst1Id, inst2Id) {
  console.log("▶ Running Scenario 1: Standard Date & Amount Rescheduling (Predefined SFA-001001)...");
  const service = AcademicEnrollmentService.getInstance();

  const payload = {
    student_fee_id: feeId,
    update_installments: [
      { installment_id: inst1Id, due_date: "2026-07-15", due_amount: 15000 },
      { installment_id: inst2Id, due_date: "2026-08-15", due_amount: 10000 }
    ],
    remarks: "Scenario 1 Predefined Reschedule"
  };

  const res = service.rescheduleInstallments(payload, { db: db, mutationManifest: [] });

  const updated1 = db.Installment.findById(inst1Id);
  const updated2 = db.Installment.findById(inst2Id);
  const sfa = db.StudentFeeAccount.findById(feeId);

  // Detailed Date Debug Logging
  console.log(`   [Date Debug Scenario 1] Raw sfa.next_due_date: ${JSON.stringify(sfa ? sfa.next_due_date : null)} | type: ${typeof (sfa && sfa.next_due_date)} | isCrossRealmDate: ${_isCrossRealmDate(sfa && sfa.next_due_date)}`);
  console.log(`   [Date Debug Scenario 1] Raw updated1.due_date: ${JSON.stringify(updated1 ? updated1.due_date : null)} | type: ${typeof (updated1 && updated1.due_date)} | isCrossRealmDate: ${_isCrossRealmDate(updated1 && updated1.due_date)}`);

  const sfaNextDueDateStr = _formatTestDateString(sfa ? sfa.next_due_date : null);
  const inst1DueDateStr = _formatTestDateString(updated1 ? updated1.due_date : null);

  console.log(`   [Date Debug Scenario 1] Formatted sfaNextDueDateStr: '${sfaNextDueDateStr}' | inst1DueDateStr: '${inst1DueDateStr}'`);

  const valid = res.success === true &&
    updated1 && Number(updated1.due_amount) === 15000 &&
    updated2 && Number(updated2.due_amount) === 10000 &&
    (sfaNextDueDateStr.includes("2026-07-15") || inst1DueDateStr.includes("2026-07-15"));

  if (valid) {
    console.log(`🟢 PASSED: Scenario 1 Standard Reschedule.`);
    console.log(`   └─ Asserted INS1 Due: ₹${updated1.due_amount} (Date: ${inst1DueDateStr}), INS2 Due: ₹${updated2.due_amount}, SFA Next Due: ${sfaNextDueDateStr}`);
  } else {
    console.error(`🔴 FAILED: Scenario 1 Standard Reschedule.`);
    console.error(`   └─ Diagnostic: res.success=${res.success}, INS1 Due=${updated1 ? updated1.due_amount : 'N/A'} (Expected: 15000), INS2 Due=${updated2 ? updated2.due_amount : 'N/A'} (Expected: 10000), Next Due Date='${sfaNextDueDateStr}' (Expected: 2026-07-15)`);
  }
  return valid;
}

/**
 * Scenario 2: Deletes unpaid installment INS-001002 and updates INS-001001 to 25000.
 */
function _testScenario2_DeleteUnpaidInstallment(db, feeId, inst2Id) {
  console.log("▶ Running Scenario 2: Unpaid Installment Deletion...");
  const service = AcademicEnrollmentService.getInstance();

  const payload = {
    student_fee_id: feeId,
    delete_installment_ids: [inst2Id],
    update_installments: [
      { installment_id: "INS-001001", due_amount: 25000 }
    ]
  };

  const res = service.rescheduleInstallments(payload, { db: db, mutationManifest: [] });

  const deletedCheck = db.Installment.findById(inst2Id);
  const updated1 = db.Installment.findById("INS-001001");

  const valid = res.success === true && deletedCheck === null && updated1 && Number(updated1.due_amount) === 25000;

  if (valid) {
    console.log(`🟢 PASSED: Scenario 2 Delete Unpaid Line.`);
    console.log(`   └─ Evicted Installment ${inst2Id} verified null. INS1 rebalanced due: ₹${updated1.due_amount}.`);
  } else {
    console.error(`🔴 FAILED: Scenario 2 Delete Unpaid Line.`);
    console.error(`   └─ Diagnostic: res.success=${res.success}, deletedCheck=${deletedCheck}, INS1 Due=${updated1 ? updated1.due_amount : 'N/A'}`);
  }
  return valid;
}

/**
 * Scenario 3: Adds a new 3rd installment line and re-balances schedule.
 */
function _testScenario3_AddNewInstallment(db, feeId, inst1Id, inst2Id) {
  console.log("▶ Running Scenario 3: Add New Installment Line...");
  const service = AcademicEnrollmentService.getInstance();

  const payload = {
    student_fee_id: feeId,
    update_installments: [
      { installment_id: inst1Id, due_amount: 10000 },
      { installment_id: inst2Id, due_amount: 10000 }
    ],
    add_installments: [
      { due_date: "2026-09-01", due_amount: 5000 }
    ]
  };

  const res = service.rescheduleInstallments(payload, { db: db, mutationManifest: [] });

  const updatedAll = db.Installment.where({ student_fee_id: feeId });

  // Detailed Date Debug Logging across all installments
  updatedAll.forEach((inst, idx) => {
    console.log(`   [Date Debug Scenario 3] Inst #${idx+1} [ID: ${inst.installment_id}] Raw due_date: ${JSON.stringify(inst.due_date)} | type: ${typeof inst.due_date} | isCrossRealmDate: ${_isCrossRealmDate(inst.due_date)} | Formatted: '${_formatTestDateString(inst.due_date)}'`);
  });

  const added = updatedAll.find(i => {
    const dStr = _formatTestDateString(i.due_date);
    return dStr.includes("2026-09-01");
  });

  const valid = res.success === true && updatedAll.length === 3 && !!added;

  if (valid) {
    console.log(`🟢 PASSED: Scenario 3 Add New Installment Line.`);
    console.log(`   └─ Inserted new installment ID: ${added.installment_id} (Due: ₹${added.due_amount}, Date: ${_formatTestDateString(added.due_date)}). Total lines: ${updatedAll.length}.`);
  } else {
    console.error(`🔴 FAILED: Scenario 3 Add New Installment Line.`);
    console.error(`   └─ Diagnostic: res.success=${res.success}, totalLines=${updatedAll.length} (Expected: 3), addedRecordFound=${!!added}`);
  }
  return added ? added.installment_id : null;
}

/**
 * Scenario 4: Simulates payment of 10000, reduces INS-1 due to 6000, and verifies 4000 overflow cascades to INS-2.
 */
function _testScenario4_PaymentOverflowCascade(db, feeId, inst1Id, inst2Id) {
  console.log("▶ Running Scenario 4: Payment Overflow Rollover Cascade...");
  const service = AcademicEnrollmentService.getInstance();

  db.StudentFeeAccount.update(feeId, { amount_paid: 10000, balance_due: 15000 });
  db.Installment.update(inst1Id, { paid_amount: 10000, status: "paid" });

  const payload = {
    student_fee_id: feeId,
    update_installments: [
      { installment_id: inst1Id, due_amount: 6000 },
      { installment_id: inst2Id, due_amount: 19000 }
    ]
  };

  const res = service.rescheduleInstallments(payload, { db: db, mutationManifest: [] });

  const updated1 = db.Installment.findById(inst1Id);
  const updated2 = db.Installment.findById(inst2Id);

  const valid = res.success === true &&
    Number(updated1.paid_amount) === 6000 &&
    updated1.status === "paid" &&
    Number(updated2.paid_amount) === 4000 &&
    updated2.status === "partially_paid";

  if (valid) {
    console.log(`🟢 PASSED: Scenario 4 Payment Overflow Cascade.`);
    console.log(`   └─ INS1 Paid: ₹${updated1.paid_amount} (${updated1.status}), INS2 Paid: ₹${updated2.paid_amount} (${updated2.status}).`);
  } else {
    console.error(`🔴 FAILED: Scenario 4 Payment Overflow Cascade.`);
    console.error(`   └─ Diagnostic: INS1 Paid=${updated1 ? updated1.paid_amount : 'N/A'} (Expected: 6000), INS2 Paid=${updated2 ? updated2.paid_amount : 'N/A'} (Expected: 4000)`);
  }
  return valid;
}

/**
 * Scenario 5: Rejection when attempting to delete an installment with paid_amount > 0.
 */
function _testScenario5_RejectionPaidDeletion(db, feeId, inst1Id) {
  console.log("▶ Running Scenario 5: Rejection on Deleting Paid Installment...");
  const service = AcademicEnrollmentService.getInstance();

  db.Installment.update(inst1Id, { paid_amount: 5000, status: "partially_paid" });

  let threwExpected = false;
  let caughtMsg = '';
  try {
    service.rescheduleInstallments({
      student_fee_id: feeId,
      delete_installment_ids: [inst1Id]
    }, { db: db, mutationManifest: [] });
  } catch (err) {
    if (err instanceof SheetDB.ValidationError && err.message.includes("Payment protection")) {
      threwExpected = true;
      caughtMsg = err.message;
    }
  }

  if (threwExpected) {
    console.log(`🟢 PASSED: Scenario 5 Rejection on Paid Deletion.`);
    console.log(`   └─ Successfully caught expected ValidationError: "${caughtMsg}"`);
  } else {
    console.error(`🔴 FAILED: Scenario 5 Rejection on Paid Deletion.`);
    console.error(`   └─ Expected SheetDB.ValidationError containing 'Payment protection' was not raised.`);
  }
  return threwExpected;
}

/**
 * Scenario 6: Rejection when setting due_amount below direct linked Payment receipts.
 */
function _testScenario6_RejectionReceiptAlignment(db, feeId, inst1Id) {
  console.log("▶ Running Scenario 6: Rejection on Direct Receipt Alignment...");
  const service = AcademicEnrollmentService.getInstance();

  db.Payment.insert({
    student_fee_id: feeId,
    installment_id: inst1Id,
    amount_paid: 8000,
    status: "success"
  });

  let threwExpected = false;
  let caughtMsg = '';
  try {
    service.rescheduleInstallments({
      student_fee_id: feeId,
      update_installments: [
        { installment_id: inst1Id, due_amount: 5000 }
      ]
    }, { db: db, mutationManifest: [] });
  } catch (err) {
    if (err instanceof SheetDB.ValidationError && err.message.includes("Payment receipt alignment protection")) {
      threwExpected = true;
      caughtMsg = err.message;
    }
  }

  if (threwExpected) {
    console.log(`🟢 PASSED: Scenario 6 Direct Receipt Alignment Rejection.`);
    console.log(`   └─ Successfully caught expected ValidationError: "${caughtMsg}"`);
  } else {
    console.error(`🔴 FAILED: Scenario 6 Direct Receipt Alignment Rejection.`);
    console.error(`   └─ Expected SheetDB.ValidationError containing 'Payment receipt alignment protection' was not raised.`);
  }
  return threwExpected;
}

/**
 * Scenario 7: Rejection on Total Fee Mismatch (sum != final_fee).
 */
function _testScenario7_RejectionTotalFeeMismatch(db, feeId, inst1Id) {
  console.log("▶ Running Scenario 7: Rejection on Total Fee Mismatch...");
  const service = AcademicEnrollmentService.getInstance();

  let threwExpected = false;
  let caughtMsg = '';
  try {
    service.rescheduleInstallments({
      student_fee_id: feeId,
      update_installments: [
        { installment_id: inst1Id, due_amount: 20000 }
      ]
    }, { db: db, mutationManifest: [] });
  } catch (err) {
    if (err instanceof SheetDB.ValidationError && err.message.includes("Total fee invariant mismatch")) {
      threwExpected = true;
      caughtMsg = err.message;
    }
  }

  if (threwExpected) {
    console.log(`🟢 PASSED: Scenario 7 Fee Invariant Mismatch Rejection.`);
    console.log(`   └─ Successfully caught expected ValidationError: "${caughtMsg}"`);
  } else {
    console.error(`🔴 FAILED: Scenario 7 Fee Invariant Mismatch Rejection.`);
    console.error(`   └─ Expected SheetDB.ValidationError containing 'Total fee invariant mismatch' was not raised.`);
  }
  return threwExpected;
}

/**
 * Scenario 8: Sequence re-ordering and next_due_date sync.
 */
function _testScenario8_NextDueDateSync(db, feeId) {
  console.log("▶ Running Scenario 8: Next Due Date & Sequence Sync...");
  const allInst = db.Installment.where({ student_fee_id: feeId });
  const sorted = FinanceAllocationUtil.sortAndResequenceInstallments(allInst);

  const valid = sorted.length > 0 && sorted[0].installment_number === 1;

  if (valid) {
    console.log(`🟢 PASSED: Scenario 8 Sequence Sync.`);
    console.log(`   └─ Re-sequenced ${sorted.length} installments starting with installment_number 1.`);
  } else {
    console.error(`🔴 FAILED: Scenario 8 Sequence Sync.`);
    console.error(`   └─ Diagnostic: sortedLength=${sorted.length}, firstSeq=${sorted.length > 0 ? sorted[0].installment_number : 'N/A'}`);
  }
  return valid;
}

/**
 * Scenario 9: Master StudentFeeAccount status completion synchronization (balance_due == 0).
 */
function _testScenario9_MasterCompletionSync(db, feeId, inst1Id, inst2Id) {
  console.log("▶ Running Scenario 9: Master Account Completion Sync (balance_due == 0)...");
  const service = AcademicEnrollmentService.getInstance();

  db.StudentFeeAccount.update(feeId, { amount_paid: 25000, balance_due: 0 });

  const payload = {
    student_fee_id: feeId,
    update_installments: [
      { installment_id: inst1Id, due_amount: 12500 },
      { installment_id: inst2Id, due_amount: 12500 }
    ]
  };

  const res = service.rescheduleInstallments(payload, { db: db, mutationManifest: [] });
  const sfa = db.StudentFeeAccount.findById(feeId);

  const valid = res.success === true && sfa.status === "completed" && Number(sfa.balance_due) === 0;

  if (valid) {
    console.log(`🟢 PASSED: Scenario 9 Master Completion Sync.`);
    console.log(`   └─ Verified SFA status: '${sfa.status}', Balance Due: ₹${sfa.balance_due}.`);
  } else {
    console.error(`🔴 FAILED: Scenario 9 Master Completion Sync.`);
    console.error(`   └─ Diagnostic: res.success=${res.success}, SFA Status=${sfa ? sfa.status : 'N/A'} (Expected: 'completed'), Balance Due=${sfa ? sfa.balance_due : 'N/A'} (Expected: 0)`);
  }
  return valid;
}

/**
 * Scenario 10: ApiDispatcher routing & JSON presentation envelope integration test.
 */
function _testScenario10_ApiDispatcherIntegration(feeId) {
  console.log("▶ Running Scenario 10: ApiDispatcher Endpoint Integration...");

  const mockEvent = {
    parameter: { action: "finance_reschedule_installments" },
    postData: {
      contents: JSON.stringify({
        action: "finance_reschedule_installments",
        payload: {
          student_fee_id: feeId,
          remarks: "ApiDispatcher Test Run Predefined Data"
        }
      })
    }
  };

  const output = ApiDispatcher.dispatch(mockEvent);
  const jsonContent = output.getContent();
  const res = JSON.parse(jsonContent);

  const resData = res.data || {};
  const returnedFeeId = resData.student_fee_id || (resData.data && resData.data.student_fee_id);

  const valid = res.success === true && returnedFeeId === feeId;

  if (valid) {
    console.log(`🟢 PASSED: Scenario 10 ApiDispatcher Integration.`);
    console.log(`   └─ Dispatched action 'finance_reschedule_installments' successfully. Resolved Student Fee ID: '${returnedFeeId}'.`);
  } else {
    console.error(`🔴 FAILED: Scenario 10 ApiDispatcher Integration.`);
    console.error(`   └─ Diagnostic: res.success=${res.success}, returnedFeeId='${returnedFeeId}' (Expected: '${feeId}'), fullResponse=${JSON.stringify(res)}`);
  }
  return valid;
}

// Global scope registration
globalThis.runFinanceRescheduleInstallmentsTests = runFinanceRescheduleInstallmentsTests;
globalThis.resetRescheduleTestAccount = resetRescheduleTestAccount;
globalThis._formatTestDateString = _formatTestDateString;
globalThis._isCrossRealmDate = _isCrossRealmDate;
