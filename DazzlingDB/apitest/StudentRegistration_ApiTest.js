/**
 * @file StudentRegistration_ApiTest.js
 * API Test for Academic Setup and Student Registration using ApiTestHelper.
 * 
 * Instructions: Run `StudentRegistration_ApiTest.run()` from the Apps Script editor.
 */

const StudentRegistration_ApiTest = (function () {

  function run() {
    // Destructure the helper utilities
    const { logger, callApi } = ApiTestHelper;

    console.log("\n🧪 STARTING STUDENT REGISTRATION API TEST SUITE 🧪");

    try {
      const academicData = _setupAcademicEnvironment(logger, callApi);
      const studentId = _registerStudent(academicData, logger, callApi);
      _verifyData(studentId, logger, callApi);
      _testUpdateAndDelete(studentId, logger);

      console.log("\n🎉 API TEST SUITE COMPLETED SUCCESSFULLY! 🎉\n");
    } catch (error) {
      // Utilizing the globally available logger if destructured locally failed
      ApiTestHelper.logger.error(`API Test Suite Failed: ${error.message}`);
    }
  }

  function _setupAcademicEnvironment(logger, callApi) {
    logger.phase("1: Academic Setup (API Test)");

    logger.action("Creating Course Type...");
    const courseType = callApi("academic_create_course_type", {
      segment_name: "Academic_API_Test",
      entity_label: "Subject",
      description: "Temporary segment for API testing."
    });
    logger.success(`Course Type Created with ID: ${courseType.segment_id}`);

    logger.action("Creating Course...");
    const course = callApi("academic_create_course", {
      segment_id: courseType.segment_id,
      name: "API Test Mathematics",
      base_fee: 1000,
      language_medium: "English",
      entity_type: "subject"
    });
    logger.success(`Course Created with ID: ${course.course_id}`);

    logger.action("Creating Batch...");
    const batch = callApi("academic_create_batch", {
      item_id: course.course_id,
      batch_name: "API Test Batch A",
      batch_type: "Academy",
      capacity: 20
    });
    logger.success(`Batch Created with ID: ${batch.batch_id}`);

    return { courseType, course, batch };
  }

  function _registerStudent(academicData, logger, callApi) {
    logger.phase("2: Student Registration");

    const regPayload = {
      profile: {
        student_name: "API Test Student",
        email: "api.test." + Date.now() + "@example.com",
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
        mobile_number: "9876543210"
      }
    };

    logger.action("Executing Student Registration...");
    const student = callApi("student_register", regPayload);
    logger.success(`Student Registered with ID: ${student.student_id}`);

    logger.action("Enrolling Student...");
    callApi("academic_enroll_student", {
      student_id: student.student_id,
      item_id: academicData.course.course_id,
      batch_id: academicData.batch.batch_id
    });
    logger.success("Student Enrolled Successfully");

    return student.student_id;
  }

  function _verifyData(studentId, logger, callApi) {
    logger.phase("3: Query Verification");

    const queryPayload = {
      target: "Student",
      where: { student_id: studentId },
      include: {
        address: {},
        contact: {},
        enrollments: {
          include: {
            batch: {
              include: {
                course: {}
              }
            }
          }
        }
      }
    };

    logger.action("Fetching Student Profile via QueryEngine...");
    const result = callApi("data_query", queryPayload);

    if (result.data.length === 0) throw new Error("Student not found in query results.");

    const student = result.data[0];
    logger.data("Hydrated Student", {
      name: student.student_name,
      city: student.address ? student.address.city : "MISSING",
      course: (student.enrollments[0] && student.enrollments[0].batch.course) ? student.enrollments[0].batch.course.name : "MISSING"
    });
    logger.success("Verification successful.");
  }

  function _testUpdateAndDelete(studentId, logger) {
    logger.phase("4: ORM Structural Check (Update & Delete)");

    const db = DBContext.getInstance();

    logger.action(`Testing ORM Update...`);
    const updated = db.Student.update(studentId, { student_name: "API Updated Name" });
    if (updated.student_name !== "API Updated Name") throw new Error("ORM Update failed.");
    logger.success("ORM Update Passed");

    logger.action(`Testing ORM Delete...`);
    const deleted = db.Student.remove(studentId);
    if (!deleted) throw new Error("ORM Delete failed.");
    logger.success("ORM Delete Passed");
  }

  return {
    run: run
  };

})();

function runTest() {
  StudentRegistration_ApiTest.run();
}
