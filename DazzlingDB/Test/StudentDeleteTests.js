/**
 * @file StudentDeleteTests.js
 * Integration test suite for Student deletion actions and database constraints.
 * Verifies that deleting a student with active payments/installments is blocked
 * and that data integrity across all related tables is preserved 100% intact.
 */

function runStudentDeleteTests() {
  const activeEnv = typeof SYSTEM_ENV !== 'undefined' ? SYSTEM_ENV : 'development';
  if (activeEnv === 'production') {
    throw new Error("❌ Safety Guard: Test suite cannot be executed in the PRODUCTION environment.");
  }

  console.log("🚀 Starting Student Deletion Protection Integration Tests...");
  const db = DBContext.getInstance();
  const results = {};
  const timings = {};
  const t0 = Date.now();

  const salt = Math.random().toString(36).substring(2, 9).toUpperCase();
  let studentId = null;
  let addressId = null;
  let contactId = null;
  let enrollmentId = null;
  let allocationId = null;
  let feeAccountId = null;
  let installmentIds = [];
  let paymentIds = [];
  let educationIds = [];

  // Snapshots for data integrity check
  let studentSnapshot = null;
  let addressSnapshot = null;
  let contactSnapshot = null;
  let educationSnapshots = [];
  let enrollmentSnapshots = [];
  let allocationSnapshots = [];
  let feeAccountSnapshot = null;
  let installmentSnapshots = [];
  let paymentSnapshots = [];

  try {
    // 1. Setup Curriculum first via TestMockData helper
    console.log("   ⚙️ Step 1: Bootstrapping mock curriculum...");
    let tStart = Date.now();
    const curriculum = TestMockData.setupCurriculum(db);
    timings["1. Curriculum Bootstrap"] = Date.now() - tStart;

    // 2. Build full-fidelity registration payload matching the payload specification
    const regPayload = {
      profile: {
        student_name: "TDD Production Student " + salt,
        gender: "Female",
        dob: "2006-08-20",
        email: "tddprod_" + salt.toLowerCase() + "@test.com",
        phone: "+91" + Math.floor(1000000000 + Math.random() * 9000000000),
        status: "active"
      },
      address: {
        line1: "TDD Prod Lane " + salt,
        city: "Jaipur",
        state: "Rajasthan",
        pin_code: "302017",
        country: "India"
      },
      contact: {
        email: "tddprod_contact_" + salt.toLowerCase() + "@test.com",
        mobile_number: "9" + Math.floor(100000000 + Math.random() * 900000000),
        emergency_name: "Guardian " + salt,
        emergency_phone: "8" + Math.floor(100000000 + Math.random() * 900000000),
        emergency_relationship: "Parent"
      },
      education: [
        {
          highest_qualification: "Class 10",
          institution_name: "TDD Board School",
          year_of_passing: 2024,
          percentage_or_cgpa: "92%"
        }
      ],
      enrollments: [
        {
          enrollment_type: "course",
          item_id: curriculum.physicsId,
          fee: 10000,
          roll_number: 2001,
          enrollment_date: "2026-06-01",
          status: "active",
          academic_status: "active",
          batch_id: curriculum.batchPhyId
        }
      ],
      feeAccount: {
        total_fee: 10000,
        discount: 1000,
        adjustment_type: "coupon",
        coupon_code: "PROD10",
        final_fee: 9000,
        amount_paid: 4500,
        balance_due: 4500,
        is_overdue: false,
        penalty_amount: 0,
        next_due_date: "2026-06-15",
        status: "active",
        remarks: "TDD Prod Fee Account",
        created_by: "tdd_tester",
        fee_plan_id: "FPL-" + curriculum.physicsId + "-DEFAULT",
        installments: [
          {
            installment_number: 1,
            due_amount: 4500,
            paid_amount: 4500,
            late_fee_amount: 0,
            due_date: "2026-06-15",
            status: "paid"
          },
          {
            installment_number: 2,
            due_amount: 4500,
            paid_amount: 0,
            late_fee_amount: 0,
            due_date: "2026-07-15",
            status: "pending"
          }
        ]
      },
      payment: {
        amount_paid: 4500,
        payment_date: "2026-06-01T20:10:00Z",
        payment_method: "upi",
        transaction_reference: "TXN-PROD-TEST-" + salt,
        status: "success",
        remarks: "TDD Prod payment entry",
        created_by: "tdd_tester"
      }
    };

    console.log("   ⚙️ Step 2: Fully registering mock student via RegisterStudentAction...");
    tStart = Date.now();
    const regAction = new RegisterStudentAction({
      db: db,
      user: { role: "admin", username: "admin_test", isValid: true },
      params: {
        token: "MOCK_TOKEN",
        payload: regPayload
      }
    });

    const regResponse = regAction.run();
    if (!regResponse.success) {
      throw new Error("Failed to register student: " + regResponse.error.message);
    }

    studentId = regResponse.data.student_id;
    console.log(`   ⚙️ Student registered with ID: ${studentId}`);
    timings["2. Student Registration"] = Date.now() - tStart;

    // 3. Query and snapshot all created records to cache their IDs and values
    console.log("   ⚙️ Step 3: Querying and caching record snapshots...");
    tStart = Date.now();

    const studentRec = db.Student.findById(studentId);
    if (!studentRec) throw new Error("Student record not found after registration.");
    studentSnapshot = JSON.parse(JSON.stringify(studentRec.toJSON()));

    const addressRec = db.Address.all().find(addr => addr.student_id === studentId);
    if (!addressRec) throw new Error("Address record not found after registration.");
    addressId = addressRec.address_id;
    addressSnapshot = JSON.parse(JSON.stringify(addressRec.toJSON()));

    const contactRec = db.ContactInfo.all().find(c => c.student_id === studentId);
    if (!contactRec) throw new Error("ContactInfo record not found after registration.");
    contactId = contactRec.contact_id;
    contactSnapshot = JSON.parse(JSON.stringify(contactRec.toJSON()));

    const educationRecs = db.Education.where({ student_id: studentId });
    if (educationRecs.length === 0) throw new Error("Education record not found after registration.");
    educationIds = educationRecs.map(edu => edu.education_id);
    educationSnapshots = educationRecs.map(edu => JSON.parse(JSON.stringify(edu.toJSON())));

    const enrollmentRecs = db.Enrollment.where({ student_id: studentId });
    if (enrollmentRecs.length === 0) throw new Error("Enrollment record not found after registration.");
    enrollmentId = enrollmentRecs[0].enrollment_id;
    enrollmentSnapshots = enrollmentRecs.map(enr => JSON.parse(JSON.stringify(enr.toJSON())));

    const allocationRecs = db.BatchAllocation.where({ student_id: studentId });
    if (allocationRecs.length === 0) throw new Error("BatchAllocation record not found after registration.");
    allocationId = allocationRecs[0].allocation_id;
    allocationSnapshots = allocationRecs.map(alloc => JSON.parse(JSON.stringify(alloc.toJSON())));

    const feeAccountRec = db.StudentFeeAccount.findOne({ enrollment_id: enrollmentId });
    if (!feeAccountRec) throw new Error("StudentFeeAccount record not found after registration.");
    feeAccountId = feeAccountRec.student_fee_id;
    feeAccountSnapshot = JSON.parse(JSON.stringify(feeAccountRec.toJSON()));

    const installmentRecs = db.Installment.where({ student_fee_id: feeAccountId });
    if (installmentRecs.length === 0) throw new Error("Installment records not found after registration.");
    installmentIds = installmentRecs.map(ins => ins.installment_id);
    installmentSnapshots = installmentRecs.map(ins => JSON.parse(JSON.stringify(ins.toJSON())));

    const paymentRecs = db.Payment.where({ student_fee_id: feeAccountId });
    if (paymentRecs.length === 0) throw new Error("Payment records not found after registration.");
    paymentIds = paymentRecs.map(pay => pay.payment_id);
    paymentSnapshots = paymentRecs.map(pay => JSON.parse(JSON.stringify(pay.toJSON())));

    timings["3. Snapshotted Database Records"] = Date.now() - tStart;

    // 4. Try to run deletion action (dryRun: false)
    console.log("   ⚙️ Step 4: Attempting to delete Student (dryRun = false) via DeleteStudentAction...");
    tStart = Date.now();
    const deleteAction = new DeleteStudentAction({
      db: db,
      user: { role: "admin", username: "admin_test", isValid: true },
      params: {
        token: "MOCK_TOKEN",
        payload: { student_id: studentId, dryRun: false }
      }
    });

    const deleteResponse = deleteAction.run();
    timings["4. Execute DeleteStudentAction"] = Date.now() - tStart;

    // Assert that deletion failed
    if (deleteResponse.success) {
      throw new Error("❌ Integrity Failure: Expected student deletion to be blocked, but it succeeded.");
    }

    const expectedErrorPattern = /Delete Protected|protect/i;
    if (!expectedErrorPattern.test(deleteResponse.error.message)) {
      throw new Error("❌ Error Message Failure: Expected a protection block error message, but got: " + deleteResponse.error.message);
    }
    console.log(`   ✅ Caught expected deletion block error: "${deleteResponse.error.message}"`);

    // 5. Verify database-level data integrity (ensure NO data was modified, mutated or partially deleted)
    console.log("   ⚙️ Step 5: Performing database-level field-by-field data integrity validation...");
    tStart = Date.now();

    function assertObjectsEqual(actual, expected, label) {
      for (const key in expected) {
        const actVal = actual[key];
        const expVal = expected[key];
        if (JSON.stringify(actVal) !== JSON.stringify(expVal)) {
          throw new Error(`❌ Data Integrity Violation in ${label}: Field '${key}' was modified. Expected: ${JSON.stringify(expVal)}, Got: ${JSON.stringify(actVal)}`);
        }
      }
      for (const key in actual) {
        if (!(key in expected)) {
          throw new Error(`❌ Data Integrity Violation in ${label}: Found unexpected field '${key}' with value ${JSON.stringify(actual[key])}`);
        }
      }
    }

    // Verify Student
    const currentStudent = db.Student.findById(studentId);
    if (!currentStudent) throw new Error("❌ Student record missing post-deletion.");
    assertObjectsEqual(currentStudent.toJSON(), studentSnapshot, "Student");

    // Verify Address
    const currentAddress = db.Address.findById(addressId);
    if (!currentAddress) throw new Error("❌ Address record missing post-deletion.");
    assertObjectsEqual(currentAddress.toJSON(), addressSnapshot, "Address");

    // Verify ContactInfo
    const currentContact = db.ContactInfo.findById(contactId);
    if (!currentContact) throw new Error("❌ ContactInfo record missing post-deletion.");
    assertObjectsEqual(currentContact.toJSON(), contactSnapshot, "ContactInfo");

    // Verify Education
    educationIds.forEach((eduId, index) => {
      const curEdu = db.Education.findById(eduId);
      if (!curEdu) throw new Error(`❌ Education record ${eduId} missing post-deletion.`);
      assertObjectsEqual(curEdu.toJSON(), educationSnapshots[index], `Education[${index}]`);
    });

    // Verify Enrollment
    const currentEnrollment = db.Enrollment.findById(enrollmentId);
    if (!currentEnrollment) throw new Error("❌ Enrollment record missing post-deletion.");
    assertObjectsEqual(currentEnrollment.toJSON(), enrollmentSnapshots[0], "Enrollment");

    // Verify BatchAllocation
    const currentAllocation = db.BatchAllocation.findById(allocationId);
    if (!currentAllocation) throw new Error("❌ BatchAllocation record missing post-deletion.");
    assertObjectsEqual(currentAllocation.toJSON(), allocationSnapshots[0], "BatchAllocation");

    // Verify StudentFeeAccount
    const currentFeeAccount = db.StudentFeeAccount.findById(feeAccountId);
    if (!currentFeeAccount) throw new Error("❌ StudentFeeAccount record missing post-deletion.");
    assertObjectsEqual(currentFeeAccount.toJSON(), feeAccountSnapshot, "StudentFeeAccount");

    // Verify Installments
    installmentIds.forEach((insId, index) => {
      const curIns = db.Installment.findById(insId);
      if (!curIns) throw new Error(`❌ Installment record ${insId} missing post-deletion.`);
      assertObjectsEqual(curIns.toJSON(), installmentSnapshots[index], `Installment[${index}]`);
    });

    // Verify Payments
    paymentIds.forEach((payId, index) => {
      const curPay = db.Payment.findById(payId);
      if (!curPay) throw new Error(`❌ Payment record ${payId} missing post-deletion.`);
      assertObjectsEqual(curPay.toJSON(), paymentSnapshots[index], `Payment[${index}]`);
    });

    console.log("   ✅ Success! All records exist and match their pre-deletion snapshots exactly.");
    timings["5. Deep Data Integrity Check"] = Date.now() - tStart;
    results.Scenario_ProductionSafeDelete = "✅ PASSED";

  } catch (error) {
    console.error("   ❌ Test Failed:");
    console.error("      Error Name:   ", error.name || "Error");
    console.error("      Error Message:", error.message);
    if (error.stack) {
      console.error("      Stack Trace:  ", error.stack);
    }
    results.Scenario_ProductionSafeDelete = `❌ FAILED: ${error.message}`;
  } finally {
    // 6. Detailed clean up in strict reverse-topological order to avoid dependency check blocks
    console.log("   ⚙️ Step 6: Cleaning up registered mock records bottom-up (reverse-topologically)...");
    const tCleanupStart = Date.now();
    try {
      if (paymentIds.length > 0) {
        paymentIds.forEach(payId => {
          try { if (db.Payment.findById(payId)) db.Payment.remove(payId); } catch (e) {}
        });
      }
      if (installmentIds.length > 0) {
        installmentIds.forEach(insId => {
          try { if (db.Installment.findById(insId)) db.Installment.remove(insId); } catch (e) {}
        });
      }
      if (allocationId) {
        try { if (db.BatchAllocation.findById(allocationId)) db.BatchAllocation.remove(allocationId); } catch (e) {}
      }
      if (feeAccountId) {
        try { if (db.StudentFeeAccount.findById(feeAccountId)) db.StudentFeeAccount.remove(feeAccountId); } catch (e) {}
      }
      if (enrollmentId) {
        try { if (db.Enrollment.findById(enrollmentId)) db.Enrollment.remove(enrollmentId); } catch (e) {}
      }
      if (educationIds.length > 0) {
        educationIds.forEach(eduId => {
          try { if (db.Education.findById(eduId)) db.Education.remove(eduId); } catch (e) {}
        });
      }
      if (contactId) {
        try { if (db.ContactInfo.findById(contactId)) db.ContactInfo.remove(contactId); } catch (e) {}
      }
      if (addressId) {
        try { if (db.Address.findById(addressId)) db.Address.remove(addressId); } catch (e) {}
      }
      if (studentId) {
        try { if (db.Student.findById(studentId)) db.Student.remove(studentId); } catch (e) {}
      }
      console.log("      Teardown cleanup completed successfully.");
    } catch (cleanupErr) {
      console.warn("      Cleanup warning during teardown:", cleanupErr.message);
    }
    timings["6. Reverse-Topological Teardown"] = Date.now() - tCleanupStart;

    // Calculate and log final performance timings
    const totalTime = Date.now() - t0;
    console.log("\n========================================================");
    console.log("⏱️  STUDENT DELETION PROTECTION TIMING SUMMARY  ⏱️");
    console.log("========================================================");
    for (const step in timings) {
      console.log(`- ${step.padEnd(45)}: ${String(timings[step]).padStart(5)} ms`);
    }
    console.log("--------------------------------------------------------");
    console.log(`- Total Execution Time                         : ${String(totalTime).padStart(5)} ms`);
    console.log("========================================================\n");
  }

  console.log("📊 FINAL TEST RESULTS:\n", JSON.stringify(results, null, 2));
  console.log("🏁 Student Deletion Protection Integration Tests Complete.");
  return results;
}
