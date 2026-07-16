/**
 * @file Attendance_TimezoneIntegrationTests.js
 * Integration test verifying full attendance flow timezone compliance.
 */

function runAttendanceTimezoneIntegrationTests() {
  console.log("🚀 Starting Attendance Timezone Integration Tests...");
  
  // Rule E: Environment Execution Guard
  const activeEnv = typeof SYSTEM_ENV !== 'undefined' ? SYSTEM_ENV : 'development';
  if (activeEnv === 'production') {
    throw new Error("❌ Safety Guard: Test suite cannot be executed in the PRODUCTION environment.");
  }

  const db = DBContext.getInstance();
  const results = {};
  const timings = {};
  
  // Track IDs for clean teardown in finally block (Rule F)
  let branchId, segmentId, courseId, teacherId, batchId, studentId, enrollmentId;

  // Rule H: Testing Environment Sandboxing
  console.log("🔒 Initializing sandboxed TESTING environment...");
  const tSandboxStart = new Date().getTime();
  PropertiesService.getScriptProperties().setProperty('ENV', 'TESTING');
  db.bootstrapRepositories();
  timings["Sandbox Initialization"] = new Date().getTime() - tSandboxStart;

  try {
    const suffix = Math.random().toString(36).substring(7).toUpperCase();
    
    // 1. Add temp segment / course
    console.log("   ⚙️ Bootstrapping temp curriculum...");
    const tSetupStart = new Date().getTime();
    
    const courseTypePayload = TestMockHelper.createCourseTypePayload({
      segment_name: "Integration Segment " + suffix
    });
    const segment = db.CourseType.insert(courseTypePayload);
    segmentId = segment.segment_id;
    
    const coursePayload = TestMockHelper.createCoursePayload(segmentId, {
      name: "Integration Course " + suffix
    });
    const course = db.Course.insert(coursePayload);
    courseId = course.course_id;

    // 2. Add temp branch, teacher, batch
    const branch = db.Branch.insert({ branch_name: "Integration Branch " + suffix, status: "active" });
    branchId = branch.branch_id;
    
    const teacherPayload = TestMockHelper.createTeacherPayload({
      teacher_id: "TCH-INT-" + suffix,
      branch_id: branchId
    });
    const teacher = db.Teacher.insert(teacherPayload);
    teacherId = teacher.teacher_id;
    
    const batchPayload = TestMockHelper.createBatchPayload(courseId, teacherId, branchId, {
      batch_id: "BAT-INT-" + suffix,
      batch_name: "Batch " + suffix
    });
    const batch = db.Batch.insert(batchPayload);
    batchId = batch.batch_id;

    // 3. Add student & enrollment using StudentService.registerStudent (Rule D1 aligned)
    const registerContext = { actionType: "CREATE", mutationManifest: [] };
    const registrationPayload = TestMockHelper.createAcademicOnlyRegistrationPayload(courseId, batchId, {
      profile: {
        student_id: "STU-INT-" + suffix
      }
    });

    console.log("   ⚙️ Registering student using StudentService.registerStudent...");
    const studentData = StudentService.registerStudent(registrationPayload, registerContext);
    studentId = studentData.student_id;

    const enrollmentRecord = db.Enrollment.findOne({ student_id: studentId });
    if (enrollmentRecord) {
      enrollmentId = enrollmentRecord.enrollment_id;
    }
    timings["Master Records Setup"] = new Date().getTime() - tSetupStart;


    // 4. Mark attendance of past week (7 days)
    console.log("   ⚙️ Seeding 7 days of attendance...");
    const tSeedStart = new Date().getTime();
    const dates = [];
    const baseDate = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(baseDate.getTime() - i * 24 * 60 * 60 * 1000);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
    }

    const testTimeJson = { hour: 4, minute: 0, period: "PM" }; // 4:00 PM local
    const mockContext = { actionType: "CREATE", mutationManifest: [] };

    dates.forEach(attDate => {
      const payload = {
        student_id: studentId,
        batch_id: batchId,
        attendance_date: attDate,
        status: "P",
        entry_time: testTimeJson,
        exit_time: { hour: 5, minute: 0, period: "PM" },
        attendance_mode: "Manual"
      };
      StudentService.markAttendance(payload, mockContext);
    });
    timings["7-Day Attendance Seeding"] = new Date().getTime() - tSeedStart;

    // 5. Query and verify attendance
    console.log("   🔍 Querying attendance and verifying times...");
    const tQueryStart = new Date().getTime();
    const queryPayload = {
      filters: { student_id: studentId }
    };
    const queryResult = StudentService.queryAttendance(queryPayload);
    const readRecords = queryResult.data || [];
    timings["Querying Attendance"] = new Date().getTime() - tQueryStart;

    // Summarize in table format
    console.log("\n========================================================");
    console.log("📅 ATTENDANCE TIMEZONE INTEGRATION VERIFICATION SUMMARY");
    console.log("========================================================");
    console.log("Date       | Write Entry Time | Read Entry Time | Match?");
    console.log("-----------|------------------|-----------------|-------");

    let allMatch = true;
    readRecords.forEach(rec => {
      const readTime = rec.entry_time; // { hour, minute, period }
      const readTimeStr = readTime ? `${readTime.hour}:${String(readTime.minute).padStart(2, '0')} ${readTime.period}` : "null";
      const writeTimeStr = "4:00 PM";
      const match = (readTime && readTime.hour === 4 && readTime.minute === 0 && readTime.period === "PM") ? "YES ✅" : "NO ❌";
      if (match.includes("NO")) allMatch = false;
      console.log(`${rec.attendance_date.split('T')[0]} | ${writeTimeStr}          | ${readTimeStr.padEnd(15)} | ${match}`);
    });
    console.log("========================================================\n");

    results.Status = allMatch ? "✅ PASSED" : "❌ FAILED (Shift Detected)";
  } catch (error) {
    console.error("   ❌ Integration test failed: " + error.message, error.stack);
    results.Status = "❌ FAILED: " + error.message;
  } finally {
    // Teardown temp records safely (Rule F)
    console.log("🧹 Starting teardown process...");
    const tTeardownStart = new Date().getTime();
    
    try {
      if (studentId) db.StudentAttendance.deleteMany({ student_id: studentId });
      if (enrollmentId) {
        db.BatchAllocation.deleteMany({ enrollment_id: enrollmentId });
        db.Enrollment.remove(enrollmentId);
      }
      if (studentId) {
        db.Address.deleteMany({ student_id: studentId });
        db.ContactInfo.deleteMany({ student_id: studentId });
        db.Education.deleteMany({ student_id: studentId });
        db.Student.remove(studentId);
      }
      if (batchId) db.Batch.remove(batchId);
      if (teacherId) db.Teacher.remove(teacherId);
      if (branchId) db.Branch.remove(branchId);
      if (courseId) db.Course.remove(courseId);
      if (segmentId) db.CourseType.remove(segmentId);
      console.log("✅ Teardown completed successfully.");
    } catch (cleanupError) {
      console.error("⚠️ Teardown error encountered during final cleanup block: " + cleanupError.message);
    }

    
    timings["Teardown Cleanup"] = new Date().getTime() - tTeardownStart;

    // Rule H: Revert environment back to DEVELOPMENT
    console.log("🔓 Restoring development environment...");
    PropertiesService.getScriptProperties().setProperty('ENV', 'DEVELOPMENT');

    // Rule G: Display formatted performance timing table
    console.log("\n========================================================");
    console.log("⏱️  ATTENDANCE TIMEZONE INTEGRATION TIMING SUMMARY      ⏱️");
    console.log("========================================================");
    let totalTime = 0;
    Object.keys(timings).forEach(step => {
      console.log(`- ${step.padEnd(36)}: ${timings[step]} ms`);
      totalTime += timings[step];
    });
    console.log("--------------------------------------------------------");
    console.log(`- Total Execution Time                  : ${totalTime} ms`);
    console.log("========================================================\n");
  }

  return results;
}
