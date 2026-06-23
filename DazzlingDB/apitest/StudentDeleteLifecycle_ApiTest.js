/**
 * @file StudentDeleteLifecycle_ApiTest.js
 * API Integration Test verifying user registration, login failure messages, login token caching,
 * academic dependency setup, student registration, and permission-based student deletion.
 * 
 * Instructions: Run `runStudentDeleteLifecycleTest()` from the Apps Script editor.
 */

const StudentDeleteLifecycle_ApiTest = (function () {

  function run() {
    const { logger, callApi } = ApiTestHelper;
    console.log("\n🧪 STARTING STUDENT DELETE LIFECYCLE API TEST SUITE 🧪");

    const initialEnv = typeof PropertiesService !== "undefined"
      ? resolveEnvironmentType(PropertiesService.getScriptProperties().getProperty("ENV"))
      : Environment.DEVELOPMENT;

    if (initialEnv === Environment.PRODUCTION) {
      throw new Error("❌ Safety Guard: Test suite cannot be executed in the PRODUCTION environment.");
    }

    // Dynamic credentials suffix to prevent run-to-run collisions
    const suffix = Math.random().toString(36).substring(7).toUpperCase();
    const adminUsername = `admin_${suffix.toLowerCase()}`;
    const adminEmail = `admin.${suffix.toLowerCase()}@example.com`;
    const adminPassword = "password123!Admin";

    // Track created entities for LIFO teardown
    let createdUserId = null;
    let createdToken = null;
    let createdCourseTypeId = null;
    let createdCourseId = null;
    let createdBatchId = null;
    let createdTeacherId = null;
    let createdStudentId = null;
    let createdEnrollmentId = null;

    const stats = { passed: 0, failed: 0, scenarios: [] };

    function runScenario(name, fn) {
      try {
        fn();
        stats.passed++;
        stats.scenarios.push({ name: name, status: "PASSED" });
      } catch (error) {
        stats.failed++;
        stats.scenarios.push({ name: name, status: "FAILED", error: error.message });
        throw error;
      }
    }

    try {
      // Phase 0: Sandbox Environment Setup
      runScenario("Phase 0: Sandbox Environment Setup", () => {
        logger.phase("0: Initialize TESTING Environment");
        if (typeof PropertiesService !== "undefined") {
          PropertiesService.getScriptProperties().setProperty("ENV", Environment.TESTING);
        }
        DBContext.getInstance().bootstrapRepositories();
        logger.success("Environment set to TESTING and repositories bootstrapped.");
      });

      // Phase 1: User Registration & Authentication Verification
      runScenario("Phase 1: User Registration & Auth Check", () => {
        logger.phase("1: User Registration & Auth Verification");

        // 1. Register User (role: admin)
        logger.action(`Registering admin user: ${adminUsername}`);
        const regResult = callApi("user_register", {
          username: adminUsername,
          password: adminPassword,
          email: adminEmail,
          role: "admin"
        });
        createdUserId = regResult.user_id;
        logger.success(`Admin user registered successfully with ID: ${createdUserId}`);

        // 2. Verify Authentication Failure with Wrong Credentials (using Mode B _dispatch to check code/envelope)
        logger.action("Testing login with wrong password...");
        const loginFailRes = _dispatch("user_login", {
          username: adminUsername,
          password: "wrongPassword"
        });

        if (loginFailRes.success !== false) {
          throw new Error("Login succeeded with incorrect credentials.");
        }
        if (!loginFailRes.error || loginFailRes.error.code !== "AUTHENTICATION_FAILURE") {
          throw new Error(`Expected error code 'AUTHENTICATION_FAILURE', got: ${loginFailRes.error ? loginFailRes.error.code : "none"}`);
        }
        if (loginFailRes.error.message !== "Invalid username or password.") {
          throw new Error(`Expected 'Invalid username or password.', got: '${loginFailRes.error.message}'`);
        }
        logger.success(`Verified: authentication error handled and error code mapped correctly: ${loginFailRes.error.code} - ${loginFailRes.error.message}`);

        // 3. Login with Correct Credentials and Cache Token
        logger.action("Testing login with correct credentials...");
        const loginSuccessRes = _dispatch("user_login", {
          username: adminUsername,
          password: adminPassword
        });

        if (!loginSuccessRes.success) {
          throw new Error(`Login failed with correct credentials: ${loginSuccessRes.error?.message}`);
        }
        createdToken = loginSuccessRes.data.token;
        logger.success(`Login successful! Token generated.`);

        // Cache it with TESTING_* key
        if (typeof PropertiesService !== "undefined") {
          PropertiesService.getScriptProperties().setProperty("TESTING_AUTH_TOKEN", createdToken);
        }
        logger.success(`Token cached in ScriptProperties under key: TESTING_AUTH_TOKEN`);
      });

      // Phase 2: Academic Dependency Setup
      runScenario("Phase 2: Academic Dependency Setup", () => {
        logger.phase("2: Academic Setup (CourseType, Course, Batch, Teacher)");

        // 1. Create Course Type
        logger.action("Creating Course Type...");
        const courseType = callApi("academic_create_course_type", {
          segment_name: `DeleteTest_Seg_${suffix}`,
          entity_label: "Subject",
          description: "Temporary CourseType for Delete Lifecycle tests"
        }, createdToken);
        createdCourseTypeId = courseType.segment_id;
        logger.success(`CourseType created: ${createdCourseTypeId}`);

        // 2. Create Course
        logger.action("Creating Course...");
        const course = callApi("academic_create_course", {
          segment_id: createdCourseTypeId,
          name: `DeleteTest_Course_${suffix}`,
          base_fee: 500,
          language_medium: "English",
          entity_type: "subject"
        }, createdToken);
        createdCourseId = course.course_id;
        logger.success(`Course created: ${createdCourseId}`);

        // 3. Create Batch
        logger.action("Creating Batch...");
        const batch = callApi("academic_create_batch", {
          course_id: createdCourseId,
          batch_name: `DeleteTest_Batch_${suffix}`,
          batch_type: "Academy",
          capacity: 10
        }, createdToken);
        createdBatchId = batch.batch_id;
        logger.success(`Batch created: ${createdBatchId}`);

        // 4. Onboard Teacher
        logger.action("Onboarding Teacher...");
        const uniqueMobile = "9" + Math.floor(100000000 + Math.random() * 900000000);
        const uniqueEmail = `teacher_${suffix.toLowerCase()}@example.com`;
        const teacherRes = callApi("staff_onboard_teacher", {
          full_name: `DeleteTest_Teacher_${suffix}`,
          mobile_number: uniqueMobile,
          email: uniqueEmail,
          gender: "female",
          date_of_birth: "1990-01-01",
          experience_years: 3,
          qualification: "B.Sc",
          specialization: "Science",
          teacher_type: "full_time",
          joining_date: "2026-06-21",
          status: "active",
          userData: {
            username: `teacher_${suffix.toLowerCase()}`,
            password: "TeacherPassword123!",
            email: uniqueEmail
          },
          salary_config: {
            salary_type: "monthly",
            base_amount: 20000,
            effective_from: "2026-06-21"
          },
          subjects: [createdCourseId],
          documents: []
        }, createdToken);
        createdTeacherId = teacherRes.teacher_id;
        logger.success(`Teacher onboarded: ${createdTeacherId}`);
      });

      // Phase 3: Student Registration
      runScenario("Phase 3: Student Registration", () => {
        logger.phase("3: Register & Enroll Student");

        const studentEmail = `student_${suffix.toLowerCase()}@example.com`;
        const studentMobile = "9" + Math.floor(100000000 + Math.random() * 900000000);

        logger.action("Registering Student...");
        const student = callApi("student_register", {
          profile: {
            student_name: `DeleteTest_Student_${suffix}`,
            email: studentEmail,
            gender: "Male",
            dob: "2007-07-07"
          },
          address: {
            line1: "123 Delete Street",
            city: "Pune",
            state: "Maharashtra",
            pin_code: "411001"
          },
          contact: {
            mobile_number: studentMobile
          }
        }, createdToken);
        createdStudentId = student.student_id;
        logger.success(`Student registered successfully with ID: ${createdStudentId}`);

        logger.action("Enrolling Student into Batch...");
        const enrollment = callApi("academic_enroll_student", {
          student_id: createdStudentId,
          enrollment_type: "course",
          item_id: createdCourseId,
          batch_id: createdBatchId
        }, createdToken);
        createdEnrollmentId = enrollment.enrollment_id;
        logger.success(`Student enrolled with ID: ${createdEnrollmentId}`);
      });

      // Phase 4: Student Deletion Scenarios
      runScenario("Phase 4: Student Deletion Scenarios", () => {
        logger.phase("4: Execute Delete Authorization Checks");

        // Case 1: Delete attempt with wrong token or credentials
        logger.action(`Case 1: Attempting delete student with id ${createdStudentId} with wrong token...`);
        const deleteFailRes = _dispatch("student_delete", {
          student_id: createdStudentId,
          dryRun: false
        }, "WRONG_TOKEN_VALUE");

        if (deleteFailRes.success !== false) {
          throw new Error("Deletion succeeded despite using an invalid token.");
        }
        if (!deleteFailRes.error || deleteFailRes.error.code !== "FORBIDDEN_ACCESS") {
          throw new Error(`Expected error.code 'FORBIDDEN_ACCESS', got: ${deleteFailRes.error ? deleteFailRes.error.code : "none"}`);
        }
        logger.success(`Case 1 Passed: Deletion blocked correctly with code: ${deleteFailRes.error.code}`);

        // Case 2: Delete attempt with correct cached token
        logger.action("Case 2: Attempting delete with correct cached TESTING_AUTH_TOKEN...");
        const deleteSuccessRes = _dispatch("student_delete", {
          student_id: createdStudentId,
          dryRun: false
        }, createdToken);

        if (!deleteSuccessRes.success) {
          throw new Error(`Deletion failed with correct token: ${deleteSuccessRes.error?.message}`);
        }
        logger.success("Case 2 Passed: Student deleted successfully via DeleteStudentAction.");
      });

      console.log("\n🎉 API TEST SUITE COMPLETED SUCCESSFULLY! 🎉\n");

    } catch (error) {
      ApiTestHelper.logger.error(`API Test Suite Failed: ${error.message}`);
    } finally {
      // Teardown and Cleanup in LIFO order
      logger.phase("N: Teardown and Cleanup");
      const db = DBContext.getInstance();

      // Clean student records if deletion failed or partial
      if (createdStudentId) {
        try {
          db.Enrollment.where({ student_id: createdStudentId }).forEach(e => {
            db.Enrollment.remove(e.enrollment_id);
          });
        } catch (_) { }
        try {
          const addr = db.Address.findOne({ student_id: createdStudentId });
          if (addr) db.Address.remove(addr.address_id);
        } catch (_) { }
        try {
          const contact = db.ContactInfo.findOne({ student_id: createdStudentId });
          if (contact) db.ContactInfo.remove(contact.contact_id);
        } catch (_) { }
        try {
          db.Student.remove(createdStudentId);
        } catch (_) { }
      }

      // Clean Teacher
      if (createdTeacherId) {
        try {
          db.TeacherSubject.where({ teacher_id: createdTeacherId }).forEach(ts => {
            db.TeacherSubject.remove(ts.teacher_subject_id);
          });
        } catch (_) { }
        try {
          db.TeacherSalaryConfig.where({ teacher_id: createdTeacherId }).forEach(tsc => {
            db.TeacherSalaryConfig.remove(tsc.teacher_salary_config_id);
          });
        } catch (_) { }
        try {
          db.Teacher.remove(createdTeacherId);
        } catch (_) { }
      }

      // Clean Academic dependencies
      if (createdBatchId) {
        try { db.Batch.remove(createdBatchId); } catch (_) { }
      }
      if (createdCourseId) {
        try { db.Course.remove(createdCourseId); } catch (_) { }
      }
      if (createdCourseTypeId) {
        try { db.CourseType.remove(createdCourseTypeId); } catch (_) { }
      }

      // Clean User and Sessions
      if (createdUserId) {
        try {
          db.Session.where({ user_id: createdUserId }).forEach(s => {
            db.Session.remove(s.session_id);
          });
        } catch (_) { }
        try { db.User.remove(createdUserId); } catch (_) { }
      }

      // Clean properties and restore environment
      if (typeof PropertiesService !== "undefined") {
        PropertiesService.getScriptProperties().deleteProperty("TESTING_AUTH_TOKEN");
        PropertiesService.getScriptProperties().setProperty("ENV", initialEnv);
      }
      logger.success("Cleaned up database records and restored script environment properties.");

      // Print Summary
      console.log("\n=========================================");
      console.log("📊 API TEST RUNNER SUMMARY:");
      console.log(`   - Scenarios Run     : ${stats.passed + stats.failed}`);
      console.log(`   - Successful Steps  : ${stats.passed}`);
      console.log(`   - Failed Steps      : ${stats.failed}`);
      console.log("\n   - Details:");
      stats.scenarios.forEach((s) => {
        const marker = s.status === "PASSED" ? "✅" : "❌";
        console.log(`     ${marker} ${s.name} : ${s.status}`);
        if (s.error) {
          console.log(`         ↳ Error: ${s.error}`);
        }
      });
      console.log("=========================================\n");
    }
  }

  function _dispatch(action, payload, token = null) {
    const mockEvent = {
      postData: {
        contents: JSON.stringify({ action, token, payload })
      }
    };
    const output = ApiDispatcher.dispatch(mockEvent);
    return output.getContent ? JSON.parse(output.getContent()) : output;
  }

  return {
    run: run
  };

})();

function runStudentDeleteLifecycleTest() {
  StudentDeleteLifecycle_ApiTest.run();
}
