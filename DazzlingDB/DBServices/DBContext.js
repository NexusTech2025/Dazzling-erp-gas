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

  function _init() {
    const rootFolderId = DATABASE_ROOT_FOLDER_ID;
    const activeEnv = typeof SYSTEM_ENV !== 'undefined' ? SYSTEM_ENV : 'development';
    
    // DATABASE_SCHEMA is assumed to be globally available from Config.js
    if (typeof DATABASE_SCHEMA === 'undefined') {
      throw new Error("[DBContext] Fatal: DATABASE_SCHEMA not found. Ensure Config.js is loaded.");
    }

    console.log(`[DBContext] RESOLVED ENVIRONMENT: '${activeEnv.toUpperCase()}'`);
    console.log(`[DBContext] TARGET ROOT FOLDER ID: '${rootFolderId}'`);

    // 1. Run registrations prior to bootstrapping SheetDB
    if (typeof registerDatabaseValidators === 'function') {
      registerDatabaseValidators();
    }
    if (typeof registerPolymorphicMappings === 'function') {
      registerPolymorphicMappings();
    }

    console.log(`[DBContext] Bootstrapping SheetDB for ${DATABASE_SCHEMA.database}...`);
    const isDev = activeEnv === "development";
    const db = SheetDB.init(rootFolderId, DATABASE_SCHEMA, {
      allowAutoOverride: isDev,
      dependencyGraph: typeof DEPENDENCY_GRAPH !== 'undefined' ? DEPENDENCY_GRAPH : null
    });

    // 2. Lock the ValidationRegistry to prevent runtime tampering
    if (typeof SheetDB !== 'undefined' && typeof SheetDB.ValidationRegistry !== 'undefined') {
      SheetDB.ValidationRegistry.lock();
    }

    return db;
  }

  return {
    /**
     * Returns the singleton database instance.
     * @returns {Object} The active SheetDB instance.
     */
    getInstance: function() {
      if (!instance) {
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
