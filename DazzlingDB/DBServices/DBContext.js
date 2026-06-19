/**
 * @file DBContext.js
 * Centralized Database Context for DazzlingDB.
 * 
 * Responsibility:
 * - Singleton initialization of the SheetDB library.
 * - Provides a unified access point for all Domain Services.
 */

const DBContext = (function() {
  let instance = null;

  function getTargetFolderId() {
    if (typeof PropertiesService === 'undefined') {
      return typeof DATABASE_ROOT_FOLDER_ID !== 'undefined' ? DATABASE_ROOT_FOLDER_ID : '';
    }
    const scriptProperties = PropertiesService.getScriptProperties();
    const env = scriptProperties.getProperty('ENV') || 'DEVELOPMENT';
    
    // 1. Instantly return standard configured development environments
    if (env === 'PRODUCTION') {
      return scriptProperties.getProperty('PROD_FOLDER_ID') || scriptProperties.getProperty('PROD_DATABASE_ROOT_FOLDER_ID') || DATABASE_ROOT_FOLDER_ID;
    }
    if (env === 'DEVELOPMENT') {
      return scriptProperties.getProperty('DEV_FOLDER_ID') || scriptProperties.getProperty('DEV_DATABASE_ROOT_FOLDER_ID') || DATABASE_ROOT_FOLDER_ID;
    }
    
    // 2. ISOLATED TESTING SANDBOX ENVIRONMENT RESOLUTION
    if (env === 'TESTING') {
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
    
    throw new Error(`Environment Resolution Exception: Unrecognized system execution context [${env}]`);
  }

  function _init() {
    const rootFolderId = getTargetFolderId();
    const activeEnv = (typeof PropertiesService !== 'undefined')
      ? (PropertiesService.getScriptProperties().getProperty('ENV') || 'DEVELOPMENT')
      : (typeof SYSTEM_ENV !== 'undefined' ? SYSTEM_ENV : 'development');
    
    // DATABASE_SCHEMA is assumed to be globally available from Config.js
    if (typeof DATABASE_SCHEMA === 'undefined') {
      throw new Error("[DBContext] Fatal: DATABASE_SCHEMA not found. Ensure Config.js is loaded.");
    }

    console.log(`[DBContext] RESOLVED ENVIRONMENT: '${activeEnv.toUpperCase()}'`);
    console.log(`[DBContext] TARGET ROOT FOLDER ID: '${rootFolderId}'`);

    // 1. Run registrations prior to bootstrapping SheetDB
    if (typeof registerDatabaseValidators === 'function') {
      try {
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
    const isDev = activeEnv.toLowerCase() === "development";
    const db = SheetDB.init(rootFolderId, DATABASE_SCHEMA, {
      allowAutoOverride: isDev,
      dependencyGraph: typeof DEPENDENCY_GRAPH !== 'undefined' ? DEPENDENCY_GRAPH : null
    });

    // 2. Lock the ValidationRegistry to prevent runtime tampering
    if (typeof SheetDB !== 'undefined' && typeof SheetDB.ValidationRegistry !== 'undefined') {
      try {
        SheetDB.ValidationRegistry.lock();
      } catch (e) {
        // Prevent crashing if already locked during re-bootstrapping
      }
    }

    // Attach getSpreadsheetFileByName helper
    db.getSpreadsheetFileByName = function(name) {
      const fileMeta = db._fs.findByName(name);
      return fileMeta ? db._fs.open(fileMeta.id) : null;
    };

    // Attach bootstrapRepositories helper
    db.bootstrapRepositories = function() {
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
    getInstance: function() {
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
    ping: function() {
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
