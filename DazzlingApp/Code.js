/**
 * --------------------------------------------------------------
 * doGet(e)
 * --------------------------------------------------------------
 *
 * Google Apps Script Web App entrypoint.
 *
 * Responsibilities:
 * - Parse parameters
 * - Bootstrap ORM
 * - Resolve Action
 * - Execute action lifecycle
 * - Ensure IdentityMap cleanup
 * - Return JSON response
 *
 * Execution Flow:
 *
 * HTTP → doGet → ActionRegistry → Action.run() → ORM → Response
 */
function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};

  // Bootstrap ORM (and implicitly AuthService)
  const orm = bootstrapORM();
  const authService = orm.getAuthService();

  try {
    const ActionClass = ActionRegistry.resolve(params.action);

    // Resolve user identity from token
    const token = params.token || null;
    const user = authService.authenticate(token);

    const actionInstance = new ActionClass({
      orm,
      params,
      user, // Inject authenticated user model (can be null)
      context: {
        method: "GET",
        timestamp: new Date().toISOString()
      }
    });

    const result = actionInstance.run();

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    // ... rest of error handling

    const errorResponse = {
      success: false,
      action: params.action || null,
      error: {
        type: error.name || "UnknownError",
        message: error.message || "Unexpected system failure."
      }
    };

    return ContentService
      .createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);

  } finally {
    // Ensure IdentityMap lifecycle reset per request
    if (orm && typeof orm.clear === "function") {
      orm.clear();
    }
  }
}

/**
 * --------------------------------------------------------------
 * doPost(e)
 * --------------------------------------------------------------
 *
 * Google Apps Script Web App POST entrypoint.
 *
 * Responsibilities:
 * - Parse JSON POST body
 * - Extract action and token
 * - Bootstrap ORM & AuthService
 * - Execute action lifecycle
 */
function doPost(e) {
  let params = {};
  
  try {
    // 1. Parse JSON payload if exists
    if (e && e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    }
    
    // Merge URL parameters (if any) into the params object
    if (e && e.parameter) {
      params = { ...e.parameter, ...params };
    }

    const orm = bootstrapORM();
    const authService = orm.getAuthService();

    // 2. Resolve Action
    const ActionClass = ActionRegistry.resolve(params.action);

    // 3. Resolve user identity
    const token = params.token || null;
    const user = authService.authenticate(token);

    // 4. Execute standard lifecycle
    const actionInstance = new ActionClass({
      orm,
      params,
      user,
      context: {
        method: "POST",
        timestamp: new Date().toISOString()
      }
    });

    const result = actionInstance.run();

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    const errorResponse = {
      success: false,
      error: {
        type: error.name || "RequestError",
        message: error.message || "Failed to process POST request."
      }
    };

    return ContentService
      .createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


