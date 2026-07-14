/**
 * @file TestTeacherSubject_Transaction.js
 * Integration test suite to verify TeacherSubject bulk actions, rollback behaviors, and snapshot tracking.
 */

function runTeacherSubjectTransactionTests() {
  console.log("🚀 Starting TeacherSubject Transaction Tests...");

  const activeEnv = typeof SYSTEM_ENV !== 'undefined' ? SYSTEM_ENV : 'development';
  if (activeEnv === 'production') {
    throw new Error("❌ Safety Guard: Test suite cannot be executed in the PRODUCTION environment.");
  }

  const timing = {};
  const overallStart = Date.now();

  // Track created records for absolute cleanup
  const cleanupRegistry = {
    CourseType: [],
    Course: [],
    Teacher: [],
    TeacherSubject: []
  };

  try {
    // Switch to isolated TESTING sandbox environment
    const sandboxStart = Date.now();
    PropertiesService.getScriptProperties().setProperty('ENV', 'TESTING');
    DBContext.getInstance().bootstrapRepositories();
    const db = DBContext.getInstance();
    db.setup.provision();
    timing["Step 1: Sandbox & Mock Bootstrapping"] = Date.now() - sandboxStart;

    // ==========================================
    // CASE 1: Successful Bulk Insertion
    // ==========================================
    const case1Start = Date.now();
    console.log("\n--- [CASE 1] Successful Bulk Insertion & Tracked Rollback ---");

    // Retrieve or fallback-insert pre-existing segment SEG-2D17C607
    let courseType1 = db.CourseType.findById("SEG-2D17C607");
    if (!courseType1) {
      console.log("  [Test Setup] Pre-existing segment 'SEG-2D17C607' not found. Creating it as fallback...");
      courseType1 = db.CourseType.insert(TestMockHelper.createCourseTypePayload({
        segment_id: "SEG-2D17C607",
        segment_name: "Int Course Segment 945"
      }));
      cleanupRegistry.CourseType.push(courseType1.segment_id);
    } else {
      console.log(`  [Test Setup] Using pre-existing segment: ${courseType1.segment_id}`);
    }

    // Retrieve or fallback-insert pre-existing teacher TCH-F652A058
    let teacher = db.Teacher.findById("TCH-F652A058");
    if (!teacher) {
      console.log("  [Test Setup] Pre-existing teacher 'TCH-F652A058' not found. Creating it as fallback...");
      teacher = db.Teacher.insert(TestMockHelper.createTeacherPayload({
        teacher_id: "TCH-F652A058"
      }));
      cleanupRegistry.Teacher.push(teacher.teacher_id);
    } else {
      console.log(`  [Test Setup] Using pre-existing teacher: ${teacher.teacher_id} (${teacher.full_name})`);
    }

    // Retrieve or fallback-insert pre-existing courses: CRS-753D2CDB, CRS-56D32B73, CRS-638DD67B
    const courseIds = ["CRS-753D2CDB", "CRS-56D32B73", "CRS-638DD67B"];
    const courses = [];
    courseIds.forEach((cId, idx) => {
      let course = db.Course.findById(cId);
      if (!course) {
        console.log(`  [Test Setup] Pre-existing course '${cId}' not found. Creating it as fallback...`);
        course = db.Course.insert(TestMockHelper.createCoursePayload(courseType1.segment_id, {
          course_id: cId,
          name: `Int Course ${idx + 1} 945`
        }));
        cleanupRegistry.Course.push(course.course_id);
      } else {
        console.log(`  [Test Setup] Using pre-existing course: ${course.course_id} (${course.name})`);
      }
      courses.push(course);
    });
    const course1 = courses[0];
    const course2 = courses[1];
    const course3 = courses[2];

    const tx = new TransactionTracker();

    // Insert 3 mappings in bulk using insertMany and track them individually
    const insertedSubs = db.TeacherSubject.insertMany([
      { teacher_id: teacher.teacher_id, subject_id: course1.course_id },
      { teacher_id: teacher.teacher_id, subject_id: course2.course_id },
      { teacher_id: teacher.teacher_id, subject_id: course3.course_id }
    ]);
    insertedSubs.forEach(tsub => {
      tx.trackInsert(db.TeacherSubject, tsub.teacher_subject_id);
      cleanupRegistry.TeacherSubject.push(tsub.teacher_subject_id);
    });

    // Verify all 3 are in the database
    const count = db.TeacherSubject.where({ teacher_id: teacher.teacher_id }).length;
    if (count === 3) {
      console.log("  ✅ Verification: Successfully inserted and tracked 3 TeacherSubject records.");
    } else {
      console.error(`  ❌ Verification Failed: Expected 3 records, got ${count}`);
    }

    // Rollback to test eviction of all 3 inserts
    tx.rollback();
    const countAfterRollback = db.TeacherSubject.where({ teacher_id: teacher.teacher_id }).length;
    if (countAfterRollback === 0) {
      console.log("  ✅ Verification: Rollback successfully evicted all 3 mappings.");
    } else {
      console.error(`  ❌ Verification Failed: Mappings still exist after rollback (Count: ${countAfterRollback})`);
    }
    timing["Scenario 1: Bulk Insertion & Verification"] = Date.now() - case1Start;

    // ==========================================
    // CASE 2: Failure & LIFO Rollback Execution
    // ==========================================
    const case2Start = Date.now();
    console.log("\n--- [CASE 2] Failure & LIFO Rollback Execution ---");

    // Establish pre-existing baseline record (should NOT be rolled back)
    const baselineSub = db.TeacherSubject.insert({ teacher_id: teacher.teacher_id, subject_id: course1.course_id });
    cleanupRegistry.TeacherSubject.push(baselineSub.teacher_subject_id);

    const txFailure = new TransactionTracker();
    try {
      // 1. Insert a valid second record
      const validSub2 = db.TeacherSubject.insert({ teacher_id: teacher.teacher_id, subject_id: course2.course_id });
      txFailure.trackInsert(db.TeacherSubject, validSub2.teacher_subject_id);
      cleanupRegistry.TeacherSubject.push(validSub2.teacher_subject_id);

      console.log("  [Action] Inserting invalid row with missing teacher_id to trigger failure...");
      // 2. Trigger Schema ValidationError intentionally
      db.TeacherSubject.insert({
        teacher_id: null, // violates "required": true
        subject_id: course3.course_id
      });
      console.error("  ❌ Failure Case Failed: DB accepted a null teacher_id without throwing!");
    } catch (e) {
      console.log(`  ✅ Successfully caught expected exception: ${e.message}`);
      // Perform LIFO Rollback
      txFailure.rollback();
    }

    // Verify database state: baseline record remains, validSub2 must be gone
    const activeRecords = db.TeacherSubject.where({ teacher_id: teacher.teacher_id });
    const baselineExists = activeRecords.some(r => r.teacher_subject_id === baselineSub.teacher_subject_id);
    const validSub2Exists = activeRecords.some(r => r.subject_id === course2.course_id);

    if (baselineExists && !validSub2Exists) {
      console.log("  ✅ Verification: Rollback isolated failures and preserved pre-existing baseline data.");
    } else {
      console.error(`  ❌ Verification Failed! Baseline exists: ${baselineExists}, Relational transient row exists: ${validSub2Exists}`);
    }
    timing["Scenario 2: Failure & LIFO Rollback Execution"] = Date.now() - case2Start;

    // ==========================================
    // CASE 3: Snapshot Verification (Old vs New)
    // ==========================================
    const case3Start = Date.now();
    console.log("\n--- [CASE 3] Snapshot Verification (Old vs New) ---");

    const baseTSub = db.TeacherSubject.insert({ teacher_id: teacher.teacher_id, subject_id: course1.course_id });
    cleanupRegistry.TeacherSubject.push(baseTSub.teacher_subject_id);

    // Snapshot original/old state
    const oldSnapshot = { ...baseTSub };
    const txSnapshot = new TransactionTracker();

    // Apply update to database (New State)
    db.TeacherSubject.update(baseTSub.teacher_subject_id, { subject_id: course3.course_id });
    txSnapshot.trackUpdate(db.TeacherSubject, baseTSub.teacher_subject_id, oldSnapshot);

    // Retrieve current database record (New Snapshot)
    const newSnapshot = db.TeacherSubject.findById(baseTSub.teacher_subject_id);

    // Verify transaction tracker holds the old state as backup
    const trackedStep = txSnapshot.steps.find(step => step.id === baseTSub.teacher_subject_id && step.action === 'update');

    if (trackedStep && trackedStep.backup.subject_id === course1.course_id) {
      console.log(`  ✅ Verification: TransactionTracker holds OLD snapshot of data (Subject: ${trackedStep.backup.subject_id})`);
    } else {
      console.error("  ❌ Verification Failed: TransactionTracker failed to capture the old state snapshot.");
    }

    if (newSnapshot && newSnapshot.subject_id === course3.course_id) {
      console.log(`  ✅ Verification: Database holds the NEW snapshot of data (Subject: ${newSnapshot.subject_id})`);
    } else {
      console.error("  ❌ Verification Failed: Database does not hold the updated new snapshot.");
    }

    // Rollback update and verify restoration
    txSnapshot.rollback();
    const restoredRecord = db.TeacherSubject.findById(baseTSub.teacher_subject_id);
    if (restoredRecord && restoredRecord.subject_id === course1.course_id) {
      console.log("  ✅ Verification: Rollback successfully restored the database row to the OLD snapshot state.");
    } else {
      console.error(`  ❌ Verification Failed: Rollback failed to restore old state. Current: ${restoredRecord ? restoredRecord.subject_id : 'null'}`);
    }
    timing["Scenario 3: Snapshot Verification (Old vs New)"] = Date.now() - case3Start;

    // ==========================================
    // STEP 5: Teardown Cleanup
    // ==========================================
    const teardownStart = Date.now();
    console.log("\n--- [TEARDOWN] Cleaning up generated mock entries ---");
    let deleteCount = 0;
    
    // Cleanup in reverse dependency order
    if (cleanupRegistry.TeacherSubject.length > 0) {
      deleteCount += db.TeacherSubject.deleteMany(cleanupRegistry.TeacherSubject);
    }
    if (cleanupRegistry.Course.length > 0) {
      deleteCount += db.Course.deleteMany(cleanupRegistry.Course);
    }
    if (cleanupRegistry.Teacher.length > 0) {
      deleteCount += db.Teacher.deleteMany(cleanupRegistry.Teacher);
    }
    if (cleanupRegistry.CourseType.length > 0) {
      deleteCount += db.CourseType.deleteMany(cleanupRegistry.CourseType);
    }
    console.log(`  ✅ Successfully cleaned up ${deleteCount} generated database records.`);
    timing["Step 5: Teardown Cleanup"] = Date.now() - teardownStart;

  } catch (e) {
    console.error("❌ Test execution encountered an unhandled error:", e.message, e.stack);
  } finally {
    // Safely restore environment configurations
    PropertiesService.getScriptProperties().setProperty('ENV', 'DEVELOPMENT');
    DBContext.getInstance().bootstrapRepositories();

    const totalTime = Date.now() - overallStart;
    console.log("\n========================================================");
    console.log("⏱️  TEACHER-SUBJECT TRANSACTION PERFORMANCE TIMING  ⏱️");
    console.log("========================================================");
    for (const [stepName, duration] of Object.entries(timing)) {
      console.log(`- ${stepName.padEnd(50)}: ${String(duration).padStart(6)} ms`);
    }
    console.log("--------------------------------------------------------");
    console.log(`- ${"Total Execution Time".padEnd(50)}: ${String(totalTime).padStart(6)} ms`);
    console.log("========================================================\n");
  }
}
