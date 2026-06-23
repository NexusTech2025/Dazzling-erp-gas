/**
 * @file BatchDeletionTestSuite.js
 * Integration test suite for the optimized SheetDB bulk deletion algorithm.
 * Verifies bulk cascade deletions, transactional rollbacks, soft-filtering,
 * and shared child validations.
 */

const BatchDeletionTestSuite = (function () {
  function runAll() {
    const activeEnv = typeof SYSTEM_ENV !== 'undefined' ? SYSTEM_ENV : Environment.DEVELOPMENT;
    if (resolveEnvironmentType(activeEnv) === Environment.PRODUCTION) {
      throw new Error("❌ Safety Guard: Test suite cannot be executed in the PRODUCTION environment.");
    }

    console.log("🚀 Starting SheetDB Bulk Deletion Algorithm Integration Tests...");
    const db = DBContext.getInstance();
    const results = {};
    
    const scenarios = [
      { name: "Scenario 1: Bulk delete soft-filters non-existent IDs into skipped manifest", fn: () => testSoftFiltering(db) },
      { name: "Scenario 2: Bulk delete success with cascades (no protect blocks)", fn: () => testBulkDeleteSuccess(db) },
      { name: "Scenario 3: Bulk delete blocked and surgically rolled back on protection failure", fn: () => testBulkDeleteRollback(db) },
      { name: "Scenario 4: Shared child records do not trigger false-positive protect blocks", fn: () => testSharedChildValidation(db) }
    ];

    scenarios.forEach(scenario => {
      try {
        console.log(`\n--- Running: ${scenario.name} ---`);
        scenario.fn();
        console.log(`✅ PASS: ${scenario.name}`);
        results[scenario.name] = "✅ PASSED";
      } catch (e) {
        console.error(`❌ FAIL: ${scenario.name} -> ${e.message}`);
        if (e.stack) console.error(e.stack);
        results[scenario.name] = `❌ FAILED: ${e.message}`;
      }
    });

    console.log("\n=========================================");
    console.log("=== BULK DELETION TESTS COMPLETE ===");
    console.log(JSON.stringify(results, null, 2));
    return results;
  }

  // --- Helper: Register a mock student dynamically ---
  function registerMockStudent(db, salt, includeFinance) {
    const curriculum = TestMockData.setupCurriculum(db);
    
    const payload = {
      profile: {
        student_name: "TDD Bulk Student " + salt,
        gender: "Male",
        dob: "2005-05-15",
        email: `tddbulk_${salt.toLowerCase()}@test.com`,
        phone: "+91" + Math.floor(1000000000 + Math.random() * 9000000000),
        status: "active"
      },
      address: {
        line1: "TDD Bulk Lane " + salt,
        city: "Jaipur",
        state: "Rajasthan",
        pin_code: "302017",
        country: "India"
      },
      contact: {
        email: `tddbulk_contact_${salt.toLowerCase()}@test.com`,
        mobile_number: "9" + Math.floor(100000000 + Math.random() * 900000000),
        emergency_name: "Emergency " + salt,
        emergency_phone: "8" + Math.floor(100000000 + Math.random() * 900000000),
        emergency_relationship: "Parent"
      },
      education: [
        {
          highest_qualification: "Class 10",
          institution_name: "TDD School " + salt,
          year_of_passing: 2024,
          percentage_or_cgpa: "90%"
        }
      ],
      enrollments: [
        {
          enrollment_type: "course",
          item_id: curriculum.physicsId,
          fee: 10000,
          roll_number: 3001,
          enrollment_date: "2026-06-01",
          status: "active",
          academic_status: "active",
          batch_id: curriculum.batchPhyId
        }
      ]
    };

    if (includeFinance) {
      payload.feeAccount = {
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
        remarks: "TDD Bulk Fee Account",
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
          }
        ]
      };
      payload.payment = {
        amount_paid: 4500,
        payment_date: "2026-06-01T20:10:00Z",
        payment_method: "upi",
        transaction_reference: "TXN-BULK-TEST-" + salt,
        status: "success",
        remarks: "TDD Bulk payment entry",
        created_by: "tdd_tester"
      };
    }

    const regAction = new RegisterStudentAction({
      db: db,
      user: { role: "admin", username: "admin_test", isValid: true },
      params: {
        token: "MOCK_TOKEN",
        payload: payload
      }
    });

    const regResponse = regAction.run();
    if (!regResponse.success) {
      throw new Error(`Failed to register student: ${regResponse.error.message}`);
    }

    return regResponse.data.student_id;
  }

  // --- SCENARIO IMPLEMENTATIONS ---

  // 1. Scenario 1: Soft-filters non-existent IDs into skipped manifest
  function testSoftFiltering(db) {
    const salt = Math.random().toString(36).substring(2, 9).toUpperCase();
    const validId = registerMockStudent(db, salt, false);
    const nonExistentId1 = "STU-NONEXISTENT-1";
    const nonExistentId2 = "STU-NONEXISTENT-2";

    try {
      // Execute in dryRun mode to get manifest
      const manifest = db.Student.enforceDeleteConstraintsBatch(
        [validId, nonExistentId1, nonExistentId2],
        { dryRun: true }
      );

      if (manifest.deleted.indexOf(validId) === -1) {
        throw new Error("Validation failed: Valid ID should be marked as deleted in manifest.");
      }
      if (manifest.skipped.indexOf(nonExistentId1) === -1 || manifest.skipped.indexOf(nonExistentId2) === -1) {
        throw new Error("Validation failed: Non-existent IDs should be in skipped manifest.");
      }
      console.log("   ✅ Success: Manifest correctly skips non-existent IDs and includes valid ones.");

    } finally {
      // Cleanup
      try { db.Student.deleteMany([validId]); } catch (e) {}
    }
  }

  // 2. Scenario 2: Bulk delete success with cascades (no protect blocks)
  function testBulkDeleteSuccess(db) {
    const salt1 = Math.random().toString(36).substring(2, 9).toUpperCase();
    const salt2 = Math.random().toString(36).substring(2, 9).toUpperCase();
    
    // Register two students without finance accounts (so no protect constraints exist)
    const stu1 = registerMockStudent(db, salt1, false);
    const stu2 = registerMockStudent(db, salt2, false);

    // Capture child record references
    const addr1 = db.Address.findOne({ student_id: stu1 });
    const addr2 = db.Address.findOne({ student_id: stu2 });
    const enr1 = db.Enrollment.findOne({ student_id: stu1 });
    const enr2 = db.Enrollment.findOne({ student_id: stu2 });

    if (!addr1 || !addr2 || !enr1 || !enr2) {
      throw new Error("Setup Error: Child records were not registered successfully.");
    }

    try {
      // Run bulk deletion physically
      const count = db.Student.deleteMany([stu1, stu2]);
      
      if (count !== 2) {
        throw new Error(`Expected deleted count 2, but got: ${count}`);
      }

      // Assert parents are deleted
      if (db.Student.findById(stu1) || db.Student.findById(stu2)) {
        throw new Error("Validation failed: Parent student records were not deleted.");
      }

      // Assert children are cascade deleted
      if (db.Address.findById(addr1.address_id) || db.Address.findById(addr2.address_id)) {
        throw new Error("Validation failed: Dependent Address records were not cascade-deleted.");
      }
      if (db.Enrollment.findById(enr1.enrollment_id) || db.Enrollment.findById(enr2.enrollment_id)) {
        throw new Error("Validation failed: Dependent Enrollment records were not cascade-deleted.");
      }

      console.log("   ✅ Success: Bulk cascade delete deleted all parent and child rows physically.");

    } finally {
      // Safe Cleanup
      try { db.Student.deleteMany([stu1, stu2]); } catch (e) {}
    }
  }

  // 3. Scenario 3: Bulk delete blocked and surgically rolled back on protection failure
  function testBulkDeleteRollback(db) {
    const saltSafe = Math.random().toString(36).substring(2, 9).toUpperCase();
    const saltBlocked = Math.random().toString(36).substring(2, 9).toUpperCase();

    // Student 1: Safe to delete
    const stuSafe = registerMockStudent(db, saltSafe, false);
    // Student 2: Blocked by active installments (protect policy)
    const stuBlocked = registerMockStudent(db, saltBlocked, true);

    // Snapshot pre-deletion values
    const safeStudentSnapshot = JSON.parse(JSON.stringify(db.Student.findById(stuSafe).toJSON()));
    const blockedStudentSnapshot = JSON.parse(JSON.stringify(db.Student.findById(stuBlocked).toJSON()));

    const safeAddress = db.Address.findOne({ student_id: stuSafe });
    const blockedAddress = db.Address.findOne({ student_id: stuBlocked });
    const safeAddrSnapshot = JSON.parse(JSON.stringify(safeAddress.toJSON()));
    const blockedAddrSnapshot = JSON.parse(JSON.stringify(blockedAddress.toJSON()));

    try {
      // Attempt physical delete - must throw ValidationError
      db.Student.deleteMany([stuSafe, stuBlocked]);
      throw new Error("Validation failed: deleteMany should have thrown ValidationError.");
    } catch (e) {
      if (!/Batch Delete Failed|protect|ValidationError/i.test(e.message)) {
        throw new Error(`Expected Batch Delete failure error, but caught: ${e.message}`);
      }
      console.log(`   ✅ Caught expected batch delete exception: "${e.message}"`);

      // Verify Transactional Recovery: check if BOTH students and children remain 100% intact
      const curSafeStu = db.Student.findById(stuSafe);
      const curBlockedStu = db.Student.findById(stuBlocked);
      const curSafeAddr = db.Address.findById(safeAddress.address_id);
      const curBlockedAddr = db.Address.findById(blockedAddress.address_id);

      if (!curSafeStu || !curBlockedStu || !curSafeAddr || !curBlockedAddr) {
        throw new Error("❌ Rollback Failure: Some records were deleted or lost during rollback recovery!");
      }

      // Assert field equality
      if (JSON.stringify(curSafeStu.toJSON()) !== JSON.stringify(safeStudentSnapshot) ||
          JSON.stringify(curSafeAddr.toJSON()) !== JSON.stringify(safeAddrSnapshot)) {
        throw new Error("❌ Data Mutation: Safe student record values were corrupted during rollback!");
      }
      if (JSON.stringify(curBlockedStu.toJSON()) !== JSON.stringify(blockedStudentSnapshot) ||
          JSON.stringify(curBlockedAddr.toJSON()) !== JSON.stringify(blockedAddrSnapshot)) {
        throw new Error("❌ Data Mutation: Blocked student record values were corrupted during rollback!");
      }

      console.log("   ✅ Success: Rollback completely restored all records with 100% field integrity.");

    } finally {
      // Clean up block elements manually
      const feeAcc = db.StudentFeeAccount.findOne({ enrollment_id: db.Enrollment.findOne({ student_id: stuBlocked }).enrollment_id });
      if (feeAcc) {
        const pays = db.Payment.where({ student_fee_id: feeAcc.student_fee_id });
        pays.forEach(p => { try { db.Payment.remove(p.payment_id); } catch (e) {} });
        const ins = db.Installment.where({ student_fee_id: feeAcc.student_fee_id });
        ins.forEach(i => { try { db.Installment.remove(i.installment_id); } catch (e) {} });
      }
      try { db.Student.deleteMany([stuSafe, stuBlocked]); } catch (e) {}
    }
  }

  // 4. Scenario 4: Shared child records do not trigger false-positive protect blocks
  function testSharedChildValidation(db) {
    const salt1 = Math.random().toString(36).substring(2, 9).toUpperCase();
    const salt2 = Math.random().toString(36).substring(2, 9).toUpperCase();

    const stu1 = registerMockStudent(db, salt1, false);
    const stu2 = registerMockStudent(db, salt2, false);

    // Fetch batch allocations which reference the same Batch (shared child)
    const alloc1 = db.BatchAllocation.findOne({ student_id: stu1 });
    const alloc2 = db.BatchAllocation.findOne({ student_id: stu2 });

    if (!alloc1 || !alloc2 || alloc1.batch_id !== alloc2.batch_id) {
      throw new Error("Setup Error: Students are not allocated to the same Batch.");
    }

    try {
      // Verify that deleting both students succeeds and does not raise false-positive blocks
      // because our globalDeleteNodeKeys aggregation shares cascade sets across graphs.
      const manifest = db.Student.enforceDeleteConstraintsBatch([stu1, stu2], { dryRun: true });
      
      if (!manifest.success || Object.keys(manifest.failed).length > 0) {
        throw new Error(`Validation failed: Shared batch relationship triggered false-positive: ${JSON.stringify(manifest.failed)}`);
      }
      console.log("   ✅ Success: Shared child nodes successfully validated without false-positive blocks.");

    } finally {
      try { db.Student.deleteMany([stu1, stu2]); } catch (e) {}
    }
  }

  return {
    runAll: runAll
  };
})();

function runBatchDeletionTests() {
  return BatchDeletionTestSuite.runAll();
}
