/**
 * Path: DazzlingDB/Test/AdvancedSheetActionsTests.js
 * Verify API Dispatcher routing, validation, strategy execution, and envelope formatting.
 */

function runAdvancedSheetActionsTests() {
  console.log("\n🧪 STARTING ADVANCED SHEET ACTIONS API DISPATCH TESTS 🧪\n");
  
  const initialEnv = PropertiesService.getScriptProperties().getProperty('ENV') || 'DEVELOPMENT';
  
  try {
    // Standard testing setup and bootstrapping under TESTING sandbox env
    PropertiesService.getScriptProperties().setProperty('ENV', 'TESTING');
    DBContext.getInstance().bootstrapRepositories();

    // Physical spreadsheet IDs mapping
    const realSheetsMap = {
      Finance: "1hW5QMj_Nwae0TE6TJXUnErxul7N4Sp1jppj7bznqw9I",
      Academic: "1zVWS2FCMtMHcHVadNyZbOvuelOo21Kj1zG-X9iebG_M",
      Students: "1RwtbuO9m1gN8X8kGeDjATnerZVTiCXvWAE-EM0KJUbI",
      Auth: "1zvNgOzAnRK_-odY3K0jydm6aEYRRUwtXN-HmbnAmzNI",
      Core: "1EomEa7_5r1GZbVd5K5G3rFarTyxNFzw9bwkkNX1A9nE",
      Attendance: "1lyKwq_KNx7YpMtD-m_KPX_7W8_z3yZyh4kTASpX00So",
      Staff: "1VjFOZirWbHFqnAdFpfydKaWUfSwKMRnaiIe3qbNEnk4",
      Test: "1C8OR42U5PSlbzMcwq_uRbNq6IpqEEAygJYsXUlgXjrc"
    };

    const spreadsheetIdA = realSheetsMap.Students;
    
    // Manifest configurations: Target A using Category Name instead of physical ID
    const mockPostData = {
      action: "sheet_batch_read",
      payload: [
        { spreadsheetId: "Students", sheets: ["Address"] }
      ],
      options: {
        driverType: "ADVANCED"
      }
    };

    // Mock Event payload mimicking Google Apps Script event arguments
    const e = {
      parameter: {},
      postData: {
        contents: JSON.stringify(mockPostData)
      }
    };

    console.log("================================────────────────────────");
    console.log("EXECUTION RUN: Verifying ApiDispatcher dispatch pipeline...");
    
    const textOutput = ApiDispatcher.dispatch(e);
    const responseJson = JSON.parse(textOutput.getContent());
    
    if (responseJson.success !== true) {
      throw new Error(`Expected success to be true, got: ${JSON.stringify(responseJson)}`);
    }
    
    if (!responseJson.data || !responseJson.data[spreadsheetIdA]) {
      throw new Error(`Expected data to contain spreadsheetId key '${spreadsheetIdA}', response was: ${JSON.stringify(responseJson)}`);
    }

    console.log(`[PASS] Dispatch completed successfully.`);
    console.log(`- Execution Time      : ${responseJson.context.execution_time_ms}ms`);
    console.log(`- Environment         : ${responseJson.meta.environment}`);
    console.log(`- Data Mapped Sheets  : ${Object.keys(responseJson.data[spreadsheetIdA]).join(", ")}`);
    
    console.log("--------------------------------------------------------");
    console.log("EXECUTION RUN: Verifying Invalid Action Routing...");
    
    const invalidEvent = {
      parameter: {},
      postData: {
        contents: JSON.stringify({ action: "sheet_invalid_action_9999" })
      }
    };
    const invalidOutput = ApiDispatcher.dispatch(invalidEvent);
    const invalidResponseJson = JSON.parse(invalidOutput.getContent());
    
    if (invalidResponseJson.success !== false) {
      throw new Error("Expected success to be false for invalid endpoint.");
    }
    console.log(`[PASS] Correctly rejected invalid action:`);
    console.log(`  - Error Code    : ${invalidResponseJson.error.code}`);
    console.log(`  - Error Message : ${invalidResponseJson.error.message}`);
    
    console.log("================================────────────────========");

  } catch (error) {
    console.error(`[FAIL] Test execution encountered error: ${error.stack || error.message}`);
    throw error;
  } finally {
    // Safeguard to restore environment state
    PropertiesService.getScriptProperties().setProperty('ENV', initialEnv);
    console.log(`[INFO] Restored ENV back to '${initialEnv}'`);
  }
}
