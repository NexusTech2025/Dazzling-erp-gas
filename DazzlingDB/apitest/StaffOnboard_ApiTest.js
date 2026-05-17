/**
 * @file StaffOnboard_ApiTest.js
 * API Test for testing the staff_onboard_teacher action.
 * 
 * Instructions: Run `runStaffOnboardTest()` from the Apps Script editor.
 */

const StaffOnboard_ApiTest = (function() {

  function run() {
    const { logger, callApi } = ApiTestHelper;

    console.log("\n🧪 STARTING STAFF ONBOARD API TEST 🧪");

    try {
      // 0. Retrieve the globally cached developer session token
      const superToken = typeof PropertiesService !== "undefined" ? PropertiesService.getScriptProperties().getProperty("DEV_SUPER_TOKEN") : null;
      if (!superToken) {
         logger.detail("⚠️ DEV_SUPER_TOKEN not found in ScriptProperties. Running without token...");
      } else {
         logger.success("🔑 Bootstrapped Super Token loaded successfully!");
      }

      logger.phase("1: Onboard Teacher (Positive Test)");
      logger.action("Dispatching staff_onboard_teacher...");

      // Generate dynamic unique credentials to avoid duplicate validation errors on repeated test runs
      const suffix = Math.random().toString(36).substring(7).toUpperCase();
      const uniqueMobile = "08" + Math.floor(10000000 + Math.random() * 90000000);
      const uniqueEmail = `manish_${suffix.toLowerCase()}@gmail.com`;
      const uniqueUsername = `manish_${suffix.toLowerCase()}`;

      const payload = {
        "payload": {
          "full_name": "Manish Kumar " + suffix,
          "mobile_number": uniqueMobile,
          "email": uniqueEmail,
          "gender": "male",
          "date_of_birth": "1998-06-21",
          "experience_years": 5,
          "qualification": "B.A.",
          "specialization": "None",
          "previous_institute": "Gyan Joyti",
          "teacher_type": "part_time",
          "joining_date": "2026-05-17",
          "status": "pending",
          "notes": "API test onboarded teacher",
          "userData": {
            "username": uniqueUsername,
            "password": "fVJkTDAs%Q",
            "email": uniqueEmail
          },
          "salary_config": {
            "salary_type": "monthly",
            "base_amount": 35000,
            "effective_from": "2026-05-17"
          },
          // Map to standard courses (e.g. from the DevBootstrap seeder)
          "subjects": ["CRS-5CC845CD", "CRS-A8418556"],
          "documents": [
            {
              "document_type": "resume",
              "file_url": "https://dazzling.erp/docs/manish_resume.pdf"
            }
          ]
        }
      };

      // Execute API call passing the payload and injecting the superToken
      const result = callApi("staff_onboard_teacher", payload, superToken);
      
      logger.success("✅ Teacher onboarded successfully!");
      logger.data("API Response", result);

      console.log("\n🎉 STAFF ONBOARD API TEST COMPLETED SUCCESSFULLY! 🎉\n");
    } catch (error) {
      ApiTestHelper.logger.error(`API Test Failed: ${error.message}`);
    }
  }

  return {
    run: run
  };

})();

function runStaffOnboardTest(){
  StaffOnboard_ApiTest.run();
}
