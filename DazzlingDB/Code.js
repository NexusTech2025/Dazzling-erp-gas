/**
 * @file Code.js
 * Primary Entry Point for DazzlingDB Application.
 */

/**
 * Bootstraps the database and provisions infrastructure.
 * Run this once to setup the physical spreadsheets.
 */
function bootstrapDatabase() {
  const db = DBContext.getInstance();
  
  console.log("[App] Starting Physical Provisioning...");
  try {
    const result = db.setup.provision();
    
    if (result.errors && result.errors.length > 0) {
      console.warn(`[App] Provisioning finished with ${result.errors.length} error(s):`);
      result.errors.forEach(err => console.warn(` - ${err}`));
    }
    
    if (result.isChanged) {
      console.log("[App] Provisioning Complete. Changes applied:");
      if (result.createdFiles && result.createdFiles.length > 0) {
        console.log(` - Files Created: ${result.createdFiles.join(', ')}`);
      }
      if (result.createdSheets && result.createdSheets.length > 0) {
        console.log(` - Sheets Created: ${result.createdSheets.join(', ')}`);
      }
      if (result.updatedHeaders && result.updatedHeaders.length > 0) {
        console.log(` - Headers Updated: ${result.updatedHeaders.join(', ')}`);
      }
      if (result.metaUpdated && result.metaUpdated.length > 0) {
        console.log(` - Metadata Sheets Updated: ${result.metaUpdated.join(', ')}`);
      }
    } else {
      console.log("[App] Provisioning Complete. Database is already up to date (No changes required).");
    }
    return result;
  } catch (error) {
    console.error("[App] Fatal Error during database provisioning:", error.message || error);
    throw error;
  }
}

/**
 * Verifies the connection and health of the database.
 */
function verifyDatabase() {
  const status = DBContext.ping();
  console.log("[App] Health Status:", JSON.stringify(status, null, 2));
}

/**
 * HTTP Entry Point: POST requests
 */
function doPost(e) {
  try {
    return ApiDispatcher.dispatch(e);
  } catch (error) {
    console.error("[Code] Fatal Error in doPost:", error);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: { message: error.message || "Internal Server Error" }
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * HTTP Entry Point: GET requests
 */
function doGet(e) {
  const ui = e.parameter.ui;

  if (ui === 'test') {
    return HtmlService.createTemplateFromFile('views/test_api')
      .evaluate()
      .setTitle("DazzlingDB - API Tester")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (ui === 'admin') {
    return getAdminPanelContent();
  }

  return ApiDispatcher.dispatch(e);
}

/**
 * BRIDGE: Allows the HTML UI to execute API logic via google.script.run.
 * Consolidates Admin and Standard actions.
 */
function executeActionViaUI(request) {
  let { action, payload, token } = request;

  console.log(`[Code] UI Action: ${action}`);

  // Handle flattened requests (where payload properties are at the top level)
  // If the frontend didn't wrap it in 'payload', we do it here.
  if (!payload) {
    const { action: a, token: t, ...rest } = request;
    payload = rest;
  }
  
  const mockEvent = {
    parameter: { 
      action: action,
      token: token
    },
    // We MUST wrap the payload object inside a { payload: ... } envelope so that 
    // ApiDispatcher._extractParams assigns it correctly to params.payload
    postData: { contents: JSON.stringify({ payload: payload }) }
  };

  const output = ApiDispatcher.dispatch(mockEvent);
  
  // Handle both ContentOutput (standard) and raw objects (bootstrap)
  if (output.getContent) {
    return JSON.parse(output.getContent());
  }
  return output;
}
