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

  console.log("\n=========================================");
  results.Scenario6 = executeScenario6_OnDemandAndPresets(db);

  console.log("\n=========================================");
  results.Scenario7 = executeScenario7_OnDemandRollback(db);

  console.log("\n=========================================");
  results.Scenario8 = executeScenario8_OnErrorCodes(db);
  
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
    
    const mockContext = {
      actionType: "CREATE",
      mutationManifest: []
    };

    console.log("   ⚙️ Invoking AcademicService.createPackage with payload...");
    const createdPackage = AcademicService.createPackage(payload, mockContext);
    
    // Assert Core Table
    if (!createdPackage.package_id) throw new Error("Package ID was not auto-generated.");
    console.log(`   ✅ Success! Created Package record with ID: ${createdPackage.package_id}`);

    // Assert mutation tracking
    const expected = ["Package", "PackagePerk", "PackageItem"];
    const verified = expected.every(m => mockContext.mutationManifest.includes(m));
    if (!verified) {
      throw new Error(`Mutation tracking failed. Expected mutations: ${JSON.stringify(expected)}. Got: ${JSON.stringify(mockContext.mutationManifest)}`);
    }
    console.log("   ✅ Success! Mutation manifest contains Package, PackagePerk, and PackageItem.");

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

    const mockContext = {
      actionType: "UPDATE",
      mutationManifest: []
    };

    console.log("   ⚙️ Invoking AcademicService.updatePackage with sync updates...");
    const result = AcademicService.updatePackage(updatePayload, mockContext);
    if (!result.success) throw new Error("updatePackage did not return success status.");

    // Assert mutation tracking
    const expected = ["Package", "PackageItem", "PackagePerk"];
    const verified = expected.every(m => mockContext.mutationManifest.includes(m));
    if (!verified) {
      throw new Error(`Mutation tracking failed. Expected mutations: ${JSON.stringify(expected)}. Got: ${JSON.stringify(mockContext.mutationManifest)}`);
    }
    console.log("   ✅ Success! Mutation manifest contains Package, PackageItem, and PackagePerk.");

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

    const mockContext = {
      actionType: "UPDATE",
      mutationManifest: []
    };

    console.log("   ⚙️ Invoking AcademicService.updatePackage with invalid input designed to fail...");
    let caughtExpectedError = false;
    try {
      AcademicService.updatePackage(badPayload, mockContext);
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

    const mockContext = {
      actionType: "DELETE",
      mutationManifest: []
    };

    console.log("   ⚙️ Attempting to delete package that has active student enrollment...");
    let caughtExpectedError = false;
    try {
      AcademicService.deletePackage(pkg.package_id, mockContext);
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

    const mockContextRollback = {
      actionType: "CREATE",
      mutationManifest: []
    };

    // 1. Verify rollback of deletion using a temporary package
    const rollbackPkg = AcademicService.createPackage({
      name: "Failed Rollback Delete Pkg",
      package_fee: 7000,
      status: "active",
      perks: [{ perk_title: "Perk to restore" }],
      courses: []
    }, mockContextRollback);

    // Mock Package.remove to throw an error for rollbackPkg
    const originalRemove = db.Package.remove;
    db.Package.remove = function(id) {
      if (id === rollbackPkg.package_id) {
        throw new Error("Simulated Database Error during Core Package Deletion!");
      }
      return originalRemove.call(db.Package, id);
    };

    const mockContextDeleteRollback = {
      actionType: "DELETE",
      mutationManifest: []
    };

    console.log("   ⚙️ Attempting package deletion with simulated failure (forcing rollback)...");
    let caughtExpectedError = false;
    try {
      AcademicService.deletePackage(rollbackPkg.package_id, mockContextDeleteRollback);
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
    
    const mockContextCascadeDelete = {
      actionType: "DELETE",
      mutationManifest: []
    };

    const deleteResult = AcademicService.deletePackage(pkg.package_id, mockContextCascadeDelete);
    if (!deleteResult.success) throw new Error("deletePackage reported failure status.");

    // Assert mutation tracking
    const expected = ["PackageItem", "PackagePerk", "Package"];
    const verified = expected.every(m => mockContextCascadeDelete.mutationManifest.includes(m));
    if (!verified) {
      throw new Error(`Mutation tracking failed. Expected mutations: ${JSON.stringify(expected)}. Got: ${JSON.stringify(mockContextCascadeDelete.mutationManifest)}`);
    }
    console.log("   ✅ Success! Cascade deletion tracked all mutations.");

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
 * SCENARIO 6: Streamlined Quick Package with On-Demand Courses and Auto Perks Preset
 */
function executeScenario6_OnDemandAndPresets(db) {
  console.log("▶️ SCENARIO 6: Streamlined Quick Package with On-Demand Courses and Auto Perks Preset");
  try {
    const ctPayload = TestMockData.createMock("CourseType", { segment_name: "Test Segment" });
    delete ctPayload.segment_id;
    const courseType = db.CourseType.findOne({ segment_name: "Test Segment" }) || db.CourseType.insert(ctPayload);

    const c1Payload = TestMockData.createMock("Course", {
      segment_id: courseType.segment_id,
      name: "On-Demand Existing Physics",
      language_medium: "English",
      base_fee: 5000,
      status: "active"
    });
    delete c1Payload.course_id;
    const course1 = db.Course.insert(c1Payload);

    const payload = {
      name: "On-Demand Presets Package",
      description: "Quick package creation test",
      package_fee: 12000,
      target_class: "Class 10",
      status: "active",
      courses: [
        { entity_type: "course", entity_id: course1.course_id },
        {
          entity_type: "course",
          on_demand: true,
          name: "On-Demand Course 1",
          short_code: "C-ON-DEMAND-1",
          language_medium: "English",
          duration_value: 12,
          duration_unit: "months",
          base_fee: 7000,
          segment_id: courseType.segment_id,
          status: "active"
        }
      ]
    };

    const mockContext = {
      actionType: "CREATE",
      mutationManifest: []
    };

    console.log("   ⚙️ Invoking AcademicService.createPackage with mixed courses and auto-preset perks...");
    const createdPackage = AcademicService.createPackage(payload, mockContext);

    if (!createdPackage.package_id) throw new Error("Package ID was not auto-generated.");
    console.log(`   ✅ Success! Created Package record with ID: ${createdPackage.package_id}`);

    // Verify mutations
    const expected = ["Package", "PackagePerk", "Course", "PackageItem"];
    const verified = expected.every(m => mockContext.mutationManifest.includes(m));
    if (!verified) {
      throw new Error(`Mutation tracking failed. Expected mutations: ${JSON.stringify(expected)}. Got: ${JSON.stringify(mockContext.mutationManifest)}`);
    }
    console.log("   ✅ Success! All mutations (Package, PackagePerk, Course, PackageItem) tracked correctly.");

    const newCourse = db.Course.findOne({ short_code: "C-ON-DEMAND-1" });
    if (!newCourse) throw new Error("On-demand course 'On-Demand Course 1' was not inserted in Course table.");
    console.log(`   ✅ Success! Created on-demand course with ID: ${newCourse.course_id}`);

    const items = db.PackageItem.where({ package_id: createdPackage.package_id });
    if (items.length !== 2) throw new Error(`Expected 2 PackageItems, found ${items.length}`);
    
    const linkedIds = items.map(i => i.entity_id);
    if (!linkedIds.includes(course1.course_id) || !linkedIds.includes(newCourse.course_id)) {
      throw new Error("PackageItems do not map both existing and on-demand course IDs correctly.");
    }
    console.log("   ✅ Success! Linked both courses in PackageItems.");

    const perks = db.PackagePerk.where({ package_id: createdPackage.package_id });
    if (perks.length !== 5) throw new Error(`Expected 5 auto-populated perks, found ${perks.length}`);
    console.log("   ✅ Success! Auto-populated 5 Standard Perks based on class target.");

    return "✅ PASSED";
  } catch (error) {
    console.error("   ❌ Failed:");
    console.error("      Error Message:", error.message);
    return `❌ FAILED: ${error.message}`;
  }
}

/**
 * SCENARIO 7: Transaction Rollback Recovery of On-Demand Course Deletion
 */
function executeScenario7_OnDemandRollback(db) {
  console.log("▶️ SCENARIO 7: On-Demand Course Transaction Rollback Recovery");
  try {
    const courseType = db.CourseType.findOne({ segment_name: "Test Segment" });
    if (!courseType) throw new Error("Test CourseType segment not found.");

    const badPayload = {
      name: "On-Demand Rollback Package",
      package_fee: 99999,
      target_class: "Class 12",
      courses: [
        {
          entity_type: "course",
          on_demand: true,
          name: "On-Demand Course 2",
          short_code: "C-ON-DEMAND-2",
          language_medium: "English",
          duration_value: 12,
          duration_unit: "months",
          base_fee: 8000,
          segment_id: courseType.segment_id,
          status: "active"
        },
        { entity_type: "INVALID_POLYMORPHIC_TYPE", entity_id: "CRS-FAIL" }
      ]
    };

    const mockContext = {
      actionType: "CREATE",
      mutationManifest: []
    };

    console.log("   ⚙️ Invoking AcademicService.createPackage designed to fail...");
    let caughtExpectedError = false;
    try {
      AcademicService.createPackage(badPayload, mockContext);
    } catch (e) {
      caughtExpectedError = true;
      console.log(`   ✅ Caught expected validation error: ${e.message}`);
    }

    if (!caughtExpectedError) throw new Error("Package creation did not raise validation error.");

    const rolledBackCourse = db.Course.findOne({ short_code: "C-ON-DEMAND-2" });
    if (rolledBackCourse) {
      throw new Error("Rollback failed! The on-demand course was persisted in the Course table.");
    }
    console.log("   ✅ Success! Newly created on-demand course rolled back and deleted successfully.");

    const rolledBackPkg = db.Package.findOne({ name: "On-Demand Rollback Package" });
    if (rolledBackPkg) {
      throw new Error("Rollback failed! The package was persisted.");
    }
    console.log("   ✅ Success! Core package rolled back and deleted successfully.");

    return "✅ PASSED";
  } catch (error) {
    console.error("   ❌ Failed:");
    console.error("      Error Message:", error.message);
    return `❌ FAILED: ${error.message}`;
  }
}

/**
 * SCENARIO 8: Error Codes Verification in Response Envelope
 */
function executeScenario8_OnErrorCodes(db) {
  console.log("▶️ SCENARIO 8: API Error Codes Mapping Verification");
  try {
    const courseType = db.CourseType.findOne({ segment_name: "Test Segment" });
    if (!courseType) throw new Error("Test CourseType segment not found.");

    const tempCourse = db.Course.insert({
      segment_id: courseType.segment_id,
      name: "Temp Duplicate Course",
      short_code: "C-ON-DEMAND-DUP",
      language_medium: "English",
      base_fee: 5000,
      status: "active"
    });

    const payload = {
      name: "On-Demand Error Codes Package",
      package_fee: 10000,
      target_class: "Class 9",
      courses: [
        {
          entity_type: "course",
          on_demand: true,
          name: "Duplicate Course Name",
          short_code: "C-ON-DEMAND-DUP",
          language_medium: "English",
          base_fee: 5000,
          segment_id: courseType.segment_id
        }
      ]
    };

    const mockContext1 = {
      actionType: "CREATE",
      mutationManifest: []
    };

    console.log("   ⚙️ Invoking createPackage to verify DUPLICATE_SHORT_CODE errorCode...");
    let caughtDuplicateError = false;
    try {
      AcademicService.createPackage(payload, mockContext1);
    } catch (e) {
      caughtDuplicateError = true;
      if (e.errorCode !== "DUPLICATE_SHORT_CODE") {
        throw new Error(`Expected errorCode 'DUPLICATE_SHORT_CODE', got '${e.errorCode}'`);
      }
      console.log(`   ✅ Success! Verified errorCode '${e.errorCode}': ${e.message}`);
    }

    if (!caughtDuplicateError) throw new Error("Duplicate short code did not raise error.");

    db.Course.remove(tempCourse.course_id);

    const invalidRefPayload = {
      name: "Invalid Ref Package",
      package_fee: 10000,
      target_class: "Class 9",
      courses: [
        { entity_type: "course", entity_id: "CRS-NONEXISTENT" }
      ]
    };

    const mockContext2 = {
      actionType: "CREATE",
      mutationManifest: []
    };

    console.log("   ⚙️ Invoking createPackage to verify REFERENCED_COURSE_NOT_FOUND errorCode...");
    let caughtRefError = false;
    try {
      AcademicService.createPackage(invalidRefPayload, mockContext2);
    } catch (e) {
      caughtRefError = true;
      if (e.errorCode !== "REFERENCED_COURSE_NOT_FOUND") {
        throw new Error(`Expected errorCode 'REFERENCED_COURSE_NOT_FOUND', got '${e.errorCode}'`);
      }
      console.log(`   ✅ Success! Verified errorCode '${e.errorCode}': ${e.message}`);
    }

    if (!caughtRefError) throw new Error("Invalid course reference did not raise error.");

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
      .concat(db.Package.where({ name: "Temp Package for Delete" }))
      .concat(db.Package.where({ name: "On-Demand Presets Package" }))
      .concat(db.Package.where({ name: "On-Demand Rollback Package" }))
      .concat(db.Package.where({ name: "On-Demand Error Codes Package" }))
      .concat(db.Package.where({ name: "Invalid Ref Package" }));

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
