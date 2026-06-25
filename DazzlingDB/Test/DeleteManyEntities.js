/**
 * @file DeleteManyEntities.js
 * Consolidated Integration & Validation tests for bulk deletion actions:
 * - DeleteManyCourseTypeAction
 * - DeleteManyCoursesAction
 * - DeleteManyPackagesAction
 *
 * Follows DazzlingDB & SheetDB Testing Governance Rules.
 */

function runDeleteManyEntitiesTests() {
  const activeEnv = typeof SYSTEM_ENV !== 'undefined' ? SYSTEM_ENV : 'development';
  if (resolveEnvironmentType(activeEnv) === Environment.PRODUCTION) {
    throw new Error("❌ Safety Guard: Test suite cannot be executed in the PRODUCTION environment.");
  }

  console.log("🚀 Starting Bulk Entities Deletion Integration Tests...");
  const results = {};
  const timings = {};
  const t0 = Date.now();

  // Save original onDelete schema values for restoration
  let originalPackagePerkOnDelete = null;
  let originalPackageItemOnDelete = null;

  try {
    if (
      DATABASE_SCHEMA &&
      DATABASE_SCHEMA.categories &&
      DATABASE_SCHEMA.categories.Academic &&
      DATABASE_SCHEMA.categories.Academic.tables
    ) {
      if (DATABASE_SCHEMA.categories.Academic.tables.PackagePerk && DATABASE_SCHEMA.categories.Academic.tables.PackagePerk.columns.package_id) {
        originalPackagePerkOnDelete = DATABASE_SCHEMA.categories.Academic.tables.PackagePerk.columns.package_id.onDelete;
        DATABASE_SCHEMA.categories.Academic.tables.PackagePerk.columns.package_id.onDelete = "cascade";
      }
      if (DATABASE_SCHEMA.categories.Academic.tables.PackageItem && DATABASE_SCHEMA.categories.Academic.tables.PackageItem.columns.package_id) {
        originalPackageItemOnDelete = DATABASE_SCHEMA.categories.Academic.tables.PackageItem.columns.package_id.onDelete;
        DATABASE_SCHEMA.categories.Academic.tables.PackageItem.columns.package_id.onDelete = "cascade";
      }
    }
  } catch (schemaErr) {
    console.warn("⚠️ Warning: Failed to patch DATABASE_SCHEMA in-memory:", schemaErr.message);
  }

  // Step 1: Testing Environment Sandboxing
  let tStart = Date.now();
  PropertiesService.getScriptProperties().setProperty('ENV', 'TESTING');
  DBContext.getInstance().bootstrapRepositories();
  const db = DBContext.getInstance();
  db.setup.provision(); // Provision sandbox schemas
  timings["Step 1: Testing Environment Sandboxing"] = Date.now() - tStart;

  const salt = Math.random().toString(36).substring(2, 9).toUpperCase();

  try {
    // --- RUN TEST SUITES ---
    // You can comment out individual test suites to ignore them if they have already passed.
    testDeleteManyCourseType(db, results, timings, salt);
    testDeleteManyCourses(db, results, timings, salt);
    testDeleteManyPackages(db, results, timings, salt);
    testFailureResponseViolations(db, results, timings, salt);
  } catch (globalErr) {
    console.error("❌ Global test execution error:", globalErr.message);
  } finally {
    // Teardown Environment & Patch Restoration
    try {
      if (
        DATABASE_SCHEMA &&
        DATABASE_SCHEMA.categories &&
        DATABASE_SCHEMA.categories.Academic &&
        DATABASE_SCHEMA.categories.Academic.tables
      ) {
        if (originalPackagePerkOnDelete !== null && DATABASE_SCHEMA.categories.Academic.tables.PackagePerk.columns.package_id) {
          DATABASE_SCHEMA.categories.Academic.tables.PackagePerk.columns.package_id.onDelete = originalPackagePerkOnDelete;
        }
        if (originalPackageItemOnDelete !== null && DATABASE_SCHEMA.categories.Academic.tables.PackageItem.columns.package_id) {
          DATABASE_SCHEMA.categories.Academic.tables.PackageItem.columns.package_id.onDelete = originalPackageItemOnDelete;
        }
      }
    } catch (schemaRestoreErr) {
      console.warn("⚠️ Warning: Failed to restore DATABASE_SCHEMA onDelete constraints:", schemaRestoreErr.message);
    }

    PropertiesService.getScriptProperties().setProperty('ENV', 'DEVELOPMENT');
    DBContext.getInstance().bootstrapRepositories();
    console.log(`   [INFO] Restored ENV back to 'DEVELOPMENT'`);

    const totalTime = Date.now() - t0;
    console.log("\n========================================================");
    console.log("⏱️  BULK DELETIONS TIMING SUMMARY  ⏱️");
    console.log("========================================================");
    for (const step in timings) {
      console.log(`- ${step.padEnd(45)}: ${String(timings[step]).padStart(5)} ms`);
    }
    console.log("--------------------------------------------------------");
    console.log(`- Total Execution Time                         : ${String(totalTime).padStart(5)} ms`);
    console.log("========================================================\n");

    console.log("📊 FINAL TEST RESULTS:\n", JSON.stringify(results, null, 2));
  }

  return results;
}

/**
 * Helper to dispatch action directly
 * @private
 */
function _runAction(ActionClass, db, payload) {
  const action = new ActionClass();
  return action.run({ params: { payload }, user: { role: "admin", user_id: "ACTOR_TEST" }, db });
}

// ----------------------------------------------------
// TEST CASE 1: DeleteManyCourseTypeAction
// ----------------------------------------------------
function testDeleteManyCourseType(db, results, timings, salt) {
  let ctCleanId = null;
  let ctBlockedId = null;
  let ctCourseId = null;

  try {
    console.log("👉 Testing DeleteManyCourseTypeAction...");
    let tStart = Date.now();

    // Clean CourseType
    const ctClean = db.CourseType.insert(TestMockHelper.createCourseTypePayload({
      segment_name: "Clean Segment " + salt,
      entity_label: "Clean CT " + salt
    }));
    ctCleanId = ctClean.segment_id;

    // Blocked CourseType
    const ctBlocked = db.CourseType.insert(TestMockHelper.createCourseTypePayload({
      segment_name: "Blocked Segment " + salt,
      entity_label: "Blocked CT " + salt
    }));
    ctBlockedId = ctBlocked.segment_id;

    // Course referencing Blocked CourseType (protect constraint)
    const mockCourse = db.Course.insert(TestMockHelper.createCoursePayload(ctBlockedId, {
      name: "Mock Course for CT " + salt
    }));
    ctCourseId = mockCourse.course_id;
    timings["CT: Seed Data Generation"] = Date.now() - tStart;

    // Dry Run validation
    tStart = Date.now();
    const dryRunRes = _runAction(DeleteManyCourseTypeAction, db, {
      ids: [ctCleanId, ctBlockedId],
      dryRun: true
    });
    timings["CT: Dry Run Validation"] = Date.now() - tStart;

    if (!dryRunRes.success) throw new Error("CourseType dry run response reported overall failure.");
    const ctManifest = dryRunRes.data.manifest;

    if (!ctManifest.deleted.includes(ctCleanId)) throw new Error("Clean CourseType was not marked deleted in dryRun manifest.");
    if (ctManifest.deleted.includes(ctBlockedId)) throw new Error("Blocked CourseType was incorrectly marked deleted in dryRun manifest.");
    if (!ctManifest.failed[ctBlockedId]) throw new Error("Blocked CourseType was not present in manifest.failed.");

    results["CourseType.1.DryRunIsolation"] = "✅ PASSED";

    // Live Relational Block Validation
    const liveBlockRes = _runAction(DeleteManyCourseTypeAction, db, {
      ids: [ctBlockedId],
      dryRun: false
    });
    if (liveBlockRes.success) {
      throw new Error("Action did not block deleting CourseType with active courses.");
    }
    results["CourseType.2.LiveBlockConstraint"] = "✅ PASSED";

    // Live Clean Deletion
    const liveCleanRes = _runAction(DeleteManyCourseTypeAction, db, {
      ids: [ctCleanId],
      dryRun: false
    });
    if (!liveCleanRes.success || liveCleanRes.data.deletedCount !== 1) {
      throw new Error("Live delete on clean CourseType failed: " + JSON.stringify(liveCleanRes));
    }
    if (db.CourseType.findById(ctCleanId) !== null) {
      throw new Error("Clean CourseType was not physically deleted from the database.");
    }
    results["CourseType.3.LiveDeleteSuccess"] = "✅ PASSED";

  } catch (e) {
    console.error("❌ CourseType Test Failure:", e.message);
    results["CourseType.Overall"] = "❌ FAILED: " + e.message;
  } finally {
    // Reverse-topological seed cleanup
    try {
      if (ctCourseId) db.Course.remove(ctCourseId);
      if (ctBlockedId) db.CourseType.remove(ctBlockedId);
      if (ctCleanId) db.CourseType.remove(ctCleanId);
    } catch (cleanupErr) {
      console.warn("⚠️ Warning: Cleanup issues during CourseType teardown:", cleanupErr.message);
    }
  }
}

// ----------------------------------------------------
// TEST CASE 2: DeleteManyCoursesAction
// ----------------------------------------------------
function testDeleteManyCourses(db, results, timings, salt) {
  let cCleanId = null;
  let cBlockedId = null;
  let cBatchId = null;
  let ctForCourseId = null;

  try {
    console.log("👉 Testing DeleteManyCoursesAction...");
    let tStart = Date.now();

    // Fresh segment for Course tests so we don't depend on Segment deleted in Test Case 1
    const ctForCourse = db.CourseType.insert(TestMockHelper.createCourseTypePayload({
      segment_name: "Course Segment " + salt,
      entity_label: "Course CT " + salt
    }));
    ctForCourseId = ctForCourse.segment_id;

    // Clean Course (requires CourseType segment ID)
    const cClean = db.Course.insert(TestMockHelper.createCoursePayload(ctForCourseId, {
      name: "Clean Course " + salt
    }));
    cCleanId = cClean.course_id;

    // Blocked Course
    const cBlocked = db.Course.insert(TestMockHelper.createCoursePayload(ctForCourseId, {
      name: "Blocked Course " + salt
    }));
    cBlockedId = cBlocked.course_id;

    // Batch referencing Blocked Course (protect constraint)
    const mockBatch = db.Batch.insert(TestMockHelper.createBatchPayload(cBlockedId, "TCH-MOCK-1", "BRN-MOCK-1", {
      batch_name: "Mock Batch " + salt
    }));
    cBatchId = mockBatch.batch_id;
    timings["Course: Seed Data Generation"] = Date.now() - tStart;

    // Dry Run validation
    tStart = Date.now();
    const dryRunRes = _runAction(DeleteManyCoursesAction, db, {
      ids: [cCleanId, cBlockedId],
      dryRun: true
    });
    timings["Course: Dry Run Validation"] = Date.now() - tStart;

    if (!dryRunRes.success) throw new Error("Course dry run response reported overall failure.");
    const cManifest = dryRunRes.data.manifest;

    if (!cManifest.deleted.includes(cCleanId)) throw new Error("Clean Course was not marked deleted in dryRun manifest.");
    if (cManifest.deleted.includes(cBlockedId)) throw new Error("Blocked Course was incorrectly marked deleted in dryRun manifest.");
    if (!cManifest.failed[cBlockedId]) throw new Error("Blocked Course was not present in manifest.failed.");

    results["Course.1.DryRunIsolation"] = "✅ PASSED";

    // Live Relational Block Validation
    const liveBlockRes = _runAction(DeleteManyCoursesAction, db, {
      ids: [cBlockedId],
      dryRun: false
    });
    if (liveBlockRes.success) {
      throw new Error("Action did not block deleting Course with active batches.");
    }
    results["Course.2.LiveBlockConstraint"] = "✅ PASSED";

    // Live Clean Deletion
    const liveCleanRes = _runAction(DeleteManyCoursesAction, db, {
      ids: [cCleanId],
      dryRun: false
    });
    if (!liveCleanRes.success || liveCleanRes.data.deletedCount !== 1) {
      throw new Error("Live delete on clean Course failed: " + JSON.stringify(liveCleanRes));
    }
    if (db.Course.findById(cCleanId) !== null) {
      throw new Error("Clean Course was not physically deleted from the database.");
    }
    results["Course.3.LiveDeleteSuccess"] = "✅ PASSED";

  } catch (e) {
    console.error("❌ Course Test Failure:", e.message);
    results["Course.Overall"] = "❌ FAILED: " + e.message;
  } finally {
    try {
      if (cBatchId) db.Batch.remove(cBatchId);
      if (cBlockedId) db.Course.remove(cBlockedId);
      if (cCleanId) db.Course.remove(cCleanId);
      if (ctForCourseId) db.CourseType.remove(ctForCourseId);
    } catch (cleanupErr) {
      console.warn("⚠️ Warning: Cleanup issues during Course teardown:", cleanupErr.message);
    }
  }
}

// ----------------------------------------------------
// TEST CASE 3: DeleteManyPackagesAction
// ----------------------------------------------------
function testDeleteManyPackages(db, results, timings, salt) {
  let pCleanId = null;
  let pBlockedId = null;
  let pEnrollmentId = null;
  let perk1Id = null;
  let item1Id = null;
  let item2Id = null;
  let item3Id = null;
  let pkgCrs1Id = null;
  let pkgCrs2Id = null;
  let pkgCrs3Id = null;
  let ctForPackageId = null;
  let seededStudentId = null;

  try {
    console.log("👉 Testing DeleteManyPackagesAction...");
    let tStart = Date.now();

    // Fresh CourseType segment for Package tests
    const ctForPackage = db.CourseType.insert(TestMockHelper.createCourseTypePayload({
      segment_name: "Package Segment " + salt,
      entity_label: "Package CT " + salt
    }));
    ctForPackageId = ctForPackage.segment_id;

    // Clean Package
    const pClean = db.Package.insert(TestMockHelper.createPackagePayload([], {
      name: "Clean Package " + salt,
      package_fee: 12000
    }));
    pCleanId = pClean.package_id;

    // Seed 3 separated courses for the package
    const pkgCrs1 = db.Course.insert(TestMockHelper.createCoursePayload(ctForPackageId, {
      name: "pkg-crs-1 " + salt
    }));
    pkgCrs1Id = pkgCrs1.course_id;

    const pkgCrs2 = db.Course.insert(TestMockHelper.createCoursePayload(ctForPackageId, {
      name: "pkg-crs-2 " + salt
    }));
    pkgCrs2Id = pkgCrs2.course_id;

    const pkgCrs3 = db.Course.insert(TestMockHelper.createCoursePayload(ctForPackageId, {
      name: "pkg-crs-3 " + salt
    }));
    pkgCrs3Id = pkgCrs3.course_id;

    // Seed Perks and Items under Clean Package (to verify in-memory cascade deletion)
    const perk1 = db.PackagePerk.insert({
      package_id: pCleanId,
      perk_title: "Mock Perk " + salt,
      perk_description: "Mock Value"
    });
    perk1Id = perk1.perk_id;

    const item1 = db.PackageItem.insert({
      package_id: pCleanId,
      entity_type: "course",
      entity_id: pkgCrs1Id
    });
    item1Id = item1.item_id;

    const item2 = db.PackageItem.insert({
      package_id: pCleanId,
      entity_type: "course",
      entity_id: pkgCrs2Id
    });
    item2Id = item2.item_id;

    const item3 = db.PackageItem.insert({
      package_id: pCleanId,
      entity_type: "course",
      entity_id: pkgCrs3Id
    });
    item3Id = item3.item_id;

    // Blocked Package
    const pBlocked = db.Package.insert(TestMockHelper.createPackagePayload([], {
      name: "Blocked Package " + salt,
      package_fee: 15000
    }));
    pBlockedId = pBlocked.package_id;

    // 1. Generate the comprehensive structural payload for a package enrollment
    const registrationPayload = TestMockHelper.createStudentRegistrationPayload(pBlockedId, "package");

    // 2. Dispatch via the action runner to cascade creation across Student, Enrollment, and Finance tables
    const registrationResult = _runAction(RegisterStudentAction, db, registrationPayload);

    if (!registrationResult.success) {
      throw new Error("Failed to seed blocked package enrollment via RegisterStudentAction: " + JSON.stringify(registrationResult.error));
    }

    // 3. Capture the dynamically generated identifiers for tracking and teardown
    seededStudentId = registrationResult.data.student_id;
    const mockEnrollment = db.Enrollment.findOne({ student_id: seededStudentId, item_id: pBlockedId });
    pEnrollmentId = mockEnrollment.enrollment_id;
    timings["Package: Seed Data Generation"] = Date.now() - tStart;

    // Dry Run validation
    tStart = Date.now();
    const dryRunRes = _runAction(DeleteManyPackagesAction, db, {
      ids: [pCleanId, pBlockedId],
      dryRun: true
    });
    timings["Package: Dry Run Validation"] = Date.now() - tStart;

    if (!dryRunRes.success) throw new Error("Package dry run response reported overall failure.");
    const pManifest = dryRunRes.data.manifest;

    if (!pManifest.deleted.includes(pCleanId)) throw new Error("Clean Package was not marked deleted in dryRun manifest.");
    if (pManifest.deleted.includes(pBlockedId)) throw new Error("Blocked Package was incorrectly marked deleted in dryRun manifest.");
    if (!pManifest.failed[pBlockedId]) throw new Error("Blocked Package was not present in manifest.failed.");

    results["Package.1.DryRunIsolation"] = "✅ PASSED";

    // Live Relational Block Validation
    const liveBlockRes = _runAction(DeleteManyPackagesAction, db, {
      ids: [pBlockedId],
      dryRun: false
    });
    if (liveBlockRes.success) {
      throw new Error("Action did not block deleting Package with active enrollments.");
    }
    results["Package.2.LiveBlockConstraint"] = "✅ PASSED";

    // Live Clean Deletion (should trigger cascades on Perks and Items)
    const liveCleanRes = _runAction(DeleteManyPackagesAction, db, {
      ids: [pCleanId],
      dryRun: false
    });
    if (!liveCleanRes.success || liveCleanRes.data.deletedCount !== 1) {
      throw new Error("Live delete on clean Package failed: " + JSON.stringify(liveCleanRes));
    }
    if (db.Package.findById(pCleanId) !== null) {
      throw new Error("Clean Package was not physically deleted from the database.");
    }

    // Verify cascade deleted
    if (db.PackagePerk.findById(perk1Id) !== null) {
      throw new Error("PackagePerk was not cascade deleted from the database.");
    }
    if (db.PackageItem.findById(item1Id) !== null) {
      throw new Error("PackageItem 1 was not cascade deleted from the database.");
    }
    if (db.PackageItem.findById(item2Id) !== null) {
      throw new Error("PackageItem 2 was not cascade deleted from the database.");
    }
    if (db.PackageItem.findById(item3Id) !== null) {
      throw new Error("PackageItem 3 was not cascade deleted from the database.");
    }

    results["Package.3.LiveDeleteSuccessAndCascade"] = "✅ PASSED";

  } catch (e) {
    console.error("❌ Package Test Failure:", e.message);
    results["Package.Overall"] = "❌ FAILED: " + e.message;
  } finally {
    try {
      if (pEnrollmentId) db.Enrollment.remove(pEnrollmentId);
      if (typeof seededStudentId !== 'undefined' && seededStudentId) {
        if (db.Student.findById(seededStudentId)) db.Student.remove(seededStudentId);
      }
      if (pBlockedId) db.Package.remove(pBlockedId);
      if (pCleanId) db.Package.remove(pCleanId);
      if (perk1Id) db.PackagePerk.remove(perk1Id);
      if (item1Id) db.PackageItem.remove(item1Id);
      if (item2Id) db.PackageItem.remove(item2Id);
      if (item3Id) db.PackageItem.remove(item3Id);

      if (pkgCrs1Id) db.Course.remove(pkgCrs1Id);
      if (pkgCrs2Id) db.Course.remove(pkgCrs2Id);
      if (pkgCrs3Id) db.Course.remove(pkgCrs3Id);
      if (ctForPackageId) db.CourseType.remove(ctForPackageId);
    } catch (cleanupErr) {
      console.warn("⚠️ Warning: Cleanup issues during Package teardown:", cleanupErr.message);
    }
  }
}

// ----------------------------------------------------
// TEST CASE 4: Live Failure Response Violations Validation
// ----------------------------------------------------
function testFailureResponseViolations(db, results, timings, salt) {
  let ctId = null;
  let cId = null;
  let bId = null;

  try {
    console.log("👉 Testing Live Failure Response Violations...");
    let tStart = Date.now();

    // Seed CourseType
    const ct = db.CourseType.insert(TestMockHelper.createCourseTypePayload({
      segment_name: "Violations Segment " + salt,
      entity_label: "Violations CT " + salt
    }));
    ctId = ct.segment_id;

    // Seed Course
    const course = db.Course.insert(TestMockHelper.createCoursePayload(ctId, {
      name: "Violations Course " + salt
    }));
    cId = course.course_id;

    // Seed Batch (referencing Course to create protect constraint)
    const batch = db.Batch.insert(TestMockHelper.createBatchPayload(cId, "TCH-MOCK-1", "BRN-MOCK-1", {
      batch_name: "Violations Batch " + salt
    }));
    bId = batch.batch_id;
    timings["Violations: Seed Data Generation"] = Date.now() - tStart;

    // Execute live delete (should block and return structured violations)
    tStart = Date.now();
    const liveBlockRes = _runAction(DeleteManyCoursesAction, db, {
      ids: [cId],
      dryRun: false
    });
    timings["Violations: Live Execution"] = Date.now() - tStart;

    if (liveBlockRes.success) {
      throw new Error("Action succeeded when it should have failed with relational blockages.");
    }

    const error = liveBlockRes.error;
    if (!error || error.code !== "ACTION_VALIDATION_FAILURE") {
      throw new Error("Expected ACTION_VALIDATION_FAILURE error code. Found: " + JSON.stringify(error));
    }

    const details = error.details;
    if (!details || !details.violations || !Array.isArray(details.violations) || details.violations.length === 0) {
      throw new Error("Violations array is missing, not an array, or empty. Envelope error details: " + JSON.stringify(details));
    }

    const violation = details.violations[0];
    if (violation.table !== "Batch" || violation.foreignKey !== "course_id" || !violation.ids.includes(bId)) {
      throw new Error("Violation context metadata did not match the expected Batch blockage. Found: " + JSON.stringify(violation));
    }

    results["Violations.1.LiveEnvelopeStructuredFormat"] = "✅ PASSED";
    console.log("      [PASS] Live failure response successfully contains all expected violation entries.");

  } catch (e) {
    console.error("❌ Violations Test Failure:", e.message);
    results["Violations.Overall"] = "❌ FAILED: " + e.message;
  } finally {
    try {
      if (bId) db.Batch.remove(bId);
      if (cId) db.Course.remove(cId);
      if (ctId) db.CourseType.remove(ctId);
    } catch (cleanupErr) {
      console.warn("⚠️ Warning: Cleanup issues during Violations teardown:", cleanupErr.message);
    }
  }
}

