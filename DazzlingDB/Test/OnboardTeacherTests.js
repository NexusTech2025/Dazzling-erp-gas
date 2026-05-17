/**
 * @file OnboardTeacherTests.js
 * Integration and transactional test suite for the Teacher Onboarding relational transaction.
 */

function runOnboardTeacherTests() {
  console.log("🚀 Starting Onboard Teacher Transactional Integration Tests...");

  const db = DBContext.getInstance();

  // Generate unique credentials/mobile numbers to prevent duplicate errors across test runs
  const suffix = Math.random().toString(36).substring(7).toUpperCase();
  const mobileSuccess = "98" + Math.floor(10000000 + Math.random() * 90000000);
  const mobileDuplicate = "99" + Math.floor(10000000 + Math.random() * 90000000);
  const emailSuccess = `teacher_${suffix.toLowerCase()}@example.com`;
  const usernameSuccess = `tch_auth_${suffix.toLowerCase()}`;
  const usernameTaken = `tch_taken_${suffix.toLowerCase()}`;

  // Ensure an existing course ID and a dummy course ID are available in Course table for subjects check
  let courseId = "CRS-TEST-" + suffix;
  try {
    // Dynamically insert a course type/segment first to comply with academic integrity
    let segmentId = "SEG-TEST-" + suffix;
    db.CourseType.insert({
      segment_id: segmentId,
      segment_name: "Test Onboarding Segment",
      status: "active"
    });
    db.Course.insert({
      course_id: courseId,
      segment_id: segmentId,
      name: "Subject Verification 101",
      language_medium: "English",
      base_fee: 4500
    });
    console.log(`✅ Set up mock Course '${courseId}' for subject mapping tests.`);
  } catch (e) {
    console.warn(`[Test Setup] Mock course setup warning: ${e.message}`);
  }

  // ==========================================
  // CASE 1: Full Onboarding Success Flow
  // ==========================================
  console.log("\n--- [CASE 1] Success Flow (Complete Relational Creation) ---");
  const successPayload = {
    full_name: `Professor Moni ${suffix}`,
    mobile_number: mobileSuccess,
    email: emailSuccess,
    experience_years: 6,
    qualification: "Ph.D. in Computer Science",
    teacher_type: "full_time",
    joining_date: "2026-05-17",
    status: "active",
    userData: {
      username: usernameSuccess,
      password: "StrongSecurePassword123!"
    },
    salary_config: {
      salary_type: "monthly",
      base_amount: 85000,
      effective_from: "2026-05-17"
    },
    subjects: [courseId],
    documents: [
      { document_type: "resume", file_url: "https://dazzling.erp/docs/resume.pdf" },
      { document_type: "id_proof", file_url: "https://dazzling.erp/docs/id.png" }
    ]
  };

  try {
    const teacher = StaffService.onboardTeacher(successPayload);
    console.log(`✅ Success Flow: Teacher successfully registered with ID: ${teacher.teacher_id}`);

    // Verify all relational sheets have been physically populated
    const user = db.User.findById(teacher.teacher_id);
    if (user && user.username === usernameSuccess) {
      console.log("  ✅ Relational Check: Auth User created and synched under the same ID.");
    } else {
      console.error("  ❌ Relational Check: Auth User not found or incorrect ID sync.");
    }

    const salaryConfigs = db.TeacherSalaryConfig.where({ teacher_id: teacher.teacher_id });
    if (salaryConfigs.length > 0 && salaryConfigs[0].base_amount === 85000) {
      console.log("  ✅ Relational Check: TeacherSalaryConfig successfully registered.");
    } else {
      console.error("  ❌ Relational Check: TeacherSalaryConfig verification failed.");
    }

    const subjects = db.TeacherSubject.where({ teacher_id: teacher.teacher_id });
    if (subjects.length === 1 && subjects[0].subject_id === courseId) {
      console.log("  ✅ Relational Check: TeacherSubject successfully mapped.");
    } else {
      console.error("  ❌ Relational Check: TeacherSubject mapping verification failed.");
    }

    const documents = db.TeacherDocument.where({ teacher_id: teacher.teacher_id });
    if (documents.length === 2) {
      console.log("  ✅ Relational Check: All Onboarding Documents attached correctly.");
    } else {
      console.error("  ❌ Relational Check: Documents count verification failed.");
    }

  } catch (e) {
    console.error("❌ Success Flow failed unexpected:", e.message);
  }

  // ==========================================
  // CASE 2: Preflight Fast-Fail (Duplicate Mobile)
  // ==========================================
  console.log("\n--- [CASE 2] Preflight Fast-Fail (Duplicate Mobile Number) ---");
  const dupMobilePayload = {
    full_name: "Duplicate Mobile Teacher",
    mobile_number: mobileSuccess, // already used in Case 1
    experience_years: 2,
    teacher_type: "part_time",
    joining_date: "2026-05-17"
  };

  try {
    StaffService.onboardTeacher(dupMobilePayload);
    console.error("❌ Verification failed: onboardTeacher should have rejected duplicate mobile number.");
  } catch (e) {
    if (e instanceof SheetDB.ValidationError) {
      console.log(`✅ Preflight check passed: Correctly rejected duplicate mobile with ValidationError.`);
      console.log(`  Detailed field errors: ${JSON.stringify(e.context.fields, null, 2)}`);
    } else {
      console.error(`❌ Preflight check failed: Caught unexpected error type: ${e.name} (${e.message})`);
    }
  }

  // ==========================================
  // CASE 3: Preflight Fast-Fail (Invalid Course/Subject ID)
  // ==========================================
  console.log("\n--- [CASE 3] Preflight Fast-Fail (Invalid Subject Course ID) ---");
  const badSubjectPayload = {
    full_name: "Bad Subject Teacher",
    mobile_number: mobileDuplicate,
    experience_years: 4,
    teacher_type: "guest",
    joining_date: "2026-05-17",
    subjects: ["NON-EXISTENT-COURSE"]
  };

  try {
    StaffService.onboardTeacher(badSubjectPayload);
    console.error("❌ Verification failed: onboardTeacher should have rejected invalid subject ID.");
  } catch (e) {
    if (e instanceof SheetDB.ValidationError) {
      console.log(`✅ Preflight check passed: Correctly rejected invalid Course ID with ValidationError.`);
      console.log(`  Detailed field errors: ${JSON.stringify(e.context.fields, null, 2)}`);
    } else {
      console.error(`❌ Preflight check failed: Caught unexpected error type: ${e.name} (${e.message})`);
    }
  }

  // ==========================================
  // CASE 4: Transaction Failure & Reverse Rollback
  // ==========================================
  console.log("\n--- [CASE 4] Transaction Failure & Reverse Rollback ---");
  
  // First, let's create a user directly so the username is taken
  try {
    AuthBridge.registerUser({
      username: usernameTaken,
      password: "StrongSecurePassword123!",
      role: "teacher"
    });
    console.log(`[Test Setup] Registered pre-occupied user '${usernameTaken}' to force failure.`);
  } catch(e) {
    console.warn(`[Test Setup] Pre-occupied user setup warning: ${e.message}`);
  }

  const rollbackPayload = {
    full_name: "Rollback Candidate Teacher",
    mobile_number: mobileDuplicate,
    experience_years: 10,
    teacher_type: "full_time",
    joining_date: "2026-05-17",
    userData: {
      username: usernameTaken,
      password: "AnotherPassword123!"
    }
  };

  try {
    StaffService.onboardTeacher(rollbackPayload);
    console.error("❌ Verification failed: onboardTeacher should have failed due to pre-taken username.");
  } catch (e) {
    if (e instanceof SheetDB.ValidationError) {
      console.log(`✅ Onboard call failed as expected with ValidationError: ${e.message}`);
      console.log(`  Detailed field errors: ${JSON.stringify(e.context.fields, null, 2)}`);
    } else {
      console.error(`❌ Caught unexpected error type: ${e.name} (${e.message})`);
    }

    // Verify Rollback succeeded (No Teacher record must remain)
    const teachers = db.Teacher.where({ mobile_number: mobileDuplicate });
    if (teachers.length === 0) {
      console.log("✅ ACID Transactional Rollback verified: Teacher row was successfully deleted or prevented from insertion, keeping pristine state.");
    } else {
      console.error(`❌ ACID Rollback failed: An orphaned Teacher record remains with ID ${teachers[0].teacher_id}!`);
      
      // Cleanup orphan physically to prevent dirtying test sheets
      try {
        db.Teacher.remove(teachers[0].teacher_id);
        console.log("  [Cleanup] Cleaned up orphaned teacher record.");
      } catch(cleanupErr) {
        console.error("  [Cleanup] Failed to clean up orphaned teacher record:", cleanupErr.message);
      }
    }
  }

  console.log("\n🏁 Onboard Teacher Transactional Test Suite Complete.");
}
