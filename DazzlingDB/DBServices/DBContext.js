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
   * Idempotently resolves and provisions the testing sandbox Drive folder.
   * @param {Object} scriptProperties - Google Apps Script ScriptProperties instance.
   * @returns {string} Target testing folder ID.
   * @private
   */
  function resolveTestingSandboxFolder(scriptProperties) {
    let testFolderId = scriptProperties.getProperty('TEST_FOLDER_ID');

    // If cache marker is empty, run an idempotent scan to provision the sandbox directory
    if (!testFolderId) {
      let baseRootId = scriptProperties.getProperty('BASE_ROOT_FOLDER_ID');
      if (!baseRootId) {
        baseRootId = scriptProperties.getProperty('DEV_DATABASE_ROOT_FOLDER_ID');
        if (baseRootId) {
          scriptProperties.setProperty('BASE_ROOT_FOLDER_ID', baseRootId);
        } else {
          throw new Error("Framework Error: 'BASE_ROOT_FOLDER_ID' property must be set before initializing testing sandbox.");
        }
      }

      const rootFolder = DriveApp.getFolderById(baseRootId);
      const searchSandbox = rootFolder.getFoldersByName('DazzlingDB_Testing_Sandbox');

      let sandboxFolder;
      if (searchSandbox.hasNext()) {
        sandboxFolder = searchSandbox.next();
      } else {
        sandboxFolder = rootFolder.createFolder('DazzlingDB_Testing_Sandbox');
        console.log(`[DBContext] Idempotent Provisioning: Created isolated sandbox folder: ${sandboxFolder.getName()}`);
      }

      testFolderId = sandboxFolder.getId();
      scriptProperties.setProperty('TEST_FOLDER_ID', testFolderId);
    }

    return testFolderId;
  }

  function getTargetFolderId() {
    if (typeof PropertiesService === 'undefined') {
      return typeof DATABASE_ROOT_FOLDER_ID !== 'undefined' ? DATABASE_ROOT_FOLDER_ID : '';
    }
    const scriptProperties = PropertiesService.getScriptProperties();
    const env = resolveEnvironmentType(scriptProperties.getProperty('ENV'));

    if (env === Environment.DEVELOPMENT) {
      return scriptProperties.getProperty('DEV_FOLDER_ID') || scriptProperties.getProperty('DEV_DATABASE_ROOT_FOLDER_ID') || DATABASE_ROOT_FOLDER_ID;
    }

    if (env === Environment.TESTING) {
      return resolveTestingSandboxFolder(scriptProperties);
    }

    throw new Error(`Environment Resolution Exception: Unrecognized system execution context [${env}]`);
  }

  /**
   * Configures and overrides database caching mechanisms for request-level caching.
   * @param {Object} db - The SheetDB database instance.
   * @private
   */
  function setupRequestCache(db) {
    if (!db || !db._dataSource) return;

    // 1. Wrap purgeCache to also clear the request-scoped cache
    if (typeof db._dataSource.purgeCache === 'function') {
      const originalPurgeCache = db._dataSource.purgeCache.bind(db._dataSource);
      db._dataSource.purgeCache = function () {
        try {
          originalPurgeCache();
          db._requestHeadersCache = {}; // Clear request-scoped cache
          console.log("[DBContext] Request-scoped headers cache cleared.");
        } catch (err) {
          console.warn(`[DBContext] Cache purge failed: ${err.message}`);
        }
      };
    }

    // 2. Wrap getHeaders with a request-scoped in-memory cache
    if (typeof db._dataSource.getHeaders === 'function') {
      const originalGetHeaders = db._dataSource.getHeaders.bind(db._dataSource);
      db._requestHeadersCache = {};

      db._dataSource.getHeaders = function (categoryName, tableName) {
        const cacheKey = `${categoryName}_${tableName}`;
        if (db._requestHeadersCache[cacheKey]) {
          return db._requestHeadersCache[cacheKey];
        }
        const headers = originalGetHeaders(categoryName, tableName);
        db._requestHeadersCache[cacheKey] = headers;
        return headers;
      };
    }
  }

  function _init() {
    const rootFolderId = getTargetFolderId();
    const activeEnv = (typeof PropertiesService !== 'undefined')
      ? resolveEnvironmentType(PropertiesService.getScriptProperties().getProperty('ENV'))
      : (typeof SYSTEM_ENV !== 'undefined' ? SYSTEM_ENV : Environment.DEVELOPMENT);

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
    const isDevOrTest = activeEnv === Environment.DEVELOPMENT || activeEnv === Environment.TESTING;
    const db = SheetDB.init(rootFolderId, DATABASE_SCHEMA, {
      allowAutoOverride: isDevOrTest,
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
    }
  };
})();
