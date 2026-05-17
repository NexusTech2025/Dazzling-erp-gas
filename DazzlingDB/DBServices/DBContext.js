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

  /**
   * Internal initializer.
   */
  function _init() {
    const rootFolderId = DATABASE_ROOT_FOLDER_ID;
    
    // DATABASE_SCHEMA is assumed to be globally available from Config.js
    if (typeof DATABASE_SCHEMA === 'undefined') {
      throw new Error("[DBContext] Fatal: DATABASE_SCHEMA not found. Ensure Config.js is loaded.");
    }

    console.log(`[DBContext] Bootstrapping SheetDB for ${DATABASE_SCHEMA.database}...`);
    return SheetDB.init(rootFolderId, DATABASE_SCHEMA);
  }

  return {
    /**
     * Returns the singleton database instance.
     * @returns {Object} The active SheetDB instance.
     */
    getInstance: function() {
      if (!instance) {
        instance = _init();
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
