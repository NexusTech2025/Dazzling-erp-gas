/**
 * @file SheetBatchRead_ApiTest.js
 * API-level integration test for SheetBatchReadAction and MultiStorageCoordinator.
 * 
 * Instructions: Run `SheetBatchRead_ApiTest.run()` or `runSheetBatchReadApiTest()` from the Apps Script editor.
 */

const SheetBatchRead_ApiTest = (function () {

  function run() {
    const { logger, callApi } = ApiTestHelper;

    console.log("\n🧪 STARTING SHEET BATCH READ API TEST 🧪");

    const initialEnv = PropertiesService.getScriptProperties().getProperty('ENV') || 'DEVELOPMENT';
    const db = DBContext.getInstance();

    try {
      // Standard testing setup and bootstrapping under TESTING sandbox env
      PropertiesService.getScriptProperties().setProperty('ENV', 'TESTING');
      db.bootstrapRepositories();

      // Dynamically resolve target spreadsheet ID using DB FileSystem
      const fileMeta = db._fs.findByName("Students");
      if (!fileMeta) {
        throw new Error("Could not find 'Students' spreadsheet in the database workspace.");
      }
      const spreadsheetId = fileMeta.id;
      logger.success(`Resolved 'Students' Spreadsheet ID: ${spreadsheetId}`);

      // ========================================================
      // Scenario 1: Happy Path - Query Students Spreadsheet
      // ========================================================
      logger.phase("1: Happy Path - Batch Read 'Student' sheet");

      const payload = [
        { spreadsheetId: "Students", sheets: ["Student"] }
      ];

      logger.action("Dispatching 'sheet_batch_read' payload...");
      logger.detail(`Payload: ${JSON.stringify(payload)}`);

      const result = callApi("sheet_batch_read", payload);

      logger.success("API returned successful response.");

      // Verify response structure is flat (spreadsheet ID maps to sheets map)
      if (!result || typeof result !== 'object') {
        throw new Error("Expected result to be a flat data object.");
      }

      if (!result[spreadsheetId]) {
        throw new Error(`Expected result to contain spreadsheet ID key '${spreadsheetId}', got keys: ${Object.keys(result)}`);
      }

      const studentsMap = result[spreadsheetId];
      if (!studentsMap.Student) {
        throw new Error("Expected to find 'Student' sheet data in result.");
      }

      const studentRecords = studentsMap.Student;
      logger.success(`Successfully fetched ${studentRecords.length} Student records.`);
      logger.data("Sample Student Records (Top 2)", studentRecords.slice(0, 2));

      // ========================================================
      // Scenario 2: Validation Failure - Empty Manifest Payload
      // ========================================================
      logger.phase("2: Validation Failure - Malformed Empty Manifest");

      const invalidPayload = [];
      logger.action("Testing call with empty manifest...");

      let validationFailed = false;
      try {
        callApi("sheet_batch_read", invalidPayload);
      } catch (err) {
        validationFailed = true;
        logger.success(`Correctly threw validation error: ${err.message}`);
      }

      if (!validationFailed) {
        throw new Error("Validation failed: expected empty manifest payload to throw an error.");
      }

      // ========================================================
      // Scenario 3: Resource Not Found - Non-existent Spreadsheet ID
      // ========================================================
      logger.phase("3: Resource Not Found - Invalid Spreadsheet ID");

      const missingSsPayload = [
        { spreadsheetId: "1invalid-spreadsheet-id-xyz-9999", sheets: ["Student"] }
      ];
      logger.action("Testing call with invalid spreadsheet ID...");

      let resourceNotFoundFailed = false;
      try {
        callApi("sheet_batch_read", missingSsPayload);
      } catch (err) {
        resourceNotFoundFailed = true;
        if (err.message.indexOf("RESOURCE_NOT_FOUND") === -1 && err.message.indexOf("not found") === -1) {
          throw new Error(`Expected RESOURCE_NOT_FOUND display code or message, got: ${err.message}`);
        }
        logger.success(`Correctly caught resource not found error: ${err.message}`);
      }

      // ========================================================
      // Scenario 4: Name-Based Response Keys Mapping
      // ========================================================
      logger.phase("4: Name-Based Response Keys (options.responseKey = 'NAME')");

      const customEvent = {
        postData: {
          contents: JSON.stringify({
            action: "sheet_batch_read",
            payload: [
              { spreadsheetId: "Students", sheets: ["Student"] }
            ],
            options: {
              responseKey: "NAME",
              driverType: "ADVANCED"

            }
          })
        }
      };

      logger.action("Dispatching 'sheet_batch_read' with responseKey: 'NAME'...");
      const customOutput = ApiDispatcher.dispatch(customEvent);
      const customRes = JSON.parse(customOutput.getContent());

      if (!customRes.success) {
        throw new Error(`Expected success to be true, got: ${JSON.stringify(customRes)}`);
      }

      logger.success("API returned successful response.");
      logger.data("Response Keys Structure", Object.keys(customRes.data));

      if (!customRes.data["Students"]) {
        throw new Error(`Expected result keys to contain category name 'Students', got: ${Object.keys(customRes.data)}`);
      }
      logger.success("Successfully mapped physical ID keys back to category name 'Students' in response.");

      console.log("\n🎉 SHEET BATCH READ API TEST RUN COMPLETE! 🎉\n");

    } catch (error) {
      logger.error(`API Test Failed: ${error.stack || error.message}`);
      throw error;
    } finally {
      // Restore active database environment state
      PropertiesService.getScriptProperties().setProperty('ENV', initialEnv);
      logger.detail(`Restored environment back to '${initialEnv}'`);
    }
  }

  return {
    run: run
  };

})();

function runSheetBatchReadApiTest() {
  SheetBatchRead_ApiTest.run();
}
