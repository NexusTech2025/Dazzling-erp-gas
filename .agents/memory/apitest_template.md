# Production-Ready Standard apitest Template

Below is the authoritative, copy-pasteable blueprint for creating any new API integration test suite inside DazzlingDB/apitest/:
```js
/**
 * @file DomainFeature_ApiTest.js
 * API Integration Test Suite for Domain Feature operations.
 * * Instructions: Run `runDomainFeatureApiTest()` from the Apps Script editor.
 */

const DomainFeature_ApiTest = (function () {

  function run() {
    const { logger, callApi, printTable } = ApiTestHelper; //

    console.log("\n🧪 STARTING DOMAIN FEATURE API TEST SUITE 🧪");

    // 1. Preserve Environment State
    const initialEnv = typeof PropertiesService !== "undefined"
      ? PropertiesService.getScriptProperties().getProperty("ENV")
      : "DEVELOPMENT";

    const timings = {};
    const stats = { passed: 0, failed: 0, scenarios: [] };

    // Dynamic Suffix Isolation
    const suffix = Math.random().toString(36).substring(7).toUpperCase();

    // Track Created Entities for LIFO Teardown
    let createdParentId = null;
    let createdChildId = null;

    function runScenario(name, fn) {
      const tStart = Date.now();
      try {
        fn();
        stats.passed++;
        stats.scenarios.push({ name: name, status: "PASSED" });
        timings[name] = Date.now() - tStart;
      } catch (error) {
        stats.failed++;
        stats.scenarios.push({ name: name, status: "FAILED", error: error.message });
        timings[name] = Date.now() - tStart;
        throw error;
      }
    }

    try {
      // 2. Force Environment Context to TESTING
      if (typeof PropertiesService !== "undefined") {
        PropertiesService.getScriptProperties().setProperty("ENV", "TESTING");
      }
      DBContext.getInstance().bootstrapRepositories();
      const db = DBContext.getInstance();
     // db.setup.provision(); // Hydrate sandbox sheets on requirement

      // Resolve Auth Token
      const token = typeof PropertiesService !== "undefined"
        ? PropertiesService.getScriptProperties().getProperty("DEV_SUPER_TOKEN")
        : null;

      if (!token) {
        throw new Error("Bootstrap Token Missing: Please run DevBootstrap.run('TESTING') first."); //
      }

      // -----------------------------------------------------------------------
      // Phase 0: Setup Dependencies
      // -----------------------------------------------------------------------
      runScenario("Phase 0: Provision Parent Dependency", () => {
        logger.phase("0: Provision Parent Dependency");
        const res = callApi("domain_create_parent", {
          name: `Test Parent ${suffix}`
        }, token);
        createdParentId = res.parent_id;
        logger.success(`Parent created with ID: ${createdParentId}`);
      });

      // -----------------------------------------------------------------------
      // Phase 1: Primary Action (Happy Path)
      // -----------------------------------------------------------------------
      runScenario("Phase 1: Execute Primary Action", () => {
        logger.phase("1: Execute Primary Action");
        const res = callApi("domain_create_child", {
          parent_id: createdParentId,
          title: `Test Child ${suffix}`
        }, token);
        createdChildId = res.child_id;
        logger.success(`Child created with ID: ${createdChildId}`);
      });

      // -----------------------------------------------------------------------
      // Phase 2: Query Engine Verification & Hydration
      // -----------------------------------------------------------------------
      runScenario("Phase 2: DSL Query Verification", () => {
        logger.phase("2: DSL Query Verification");
        const queryRes = callApi("data_query", {
          target: "ChildModel",
          where: { child_id: createdChildId },
          include: { parent: {} }
        }, token);

        if (!queryRes || !queryRes.data || queryRes.data.length === 0) {
          throw new Error("Child record not found via QueryEngine.");
        }
        logger.success("DSL Query and hydration verified successfully.");
      });

      // -----------------------------------------------------------------------
      // Phase 3: Negative Validation Checks
      // -----------------------------------------------------------------------
      runScenario("Phase 3: Negative Validation Checks", () => {
        logger.phase("3: Negative Validation Checks");
        const mockEvent = {
          postData: {
            contents: JSON.stringify({
              action: "domain_create_child",
              token: token,
              payload: {} // Bad payload
            })
          }
        };
        const rawRes = ApiDispatcher.dispatch(mockEvent);
        const parsed = rawRes.getContent ? JSON.parse(rawRes.getContent()) : rawRes;

        if (parsed.success !== false) {
          throw new Error("Validation failed: Action succeeded with empty payload.");
        }
        logger.success(`Validation blocked invalid payload correctly: ${parsed.error.message}`);
      });

      console.log("\n🎉 TEST SUITE COMPLETED SUCCESSFULLY! 🎉\n");

    } catch (e) {
      logger.error(`API Test Execution Failed: ${e.message}`); //
    } finally {
      // 3. LIFO Reverse-Topological Teardown
      logger.phase("N: Teardown and Cleanup"); //
      const db = DBContext.getInstance();

      if (createdChildId) {
        try { db.ChildModel.remove(createdChildId); logger.success(`Evicted Child: ${createdChildId}`); } catch (_) {}
      }
      if (createdParentId) {
        try { db.ParentModel.remove(createdParentId); logger.success(`Evicted Parent: ${createdParentId}`); } catch (_) {}
      }

      // Restore Initial Environment State
      if (typeof PropertiesService !== "undefined") {
        PropertiesService.getScriptProperties().setProperty("ENV", initialEnv);
      }
      DBContext.getInstance().bootstrapRepositories();
      logger.success("Environment state restored.");
    }

    // 4. Output Performance & Execution Summary
    console.log("\n========================================================");
    console.log("⏱️  API TEST PERFORMANCE TIMINGS                        ⏱️");
    console.log("========================================================");
    let total = 0;
    for (const [step, time] of Object.entries(timings)) {
      console.log(`- ${step.padEnd(46)}: ${time} ms`);
      total += time;
    }
    console.log("--------------------------------------------------------");
    console.log(`- Total execution time                         : ${total} ms`);
    console.log("========================================================\n");

    return stats;
  }

  return { run };
})();

function runDomainFeatureApiTest() {
  DomainFeature_ApiTest.run();
}
```