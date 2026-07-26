/**
 * @file CacheAnalyzer.js
 * Standalone diagnostic script to analyze and show all cached data in a grouped format.
 * 
 * Instructions: Run `runCacheAnalysis()` from the Google Apps Script editor.
 */

const CacheAnalyzer = (function() {

  /**
   * Main analysis execution engine.
   */
  function analyze() {
    console.log("\n=========================================");
    console.log("🔍 DAZZLINGDB CACHE DIAGNOSTIC ANALYZER 🔍");
    console.log("=========================================\n");

    const cache = CacheService.getScriptCache();
    const db = DBContext.getInstance();

    // 1. ANALYZE PHYSICAL TABLE HEADERS
    _analyzeHeaders(cache);

    // 2. ANALYZE ACTIVE LOGIN SESSIONS
    _analyzeSessions(cache, db);

    // 3. ANALYZE SECURITY BRUTE-FORCE LOCKOUTS
    _analyzeLockouts(cache, db);

    console.log("=========================================");
    console.log("🏁 Cache Analysis Completed Successfully.");
    console.log("=========================================\n");
  }

  /**
   * Helper: Reads, parses, and groups table header caches by Schema Category.
   */
  function _analyzeHeaders(cache) {
    console.log("📂 PHASE 1: Table Columns/Headers Cache");
    console.log("-----------------------------------------");

    const CACHE_KEY = "dazzling_db_headers_v2";
    const rawHeadersStr = cache.get(CACHE_KEY);

    if (!rawHeadersStr) {
      console.log("   ⚠️ Cache Key 'dazzling_db_headers_v2' is EMPTY (No cached headers found).");
      console.log("");
      return;
    }

    let allHeaders;
    try {
      allHeaders = JSON.parse(rawHeadersStr);
    } catch (e) {
      console.error(`   ❌ Failed to parse headers JSON cache: ${e.message}`);
      return;
    }

    const trackedKeys = new Set();

    // Group by category based on active schema
    for (const categoryName in DATABASE_SCHEMA.categories) {
      console.log(`   📁 Category: ${categoryName}`);
      const tables = DATABASE_SCHEMA.categories[categoryName].tables;
      let tableCount = 0;

      for (const tableName in tables) {
        const subKey = `${categoryName}_${tableName}`;
        if (allHeaders[subKey]) {
          console.log(`      ↳ 📄 Table: ${tableName}`);
          console.log(`         📦 Columns: ${JSON.stringify(allHeaders[subKey])}`);
          trackedKeys.add(subKey);
          tableCount++;
        }
      }

      if (tableCount === 0) {
        console.log("      (No tables currently cached in this category)");
      }
      console.log("");
    }

    // Identify stale/dangling cache keys
    const danglingKeys = Object.keys(allHeaders).filter(k => !trackedKeys.has(k));
    if (danglingKeys.length > 0) {
      console.log("   ⚠️ Dangling/Stale Headers Cached (Not matching active schema):");
      danglingKeys.forEach(k => {
        console.log(`      ↳ 🛑 Key: ${k}`);
        console.log(`         📦 Columns: ${JSON.stringify(allHeaders[k])}`);
      });
      console.log("");
    }
  }

  /**
   * Helper: Matches active database sessions against CacheService entries.
   */
  function _analyzeSessions(cache, db) {
    console.log("🔑 PHASE 2: Active User Sessions Cache");
    console.log("-----------------------------------------");

    let sessions = [];
    try {
      sessions = db.Session.where({});
    } catch (e) {
      console.error(`   ❌ Failed to read sessions from database: ${e.message}`);
      return;
    }

    if (sessions.length === 0) {
      console.log("   ℹ️ No active sessions found in database.");
      console.log("");
      return;
    }

    let hitCount = 0;
    let missCount = 0;

    sessions.forEach(session => {
      const cachedUserId = cache.get(session.token);
      const isHit = cachedUserId !== null;

      if (isHit) {
        hitCount++;
        console.log(`   ✅ [HIT]  Token: ${session.token}`);
        console.log(`             User ID: ${session.user_id} (Cached: ${cachedUserId})`);
        console.log(`             Expires: ${session.expires_at}`);
      } else {
        missCount++;
        console.log(`   ⚠️ [MISS] Token: ${session.token}`);
        console.log(`             User ID: ${session.user_id} (Not present in cache)`);
        console.log(`             Expires: ${session.expires_at}`);
      }
      console.log("");
    });

    console.log(`   📊 Summary: Total Sessions: ${sessions.length} | Cache Hits: ${hitCount} | Cache Misses: ${missCount}`);
    console.log("");
  }

  /**
   * Helper: Checks lockout states for registered users.
   */
  function _analyzeLockouts(cache, db) {
    console.log("🛡️ PHASE 3: Security Lockout Cache");
    console.log("-----------------------------------------");

    let users = [];
    try {
      users = db.User.where({});
    } catch (e) {
      console.error(`   ❌ Failed to read users from database: ${e.message}`);
      return;
    }

    if (users.length === 0) {
      console.log("   ℹ️ No registered users found in system.");
      console.log("");
      return;
    }

    let lockoutCount = 0;

    users.forEach(user => {
      const lockoutKey = `lockout_${user.username}`;
      const isLocked = cache.get(lockoutKey) !== null;

      if (isLocked) {
        lockoutCount++;
        console.log(`   🔒 [LOCKED] User: ${user.username} (ID: ${user.user_id})`);
        console.log(`               Lockout Cache Key: '${lockoutKey}' is active.`);
      } else {
        console.log(`   🔓 [ACTIVE] User: ${user.username} (ID: ${user.user_id})`);
        console.log(`               Failed Attempts (DB): ${user.failed_attempts || 0}`);
      }
      console.log("");
    });

    console.log(`   📊 Summary: Total Users: ${users.length} | Active Lockouts: ${lockoutCount}`);
    console.log("");
  }

  /**
   * Compiles and returns cache metadata for UI consumption.
   * @returns {Object} Grouped cache diagnostic data.
   */
  function getReportData() {
    const cache = CacheService.getScriptCache();
    const db = DBContext.getInstance();

    return {
      headers: _getHeadersData(cache),
      sessions: _getSessionsData(cache, db),
      lockouts: _getLockoutsData(cache, db)
    };
  }

  function _getHeadersData(cache) {
    const CACHE_KEY = "dazzling_db_headers_v2";
    const rawHeadersStr = cache.get(CACHE_KEY);
    if (!rawHeadersStr) return { categories: {}, stale: [] };

    let allHeaders = {};
    try {
      allHeaders = JSON.parse(rawHeadersStr);
    } catch(e) {
      return { categories: {}, stale: [], error: e.message };
    }

    const trackedKeys = new Set();
    const categories = {};

    for (const categoryName in DATABASE_SCHEMA.categories) {
      categories[categoryName] = [];
      const tables = DATABASE_SCHEMA.categories[categoryName].tables;

      for (const tableName in tables) {
        const subKey = `${categoryName}_${tableName}`;
        if (allHeaders[subKey]) {
          categories[categoryName].push({
            table: tableName,
            columns: allHeaders[subKey]
          });
          trackedKeys.add(subKey);
        }
      }
    }

    const stale = [];
    const danglingKeys = Object.keys(allHeaders).filter(k => !trackedKeys.has(k));
    danglingKeys.forEach(k => {
      stale.push({
        key: k,
        columns: allHeaders[k]
      });
    });

    return { categories, stale };
  }

  function _getSessionsData(cache, db) {
    let sessions = [];
    try {
      sessions = db.Session.where({});
    } catch (e) {
      return { list: [], error: e.message };
    }

    const list = sessions.map(session => {
      const cachedUserId = cache.get(session.token);
      const user = db.User.findById(session.user_id);
      return {
        sessionId: session.session_id,
        token: session.token,
        userId: session.user_id,
        username: user ? user.username : "Unknown",
        role: user ? user.role : "Unknown",
        expiresAt: session.expires_at,
        isHit: cachedUserId !== null,
        cachedUserId: cachedUserId
      };
    });

    return { list };
  }

  function _getLockoutsData(cache, db) {
    let users = [];
    try {
      users = db.User.where({});
    } catch (e) {
      return { list: [], error: e.message };
    }

    const list = users.map(user => {
      const lockoutKey = `lockout_${user.username}`;
      const isLocked = cache.get(lockoutKey) !== null;
      return {
        username: user.username,
        userId: user.user_id,
        failedAttempts: user.failed_attempts || 0,
        isLocked: isLocked
      };
    });

    return { list };
  }

  return {
    analyze: analyze,
    getReportData: getReportData
  };

})();

/**
 * Global entry point function to execute the analyzer.
 */
function runCacheAnalysis() {
  CacheAnalyzer.analyze();
}
