/**
 * @file DevBootstrap_ApiTest.js
 * Generates a 24-hour Super Admin Token for development and testing.
 * 
 * Instructions: Run `runDevBootstrap()` once per day from the Apps Script editor.
 */

const DevBootstrap_ApiTest = (function() {

  /**
   * Main entry point to bootstrap development super admin session.
   */
  function run() {
    const { logger } = ApiTestHelper;
    console.log("\n🔑 STARTING DEV TOKEN BOOTSTRAP 🔑");

    try {
      const db = DBContext.getInstance();
      
      // 1. Resolve Super Admin identity
      const adminUser = _getOrCreateDevAdmin(db, logger);

      // 2. Generate and persist the 24-hour session
      const token = _createSuperSession(db, adminUser.user_id, logger);

      // 3. Inject token into Script Properties for automated tests
      _saveTokenToProperties(token, logger);

      logger.success("✅ BOOTSTRAP COMPLETE! The token is globally available for API tests.");
      
      // Output raw token for Postman / external use
      console.log("\n=========================================");
      console.log("🔥 SUPER ADMIN TOKEN (Valid for 24h) 🔥");
      console.log(token);
      console.log("=========================================\n");

    } catch (error) {
      if (typeof ApiTestHelper !== "undefined") {
        ApiTestHelper.logger.error(`Bootstrap Failed: ${error.message}`);
      } else {
        console.error(`Bootstrap Failed: ${error.message}`);
      }
    }
  }

  /**
   * Helper: Resolves or physically provisions the dedicated 'dev_admin_moni' account.
   */
  function _getOrCreateDevAdmin(db, logger) {
    logger.action("Resolving Super Admin User ('dev_admin_moni')...");
    let adminUser = db.User.findOne({ username: "dev_admin_moni" });

    if (!adminUser) {
      logger.detail("Admin user 'dev_admin_moni' not found. Creating a physical dummy record...");
      adminUser = db.User.insert({
        user_id: typeof Utilities !== "undefined" ? Utilities.getUuid() : "MOCK-UUID-" + Date.now(),
        username: "dev_admin_moni",
        role: "admin",
        status: "active",
        password_hash: "MOCK_HASH",
        password_salt: "MOCK_SALT"
      });
      logger.success("Dummy super admin created.");
    } else {
      logger.success("Existing super admin found. Re-using ID: " + adminUser.user_id);
    }
    return adminUser;
  }

  /**
   * Helper: Generates a secure session token and caches it with a 24-hour lifetime.
   */
  function _createSuperSession(db, userId, logger) {
    logger.action("Generating 24-Hour Super Token...");
    
    const token = typeof AuthCore !== "undefined" ? AuthCore.generateToken() : "DEV-TOK-" + Math.random().toString(36).substr(2, 9);
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 24);

    // Persist Session physically in the Sheet DB
    db.Session.insert({
      token: token,
      user_id: userId,
      expires_at: expiry,
      client_info: JSON.stringify({ environment: "Dev_API_Test" })
    });

    // Write to Cache for fast, immediate context resolution
    if (typeof CacheService !== "undefined") {
      CacheService.getScriptCache().put(token, userId, 21600); // 6 hours cache limit
    }
    
    return token;
  }

  /**
   * Helper: Registers the generated token in PropertiesService.
   */
  function _saveTokenToProperties(token, logger) {
    logger.action("Injecting Token into Script Properties...");
    if (typeof PropertiesService !== "undefined") {
      PropertiesService.getScriptProperties().setProperty("DEV_SUPER_TOKEN", token);
    }
  }

  return {
    run: run
  };

})();

function runDevBootstrap(){
  DevBootstrap_ApiTest.run();
}
