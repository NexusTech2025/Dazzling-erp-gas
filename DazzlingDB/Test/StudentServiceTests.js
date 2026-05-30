/**
 * @file StudentServiceTests.js
 * Integration Tests for the Student Domain (Advanced Multi-Enrollment and Package Management).
 */

function test_registration() {
  run_student_tests();
}

function run_student_tests() {
  const db = DBContext.getInstance();
  console.log("=== STARTING STUDENT SERVICE ADVANCED INTEGRATION TESTS ===");
  
  // 1. Setup Mock Curriculum Data via centralized TestMockData
  const curriculum = TestMockData.setupCurriculum(db);
  const { branchId, courseTypeId, physicsId, chemistryId, mathId, webDevId, batchPhyId, batchCheId, batchWdId, packageId } = curriculum;

  // -------------------------------------------------------------
  // Test Case 1: Strict Batch Verification (Plan 2)
  // -------------------------------------------------------------
  console.log("\n--- [TC-1] Testing Strict Package Batch Verification ---");
  const badPayload = {
    profile: { student_name: "Alice Test" },
    address: { line1: "Street 1", city: "Jaipur", state: "Rajasthan", pin_code: "302017" },
    contact: { mobile_number: "9999999999" },
    enrollments: [
      {
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
    StudentService.registerStudent(badPayload);
    console.error("❌ Test failed: Pre-flight check should have thrown an error for missing Chemistry batch!");
  } catch (err) {
    console.log("✅ Validation successfully caught missing batch: " + err.message);
  }

  // -------------------------------------------------------------
  // Test Case 2: Multi-Enrollment Student Registration (Strategy 2)
  // -------------------------------------------------------------
  console.log("\n--- [TC-2] Testing Multi-Enrollment Registration & Proportional Splits ---");
  const goodPayload = {
    profile: { student_name: "Alice Successful", gender: "Female", dob: "2008-01-01" },
    address: { line1: "Flat 4B, Jaipur", city: "Jaipur", state: "Rajasthan", pin_code: "302017" },
    contact: { mobile_number: "9888888888", email: "alice@test.com" },
    enrollments: [
      {
        item_id: packageId,
        fee: 12000,
        package_batches: [
          { course_id: physicsId, batch_id: batchPhyId },
          { course_id: chemistryId, batch_id: batchCheId }
        ]
      },
      {
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

  const alice = StudentService.registerStudent(goodPayload);
  const studentId = alice.student_id;
  console.log("✅ Student registered with ID: " + studentId);

  // Validate enrollments created
  const enrollments = db.Enrollment.where({ student_id: studentId });
  console.log(`Active enrollments created: ${enrollments.length} (Expected: 4 - Pkg, Phy, Che, and WebDev)`);
  if (enrollments.length !== 4) console.error("❌ Incorrect enrollment count!");

  const parentPkgEnrollment = enrollments.find(e => e.item_id === packageId);
  const metadata = parentPkgEnrollment.metadata;
  console.log("✅ Package Enrollment metadata snapshot: " + JSON.stringify(metadata));
  if (!metadata || !metadata.course_fees || metadata.course_fees[physicsId] !== 5000) {
    console.error("❌ Metadata base fees snapshot invalid!");
  }

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
  // Test Case 3: Subject Drop and Prorated Refund (Plan 1)
  // -------------------------------------------------------------
  console.log("\n--- [TC-3] Testing Subject Withdrawal & Prorated Refund ---");
  const refundResult = StudentService.processSubjectWithdrawal(studentId, chemistryId);
  console.log(`Subject Drop Payout result: ${JSON.stringify(refundResult)}`);
  
  // Reload parent account and check new dues
  const updatedPkgSfa = db.StudentFeeAccount.findById(pkgSfa.student_fee_id);
  console.log(`Updated Package SFA - Total: ${updatedPkgSfa.total_fee}, Final: ${updatedPkgSfa.final_fee}, Paid: ${updatedPkgSfa.amount_paid}, Balance: ${updatedPkgSfa.balance_due}`);
  if (updatedPkgSfa.balance_due !== 0) console.error("❌ Balance due should be zero!");
  
  // Verify negative Payment row generated
  const allPkgPayments = db.Payment.where({ student_fee_id: pkgSfa.student_fee_id });
  console.log(`Total Payment rows recorded on Package: ${allPkgPayments.length} (Expected: 2, 1 positive deposit, 1 negative refund)`);
  const refundRow = allPkgPayments.find(p => p.amount_paid < 0);
  console.log(`Refund payment amount recorded: ${refundRow ? refundRow.amount_paid : "N/A"} (Expected: -600)`);

  // -------------------------------------------------------------
  // Test Case 4: Decoupled Access Control Engine (Plan 4)
  // -------------------------------------------------------------
  console.log("\n--- [TC-4] Testing Decoupled Access Control (Grace Period) ---");
  // Test active state first
  const accessBefore = StudentService.verifyAccess(studentId, physicsId);
  console.log(`Access check for Physics: ${JSON.stringify(accessBefore)} (Expected: allowed: true)`);
  if (!accessBefore.allowed) console.error("❌ Physics access should be allowed.");

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

  const accessAfter = StudentService.verifyAccess(studentId, webDevId);
  console.log(`Access check for WebDev after overdue: ${JSON.stringify(accessAfter)} (Expected: allowed: false)`);
  if (accessAfter.allowed) console.error("❌ WebDev access should have been suspended due to overdue installment!");

  // Verify database record has been updated to suspended
  const updatedWebDevEnrollment = db.Enrollment.findOne({ student_id: studentId, item_id: webDevId });
  console.log(`Updated WebDev Enrollment academic_status: ${updatedWebDevEnrollment.academic_status} (Expected: suspended)`);

  // -------------------------------------------------------------
  // Test Case 5: Transactional Package Upgrade (Plan 3)
  // -------------------------------------------------------------
  console.log("\n--- [TC-5] Testing Transactional Package Upgrade ---");
  // 1. Create a new student with standalone Physics and Chemistry enrollments
  const upPayload = {
    profile: { student_name: "Upgrade Student", gender: "Male", dob: "2008-01-01" },
    address: { line1: "Flat 5C, Jaipur", city: "Jaipur", state: "Rajasthan", pin_code: "302017" },
    contact: { mobile_number: "9777777777", email: "up@test.com" },
    enrollments: [
      { item_id: physicsId, batch_id: batchPhyId, fee: 5000 },
      { item_id: chemistryId, batch_id: batchCheId, fee: 5000 }
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

  const upStudent = StudentService.registerStudent(upPayload);
  const upStudentId = upStudent.student_id;
  
  // Find current enrollment IDs
  const standaloneEnrollments = db.Enrollment.where({ student_id: upStudentId, status: "active" });
  const eids = standaloneEnrollments.map(e => e.enrollment_id);

  console.log(`Before Upgrade standalone active enrollments: ${standaloneEnrollments.length}`);

  // Run upgrade to the Package
  const upgradeBatches = [
    { course_id: physicsId, batch_id: batchPhyId },
    { course_id: chemistryId, batch_id: batchCheId },
    { course_id: mathId, batch_id: "BAT-TEST-MAT" } 
  ];
  if (!db.Batch.findById("BAT-TEST-MAT")) {
    db.Batch.insert({ batch_id: "BAT-TEST-MAT", batch_name: "Math morning", course_id: mathId, capacity: 30, batch_type: "Academy", status: "active" });
  }

  const upgradeResult = StudentService.upgradeToPackage(upStudentId, eids, packageId, upgradeBatches);
  console.log(`Package Upgrade Result: ${JSON.stringify(upgradeResult)}`);

  // Verify old accounts zeroed
  const oldFeeAccounts = eids.map(eid => db.StudentFeeAccount.findOne({ enrollment_id: eid })).filter(Boolean);
  oldFeeAccounts.forEach(fa => {
    console.log(`Old SFA ${fa.student_fee_id} status: ${fa.status}, final: ${fa.final_fee}, paid: ${fa.amount_paid}, due: ${fa.balance_due}`);
    if (fa.status !== "upgraded" || fa.final_fee !== 0 || fa.amount_paid !== 0) {
      console.error("❌ Old SFA was not correctly zeroed during upgrade!");
    }
  });

  // Verify new package fee account has rolled over credit
  const newPkgSfa = db.StudentFeeAccount.findById(upgradeResult.studentFeeId);
  console.log(`New Package SFA - Total: ${newPkgSfa.total_fee}, Paid: ${newPkgSfa.amount_paid}, Due: ${newPkgSfa.balance_due}`);
  if (newPkgSfa.amount_paid !== 6000 || newPkgSfa.balance_due !== 6000) {
    console.error("❌ Rollover amount not credited correctly!");
  }

  // Verify new child enrollments link to package
  const activeEnrollmentsAfter = db.Enrollment.where({ student_id: upStudentId, status: "active" });
  console.log(`Active enrollments after upgrade: ${activeEnrollmentsAfter.length} (Expected: 4 - Parent Pkg, and 3 Child courses)`);
  const parentEnroll = activeEnrollmentsAfter.find(e => e.item_id === packageId);
  const childEnroll = activeEnrollmentsAfter.filter(e => e.package_enrollment_id === parentEnroll.enrollment_id);
  console.log(`Child enrollments linked to package: ${childEnroll.length} (Expected: 3)`);
  if (childEnroll.length !== 3) console.error("❌ Children enrollments not linked to package correctly!");

  console.log("\n=== ALL STUDENT SERVICE TESTS COMPLETED ===");
}
