/**
 * @file StudentRegistration_ApiTest.js
 * API Test for Academic Setup and Student Registration using ApiTestHelper.
 * 
 * Instructions: Run `StudentRegistration_ApiTest.run()` from the Apps Script editor.
 */

const StudentRegistration_ApiTest = (function () {

  function run() {
    const { logger, callApi } = ApiTestHelper;

    console.log("\n🧪 STARTING STUDENT REGISTRATION API TEST SUITE 🧪");

    const superToken = typeof PropertiesService !== "undefined"
      ? PropertiesService.getScriptProperties().getProperty("DEV_SUPER_TOKEN")
      : null;

    if (!superToken) {
      logger.detail("⚠️ DEV_SUPER_TOKEN not found. Running without token...");
    } else {
      logger.success("🔑 Bootstrapped Super Token loaded.");
    }

    let createdCourseTypeId = null;
    let createdCourseId = null;
    let createdBatchId = null;
    let createdStudentId = null;
    let envelopeStudentId = null;
    let enrollmentId = null;

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
      // Phase 0: Academic Environment Setup
      let academicData;
      runScenario("Phase 0: Academic Environment Setup", () => {
        academicData = _setupAcademicEnvironment(logger, callApi, superToken);
        createdCourseTypeId = academicData.courseType.segment_id;
        createdCourseId = academicData.course.course_id;
        createdBatchId = academicData.batch.batch_id;
      });

      // Phase 1: Student Registration (Happy Path)
      let regResult;
      runScenario("Phase 1: Student Registration (Happy Path)", () => {
        regResult = _registerStudent(academicData, logger, callApi, superToken);
        createdStudentId = regResult.studentId;
        enrollmentId = regResult.enrollmentId;
      });

      // Phase 2: Verification of hydrated relation retrieval
      runScenario("Phase 2: Hydration Verification", () => {
        _verifyData(createdStudentId, logger, callApi, superToken);
      });

      // Phase 3: Validation / Negative Flow Checks
      runScenario("Phase 3: Validation / Negative Flows", () => {
        _testValidation(logger, superToken, regResult.email, createdCourseId);
      });

      // Phase 4: ORM Update check
      runScenario("Phase 4: ORM Update Check", () => {
        _testUpdate(createdStudentId, logger);
      });

      // Phase 5: Response Envelope Format checking
      runScenario("Phase 5: Response Envelope Formats", () => {
        envelopeStudentId = _testResponseEnvelopeFormats(logger, superToken);
      });

      console.log("\n🎉 API TEST SUITE COMPLETED SUCCESSFULLY! 🎉\n");
    } catch (error) {
      ApiTestHelper.logger.error(`API Test Suite Failed: ${error.message}`);
    } finally {
      // Print Summary before Teardown
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

      logger.phase("N: Teardown and Cleanup");
      const db = DBContext.getInstance();

      // 1. Delete Student-related records
      const studentIds = [createdStudentId, envelopeStudentId];
      studentIds.forEach(id => {
        if (id) {
          // LIFO: Enrollments first
          try {
            db.Enrollment.where({ student_id: id }).forEach(e => {
              db.Enrollment.remove(e.enrollment_id);
            });
          } catch (_) {}
          // Address & Contact Info
          try {
            const addr = db.Address.findOne({ student_id: id });
            if (addr) db.Address.remove(addr.address_id);
          } catch (_) {}
          try {
            const contact = db.ContactInfo.findOne({ student_id: id });
            if (contact) db.ContactInfo.remove(contact.contact_id);
          } catch (_) {}
          // Finally student record itself
          try {
            db.Student.remove(id);
            logger.success(`Cleaned up student record: ${id}`);
          } catch (err) {
            logger.error(`Failed to clean up student ${id}: ${err.message}`);
          }
        }
      });

      // 2. Delete Academic Setup records
      if (createdBatchId) {
        try {
          db.Batch.remove(createdBatchId);
        } catch (_) {}
      }
      if (createdCourseId) {
        try {
          db.Course.remove(createdCourseId);
        } catch (_) {}
      }
      if (createdCourseTypeId) {
        try {
          db.CourseType.remove(createdCourseTypeId);
        } catch (_) {}
      }
      logger.success("Teardown completed successfully.");
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

  function _setupAcademicEnvironment(logger, callApi, superToken) {
    logger.phase("0: Resolve Academic Setup Dependencies");

    const suffix = Math.random().toString(36).substring(7).toUpperCase();

    logger.action("Creating Course Type...");
    const courseType = callApi("academic_create_course_type", {
      segment_name: `Academic_API_Test_${suffix}`,
      entity_label: "Subject",
      description: "Temporary segment for API testing."
    }, superToken);
    logger.success(`Course Type Created with ID: ${courseType.segment_id}`);

    logger.action("Creating Course...");
    const course = callApi("academic_create_course", {
      segment_id: courseType.segment_id,
      name: `API Test Mathematics ${suffix}`,
      base_fee: 1000,
      language_medium: "English",
      entity_type: "subject"
    }, superToken);
    logger.success(`Course Created with ID: ${course.course_id}`);

    logger.action("Creating Batch...");
    const batch = callApi("academic_create_batch", {
      course_id: course.course_id,
      batch_name: `API Test Batch A ${suffix}`,
      batch_type: "Academy",
      capacity: 20
    }, superToken);
    logger.success(`Batch Created with ID: ${batch.batch_id}`);

    return { courseType, course, batch };
  }

  function _registerStudent(academicData, logger, callApi, superToken) {
    logger.phase("1: Student Registration (Happy Path)");

    const suffix = Math.random().toString(36).substring(7).toUpperCase();
    const uniqueEmail = `api.test.${suffix.toLowerCase()}@example.com`;
    const uniqueMobile = "9" + Math.floor(100000000 + Math.random() * 900000000);

    const regPayload = {
      profile: {
        student_name: `API Test Student ${suffix}`,
        email: uniqueEmail,
        gender: "Female",
        dob: "2008-08-08"
      },
      address: {
        line1: "456 Automation Lane",
        city: "Pune",
        state: "Maharashtra",
        pin_code: "411001"
      },
      contact: {
        mobile_number: uniqueMobile
      }
    };

    logger.action("Executing Student Registration...");
    const student = callApi("student_register", regPayload, superToken);
    logger.success(`Student Registered with ID: ${student.student_id}`);

    logger.action("Enrolling Student...");
    const enrollment = callApi("academic_enroll_student", {
      student_id: student.student_id,
      enrollment_type: "course",
      item_id: academicData.course.course_id,
      batch_id: academicData.batch.batch_id
    }, superToken);
    logger.success(`Student Enrolled Successfully, ID: ${enrollment.enrollment_id}`);

    return { studentId: student.student_id, enrollmentId: enrollment.enrollment_id, email: uniqueEmail };
  }

  function _verifyData(studentId, logger, callApi, superToken) {
    logger.phase("2: Query Verification & Hydration checks");

    const queryPayload = {
      target: "Student",
      where: { student_id: studentId },
      include: {
        address: {},
        contact: {},
        enrollments: {}
      }
    };

    logger.action("Fetching Student Profile via QueryEngine...");
    const result = callApi("data_query", queryPayload, superToken);

    if (!result || !result.data || result.data.length === 0) {
      throw new Error("Student not found in query results.");
    }

    const student = result.data[0];
    
    // Validate hydration types
    if (typeof student.address !== "object" || Array.isArray(student.address)) {
      throw new Error("Address was not correctly hydrated as a single object.");
    }
    if (typeof student.contact !== "object" || Array.isArray(student.contact)) {
      throw new Error("Contact was not correctly hydrated as a single object.");
    }
    if (!Array.isArray(student.enrollments)) {
      throw new Error("Enrollments were not correctly hydrated as an array.");
    }

    logger.data("Hydrated Student Data", {
      name: student.student_name,
      city: student.address ? student.address.city : "MISSING",
      enrollments_count: student.enrollments ? student.enrollments.length : 0
    });
    logger.success("Verification successful.");
  }

  function _testValidation(logger, superToken, registeredEmail, courseId) {
    logger.phase("3: Validate Required Parameter Checks (Negative Flows)");

    // Case 1: Missing profile object entirely
    logger.action("Testing missing profile object...");
    const resNoProfile = _dispatch("student_register", { address: {}, contact: {} }, superToken);
    if (resNoProfile.success !== false) {
      throw new Error("Validation failed: student_register succeeded without profile data.");
    }
    logger.success(`Correctly blocked missing profile: ${resNoProfile.error.message}`);

    // Case 2: Missing student_name inside profile
    logger.action("Testing missing student_name in profile...");
    const resNoName = _dispatch("student_register", {
      profile: { email: "no-name@example.com" }
    }, superToken);
    if (resNoName.success !== false) {
      throw new Error("Validation failed: student_register succeeded without student_name.");
    }
    logger.success(`Correctly blocked missing student_name: ${resNoName.error.message}`);

    // Case 3: Invalid gender choice constraint failure
    logger.action("Testing invalid gender choice...");
    const resBadGender = _dispatch("student_register", {
      profile: { student_name: "Invalid Gender User", gender: "Alien" }
    }, superToken);
    if (resBadGender.success !== false) {
      throw new Error("Validation failed: student_register succeeded with invalid gender choice.");
    }
    logger.success(`Correctly blocked invalid gender: ${resBadGender.error.message}`);

    // Case 4: Non-existent batch ID (ENTITY_NOT_FOUND)
    logger.action("Testing non-existent batch ID lookup...");
    const resBadBatch = _dispatch("student_register", {
      profile: { student_name: "Bad Batch Student", email: "badbatch@example.com" },
      enrollments: [{ enrollment_type: "course", item_id: courseId, batch_id: "BAT-NONEXISTENT", fee: 1000 }],
      feeAccount: { total_fee: 1000 }
    }, superToken);
    if (resBadBatch.success !== false || resBadBatch.error.code !== "ENTITY_NOT_FOUND") {
      throw new Error(`Expected success=false and code=ENTITY_NOT_FOUND, got: ${JSON.stringify(resBadBatch)}`);
    }
    logger.success(`Correctly blocked non-existent batch: ${resBadBatch.error.message}`);

    // Case 5: Duplicate student email constraint check
    logger.action("Testing duplicate email unique constraint...");
    const resDuplicateEmail = _dispatch("student_register", {
      profile: { student_name: "Duplicate Email Student", email: registeredEmail }
    }, superToken);
    if (resDuplicateEmail.success !== false) {
      throw new Error("Validation failed: student_register succeeded with duplicate email.");
    }
    logger.success(`Correctly blocked duplicate email constraint: ${resDuplicateEmail.error.message}`);

    // Case 6: Non-existent course ID (ENTITY_NOT_FOUND)
    logger.action("Testing non-existent course ID lookup...");
    const resBadCourse = _dispatch("student_register", {
      profile: { student_name: "Bad Course Student", email: "badcourse@example.com" },
      enrollments: [{ enrollment_type: "course", item_id: "CRS-NONEXISTENT", batch_id: "BAT-ANY", fee: 1000 }],
      feeAccount: { total_fee: 1000 }
    }, superToken);
    if (resBadCourse.success !== false || resBadCourse.error.code !== "ENTITY_NOT_FOUND") {
      throw new Error(`Expected success=false and code=ENTITY_NOT_FOUND, got: ${JSON.stringify(resBadCourse)}`);
    }
    logger.success(`Correctly blocked non-existent course: ${resBadCourse.error.message}`);
  }

  function _testUpdate(studentId, logger) {
    logger.phase("4: ORM Structural Check (Update)");

    const db = DBContext.getInstance();

    logger.action(`Testing ORM Update...`);
    const updated = db.Student.update(studentId, { student_name: "API Updated Name" });
    if (updated.student_name !== "API Updated Name") {
      throw new Error("ORM Update failed.");
    }
    logger.success("ORM Update Passed");
  }

  function _testResponseEnvelopeFormats(logger, superToken) {
    logger.phase("5: Test Success & Failure Response Envelope Formats");

    // A. Verify Happy-Path Success Envelope Format
    logger.action("Verifying happy-path success envelope format...");
    const suffix = Math.random().toString(36).substring(7).toUpperCase();
    const uniqueEmail = `envelope.reg.${suffix.toLowerCase()}@example.com`;
    const uniqueMobile = "9" + Math.floor(100000000 + Math.random() * 900000000);

    const payload = {
      profile: {
        student_name: `Envelope Reg Student ${suffix}`,
        email: uniqueEmail,
        gender: "Male"
      },
      address: {
        line1: "789 Envelope Lane",
        city: "Pune",
        state: "Maharashtra",
        pin_code: "411001"
      },
      contact: {
        mobile_number: uniqueMobile
      }
    };

    const successRes = _dispatch("student_register", payload, superToken);

    logger.data("Success Envelope Output", successRes);

    if (successRes.success !== true) {
      throw new Error(`Expected success envelope success property to be true, got: ${successRes.success}`);
    }
    if (!successRes.data || !successRes.data.student_id) {
      throw new Error("Success envelope missing data.student_id");
    }
    if (!successRes.data._presentation || !successRes.data._presentation.toast_message) {
      throw new Error("Success envelope missing data._presentation.toast_message");
    }
    if (typeof successRes.context.execution_time_ms !== "number") {
      throw new Error(`Success envelope missing or invalid context.execution_time_ms: ${successRes.context.execution_time_ms}`);
    }
    if (successRes.context.mutated_records_count === undefined) {
      throw new Error("Success envelope missing context.mutated_records_count");
    }
    if (!Array.isArray(successRes.context.mutated_records)) {
      throw new Error("Success envelope missing context.mutated_records array");
    }
    if (!successRes.meta || !successRes.meta.environment || !successRes.meta.timestamp) {
      throw new Error("Success envelope missing meta block properties");
    }

    logger.success("Success response envelope conforms to standard.");

    // B. Verify Failure Envelope Format
    logger.action("Verifying validation-failure envelope format...");
    const failureRes = _dispatch("student_register", {}, superToken);

    logger.data("Failure Envelope Output", failureRes);

    if (failureRes.success !== false) {
      throw new Error(`Expected failure envelope success property to be false, got: ${failureRes.success}`);
    }
    if (!failureRes.error || failureRes.error.code !== "ACTION_VALIDATION_FAILURE") {
      throw new Error(`Expected error.code 'ACTION_VALIDATION_FAILURE', got: ${failureRes.error ? failureRes.error.code : 'undefined'}`);
    }
    if (!failureRes.error.message) {
      throw new Error("Failure envelope missing error.message");
    }
    if (typeof failureRes.context.execution_time_ms !== "number") {
      throw new Error(`Failure envelope missing or invalid context.execution_time_ms: ${failureRes.context.execution_time_ms}`);
    }
    if (!failureRes.meta || !failureRes.meta.correlation_id || !failureRes.meta.timestamp) {
      throw new Error("Failure envelope missing meta block properties");
    }

    logger.success("Failure response envelope conforms to standard.");

    return successRes.data.student_id;
  }

  return {
    run: run
  };

})();

function runTest() {
  StudentRegistration_ApiTest.run();
}

