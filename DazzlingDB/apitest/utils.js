/**
 * @file utils.js
 * Layer: API Testing Utility Helper Module
 * Exposes the DevBootstrap engine to automate token caching and account initialization across scopes.
 */

const DevBootstrap = (() => {

  /**
   * Retrieves the globally cached developer session token from script properties.
   * @returns {string|null} The super admin token string, or null if not found.
   */
  function getSuperToken() {
    if (typeof PropertiesService !== "undefined") {
      return PropertiesService.getScriptProperties().getProperty("DEV_SUPER_TOKEN");
    }
    return null;
  }

  /**
   * Resolves or physically provisions the dedicated 'dev_admin_moni' account.
   * @param {Object} db - The active DBContext/SheetDB database instance.
   * @param {Object} logger - ApiTestHelper logger instance.
   * @returns {Object} User record instance.
   */
  function getOrCreateDevAdmin(db, logger) {
    logger.action("Resolving Super Admin User ('dev_admin_moni')...");
    let adminUser = db.User.findOne({ username: "dev_admin_moni" });

    if (!adminUser) {
      logger.detail("Admin user 'dev_admin_moni' not found. Creating a physical dummy record...");
      adminUser = db.User.insert({
        user_id: typeof Utilities !== "undefined" ? Utilities.getUuid() : "MOCK-UUID-" + Date.now(),
        username: "dev_admin_moni",
        role: "superadmin",
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
   * Generates a secure session token and caches it with a 24-hour lifetime.
   * @param {Object} db - The active DBContext/SheetDB database instance.
   * @param {string} userId - Target admin user ID.
   * @param {Object} logger - ApiTestHelper logger instance.
   * @returns {string} The generated session token.
   */
  function createSuperSession(db, userId, logger) {
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
   * Registers the generated token in PropertiesService.
   * @param {string} token - Session token.
   * @param {Object} logger - ApiTestHelper logger.
   */
  function saveTokenToProperties(token, logger) {
    logger.action("Injecting Token into Script Properties...");
    if (typeof PropertiesService !== "undefined") {
      PropertiesService.getScriptProperties().setProperty("DEV_SUPER_TOKEN", token);
    }
  }

  /**
   * Bootstraps the session token inside a specific environment, restoring context in finally.
   * @param {string} [targetEnv="DEVELOPMENT"] - Target environment string (DEVELOPMENT, TESTING).
   * @throws {Error} If bootstrap lifecycle fails.
   */
  function run(targetEnv = "DEVELOPMENT") {
    const { logger } = ApiTestHelper;
    console.log(`\n🔑 STARTING DEV TOKEN BOOTSTRAP FOR ENVIRONMENT: [${targetEnv}] 🔑`);

    const initialEnv = typeof PropertiesService !== "undefined"
      ? PropertiesService.getScriptProperties().getProperty("ENV")
      : "DEVELOPMENT";

    try {
      // 1. Swap context to target environment
      if (typeof PropertiesService !== "undefined") {
        PropertiesService.getScriptProperties().setProperty("ENV", targetEnv);
      }
      DBContext.getInstance().bootstrapRepositories();
      const db = DBContext.getInstance();

      // Provision sandbox files if they don't exist in testing env
      if (targetEnv === "TESTING" || targetEnv === "testing") {
        db.setup.provision();
      }

      // 2. Resolve Super Admin identity
      const adminUser = getOrCreateDevAdmin(db, logger);

      // 3. Generate and persist the 24-hour session
      const token = createSuperSession(db, adminUser.user_id, logger);

      // 4. Inject token into Script Properties
      saveTokenToProperties(token, logger);

      logger.success(`✅ BOOTSTRAP COMPLETE! Token resolved and stored for [${targetEnv}].`);
      console.log("\n=========================================");
      console.log(`🔥 SUPER ADMIN TOKEN (${targetEnv}) 🔥`);
      console.log(token);
      console.log("=========================================\n");

    } catch (error) {
      logger.error(`Bootstrap Failed for environment [${targetEnv}]: ${error.message}`);
      throw error;
    } finally {
      // Restore initial environment context and re-bootstrap
      if (typeof PropertiesService !== "undefined") {
        PropertiesService.getScriptProperties().setProperty("ENV", initialEnv);
      }
      DBContext.getInstance().bootstrapRepositories();
    }
  }

  return {
    getOrCreateDevAdmin,
    createSuperSession,
    saveTokenToProperties,
    getSuperToken,
    run
  };
})();

globalThis.DevBootstrap = DevBootstrap;
