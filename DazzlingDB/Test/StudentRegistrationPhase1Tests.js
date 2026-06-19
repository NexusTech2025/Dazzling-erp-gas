/**
 * @file StudentRegistrationPhase1Tests.js
 * Focused Integration Tests verifying Phase 1: Student Registration, 
 * Strict Package Batch Verification, and Proportional Finance Splits.
 */

function test_phase1_registration() {
  run_phase1_tests();
}

function run_phase1_tests() {
  const db = DBContext.getInstance();
  console.log("=== STARTING PHASE 1: STUDENT REGISTRATION INTEGRATION TESTS ===");
  
  // 1. Setup Mock Curriculum Data via centralized TestMockData
  const curriculum = TestMockData.setupCurriculum(db);
  const { branchId, courseTypeId, physicsId, chemistryId, mathId, webDevId, batchPhyId, batchCheId, batchWdId, packageId } = curriculum;

  // Initialize a mock requestContext
  const mockContext = {
    actionType: "CREATE",
    mutationManifest: [],
    txId: "TX-TEST-MOCK-102",
    headers: { "X-Correlation-ID": "test-corr-id-2" }
  };

  // -------------------------------------------------------------
  // Test Case 1: Strict Batch Verification (Curriculum Enforcement)
  // -------------------------------------------------------------
  console.log("\n--- [P1-TC-1] Testing Strict Package Batch Verification ---");
  const badPayload = {
    profile: { student_name: "Alice Missing Batch" },
    address: { line1: "Street 1", city: "Jaipur", state: "Rajasthan", pin_code: "302017" },
    contact: { mobile_number: "8888888888" },
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
    console.error("❌ Test failed: Pre-flight check should have thrown an error for missing Chemistry batch!");
  } catch (err) {
    console.log("✅ Validation successfully caught missing batch: " + err.message);
    if (err.message.indexOf("Package registration incomplete. Missing batch selections for:") !== 0) {
      console.error("❌ Incorrect error message thrown: " + err.message);
    }
  }

  // -------------------------------------------------------------
  // Test Case 2: Successful Multi-Enrollment Registration & Proportional Splits
  // -------------------------------------------------------------
  console.log("\n--- [P1-TC-2] Testing Multi-Enrollment Registration & Proportional Splits ---");
  const goodPayload = {
    profile: { student_name: "Bob Successful Registration", gender: "Male", dob: "2005-06-15", status: "active" },
    address: { line1: "Jaipur Lane 2", city: "Jaipur", state: "Rajasthan", pin_code: "302017", country: "India" },
    contact: { mobile_number: "8888888889", email: "bob@p1test.com" },
    education: [
      { highest_qualification: "Class 10", institution_name: "Jaipur Public School", year_of_passing: 2024, percentage_or_cgpa: "90%" }
    ],
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
        fee: 5000,
        batch_id: batchWdId
      }
    ],
    feeAccount: {
      total_fee: 17000,
      discount: 1700, // 10% discount globally
      final_fee: 15300,
      amount_paid: 6800, // Consolidated payment
      installments: [
        { installment_number: 1, due_amount: 8500, paid_amount: 6800, due_date: "2026-06-15" },
        { installment_number: 2, due_amount: 8500, paid_amount: 0, due_date: "2026-07-15" }
      ]
    },
    payment: {
      amount_paid: 6800,
      payment_method: "upi",
      transaction_reference: "TXN-P1-GOOD-100"
    }
  };

  mockContext.mutationManifest = [];
  mockContext.actionType = "CREATE";
  const bob = StudentService.registerStudent(goodPayload, mockContext);
  const studentId = bob.student_id;
  console.log("✅ Student registered with ID: " + studentId);
  console.log("   Mutated records: " + JSON.stringify(mockContext.mutationManifest));

  const expectedMutations = ["Student", "Address", "ContactInfo", "Education", "Enrollment", "FeePlan", "BatchAllocation", "StudentFeeAccount", "Installment", "Payment"];
  const hasAllExpected = expectedMutations.every(m => mockContext.mutationManifest.includes(m));
  if (hasAllExpected) {
    console.log("✅ Mutation manifest matches expected PascalCase schema signatures.");
  } else {
    console.error("❌ Mutation manifest mismatch! Got: " + JSON.stringify(mockContext.mutationManifest));
  }

  // Validate enrollments created
  const enrollments = db.Enrollment.where({ student_id: studentId });
  console.log(`Active enrollments created: ${enrollments.length} (Expected: 2 - Package and WebDev)`);
  if (enrollments.length !== 2) console.error("❌ Incorrect enrollment count!");

  const parentPkgEnrollment = enrollments.find(e => e.item_id === packageId);
  const metadata = parentPkgEnrollment.metadata;
  console.log("✅ Package Enrollment metadata snapshot: " + JSON.stringify(metadata));
  if (!metadata || !metadata.course_fees || metadata.course_fees[physicsId] !== 5000 || metadata.course_fees[chemistryId] !== 5000) {
    console.error("❌ Metadata base fees snapshot invalid!");
  }

  // Validate batch allocations created
  const allocations = db.BatchAllocation.where({ student_id: studentId });
  console.log(`Active batch allocations created: ${allocations.length} (Expected: 3 - Physics, Chemistry, and WebDev)`);
  if (allocations.length !== 3) console.error("❌ Incorrect batch allocation count!");

  const allocPhy = allocations.find(a => a.course_id === physicsId);
  const allocChe = allocations.find(a => a.course_id === chemistryId);
  console.log(`Physics allocation links to Package Enrollment: ${allocPhy.enrollment_id === parentPkgEnrollment.enrollment_id}`);
  console.log(`Chemistry allocation links to Package Enrollment: ${allocChe.enrollment_id === parentPkgEnrollment.enrollment_id}`);
  if (allocPhy.enrollment_id !== parentPkgEnrollment.enrollment_id || allocChe.enrollment_id !== parentPkgEnrollment.enrollment_id) {
    console.error("❌ Physics/Chemistry allocations do not point to parent package enrollment ID!");
  }

  // Validate proportional finance splitting
  const feeAccounts = enrollments.map(e => db.StudentFeeAccount.findOne({ enrollment_id: e.enrollment_id })).filter(Boolean);
  console.log(`Fee Accounts created: ${feeAccounts.length} (Expected: 2 - Package and Standalone Course)`);
  if (feeAccounts.length !== 2) console.error("❌ Incorrect fee accounts count!");
  
  const pkgSfa = feeAccounts.find(fa => fa.enrollment_id === parentPkgEnrollment.enrollment_id);
  const wdSfa = feeAccounts.find(fa => fa.enrollment_id !== parentPkgEnrollment.enrollment_id);

  // Perform strict balance validation checks (proportional math checks)
  console.log("\n--- Validating Proportional ledger math splits ---");
  console.log(`Package SFA - Total: ${pkgSfa.total_fee} (Exp: 12000), Discount: ${pkgSfa.discount} (Exp: 1200), Final: ${pkgSfa.final_fee} (Exp: 10800), Paid: ${pkgSfa.amount_paid} (Exp: 4800), Balance: ${pkgSfa.balance_due} (Exp: 6000)`);
  if (pkgSfa.total_fee !== 12000 || pkgSfa.discount !== 1200 || pkgSfa.final_fee !== 10800 || pkgSfa.amount_paid !== 4800 || pkgSfa.balance_due !== 6000) {
    console.error("❌ Proportional split on Package Fee Account did not match expected values!");
  } else {
    console.log("✅ Proportional ledger splits for Package SFA are 100% correct.");
  }

  console.log(`WebDev SFA - Total: ${wdSfa.total_fee} (Exp: 5000), Discount: ${wdSfa.discount} (Exp: 500), Final: ${wdSfa.final_fee} (Exp: 4500), Paid: ${wdSfa.amount_paid} (Exp: 2000), Balance: ${wdSfa.balance_due} (Exp: 2500)`);
  if (wdSfa.total_fee !== 5000 || wdSfa.discount !== 500 || wdSfa.final_fee !== 4500 || wdSfa.amount_paid !== 2000 || wdSfa.balance_due !== 2500) {
    console.error("❌ Proportional split on WebDev Standalone Fee Account did not match expected values!");
  } else {
    console.log("✅ Proportional ledger splits for Standalone SFA are 100% correct.");
  }

  // Validate Installments
  const pkgInstallments = db.Installment.where({ student_fee_id: pkgSfa.student_fee_id });
  console.log(`Package Installments count: ${pkgInstallments.length} (Expected: 2)`);
  if (pkgInstallments.length !== 2) {
    console.error("❌ Incorrect package installments count!");
  } else {
    const firstIns = pkgInstallments.find(i => i.installment_number === 1);
    const secondIns = pkgInstallments.find(i => i.installment_number === 2);
    console.log(`Package Installment 1 - Due: ${firstIns.due_amount} (Exp: 6000), Paid: ${firstIns.paid_amount} (Exp: 4800)`);
    console.log(`Package Installment 2 - Due: ${secondIns.due_amount} (Exp: 6000), Paid: ${secondIns.paid_amount} (Exp: 0)`);
    if (firstIns.due_amount !== 6000 || firstIns.paid_amount !== 4800 || secondIns.due_amount !== 6000 || secondIns.paid_amount !== 0) {
      console.error("❌ Package installment split values did not match expected calculations!");
    } else {
      console.log("✅ Proportional splits for Package installments are correct.");
    }
  }

  // Validate Payments
  const pkgPayments = db.Payment.where({ student_fee_id: pkgSfa.student_fee_id });
  console.log(`Package Payments count: ${pkgPayments.length} (Expected: 1)`);
  if (pkgPayments.length !== 1 || pkgPayments[0].amount_paid !== 4800) {
    console.error("❌ Package payment record mismatch!");
  } else {
    console.log("✅ Proportional split for Package payment row matches.");
  }

  const wdPayments = db.Payment.where({ student_fee_id: wdSfa.student_fee_id });
  console.log(`Standalone Payments count: ${wdPayments.length} (Expected: 1)`);
  if (wdPayments.length !== 1 || wdPayments[0].amount_paid !== 2000) {
    console.error("❌ Standalone payment record mismatch!");
  } else {
    console.log("✅ Proportional split for Standalone payment row matches.");
  }

  console.log("\n=== PHASE 1: STUDENT REGISTRATION TESTS COMPLETED SUCCESSFULLY ===");
}
