/**
 * @file StudentRegistrationTests.js
 * Integration test suite for standard Student Registration via RegisterStudentAction.
 */

function runStudentRegistrationTests() {
  console.log("🚀 Starting Student Registration API Action Integration Tests...");
  const db = DBContext.getInstance();
  const results = {};

  try {
    // 1. Setup Curriculum Mock Data
    const curriculum = TestMockData.setupCurriculum(db);
    const salt = Math.random().toString(36).substring(2, 9).toUpperCase();

    // 2. Generate a unique registration payload
    const regPayload = {
      profile: {
        student_name: "Action Bob " + salt,
        gender: "Male",
        dob: "2005-06-15",
        status: "active"
      },
      address: {
        line1: "Register Lane " + salt,
        city: "Jaipur",
        state: "Rajasthan",
        pin_code: "302017",
        country: "India"
      },
      contact: {
        mobile_number: "8" + Math.floor(100000000 + Math.random() * 900000000), // Unique 10-digit number starting with 8
        email: "bob_reg_" + salt.toLowerCase() + "@test.com"
      },
      education: [
        {
          highest_qualification: "Class 10",
          institution_name: "Mock Public School",
          year_of_passing: 2024,
          percentage_or_cgpa: "92%"
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
        transaction_reference: "TXN-ACTION-REG-" + salt
      }
    };

    console.log(`   ⚙️ Generated Registration Payload with Mobile/Email Salt: ${salt}`);

    // 3. Execute standard RegisterStudentAction
    const action = new RegisterStudentAction({
      db: db,
      user: { role: "admin", username: "admin_test", isValid: true },
      params: {
        token: "MOCK_TOKEN",
        payload: regPayload
      }
    });

    const response = action.run();

    // 4. Assert Action Execution Success
    if (!response.success) {
      console.error("   ❌ Register Student Action Failed. Full Error:", JSON.stringify(response.error, null, 2));
      throw new Error("Action execution failed: " + response.error.message);
    }

    const studentId = response.data.student_id;
    console.log("   ✅ Success: Student registered with ID: " + studentId);

    // 5. Assert database records were correctly persisted
    const student = db.Student.findById(studentId);
    if (!student || student.student_name !== regPayload.profile.student_name) {
      throw new Error("Student profile record not found or data mismatch.");
    }

    const address = db.Address.all().find(addr => addr.student_id === studentId);
    if (!address || address.line1 !== regPayload.address.line1) {
      throw new Error("Address record not found or data mismatch.");
    }

    const contact = db.ContactInfo.all().find(c => c.student_id === studentId);
    if (!contact || contact.mobile_number !== regPayload.contact.mobile_number) {
      throw new Error("ContactInfo record not found or data mismatch.");
    }

    const educations = db.Education.where({ student_id: studentId });
    if (educations.length !== 1 || educations[0].institution_name !== regPayload.education[0].institution_name) {
      throw new Error("Education record not found or data mismatch.");
    }

    const enrollments = db.Enrollment.where({ student_id: studentId });
    if (enrollments.length !== 1 || enrollments[0].item_id !== curriculum.packageId) {
      throw new Error("Enrollment record not found or data mismatch.");
    }

    const sfa = db.StudentFeeAccount.findOne({ enrollment_id: enrollments[0].enrollment_id });
    if (!sfa || sfa.amount_paid !== 4800 || sfa.balance_due !== 6000) {
      throw new Error("StudentFeeAccount record not found or proportional split mismatch.");
    }

    const installments = db.Installment.where({ student_fee_id: sfa.student_fee_id });
    if (installments.length !== 2) {
      throw new Error("Installment records count mismatch.");
    }

    const payments = db.Payment.where({ student_fee_id: sfa.student_fee_id });
    if (payments.length !== 1 || payments[0].amount_paid !== 4800) {
      throw new Error("Payment record not found or amount mismatch.");
    }

    console.log("   ✅ Success: All database records and proportional ledger splits verified.");
    results.RegistrationValidation = "✅ PASSED";

  } catch (error) {
    console.error("   ❌ Registration Test Failed:", error.message);
    if (error.stack) {
      console.error("      Traceback:", error.stack);
    }
    results.RegistrationValidation = `❌ FAILED: ${error.message}`;
  }

  console.log("\n=========================================");
  console.log("📊 STUDENT REGISTRATION TEST SUMMARY:");
  console.log(JSON.stringify(results, null, 2));
  console.log("🏁 Student Registration Integration Tests Complete.");
  
  return results;
}
