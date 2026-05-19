/**
 * @file TeacherRegistration_ApiTest.js
 * API Test Suite for testing the teacher onboarding success and failure lifecycles.
 * 
 * Verifies relational onboarding, deep hydration queries, and multi-field error accumulation.
 * Instructions: Run `TeacherRegistration_ApiTest.run()` from the Apps Script editor.
 */

const TeacherRegistration_ApiTest = (function() {

  function run() {
    const { logger } = ApiTestHelper;

    console.log("\n🧪 STARTING TEACHER REGISTRATION API TEST SUITE 🧪");

    try {
      // 0. Load the globally bootstrapped developer session token
      const superToken = typeof PropertiesService !== "undefined" ? PropertiesService.getScriptProperties().getProperty("DEV_SUPER_TOKEN") : null;
      if (!superToken) {
         logger.detail("⚠️ DEV_SUPER_TOKEN not found in ScriptProperties. Running without token...");
      } else {
         logger.success("🔑 Bootstrapped Super Token loaded successfully!");
      }

      // 1. Setup Academic Course
      const academicData = _setupAcademicCourse(logger, superToken);

      // 2. Execute Positive Onboarding Flow
      const onboardingData = _onboardTeacherSuccess(academicData, logger, superToken);

      // 3. Verify via Deep Query Hydration
      _verifyTeacherData(onboardingData, academicData, logger, superToken);

      // 4. Execute Failure Flow (Multi-Field Error Accumulation)
      _onboardTeacherFailure(onboardingData, logger, superToken);

      console.log("\n🎉 TEACHER REGISTRATION API TEST SUITE COMPLETED SUCCESSFULLY! 🎉\n");
    } catch (error) {
      logger.error(`API Test Suite Failed: ${error.message}`);
    }
  }

  /**
   * Helper to dispatch API requests directly and return the full raw JSON envelope.
   */
  function _dispatch(action, payload, token = null) {
    const mockEvent = {
      postData: {
        contents: JSON.stringify({
          action: action,
          token: token,
          payload: payload
        })
      }
    };

    const output = ApiDispatcher.dispatch(mockEvent);
    if (output.getContent) {
      return JSON.parse(output.getContent());
    }
    return output;
  }

  function _setupAcademicCourse(logger, token) {
    logger.phase("1: Academic Setup (CourseType & Course Creation)");

    logger.action("Creating Course Type...");
    const typeRes = _dispatch("academic_create_course_type", {
      segment_name: "Teacher_API_Test_Type",
      entity_label: "Subject",
      description: "Temporary type for teacher subject mapping"
    }, token);

    if (!typeRes.success) throw new Error(`CourseType creation failed: ${typeRes.error.message}`);
    const segmentId = typeRes.data.segment_id;
    logger.success(`Course Type Created with ID: ${segmentId}`);

    logger.action("Creating Course/Subject...");
    const courseRes = _dispatch("academic_create_course", {
      segment_id: segmentId,
      name: "API Test Teacher Chemistry",
      base_fee: 1200,
      language_medium: "English",
      entity_type: "subject"
    }, token);

    if (!courseRes.success) throw new Error(`Course creation failed: ${courseRes.error.message}`);
    const courseId = courseRes.data.course_id;
    logger.success(`Course Created with ID: ${courseId}`);

    return { segmentId, courseId };
  }

  function _onboardTeacherSuccess(academicData, logger, token) {
    logger.phase("2: Onboard Teacher (Success Flow)");

    const suffix = Math.random().toString(36).substring(7).toUpperCase();
    const uniqueMobile = "9" + Math.floor(100000000 + Math.random() * 900000000);
    const uniqueEmail = `teacher_${suffix.toLowerCase()}@example.com`;
    const uniqueUsername = `teacher_${suffix.toLowerCase()}`;

    const onboardPayload = {
      full_name: "API Test Teacher " + suffix,
      mobile_number: uniqueMobile,
      email: uniqueEmail,
      gender: "female",
      date_of_birth: "1990-04-12",
      experience_years: 6,
      qualification: "M.Sc. Chemistry",
      specialization: "Organic Chemistry",
      previous_institute: "National Science Academy",
      teacher_type: "full_time",
      joining_date: "2026-05-19",
      status: "active",
      userData: {
        username: uniqueUsername,
        password: "securePassword123!",
        email: uniqueEmail
      },
      salary_config: {
        salary_type: "monthly",
        base_amount: 45000,
        effective_from: "2026-05-19"
      },
      subjects: [academicData.courseId],
      documents: [
        {
          document_type: "degree",
          file_url: `https://dazzling.erp/docs/teacher_${suffix.toLowerCase()}_degree.pdf`
        }
      ]
    };

    logger.action(`Onboarding Teacher: ${onboardPayload.full_name}...`);
    const res = _dispatch("staff_onboard_teacher", onboardPayload, token);

    if (!res.success) {
      throw new Error(`Teacher onboarding failed: ${res.error.message}`);
    }

    logger.success("Teacher Onboarded Relational Records Created!");
    logger.detail(`Teacher ID: ${res.data.teacher_id}`);
    logger.detail(`User ID:    ${res.data.teacher_id}`);

    return {
      teacherId: res.data.teacher_id,
      userId: res.data.teacher_id,
      payload: onboardPayload
    };
  }

  function _verifyTeacherData(onboardData, academicData, logger, token) {
    logger.phase("3: Verify Onboarded Teacher via QueryEngine");

    const queryPayload = {
      target: "Teacher",
      where: { teacher_id: onboardData.teacherId },
      include: {
        user: {},
        salary_config: {},
        subjects: {
          include: {
            course: {}
          }
        },
        documents: {}
      }
    };

    logger.action("Fetching Hydrated Teacher Profile...");
    const res = _dispatch("data_query", queryPayload, token);

    if (!res.success || res.data.length === 0) {
      throw new Error(`Failed to find hydrated teacher record: ${res.error ? res.error.message : "Not Found"}`);
    }

    const teacher = res.data[0];
    logger.success("Verification successful!");
    logger.detail(`Verified Name:         ${teacher.full_name}`);
    logger.detail(`Verified Username:     ${teacher.user ? teacher.user.username : "MISSING"}`);
    logger.detail(`Verified Base Salary:  ${teacher.salary_config ? teacher.salary_config.base_amount : "MISSING"}`);
    
    const mappedCourse = teacher.subjects && teacher.subjects[0] && teacher.subjects[0].course ? teacher.subjects[0].course.name : "MISSING";
    logger.detail(`Verified Subject:      ${mappedCourse}`);

    if (mappedCourse !== "API Test Teacher Chemistry") {
      throw new Error(`Relational mapping verification failed. Found: ${mappedCourse}`);
    }
  }

  function _onboardTeacherFailure(onboardData, logger, token) {
    logger.phase("4: Onboard Teacher (Multi-Field Error Accumulation Flow)");

    // Intentional duplicates of existing Teacher's mobile, email, username, and an invalid subject ID
    const failurePayload = {
      full_name: "API Test Duplicate Teacher",
      mobile_number: onboardData.payload.mobile_number, // DUPLICATE
      email: onboardData.payload.email,                 // DUPLICATE
      gender: "male",
      date_of_birth: "1988-08-08",
      experience_years: 10,
      qualification: "Ph.D. Physics",
      specialization: "Astrophysics",
      teacher_type: "full_time",
      joining_date: "2026-05-19",
      status: "active",
      userData: {
        username: onboardData.payload.userData.username, // DUPLICATE
        password: "duplicatePassword123!",
        email: onboardData.payload.email                // DUPLICATE
      },
      subjects: ["CRS-INVALID-999"],                     // NOT FOUND
      salary_config: {
        salary_type: "hourly",
        base_amount: 500,
        effective_from: "2026-05-19"
      }
    };

    logger.action("Dispatching onboard request designed to trigger 4 simultaneous violations...");
    const res = _dispatch("staff_onboard_teacher", failurePayload, token);

    if (res.success) {
      throw new Error("Failure Flow failed: The request was expected to fail but it completed successfully!");
    }

    logger.success("Validation System properly caught the failures!");
    logger.detail(`Error Type:    ${res.error.name}`);
    logger.detail(`Error Message: ${res.error.message}`);

    const fields = res.error.details && res.error.details.fields ? res.error.details.fields : [];
    logger.data("Collected Violation Fields", fields);

    // Validate that we accumulated all errors successfully
    const expectedViolations = ["mobile_number", "email", "userData.username", "subjects"];
    const foundViolations = fields.map(f => f.field);

    let allCaught = true;
    expectedViolations.forEach(v => {
      if (!foundViolations.includes(v)) {
        logger.error(`System failed to capture violation for field: ${v}`);
        allCaught = false;
      }
    });

    if (allCaught) {
      logger.success("💯 Verified: Multi-Field Error Accumulation completely captured all 4 distinct integrity violations!");
    } else {
      throw new Error("Validation Error Accumulation check failed.");
    }
  }

  return {
    run: run
  };

})();

function runTeacherRegistrationTest() {
  TeacherRegistration_ApiTest.run();
}
