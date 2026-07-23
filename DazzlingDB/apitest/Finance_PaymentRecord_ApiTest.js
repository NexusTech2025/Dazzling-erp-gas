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

        // Safe resolution of payment_id across payload structures
        const paymentId = (res && res.payment_id)
          || (res && res.data && res.data.payment_id)
          || (res && res._attributes && res._attributes.payment_id);

        if (!res || !paymentId) {
          throw new Error(`API call failed to return payment_id. Raw response: ${JSON.stringify(res)}`);
        }

        createdPaymentId1 = paymentId;

        if (res.balance_due !== 30000) {
          throw new Error(`Expected balance_due 30000, got ${res.balance_due}`);
        }
        if (res.installment_status !== "partially_paid") {
          throw new Error(`Expected installment_status 'partially_paid', got '${res.installment_status}'`);
        }

        logger.success(`Payment ID '${createdPaymentId1}' recorded against predefined Fee Account '${targetFeeAccountId}'. New Balance: ₹${res.balance_due}`);
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

        if (!queryRes || !queryRes.data || queryRes.data.length === 0) {
          throw new Error("Payment record not found via DSL Query Engine.");
        }

        const queryPayment = queryRes.data[0];
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
        const paymentId = (res && res.payment_id)
          || (res && res.data && res.data.payment_id)
          || (res && res._attributes && res._attributes.payment_id);

        createdPaymentId2 = paymentId;

        if (res.installment_status !== "paid") {
          throw new Error(`Expected installment_status 'paid', got '${res.installment_status}'`);
        }
        if (res.balance_due !== 17500) {
          throw new Error(`Expected balance_due 17500, got ${res.balance_due}`);
        }

        // Direct ORM verify
        const instRow = db.Installment.findById(targetInstallmentId1);
        if (instRow.paid_amount !== 17500 || instRow.status !== "paid") {
          throw new Error(`Installment state failed settlement assertion. Paid: ${instRow.paid_amount}, Status: '${instRow.status}'`);
        }

        logger.success(`Settlement Payment '${createdPaymentId2}' recorded. Predefined Installment #1 fully paid (₹17,500). Remaining account balance: ₹${res.balance_due}`);
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
 * Top-level Apps Script IDE Entry Point to manually purge test data from the TESTING sandbox environment.
 */
function purgePaymentTestData() {
  console.log("\n🧹 [PURGE HOOK] Manually Purging Payment Test Dataset...");
  ApiTestSeedHook.purgeAll();
  console.log("✅ Testing database purged clean.\n");
}
