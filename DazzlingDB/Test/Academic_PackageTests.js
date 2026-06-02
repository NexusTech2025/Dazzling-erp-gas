/**
 * @file Academic_PackageTests.js
 * Automated integration test suite for specialized Package Creation and Update actions.
 */

function runAcademicPackageTests() {
  console.log("🚀 Starting Academic Package Integration Tests...");
  
  const db = DBContext.getInstance();
  const results = {};
  
  // Clean up any residual test packages before running tests
  cleanUpTestPackages(db);

  console.log("\n=========================================");
  results.Scenario1 = executeScenario1_PolymorphicCreation(db);
  
  console.log("\n=========================================");
  results.Scenario2 = executeScenario2_TransactionalUpdate(db);

  console.log("\n=========================================");
  results.Scenario3 = executeScenario3_RollbackValidation(db);
  
  console.log("\n=========================================");
  results.Scenario4 = executeScenario4_DeleteRestrictConstraint(db);

  console.log("\n=========================================");
  results.Scenario5 = executeScenario5_DeleteCascadeAndRollback(db);
  
  console.log("=========================================\n");
  console.log("📊 FINAL TEST RESULTS: \n", JSON.stringify(results, null, 2));
  console.log("🏁 Academic Package Tests Complete.");
  
  // Clean up after tests finish to keep the database tidy
  cleanUpTestPackages(db);

  return results;
}

/**
 * SCENARIO 1: Verifies the creation of a package with polymorphic courses and perks
 */
function executeScenario1_PolymorphicCreation(db) {
  console.log("▶️ SCENARIO 1: Relational Creation with Polymorphic Casing Normalization");
  try {
    // 1. Setup necessary course/subject definitions using TestMockData
    const ctPayload = TestMockData.createMock("CourseType", { segment_name: "Test Segment" });
    delete ctPayload.segment_id; // Let dynamic auto-generation handle segment_id
    const courseType = db.CourseType.insert(ctPayload);

    const c1Payload = TestMockData.createMock("Course", {
      segment_id: courseType.segment_id,
      name: "Polymorphic Biology",
      language_medium: "English",
      base_fee: 5000,
      status: "active"
    });
    delete c1Payload.course_id; // Let dynamic auto-generation handle course_id
    const course1 = db.Course.insert(c1Payload);

    const c2Payload = TestMockData.createMock("Course", {
      segment_id: courseType.segment_id,
      name: "Polymorphic Chemistry",
      language_medium: "English",
      base_fee: 6000,
      status: "active"
    });
    delete c2Payload.course_id;
    const course2 = db.Course.insert(c2Payload);

    const payload = {
      name: "Polymorphic Test Combo",
      description: "Relational creation test bundle",
      package_fee: 10000,
      status: "active",
      courses: [
        { entity_type: "Course", entity_id: course1.course_id },    // 🔄 Uppercase 'C' to verify normalization
        { entity_type: "  subject ", entity_id: course2.course_id } // 🔄 Untrimmed spaces to verify trimming
      ],
      perks: [
        { perk_title: "Free Digital Handbooks", perk_description: "10 PDF files", icon: "book" }
      ]
    };
    
    console.log("   ⚙️ Invoking AcademicService.createPackage with payload...");
    const createdPackage = AcademicService.createPackage(payload);
    
    // Assert Core Table
    if (!createdPackage.package_id) throw new Error("Package ID was not auto-generated.");
    console.log(`   ✅ Success! Created Package record with ID: ${createdPackage.package_id}`);

    // Assert Nested Items & Normalization Checks
    const items = db.PackageItem.where({ package_id: createdPackage.package_id });
    if (items.length !== 2) throw new Error(`Expected 2 PackageItems, found ${items.length}`);
    
    const isNormalized = items.every(item => item.entity_type === "course" || item.entity_type === "subject");
    if (!isNormalized) throw new Error("Casing/whitespace normalization failed in database write.");
    console.log("   ✅ Success! Polymorphic PackageItems correctly normalized and stored.");

    // Assert Nested Perks
    const perks = db.PackagePerk.where({ package_id: createdPackage.package_id });
    if (perks.length !== 1) throw new Error(`Expected 1 PackagePerk, found ${perks.length}`);
    console.log(`   ✅ Success! Created PackagePerk: ${perks[0].perk_title}`);

    return "✅ PASSED";
  } catch (error) {
    console.error("   ❌ Failed:");
    console.error("      Error Name:   ", error.name || "Error");
    console.error("      Error Message:", error.message);
    if (error.context) {
      console.error("      Context:      ", JSON.stringify(error.context));
    }
    return `❌ FAILED: ${error.message}`;
  }
}

/**
 * SCENARIO 2: Verifies package updates and clean rewrite syncs
 */
function executeScenario2_TransactionalUpdate(db) {
  console.log("▶️ SCENARIO 2: Relational Update and Sync Sync Rewrite");
  try {
    const packages = db.Package.where({ name: "Polymorphic Test Combo" });
    if (packages.length === 0) throw new Error("Target test package not found for update.");
    const pkg = packages[0];

    // Find courseType to link new updated course
    const courseTypes = db.CourseType.where({ segment_name: "Test Segment" });
    if (courseTypes.length === 0) throw new Error("CourseType 'Test Segment' not found for update test setup.");
    const courseType = courseTypes[0];

    // Create a new updated course so we use a valid ID
    const c3Payload = TestMockData.createMock("Course", {
      segment_id: courseType.segment_id,
      name: "Polymorphic Updated Physics",
      language_medium: "English",
      base_fee: 8000,
      status: "active"
    });
    delete c3Payload.course_id;
    const course3 = db.Course.insert(c3Payload);

    const updatePayload = {
      package_id: pkg.package_id,
      name: "Polymorphic Test Combo - V2",
      package_fee: 12000,
      courses: [
        { entity_type: "course", entity_id: course3.course_id } // Clean rewrite should swap out old items
      ],
      perks: [
        { perk_title: "Mock Test Access V2", icon: "laptop" },
        { perk_title: "1-on-1 Mentoring", icon: "user" }
      ]
    };

    console.log("   ⚙️ Invoking AcademicService.updatePackage with sync updates...");
    const result = AcademicService.updatePackage(updatePayload);
    if (!result.success) throw new Error("updatePackage did not return success status.");

    // Assert Core Updated
    const updatedPkg = db.Package.findById(pkg.package_id);
    if (updatedPkg.package_fee !== 12000) throw new Error(`Expected package_fee to be 12000, got ${updatedPkg.package_fee}`);
    console.log("   ✅ Success! Package fee updated on core table.");

    // Assert Courses Clean Rewrite
    const updatedItems = db.PackageItem.where({ package_id: pkg.package_id });
    if (updatedItems.length !== 1 || updatedItems[0].entity_id !== course3.course_id) {
      throw new Error("PackageItem clean rewrite failed to synchronize new courses.");
    }
    console.log("   ✅ Success! Polymorphic course items synchronized cleanly.");

    // Assert Perks Clean Rewrite
    const updatedPerks = db.PackagePerk.where({ package_id: pkg.package_id });
    if (updatedPerks.length !== 2) throw new Error(`Expected 2 PackagePerks, found ${updatedPerks.length}`);
    console.log("   ✅ Success! Package perks synchronized cleanly.");

    return "✅ PASSED";
  } catch (error) {
    console.error("   ❌ Failed:");
    console.error("      Error Message:", error.message);
    return `❌ FAILED: ${error.message}`;
  }
}

/**
 * SCENARIO 3: Verifies transaction rollback when downstream writes fail
 */
function executeScenario3_RollbackValidation(db) {
  console.log("▶️ SCENARIO 3: Dynamic Transaction Rollback and Recovery");
  try {
    const packages = db.Package.where({ name: "Polymorphic Test Combo - V2" });
    if (packages.length === 0) throw new Error("Target test package not found for rollback test.");
    const pkg = packages[0];

    // Capture states before fail-inducing update
    const itemsBefore = db.PackageItem.where({ package_id: pkg.package_id });
    const perksBefore = db.PackagePerk.where({ package_id: pkg.package_id });

    // Payload designed to fail on polymorphic choices constraint in SheetDB
    const badPayload = {
      package_id: pkg.package_id,
      name: "Failed Rollback Attempt",
      package_fee: 99999, // Should NOT be persisted
      courses: [
        { entity_type: "UNSUPPORTED_TYPE_ENUM", entity_id: "CRS-FAIL" } // 🚨 Will cause SheetDB constraint failure
      ],
      perks: [
        { perk_title: "Should Not Exist Perk" }
      ]
    };

    console.log("   ⚙️ Invoking AcademicService.updatePackage with invalid input designed to fail...");
    let caughtExpectedError = false;
    try {
      AcademicService.updatePackage(badPayload);
    } catch (e) {
      caughtExpectedError = true;
      console.log(`   ✅ Caught expected database write constraint error: ${e.message}`);
    }

    if (!caughtExpectedError) throw new Error("Orchestration failed to throw validation error.");

    // Verify Rollback on Main Package
    const rolledBackPkg = db.Package.findById(pkg.package_id);
    if (rolledBackPkg.package_fee === 99999 || rolledBackPkg.name === "Failed Rollback Attempt") {
      throw new Error("Rollback failed! Core Package modifications were persisted.");
    }
    console.log("   ✅ Success! Core Package attributes rolled back cleanly.");

    // Verify Rollback on Package Items
    const itemsAfter = db.PackageItem.where({ package_id: pkg.package_id });
    if (itemsAfter.length !== itemsBefore.length || itemsAfter[0].entity_id !== itemsBefore[0].entity_id) {
      throw new Error("Rollback failed! Polymorphic items were not restored to original backup state.");
    }
    console.log("   ✅ Success! PackageItems successfully restored to original backup state.");

    // Verify Rollback on Perks
    const perksAfter = db.PackagePerk.where({ package_id: pkg.package_id });
    if (perksAfter.length !== perksBefore.length) {
      throw new Error("Rollback failed! Perks were not restored to original backup state.");
    }
    console.log("   ✅ Success! Perks successfully restored to original backup state.");

    return "✅ PASSED";
  } catch (error) {
    console.error("   ❌ Failed:");
    console.error("      Error Message:", error.message);
    return `❌ FAILED: ${error.message}`;
  }
}

/**
 * SCENARIO 4: Verifies RESTRICT constraint blocks package deletion if student enrollments exist
 */
function executeScenario4_DeleteRestrictConstraint(db) {
  console.log("▶️ SCENARIO 4: Referential Integrity (RESTRICT) Deletion Constraint");
  let student = null;
  let enrollment = null;
  let pkg = null;
  try {
    const packages = db.Package.where({ name: "Polymorphic Test Combo - V2" });
    if (packages.length === 0) throw new Error("Target test package not found for restrict test.");
    pkg = packages[0];

    // 1. Create a test student
    const studentPayload = TestMockData.createMock("Student", { email: "restrict_student@test.com" });
    delete studentPayload.student_id;
    student = db.Student.insert(studentPayload);

    // 2. Enroll student in the package
    const enrollmentPayload = {
      student_id: student.student_id,
      enrollment_type: "package",
      item_id: pkg.package_id,
      status: "active"
    };
    enrollment = db.Enrollment.insert(enrollmentPayload);

    console.log("   ⚙️ Attempting to delete package that has active student enrollment...");
    let caughtExpectedError = false;
    try {
      AcademicService.deletePackage(pkg.package_id);
    } catch (e) {
      caughtExpectedError = true;
      console.log(`   ✅ Caught expected restrict violation: ${e.message}`);
    }

    if (!caughtExpectedError) throw new Error("RESTRICT constraint failed to block package deletion.");

    // Assert package still exists in database
    if (!db.Package.findById(pkg.package_id)) {
      throw new Error("Database integrity violated: Package was deleted despite active enrollments.");
    }
    console.log("   ✅ Success! Package deletion blocked, maintaining referential integrity.");

    return "✅ PASSED";
  } catch (error) {
    console.error("   ❌ Failed:");
    console.error("      Error Message:", error.message);
    return `❌ FAILED: ${error.message}`;
  } finally {
    // Clean up enrollment & student
    if (enrollment) db.Enrollment.remove(enrollment.enrollment_id);
    if (student) db.Student.remove(student.student_id);
  }
}

/**
 * SCENARIO 5: Verifies CASCADE deletion of perks/items and transaction rollback on failure
 */
function executeScenario5_DeleteCascadeAndRollback(db) {
  console.log("▶️ SCENARIO 5: Cascade Deletion and Transactional Rollback Recovery");
  try {
    const packages = db.Package.where({ name: "Polymorphic Test Combo - V2" });
    if (packages.length === 0) throw new Error("Target test package not found for cascade delete.");
    const pkg = packages[0];

    // 1. Verify rollback of deletion using a temporary package
    const rollbackPkg = AcademicService.createPackage({
      name: "Failed Rollback Delete Pkg",
      package_fee: 7000,
      status: "active",
      perks: [{ perk_title: "Perk to restore" }],
      courses: []
    });

    // Mock Package.remove to throw an error for rollbackPkg
    const originalRemove = db.Package.remove;
    db.Package.remove = function(id) {
      if (id === rollbackPkg.package_id) {
        throw new Error("Simulated Database Error during Core Package Deletion!");
      }
      return originalRemove.call(db.Package, id);
    };

    console.log("   ⚙️ Attempting package deletion with simulated failure (forcing rollback)...");
    let caughtExpectedError = false;
    try {
      AcademicService.deletePackage(rollbackPkg.package_id);
    } catch (e) {
      caughtExpectedError = true;
      console.log(`   ✅ Caught expected deletion error: ${e.message}`);
    } finally {
      // Restore original function
      db.Package.remove = originalRemove;
    }

    if (!caughtExpectedError) throw new Error("Deletion failed to raise simulated error.");

    // Assert rollback succeeded and restored perks
    const restoredPkg = db.Package.findById(rollbackPkg.package_id);
    if (!restoredPkg) throw new Error("Rollback failed! Package was deleted.");
    
    const restoredPerks = db.PackagePerk.where({ package_id: rollbackPkg.package_id });
    if (restoredPerks.length !== 1) throw new Error("Rollback failed! Perks were not restored.");
    console.log("   ✅ Success! All deleted records transactionally restored to original state.");

    // Clean up the rollbackPkg
    db.PackagePerk.remove(restoredPerks[0].perk_id);
    db.Package.remove(rollbackPkg.package_id);

    // 2. Perform actual happy-path CASCADE delete on Polymorphic Test Combo - V2
    console.log(`   ⚙️ Deleting package '${pkg.package_id}' (Happy Path Cascade)...`);
    const deleteResult = AcademicService.deletePackage(pkg.package_id);
    if (!deleteResult.success) throw new Error("deletePackage reported failure status.");

    // Assert Package is gone
    if (db.Package.findById(pkg.package_id)) {
      throw new Error("Package record still exists in DB.");
    }
    // Assert Perks are gone
    if (db.PackagePerk.where({ package_id: pkg.package_id }).length > 0) {
      throw new Error("Associated Perks were not cascade deleted.");
    }
    // Assert Items are gone
    if (db.PackageItem.where({ package_id: pkg.package_id }).length > 0) {
      throw new Error("Associated PackageItems were not cascade deleted.");
    }
    console.log("   ✅ Success! Cascade deletion cleaned up all associated rows.");

    return "✅ PASSED";
  } catch (error) {
    console.error("   ❌ Failed:");
    console.error("      Error Message:", error.message);
    return `❌ FAILED: ${error.message}`;
  }
}

/**
 * UTILITY: Cleans up any test courses, course types, packages, items, and perks
 */
function cleanUpTestPackages(db) {
  try {
    // 1. Delete test packages
    const testPkgs = db.Package.where({ name: "Polymorphic Test Combo" })
      .concat(db.Package.where({ name: "Polymorphic Test Combo - V2" }))
      .concat(db.Package.where({ name: "Failed Rollback Attempt" }))
      .concat(db.Package.where({ name: "Failed Rollback Delete Pkg" }))
      .concat(db.Package.where({ name: "Rollback Delete Pkg" }))
      .concat(db.Package.where({ name: "Temp Package for Delete" }));

    testPkgs.forEach(pkg => {
      // Delete child relations
      const items = db.PackageItem.where({ package_id: pkg.package_id });
      items.forEach(i => db.PackageItem.remove(i.item_id));

      const perks = db.PackagePerk.where({ package_id: pkg.package_id });
      perks.forEach(p => db.PackagePerk.remove(p.perk_id));

      // Delete core package
      db.Package.remove(pkg.package_id);
    });

    // 2. Delete test courses and segments
    const courseTypes = db.CourseType.where({ segment_name: "Test Segment" });
    courseTypes.forEach(ct => {
      const courses = db.Course.where({ segment_id: ct.segment_id });
      courses.forEach(c => db.Course.remove(c.course_id));
      db.CourseType.remove(ct.segment_id);
    });

    // 3. Delete test students and their enrollments
    const testStudents = db.Student.where({ email: "restrict_student@test.com" });
    testStudents.forEach(s => {
      const enrs = db.Enrollment.where({ student_id: s.student_id });
      enrs.forEach(e => db.Enrollment.remove(e.enrollment_id));
      db.Student.remove(s.student_id);
    });
  } catch (e) {
    console.warn("Cleanup warning: ", e.message);
  }
}
