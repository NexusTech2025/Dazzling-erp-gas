/**
 * @file AttendanceSystemTests.js
 * Integration Test Suite for the Student and Teacher Attendance System.
 */

function runAttendanceSystemTests() {
  console.log("🚀 Starting Attendance System Integration Tests...");

  const db = DBContext.getInstance();
  const suffix = Math.random().toString(36).substring(7).toUpperCase();

  // Initialize mock requestContext
  const mockContext = {
    actionType: "CREATE",
    mutationManifest: [],
    txId: "TX-TEST-MOCK-ATT",
    headers: { "X-Correlation-ID": "test-corr-att" }
  };

  // ==========================================
  // 1. Setup Master Mock Entities
  // ==========================================
  console.log("\n--- [TEST SETUP] Bootstrapping master records ---");
  
  let branchId = "BRN-ATT-" + suffix;
  let courseTypeId = "SEG-ATT-" + suffix;
  let courseId = "CRS-ATT-" + suffix;
  let teacherId = "TCH-ATT-" + suffix;
  let batchId = "BAT-ATT-" + suffix;
  let studentId = "STU-ATT-" + suffix;

  try {
    db.Branch.insert({ branch_id: branchId, branch_name: "Attendance Branch", status: "active" });
    db.CourseType.insert({ segment_id: courseTypeId, segment_name: "Attendance Academy", status: "active" });
    db.Course.insert({ course_id: courseId, name: "Attendance 101", base_fee: 5000, segment_id: courseTypeId, language_medium: "English", status: "active" });
    
    db.Teacher.insert({
      teacher_id: teacherId,
      full_name: "Instructor Attendance",
      mobile_number: "9" + Math.floor(10000000 + Math.random() * 90000000),
      email: `teacher_att_${suffix.toLowerCase()}@test.com`,
      gender: "female",
      date_of_birth: "1990-01-01",
      experience_years: 5,
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
      batch_name: "Att Batch Morning",
      capacity: 30,
      batch_type: "Academy",
      status: "active"
    });

    let batchId2 = "BAT-ATT-2-" + suffix;
    db.Batch.insert({
      batch_id: batchId2,
      course_id: courseId,
      teacher_id: teacherId,
      branch_id: branchId,
      batch_name: "Att Batch Evening",
      capacity: 30,
      batch_type: "Academy",
      status: "active"
    });

    db.Student.insert({
      student_id: studentId,
      student_name: "Learner Attendance",
      email: `student_att_${suffix.toLowerCase()}@test.com`,
      phone: "8" + Math.floor(10000000 + Math.random() * 90000000),
      gender: "Male",
      dob: "2008-01-01",
      status: "active"
    });

    console.log("✅ Mock master data bootstrap successful.");
  } catch (e) {
    console.error("❌ Test setup failed: " + e.message + "\n" + (e.stack || ""));
    throw e;
  }

  // ==========================================
  // 2. Test Time Duration Utility Calculations
  // ==========================================
  console.log("\n--- [TEST CASE 1] Duration Utility Calculations ---");
  try {
    const d1 = AttendanceUtil.calculateDuration("08:00 AM", "01:00 PM");
    if (d1 === 5.0) {
      console.log("  ✅ AM/PM standard conversion: 08:00 AM to 01:00 PM = 5.00 hours");
    } else {
      console.error(`  ❌ AM/PM standard conversion failed: Expected 5, got ${d1}`);
    }

    const d2 = AttendanceUtil.calculateDuration("08:01 AM", "01:05 PM");
    if (d2 === 5.07) {
      console.log("  ✅ AM/PM decimal conversion: 08:01 AM to 01:05 PM = 5.07 hours");
    } else {
      console.error(`  ❌ AM/PM decimal conversion failed: Expected 5.07, got ${d2}`);
    }

    const d3 = AttendanceUtil.calculateDuration("07:45 AM", "02:30 PM");
    if (d3 === 6.75) {
      console.log("  ✅ Teacher hours conversion: 07:45 AM to 02:30 PM = 6.75 hours");
    } else {
      console.error(`  ❌ Teacher hours conversion failed: Expected 6.75, got ${d3}`);
    }

    const d4 = AttendanceUtil.calculateDuration("23:00", "02:00");
    if (d4 === 3.0) {
      console.log("  ✅ Midnight rollover: 23:00 to 02:00 = 3.00 hours");
    } else {
      console.error(`  ❌ Midnight rollover failed: Expected 3.0, got ${d4}`);
    }

    const dNull = AttendanceUtil.calculateDuration("", "01:00 PM");
    if (dNull === null) {
      console.log("  ✅ Null handling for missing times passed.");
    } else {
      console.error("  ❌ Null handling failed.");
    }
  } catch (e) {
    console.error("❌ Duration utility tests failed: " + e.message + "\n" + (e.stack || ""));
  }

  // ==========================================
  // 3. Test Student Attendance (Single Upsert)
  // ==========================================
  console.log("\n--- [TEST CASE 2] Student Attendance Single Upsert ---");
  try {
    // a. Initial insertion
    const attDate = "2026-06-10";
    const payload = {
      student_id: studentId,
      batch_id: batchId,
      attendance_date: attDate,
      status: "p",
      entry_time: { hour: 8, minute: 1, period: "AM" },
      exit_time: { hour: 1, minute: 5, period: "PM" },
      attendance_mode: "manual",
      remarks: "On time arrival",
      marked_by: "TCH-MOCK-1"
    };

    mockContext.mutationManifest = [];
    mockContext.actionType = "CREATE";
    const record = StudentService.markAttendance(payload, mockContext);
    console.log(`  ✅ Student attendance marked successfully. ID: ${record.attendance_id}`);
    console.log(`  Mutated records: ${JSON.stringify(mockContext.mutationManifest)}`);
    if (mockContext.mutationManifest.includes("StudentAttendance")) {
      console.log("  ✅ Mutation manifest includes StudentAttendance");
    } else {
      console.error("  ❌ Mutation manifest does not include StudentAttendance!");
    }

    // Verify properties
    if (record.status === "P" && record.attendance_mode === "Manual") {
      console.log("  ✅ Input normalization verification: status normalized to 'P', mode to 'Manual'.");
    } else {
      console.error(`  ❌ Normalization verification failed: status=${record.status}, mode=${record.attendance_mode}`);
    }

    // b. Update/Upsert same record on second call
    const updatePayload = {
      student_id: studentId,
      batch_id: batchId,
      attendance_date: attDate,
      status: "L",
      entry_time: null,
      exit_time: null,
      attendance_mode: "QR",
      remarks: "Approved leave request"
    };

    mockContext.mutationManifest = [];
    mockContext.actionType = "CREATE";
    const updatedRecord = StudentService.markAttendance(updatePayload, mockContext);
    if (updatedRecord.attendance_id === record.attendance_id && updatedRecord.status === "L") {
      console.log("  ✅ Upsert verification: Successfully updated the existing attendance record instead of creating a duplicate.");
    } else {
      throw new Error(`Student upsert verification failed: Expected ID ${record.attendance_id} and status L, got ID ${updatedRecord.attendance_id} and status ${updatedRecord.status}`);
    }

  } catch (e) {
    console.error(e.message + "\n" + (e.stack || ""));
  }

  // ==========================================
  // 4. Test Student Attendance (Bulk Upsert)
  // ==========================================
  console.log("\n--- [TEST CASE 3] Student Attendance Bulk Upsert ---");
  try {
    let studentId2 = "STU-ATT-2-" + suffix;
    db.Student.insert({
      student_id: studentId2,
      student_name: "Learner 2 Attendance",
      email: `student_att2_${suffix.toLowerCase()}@test.com`,
      phone: "8" + Math.floor(10000000 + Math.random() * 90000000),
      gender: "Female",
      dob: "2007-05-15",
      status: "active"
    });

    const bulkPayload = {
      batch_id: batchId,
      attendance_date: "2026-06-11",
      attendance_mode: "Biometric",
      marked_by: "TCH-MOCK-1",
      records: [
        { student_id: studentId, status: "P", entry_time: { hour: 8, minute: 0, period: "AM" }, exit_time: { hour: 1, minute: 0, period: "PM" } },
        { student_id: studentId2, status: "A", remarks: "Sick leave" }
      ]
    };

    mockContext.mutationManifest = [];
    mockContext.actionType = "CREATE";
    const result = StudentService.markAttendanceBulk(bulkPayload, mockContext);
    if (result.success && result.processedCount === 2) {
      console.log(`  ✅ Bulk attendance processed successfully: ${result.processedCount} records.`);
      console.log(`  Mutated records: ${JSON.stringify(mockContext.mutationManifest)}`);
      if (mockContext.mutationManifest.includes("StudentAttendance")) {
        console.log("  ✅ Mutation manifest includes StudentAttendance");
      } else {
        console.error("  ❌ Mutation manifest does not include StudentAttendance!");
      }
      
      const r1 = db.StudentAttendance.findOne({ student_id: studentId, attendance_date: "2026-06-11" });
      const r2 = db.StudentAttendance.findOne({ student_id: studentId2, attendance_date: "2026-06-11" });
      if (r1 && r1.status === "P" && r2 && r2.status === "A") {
        console.log("  ✅ Bulk records verified inside physical table.");
      } else {
        throw new Error("Bulk records verification failed: records not found or status mismatch in database table.");
      }
    } else {
      throw new Error(`Bulk attendance processing failed: success=${result.success}, processedCount=${result.processedCount}`);
    }

  } catch (e) {
    console.error("❌ Student bulk upsert test failed: " + e.message + "\n" + (e.stack || ""));
  }

  // ==========================================
  // 5. Test Student Attendance Query Report
  // ==========================================
  console.log("\n--- [TEST CASE 4] Student Attendance Query Report ---");
  try {
    const report = StudentService.queryAttendance({
      where: {
        batch_id: batchId,
        attendance_date: "2026-06-11"
      }
    });

    if (report && report.data && report.data.length === 2) {
      console.log(`  ✅ Query report resolved ${report.data.length} records.`);
      
      const p1 = report.data.find(r => r.student_id === studentId);
      if (p1 && p1.duration === 5.0 && p1.student_name === "Learner Attendance" && p1.batch_name === "Att Batch Morning" &&
          p1.entry_time && p1.entry_time.hour === 8 && p1.entry_time.minute === 0 && p1.entry_time.period === "AM") {
        console.log("  ✅ Relational hydration verification: student_name, batch_name, duration, and time format are hydrated correctly.");
      } else {
        throw new Error("Relational hydration verification failed: properties missing or incorrect: " + JSON.stringify(p1));
      }
    } else {
      throw new Error(`Query report returned invalid data count: expected 2, got ${report ? report.data.length : 'null'}`);
    }
  } catch (e) {
    console.error("❌ Student query report test failed: " + e.message + "\n" + (e.stack || ""));
  }

  // ==========================================
  // 6. Test Teacher Attendance (Single & Bulk)
  // ==========================================
  console.log("\n--- [TEST CASE 5] Teacher Attendance Operations ---");
  try {
    const batchId2 = "BAT-ATT-2-" + suffix;

    // Single upsert
    const tPayload = {
      teacher_id: teacherId,
      batch_id: batchId,
      attendance_date: "2026-06-10",
      status: "P",
      entry_time: { hour: 7, minute: 45, period: "AM" },
      exit_time: { hour: 2, minute: 30, period: "PM" },
      attendance_mode: "Manual",
      remarks: "Arrived early"
    };
    mockContext.mutationManifest = [];
    mockContext.actionType = "CREATE";
    const tRec = StaffService.markAttendance(tPayload, mockContext);
    console.log(`  ✅ Teacher attendance marked successfully. ID: ${tRec.attendance_id}`);
    console.log(`  Mutated records: ${JSON.stringify(mockContext.mutationManifest)}`);
    if (mockContext.mutationManifest.includes("TeacherAttendance")) {
      console.log("  ✅ Mutation manifest includes TeacherAttendance");
    } else {
      console.error("  ❌ Mutation manifest does not include TeacherAttendance!");
    }

    // Verify single upsert update
    tPayload.status = "L";
    tPayload.entry_time = null;
    tPayload.exit_time = null;
    tPayload.remarks = "Converted to leave";
    
    mockContext.mutationManifest = [];
    mockContext.actionType = "CREATE";
    const tUpdated = StaffService.markAttendance(tPayload, mockContext);
    if (tUpdated.attendance_id === tRec.attendance_id && tUpdated.status === "L") {
      console.log("  ✅ Teacher upsert verification: Successfully updated same record.");
    } else {
      throw new Error(`Teacher upsert verification failed: Expected ID ${tRec.attendance_id} and status L, got ID ${tUpdated.attendance_id} and status ${tUpdated.status}`);
    }

    // Verify non-collision for different batch
    const tPayloadOtherBatch = {
      teacher_id: teacherId,
      batch_id: batchId2,
      attendance_date: "2026-06-10",
      status: "P",
      entry_time: { hour: 8, minute: 0, period: "AM" },
      exit_time: { hour: 3, minute: 0, period: "PM" },
      attendance_mode: "Manual",
      remarks: "Teaching second batch"
    };
    mockContext.mutationManifest = [];
    mockContext.actionType = "CREATE";
    const tRecOtherBatch = StaffService.markAttendance(tPayloadOtherBatch, mockContext);
    if (tRecOtherBatch.attendance_id !== tRec.attendance_id) {
      console.log("  ✅ Teacher multi-batch isolation verification: Separate record created for other batch on same date.");
    } else {
      throw new Error(`Teacher multi-batch isolation verification failed: Overwrote same record ID ${tRec.attendance_id}`);
    }

    // Bulk upsert
    const tBulkPayload = {
      attendance_date: "2026-06-11",
      attendance_mode: "Biometric",
      records: [
        { teacher_id: teacherId, batch_id: batchId, status: "P", entry_time: { hour: 7, minute: 40, period: "AM" }, exit_time: { hour: 2, minute: 45, period: "PM" } },
        { teacher_id: teacherId, batch_id: batchId2, status: "P", entry_time: { hour: 3, minute: 0, period: "PM" }, exit_time: { hour: 5, minute: 0, period: "PM" } }
      ]
    };
    mockContext.mutationManifest = [];
    mockContext.actionType = "CREATE";
    const tBulkResult = StaffService.markAttendanceBulk(tBulkPayload, mockContext);
    if (tBulkResult.success && tBulkResult.processedCount === 2) {
      console.log("  ✅ Teacher bulk attendance processed for multiple batches.");
      console.log(`  Mutated records: ${JSON.stringify(mockContext.mutationManifest)}`);
      if (mockContext.mutationManifest.includes("TeacherAttendance")) {
        console.log("  ✅ Mutation manifest includes TeacherAttendance");
      } else {
        console.error("  ❌ Mutation manifest does not include TeacherAttendance!");
      }
    } else {
      throw new Error(`Teacher bulk processing failed: processedCount=${tBulkResult.processedCount}`);
    }

    // Query report
    const tReport = StaffService.queryAttendance({
      where: {
        teacher_id: teacherId,
        attendance_date: "2026-06-11",
        batch_id: batchId
      }
    });

    if (tReport && tReport.data && tReport.data.length === 1) {
      const tr = tReport.data[0];
      if (tr.duration === 7.08 && tr.teacher_name === "Instructor Attendance" &&
          tr.batch_name === "Att Batch Morning" && tr.course_name === "Attendance 101" &&
          tr.entry_time && tr.entry_time.hour === 7 && tr.entry_time.minute === 40 && tr.entry_time.period === "AM") {
        console.log("  ✅ Teacher query hydration: duration, teacher_name, batch_name, course_name, and time format successfully compiled.");
      } else {
        throw new Error("Teacher hydration validation failed: properties missing or incorrect: " + JSON.stringify(tr));
      }
    } else {
      throw new Error(`Teacher query report failure: expected data count 1, got ${tReport ? tReport.data.length : 'null'}`);
    }

  } catch (e) {
    console.error("❌ Teacher attendance tests failed: " + e.message + "\n" + (e.stack || ""));
  }

  // ==========================================
  // 7. Cleanup Test Records
  // ==========================================
  console.log("\n--- [TEST CLEANUP] Purging test records from tables ---");
  try {
    const sAtts = db.StudentAttendance.where({ batch_id: batchId });
    sAtts.forEach(r => db.StudentAttendance.remove(r.attendance_id));
    
    const tAtts = db.TeacherAttendance.where({ teacher_id: teacherId });
    tAtts.forEach(r => db.TeacherAttendance.remove(r.attendance_id));

    db.Student.remove(studentId);
    const s2 = db.Student.findById("STU-ATT-2-" + suffix);
    if (s2) db.Student.remove(s2.student_id);

    db.Batch.remove(batchId);
    const b2 = db.Batch.findById("BAT-ATT-2-" + suffix);
    if (b2) db.Batch.remove(b2.batch_id);
    db.Teacher.remove(teacherId);
    db.Course.remove(courseId);
    db.CourseType.remove(courseTypeId);
    db.Branch.remove(branchId);

    console.log("✅ Cleanup complete. Database tables returned to pristine state.");
  } catch (e) {
    console.warn(`[Cleanup Warning] Failed to clean up test records: ${e.message}`);
  }

  console.log("\n🏁 Attendance System Integration Tests Complete.");
}
