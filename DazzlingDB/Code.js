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
  db.setup.provision();
  console.log("[App] Provisioning Complete.");
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
  return ApiDispatcher.dispatch(e);
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
    return HtmlService.createTemplateFromFile('views/admin_acc')
      .evaluate()
      .setTitle("Admin Control Center | DazzlingDB")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return ApiDispatcher.dispatch(e);
}

/**
 * BRIDGE: Allows the HTML UI to execute API logic via google.script.run.
 * Consolidates Admin and Standard actions.
 */
function executeActionViaUI(request) {
  const { action, payload, token } = request;
  
  const mockEvent = {
    parameter: { 
      action: action,
      token: token
    },
    postData: { contents: JSON.stringify(payload || {}) }
  };

  const output = ApiDispatcher.dispatch(mockEvent);
  return JSON.parse(output.getContent());
}
