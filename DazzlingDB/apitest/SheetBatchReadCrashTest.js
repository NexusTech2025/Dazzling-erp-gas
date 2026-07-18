/**
 * @file SheetBatchReadCrashTest.js
 * API test script to perform sheet_batch_read action and simulate/verify the DateTimeError crash.
 */

const SheetBatchReadCrashTest = (function () {

  function run() {
    const { logger, callApi, printTable } = ApiTestHelper;

    const actionName = "sheet_batch_read"; 
    const payload = {
      payload: [
        {
          spreadsheetId: "Students",
          sheets: ["Student"]
        },
        {
          spreadsheetId: "Academic",
          sheets: [
            "Course",
            "Batch",
            "Package",
            "PackageItem",
            "PackagePerk",
            "CourseType"
          ]
        },
        {
          spreadsheetId: "Staff",
          sheets: ["Teacher"]
        },
        {
          spreadsheetId: "Core",
          sheets: ["Branch"]
        }
      ],
      options: {
        responseKey: "NAME",
        driverType: "ADVANCED"
      }
    };

    console.log(`\n🚀 EXECUTING SHEET_BATCH_READ CRASH SIMULATION: '${actionName}'`);

    const initialEnv = typeof PropertiesService !== "undefined"
      ? PropertiesService.getScriptProperties().getProperty("ENV")
      : "development";

    try {
      if (typeof PropertiesService !== "undefined") {
        PropertiesService.getScriptProperties().setProperty("ENV", "DEVELOPMENT");
      }
      DBContext.getInstance().bootstrapRepositories();

      const token = typeof PropertiesService !== "undefined"
        ? PropertiesService.getScriptProperties().getProperty("DEV_SUPER_TOKEN")
        : null;

      logger.action(`Payload: ${JSON.stringify(payload, null, 2)}`);

      const responseData = callApi(actionName, payload, token);

      logger.success("API execution succeeded without errors.");
      if (responseData) {
        logger.detail(`Response keys returned: ${Object.keys(responseData).join(", ")}`);
      }

    } catch (error) {
      logger.error(`API Execution failed (As Expected): ${error.stack || error.message}`);
    } finally {
      if (typeof PropertiesService !== "undefined") {
        PropertiesService.getScriptProperties().setProperty("ENV", initialEnv);
      }
    }
  }

  return {
    run: run
  };

})();

function runSheetBatchReadCrashTest() {
  SheetBatchReadCrashTest.run();
}
