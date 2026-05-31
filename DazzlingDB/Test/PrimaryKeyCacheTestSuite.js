/**
 * @file PrimaryKeyCacheTestSuite.js
 * Integration & Unit Tests for the PrimaryKeyCache mechanism.
 * Focus: Lazy Loading, Insertion Sync, Deletion Sync, Cache Invalidation, and Edge Cases.
 *
 * Run 'runPrimaryKeyCacheTests' from the Apps Script IDE.
 */

const PrimaryKeyCacheTestSuite = (function () {
  const TEST_FOLDER_ID = DATABASE_ROOT_FOLDER_ID;

  function runAll() {
    const activeEnv = typeof SYSTEM_ENV !== 'undefined' ? SYSTEM_ENV : 'development';
    if (activeEnv === 'production') {
      throw new Error("❌ Safety Guard: Test suite cannot be executed in the PRODUCTION environment.");
    }

    const schema = getTestSchema();
    console.log(`🚀 Initializing Database for PrimaryKeyCache Tests...`);
    const db = SheetDB.init(TEST_FOLDER_ID, schema, { allowAutoOverride: true });

    // Setup & Clean
    db.setup.provision();
    _teardown(db);

    const results = {};
    let passed = 0;
    let failed = 0;

    const scenarios = [
      { name: "Scenario 1: Lazy Loading (Cache Miss)", fn: () => testLazyLoading(db) },
      { name: "Scenario 2: Add to Cache on Insert", fn: () => testCacheAdd(db) },
      { name: "Scenario 3: Remove from Cache on Delete", fn: () => testCacheRemove(db) },
      { name: "Scenario 4: Direct Invalidation", fn: () => testCacheInvalidate(db) },
      { name: "Scenario 5: Bulk Purge (db.purge)", fn: () => testCacheBulkPurge(db) },
      { name: "Scenario 6: Edge Cases & Boundary Constraints", fn: () => testCacheEdgeCases(db) }
    ];

    scenarios.forEach(scenario => {
      try {
        scenario.fn();
        console.log(`✅ PASS: ${scenario.name}`);
        results[scenario.name] = "✅ PASSED";
        passed++;
      } catch (e) {
        console.error(`❌ FAIL: ${scenario.name} -> ${e.message}`);
        if (e.stack) console.error(e.stack);
        results[scenario.name] = `❌ FAILED: ${e.message}`;
        failed++;
      }
    });

    // Final clean
    _teardown(db);

    console.log(`=== PK CACHE TESTS COMPLETE: ${passed} Passed, ${failed} Failed ===`);
    return results;
  }

  // Teardown test keys
  function _teardown(db) {
    const keys = ["STU-PK-101", "STU-PK-102", "STU-PK-999", "STU-PK-EDGE"];
    const repo = db.Student;
    if (repo) {
      keys.forEach(id => {
        try {
          const rec = repo.findById(id);
          if (rec) rec.delete();
        } catch (e) {}
      });
    }
  }

  // --- SCENARIO IMPLEMENTATIONS ---

  function testLazyLoading(db) {
    db._pkCache.clear();
    const cacheObj = db._pkCache._cache;
    
    if (cacheObj.Student !== undefined) {
      throw new Error("Initial state error: Cache for Student should be undefined.");
    }

    // Trigger lazy loading
    const keys = db._pkCache.get("Student");
    
    if (!keys || typeof keys.has !== 'function' || typeof keys.size !== 'number') {
      throw new Error("Cache get() must return a Set instance.");
    }
    if (cacheObj.Student === undefined) {
      throw new Error("After query, cache should contain the entry for Student.");
    }
  }

  function testCacheAdd(db) {
    const id = "STU-PK-101";
    // Ensure cache loaded
    db._pkCache.get("Student");

    // Use TestMockData registry helper for generating student payload
    const payload = TestMockData.createMock("Student", { student_id: id });
    db.Student.insert(payload);

    const keys = db._pkCache.get("Student");
    if (!keys.has(id)) {
      throw new Error("Cache failed to automatically append new ID on record insert.");
    }
  }

  function testCacheRemove(db) {
    const id = "STU-PK-101";
    const record = db.Student.findById(id);
    if (!record) throw new Error(`Pre-requisite failed: Record ${id} not found.`);

    record.delete();

    const keys = db._pkCache.get("Student");
    if (keys.has(id)) {
      throw new Error("Cache failed to automatically remove deleted ID on record delete.");
    }
  }

  function testCacheInvalidate(db) {
    db._pkCache.get("Student"); // Populate
    
    db._pkCache.invalidate("Student");
    
    const cacheObj = db._pkCache._cache;
    if (cacheObj.Student !== undefined) {
      throw new Error("Cache entry was not deleted upon invalidate() call.");
    }
  }

  function testCacheBulkPurge(db) {
    db._pkCache.get("Student"); // Populate
    
    db.purge(); // Calls clear() internally
    
    const cacheObj = db._pkCache._cache;
    if (Object.keys(cacheObj).length !== 0) {
      throw new Error("Cache bulk purge failed; internal cache object is not empty.");
    }
  }

  function testCacheEdgeCases(db) {
    const cache = db._pkCache;
    cache.get("Student"); // Load

    // 1. Guard against empty/undefined inputs
    const initialSize = cache.get("Student").size;
    cache.add("Student", null);
    cache.add("Student", undefined);
    cache.add("Student", "");
    
    if (cache.get("Student").size !== initialSize) {
      throw new Error("Edge case failure: Null, undefined, or empty inputs mutated the cache size.");
    }

    // 2. Trim verification
    const idWithSpaces = "  STU-PK-EDGE   ";
    cache.add("Student", idWithSpaces);
    
    if (!cache.get("Student").has("STU-PK-EDGE")) {
      throw new Error("Edge case failure: ID was not trimmed prior to cache insertion.");
    }
    
    cache.remove("Student", idWithSpaces);
    if (cache.get("Student").has("STU-PK-EDGE")) {
      throw new Error("Edge case failure: ID was not trimmed prior to cache removal.");
    }
  }

  function getTestSchema() {
    return {
      "version": "1.0.0",
      "database": "CacheTestDB",
      "categories": {
        "Students": {
          "tables": {
            "Student": {
              "primaryKey": "student_id",
              "columns": {
                "student_id": { "type": "string" },
                "student_name": { "type": "string" },
                "email": { "type": "string" },
                "status": { "type": "string" }
              }
            }
          }
        }
      }
    };
  }

  return {
    runAll: runAll
  };
})();

function runPrimaryKeyCacheTests() {
  PrimaryKeyCacheTestSuite.runAll();
}
