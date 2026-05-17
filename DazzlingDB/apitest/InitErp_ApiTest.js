/**
 * @file InitErp_ApiTest.js
 * API Test for testing the 'init_erp' declarative hydration endpoint.
 * 
 * Instructions: Run `InitErp_ApiTest.run()` from the Apps Script editor.
 */

const InitErp_ApiTest = (function() {

  function run() {
    const { logger, callApi } = ApiTestHelper;

    console.log("\n🧪 STARTING INIT ERP HYDRATION API TEST 🧪");
    
    try {
      logger.phase("1: Test Successful Multi-Target Hydration");

      const hydrationPayload = {
        targets: ["Course", "Teacher", "Student", "Batch"]
      };

      logger.action("Dispatching 'init_erp' payload...");
      logger.detail("Targets: " + JSON.stringify(hydrationPayload.targets));

      const result = callApi("init_erp", hydrationPayload);
      
      logger.success("Initial ERP Data Fetched successfully.");
      
      // Verify pluralization and data presence
      const expectedKeys = ["courses", "teachers", "students", "batches"];
      expectedKeys.forEach(key => {
        if (result[key]) {
          logger.detail(`Found key '${key}' with ${result[key].count} records.`);
          
          // Check if status filtering was applied for tables that have it
          if (result[key].count > 0) {
            const firstRecord = result[key].data[0];
            if (firstRecord.status) {
               if (firstRecord.status !== "active") {
                 logger.error(`Validation Failed: Record in '${key}' has status '${firstRecord.status}' (expected 'active').`);
               } else {
                 logger.success(`Verified 'active' filter for '${key}'.`);
               }
            }
          }
        } else {
          logger.error(`Missing expected key in response: ${key}`);
          throw new Error(`Pluralization or data fetching failed for ${key}`);
        }
      });

      logger.phase("2: Test Atomic Failure with Invalid Target");
      
      const invalidPayload = {
        targets: ["Course", "NonExistentTable"]
      };
      
      logger.action("Dispatching 'init_erp' with invalid table...");
      
      try {
        callApi("init_erp", invalidPayload);
        logger.error("Error: The request should have failed but it succeeded.");
      } catch (e) {
        logger.success("Atomic failure verified: " + e.message);
      }

      logger.phase("3: Test Hybrid Bulk DSL Targets (Object Format)");
      
      const hybridPayload = {
        targets: [
          "Course", // String format
          {
            target: "Student",
            select: ["id", "full_name", "status"],
            pagination: { limit: 5 }
          }
        ]
      };

      logger.action("Dispatching hybrid 'init_erp' payload...");
      const hybridResult = callApi("init_erp", hybridPayload);
      
      if (hybridResult.courses && hybridResult.students) {
        logger.success("Hybrid hydration successful.");
        logger.detail(`Courses: ${hybridResult.courses.count}`);
        logger.detail(`Students: ${hybridResult.students.count} (Limited to 5)`);
        
        if (hybridResult.students.count > 5) {
          logger.error("Student count exceeded limit of 5");
        }
        
        // Verify select was applied
        if (hybridResult.students.data.length > 0) {
           const student = hybridResult.students.data[0];
           const keys = Object.keys(student);
           // Metadata might include more keys, but we check for expected ones
           if (keys.includes("id") && keys.includes("full_name")) {
             logger.success("Projection (select) verified for Students.");
           }
        }
      } else {
        logger.error("Missing keys in hybrid response.");
        throw new Error("Hybrid response missing expected keys.");
      }

      console.log("\n🎉 INIT ERP HYDRATION API TEST COMPLETED SUCCESSFULLY! 🎉\n");
    } catch (error) {
      ApiTestHelper.logger.error(`API Test Failed: ${error.message}`);
    }
  }

  return {
    run: run
  };

})();

function runTest(){
  InitErp_ApiTest.run();
}
