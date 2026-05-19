/**
 * @file StaffOnboard_ApiTest.js
 * API Test for testing the staff_onboard_teacher action (both Positive and Negative flows).
 * 
 * Verifies relational onboarding, deep hydration queries, and multi-field error accumulation.
 * Instructions: Run `runStaffOnboardTest()` from the Apps Script editor.
 */

const StaffOnboard_ApiTest = (function() {

  function run() {
    const { logger } = ApiTestHelper;

    console.log("\n🧪 STARTING STAFF ONBOARD API TEST 🧪");

    try {
      // 0. Retrieve the globally cached developer session token
      const superToken = typeof PropertiesService !== "undefined" ? PropertiesService.getScriptProperties().getProperty("DEV_SUPER_TOKEN") : null;
      if (!superToken) {
         logger.detail("⚠️ DEV_SUPER_TOKEN not found in ScriptProperties. Running without token...");
      } else {
         logger.success("🔑 Bootstrapped Super Token loaded successfully!");
      }

      // Helper to dispatch requests and return raw responses for detailed inspection
      function dispatch(action, payload, token) {
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
        return output.getContent ? JSON.parse(output.getContent()) : output;
      }

      // --- PHASE 1: Positive Onboarding ---
      logger.phase("1: Onboard Teacher (Positive Flow)");
      logger.action("Dispatching staff_onboard_teacher with dynamic unique payload...");

      // Generate dynamic unique credentials to avoid duplicate validation errors on repeated test runs
      const suffix = Math.random().toString(36).substring(7).toUpperCase();
      const uniqueMobile = "9" + Math.floor(100000000 + Math.random() * 900000000);
      const uniqueEmail = `manish_${suffix.toLowerCase()}@gmail.com`;
      const uniqueUsername = `manish_${suffix.toLowerCase()}`;

      const payload = {
        "full_name": "Manish Kumar " + suffix,
        "mobile_number": uniqueMobile,
        "email": uniqueEmail,
        "gender": "male",
        "date_of_birth": "1998-06-21",
        "experience_years": 5,
        "qualification": "B.A.",
        "specialization": "None",
        "previous_institute": "Gyan Jyoti",
        "teacher_type": "part_time",
        "joining_date": "2026-05-17",
        "status": "active",
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
        // Standard courses (e.g. from the DevBootstrap seeder)
        "subjects": ["CRS-5CC845CD", "CRS-A8418556"],
        "documents": [
          {
            "document_type": "resume",
            "file_url": "https://dazzling.erp/docs/manish_resume.pdf"
          }
        ]
      };

      const result = dispatch("staff_onboard_teacher", payload, superToken);
      
      if (!result.success) {
        throw new Error(`Positive Onboarding failed: ${result.error ? result.error.message : "Unknown Error"}`);
      }

      logger.success("✅ Teacher onboarded successfully!");
      logger.detail(`Teacher ID: ${result.data.teacher_id}`);
      logger.detail(`User ID:    ${result.data.teacher_id}`);
      logger.data("API Response", result.data);

      // --- PHASE 2: Negative Onboarding (Multi-Field Error Accumulation) ---
      logger.phase("2: Onboard Teacher (Negative Flow - Multi-Field Error Accumulation)");
      logger.action("Dispatching duplicated request to trigger multiple uniqueness and integrity violations...");

      const duplicatePayload = {
        "full_name": "Duplicate Manish " + suffix,
        "mobile_number": uniqueMobile,  // DUPLICATE
        "email": uniqueEmail,          // DUPLICATE
        "gender": "male",
        "date_of_birth": "1998-06-21",
        "experience_years": 3,
        "qualification": "M.A.",
        "specialization": "History",
        "teacher_type": "part_time",
        "joining_date": "2026-05-17",
        "status": "active",
        "userData": {
          "username": uniqueUsername,   // DUPLICATE
          "password": "duplicatePassword123!",
          "email": uniqueEmail          // DUPLICATE
        },
        "salary_config": {
          "salary_type": "monthly",
          "base_amount": 30000,
          "effective_from": "2026-05-17"
        },
        "subjects": ["CRS-INVALID-XXX"], // NOT FOUND
        "documents": []
      };

      const errorResult = dispatch("staff_onboard_teacher", duplicatePayload, superToken);

      if (errorResult.success) {
        throw new Error("Failure Flow failed: The request was expected to fail but it completed successfully!");
      }

      logger.success("✅ Validation System properly caught the failures!");
      logger.detail(`Error Name:    ${errorResult.error.name}`);
      logger.detail(`Error Message: ${errorResult.error.message}`);

      const fields = errorResult.error.details && errorResult.error.details.fields ? errorResult.error.details.fields : [];
      logger.data("Collected Violation Fields", fields);

      // Assert that all four error fields were captured
      const expectedFields = ["mobile_number", "email", "userData.username", "subjects"];
      const actualFields = fields.map(f => f.field);

      let allCaught = true;
      expectedFields.forEach(field => {
        if (!actualFields.includes(field)) {
          logger.error(`Failed to capture validation failure on field: ${field}`);
          allCaught = false;
        }
      });

      if (allCaught) {
        logger.success("💯 Verified: Multi-Field Error Accumulation completely captured all 4 distinct integrity violations!");
      } else {
        throw new Error("Multi-Field Error Accumulation checks failed.");
      }

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
