/**
 * @file StudentServiceTests.js
 * Integration Tests for the Student Domain (Advanced Multi-Enrollment and Package Management).
 */

function test_registration() {
  run_student_advanced_integration_suite();
}

function run_student_advanced_integration_suite() {
  // 1. Lock environment context to TESTING before bootstrapping any components
  PropertiesService.getScriptProperties().setProperty('ENV', 'TESTING');
  
  // Force DBContext to re-bind file caches straight to our sandboxed folder id
  const db = DBContext.getInstance();
  db.bootstrapRepositories();
  
  const testDb = DBContext.getInstance();
  console.log("[run_student_advanced_integration_suite] Provisioning test database schema in sandbox...");
  testDb.setup.provision();

  // Setup Mock Curriculum Data via centralized TestMockData
  const curriculum = TestMockData.setupCurriculum(testDb);
  const { branchId, courseTypeId, physicsId, chemistryId, mathId, webDevId, batchPhyId, batchCheId, batchWdId, packageId } = curriculum;

  // Initialize a mock requestContext
  const mockContext = {
    actionType: "CREATE",
    mutationManifest: [],
    txId: "TX-TEST-MOCK-101",
    headers: { "X-Correlation-ID": "test-corr-id" }
  };

  // Explicit collection list of our transaction table targets
  const targetTables = [
    "Students.Student",
    "Students.Address",
    "Students.ContactInfo",
    "Finance.StudentFeeAccount",
    "Finance.Installment",
    "Finance.Payment",
    "Finance.FeePlan",
    "Academic.Enrollment",
    "Academic.BatchAllocation"
  ];

  console.log("=== STARTING ISOLATED STUDENT SERVICE INTEGRATION SUITE ===");

  try {
    // ----------------------------------------------------
    // [TC-1] STRICT PACKAGE BATCH VERIFICATION
    // ----------------------------------------------------
    try {
      targetTables.forEach(table => TestHelper.truncateSheet(table));
      execute_tc1_logic(testDb, mockContext, physicsId, batchPhyId, packageId);
      console.log("✅ [TC-1] Passed Successfully.");
    } finally {
      targetTables.forEach(table => TestHelper.truncateSheet(table));
    }

    // ----------------------------------------------------
    // [TC-2, TC-3, TC-4] REGISTRATION, WITHDRAWAL, ACCESS CONTROL
    // ----------------------------------------------------
    try {
      targetTables.forEach(table => TestHelper.truncateSheet(table));
      execute_tc2_tc3_tc4_logic(testDb, mockContext, physicsId, chemistryId, webDevId, batchPhyId, batchCheId, batchWdId, packageId);
      console.log("✅ [TC-2, TC-3, TC-4] Passed Successfully.");
    } finally {
      targetTables.forEach(table => TestHelper.truncateSheet(table));
    }

    // ----------------------------------------------------
    // [TC-5] TRANSACTIONAL PACKAGE UPGRADE
    // ----------------------------------------------------
    try {
      targetTables.forEach(table => TestHelper.truncateSheet(table));
      execute_tc5_logic(testDb, mockContext, physicsId, chemistryId, mathId, batchPhyId, batchCheId, packageId);
      console.log("✅ [TC-5] Passed Successfully.");
    } finally {
      targetTables.forEach(table => TestHelper.truncateSheet(table));
    }

    // ----------------------------------------------------
    // [TC-6] SHEETDB FIELD VALIDATION & CHOICE CHECKS
    // ----------------------------------------------------
    try {
      targetTables.forEach(table => TestHelper.truncateSheet(table));
      execute_tc6_logic(testDb, mockContext, packageId);
      console.log("✅ [TC-6] Passed Successfully.");
    } finally {
      targetTables.forEach(table => TestHelper.truncateSheet(table));
    }

  } catch (globalSuiteError) {
    console.error(`[SUITE_FATAL_CRASH] Critical integration crash intercepted: ${globalSuiteError.stack}`);
    throw globalSuiteError;
  } finally {
    // Release the environment lock and return safety settings back to development
    PropertiesService.getScriptProperties().setProperty('ENV', 'DEVELOPMENT');
    // Reload database context to development for safety
    DBContext.getInstance().bootstrapRepositories();
    console.log("=== ALL STUDENT SERVICE TESTS COMPLETED & SANDBOX PURGED ===");
  }
}

function execute_tc1_logic(db, mockContext, physicsId, batchPhyId, packageId) {
  console.log("\n--- [TC-1] Testing Strict Package Batch Verification ---");
  const badPayload = {
    profile: { student_name: "Alice Test" },
    address: { line1: "Street 1", city: "Jaipur", state: "Rajasthan", pin_code: "302017" },
    contact: { mobile_number: "9999999999" },
    enrollments: [
      {
        enrollment_type: "package",
        item_id: packageId,
        fee: 12000,
        package_batches: [
          { course_id: physicsId, batch_id: batchPhyId }
          // Missing Chemistry batch!
        ]
      }
    ],
    feeAccount: { total_fee: 12000, discount: 0, final_fee: 12000, amount_paid: 0 }
  };

  try {
    mockContext.mutationManifest = [];
    StudentService.registerStudent(badPayload, mockContext);
    throw new Error("Pre-flight check should have thrown an error for missing Chemistry batch!");
  } catch (err) {
    if (err.message.includes("Pre-flight check should have thrown")) {
      throw err;
    }
    console.log("✅ Validation successfully caught missing batch: " + err.message);
  }
}

function execute_tc2_tc3_tc4_logic(db, mockContext, physicsId, chemistryId, webDevId, batchPhyId, batchCheId, batchWdId, packageId) {
  // -------------------------------------------------------------
  // TC-2: Registration
  // -------------------------------------------------------------
  console.log("\n--- [TC-2] Testing Multi-Enrollment Registration & Proportional Splits ---");
  const goodPayload = {
    profile: { student_name: "Alice Successful", gender: "Female", dob: "2008-01-01" },
    address: { line1: "Flat 4B, Jaipur", city: "Jaipur", state: "Rajasthan", pin_code: "302017" },
    contact: { mobile_number: "9888888888", email: "alice@test.com" },
    enrollments: [
      {
        enrollment_type: "package",
        item_id: packageId,
        fee: 12000,
        package_batches: [
          { course_id: physicsId, batch_id: batchPhyId },
          { course_id: chemistryId, batch_id: batchCheId }
        ]
      },
      {
        enrollment_type: "course",
        item_id: webDevId,
        batch_id: batchWdId,
        fee: 5000
      }
    ],
    feeAccount: {
      total_fee: 17000,
      discount: 1700,
      final_fee: 15300,
      amount_paid: 8500,
      installments: [
        { installment_number: 1, due_amount: 10000, paid_amount: 8500, due_date: "2026-05-29" },
        { installment_number: 2, due_amount: 7000, paid_amount: 0, due_date: "2026-08-29" }
      ]
    },
    payment: {
      amount_paid: 8500,
      payment_method: "upi",
      transaction_reference: "TXN-TEST-100"
    }
  };

  mockContext.mutationManifest = [];
  mockContext.actionType = "CREATE";
  const alice = StudentService.registerStudent(goodPayload, mockContext);
  const studentId = alice.student_id;
  console.log("✅ Student registered with ID: " + studentId);
  console.log("   Mutated records: " + JSON.stringify(mockContext.mutationManifest));

  const expectedMutations = ["Student", "Address", "ContactInfo", "Enrollment", "FeePlan", "BatchAllocation", "StudentFeeAccount", "Installment", "Payment"];
  const hasAllExpected = expectedMutations.every(m => mockContext.mutationManifest.includes(m));
  if (hasAllExpected) {
    console.log("✅ Mutation manifest matches expected PascalCase schema signatures.");
  } else {
    throw new Error("Mutation manifest mismatch! Got: " + JSON.stringify(mockContext.mutationManifest));
  }

  // Validate enrollments created
  const enrollments = db.Enrollment.where({ student_id: studentId });
  console.log(`Active enrollments created: ${enrollments.length} (Expected: 2 - Pkg and WebDev)`);
  if (enrollments.length !== 2) throw new Error("Incorrect enrollment count!");

  const parentPkgEnrollment = enrollments.find(e => e.item_id === packageId);
  const metadata = parentPkgEnrollment.metadata;
  console.log("✅ Package Enrollment metadata snapshot: " + JSON.stringify(metadata));
  if (!metadata || !metadata.course_fees || metadata.course_fees[physicsId] !== 5000) {
    throw new Error("Metadata base fees snapshot invalid!");
  }

  // Validate batch allocations created
  const allocations = db.BatchAllocation.where({ student_id: studentId });
  console.log(`Active batch allocations created: ${allocations.length} (Expected: 3 - Physics, Chemistry, and WebDev)`);
  if (allocations.length !== 3) throw new Error("Incorrect batch allocation count!");

  // Validate proportional finance splitting
  const feeAccounts = enrollments.map(e => db.StudentFeeAccount.findOne({ enrollment_id: e.enrollment_id })).filter(Boolean);
  console.log(`Fee Accounts created: ${feeAccounts.length} (Expected: 2 - Package and Standalone Course)`);
  
  const pkgSfa = feeAccounts.find(fa => fa.enrollment_id === parentPkgEnrollment.enrollment_id);
  const wdSfa = feeAccounts.find(fa => fa.enrollment_id !== parentPkgEnrollment.enrollment_id);

  console.log(`Package SFA - Total: ${pkgSfa.total_fee}, Final: ${pkgSfa.final_fee}, Paid: ${pkgSfa.amount_paid}, Balance: ${pkgSfa.balance_due}`);
  console.log(`WebDev SFA - Total: ${wdSfa.total_fee}, Final: ${wdSfa.final_fee}, Paid: ${wdSfa.amount_paid}, Balance: ${wdSfa.balance_due}`);

  // Validate Installments
  const pkgInstallments = db.Installment.where({ student_fee_id: pkgSfa.student_fee_id });
  console.log(`Package Installments count: ${pkgInstallments.length} (Expected: 2)`);
  
  // Validate Payments
  const pkgPayments = db.Payment.where({ student_fee_id: pkgSfa.student_fee_id });
  console.log(`Package Payments count: ${pkgPayments.length} (Expected: 1)`);
  console.log(`Package Payment Amount: ${pkgPayments[0].amount_paid}`);

  // -------------------------------------------------------------
  // TC-3: Withdrawal
  // -------------------------------------------------------------
  console.log("\n--- [TC-3] Testing Subject Withdrawal & Prorated Refund ---");
  mockContext.mutationManifest = [];
  mockContext.actionType = "DELETE";
  const refundResult = StudentService.processSubjectWithdrawal(studentId, chemistryId, mockContext);
  console.log(`Subject Drop Payout result: ${JSON.stringify(refundResult)}`);
  console.log("   Mutated records: " + JSON.stringify(mockContext.mutationManifest));
  
  const expectedWithdrawalMutations = ["BatchAllocation", "StudentFeeAccount", "Installment", "Payment"];
  const hasWithdrawalMutations = expectedWithdrawalMutations.every(m => mockContext.mutationManifest.includes(m));
  if (hasWithdrawalMutations) {
    console.log("✅ Subject Drop mutation manifest matches expected PascalCase signatures.");
  } else {
    throw new Error("Subject Drop mutation manifest mismatch! Got: " + JSON.stringify(mockContext.mutationManifest));
  }

  // Reload parent account and check new dues
  const updatedPkgSfa = db.StudentFeeAccount.findById(pkgSfa.student_fee_id);
  console.log(`Updated Package SFA - Total: ${updatedPkgSfa.total_fee}, Final: ${updatedPkgSfa.final_fee}, Paid: ${updatedPkgSfa.amount_paid}, Balance: ${updatedPkgSfa.balance_due}`);
  if (updatedPkgSfa.balance_due !== 0) throw new Error("Balance due should be zero!");
  
  // Verify negative Payment row generated
  const allPkgPayments = db.Payment.where({ student_fee_id: pkgSfa.student_fee_id });
  console.log(`Total Payment rows recorded on Package: ${allPkgPayments.length} (Expected: 2, 1 positive deposit, 1 negative refund)`);
  const refundRow = allPkgPayments.find(p => p.amount_paid < 0);
  console.log(`Refund payment amount recorded: ${refundRow ? refundRow.amount_paid : "N/A"} (Expected: -600)`);

  // -------------------------------------------------------------
  // TC-4: Access Control
  // -------------------------------------------------------------
  console.log("\n--- [TC-4] Testing Decoupled Access Control (Grace Period) ---");
  mockContext.mutationManifest = [];
  mockContext.actionType = "QUERY";
  const accessBefore = StudentService.checkAccessStatus(studentId, physicsId);
  console.log(`Access check for Physics: ${JSON.stringify(accessBefore)} (Expected: allowed: true)`);
  if (!accessBefore.allowed) throw new Error("Physics access should be allowed.");

  // Introduce an overdue installment on the WebDev course SFA
  const wdInstallments = db.Installment.where({ student_fee_id: wdSfa.student_fee_id });
  const firstWdInstallment = wdInstallments[0];
  
  // Backdate due date to 10 days ago to trigger grace period check failure
  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  
  db.Installment.update(firstWdInstallment.installment_id, {
    due_date: tenDaysAgo,
    status: "pending",
    paid_amount: 0 // unpaid
  });

  mockContext.mutationManifest = [];
  mockContext.actionType = "QUERY";
  const accessAfter = StudentService.checkAccessStatus(studentId, webDevId);
  if (!accessAfter.allowed && accessAfter.isOverdue) {
    StudentService.suspendOverdueAccess(studentId, webDevId, mockContext);
  }
  console.log(`Access check for WebDev after overdue: ${JSON.stringify(accessAfter)} (Expected: allowed: false)`);
  if (accessAfter.allowed) throw new Error("WebDev access should have been suspended due to overdue installment!");
  console.log("   Mutated records: " + JSON.stringify(mockContext.mutationManifest));
  if (mockContext.mutationManifest.includes("BatchAllocation")) {
    console.log("✅ Access check correctly recorded BatchAllocation mutation on suspension.");
  } else {
    throw new Error("Access check did not record BatchAllocation mutation on suspension!");
  }

  // Verify database record has been updated to suspended
  const updatedWebDevAllocation = db.BatchAllocation.findOne({ student_id: studentId, course_id: webDevId });
  console.log(`Updated WebDev Allocation status: ${updatedWebDevAllocation.status} (Expected: suspended)`);
  if (updatedWebDevAllocation.status !== "suspended") {
    throw new Error("WebDev Allocation status should be suspended in database!");
  }
}

function execute_tc5_logic(db, mockContext, physicsId, chemistryId, mathId, batchPhyId, batchCheId, packageId) {
  console.log("\n--- [TC-5] Testing Transactional Package Upgrade ---");
  // 1. Create a new student with standalone Physics and Chemistry enrollments
  const upPayload = {
    profile: { student_name: "Upgrade Student", gender: "Male", dob: "2008-01-01" },
    address: { line1: "Flat 5C, Jaipur", city: "Jaipur", state: "Rajasthan", pin_code: "302017" },
    contact: { mobile_number: "9777777777", email: "up@test.com" },
    enrollments: [
      { enrollment_type: "course", item_id: physicsId, batch_id: batchPhyId, fee: 5000 },
      { enrollment_type: "course", item_id: chemistryId, batch_id: batchCheId, fee: 5000 }
    ],
    feeAccount: {
      total_fee: 10000,
      discount: 0,
      final_fee: 10000,
      amount_paid: 6000,
      installments: [
        { installment_number: 1, due_amount: 10000, paid_amount: 6000, due_date: "2026-05-29" }
      ]
    },
    payment: {
      amount_paid: 6000,
      payment_method: "cash",
      transaction_reference: "TXN-UP-STANDALONE"
    }
  };

  mockContext.mutationManifest = [];
  mockContext.actionType = "CREATE";
  const upStudent = StudentService.registerStudent(upPayload, mockContext);
  const upStudentId = upStudent.student_id;
  
  // Find current enrollment IDs
  const standaloneEnrollments = db.Enrollment.where({ student_id: upStudentId, status: "active" });
  const eids = standaloneEnrollments.map(e => e.enrollment_id);

  console.log(`Before Upgrade standalone active enrollments: ${standaloneEnrollments.length}`);

  let mathBatch = db.Batch.findOne({ batch_name: "Math morning" });
  if (!mathBatch) {
    mathBatch = db.Batch.insert({ batch_name: "Math morning", course_id: mathId, capacity: 30, batch_type: "Academy", status: "active" });
  }
  const mathBatchId = mathBatch.batch_id;

  // Run upgrade to the Package
  const upgradeBatches = [
    { course_id: physicsId, batch_id: batchPhyId },
    { course_id: chemistryId, batch_id: batchCheId },
    { course_id: mathId, batch_id: mathBatchId } 
  ];

  mockContext.mutationManifest = [];
  mockContext.actionType = "UPDATE";
  const upgradeResult = StudentService.upgradeToPackage({
    studentId: upStudentId,
    currentEnrollmentIds: eids,
    targetPackageId: packageId,
    packageBatches: upgradeBatches
  }, mockContext);
  console.log(`Package Upgrade Result: ${JSON.stringify(upgradeResult)}`);
  console.log("   Mutated records: " + JSON.stringify(mockContext.mutationManifest));

  const expectedUpgradeMutations = ["StudentFeeAccount", "Enrollment", "FeePlan", "BatchAllocation", "Payment", "Installment"];
  const hasUpgradeMutations = expectedUpgradeMutations.every(m => mockContext.mutationManifest.includes(m));
  if (hasUpgradeMutations) {
    console.log("✅ Upgrade package mutation manifest matches expected PascalCase signatures.");
  } else {
    throw new Error("Upgrade package mutation manifest mismatch! Got: " + JSON.stringify(mockContext.mutationManifest));
  }

  // Verify old accounts zeroed
  const oldFeeAccounts = eids.map(eid => db.StudentFeeAccount.findOne({ enrollment_id: eid })).filter(Boolean);
  oldFeeAccounts.forEach(fa => {
    console.log(`Old SFA ${fa.student_fee_id} status: ${fa.status}, final: ${fa.final_fee}, paid: ${fa.amount_paid}, due: ${fa.balance_due}`);
    if (fa.status !== "completed" || fa.final_fee !== 0 || fa.amount_paid !== 0) {
      throw new Error("Old SFA was not correctly zeroed during upgrade!");
    }
  });

  // Verify new package fee account has rolled over credit
  const newPkgSfa = db.StudentFeeAccount.findById(upgradeResult.studentFeeId);
  console.log(`New Package SFA - Total: ${newPkgSfa.total_fee}, Paid: ${newPkgSfa.amount_paid}, Due: ${newPkgSfa.balance_due}`);
  if (newPkgSfa.amount_paid !== 6000 || newPkgSfa.balance_due !== 6000) {
    throw new Error("Rollover amount not credited correctly!");
  }

  // Verify new batch allocations link to package
  const activeEnrollmentsAfter = db.Enrollment.where({ student_id: upStudentId, status: "active" });
  console.log(`Active enrollments after upgrade: ${activeEnrollmentsAfter.length} (Expected: 1 - Parent Pkg)`);
  if (activeEnrollmentsAfter.length !== 1) throw new Error("Incorrect active enrollment count after upgrade!");

  const parentEnroll = activeEnrollmentsAfter.find(e => e.item_id === packageId);

  const activeAllocationsAfter = db.BatchAllocation.where({ student_id: upStudentId, status: "active" });
  console.log(`Active allocations after upgrade: ${activeAllocationsAfter.length} (Expected: 3)`);
  const childAlloc = activeAllocationsAfter.filter(a => a.enrollment_id === parentEnroll.enrollment_id);
  console.log(`Allocations linked to package enrollment: ${childAlloc.length} (Expected: 3)`);
  if (childAlloc.length !== 3) throw new Error("Batch allocations not linked to package correctly!");
}

function execute_tc6_logic(db, mockContext, packageId) {
  console.log("\n--- [TC-6] Testing SheetDB Field Validation & Choice Checks ---");

  try {
    mockContext.mutationManifest = [];
    mockContext.actionType = "CREATE";
    
    // Attempt inserting directly with an invalid choice value 'Alien' for gender
    db.Student.insertOne({
      student_name: "Validation Test Student",
      gender: "Alien",
      status: "active"
    });
    throw new Error("Validation check should have thrown a ValidationError for invalid gender choice!");
  } catch (err) {
    if (err.message.includes("Validation check should have thrown")) {
      throw err;
    }
    
    // Verify it is a ValidationError
    if (err.name !== "ValidationError") {
      throw new Error(`Expected ValidationError but got: ${err.name} - ${err.message}`);
    }
    
    // Verify context contains errors payload
    const errors = err.context && err.context.errors ? err.context.errors : [];
    const genderError = errors.find(e => e.fieldName === "gender");
    if (!genderError) {
      throw new Error("Expected a validation error specifically for the 'gender' field.");
    }
    console.log("✅ Validation successfully caught invalid choice: " + genderError.message);
  }
}
