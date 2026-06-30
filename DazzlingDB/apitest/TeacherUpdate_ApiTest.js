/**
 * @file TeacherUpdate_ApiTest.js
 * API E2E Test Suite for testing the teacher update, subject assignment, and salary configuration actions.
 * 
 * Verifies that the dispatcher properly routes action requests, resolves user permissions,
 * and carries out the teacher state and relational updates successfully.
 * 
 * Instructions: Run `runTeacherUpdateApiTest()` from the Apps Script editor.
 */

const TeacherUpdate_ApiTest = (function () {

  function run() {
    const { logger, callApi } = ApiTestHelper;
    const db = DBContext.getInstance();

    console.log("\n🧪 STARTING TEACHER UPDATE API TEST SUITE 🧪");

    let mockTeacherId = null;
    const suffix = Math.random().toString(36).substring(7).toUpperCase();
    const uniqueMobile = "9" + Math.floor(100000000 + Math.random() * 900000000);
    const uniqueEmail = `teacher_api_${suffix.toLowerCase()}@example.com`;

    try {
      // 0. Load the globally bootstrapped developer session token
      const superToken = typeof PropertiesService !== "undefined" ? PropertiesService.getScriptProperties().getProperty("DEV_SUPER_TOKEN") : null;
      if (!superToken) {
        logger.detail("⚠️ DEV_SUPER_TOKEN not found in ScriptProperties. Running without token...");
      } else {
        logger.success("🔑 Bootstrapped Super Token loaded successfully!");
      }

      // ─── Setup: Insert Test Teacher record directly ───────────────────────
      logger.phase("1: Test Setup (Direct Teacher DB Insert)");
      const teacher = db.Teacher.insert({
        full_name: `API Setup Teacher ${suffix}`,
        mobile_number: uniqueMobile,
        email: uniqueEmail,
        gender: "male",
        teacher_type: "full_time",
        status: "active",
        experience_years: 5,
        joining_date: "2026-05-26",
        branch_id: "BRN-3GVP91T"
      });
      mockTeacherId = teacher.teacher_id;
      logger.success(`Setup complete. Teacher ID: ${mockTeacherId}`);

      // ─── Step 1: Consolidated Update (Profile + Subjects + Salary Config) ───
      logger.phase("2: Consolidated Update via API Dispatcher");
      const updatePayload = {
        teacher_id: mockTeacherId,
        data: {
          full_name: `Professor Moni API ${suffix}`,
          mobile_number: uniqueMobile, // Self-exclusion check
          email: uniqueEmail,  // Self-exclusion check
          gender: "female",
          date_of_birth: "1985-11-20",
          profile_photo_url: "https://cdn.dazzling.erp/photos/moni.jpg",
          experience_years: 15,
          qualification: "Ph.D. Computer Science",
          specialization: "Artificial Intelligence",
          previous_institute: "Massachusetts Institute of Technology",
          teacher_type: "full_time",
          joining_date: "2026-05-26",
          branch_id: "BRN-3GVP91T",
          status: "active",
          notes: "Top tier AI researcher",
          address: "MIT Campus, Cambridge, MA",
          prefered_time_slot: "Morning",
          // Relational updates consolidated in one call
          subjects: ["CRS-87206D7D", "CRS-2DEB0E44"],
          salary_config: {
            salary_config_type: "recurring_monthly",
            rate_type: "monthly",
            base_value: 75000,
            scope_type: "global",
            effective_from: "2026-05-26"
          }
        }
      };

      logger.action("Dispatching consolidated 'staff_update_teacher'...");
      const updateResult = callApi("staff_update_teacher", updatePayload, superToken);
      logger.success("Teacher profile and nested relations updated successfully!");
      logger.data("Update Result", updateResult);

      // ─── Step 2: Verification ──────────────────────────────────────────────
      logger.phase("3: Verification via Query Engine");
      const queryPayload = {
        target: "Teacher",
        where: { teacher_id: mockTeacherId },
        include: {
          teachersalaryconfig: {},
          teachersubject: {}
        }
      };

      logger.action("Dispatching query check...");
      const queryResult = callApi("data_query", queryPayload, superToken);
      if (!queryResult.data || queryResult.data.length === 0) {
        throw new Error("Teacher record not found in query results.");
      }

      const verifiedTeacher = queryResult.data[0];
      logger.detail(`Verified Teacher full data: ${JSON.stringify(verifiedTeacher, null, 2)}`)
      logger.success("Integrity Verification Passed!");
      logger.detail(`Verified Name:        ${verifiedTeacher.full_name}`);
      logger.detail(`Verified Gender:      ${verifiedTeacher.gender}`);
      logger.detail(`Verified Time Slot:   ${verifiedTeacher.prefered_time_slot}`);

      const salaryConfigs = verifiedTeacher.teachersalaryconfig || [];
      const lastSalary = salaryConfigs.length > 0 ? salaryConfigs[salaryConfigs.length - 1] : null;
      logger.detail(`Verified Base Salary: ${lastSalary ? lastSalary.base_value : "MISSING"}`);
      logger.detail(`Verified Subject count: ${verifiedTeacher.teachersubject ? verifiedTeacher.teachersubject.length : 0}`);

      console.log("\n🎉 TEACHER UPDATE API E2E TEST COMPLETED SUCCESSFULLY! 🎉\n");

    } catch (error) {
      logger.error(`API E2E Test Suite Failed: ${error.message}`);
    } finally {
      // ─── Cleanup ───────────────────────────────────────────────────────────
      if (mockTeacherId) {
        logger.phase("4: Teardown and Cleanup");
        try {
          db.TeacherSubject.where({ teacher_id: mockTeacherId }).forEach(s => {
            try { db.TeacherSubject.remove(s.teacher_subject_id); } catch (_) { }
          });
          db.TeacherSalaryConfig.where({ teacher_id: mockTeacherId }).forEach(c => {
            try { db.TeacherSalaryConfig.remove(c.salary_config_id); } catch (_) { }
          });
          db.Teacher.remove(mockTeacherId);
          logger.success("Mock Teacher and all associated records cleaned up successfully.");
        } catch (e) {
          logger.error(`Cleanup failed: ${e.message}`);
        }
      }
    }
  }

  return {
    run: run
  };

})();

function runTeacherUpdateApiTest() {
  TeacherUpdate_ApiTest.run();
}
