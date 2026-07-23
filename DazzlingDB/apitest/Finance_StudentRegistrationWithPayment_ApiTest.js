/**
 * @file Finance_StudentRegistrationWithPayment_ApiTest.js
 * Path: DazzlingDB/apitest/Finance_StudentRegistrationWithPayment_ApiTest.js
 * API Integration Test Suite combining Pre-Flight Master Mock Seeding and Student Registration
 * (Enrollment + Fee Account Provisioning without Payment Recording).
 * 
 * Instructions: Run `runFinanceStudentRegistrationWithPaymentApiTest()` from the Apps Script editor.
 */

const Finance_StudentRegistrationWithPayment_ApiTest = (function () {

  function run() {
    const { logger, callApi, printTable } = ApiTestHelper;

    console.log("\n🧪 STARTING STUDENT REGISTRATION (ENROLLMENT & FEE ACCOUNT) API TEST SUITE 🧪\n");

    // 1. Preserve Environment State
    const initialEnv = typeof PropertiesService !== "undefined"
      ? PropertiesService.getScriptProperties().getProperty("ENV")
      : "DEVELOPMENT";

    const timings = {};
    const stats = { passed: 0, failed: 0, scenarios: [] };

    // Dynamic Suffix Isolation
    const suffix = Math.random().toString(36).substring(7).toUpperCase();

    // Track Created Registration Identifiers
    let registeredStudentId = null;
    let registeredFeeAccountId = null;
    let registeredInstallmentId = null;

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
      // Phase 0: Pre-Flight Data Seed Hook (ApiTestSeedHook)
      // -----------------------------------------------------------------------
      runScenario("Phase 0: Execute Pre-Flight Data Seed (ApiTestSeedHook)", () => {
        logger.phase("0: Execute Pre-Flight Data Seed (ApiTestSeedHook)");

        // Invoke Pre-Flight Hook with allowAutoOverride = true
        ApiTestSeedHook.seed({ allowAutoOverride: true, env: "TESTING" });
        logger.success("Pre-flight data seed hook executed. Master entities ready with fixed IDs.");
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
      // Phase 1: Register Student with Fee Account (student_register)
      // -----------------------------------------------------------------------
      runScenario("Phase 1: Register Student with Fee Account (student_register)", () => {
        logger.phase("1: Register Student with Fee Account (student_register)");

        const res = ApiTestSeedHook.registerStudent({
          suffix: suffix,
          total_fee: 20000,
          installment_count: 4
        }, token);

        if (!res || !res.student_id) {
          throw new Error("student_register call failed to return student_id.");
        }

        registeredStudentId = res.student_id;
        if (res.feeAccount) {
          registeredFeeAccountId = res.feeAccount.student_fee_id;
          if (res.feeAccount.installments && res.feeAccount.installments.length > 0) {
            registeredInstallmentId = res.feeAccount.installments[0].installment_id;
          }
        }

        logger.success(`Student registered successfully (no payment): Student ID '${registeredStudentId}', Fee Account '${registeredFeeAccountId}'`);
      });

      // -----------------------------------------------------------------------
      // Phase 2: Triple Verification Pattern (Student & Fee Account State)
      // -----------------------------------------------------------------------
      runScenario("Phase 2: Triple Verification Pattern (Student & Fee Account)", () => {
        logger.phase("2: Triple Verification Pattern (Student & Fee Account)");

        // 2a. DSL Query Engine Verification
        const queryRes = callApi("data_query", {
          target: "Student",
          where: { student_id: registeredStudentId },
          include: { address: {}, contact: {}, enrollments: {} }
        }, token);

        if (!queryRes || !queryRes.data || queryRes.data.length === 0) {
          throw new Error("Registered Student record not found via DSL Query Engine.");
        }

        // 2b. Direct ORM Model Verification for Fee Account and Installments
        if (!registeredFeeAccountId) {
          const enrollment = db.Enrollment.findOne({ student_id: registeredStudentId });
          if (enrollment) {
            const feeAcc = db.StudentFeeAccount.findOne({ enrollment_id: enrollment.enrollment_id });
            if (feeAcc) registeredFeeAccountId = feeAcc.student_fee_id;
          }
        }

        const feeAccRow = db.StudentFeeAccount.findById(registeredFeeAccountId);
        if (!feeAccRow) {
          throw new Error(`Direct ORM check failed: StudentFeeAccount '${registeredFeeAccountId}' not found.`);
        }
        if (feeAccRow.amount_paid !== 0) {
          throw new Error(`Expected amount_paid 0, got ${feeAccRow.amount_paid}`);
        }
        if (feeAccRow.balance_due !== 20000) {
          throw new Error(`Expected balance_due 20000, got ${feeAccRow.balance_due}`);
        }

        // Verify 4 installments created in pending state
        const instRows = db.Installment.where({ student_fee_id: registeredFeeAccountId });
        if (!instRows || instRows.length !== 4) {
          throw new Error(`Direct ORM check failed: Expected 4 installments, got ${instRows ? instRows.length : 0}`);
        }
        instRows.forEach((inst, idx) => {
          if (inst.paid_amount !== 0 || inst.status !== "pending") {
            throw new Error(`Expected installment #${idx + 1} status 'pending' with paid_amount 0, got status '${inst.status}' and paid_amount ${inst.paid_amount}`);
          }
        });

        logger.success("Triple verification passed: Student enrolled with 4 pending installments (₹20,000 balance due, ₹0 paid).");
      });

      console.log("\n🎉 STUDENT REGISTRATION (ENROLLMENT ONLY) API TEST COMPLETED SUCCESSFULLY! 🎉\n");

    } catch (e) {
      logger.error(`API Test Execution Failed: ${e.message}`);
    } finally {
      // 3. LIFO Reverse-Topological Teardown & Optional Hook Purge
      logger.phase("N: Teardown and Cleanup");
      const db = DBContext.getInstance();

      if (registeredStudentId) {
        try {
          const enrollments = db.Enrollment.where({ student_id: registeredStudentId });
          enrollments.forEach(e => {
            db.BatchAllocation.where({ enrollment_id: e.enrollment_id }).forEach(ba => db.BatchAllocation.remove(ba.allocation_id));
            const sfas = db.StudentFeeAccount.where({ enrollment_id: e.enrollment_id });
            sfas.forEach(sfa => {
              db.Installment.where({ student_fee_id: sfa.student_fee_id }).forEach(inst => db.Installment.remove(inst.installment_id));
              db.StudentFeeAccount.remove(sfa.student_fee_id);
            });
            db.Enrollment.remove(e.enrollment_id);
          });
          const addr = db.Address.findOne({ student_id: registeredStudentId });
          if (addr) db.Address.remove(addr.address_id);
          const contact = db.ContactInfo.findOne({ student_id: registeredStudentId });
          if (contact) db.ContactInfo.remove(contact.contact_id);
          db.Education.where({ student_id: registeredStudentId }).forEach(ed => db.Education.remove(ed.education_id));
          db.Student.remove(registeredStudentId);
          logger.success(`Evicted Registered Student Graph: ${registeredStudentId}`);
        } catch (_) {}
      }

      // Execute Purge via Pre-Flight Hook
      ApiTestSeedHook.purge({ restoreEnv: initialEnv });
      logger.success("Environment state restored via ApiTestSeedHook.purge().");
    }

    // 4. Output Performance & Execution Summary
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

function runFinanceStudentRegistrationWithPaymentApiTest() {
  Finance_StudentRegistrationWithPayment_ApiTest.run();
}
