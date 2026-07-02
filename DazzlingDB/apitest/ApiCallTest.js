/**
 * @file ApiCallTest.js
 * Generic utility script to quickly invoke and inspect any API action.
 * 
 * Instructions:
 * 1. Modify the `actionName` and `payload` variables inside `runApiCall()` as needed.
 * 2. Run `runApiCall()` from the Apps Script editor.
 */

const ApiCallTest = (function () {

  function run() {
    const { logger, callApi, printTable } = ApiTestHelper;

    // --- CONFIGURATION ---
    const actionName = "staff_get_salary_configs"; 
    const payload = {
      teacher_id: "TCH-083C6858"
    };
    // ---------------------

    console.log(`\n🚀 EXECUTING API CALL: '${actionName}'`);

    const initialEnv = typeof PropertiesService !== "undefined"
      ? PropertiesService.getScriptProperties().getProperty("ENV")
      : "development";

    try {
      // 1. Force environment context to DEVELOPMENT
      if (typeof PropertiesService !== "undefined") {
        PropertiesService.getScriptProperties().setProperty("ENV", "DEVELOPMENT");
      }
      DBContext.getInstance().bootstrapRepositories();

      // 2. Load Super Token
      const token = typeof PropertiesService !== "undefined"
        ? PropertiesService.getScriptProperties().getProperty("DEV_SUPER_TOKEN")
        : null;

      logger.action(`Payload: ${JSON.stringify(payload, null, 2)}`);

      // 3. Dispatch API call
      const responseData = callApi(actionName, payload, token);

      logger.success("API execution succeeded.");

      // 4. Output results
      if (responseData !== undefined && responseData !== null) {
        if (typeof responseData === "object") {
          printTable(`Response Data for '${actionName}'`, responseData);
        } else {
          logger.detail(`Response Value: ${responseData}`);
        }
      } else {
        logger.detail("No data returned by action.");
      }

    } catch (error) {
      logger.error(`API Execution failed: ${error.message}`);
    } finally {
      // Restore initial environment state
      if (typeof PropertiesService !== "undefined") {
        PropertiesService.getScriptProperties().setProperty("ENV", initialEnv);
      }
    }
  }

  return {
    run: run
  };

})();

function runApiCall() {
  ApiCallTest.run();
}
