/**
 * --------------------------------------------------------------
 * doGet(e)
 * --------------------------------------------------------------
 *
 * Google Apps Script Web App entrypoint.
 */
function doGet(e) {
  const startTime = Date.now();
  const txId = ServerLogger.generateId();
  const logger = new ServerLogger(txId);

  const params = (e && e.parameter) ? e.parameter : {};
  logger.info("ROUTER", `INCOMING GET: action=${params.action || 'none'}`);
  logger.json("DATA", "Request Params", params);

  // 1. ROUTE: Admin-related HTML pages

  if (params.page === "admin") {
    if (params.mode === "setup") {
      logger.info("ROUTER", "Serving Admin Setup Page");
      return setupAdmin();
    }

    // Session Inspector
    if (params.mode === "sessions") {
      logger.info("ROUTER", "Serving Session Inspector Page");
      return HtmlService.createHtmlOutputFromFile('session_inspector')
        .setTitle("Session Inspector | Dazzling CRM");
    }

    // NEW: Registration Page
    if (params.mode === "registration") {
      logger.info("ROUTER", "Serving Registration Page");
      return HtmlService.createHtmlOutputFromFile('registration')
        .setTitle("Entity Registration | Dazzling CRM");
    }
  }

  // 2. Default: API Response
  const orm = bootstrapORM();
  const authService = orm.getAuthService();

  try {
    const ActionClass = ActionRegistry.resolve(params.action);

    // Resolve user identity
    const token = params.token || null;
    const user = authService.authenticate(token);

    if (user) {
      logger.info("AUTH", `Authenticated: ${user.get("username")} (${user.id})`);
    } else if (token) {
      logger.warn("AUTH", "Invalid or expired token provided.");
    }

    const actionInstance = new ActionClass({
      orm,
      params,
      user,
      context: { method: "GET", txId }
    });

    const result = actionInstance.run();

    logger.json("DATA", "Response Payload", result);

    const duration = Date.now() - startTime;
    logger.success("ROUTER", `COMPLETED: ${params.action} (${duration}ms)`);

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("ROUTER", `FAILED: ${error.message} (After ${duration}ms)`);

    const errorResponse = {
      success: false,
      action: params.action || null,
      error: { type: error.name || "UnknownError", message: error.message }
    };

    return ContentService
      .createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);

  } finally {
    if (orm && typeof orm.clear === "function") orm.clear();
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
  const startTime = Date.now();
  const txId = ServerLogger.generateId();
  const logger = new ServerLogger(txId);

  let params = {};

  try {
    if (e && e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    }
    if (e && e.parameter) {
      params = { ...e.parameter, ...params };
    }

    logger.info("ROUTER", `INCOMING POST: action=${params.action || 'none'}`);
    logger.json("DATA", "Request Params", params);

    const orm = bootstrapORM();
    const authService = orm.getAuthService();

    const ActionClass = ActionRegistry.resolve(params.action);

    // Resolve user identity
    const token = params.token || null;
    const user = authService.authenticate(token);

    if (user) {
      logger.info("AUTH", `Authenticated: ${user.get("username")} (${user.id})`);
    }

    const actionInstance = new ActionClass({
      orm,
      params,
      user,
      context: { method: "POST", txId }
    });

    const result = actionInstance.run();

    logger.json("DATA", "Response Payload", result);

    const duration = Date.now() - startTime;
    logger.success("ROUTER", `COMPLETED: ${params.action} (${duration}ms)`);

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("ROUTER", `POST FAILED: ${error.message} (After ${duration}ms)`);

    const errorResponse = {
      success: false,
      error: { type: error.name || "RequestError", message: error.message }
    };

    return ContentService
      .createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * --------------------------------------------------------------
 * UI Bridge Helpers
 * --------------------------------------------------------------
 */

function getSessionsForUI() {
  return SessionManager.listSessions();
}

function destroySessionFromUI(token) {
  SessionManager.destroy(token);
  return true;
}

/**
 * --------------------------------------------------------------
 * setupAdmin()
 * --------------------------------------------------------------
 * 
 * Serves the one-time admin setup UI.
 * Accessible only if no admin account exists.
 */
function setupAdmin() {
  const orm = bootstrapORM();
  const userRepo = orm.getRepository("User");

  if (userRepo.exists({ role: "admin" })) {
    return ContentService.createTextOutput("System already initialized. Setup page is disabled.");
  }

  return HtmlService.createTemplateFromFile('admin')
    .evaluate()
    .setTitle('Initialize System | Dazzling CRM')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * --------------------------------------------------------------
 * executeActionViaUI(payload)
 * --------------------------------------------------------------
 * 
 * Universal bridge for Client-Side HTML to execute ORM Actions.
 * 
 * @param {Object} payload - Standard action payload { action, ...params }
 * @returns {Object} Standard API response envelope
 */
function executeActionViaUI(payload) {
  const startTime = Date.now();
  const txId = ServerLogger.generateId();
  const logger = new ServerLogger(txId);

  logger.info("UI_BRIDGE", `INCOMING ACTION: ${payload.action || 'none'}`);
  logger.json("UI_BRIDGE", "Payload", payload);

  const orm = bootstrapORM();
  const authService = orm.getAuthService();

  try {
    const ActionClass = ActionRegistry.resolve(payload.action);
    const token = payload.token || null;
    const user = authService.authenticate(token);

    if (user) {
      logger.info("AUTH", `Authenticated: ${user.get("username")} (${user.id})`);
    }

    const actionInstance = new ActionClass({
      orm,
      params: payload,
      user,
      context: { method: "UI_BRIDGE", txId }
    });

    const result = actionInstance.run();

    logger.json("UI_BRIDGE", "Result", result);

    const duration = Date.now() - startTime;
    logger.success("UI_BRIDGE", `COMPLETED: ${payload.action} (${duration}ms)`);

    return JSON.stringify(result);

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("UI_BRIDGE", `FAILED: ${error.message} (After ${duration}ms)`);

    return {
      success: false,
      action: payload.action || null,
      error: { type: error.name || "BridgeError", message: error.message }
    };
  } finally {
    if (orm && typeof orm.clear === "function") orm.clear();
  }
}

