/**
 * @file StaffGetSalaryConfig_ApiTest.js
 * API Test Suite for testing the 'staff_get_salary_configs' and 'staff_get_salary_config' actions.
 * 
 * Instructions: Run `runStaffGetSalaryConfigApiTest()` from the Apps Script editor.
 */

const StaffGetSalaryConfig_ApiTest = (function () {

  function run() {
    const { logger, callApi, printTable } = ApiTestHelper;

    console.log("\n🧪 STARTING STAFF GET SALARY CONFIG API TEST 🧪");

    // Initialize/assert DEVELOPMENT environment as requested
    const initialEnv = typeof PropertiesService !== "undefined"
      ? PropertiesService.getScriptProperties().getProperty("ENV")
      : "development";

    const testSummary = {
      overall: true,
      passed_count: 0,
      failed_count: 0,
      scenarios: []
    };

    const timings = {};

    function runScenario(name, fn) {
      const start = Date.now();
      try {
        const resultContext = fn();
        testSummary.passed_count++;
        testSummary.scenarios.push({
          name: name,
          status: "PASSED",
          description: `Scenario '${name}' completed successfully.${resultContext ? " Metadata: " + JSON.stringify(resultContext) : ""}`
        });
      } catch (error) {
        testSummary.overall = false;
        testSummary.failed_count++;
        testSummary.scenarios.push({
          name: name,
          status: "FAILED",
          description: `Scenario '${name}' failed.`,
          cause: error.message || error.toString()
        });
        logger.error(`Scenario failed: ${name} -> ${error.message}`);
      } finally {
        timings[name] = Date.now() - start;
      }
    }

    try {
      // 0. Environment Setup (Leave/Set to DEVELOPMENT)
      runScenario("0: Set Environment to DEVELOPMENT", () => {
        logger.phase("0: Set Environment to DEVELOPMENT");
        if (typeof PropertiesService !== "undefined") {
          PropertiesService.getScriptProperties().setProperty("ENV", "DEVELOPMENT");
        }
        DBContext.getInstance().bootstrapRepositories();
        logger.success("Environment set to DEVELOPMENT.");
        return { env: "DEVELOPMENT" };
      });

      // Retrieve bootstrapped token
      const superToken = typeof PropertiesService !== "undefined"
        ? PropertiesService.getScriptProperties().getProperty("DEV_SUPER_TOKEN")
        : null;

      if (!superToken) {
        logger.detail("⚠️ DEV_SUPER_TOKEN not found in ScriptProperties. Proceeding without token...");
      } else {
        logger.success("🔑 Bootstrapped Super Token loaded successfully!");
      }

      // Target Teacher IDs
      const teacherId1 = "TCH-083C6858";
      const teacherId2 = "TCH-EF263ECD";

      let salaryConfigId1 = null;
      let salaryConfigId2 = null;

      // 1. Fetch all configurations for TCH-083C6858
      runScenario("1: Fetch all configs for Teacher TCH-083C6858", () => {
        logger.phase("1: Fetch all salary configs for TCH-083C6858");
        logger.action(`Calling staff_get_salary_configs for teacher_id: ${teacherId1}`);

        const result = callApi("staff_get_salary_configs", {
          teacher_id: teacherId1
        }, superToken);

        logger.success(`Fetched ${result.length} config(s) for ${teacherId1}`);
        printTable(`Salary Configs for ${teacherId1}`, result);

        if (result && result.length > 0) {
          salaryConfigId1 = result[0].salary_config_id || result[0].teacher_salary_config_id;
        }

        return { recordCount: result.length, sampleConfigId: salaryConfigId1 };
      });

      // 2. Fetch all configurations for TCH-EF263ECD
      runScenario("2: Fetch all configs for Teacher TCH-EF263ECD", () => {
        logger.phase("2: Fetch all salary configs for TCH-EF263ECD");
        logger.action(`Calling staff_get_salary_configs for teacher_id: ${teacherId2}`);

        const result = callApi("staff_get_salary_configs", {
          teacher_id: teacherId2
        }, superToken);

        logger.success(`Fetched ${result.length} config(s) for ${teacherId2}`);
        printTable(`Salary Configs for ${teacherId2}`, result);

        if (result && result.length > 0) {
          salaryConfigId2 = result[0].salary_config_id || result[0].teacher_salary_config_id;
        }

        return { recordCount: result.length, sampleConfigId: salaryConfigId2 };
      });

      // 3. Fetch single configuration for TCH-083C6858 if found
      runScenario("3: Fetch single configuration for TCH-083C6858", () => {
        logger.phase("3: Fetch single config for TCH-083C6858");
        if (!salaryConfigId1) {
          logger.detail("⚠️ No salary configuration found for TCH-083C6858. Skipping detail fetch.");
          return { skipped: true };
        }

        logger.action(`Calling staff_get_salary_config for config_id: ${salaryConfigId1}`);
        const result = callApi("staff_get_salary_config", {
          teacher_id: teacherId1,
          salary_config_id: salaryConfigId1
        }, superToken);

        logger.success(`Successfully fetched single config record: ${salaryConfigId1}`);
        printTable(`Single Salary Config detail for ${teacherId1}`, result);

        return { salaryConfigId: salaryConfigId1, data: result };
      });

      // 4. Fetch single configuration for TCH-EF263ECD if found
      runScenario("4: Fetch single configuration for TCH-EF263ECD", () => {
        logger.phase("4: Fetch single config for TCH-EF263ECD");
        if (!salaryConfigId2) {
          logger.detail("⚠️ No salary configuration found for TCH-EF263ECD. Skipping detail fetch.");
          return { skipped: true };
        }

        logger.action(`Calling staff_get_salary_config for config_id: ${salaryConfigId2}`);
        const result = callApi("staff_get_salary_config", {
          teacher_id: teacherId2,
          salary_config_id: salaryConfigId2
        }, superToken);

        logger.success(`Successfully fetched single config record: ${salaryConfigId2}`);
        printTable(`Single Salary Config detail for ${teacherId2}`, result);

        return { salaryConfigId: salaryConfigId2, data: result };
      });

    } catch (e) {
      logger.error(`Critical Test Execution Failure: ${e.message}`);
    } finally {
      // Restore initial environment state
      if (typeof PropertiesService !== "undefined") {
        PropertiesService.getScriptProperties().setProperty("ENV", initialEnv);
      }

      // Output Results Summary (Rule 9)
      console.log("\n========================================================");
      console.log("📦 API TEST CASE RESULTS SUMMARY OBJECT");
      console.log("==================================================");
      console.log(JSON.stringify(testSummary, null, 2));
      console.log("========================================================\n");

      // Output Timing Report (Rule 10)
      printTimingReport(timings);
    }
  }

  function printTimingReport(timings) {
    console.log("\n========================================================");
    console.log("⏱️  PHASE EXECUTION PERFORMANCE TIMING SUMMARY  ⏱️");
    console.log("========================================================");
    let totalTime = 0;
    for (const [phase, duration] of Object.entries(timings)) {
      console.log(`- ${phase.padEnd(45)}: ${duration} ms`);
      totalTime += duration;
    }
    console.log("--------------------------------------------------------");
    console.log(`- ${"Total Execution Time".padEnd(45)}: ${totalTime} ms`);
    console.log("========================================================\n");
  }

  return {
    run: run
  };

})();

function runStaffGetSalaryConfigApiTest() {
  StaffGetSalaryConfig_ApiTest.run();
}
