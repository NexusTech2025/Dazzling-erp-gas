/**
 * @file Finance_PaymentRecord_ApiTest.js
 * Path: DazzlingDB/apitest/Finance_PaymentRecord_ApiTest.js
 * API Integration Test Suite for Student Payment Record operations (RecordPaymentAction).
 * Executes against predefined fixed entities (SFA-002002, INS-002001, INS-002002) in FixedMockData.
 * 
 * Standalone IDE Entry Points:
 * 1. `seedPaymentTestData()`     - Manually seeds & verifies the test database via ApiTestSeedHook.prepareDB.
 * 2. `runFinancePaymentRecordApiTest()` - Manually runs payment transaction test suite against pre-seeded data.
 * 3. `purgePaymentTestData()`    - Manually purges the testing database clean via ApiTestSeedHook.purgeAll.
 */

/**
 * Decoupled standalone helper function to reset a StudentFeeAccount and its associated
 * Installments and Payment transactions back to a clean, unpaid initial state.
 * Can be executed independently from IDE or invoked within test lifecycle hooks for reusability.
 * * @param {string} [studentFeeId="SFA-002002"] - Target StudentFeeAccount ID to reset.
 * @returns {Object} Operational status report detailing reset counts.
 */
function resetStudentFeeAccount(studentFeeId) {
  const targetFeeId = studentFeeId || "SFA-002002";
  console.log(`\n🔄 [RESET HOOK] Resetting Student Fee Account '${targetFeeId}' & Payment Transactions...`);

  const initialEnv = typeof PropertiesService !== "undefined"
    ? PropertiesService.getScriptProperties().getProperty("ENV")
    : "DEVELOPMENT";

  try {
    if (typeof PropertiesService !== "undefined") {
      PropertiesService.getScriptProperties().setProperty("ENV", "TESTING");
    }

    const db = DBContext.getInstance();
    db.bootstrapRepositories();

    // 1. Locate and Delete All Associated Payment Records
    const payments = db.Payment.where({ student_fee_id: targetFeeId });
    let deletedPaymentCount = 0;

    if (payments && payments.length > 0) {
      const paymentIds = payments.map(p => p.payment_id);
      db.Payment.deleteMany({ payment_id: paymentIds });
      deletedPaymentCount = paymentIds.length;
      console.log(`   └─ Deleted ${deletedPaymentCount} Payment transaction record(s).`);
    } else {
      console.log(`   └─ No Payment records found for '${targetFeeId}'.`);
    }

    // 2. Reset All Child Installments to Initial Unpaid State
    const installments = db.Installment.where({ student_fee_id: targetFeeId });
    let resetInstallmentCount = 0;

    if (installments && installments.length > 0) {
      installments.forEach(inst => {
        db.Installment.update(inst.installment_id, {
          paid_amount: 0,
          status: "pending",
          late_fee_amount: 0
        });
        resetInstallmentCount++;
      });
      console.log(`   └─ Reset ${resetInstallmentCount} Installment record(s) to 'pending' with paid_amount = 0.`);
    }

    // 3. Reset Parent StudentFeeAccount Master Record
    const feeAcc = db.StudentFeeAccount.findById(targetFeeId);
    if (feeAcc) {
      const originalFinalFee = Number(feeAcc.final_fee || feeAcc.total_amount || 0);
      db.StudentFeeAccount.update(targetFeeId, {
        amount_paid: 0,
        balance_due: originalFinalFee,
        status: "active"
      });
      console.log(`   └─ Reset StudentFeeAccount '${targetFeeId}': amount_paid = 0, balance_due = ₹${originalFinalFee}, status = 'active'.`);
    } else {
      console.warn(`   ⚠️ StudentFeeAccount '${targetFeeId}' not found in database.`);
    }

    // 4. Invalidate PrimaryKeyCache to Prevent Stale State Lookups
    if (db._pkCache) {
      db._pkCache.invalidate("Payment");
      db._pkCache.invalidate("Installment");
      db._pkCache.invalidate("StudentFeeAccount");
    }

    console.log(`✅ [RESET HOOK] Reset completed successfully for '${targetFeeId}'.\n`);

    return {
      success: true,
      student_fee_id: targetFeeId,
      deleted_payments: deletedPaymentCount,
      reset_installments: resetInstallmentCount
    };

  } catch (err) {
    console.error(`❌ [RESET HOOK] Failed to reset StudentFeeAccount '${targetFeeId}': ${err.message}`);
    throw err;
  } finally {
    if (typeof PropertiesService !== "undefined") {
      PropertiesService.getScriptProperties().setProperty("ENV", initialEnv);
    }
  }
}




const Finance_PaymentRecord_ApiTest = (function () {

  function run() {
    const { logger, callApi, printTable } = ApiTestHelper;

    console.log("\n🧪 STARTING FINANCE PAYMENT RECORD API TEST SUITE 🧪\n");

    // 1. Preserve Environment State
    const initialEnv = typeof PropertiesService !== "undefined"
      ? PropertiesService.getScriptProperties().getProperty("ENV")
      : "DEVELOPMENT";

    const timings = {};
    const stats = { passed: 0, failed: 0, scenarios: [] };

    // Dynamic Suffix Isolation
    const suffix = Math.random().toString(36).substring(7).toUpperCase();

    // Target Canonical Predefined Entity Identifiers (from FixedMockData.RAW_DATA)
    const targetFeeAccountId = "SFA-002002";   // Final Fee: ₹35,000, Initial Paid: ₹0, Balance: ₹35,000
    const targetInstallmentId1 = "INS-002001"; // Due: ₹17,500, Paid: ₹0, Status: pending
    const targetInstallmentId2 = "INS-002002"; // Due: ₹17,500, Paid: ₹0, Status: pending

    // Track Created Payments for Teardown
    let createdPaymentId1 = null;
    let createdPaymentId2 = null;

    function runScenario(name, fn) {
      const tStart = Date.now();
      try {
        fn();
        stats.passed++;
        stats.scenarios.push({ name: name, status: "PASSED" });
        timings[name] = Date.now() - tStart;
      } catch (error) {
        stats.failed++;
        stats.scenarios.push({ name: name, status: "FAILED", error: error.message });
        timings[name] = Date.now() - tStart;
        throw error;
      }
    }

    try {
      // -----------------------------------------------------------------------
      // Phase 0: Pre-Flight Database Context Verification
      // -----------------------------------------------------------------------
      runScenario("Phase 0: Ensure Predefined Database Hydrated", () => {
        logger.phase("0: Ensure Predefined Database Hydrated");

        if (typeof PropertiesService !== "undefined") {
          PropertiesService.getScriptProperties().setProperty("ENV", "TESTING");
        }
        DBContext.getInstance().bootstrapRepositories();
        const db = DBContext.getInstance();

        // If target fee account does not exist, initialize via prepareDB
        if (!db.StudentFeeAccount || !db.StudentFeeAccount.findById(targetFeeAccountId)) {
          console.log("   ▶️ Target predefined data not found. Auto-executing prepareDB...");
          ApiTestSeedHook.prepareDB({ allowAutoOverride: true, env: "TESTING" });
        } else {
          console.log("   ✅ Target predefined data already present in database.");
        }

        logger.success(`Predefined Fee Account '${targetFeeAccountId}' and Installments '${targetInstallmentId1}', '${targetInstallmentId2}' verified in DB.`);
      });

      const db = DBContext.getInstance();

      // Resolve Auth Token
      const token = typeof PropertiesService !== "undefined"
        ? PropertiesService.getScriptProperties().getProperty("DEV_SUPER_TOKEN")
        : null;

      if (!token) {
        throw new Error("Bootstrap Token Missing: Please run DevBootstrap.run('TESTING') first.");
      }

      // -----------------------------------------------------------------------
      // Phase 1: Partial Payment Execution (Happy Path)
      // -----------------------------------------------------------------------
      runScenario("Phase 1: Execute Partial Payment (finance_record_payment)", () => {
        logger.phase("1: Execute Partial Payment (finance_record_payment)");

        const payload = {
          student_fee_id: targetFeeAccountId,
          installment_id: targetInstallmentId1,
          amount_paid: 5000,
          payment_method: "upi",
          transaction_reference: `UPI-${suffix}`,
          remarks: "Partial payment against predefined installment"
        };

        const res = callApi("finance_record_payment", payload, token);
        const resData = (res && res.data) ? res.data : res;

        if (!resData || !resData.payment_id) {
          throw new Error(`API call failed to return payment_id. Raw response: ${JSON.stringify(res)}`);
        }

        createdPaymentId1 = resData.payment_id;

        if (resData.balance_due !== 30000) {
          throw new Error(`Expected balance_due 30000, got ${resData.balance_due}`);
        }
        if (resData.installment_status !== "partially_paid") {
          throw new Error(`Expected installment_status 'partially_paid', got '${resData.installment_status}'`);
        }

        logger.success(`Payment ID '${createdPaymentId1}' recorded against predefined Fee Account '${targetFeeAccountId}'. New Balance: ₹${resData.balance_due}`);
      });

      // -----------------------------------------------------------------------
      // Phase 2: Triple Verification Pattern
      // -----------------------------------------------------------------------
      runScenario("Phase 2: Triple Verification (DSL Query & Direct ORM)", () => {
        logger.phase("2: Triple Verification (DSL Query & Direct ORM)");

        // 2a. DSL Query Engine Check
        const queryRes = callApi("data_query", {
          target: "Payment",
          where: { payment_id: createdPaymentId1 },
          include: { installment: {}, studentfeeaccount: {} }
        }, token);

        const queryData = (queryRes && queryRes.data) ? queryRes.data : queryRes;

        if (!queryData || queryData.length === 0) {
          throw new Error("Payment record not found via DSL Query Engine.");
        }

        const queryPayment = queryData[0];
        if (!queryPayment.installment || queryPayment.installment.installment_id !== targetInstallmentId1) {
          throw new Error("DSL Query hydration check failed for related installment.");
        }

        // 2b. Direct ORM Consistency Check
        const instRow = db.Installment.findById(targetInstallmentId1);
        if (!instRow || instRow.paid_amount !== 5000 || instRow.status !== "partially_paid") {
          throw new Error(`Direct ORM check failed for Installment state. Paid: ${instRow ? instRow.paid_amount : null}`);
        }

        const feeAccRow = db.StudentFeeAccount.findById(targetFeeAccountId);
        if (!feeAccRow || feeAccRow.amount_paid !== 5000 || feeAccRow.balance_due !== 30000) {
          throw new Error(`Direct ORM check failed for StudentFeeAccount state. Balance: ${feeAccRow ? feeAccRow.balance_due : null}`);
        }

        logger.success("Triple verification passed across API, DSL query, and Direct ORM levels.");
      });

      // -----------------------------------------------------------------------
      // Phase 3: Full Settlement Subsequent Payment
      // -----------------------------------------------------------------------
      runScenario("Phase 3: Execute Settlement Payment to Complete Installment", () => {
        logger.phase("3: Execute Settlement Payment to Complete Installment");

        const payload = {
          student_fee_id: targetFeeAccountId,
          installment_id: targetInstallmentId1,
          amount_paid: 12500,
          payment_method: "cash",
          transaction_reference: `CASH-${suffix}`
        };

        const res = callApi("finance_record_payment", payload, token);
        const resData = (res && res.data) ? res.data : res;

        if (!resData || !resData.payment_id) {
          throw new Error(`API call failed to return payment_id. Raw response: ${JSON.stringify(res)}`);
        }

        createdPaymentId2 = resData.payment_id;

        if (resData.installment_status !== "paid") {
          throw new Error(`Expected installment_status 'paid', got '${resData.installment_status}'`);
        }
        if (resData.balance_due !== 17500) {
          throw new Error(`Expected balance_due 17500, got ${resData.balance_due}`);
        }

        // Direct ORM verify
        const instRow = db.Installment.findById(targetInstallmentId1);
        if (instRow.paid_amount !== 17500 || instRow.status !== "paid") {
          throw new Error(`Installment state failed settlement assertion. Paid: ${instRow.paid_amount}, Status: '${instRow.status}'`);
        }

        logger.success(`Settlement Payment '${createdPaymentId2}' recorded. Predefined Installment #1 fully paid (₹17,500). Remaining account balance: ₹${resData.balance_due}`);
      });

      // -----------------------------------------------------------------------
      // Phase 4: Negative Validation Checks
      // -----------------------------------------------------------------------
      runScenario("Phase 4: Negative Validation Checks via ApiDispatcher", () => {
        logger.phase("4: Negative Validation Checks via ApiDispatcher");

        // 4a. Zero / Negative Amount
        const invalidAmountEvent = {
          postData: {
            contents: JSON.stringify({
              action: "finance_record_payment",
              token: token,
              payload: {
                student_fee_id: targetFeeAccountId,
                installment_id: targetInstallmentId2,
                amount_paid: 0,
                payment_method: "cash"
              }
            })
          }
        };
        const rawRes1 = ApiDispatcher.dispatch(invalidAmountEvent);
        const parsed1 = rawRes1.getContent ? JSON.parse(rawRes1.getContent()) : rawRes1;
        if (parsed1.success !== false) {
          throw new Error("Validation failed: Zero payment amount was unexpectedly allowed.");
        }
        logger.success(`Zero amount blocked correctly: ${parsed1.error.message}`);

        // 4b. Invalid Payment Method Enum
        const invalidMethodEvent = {
          postData: {
            contents: JSON.stringify({
              action: "finance_record_payment",
              token: token,
              payload: {
                student_fee_id: targetFeeAccountId,
                installment_id: targetInstallmentId2,
                amount_paid: 1000,
                payment_method: "crypto"
              }
            })
          }
        };
        const rawRes2 = ApiDispatcher.dispatch(invalidMethodEvent);
        const parsed2 = rawRes2.getContent ? JSON.parse(rawRes2.getContent()) : rawRes2;
        if (parsed2.success !== false) {
          throw new Error("Validation failed: Invalid payment method enum was unexpectedly allowed.");
        }
        logger.success(`Invalid payment method blocked correctly: ${parsed2.error.message}`);
      });

      console.log("\n🎉 FINANCE PAYMENT RECORD API TEST COMPLETED SUCCESSFULLY! 🎉\n");

    } catch (e) {
      logger.error(`API Test Execution Failed: ${e.message}`);
    }

    // Output Performance & Execution Summary
    console.log("\n========================================================");
    console.log("⏱️  API TEST PERFORMANCE TIMINGS                        ⏱️");
    console.log("========================================================");
    let total = 0;
    for (const [step, time] of Object.entries(timings)) {
      console.log(`- ${step.padEnd(46)}: ${time} ms`);
      total += time;
    }
    console.log("--------------------------------------------------------");
    console.log(`- Total execution time                         : ${total} ms`);
    console.log("========================================================\n");

    return stats;
  }

  return { run };
})();

/**
 * Top-level Apps Script IDE Entry Point to manually seed the payment test dataset.
 * Uses ApiTestSeedHook.prepareDB to seed master mock entities and verify integrity.
 */
function seedPaymentTestData() {
  console.log("\n🌱 [SEED HOOK] Manually Seeding Payment Test Dataset...");
  ApiTestSeedHook.prepareDB({ allowAutoOverride: true, env: "TESTING" });
  console.log("✅ Payment test dataset seeded and verified successfully.\n");
}

/**
 * Top-level Apps Script IDE Entry Point to manually run the payment transaction API test suite.
 */
function runFinancePaymentRecordApiTest() {
  Finance_PaymentRecord_ApiTest.run();
}


/**
 * Top-level Apps Script IDE Entry Point to manually reset payment state for a given fee account.
 * Defaults to 'SFA-002002' if no ID is passed.
 * * @param {string} [studentFeeId="SFA-002002"]
 */
function resetPaymentTestData() {
  resetStudentFeeAccount("SFA-002002");
}


/**
 * Top-level Apps Script IDE Entry Point to manually run the advanced payment transaction test suite.
 * Tests cascading overpayments, full account completion (status === 'completed'),
 * auto-forwarding on paid installments, and non-existent entity lookup boundaries.
 */
function runFinancePaymentRecordAdvancedApiTest() {
  Finance_PaymentRecord_Advanced_ApiTest.run();
}

/**
 * Top-level Apps Script IDE Entry Point to manually purge test data from the TESTING sandbox environment.
 */
function purgePaymentTestData() {
  console.log("\n🧹 [PURGE HOOK] Manually Purging Payment Test Dataset...");
  ApiTestSeedHook.purgeAll();
  console.log("✅ Testing database purged clean.\n");
}

const Finance_PaymentRecord_Advanced_ApiTest = (function () {

  function run() {
    const { logger, callApi, printTable } = ApiTestHelper;

    console.log("\n🧪 STARTING ADVANCED FINANCE PAYMENT RECORD API TEST SUITE 🧪\n");

    const initialEnv = typeof PropertiesService !== "undefined"
      ? PropertiesService.getScriptProperties().getProperty("ENV")
      : "DEVELOPMENT";

    const timings = {};
    const stats = { passed: 0, failed: 0, scenarios: [] };
    const suffix = Math.random().toString(36).substring(7).toUpperCase();

    const targetFeeAccountId = "SFA-002002";   // Final Fee: ₹35,000, Initial Paid: ₹0, Balance: ₹35,000
    const targetInstallmentId1 = "INS-002001"; // Due: ₹17,500
    const targetInstallmentId2 = "INS-002002"; // Due: ₹17,500

    function runScenario(name, fn) {
      const tStart = Date.now();
      try {
        fn();
        stats.passed++;
        stats.scenarios.push({ name: name, status: "PASSED" });
        timings[name] = Date.now() - tStart;
      } catch (error) {
        stats.failed++;
        stats.scenarios.push({ name: name, status: "FAILED", error: error.message });
        timings[name] = Date.now() - tStart;
        throw error;
      }
    }

    try {
      // -----------------------------------------------------------------------
      // Phase 0: Reset Target Account Baseline (amount_paid = 0)
      // -----------------------------------------------------------------------
      runScenario("Phase 0: Reset Target Account Baseline", () => {
        logger.phase("0: Reset Target Account Baseline");
        resetStudentFeeAccount(targetFeeAccountId);
        logger.success(`Account '${targetFeeAccountId}' reset to clean state (paid: ₹0, balance: ₹35,000).`);
      });

      const db = DBContext.getInstance();
      const token = typeof PropertiesService !== "undefined"
        ? PropertiesService.getScriptProperties().getProperty("DEV_SUPER_TOKEN")
        : null;

      if (!token) {
        throw new Error("Bootstrap Token Missing: Please run DevBootstrap.run('TESTING') first.");
      }

      // -----------------------------------------------------------------------
      // Phase 1: Cascading Overpayment Rollover (₹20,000 against INS-002001 due ₹17,500)
      // -----------------------------------------------------------------------
      runScenario("Phase 1: Cascading Overpayment Rollover", () => {
        logger.phase("1: Cascading Overpayment Rollover");

        const payload = {
          student_fee_id: targetFeeAccountId,
          installment_id: targetInstallmentId1,
          amount_paid: 20000,
          payment_method: "upi",
          transaction_reference: `UPI-CASCADE-${suffix}`,
          remarks: "Cascading overpayment test"
        };

        const res = callApi("finance_record_payment", payload, token);
        const resData = (res && res.data) ? res.data : res;

        if (!resData || !resData.payment_id) {
          throw new Error(`API call failed to return payment_id. Response: ${JSON.stringify(res)}`);
        }

        // Verify target installment INS-002001 is fully paid (₹17,500)
        const inst1 = db.Installment.findById(targetInstallmentId1);
        if (!inst1 || inst1.paid_amount !== 17500 || inst1.status !== "paid") {
          throw new Error(`Target Installment INS-002001 failed expected state. Paid: ${inst1 ? inst1.paid_amount : null}, Status: ${inst1 ? inst1.status : null}`);
        }

        // Verify excess ₹2,500 rolled over to INS-002002
        const inst2 = db.Installment.findById(targetInstallmentId2);
        if (!inst2 || inst2.paid_amount !== 2500 || inst2.status !== "partially_paid") {
          throw new Error(`Downstream Installment INS-002002 failed rollover assertion. Paid: ${inst2 ? inst2.paid_amount : null}, Status: ${inst2 ? inst2.status : null}`);
        }

        // Verify master account metrics (balance_due = ₹15,000, status = "active")
        if (resData.balance_due !== 15000) {
          throw new Error(`Expected balance_due 15000, got ${resData.balance_due}`);
        }

        logger.success(`Cascading Overpayment (₹20,000) successful! INS-002001 paid (₹17,500), INS-002002 received ₹2,500 rollover. New Balance: ₹${resData.balance_due}`);
      });

      // -----------------------------------------------------------------------
      // Phase 2: Full Account Completion Threshold (Remaining ₹15,000)
      // -----------------------------------------------------------------------
      runScenario("Phase 2: Full Account Completion Threshold (status === 'completed')", () => {
        logger.phase("2: Full Account Completion Threshold");

        const payload = {
          student_fee_id: targetFeeAccountId,
          installment_id: targetInstallmentId2,
          amount_paid: 15000,
          payment_method: "cash",
          transaction_reference: `CASH-COMPLETE-${suffix}`
        };

        const res = callApi("finance_record_payment", payload, token);
        const resData = (res && res.data) ? res.data : res;

        if (resData.balance_due !== 0) {
          throw new Error(`Expected balance_due 0, got ${resData.balance_due}`);
        }
        if (resData.account_status !== "completed") {
          throw new Error(`Expected account_status 'completed', got '${resData.account_status}'`);
        }

        const feeAcc = db.StudentFeeAccount.findById(targetFeeAccountId);
        if (!feeAcc || feeAcc.balance_due !== 0 || feeAcc.status !== "completed") {
          throw new Error(`ORM check failed for fee account completion state. Balance: ${feeAcc ? feeAcc.balance_due : null}, Status: ${feeAcc ? feeAcc.status : null}`);
        }

        logger.success(`Account Completion successful! Balance: ₹0, Status: 'completed'.`);
      });

      // -----------------------------------------------------------------------
      // Phase 3: Already-Paid Installment Auto-Forwarding
      // -----------------------------------------------------------------------
      runScenario("Phase 3: Already-Paid Installment Auto-Forwarding", () => {
        logger.phase("3: Already-Paid Installment Auto-Forwarding");

        // 3a. Reset account to clean state
        resetStudentFeeAccount(targetFeeAccountId);

        // 3b. Pay off INS-002001 completely (₹17,500)
        callApi("finance_record_payment", {
          student_fee_id: targetFeeAccountId,
          installment_id: targetInstallmentId1,
          amount_paid: 17500,
          payment_method: "upi",
          transaction_reference: `UPI-SETTLE-${suffix}`
        }, token);

        // Verify INS-002001 is paid
        const inst1 = db.Installment.findById(targetInstallmentId1);
        if (inst1.status !== "paid") {
          throw new Error("Setup failed: INS-002001 is not in 'paid' status.");
        }

        // 3c. Send a second payment targeting INS-002001 (already paid)
        const payload = {
          student_fee_id: targetFeeAccountId,
          installment_id: targetInstallmentId1,
          amount_paid: 5000,
          payment_method: "cash",
          transaction_reference: `CASH-FORWARD-${suffix}`
        };

        const res = callApi("finance_record_payment", payload, token);
        const resData = (res && res.data) ? res.data : res;

        // Verify that payment auto-forwarded to INS-002002
        const inst2 = db.Installment.findById(targetInstallmentId2);
        if (!inst2 || inst2.paid_amount !== 5000 || inst2.status !== "partially_paid") {
          throw new Error(`Auto-forwarding failed. INS-002002 paid_amount: ${inst2 ? inst2.paid_amount : null}, status: ${inst2 ? inst2.status : null}`);
        }

        logger.success(`Auto-Forwarding successful! Payment targeting paid INS-002001 forwarded to INS-002002 (paid: ₹5,000).`);
      });

      // -----------------------------------------------------------------------
      // Phase 4: Non-Existent Entity Lookups (EntityNotFound Boundaries)
      // -----------------------------------------------------------------------
      runScenario("Phase 4: Non-Existent Entity Lookups", () => {
        logger.phase("4: Non-Existent Entity Lookups");

        // 4a. Invalid student_fee_id
        const invalidFeeEvent = {
          postData: {
            contents: JSON.stringify({
              action: "finance_record_payment",
              token: token,
              payload: {
                student_fee_id: "SFA-999999",
                installment_id: targetInstallmentId1,
                amount_paid: 1000,
                payment_method: "cash"
              }
            })
          }
        };
        const rawRes1 = ApiDispatcher.dispatch(invalidFeeEvent);
        const parsed1 = rawRes1.getContent ? JSON.parse(rawRes1.getContent()) : rawRes1;
        if (parsed1.success !== false) {
          throw new Error("Validation failed: Non-existent student_fee_id was unexpectedly allowed.");
        }
        logger.success(`Invalid student_fee_id blocked correctly: ${parsed1.error ? parsed1.error.message : "Error"}`);

        // 4b. Invalid installment_id
        const invalidInstEvent = {
          postData: {
            contents: JSON.stringify({
              action: "finance_record_payment",
              token: token,
              payload: {
                student_fee_id: targetFeeAccountId,
                installment_id: "INS-999999",
                amount_paid: 1000,
                payment_method: "cash"
              }
            })
          }
        };
        const rawRes2 = ApiDispatcher.dispatch(invalidInstEvent);
        const parsed2 = rawRes2.getContent ? JSON.parse(rawRes2.getContent()) : rawRes2;
        if (parsed2.success !== false) {
          throw new Error("Validation failed: Non-existent installment_id was unexpectedly allowed.");
        }
        logger.success(`Invalid installment_id blocked correctly: ${parsed2.error ? parsed2.error.message : "Error"}`);
      });

      console.log("\n🎉 ADVANCED FINANCE PAYMENT RECORD API TEST COMPLETED SUCCESSFULLY! 🎉\n");

    } catch (e) {
      logger.error(`Advanced API Test Execution Failed: ${e.message}`);
    }

    // Output Performance & Execution Summary
    console.log("\n========================================================");
    console.log("⏱️  ADVANCED API TEST PERFORMANCE TIMINGS               ⏱️");
    console.log("========================================================");
    let total = 0;
    for (const [step, time] of Object.entries(timings)) {
      console.log(`- ${step.padEnd(46)}: ${time} ms`);
      total += time;
    }
    console.log("--------------------------------------------------------");
    console.log(`- Total execution time                         : ${total} ms`);
    console.log("========================================================\n");

    return stats;
  }

  return { run };
})();

