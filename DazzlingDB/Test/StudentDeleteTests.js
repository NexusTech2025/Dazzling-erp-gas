/**
 * @file StudentDeleteTests.js
 * Integration test suite for Student deletion actions and foreign key constraints.
 * Dynamically provisions mock data for protect and cascade scenarios.
 */

function runStudentDeleteTests() {
  console.log("🚀 Starting Student Deletion Integration Tests...");
  const db = DBContext.getInstance();
  const results = {};

  try {
    // Setup Curriculum first via TestMockData helper
    const curriculum = TestMockData.setupCurriculum(db);

    // 1. Run Scenario 1: Protect (Deletion blocked by active payments)
    console.log("\n=========================================");
    console.log("▶️ SCENARIO 1: Deleting Student with Outstanding Ledger (Expect Blocked)");
    const scenario1Passed = _testScenarioProtect(db, curriculum);
    results.Scenario1_Protect = scenario1Passed ? "✅ PASSED" : "❌ FAILED";

    // 2. Run Scenario 2: Cascade (Deletion succeeds and purges dependencies)
    console.log("\n=========================================");
    console.log("▶️ SCENARIO 2: Deleting Student with Clean Ledger (Expect Cascade)");
    const scenario2Passed = _testScenarioCascade(db, curriculum);
    results.Scenario2_Cascade = scenario2Passed ? "✅ PASSED" : "❌ FAILED";

  } catch (error) {
    console.error("❌ Fatal error executing test suite:", error.message);
    if (error.stack) {
      console.error("   Traceback:", error.stack);
    }
    results.TestSuite_Fatal = "❌ ERROR: " + error.message;
  }

  console.log("\n=========================================");
  console.log("📊 STUDENT DELETION TEST SUMMARY:");
  console.log(JSON.stringify(results, null, 2));
  console.log("🏁 Student Deletion Integration Tests Complete.");
  
  return results;
}

/**
 * Scenario 1: Deletion is blocked due to active financial ledger records (protect constraint)
 */
function _testScenarioProtect(db, curriculum) {
  const salt = Math.random().toString(36).substring(2, 9).toUpperCase();
  let studentId = null;

  try {
    // 1. Setup Student Graph using RegisterStudentAction
    const regPayload = {
      profile: {
        student_name: "Action Protect Student " + salt,
        gender: "Female",
        dob: "2005-06-15",
        status: "active"
      },
      address: {
        line1: "Protect Lane 1 " + salt,
        city: "Jaipur",
        state: "Rajasthan",
        pin_code: "302017",
        country: "India"
      },
      contact: {
        mobile_number: "8" + Math.floor(100000000 + Math.random() * 900000000),
        email: "protect_" + salt.toLowerCase() + "@test.com"
      },
      education: [
        {
          highest_qualification: "Class 10",
          institution_name: "Protect School",
          year_of_passing: 2024,
          percentage_or_cgpa: "90%"
        }
      ],
      enrollments: [
        {
          enrollment_type: "package",
          item_id: curriculum.packageId,
          fee: 12000,
          package_batches: [
            { course_id: curriculum.physicsId, batch_id: curriculum.batchPhyId },
            { course_id: curriculum.chemistryId, batch_id: curriculum.batchCheId }
          ]
        }
      ],
      feeAccount: {
        total_fee: 12000,
        discount: 1200,
        final_fee: 10800,
        amount_paid: 4800,
        installments: [
          { installment_number: 1, due_amount: 6000, paid_amount: 4800, due_date: "2026-06-15" },
          { installment_number: 2, due_amount: 6000, paid_amount: 0, due_date: "2026-07-15" }
        ]
      },
      payment: {
        amount_paid: 4800,
        payment_method: "upi",
        transaction_reference: "TXN-DEL-PROT-" + salt
      }
    };

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
      throw new Error("Failed to register protect student: " + regResponse.error.message);
    }

    studentId = regResponse.data.student_id;
    console.log(`   ⚙️ Setup completed for Student: ${studentId}`);

    // Verify related records were generated
    const address = db.Address.all().find(addr => addr.student_id === studentId);
    const contact = db.ContactInfo.all().find(c => c.student_id === studentId);
    const enrollments = db.Enrollment.where({ student_id: studentId });
    const sfa = db.StudentFeeAccount.findOne({ enrollment_id: enrollments[0].enrollment_id });
    const installments = db.Installment.where({ student_fee_id: sfa.student_fee_id });
    const payments = db.Payment.where({ student_fee_id: sfa.student_fee_id });

    // 2. Try to run deletion action
    const action = new DeleteStudentAction({
      db: db,
      user: { role: "admin", username: "admin_test", isValid: true },
      params: {
        token: "MOCK_TOKEN",
        payload: { student_id: studentId, dryRun: false }
      }
    });

    const response = action.run();

    // 3. Assert Deletion is Blocked
    if (response.success) {
      throw new Error(`relational protection failed! Expected student deletion to be blocked by active payments/installments, but it succeeded.`);
    }

    console.log(`   ✅ Success: Student deletion was blocked. Message: ${response.error.message}`);
    
    // Assert that the records still exist
    if (!db.Student.findById(studentId)) throw new Error("Student record was deleted despite protect constraint!");
    if (!db.Address.findById(address.address_id)) throw new Error("Address record was deleted!");
    if (!db.ContactInfo.findById(contact.contact_id)) throw new Error("ContactInfo record was deleted!");
    if (!db.StudentFeeAccount.findById(sfa.student_fee_id)) throw new Error("StudentFeeAccount record was deleted!");

    console.log("   ✅ Success: Student and cascading records are intact in the database.");
    return true;

  } finally {
    // 4. Cleanup Mock Data in reverse topological order (manual bypass of protects)
    if (studentId) {
      console.log("   ⚙️ Tearing down Scenario 1 mock records...");
      const enrollments = db.Enrollment.where({ student_id: studentId });
      enrollments.forEach(enr => {
        const sfa = db.StudentFeeAccount.findOne({ enrollment_id: enr.enrollment_id });
        if (sfa) {
          const payments = db.Payment.where({ student_fee_id: sfa.student_fee_id });
          payments.forEach(pay => { try { db.Payment.remove(pay.payment_id); } catch(e) {} });

          const installments = db.Installment.where({ student_fee_id: sfa.student_fee_id });
          installments.forEach(ins => { try { db.Installment.remove(ins.installment_id); } catch(e) {} });

          try { db.StudentFeeAccount.remove(sfa.student_fee_id); } catch(e) {}
        }
        
        const allocs = db.BatchAllocation.where({ enrollment_id: enr.enrollment_id });
        allocs.forEach(alloc => { try { db.BatchAllocation.remove(alloc.allocation_id); } catch(e) {} });

        try { db.Enrollment.remove(enr.enrollment_id); } catch(e) {}
      });

      const contact = db.ContactInfo.all().find(c => c.student_id === studentId);
      if (contact) { try { db.ContactInfo.remove(contact.contact_id); } catch(e) {} }

      const address = db.Address.all().find(addr => addr.student_id === studentId);
      if (address) { try { db.Address.remove(address.address_id); } catch(e) {} }

      const edus = db.Education.where({ student_id: studentId });
      edus.forEach(edu => { try { db.Education.remove(edu.education_id); } catch(e) {} });

      try { db.Student.remove(studentId); } catch(e) {}
    }
  }
}

/**
 * Scenario 2: Deletion completes successfully and cascade deletes all child records
 */
function _testScenarioCascade(db, curriculum) {
  const salt = Math.random().toString(36).substring(2, 9).toUpperCase();
  let studentId = null;
  let addressId = null;
  let contactId = null;
  let enrollmentId = null;
  let sfaId = null;

  try {
    // 1. Setup Student Graph using RegisterStudentAction (Without active payments/installments)
    const regPayload = {
      profile: {
        student_name: "Action Cascade Student " + salt,
        gender: "Female",
        dob: "2005-06-15",
        status: "active"
      },
      address: {
        line1: "Cascade Lane 1 " + salt,
        city: "Jaipur",
        state: "Rajasthan",
        pin_code: "302017",
        country: "India"
      },
      contact: {
        mobile_number: "8" + Math.floor(100000000 + Math.random() * 900000000),
        email: "cascade_" + salt.toLowerCase() + "@test.com"
      },
      education: [
        {
          highest_qualification: "Class 10",
          institution_name: "Cascade School",
          year_of_passing: 2024,
          percentage_or_cgpa: "90%"
        }
      ],
      enrollments: [
        {
          enrollment_type: "course",
          item_id: curriculum.physicsId,
          fee: 5000,
          batch_id: curriculum.batchPhyId
        }
      ]
      // Omitting feeAccount and payment payloads completely ensures zero-ledger registration (cascade-ready)
    };

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
      throw new Error("Failed to register cascade student: " + regResponse.error.message);
    }

    studentId = regResponse.data.student_id;
    console.log(`   ⚙️ Setup completed for Student: ${studentId}`);

    // Retrieve child IDs for verification after deletion
    const address = db.Address.all().find(addr => addr.student_id === studentId);
    addressId = address ? address.address_id : null;

    const contact = db.ContactInfo.all().find(c => c.student_id === studentId);
    contactId = contact ? contact.contact_id : null;

    const enrollments = db.Enrollment.where({ student_id: studentId });
    enrollmentId = enrollments[0] ? enrollments[0].enrollment_id : null;

    // 2. Run Deletion Action
    const action = new DeleteStudentAction({
      db: db,
      user: { role: "admin", username: "admin_test", isValid: true },
      params: {
        token: "MOCK_TOKEN",
        payload: { student_id: studentId, dryRun: false }
      }
    });

    const response = action.run();

    // 3. Assert Deletion Succeeded
    if (!response.success) {
      console.error("   ❌ Delete Student Action Failed. Full Error:", JSON.stringify(response.error, null, 2));
      throw new Error(`relational cascade failed! Expected student to be deleted, but action failed: ${response.error.message}`);
    }

    console.log("   ✅ Success: Student deletion completed successfully.");

    // 4. Assert all related records have been cascade deleted
    if (db.Student.findById(studentId)) throw new Error("Student record still exists.");
    if (addressId && db.Address.findById(addressId)) throw new Error("Address record was NOT cascade deleted.");
    if (contactId && db.ContactInfo.findById(contactId)) throw new Error("ContactInfo record was NOT cascade deleted.");
    if (enrollmentId && db.Enrollment.findById(enrollmentId)) throw new Error("Enrollment record was NOT cascade deleted.");
    
    const eduCheck = db.Education.where({ student_id: studentId });
    if (eduCheck.length > 0) throw new Error("Education record was NOT cascade deleted.");

    console.log("   ✅ Success: Student and all cascading dependencies cleanly deleted from the database.");
    return true;

  } catch (error) {
    console.error("   ❌ Cascade Scenario Failed:", error.message);
    if (error.stack) {
      console.error("      Traceback:", error.stack);
    }
    // Cleanup if cascade failed to prevent dirty states
    if (studentId) {
      try { db.Enrollment.remove(enrollmentId); } catch (e) {}
      try { db.ContactInfo.remove(contactId); } catch (e) {}
      try { db.Address.remove(addressId); } catch (e) {}
      const edus = db.Education.where({ student_id: studentId });
      edus.forEach(edu => { try { db.Education.remove(edu.education_id); } catch(e) {} });
      try { db.Student.remove(studentId); } catch (e) {}
    }
    return false;
  }
}
