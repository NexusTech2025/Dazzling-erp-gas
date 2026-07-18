/**
 * @file Core_GenericCrud_ApiTest.js
 * API Integration Test Suite for generic CRUD operations (data_create),
 * verifying decoupled schema resolution and override safeguard policies.
 * 
 * Instructions: Run `Core_GenericCrud_ApiTest.run()` from the Apps Script editor.
 */

const Core_GenericCrud_ApiTest = (function () {

  /**
   * Main entry point to run the Core Generic CRUD API test scenarios.
   */
  function run() {
    const { logger, callApi } = ApiTestHelper;
    console.log("\n🧪 STARTING CORE GENERIC CRUD API TEST SUITE 🧪");

    // Preserve initial environment context
    const initialEnv = typeof PropertiesService !== "undefined"
      ? PropertiesService.getScriptProperties().getProperty("ENV")
      : "DEVELOPMENT";

    const timings = {};
    const results = {};

    try {
      // 1. Force environment context to TESTING and bootstrap
      if (typeof PropertiesService !== "undefined") {
        PropertiesService.getScriptProperties().setProperty("ENV", "TESTING");
      }
      DBContext.getInstance().bootstrapRepositories();

      const db = DBContext.getInstance();
      
      // Provision the sandbox schemas
      db.setup.provision();

      // Resolve the DEV_SUPER_TOKEN from properties
      const token = typeof PropertiesService !== "undefined"
        ? PropertiesService.getScriptProperties().getProperty("DEV_SUPER_TOKEN")
        : null;

      if (!token) {
        throw new Error("Bootstrap Token Missing: Please run DevBootstrap_ApiTest first to cache DEV_SUPER_TOKEN.");
      }

      // Clean up the table before starting
      if (typeof TestHelper !== "undefined" && typeof TestHelper.truncateSheet === "function") {
        TestHelper.truncateSheet("Core.Branch");
      }

      // -----------------------------------------------------------------------
      // Scenario 1: Auto-Allocation
      // -----------------------------------------------------------------------
      const startS1 = Date.now();
      logger.phase("1: Auto-Allocation (No PK Supplied)");
      
      db._config.allowAutoOverride = true; // Ensure standard dev/test behavior

      const resS1 = callApi("data_create", {
        table: "Branch",
        data: {
          branch_name: "Scenario 1 API Branch"
        }
      }, token);

      const createdIdS1 = resS1?.payload?.id;
      if (!createdIdS1 || !createdIdS1.startsWith("BRN-")) {
        throw new Error(`Scenario 1 Failed: Expected BRN- prefix, got '${createdIdS1}'`);
      }

      logger.success(`Scenario 1 Succeeded: Generated auto-id '${createdIdS1}'`);
      timings["Scenario 1: Auto-Allocation"] = Date.now() - startS1;
      results.Scenario1 = "✅ PASSED";

      // -----------------------------------------------------------------------
      // Scenario 2: Manual Override Allowed (allowOverride = true)
      // -----------------------------------------------------------------------
      const startS2 = Date.now();
      logger.phase("2: Manual Override (allowOverride = true)");

      const manualId = "BRN-TEST-OVERRIDE";
      const resS2 = callApi("data_create", {
        table: "Branch",
        data: {
          branch_id: manualId,
          branch_name: "Scenario 2 API Branch"
        }
      }, token);

      const createdIdS2 = resS2?.payload?.id;
      if (createdIdS2 !== manualId) {
        throw new Error(`Scenario 2 Failed: Expected override ID '${manualId}', got '${createdIdS2}'`);
      }

      logger.success(`Scenario 2 Succeeded: Overridden key preserved: '${createdIdS2}'`);
      timings["Scenario 2: Manual Override (allowOverride=true)"] = Date.now() - startS2;
      results.Scenario2 = "✅ PASSED";

      // -----------------------------------------------------------------------
      // Scenario 3: Auto-Clearing in Production (allowOverride = false)
      // -----------------------------------------------------------------------
      const startS3 = Date.now();
      logger.phase("3: Auto-Clearing in Production (allowOverride = false)");

      // Temporarily disable overrides to simulate production environment setting
      db._config.allowAutoOverride = false;

      const resS3 = callApi("data_create", {
        table: "Branch",
        data: {
          branch_id: "BRN-PROD-HIJACK-ATTEMPT",
          branch_name: "Scenario 3 API Branch"
        }
      }, token);

      // Revert config safety setting immediately
      db._config.allowAutoOverride = true;

      const createdIdS3 = resS3?.payload?.id;
      if (!createdIdS3 || createdIdS3 === "BRN-PROD-HIJACK-ATTEMPT") {
        throw new Error(`Scenario 3 Failed: Predefined override should be cleared in production, but got: '${createdIdS3}'`);
      }

      if (!createdIdS3.startsWith("BRN-")) {
        throw new Error(`Scenario 3 Failed: Expected generated ID with prefix 'BRN-', got '${createdIdS3}'`);
      }

      logger.success(`Scenario 3 Succeeded: Client-supplied key was cleared and auto-generated: '${createdIdS3}'`);
      timings["Scenario 3: Auto-Clearing (allowOverride=false)"] = Date.now() - startS3;
      results.Scenario3 = "✅ PASSED";

    } catch (e) {
      logger.error(`API test scenario execution failed: ${e.message}`);
      throw e;
    } finally {
      // Restore initial environment context and re-bootstrap
      if (typeof PropertiesService !== "undefined") {
        PropertiesService.getScriptProperties().setProperty("ENV", initialEnv);
      }
      DBContext.getInstance().bootstrapRepositories();
    }

    // Output performance timing summary (Rule G compliance)
    console.log("\n========================================================");
    console.log("⏱️  CORE GENERIC CRUD API TEST PERFORMANCE TIMINGS      ⏱️");
    console.log("========================================================");
    let total = 0;
    for (const [step, time] of Object.entries(timings)) {
      console.log(`- ${step.padEnd(46)}: ${time} ms`);
      total += time;
    }
    console.log("--------------------------------------------------------");
    console.log(`- Total execution time                         : ${total} ms`);
    console.log("========================================================\n");

    return results;
  }

  return { run };
})();

function runCoreGenericCrudApiTest() {
  Core_GenericCrud_ApiTest.run();
}
