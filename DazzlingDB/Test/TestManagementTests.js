/**
 * @file TestManagementTests.js
 * Integration Test Suite for the Test Management System (Class Tests).
 */

function runTestManagementTests() {
  console.log("🚀 Starting Test Management System Integration Tests...");

  const db = DBContext.getInstance();
  const suffix = Math.random().toString(36).substring(7).toUpperCase();
  
  const timings = {};
  const status = {};
  const tSuiteStart = Date.now();

  // ==========================================
  // 1. Setup Master Mock Entities
  // ==========================================
  console.log("\n--- [TEST SETUP] Bootstrapping master records ---");
  const tSetupStart = Date.now();
  
  let branchId = "BRN-TST-" + suffix;
  let courseTypeId = "SEG-TST-" + suffix;
  let courseId = "CRS-TST-" + suffix;
  let teacherId = "TCH-TST-" + suffix;
  let batchId = "BAT-TST-" + suffix;
  let studentId1 = "STU-TST-1-" + suffix;
  let studentId2 = "STU-TST-2-" + suffix;

  try {
    db.Branch.insert({ branch_id: branchId, branch_name: "Test Branch", status: "active" });
    db.CourseType.insert({ segment_id: courseTypeId, segment_name: "Test Academy", status: "active" });
    db.Course.insert({ course_id: courseId, name: "Test Course 101", base_fee: 6000, segment_id: courseTypeId, language_medium: "English", status: "active" });
    
    db.Teacher.insert({
      teacher_id: teacherId,
      full_name: "Instructor Test",
      mobile_number: "9" + Math.floor(10000000 + Math.random() * 90000000),
      email: `teacher_tst_${suffix.toLowerCase()}@test.com`,
      gender: "male",
      date_of_birth: "1988-05-15",
      experience_years: 6,
      teacher_type: "full_time",
      joining_date: "2026-06-01",
      status: "active",
      branch_id: branchId
    });

    db.Batch.insert({
      batch_id: batchId,
      course_id: courseId,
      teacher_id: teacherId,
      branch_id: branchId,
      batch_name: "Test Batch Evening",
      capacity: 20,
      batch_type: "Academy",
      status: "active"
    });

    db.Student.insert({
      student_id: studentId1,
      student_name: "Student One Test",
      email: `student1_${suffix.toLowerCase()}@test.com`,
      phone: "8" + Math.floor(10000000 + Math.random() * 90000000),
      gender: "Male",
      dob: "2009-02-10",
      status: "active"
    });

    db.Student.insert({
      student_id: studentId2,
      student_name: "Student Two Test",
      email: `student2_${suffix.toLowerCase()}@test.com`,
      phone: "8" + Math.floor(10000000 + Math.random() * 90000000),
      gender: "Female",
      dob: "2009-08-20",
      status: "active"
    });

    // Create mock enrollments required by BatchAllocation
    db.Enrollment.insert({
      enrollment_id: "ENR-T1-" + suffix,
      student_id: studentId1,
      enrollment_type: "course",
      item_id: courseId,
      status: "active"
    });

    db.Enrollment.insert({
      enrollment_id: "ENR-T2-" + suffix,
      student_id: studentId2,
      enrollment_type: "course",
      item_id: courseId,
      status: "active"
    });

    // Allocate both students to the batch
    db.BatchAllocation.insert({
      allocation_id: "BAL-T1-" + suffix,
      student_id: studentId1,
      enrollment_id: "ENR-T1-" + suffix,
      batch_id: batchId,
      course_id: courseId,
      status: "active",
      remarks: "Test mock allocation"
    });

    db.BatchAllocation.insert({
      allocation_id: "BAL-T2-" + suffix,
      student_id: studentId2,
      enrollment_id: "ENR-T2-" + suffix,
      batch_id: batchId,
      course_id: courseId,
      status: "active",
      remarks: "Test mock allocation"
    });

    console.log("✅ Mock master data bootstrap successful.");
    status["Setup"] = "COMPLETE";
  } catch (e) {
    console.error("❌ Test setup failed:", e.message);
    status["Setup"] = "FAILED";
    timings["Setup"] = Date.now() - tSetupStart;
    throw e;
  }
  timings["Setup"] = Date.now() - tSetupStart;

  let createdTestId = null;

  // ==========================================
  // 2. Test Case 1: Create Class Test
  // ==========================================
  console.log("\n--- [TEST CASE 1] Create Class Test Schedule ---");
  const tCase1Start = Date.now();
  try {
    const payload = {
      title: "Science Weekly Quiz 01",
      batch_id: batchId,
      test_date: "2026-06-12",
      total_marks: 50,
      passing_marks: 20,
      status: "Draft",
      remarks: "Covers light and refraction modules"
    };

    const mockContext = {
      actionType: "CREATE",
      mutationManifest: []
    };

    const record = TestService.createTest(payload, mockContext);
    createdTestId = record.id;
    console.log(`  ✅ Test scheduled successfully. ID: ${createdTestId}`);

    if (record.status === "Draft" && record.total_marks === 50 && record.passing_marks === 20) {
      console.log("  ✅ Attributes and default status constraints verified.");
    } else {
      throw new Error(`Attribute verification failed: status=${record.status}, max=${record.total_marks}`);
    }

    if (mockContext.mutationManifest.includes("Test")) {
      console.log("  ✅ Mutation manifest verified: " + JSON.stringify(mockContext.mutationManifest));
    } else {
      throw new Error("Mutation tracking failed for Test creation!");
    }

    // Verify negative boundaries (invalid total_marks)
    try {
      const mockContextFail1 = { actionType: "CREATE", mutationManifest: [] };
      TestService.createTest({
        title: "Bad Quiz",
        batch_id: batchId,
        test_date: "2026-06-12",
        total_marks: -10
      }, mockContextFail1);
      throw new Error("Failure: Allowed negative total marks!");
    } catch (err) {
      if (err.message.includes("Failure: Allowed negative total marks")) {
        throw err;
      }
      console.log(`  ✅ Successfully blocked negative total marks: ${err.message}`);
    }

    // Verify invalid passing marks
    try {
      const mockContextFail2 = { actionType: "CREATE", mutationManifest: [] };
      TestService.createTest({
        title: "Bad Quiz 2",
        batch_id: batchId,
        test_date: "2026-06-12",
        total_marks: 50,
        passing_marks: 55
      }, mockContextFail2);
      throw new Error("Failure: Allowed passing marks greater than total marks!");
    } catch (err) {
      if (err.message.includes("Failure: Allowed passing marks greater than total marks")) {
        throw err;
      }
      console.log(`  ✅ Successfully blocked excessive passing marks: ${err.message}`);
    }

    status["TestCase1"] = "PASSED";
  } catch (e) {
    console.error("❌ Test creation test case failed:", e.message);
    status["TestCase1"] = "FAILED";
  }
  timings["TestCase1"] = Date.now() - tCase1Start;

  // ==========================================
  // 3. Test Case 2: Bulk Mark Entries and Upsert Validation
  // ==========================================
  console.log("\n--- [TEST CASE 2] Bulk Marks Insertion & Upsert Logic ---");
  const tCase2Start = Date.now();
  try {
    const bulkPayload = {
      test_id: createdTestId,
      records: [
        { student_id: studentId1, obtained_marks: 45, is_absent: false, remarks: "Excellent score" },
        { student_id: studentId2, obtained_marks: 18, is_absent: false, remarks: "Failed by 2 marks" }
      ]
    };

    const mockContextSave = {
      actionType: "CREATE",
      mutationManifest: []
    };

    // a. Primary Insert Call
    const res = TestService.saveTestMarksBulk(bulkPayload, mockContextSave);
    if (res.success && res.processedCount === 2) {
      console.log(`  ✅ Primary bulk marks save successful. Count: ${res.processedCount}`);
      const m1 = db.TestMarks.findOne({ test_id: createdTestId, student_id: studentId1 });
      const m2 = db.TestMarks.findOne({ test_id: createdTestId, student_id: studentId2 });
      if (m1 && m1.obtained_marks === 45 && m2 && m2.obtained_marks === 18) {
        console.log("  ✅ Individual scores verified in database sheet.");
      } else {
        throw new Error("Individual marks mismatch in database.");
      }

      if (mockContextSave.mutationManifest.includes("TestMarks")) {
        console.log("  ✅ Mutation manifest verified: " + JSON.stringify(mockContextSave.mutationManifest));
      } else {
        throw new Error("Mutation tracking failed for TestMarks bulk save!");
      }
    } else {
      throw new Error("Primary bulk marks save failed.");
    }

    // b. Secondary Call: Verify Upsert override behavior (test_id + student_id constraint)
    const updatePayload = {
      test_id: createdTestId,
      records: [
        { student_id: studentId1, obtained_marks: 48, is_absent: false, remarks: "Recalculated re-check" }, // Update 45 -> 48
        { student_id: studentId2, obtained_marks: null, is_absent: true, remarks: "Marks voided: marked absent" } // Update 18 -> Absent
      ]
    };

    const mockContextUpdate = {
      actionType: "UPDATE",
      mutationManifest: []
    };

    const resUpdate = TestService.saveTestMarksBulk(updatePayload, mockContextUpdate);
    if (resUpdate.success && resUpdate.processedCount === 2) {
      console.log("  ✅ Secondary upsert update call completed successfully.");
      const rows = db.TestMarks.where({ test_id: createdTestId });
      if (rows.length === 2) {
        console.log(`  ✅ Composite key integrity preserved: total row count remains exactly 2 (no duplicates).`);
        const m1 = rows.find(r => r.student_id === studentId1);
        const m2 = rows.find(r => r.student_id === studentId2);
        if (m1 && m1.obtained_marks === 48 && m2 && m2.is_absent === true && m2.obtained_marks === null) {
          console.log("  ✅ Updates and absent scores normalization successfully verified in database.");
        } else {
          throw new Error(`Mapped updates failed. Values: m1=${m1 ? m1.obtained_marks : 'null'}, m2_absent=${m2 ? m2.is_absent : 'null'}`);
        }
      } else {
        throw new Error(`Duplicate rows generated! Total rows found: ${rows.length}`);
      }
    } else {
      throw new Error("Secondary upsert update call failed.");
    }

    status["TestCase2"] = "PASSED";
  } catch (e) {
    console.error("❌ Bulk marks upsert test failed:", e.message);
    status["TestCase2"] = "FAILED";
  }
  timings["TestCase2"] = Date.now() - tCase2Start;

  // ==========================================
  // 4. Test Case 3: Marks Boundary and Security Constraints
  // ==========================================
  console.log("\n--- [TEST CASE 3] Marks Boundaries & Security Constraints ---");
  const tCase3Start = Date.now();
  try {
    // a. Marks exceeding limit
    try {
      const mockContext = { actionType: "CREATE", mutationManifest: [] };
      TestService.saveTestMarksBulk({
        test_id: createdTestId,
        records: [{ student_id: studentId1, obtained_marks: 52, is_absent: false }] // 52 > Max 50
      }, mockContext);
      throw new Error("Failure: Allowed obtained marks to exceed test max limit.");
    } catch (err) {
      if (err.message.includes("Failure: Allowed obtained marks to exceed")) {
        throw err;
      }
      console.log(`  ✅ Blocked score exceeding max limit: ${err.message}`);
    }

    // b. Unallocated student marks submission
    let unallocatedStudentId = "STU-UNALLOC-" + suffix;
    db.Student.insert({
      student_id: unallocatedStudentId,
      student_name: "Unallocated Student",
      status: "active"
    });

    try {
      const mockContext = { actionType: "CREATE", mutationManifest: [] };
      TestService.saveTestMarksBulk({
        test_id: createdTestId,
        records: [{ student_id: unallocatedStudentId, obtained_marks: 30, is_absent: false }]
      }, mockContext);
      throw new Error("Failure: Allowed marks entry for a student not allocated to the batch.");
    } catch (err) {
      if (err.message.includes("Failure: Allowed marks entry for a student")) {
        throw err;
      }
      console.log(`  ✅ Blocked marks for unallocated student: ${err.message}`);
    }

    // Cleanup unallocated student mock
    db.Student.remove(unallocatedStudentId);
    status["TestCase3"] = "PASSED";
  } catch (e) {
    console.error("❌ Constraints verification test case failed:", e.message);
    status["TestCase3"] = "FAILED";
  }
  timings["TestCase3"] = Date.now() - tCase3Start;

  // ==========================================
  // 5. Test Case 4: Dynamic Performance Report Analytics
  // ==========================================
  console.log("\n--- [TEST CASE 4] Dynamic Analytics Report Verification ---");
  const tCase4Start = Date.now();
  try {
    // Populate one more student score to evaluate average and ranking calculations
    let studentId3 = "STU-TST-3-" + suffix;
    db.Student.insert({
      student_id: studentId3,
      student_name: "Student Three Test",
      status: "active"
    });
    db.Enrollment.insert({
      enrollment_id: "ENR-T3-" + suffix,
      student_id: studentId3,
      enrollment_type: "course",
      item_id: courseId,
      status: "active"
    });

    db.BatchAllocation.insert({
      allocation_id: "BAL-T3-" + suffix,
      student_id: studentId3,
      enrollment_id: "ENR-T3-" + suffix,
      batch_id: batchId,
      course_id: courseId,
      status: "active"
    });

    // We have:
    // Student 1: Score 48/50 (Percentage: 96%, Grade: A, Rank: 1)
    // Student 2: Absent (Percentage: null, Grade: Absent, Rank: Absent)
    // Student 3: Score 30/50 (Percentage: 60%, Grade: D, Rank: 2)
    const mockContextSave = {
      actionType: "CREATE",
      mutationManifest: []
    };
    TestService.saveTestMarksBulk({
      test_id: createdTestId,
      records: [
        { student_id: studentId3, obtained_marks: 30, is_absent: false }
      ]
    }, mockContextSave);

    const report = TestService.queryTestReport({ test_id: createdTestId });
    console.log("  ✅ Report query successfully generated and resolved.");

    const stats = report.stats;
    const records = report.records;

    // Verify aggregate stats
    const avgCheck = stats.average_marks === 39.0; // (48 + 30) / 2 present = 39.0
    const passCheck = stats.pass_percentage === 66.67; // 2 pass (STU 1 and 3) / 3 total logged = 66.67%
    const absentCheck = stats.absent_percentage === 33.33; // 1 absent / 3 total logged = 33.33%

    if (avgCheck && passCheck && absentCheck) {
      console.log(`  ✅ Aggregate statistics calculations match expected math:`);
      console.log(`     - Highest: ${stats.highest_marks} | Lowest: ${stats.lowest_marks} | Average: ${stats.average_marks}`);
      console.log(`     - Pass Rate: ${stats.pass_percentage}% | Fail Rate: ${stats.fail_percentage}% | Absent Rate: ${stats.absent_percentage}%`);
    } else {
      throw new Error(`Aggregate stats mismatch: avg=${stats.average_marks}, pass=${stats.pass_percentage}, absent=${stats.absent_percentage}`);
    }

    // Verify hydrated names, dynamic percentages, and ranks
    const r1 = records.find(r => r.student_id === studentId1);
    const r2 = records.find(r => r.student_id === studentId2);
    const r3 = records.find(r => r.student_id === studentId3);

    if (r1 && r1.student_name === "Student One Test" && r1.percentage === 96.0 && r1.grade === "A" && r1.rank === 1) {
      console.log("  ✅ Student 1 hydrated dynamic fields verified (Rank 1, 96.0%, Grade A).");
    } else {
      throw new Error("Student 1 report verification failed: " + JSON.stringify(r1));
    }

    if (r2 && r2.is_absent === true && r2.obtained_marks === null && r2.percentage === null && r2.grade === "Absent" && r2.rank === "Absent") {
      console.log("  ✅ Student 2 hydrated dynamic fields verified (Absent details resolved).");
    } else {
      throw new Error("Student 2 report verification failed: " + JSON.stringify(r2));
    }

    if (r3 && r3.percentage === 60.0 && r3.grade === "D" && r3.rank === 2) {
      console.log("  ✅ Student 3 hydrated dynamic fields verified (Rank 2, 60.0%, Grade D).");
    } else {
      throw new Error("Student 3 report verification failed: " + JSON.stringify(r3));
    }

    // Verify topper array resolves correctly
    if (stats.toppers && stats.toppers.length === 1 && stats.toppers[0].student_id === studentId1) {
      console.log(`  ✅ Topper dynamic list resolved correctly. Topper: ${stats.toppers[0].student_name}`);
    } else {
      throw new Error("Topper resolution failed: " + JSON.stringify(stats.toppers));
    }

    // Cleanup Student 3 mock
    db.BatchAllocation.remove("BAL-T3-" + suffix);
    db.Enrollment.remove("ENR-T3-" + suffix);
    db.Student.remove(studentId3);

    status["TestCase4"] = "PASSED";
  } catch (e) {
    console.error("❌ Analytics report test failed:", e.message);
    status["TestCase4"] = "FAILED";
  }
  timings["TestCase4"] = Date.now() - tCase4Start;

  // ==========================================
  // 6. Test Case 5: Cascade Deletion Integrity
  // ==========================================
  console.log("\n--- [TEST CASE 5] Cascade Deletion Check ---");
  const tCase5Start = Date.now();
  try {
    // Create mock TestPaper
    const paperId = "TPP-T1-" + suffix;
    db.TestPaper.insert({
      id: paperId,
      test_id: createdTestId,
      title: "Refraction Test Paper",
      paper_file_url: "https://drive.google.com/quiz1"
    });
    console.log(`  ⚙️ Mock test paper created. ID: ${paperId}`);

    // Verify physical rows in related tables before delete
    const marksCountBefore = db.TestMarks.count({ test_id: createdTestId });
    const papersCountBefore = db.TestPaper.count({ test_id: createdTestId });
    console.log(`  ℹ️ Related records before delete: marks=${marksCountBefore}, papers=${papersCountBefore}`);

    if (marksCountBefore === 2 && papersCountBefore === 1) {
      // Execute Cascade deletion
      db.Test.remove(createdTestId);
      console.log("  ⚙️ Executed deletion on parent Test...");

      const testExists = db.Test.exists({ id: createdTestId });
      const marksCountAfter = db.TestMarks.count({ test_id: createdTestId });
      const papersCountAfter = db.TestPaper.count({ test_id: createdTestId });

      if (!testExists && marksCountAfter === 0 && papersCountAfter === 0) {
        console.log("  ✅ Cascade Deletion Verification: Parent Test, child TestMarks, and child TestPaper records successfully purged.");
        status["TestCase5"] = "PASSED";
      } else {
        throw new Error(`Cascade deletion failed! Parent exists: ${testExists}, remaining marks count: ${marksCountAfter}, remaining papers count: ${papersCountAfter}`);
      }
    } else {
      throw new Error("Pre-deletion related row state is incorrect.");
    }

  } catch (e) {
    console.error("❌ Cascade deletion test failed:", e.message);
    status["TestCase5"] = "FAILED";
  }
  timings["TestCase5"] = Date.now() - tCase5Start;

  // ==========================================
  // 7. Cleanup Test Masters
  // ==========================================
  console.log("\n--- [TEST CLEANUP] Purging master mock records ---");
  const tCleanupStart = Date.now();
  try {
    // Delete allocations
    db.BatchAllocation.remove("BAL-T1-" + suffix);
    db.BatchAllocation.remove("BAL-T2-" + suffix);

    // Delete enrollments
    db.Enrollment.remove("ENR-T1-" + suffix);
    db.Enrollment.remove("ENR-T2-" + suffix);

    // Delete student master rows
    db.Student.remove(studentId1);
    db.Student.remove(studentId2);

    // Delete academic masters
    db.Batch.remove(batchId);
    db.Teacher.remove(teacherId);
    db.Course.remove(courseId);
    db.CourseType.remove(courseTypeId);
    db.Branch.remove(branchId);

    console.log("✅ Cleanup complete. Database returned to pristine state.");
    status["Cleanup"] = "COMPLETE";
  } catch (e) {
    console.warn(`[Cleanup Warning] Failed to clean up master test records: ${e.message}`);
    status["Cleanup"] = "WARNING/FAILED";
  }
  timings["Cleanup"] = Date.now() - tCleanupStart;

  // ==========================================
  // 8. Print Diagnostic Timing & Summary Table
  // ==========================================
  const totalDuration = Date.now() - tSuiteStart;
  
  const allPassed = ["TestCase1", "TestCase2", "TestCase3", "TestCase4", "TestCase5"].every(
    key => status[key] === "PASSED"
  );
  
  console.log("\n======================================================================");
  console.log("               TEST SUITE RUN TIMING & METRICS SUMMARY");
  console.log("======================================================================");
  console.log(leftPad("Phase / Test Case", 38) + " | " + leftPad("Status", 12) + " | " + leftPad("Time Taken", 12));
  console.log("----------------------------------------------------------------------");
  console.log(leftPad("[Setup] Bootstrapping Master Data", 38) + " | " + leftPad(status["Setup"], 12) + " | " + leftPad(timings["Setup"] + " ms", 12));
  console.log(leftPad("[Case 1] Create Test Schedule", 38) + " | " + leftPad(status["TestCase1"], 12) + " | " + leftPad(timings["TestCase1"] + " ms", 12));
  console.log(leftPad("[Case 2] Bulk Marks Insert & Upsert", 38) + " | " + leftPad(status["TestCase2"], 12) + " | " + leftPad(timings["TestCase2"] + " ms", 12));
  console.log(leftPad("[Case 3] Boundary & Allocations Check", 38) + " | " + leftPad(status["TestCase3"], 12) + " | " + leftPad(timings["TestCase3"] + " ms", 12));
  console.log(leftPad("[Case 4] Dynamic Analytics Report", 38) + " | " + leftPad(status["TestCase4"], 12) + " | " + leftPad(timings["TestCase4"] + " ms", 12));
  console.log(leftPad("[Case 5] Cascade Deletion Integrity", 38) + " | " + leftPad(status["TestCase5"], 12) + " | " + leftPad(timings["TestCase5"] + " ms", 12));
  console.log(leftPad("[Cleanup] Purging Master Mock Records", 38) + " | " + leftPad(status["Cleanup"], 12) + " | " + leftPad(timings["Cleanup"] + " ms", 12));
  console.log("----------------------------------------------------------------------");
  console.log(leftPad("Total Test Suite Duration", 38) + " | " + leftPad(allPassed ? "PASSED" : "FAILED", 12) + " | " + leftPad(totalDuration + " ms", 12));
  console.log("======================================================================\n");

  if (allPassed && status["Setup"] === "COMPLETE" && status["Cleanup"] === "COMPLETE") {
    console.log("🎉 INTEGRATION TESTS COMPLETED: SUCCESS");
  } else {
    console.log("❌ INTEGRATION TESTS COMPLETED: FAILED");
  }
}

function leftPad(str, len) {
  str = String(str);
  while (str.length < len) {
    str = str + " ";
  }
  return str.substring(0, len);
}

// Bind to global scope for Apps Script execution
globalThis.runTestManagementTests = runTestManagementTests;
