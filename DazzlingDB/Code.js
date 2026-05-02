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
  if (e.parameter.ui === 'test') {
    return HtmlService.createTemplateFromFile('test_api')
      .evaluate()
      .setTitle("DazzlingDB - API Tester")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return ApiDispatcher.dispatch(e);
}

/**
 * BRIDGE: Allows the testing HTML to execute API logic via google.script.run.
 * Simulates a real GAS event object.
 */
function runInternalApiTest(request) {
  const { method, action, payload } = request;
  
  const mockEvent = {
    parameter: { action: action },
    postData: method === 'POST' ? { contents: JSON.stringify(payload) } : null
  };

  // If GET, merge payload into parameters
  if (method === 'GET' && payload) {
    Object.assign(mockEvent.parameter, payload);
  }

  const output = ApiDispatcher.dispatch(mockEvent);
  return JSON.parse(output.getContent());
}
