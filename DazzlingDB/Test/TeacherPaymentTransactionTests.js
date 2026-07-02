/**
 * @file TeacherPaymentTransactionTests.js
 * Integration and validation test suite for the Teacher Payment Transaction manual entry workflow.
 * Path: DazzlingDB/Test/TeacherPaymentTransactionTests.js
 */

function runTeacherPaymentTransactionTests() {
  console.log("🚀 Starting Teacher Payment Transaction Subsystem Tests...");

  const scriptProperties = PropertiesService.getScriptProperties();
  const originalEnv = scriptProperties.getProperty('ENV') || 'DEVELOPMENT';
  
  scriptProperties.setProperty('ENV', 'TESTING');

  const startTotalTime = Date.now();
  
  try {
    const db = DBContext.getInstance();
    db.bootstrapRepositories();
    console.log("✅ Testing environment sandboxed and bootstrapped successfully.");

    // Provision a mock teacher for transactional validation checks
    const suffix = Math.random().toString(36).substring(7).toUpperCase();
    const teacherMobile = "9" + Math.floor(100000000 + Math.random() * 900000000);
    const teacher = db.Teacher.insert({
      full_name: "Payout Test Teacher " + suffix,
      mobile_number: teacherMobile,
      email: `teacher_payout_${suffix.toLowerCase()}@example.com`,
      experience_years: 5,
      joining_date: "2026-06-01",
      teacher_type: "full_time"
    });
    console.log(`✅ Provisioned test Teacher: ${teacher.teacher_id}`);

    const context = { actionType: "CREATE", mutationManifest: [] };

    // --- Benchmark timing map ---
    const timings = [];

    const measureExecution = (testName, payload, shouldPass, expectedErrorField) => {
      const start = Date.now();
      let errorThrown = null;
      let record = null;
      
      try {
        record = StaffService.recordPayment(payload, context);
      } catch (err) {
        errorThrown = err;
      }
      
      const duration = Date.now() - start;
      timings.push({ test: testName, timeMs: duration });

      if (shouldPass) {
        if (errorThrown) {
          throw new Error(`[FAIL] ${testName} failed with unexpected error: ${errorThrown.message}`);
        }
        if (!record || !record.transaction_id.startsWith("TPT")) {
          throw new Error(`[FAIL] ${testName} failed to return a valid committed TPT record.`);
        }
        console.log(`✅ [PASS] ${testName} completed in ${duration}ms`);
      } else {
        if (!errorThrown) {
          throw new Error(`[FAIL] ${testName} expected to throw a ValidationError but passed.`);
        }
        if (!(errorThrown instanceof SheetDB.ValidationError)) {
          throw new Error(`[FAIL] ${testName} expected SheetDB.ValidationError but got: ${errorThrown.constructor.name}`);
        }
        
        if (expectedErrorField) {
          const hasField = errorThrown.details.fields.some(f => f.field === expectedErrorField);
          if (!hasField) {
            throw new Error(`[FAIL] ${testName} failed to flag validation error on field '${expectedErrorField}'. Errors: ${JSON.stringify(errorThrown.details.fields)}`);
          }
        }
        console.log(`✅ [PASS] ${testName} rejected correctly in ${duration}ms (Field: ${expectedErrorField})`);
      }
    };

    // =========================================================================
    // TEST CASE RUNS
    // =========================================================================

    // Case 1: Valid Manual Record
    measureExecution("TC1: Valid Salary Payment", {
      teacher_id: teacher.teacher_id,
      payment_type: "salary",
      amount: 45000.00,
      payment_method: "phonepe",
      transaction_date: "2026-06-30",
      salary_month: "2026-06",
      reference_number: "TXN123456789A",
      notes: "June payment including medical leave adjustments"
    }, true);

    // Case 2: Invalid Teacher ID format (prefix mismatch)
    measureExecution("TC2: Invalid Teacher ID Prefix", {
      teacher_id: "TCR-9999",
      payment_type: "salary",
      amount: 1000.00,
      payment_method: "cash",
      transaction_date: "2026-06-30",
      salary_month: "2026-06"
    }, false, "teacher_id");

    // Case 3: Non-existent Teacher ID
    measureExecution("TC3: Non-existent Teacher ID", {
      teacher_id: "TCH-9999",
      payment_type: "salary",
      amount: 1000.00,
      payment_method: "cash",
      transaction_date: "2026-06-30",
      salary_month: "2026-06"
    }, false, "teacher_id");

    // Case 4: Invalid Payment Type choice
    measureExecution("TC4: Invalid Payment Type Choice", {
      teacher_id: teacher.teacher_id,
      payment_type: "stipend",
      amount: 5000.00,
      payment_method: "bank",
      transaction_date: "2026-06-30",
      salary_month: "2026-06"
    }, false, "payment_type");

    // Case 5: Negative Payout Amount (Limit bounds constraint)
    measureExecution("TC5: Negative Amount Boundary", {
      teacher_id: teacher.teacher_id,
      payment_type: "salary",
      amount: -100.00,
      payment_method: "bank",
      transaction_date: "2026-06-30",
      salary_month: "2026-06"
    }, false, "amount");

    // Case 6: Invalid Payment Method choice
    measureExecution("TC6: Invalid Payment Method Choice", {
      teacher_id: teacher.teacher_id,
      payment_type: "bonus",
      amount: 500.00,
      payment_method: "credit_card",
      transaction_date: "2026-06-30",
      salary_month: "2026-06"
    }, false, "payment_method");

    // Case 7: Incorrect ISO Date Format
    measureExecution("TC7: Incorrect Date Formatting Pattern", {
      teacher_id: teacher.teacher_id,
      payment_type: "salary",
      amount: 20000.00,
      payment_method: "cash",
      transaction_date: "30-06-2026",
      salary_month: "2026-06"
    }, false, "transaction_date");

    // Case 8: Future Dated Scheduling Entry
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    measureExecution("TC8: Future Date Entry Block", {
      teacher_id: teacher.teacher_id,
      payment_type: "advance",
      amount: 15000.00,
      payment_method: "bank",
      transaction_date: tomorrowStr,
      salary_month: "2026-07"
    }, false, "transaction_date");

    // Case 9: Invalid Salary Month Sizing Format
    measureExecution("TC9: Invalid Salary Month Sizing Format", {
      teacher_id: teacher.teacher_id,
      payment_type: "salary",
      amount: 1000.00,
      payment_method: "cash",
      transaction_date: "2026-06-30",
      salary_month: "2026-6"
    }, false, "salary_month");

    // Case 10: Out of Bound Year Coordinate for Salary Month
    measureExecution("TC10: Out of Bound Year Constraint", {
      teacher_id: teacher.teacher_id,
      payment_type: "salary",
      amount: 1000.00,
      payment_method: "cash",
      transaction_date: "2026-06-30",
      salary_month: "2019-12"
    }, false, "salary_month");

    // Print Timing Benchmark Table (Rule N5 compliance)
    console.log("\n=== PERFORMANCE TIMINGS BENCHMARK (Rule N5) ===");
    console.log("-----------------------------------------------");
    console.log("| Test Name                        | Time (ms) |");
    console.log("-----------------------------------------------");
    timings.forEach(t => {
      console.log(`| ${t.test.padEnd(32)} | ${String(t.timeMs).padStart(9)} |`);
    });
    console.log("-----------------------------------------------");
    const totalMs = Date.now() - startTotalTime;
    console.log(`Total execution time: ${totalMs}ms`);

  } finally {
    // Revert sandboxed environment state
    scriptProperties.setProperty('ENV', originalEnv);
    console.log(`🧹 Test suite finished. Restored original environment to: ${originalEnv}`);
  }
}
