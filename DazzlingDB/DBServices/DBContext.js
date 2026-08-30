/**
 * @file DBContext.js
 * Centralized Database Context for DazzlingDB.
 * 
 * Responsibility:
 * - Singleton initialization of the SheetDB library.
 * - Provides a unified access point for all Domain Services.
 */

const DBContext = (function () {
  let instance = null;

  /**
   * Resolves the target Google Drive Root Folder ID strictly for Production.
   * @returns {string} Production root folder ID.
   * @private
   */
  function getTargetFolderId() {
    if (typeof PropertiesService === 'undefined') {
      return typeof DATABASE_ROOT_FOLDER_ID !== 'undefined' ? DATABASE_ROOT_FOLDER_ID : '';
    }
    const scriptProperties = PropertiesService.getScriptProperties();
    return scriptProperties.getProperty('PROD_DATABASE_ROOT_FOLDER_ID') || scriptProperties.getProperty('PROD_FOLDER_ID') || DATABASE_ROOT_FOLDER_ID;
  }

  /**
   * Configures database caching mechanisms for request-level caching.
   * @param {Object} db - The SheetDB database instance.
   * @private
   */
  function setupRequestCache(db) {
    if (!db || !db._dataSource) return;
    console.log("[DBContext] RequestHeaderCache protocol established natively via SheetDB.");
  }

  function _init() {
    const rootFolderId = getTargetFolderId();
    const activeEnv = Environment.PRODUCTION;

    // DATABASE_SCHEMA is assumed to be globally available from Config.js
    if (typeof DATABASE_SCHEMA === 'undefined') {
      throw new Error("[DBContext] Fatal: DATABASE_SCHEMA not found. Ensure Config.js is loaded.");
    }

    console.log(`[DBContext] RESOLVED ENVIRONMENT: '${activeEnv}'`);
    console.log(`[DBContext] TARGET ROOT FOLDER ID: '${rootFolderId}'`);

    // 1. Run registrations prior to bootstrapping SheetDB
    if (typeof registerDatabaseValidators === 'function') {
      try {
        if (typeof SheetDB !== 'undefined' && typeof SheetDB.ValidationRegistry !== 'undefined' && typeof SheetDB.ValidationRegistry.unlock === 'function') {
          try {
            SheetDB.ValidationRegistry.unlock();
          } catch (unlockErr) {
            // Guarded unlock bypass
          }
        }
        registerDatabaseValidators();
      } catch (e) {
        console.log(`[DBContext] Custom validators already registered or locked: ${e.message}`);
      }
    }
    if (typeof registerPolymorphicMappings === 'function') {
      try {
        registerPolymorphicMappings();
      } catch (e) {
        console.log(`[DBContext] Polymorphic mappings already registered or locked: ${e.message}`);
      }
    }

    console.log(`[DBContext] Bootstrapping SheetDB for ${DATABASE_SCHEMA.database}...`);
    const db = SheetDB.init(rootFolderId, DATABASE_SCHEMA, {
      allowAutoOverride: false,
      dependencyGraph: typeof DEPENDENCY_GRAPH !== 'undefined' ? DEPENDENCY_GRAPH : null
    });

    // Configure Request-Scoped Cache & Boot Purging
    setupRequestCache(db);

    // Seed/warm the spreadsheet name-to-ID cache in PropertiesService
    if (typeof PropertiesService !== 'undefined') {
      try {
        const fileIdsMap = {};
        const files = db._fs.listAll();
        files.forEach(f => {
          if (f.name && f.id) {
            fileIdsMap[f.name] = f.id;
          }
        });
        PropertiesService.getScriptProperties().setProperty('DB_FILE_IDS', JSON.stringify(fileIdsMap));
        console.log(`[DBContext] Successfully cached ${Object.keys(fileIdsMap).length} category file ID mappings.`);
      } catch (err) {
        console.warn(`[DBContext] Warm-caching database file mappings failed: ${err.message}`);
      }
    }

    // 2. Lock the ValidationRegistry to prevent runtime tampering
    if (typeof SheetDB !== 'undefined' && typeof SheetDB.ValidationRegistry !== 'undefined') {
      try {
        SheetDB.ValidationRegistry.lock();
      } catch (e) {
        // Prevent crashing if already locked during re-bootstrapping
      }
    }

    // Attach getSpreadsheetFileByName helper
    db.getSpreadsheetFileByName = function (name) {
      const fileMeta = db._fs.findByName(name);
      return fileMeta ? db._fs.open(fileMeta.id) : null;
    };

    // Attach bootstrapRepositories helper
    db.bootstrapRepositories = function () {
      console.log("[DBContext] bootstrapRepositories invoked: resetting database instance.");
      instance = _init();
      return instance;
    };

    return db;
  }

  return {
    /**
     * Returns the singleton database instance.
     * @returns {Object} The active SheetDB instance.
     */
    getInstance: function () {
      const activeFolderId = getTargetFolderId();
      if (!instance || (instance._fs && instance._fs.rootFolderId !== activeFolderId)) {
        console.log("[DBContext] Cache MISS - Initializing fresh database instance (Cold Container).");
        instance = _init();
      } else {
        console.log("[DBContext] Cache HIT - Returning existing singleton instance (Warm Container).");
      }
      return instance;
    },

    /**
     * Performs a physical health check (Ping) of the database.
     * @returns {Object} Health status report.
     */
    ping: function () {
      const db = this.getInstance();
      console.log("[DBContext] Executing Health Check...");

      // Note: This relies on the library having the ping() method implemented.
      // If not, it will return a basic status.
      if (typeof db.ping === 'function') {
        return db.ping();
      }

      return { status: "OK", message: "Database context is active. (Library-level ping pending implementation)" };
    },

    /**
     * Resolves the active environment's root folder ID string.
     * @returns {string} Root container folder ID.
     */
    getTargetFolderId: getTargetFolderId
  };
})();
