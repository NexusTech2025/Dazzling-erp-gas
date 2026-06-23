/**
 * @file RepositoryDeletionTestSuite.js
 * Integration tests for DynamicRepository database deletion constraint execution.
 * Verifies cascading deletes on the live database context in Google Apps Script.
 */

const RepositoryDeletionTestSuite = (function () {
  function runAll() {
    const activeEnv = typeof SYSTEM_ENV !== 'undefined' ? SYSTEM_ENV : Environment.DEVELOPMENT;
    if (resolveEnvironmentType(activeEnv) === Environment.PRODUCTION) {
      throw new Error("❌ Safety Guard: Test suite cannot be executed in the PRODUCTION environment.");
    }

    console.log("🚀 Starting DynamicRepository Deletion Integration Tests...");

    const results = {};

    console.log("\n=========================================");
    results.Scenario12 = testCascadeDeletes();
    results.Scenario13 = testProtectDeletes();
    results.Scenario14 = testSetNullDeletes();
    results.Scenario15 = testDoNothingDeletes();

    console.log("=========================================\n");
    console.log("📊 FINAL TEST RESULTS:\n", JSON.stringify(results, null, 2));
    console.log("🏁 DynamicRepository Deletion Tests Complete.");

    return results;
  }

  // --- SCENARIO IMPLEMENTATIONS ---

  function registerTestStudent(db, prefix, salt) {
    console.log(`   ⚙️ Provisioning mock curriculum for ${prefix}...`);
    const curriculum = TestMockData.setupCurriculum(db);

    const regPayload = {
      profile: {
        student_name: `TDD ${prefix} Student ${salt}`,
        gender: "Male",
        dob: "2005-06-15",
        status: "active"
      },
      address: {
        line1: `TDD ${prefix} Lane ${salt}`,
        city: "Jaipur",
        state: "Rajasthan",
        pin_code: "302017",
        country: "India"
      },
      contact: {
        mobile_number: "8" + Math.floor(100000000 + Math.random() * 900000000),
        email: `tdd${prefix.toLowerCase()}_${salt.toLowerCase()}@test.com`
      },
      education: [
        {
          highest_qualification: "Class 10",
          institution_name: "TDD High School",
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
    };

    console.log(`   ⚙️ Registering student using RegisterStudentAction for ${prefix}...`);
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
      throw new Error(`Failed to register student: ${regResponse.error.message}`);
    }

    const studentId = regResponse.data.student_id;
    console.log(`   ⚙️ Student registered with ID: ${studentId}`);

    // Retrieve child IDs
    const address = db.Address.all().find(addr => addr.student_id === studentId);
    const addressId = address ? address.address_id : null;

    const contact = db.ContactInfo.all().find(c => c.student_id === studentId);
    const contactId = contact ? contact.contact_id : null;

    const enrollments = db.Enrollment.where({ student_id: studentId });
    const enrollmentId = enrollments[0] ? enrollments[0].enrollment_id : null;

    const educations = db.Education.where({ student_id: studentId });
    const educationIds = educations.map(edu => edu.education_id);

    return {
      studentId,
      addressId,
      contactId,
      enrollmentId,
      educationIds
    };
  }

  function testCascadeDeletes() {
    console.log("▶️ SCENARIO 12: Verification of Cascading Deletion on Live Database");
    const db = DBContext.getInstance();
    const salt = Math.random().toString(36).substring(2, 9).toUpperCase();
    let ids = null;

    try {
      ids = registerTestStudent(db, "Cascade", salt);

      console.log("   ⚙️ Deleting Student record directly via repository.remove()...");
      db.Student.remove(ids.studentId);

      // Assertions: verify all records are deleted from live database
      if (db.Student.findById(ids.studentId)) {
        throw new Error("Student record still exists in the database.");
      }
      if (ids.addressId && db.Address.findById(ids.addressId)) {
        throw new Error("Address record was NOT cascade deleted.");
      }
      if (ids.contactId && db.ContactInfo.findById(ids.contactId)) {
        throw new Error("ContactInfo record was NOT cascade deleted.");
      }
      if (ids.enrollmentId && db.Enrollment.findById(ids.enrollmentId)) {
        throw new Error("Enrollment record was NOT cascade deleted.");
      }
      const edus = db.Education.where({ student_id: ids.studentId });
      if (edus.length > 0) {
        throw new Error("Education record was NOT cascade deleted.");
      }

      console.log("   ✅ Success! Parent Student and all cascading child records cleanly deleted.");
      return "✅ PASSED";
    } catch (error) {
      console.error("   ❌ Failed:");
      console.error("      Error Name:   ", error.name || "Error");
      console.error("      Error Message:", error.message);
      if (error.stack) {
        console.error("      Stack Trace:  ", error.stack);
      }
      return `❌ FAILED: ${error.message}`;
    } finally {
      // Safe cleanup: if student still exists due to failure, clean up reverse topologically
      if (ids && ids.studentId && db.Student.findById(ids.studentId)) {
        console.log("   ⚙️ Test failed or aborted. Cleaning up mock student records from sheets...");
        try {
          if (ids.enrollmentId) db.Enrollment.remove(ids.enrollmentId);
          if (ids.contactId) db.ContactInfo.remove(ids.contactId);
          if (ids.addressId) db.Address.remove(ids.addressId);
          ids.educationIds.forEach(eduId => db.Education.remove(eduId));
          db.Student.remove(ids.studentId);
        } catch (e) {
          console.warn("      Cleanup error:", e.message);
        }
      }
    }
  }

  function testProtectDeletes() {
    console.log("▶️ SCENARIO 13: Verification of Protect Deletion Policy on Live Database");
    const db = DBContext.getInstance();
    const salt = Math.random().toString(36).substring(2, 9).toUpperCase();
    let ids = null;

    // Mutate the parent relation, child relation, and child foreign key column configurations
    const studentSchema = db._registry.getTableSchema("Student");
    const addressSchema = db._registry.getTableSchema("Address");

    const originalStudentRelOnDelete = studentSchema.relations.address.onDelete;
    const originalAddressRelOnDelete = addressSchema.relations.student.onDelete;
    const originalAddressColOnDelete = addressSchema.columns.student_id.onDelete;

    try {
      console.log("   ⚙️ Temporarily setting Student <-> Address onDelete to 'protect'...");
      studentSchema.relations.address.onDelete = "protect";
      addressSchema.relations.student.onDelete = "protect";
      addressSchema.columns.student_id.onDelete = "protect";

      // Re-compile static graph to reflect this change
      const StaticGraphBuilder = SheetDB.Graph ? SheetDB.Graph.StaticGraphBuilder : null;
      if (!StaticGraphBuilder) {
        throw new Error("StaticGraphBuilder is not defined on SheetDB.");
      }
      db._staticGraph = StaticGraphBuilder.compile(db._schema);

      // Register student with all details using helper
      ids = registerTestStudent(db, "Protect", salt);

      console.log("   ⚙️ Attempting to delete Student (should fail)...");
      try {
        db.Student.remove(ids.studentId);
        throw new Error("Student deletion succeeded, but should have failed due to protect constraint.");
      } catch (error) {
        const isIntegrityError = error.name === "IntegrityError" || error.message.indexOf("Delete Protected") !== -1;
        if (!isIntegrityError) {
          throw error;
        }
        console.log(`   ✅ Caught expected validation halt: ${error.message}`);
      }

      // Assertions: verify all records are intact (not deleted)
      console.log("   ⚙️ Verifying that all records remain intact in the database...");
      if (!db.Student.findById(ids.studentId)) {
        throw new Error("Student record was deleted despite protect policy.");
      }
      if (!db.Address.findById(ids.addressId)) {
        throw new Error("Address record was deleted despite protect policy.");
      }
      if (!db.ContactInfo.findById(ids.contactId)) {
        throw new Error("ContactInfo record was deleted despite protect policy.");
      }
      if (!db.Enrollment.findById(ids.enrollmentId)) {
        throw new Error("Enrollment record was deleted despite protect policy.");
      }
      ids.educationIds.forEach(eduId => {
        if (!db.Education.findById(eduId)) {
          throw new Error(`Education record ${eduId} was deleted despite protect policy.`);
        }
      });

      console.log("   ✅ Success! Protect constraint successfully blocked parent deletion and kept all records intact.");
      return "✅ PASSED";
    } catch (error) {
      console.error("   ❌ Failed:");
      console.error("      Error Name:   ", error.name || "Error");
      console.error("      Error Message:", error.message);
      return `❌ FAILED: ${error.message}`;
    } finally {
      console.log("   ⚙️ Cleaning up records and restoring schema...");
      try {
        if (ids) {
          if (ids.enrollmentId && db.Enrollment.findById(ids.enrollmentId)) db.Enrollment.remove(ids.enrollmentId);
          if (ids.contactId && db.ContactInfo.findById(ids.contactId)) db.ContactInfo.remove(ids.contactId);
          if (ids.addressId && db.Address.findById(ids.addressId)) db.Address.remove(ids.addressId);
          ids.educationIds.forEach(eduId => {
            if (db.Education.findById(eduId)) db.Education.remove(eduId);
          });
          if (ids.studentId && db.Student.findById(ids.studentId)) db.Student.remove(ids.studentId);
        }
      } catch (cleanupErr) {
        console.warn("      Cleanup warning:", cleanupErr.message);
      }

      // Restore schema configuration
      if (originalStudentRelOnDelete === undefined) {
        delete studentSchema.relations.address.onDelete;
      } else {
        studentSchema.relations.address.onDelete = originalStudentRelOnDelete;
      }

      if (originalAddressRelOnDelete === undefined) {
        delete addressSchema.relations.student.onDelete;
      } else {
        addressSchema.relations.student.onDelete = originalAddressRelOnDelete;
      }

      if (originalAddressColOnDelete === undefined) {
        delete addressSchema.columns.student_id.onDelete;
      } else {
        addressSchema.columns.student_id.onDelete = originalAddressColOnDelete;
      }

      // Re-compile static graph to restore original state
      try {
        const StaticGraphBuilder = SheetDB.Graph ? SheetDB.Graph.StaticGraphBuilder : null;
        if (StaticGraphBuilder) {
          db._staticGraph = StaticGraphBuilder.compile(db._schema);
        }
      } catch (recompileErr) {
        console.error("      Schema restore failed:", recompileErr.message);
      }
    }
  }

  function testSetNullDeletes() {
    console.log("▶️ SCENARIO 14: Verification of Set-Null Deletion Policy on Live Database");
    const db = DBContext.getInstance();
    const salt = Math.random().toString(36).substring(2, 9).toUpperCase();
    let ids = null;

    // Mutate the parent relation, child relation, and child foreign key column configurations
    const studentSchema = db._registry.getTableSchema("Student");
    const addressSchema = db._registry.getTableSchema("Address");

    const originalStudentRelOnDelete = studentSchema.relations.address.onDelete;
    const originalAddressRelOnDelete = addressSchema.relations.student.onDelete;
    const originalAddressColOnDelete = addressSchema.columns.student_id.onDelete;

    try {
      console.log("   ⚙️ Temporarily setting Student <-> Address onDelete to 'set_null'...");
      studentSchema.relations.address.onDelete = "set_null";
      addressSchema.relations.student.onDelete = "set_null";
      addressSchema.columns.student_id.onDelete = "set_null";

      // Re-compile static graph to reflect this change
      const StaticGraphBuilder = SheetDB.Graph ? SheetDB.Graph.StaticGraphBuilder : null;
      if (!StaticGraphBuilder) {
        throw new Error("StaticGraphBuilder is not defined on SheetDB.");
      }
      db._staticGraph = StaticGraphBuilder.compile(db._schema);

      // Register student with all details using helper
      ids = registerTestStudent(db, "SetNull", salt);

      console.log("   ⚙️ Deleting Student record directly via repository.remove()...");
      db.Student.remove(ids.studentId);

      // Assertions
      if (db.Student.findById(ids.studentId)) {
        throw new Error("Student record still exists in the database.");
      }

      console.log("   ⚙️ Verifying that child Address survives and is nullified...");
      const updatedAddress = db.Address.findById(ids.addressId);
      if (!updatedAddress) {
        throw new Error("Address record was deleted, but it should have survived under set_null policy.");
      }

      if (updatedAddress.student_id !== null && updatedAddress.student_id !== "") {
        throw new Error(`Address student_id was NOT nullified. Current value: ${updatedAddress.student_id}`);
      }

      console.log("   ⚙️ Verifying other cascade relations are deleted...");
      if (ids.contactId && db.ContactInfo.findById(ids.contactId)) {
        throw new Error("ContactInfo record was NOT cascade deleted.");
      }
      if (ids.enrollmentId && db.Enrollment.findById(ids.enrollmentId)) {
        throw new Error("Enrollment record was NOT cascade deleted.");
      }
      ids.educationIds.forEach(eduId => {
        if (db.Education.findById(eduId)) {
          throw new Error("Education record was NOT cascade deleted.");
        }
      });

      console.log("   ✅ Success! Parent Student deleted, child Address successfully nullified, and other cascade child records deleted.");
      return "✅ PASSED";
    } catch (error) {
      console.error("   ❌ Failed:");
      console.error("      Error Name:   ", error.name || "Error");
      console.error("      Error Message:", error.message);
      return `❌ FAILED: ${error.message}`;
    } finally {
      console.log("   ⚙️ Cleaning up records and restoring schema...");
      try {
        if (ids) {
          if (ids.addressId && db.Address.findById(ids.addressId)) {
            db.Address.remove(ids.addressId);
          }
          if (ids.enrollmentId && db.Enrollment.findById(ids.enrollmentId)) db.Enrollment.remove(ids.enrollmentId);
          if (ids.contactId && db.ContactInfo.findById(ids.contactId)) db.ContactInfo.remove(ids.contactId);
          ids.educationIds.forEach(eduId => {
            if (db.Education.findById(eduId)) db.Education.remove(eduId);
          });
          if (ids.studentId && db.Student.findById(ids.studentId)) db.Student.remove(ids.studentId);
        }
      } catch (cleanupErr) {
        console.warn("      Cleanup warning:", cleanupErr.message);
      }

      // Restore schema configuration
      if (originalStudentRelOnDelete === undefined) {
        delete studentSchema.relations.address.onDelete;
      } else {
        studentSchema.relations.address.onDelete = originalStudentRelOnDelete;
      }

      if (originalAddressRelOnDelete === undefined) {
        delete addressSchema.relations.student.onDelete;
      } else {
        addressSchema.relations.student.onDelete = originalAddressRelOnDelete;
      }

      if (originalAddressColOnDelete === undefined) {
        delete addressSchema.columns.student_id.onDelete;
      } else {
        addressSchema.columns.student_id.onDelete = originalAddressColOnDelete;
      }

      // Re-compile static graph to restore original state
      try {
        const StaticGraphBuilder = SheetDB.Graph ? SheetDB.Graph.StaticGraphBuilder : null;
        if (StaticGraphBuilder) {
          db._staticGraph = StaticGraphBuilder.compile(db._schema);
        }
      } catch (recompileErr) {
        console.error("      Schema restore failed:", recompileErr.message);
      }
    }
  }

  function testDoNothingDeletes() {
    console.log("▶️ SCENARIO 15: Verification of Do-Nothing Deletion Policy on Live Database");
    const db = DBContext.getInstance();
    const salt = Math.random().toString(36).substring(2, 9).toUpperCase();
    let ids = null;

    // Mutate the parent relation, child relation, and child foreign key column configurations
    const studentSchema = db._registry.getTableSchema("Student");
    const addressSchema = db._registry.getTableSchema("Address");

    const originalStudentRelOnDelete = studentSchema.relations.address.onDelete;
    const originalAddressRelOnDelete = addressSchema.relations.student.onDelete;
    const originalAddressColOnDelete = addressSchema.columns.student_id.onDelete;

    try {
      console.log("   ⚙️ Temporarily setting Student <-> Address onDelete to 'do_nothing'...");
      studentSchema.relations.address.onDelete = "do_nothing";
      addressSchema.relations.student.onDelete = "do_nothing";
      addressSchema.columns.student_id.onDelete = "do_nothing";

      // Re-compile static graph to reflect this change
      const StaticGraphBuilder = SheetDB.Graph ? SheetDB.Graph.StaticGraphBuilder : null;
      if (!StaticGraphBuilder) {
        throw new Error("StaticGraphBuilder is not defined on SheetDB.");
      }
      db._staticGraph = StaticGraphBuilder.compile(db._schema);

      // Register student with all details using helper
      ids = registerTestStudent(db, "DoNothing", salt);

      console.log("   ⚙️ Deleting Student record directly via repository.remove()...");
      db.Student.remove(ids.studentId);

      // Assertions
      if (db.Student.findById(ids.studentId)) {
        throw new Error("Student record still exists in the database.");
      }

      console.log("   ⚙️ Verifying that child Address survives and is untouched...");
      const updatedAddress = db.Address.findById(ids.addressId);
      if (!updatedAddress) {
        throw new Error("Address record was deleted, but it should have survived under do_nothing policy.");
      }

      if (updatedAddress.student_id !== ids.studentId) {
        throw new Error(`Address student_id was modified. Expected: ${ids.studentId}, Got: ${updatedAddress.student_id}`);
      }

      console.log("   ⚙️ Verifying other cascade relations are deleted...");
      if (ids.contactId && db.ContactInfo.findById(ids.contactId)) {
        throw new Error("ContactInfo record was NOT cascade deleted.");
      }
      if (ids.enrollmentId && db.Enrollment.findById(ids.enrollmentId)) {
        throw new Error("Enrollment record was NOT cascade deleted.");
      }
      ids.educationIds.forEach(eduId => {
        if (db.Education.findById(eduId)) {
          throw new Error("Education record was NOT cascade deleted.");
        }
      });

      console.log("   ✅ Success! Parent Student deleted, child Address survives untouched, and other cascade child records deleted.");
      return "✅ PASSED";
    } catch (error) {
      console.error("   ❌ Failed:");
      console.error("      Error Name:   ", error.name || "Error");
      console.error("      Error Message:", error.message);
      return `❌ FAILED: ${error.message}`;
    } finally {
      console.log("   ⚙️ Cleaning up records and restoring schema...");
      try {
        if (ids) {
          if (ids.addressId && db.Address.findById(ids.addressId)) {
            db.Address.remove(ids.addressId);
          }
          if (ids.enrollmentId && db.Enrollment.findById(ids.enrollmentId)) db.Enrollment.remove(ids.enrollmentId);
          if (ids.contactId && db.ContactInfo.findById(ids.contactId)) db.ContactInfo.remove(ids.contactId);
          ids.educationIds.forEach(eduId => {
            if (db.Education.findById(eduId)) db.Education.remove(eduId);
          });
          if (ids.studentId && db.Student.findById(ids.studentId)) db.Student.remove(ids.studentId);
        }
      } catch (cleanupErr) {
        console.warn("      Cleanup warning:", cleanupErr.message);
      }

      // Restore schema configuration
      if (originalStudentRelOnDelete === undefined) {
        delete studentSchema.relations.address.onDelete;
      } else {
        studentSchema.relations.address.onDelete = originalStudentRelOnDelete;
      }

      if (originalAddressRelOnDelete === undefined) {
        delete addressSchema.relations.student.onDelete;
      } else {
        addressSchema.relations.student.onDelete = originalAddressRelOnDelete;
      }

      if (originalAddressColOnDelete === undefined) {
        delete addressSchema.columns.student_id.onDelete;
      } else {
        addressSchema.columns.student_id.onDelete = originalAddressColOnDelete;
      }

      // Re-compile static graph to restore original state
      try {
        const StaticGraphBuilder = SheetDB.Graph ? SheetDB.Graph.StaticGraphBuilder : null;
        if (StaticGraphBuilder) {
          db._staticGraph = StaticGraphBuilder.compile(db._schema);
        }
      } catch (recompileErr) {
        console.error("      Schema restore failed:", recompileErr.message);
      }
    }
  }

  return {
    runAll: runAll
  };
})();

function runRepositoryDeletionTests() {
  return RepositoryDeletionTestSuite.runAll();
}
