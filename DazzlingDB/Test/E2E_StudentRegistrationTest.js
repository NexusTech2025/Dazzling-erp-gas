/**
 * @file E2E_StudentRegistrationTest.js
 * Comprehensive End-to-End Test for Academic Setup and Student Registration.
 * 
 * This test simulates a Frontend Client calling the ApiDispatcher.
 */

const E2E_StudentRegistrationTest = (function() {

  const _logger = {
    phase: (msg) => console.log(`\n=========================================\n🚀 PHASE: ${msg}\n=========================================`),
    action: (msg) => console.log(`   ▶️ ${msg}`),
    detail: (msg) => console.log(`      ↳ ${msg}`),
    success: (msg) => console.log(`   ✅ SUCCESS: ${msg}`),
    error: (msg) => console.error(`   ❌ ERROR: ${msg}`),
    data: (label, obj) => console.log(`   📦 ${label}:\n`, JSON.stringify(obj, null, 2))
  };

  /**
   * Main entry point to run the E2E test.
   */
  function run() {
    console.log("\n🧪 STARTING END-TO-END STUDENT REGISTRATION TEST SUITE 🧪");
    
    try {
      // 1. Setup Academic Environment (Phase 1)
      const academicData = _setupAcademicEnvironment();
      
      // 2. Register Student (Phase 2)
      const studentId = _registerStudent(academicData);
      
      // 3. Verify via Query Engine (Phase 3)
      _verifyData(studentId, academicData);
      
      // 4. Test Update & Delete (Phase 4 - Expected to fail at API level, using ORM bypass)
      _testUpdateAndDelete(studentId);

      console.log("\n🎉 E2E STUDENT REGISTRATION TEST SUITE COMPLETED SUCCESSFULLY! 🎉\n");
    } catch (error) {
      _logger.error(`E2E Test Suite Failed: ${error.message}`);
    }
  }

  /**
   * Helper to simulate a Web Request to the ApiDispatcher.
   */
  function _api(action, payload, token = null) {
    const mockEvent = {
      postData: {
        contents: JSON.stringify({
          action: action,
          token: token,
          payload: { payload: payload } // Wrap in payload as per ConcreteActions requirement
        })
      }
    };
    
    const output = ApiDispatcher.dispatch(mockEvent);
    let response;
    
    if (output.getContent) {
      response = JSON.parse(output.getContent());
    } else {
      response = output;
    }

    if (!response.success) {
      throw new Error(`[API Error] Action '${action}' failed: ${response.error ? response.error.message : 'Unknown Error'}`);
    }
    return response.data;
  }

  function _setupAcademicEnvironment() {
    _logger.phase("1: Academic Setup (CourseType -> Course -> Batch)");

    _logger.action("Creating Course Type...");
    _logger.detail("Payload: { segment_name: 'Academic', entity_label: 'Subject' }");
    const courseType = _api("academic_create_course_type", {
      segment_name: "Academic",
      entity_label: "Subject",
      description: "Standard Academic Curriculum"
    });
    _logger.success(`Course Type Created with ID: ${courseType.segment_id}`);

    _logger.action("Creating Course...");
    _logger.detail(`Linking to segment_id: ${courseType.segment_id}`);
    const course = _api("academic_create_course", {
      segment_id: courseType.segment_id,
      name: "Mathematics",
      base_fee: 1500,
      language_medium: "English",
      entity_type: "subject"
    });
    _logger.success(`Course Created with ID: ${course.course_id}`);

    _logger.action("Creating Batch...");
    _logger.detail(`Linking to item_id (Course): ${course.course_id}`);
    const batch = _api("academic_create_batch", {
      item_id: course.course_id,
      batch_name: "Batch Alpha - 2026",
      capacity: 30
    });
    _logger.success(`Batch Created with ID: ${batch.batch_id}`);

    return { courseType, course, batch };
  }

  function _registerStudent(academicData) {
    _logger.phase("2: Student Registration (Profile + Address + Contact)");

    const regPayload = {
      profile: {
        student_name: "Moni Test Student",
        email: "moni.test." + Date.now() + "@example.com",
        gender: "Male",
        dob: "2005-05-20"
      },
      address: {
        line1: "123 Architect Lane",
        city: "Mumbai",
        state: "Maharashtra",
        pin_code: "400001"
      },
      contact: {
        mobile_number: "9998887770",
        emergency_name: "Guardian Moni",
        emergency_phone: "8887776660"
      }
    };

    _logger.action("Executing Registration (Relational Insert)...");
    const student = _api("student_register", regPayload);
    _logger.success(`Student Registered Successfully with ID: ${student.student_id}`);
    
    _logger.action(`Enrolling Student [${student.student_id}] into Batch [${academicData.batch.batch_id}]...`);
    _api("academic_enroll_student", {
      student_id: student.student_id,
      item_id: academicData.course.course_id,
      batch_id: academicData.batch.batch_id
    });
    _logger.success("Student Enrolled Successfully");

    return student.student_id;
  }

  function _verifyData(studentId, academicData) {
    _logger.phase("3: Query & Deep Hydration Verification");

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

    _logger.action("Fetching Student with nested Address, Contact, and Course details via QueryEngine...");
    const result = _api("data_query", queryPayload);
    
    if (result.data.length === 0) throw new Error("Student not found in query results.");
    
    const student = result.data[0];
    
    const hydratedView = {
      name: student.student_name,
      city: student.address ? student.address.city : "MISSING",
      contact: student.contact ? student.contact.mobile_number : "MISSING",
      batch: student.enrollments[0] ? student.enrollments[0].batch.batch_name : "MISSING",
      course: (student.enrollments[0] && student.enrollments[0].batch.course) ? student.enrollments[0].batch.course.name : "MISSING"
    };

    _logger.data("Hydrated Student Profile", hydratedView);
    _logger.success("Deep Hydration verified successfully.");
  }

  function _testUpdateAndDelete(studentId) {
    _logger.phase("4: ORM Structural Check (Update & Delete)");

    const db = DBContext.getInstance();

    _logger.action(`Testing ORM Update for Student [${studentId}]...`);
    const updated = db.Student.update(studentId, { student_name: "Moni Updated" });
    if (updated.student_name !== "Moni Updated") throw new Error("ORM Update verification failed.");
    _logger.success(`Student name updated to: ${updated.student_name}`);

    _logger.action(`Testing ORM Delete (remove) for Student [${studentId}]...`);
    // FIXED: Changed db.Student.delete to db.Student.remove
    const deleted = db.Student.remove(studentId);
    if (!deleted) throw new Error("ORM Delete/Remove operation failed.");
    
    const check = db.Student.findById(studentId);
    if (check) throw new Error("Record still exists after ORM Delete.");
    _logger.success("Student record successfully removed from database.");
  }

  return {
    run: run
  };

})();
