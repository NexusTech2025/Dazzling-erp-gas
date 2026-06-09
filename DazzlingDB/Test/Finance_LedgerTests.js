/**
 * @file Finance_LedgerTests.js
 * Automated integration testing module for the Finance & Staff domains.
 * Validates CRUD operations, polymorphic relations, validation constraints, and delete policies.
 * 
 * INSTRUCTIONS:
 * Run 'runFinanceLedgerTests' from the Google Apps Script IDE.
 */

function runFinanceLedgerTests() {
  const activeEnv = typeof SYSTEM_ENV !== 'undefined' ? SYSTEM_ENV : 'development';
  if (activeEnv === 'production') {
    throw new Error("❌ Safety Guard: Test suite cannot be executed in the PRODUCTION environment.");
  }

  console.log("🚀 Starting Finance & Staff Domains integration tests...");
  
  const db = DBContext.getInstance();
  const results = {};
  const timings = {};
  const tSuiteStart = Date.now();

  const salt = Math.random().toString(36).substring(2, 9).toUpperCase();
  
  // Trackers for seeded IDs
  let catId = null;
  let staffId = null;
  let studentId = null;
  let teacherId = null;
  let mtxIds = [];

  try {
    console.log("\n=========================================");
    let tStart = Date.now();
    const scenario1Res = executeScenario1_CategoryAndStaffCRUD(db, salt, (cId, sId) => {
      catId = cId;
      staffId = sId;
    });
    timings["Scenario 1: Category & Staff CRUD"] = Date.now() - tStart;
    results.Scenario1 = scenario1Res;

    if (catId && staffId) {
      console.log("\n=========================================");
      tStart = Date.now();
      const scenario2Res = executeScenario2_PolymorphicTransactionCRUD(db, salt, catId, staffId, (stuId, tchId, listIds) => {
        studentId = stuId;
        teacherId = tchId;
        mtxIds = listIds;
      });
      timings["Scenario 2: Polymorphic CRUD"] = Date.now() - tStart;
      results.Scenario2 = scenario2Res;

      console.log("\n=========================================");
      tStart = Date.now();
      results.Scenario3 = executeScenario3_ValidationConstraints(db, catId);
      timings["Scenario 3: Validation Constraints"] = Date.now() - tStart;

      console.log("\n=========================================");
      tStart = Date.now();
      results.Scenario4 = executeScenario4_DeletionProtection(db, catId);
      timings["Scenario 4: Deletion Protection"] = Date.now() - tStart;

      console.log("\n=========================================");
      tStart = Date.now();
      results.Scenario5 = executeScenario5_NonBlockingDeletion(db, studentId, teacherId, staffId, mtxIds);
      timings["Scenario 5: Non-Blocking Deletion"] = Date.now() - tStart;
    } else {
      console.warn("⚠️ Skipping Scenario 2, 3, 4, 5 due to setup failures in Scenario 1.");
      results.Scenario2 = "❌ SKIPPED";
      results.Scenario3 = "❌ SKIPPED";
      results.Scenario4 = "❌ SKIPPED";
      results.Scenario5 = "❌ SKIPPED";
    }

  } catch (err) {
    console.error("❌ Unexpected test runner error:", err.message);
  } finally {
    console.log("\n=========================================");
    let tCleanupStart = Date.now();
    results.Scenario6 = executeScenario6_TeardownCleanup(db, mtxIds, catId, studentId, teacherId, staffId);
    timings["Scenario 6: Teardown & Cleanup"] = Date.now() - tCleanupStart;

    // Display formatted timing benchmark table
    const totalTime = Date.now() - tSuiteStart;
    console.log("\n========================================================");
    console.log("⏱️  FINANCIAL LEDGER TEST PERFORMANCE TIMING SUMMARY  ⏱️");
    console.log("========================================================");
    for (const step in timings) {
      console.log(`- ${step.padEnd(45)}: ${String(timings[step]).padStart(5)} ms`);
    }
    console.log("--------------------------------------------------------");
    console.log(`- Total Execution Time                         : ${String(totalTime).padStart(5)} ms`);
    console.log("========================================================\n");
  }

  console.log("📊 FINAL TEST RESULTS: \n", JSON.stringify(results, null, 2));
  console.log("🏁 Finance & Staff Tests Complete.");
  return results;
}

/**
 * SCENARIO 1: Successful CRUD on ExpenseCategory and StaffMember
 */
function executeScenario1_CategoryAndStaffCRUD(db, salt, setSeededIds) {
  console.log("▶️ SCENARIO 1: Category & Staff CRUD (Success Pathway)");
  try {
    // 1. Create Expense Category
    const catPayload = {
      name: "Office Utilities " + salt,
      type: "both",
      description: "Utility payments including water, internet, power"
    };
    console.log("   ⚙️ Inserting ExpenseCategory payload:", JSON.stringify(catPayload));
    const catResult = db.ExpenseCategory.insert(catPayload);
    
    if (!catResult.category_id || !catResult.category_id.startsWith("EXC-")) {
      throw new Error(`ExpenseCategory Primary Key generation failed. Got: ${catResult.category_id}`);
    }
    console.log(`   ✅ Success! Created ExpenseCategory with ID: ${catResult.category_id}`);

    // 2. Create Staff Member
    const staffPayload = {
      name: "Security Guard " + salt,
      role: "security",
      status: "active",
      phone: "+91-9999888877",
      email: "guard_" + salt.toLowerCase() + "@test.com"
    };
    console.log("   ⚙️ Inserting StaffMember payload:", JSON.stringify(staffPayload));
    const staffResult = db.StaffMember.insert(staffPayload);

    if (!staffResult.staff_id || !staffResult.staff_id.startsWith("STF-")) {
      throw new Error(`StaffMember Primary Key generation failed. Got: ${staffResult.staff_id}`);
    }
    console.log(`   ✅ Success! Created StaffMember with ID: ${staffResult.staff_id}`);

    // 3. Partial Update Staff Member
    console.log("   ⚙️ Updating StaffMember role to admin...");
    const updatedStaff = db.StaffMember.update(staffResult.staff_id, { role: "admin" });
    if (updatedStaff.role !== "admin") {
      throw new Error("StaffMember update failed to apply new role.");
    }
    console.log("   ✅ Success! StaffMember updated successfully.");

    setSeededIds(catResult.category_id, staffResult.staff_id);
    return "✅ PASSED";
  } catch (e) {
    console.error("   ❌ Scenario 1 Failed:", e.message);
    return `❌ FAILED: ${e.message}`;
  }
}

/**
 * SCENARIO 2: Successful Polymorphic MoneyTransaction CRUD
 */
function executeScenario2_PolymorphicTransactionCRUD(db, salt, catId, staffId, setPolymorphicIds) {
  console.log("▶️ SCENARIO 2: Polymorphic Transaction CRUD (Success Pathway)");
  const transactionIds = [];
  let studentId = null;
  let teacherId = null;

  try {
    // 1. Create a student to link polymorphically
    const studentPayload = {
      student_name: "Test Ledger Student " + salt,
      email: "ledg_stu_" + salt.toLowerCase() + "@test.com",
      phone: "+91-9988776655",
      status: "active"
    };
    console.log("   ⚙️ Inserting Student payload:", JSON.stringify(studentPayload));
    const studentResult = db.Student.insert(studentPayload);
    studentId = studentResult.student_id;
    console.log(`   ✅ Success! Created Student: ${studentId}`);

    // 2. Create a teacher to link polymorphically
    const teacherPayload = {
      full_name: "Test Ledger Teacher " + salt,
      email: "ledg_tch_" + salt.toLowerCase() + "@test.com",
      mobile_number: "9876543211",
      status: "active",
      experience_years: 5,
      teacher_type: "full_time",
      joining_date: "2026-06-09"
    };
    console.log("   ⚙️ Inserting Teacher payload:", JSON.stringify(teacherPayload));
    const teacherResult = db.Teacher.insert(teacherPayload);
    teacherId = teacherResult.teacher_id;
    console.log(`   ✅ Success! Created Teacher: ${teacherId}`);

    // 3. Create a transaction for Staff
    const tStaffPayload = {
      amount: 1500,
      type: "out",
      category_id: catId,
      payment_method: "cash",
      party_type: "staff",
      party_id: staffId,
      party_name: "Security Guard " + salt,
      transaction_date: "2026-06-09",
      notes: "Salary payout for May 2026"
    };
    console.log("   ⚙️ Inserting MoneyTransaction for Staff:", JSON.stringify(tStaffPayload));
    const tStaffResult = db.MoneyTransaction.insert(tStaffPayload);
    if (!tStaffResult.transaction_id || !tStaffResult.transaction_id.startsWith("MTX-")) {
      throw new Error(`MoneyTransaction ID generation failed. Got: ${tStaffResult.transaction_id}`);
    }
    transactionIds.push(tStaffResult.transaction_id);
    console.log(`   ✅ Success! Created Staff Transaction: ${tStaffResult.transaction_id}`);

    // 4. Create a transaction for Student
    const tStudentPayload = {
      amount: 4500,
      type: "in",
      category_id: catId,
      payment_method: "bank",
      party_type: "student",
      party_id: studentId,
      party_name: "Test Ledger Student " + salt,
      transaction_date: "2026-06-09",
      notes: "Admission fee deposit"
    };
    console.log("   ⚙️ Inserting MoneyTransaction for Student:", JSON.stringify(tStudentPayload));
    const tStudentResult = db.MoneyTransaction.insert(tStudentPayload);
    transactionIds.push(tStudentResult.transaction_id);
    console.log(`   ✅ Success! Created Student Transaction: ${tStudentResult.transaction_id}`);

    // 5. Create a transaction for Teacher
    const tTeacherPayload = {
      amount: 8000,
      type: "out",
      category_id: catId,
      payment_method: "paytm",
      party_type: "teacher",
      party_id: teacherId,
      party_name: "Test Ledger Teacher " + salt,
      transaction_date: "2026-06-09",
      notes: "Payout for course material creation"
    };
    console.log("   ⚙️ Inserting MoneyTransaction for Teacher:", JSON.stringify(tTeacherPayload));
    const tTeacherResult = db.MoneyTransaction.insert(tTeacherPayload);
    transactionIds.push(tTeacherResult.transaction_id);
    console.log(`   ✅ Success! Created Teacher Transaction: ${tTeacherResult.transaction_id}`);

    // 6. Create a transaction for External party (no profile record)
    const tExternalPayload = {
      amount: 450,
      type: "out",
      category_id: catId,
      payment_method: "other",
      party_type: "external",
      party_name: "Office Supplies Vendor",
      transaction_date: "2026-06-09",
      notes: "Office supplies bulk buy"
    };
    console.log("   ⚙️ Inserting MoneyTransaction for External Party:", JSON.stringify(tExternalPayload));
    const tExternalResult = db.MoneyTransaction.insert(tExternalPayload);
    transactionIds.push(tExternalResult.transaction_id);
    if (tExternalResult.party_id !== null && typeof tExternalResult.party_id !== 'undefined') {
      throw new Error(`External party_id should remain empty. Got: ${tExternalResult.party_id}`);
    }
    console.log(`   ✅ Success! Created External Transaction: ${tExternalResult.transaction_id}`);

    setPolymorphicIds(studentId, teacherId, transactionIds);
    return "✅ PASSED";
  } catch (e) {
    console.error("   ❌ Scenario 2 Failed:", e.message);
    return `❌ FAILED: ${e.message}`;
  }
}

/**
 * SCENARIO 3: Validation Constraints (Failure Pathway)
 */
function executeScenario3_ValidationConstraints(db, catId) {
  console.log("▶️ SCENARIO 3: Validation Constraints (Failure Pathway)");
  let passed = true;
  let failures = [];

  // Test A: Negative Amount constraint
  try {
    console.log("   ⚙️ Attempting to insert negative amount...");
    db.MoneyTransaction.insert({
      amount: -1500, // Invalid
      type: "out",
      category_id: catId,
      transaction_date: "2026-06-09"
    });
    passed = false;
    failures.push("Failed to block negative transaction amount.");
  } catch (e) {
    if (e.name !== "ValidationError") {
      passed = false;
      failures.push(`Expected ValidationError for negative amount, but got: ${e.name} (${e.message})`);
    } else {
      console.log("   ✅ Successfully blocked negative transaction amount.");
    }
  }

  // Test B: Invalid transaction direction enum choice
  try {
    console.log("   ⚙️ Attempting to insert invalid direction type...");
    db.MoneyTransaction.insert({
      amount: 1500,
      type: "incoming", // Invalid: must be "in" or "out"
      category_id: catId,
      transaction_date: "2026-06-09"
    });
    passed = false;
    failures.push("Failed to block invalid direction choice.");
  } catch (e) {
    if (e.name !== "ValidationError") {
      passed = false;
      failures.push(`Expected ValidationError for invalid enum direction, but got: ${e.name} (${e.message})`);
    } else {
      console.log("   ✅ Successfully blocked invalid transaction direction.");
    }
  }

  // Test C: Missing Required Field (transaction_date)
  try {
    console.log("   ⚙️ Attempting to insert transaction with missing transaction_date...");
    db.MoneyTransaction.insert({
      amount: 1500,
      type: "in",
      category_id: catId
      // Missing transaction_date
    });
    passed = false;
    failures.push("Failed to block missing transaction_date.");
  } catch (e) {
    if (e.name !== "ValidationError") {
      passed = false;
      failures.push(`Expected ValidationError for missing transaction_date, but got: ${e.name} (${e.message})`);
    } else {
      console.log("   ✅ Successfully blocked missing transaction_date.");
    }
  }

  return passed ? "✅ PASSED" : `❌ FAILED: ${failures.join(" | ")}`;
}

/**
 * SCENARIO 4: Deletion Protection (Failure Pathway)
 */
function executeScenario4_DeletionProtection(db, catId) {
  console.log("▶️ SCENARIO 4: Deletion Protection (Failure Pathway)");
  try {
    console.log(`   ⚙️ Attempting to delete protected category: ${catId}...`);
    db.ExpenseCategory.remove(catId);
    
    return `❌ FAILED: Deletion succeeded but it should have been blocked by protect rule.`;
  } catch (e) {
    const isIntegrityError = e.name === "IntegrityError" || e.message.indexOf("Delete Protected") !== -1 || e.message.indexOf("protect") !== -1;
    if (!isIntegrityError) {
      return `❌ FAILED: Expected IntegrityError, but got ${e.name}: ${e.message}`;
    }
    
    // Assert that record still exists
    const catExists = db.ExpenseCategory.exists({ category_id: catId });
    if (!catExists) {
      return `❌ FAILED: Deletion was blocked but category ${catId} was deleted from sheet.`;
    }
    
    console.log(`   ✅ Caught expected IntegrityError: "${e.message}"`);
    return "✅ PASSED";
  }
}

/**
 * SCENARIO 5: Non-Blocking Deletion (Success Pathway)
 */
function executeScenario5_NonBlockingDeletion(db, studentId, teacherId, staffId, mtxIds) {
  console.log("▶️ SCENARIO 5: Non-Blocking Deletion (Success Pathway)");
  try {
    // 1. Delete Student, Teacher and StaffMember (which have active transactions linked)
    console.log(`   ⚙️ Deleting Student: ${studentId}`);
    db.Student.remove(studentId);

    console.log(`   ⚙️ Deleting Teacher: ${teacherId}`);
    db.Teacher.remove(teacherId);

    console.log(`   ⚙️ Deleting StaffMember: ${staffId}`);
    db.StaffMember.remove(staffId);

    // Verify deletions succeeded
    if (db.Student.exists({ student_id: studentId }) || 
        db.Teacher.exists({ teacher_id: teacherId }) || 
        db.StaffMember.exists({ staff_id: staffId })) {
      throw new Error("One or more parent entities were not deleted.");
    }
    console.log("   ✅ Parents successfully deleted under non-blocking policies.");

    // Verify that the transactions themselves are intact
    console.log("   ⚙️ Checking if transactions were preserved...");
    mtxIds.forEach(id => {
      const exists = db.MoneyTransaction.exists({ transaction_id: id });
      if (!exists) {
        throw new Error(`Transaction ${id} was deleted when parent was removed.`);
      }
    });
    console.log("   ✅ Success! All transaction records preserved intact.");

    return "✅ PASSED";
  } catch (e) {
    console.error("   ❌ Scenario 5 Failed:", e.message);
    return `❌ FAILED: ${e.message}`;
  }
}

/**
 * SCENARIO 6: Reverse-topological Teardown Cleanup
 */
function executeScenario6_TeardownCleanup(db, mtxIds, catId, studentId, teacherId, staffId) {
  console.log("▶️ SCENARIO 6: Teardown Cleanup (Life Cycle)");
  try {
    // Clean up bottom-up
    console.log("   ⚙️ Deleting child transaction records...");
    mtxIds.forEach(id => {
      try {
        if (db.MoneyTransaction.exists({ transaction_id: id })) {
          db.MoneyTransaction.remove(id);
        }
      } catch (err) {}
    });

    console.log("   ⚙️ Deleting category records...");
    try {
      if (catId && db.ExpenseCategory.exists({ category_id: catId })) {
        db.ExpenseCategory.remove(catId);
      }
    } catch (err) {}

    // Safety cleanup for parents if deletion was blocked in previous test run
    console.log("   ⚙️ Ensuring parent test records are cleaned up...");
    try {
      if (studentId && db.Student.exists({ student_id: studentId })) {
        db.Student.remove(studentId);
      }
    } catch (err) {}
    try {
      if (teacherId && db.Teacher.exists({ teacher_id: teacherId })) {
        db.Teacher.remove(teacherId);
      }
    } catch (err) {}
    try {
      if (staffId && db.StaffMember.exists({ staff_id: staffId })) {
        db.StaffMember.remove(staffId);
      }
    } catch (err) {}

    console.log("   ✅ Teardown cleanup completed cleanly.");
    return "✅ PASSED";
  } catch (e) {
    console.error("   ❌ Teardown Cleanup Failed:", e.message);
    return `❌ FAILED: ${e.message}`;
  }
}
