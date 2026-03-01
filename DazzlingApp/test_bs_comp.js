/**
 * ==============================================================
 * Bootstrap_CompositionRoot_Test.gs (Rich Logging Version)
 * ==============================================================
 *
 * Purpose:
 * --------------------------------------------------------------
 * Unit-style verification tests for:
 *   - Global structural wiring
 *   - Repository registration
 *   - Per-request ORM instantiation
 *   - IdentityMap isolation per request
 *
 * Enhanced with rich logging markers:
 *   ✅ = Test Passed
 *   ❌ = Test Failed
 *   🔎 = Diagnostic Info
 *   🚀 = Test Start
 *
 * ==============================================================
 */


/* ==============================================================
 * LOGGING HELPERS
 * ==============================================================
 */
function logStart(name) {
  Logger.log("🚀 START: " + name);
}

function logPass(name) {
  Logger.log("✅ PASS: " + name);
}

function logFail(name, error) {
  Logger.log("❌ FAIL: " + name + " → " + error.message);
}

function logInfo(message) {
  Logger.log("🔎 INFO: " + message);
}


/* ==============================================================
 * ASSERTION HELPERS
 * ==============================================================
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(a, b, message) {
  if (a !== b) {
    throw new Error(message + " | Expected: " + b + " Got: " + a);
  }
}

function assertNotEqual(a, b, message) {
  if (a === b) {
    throw new Error(message);
  }
}


/* ==============================================================
 * TEST 1 — Global Structural Wiring
 * ==============================================================
 */
function test_Global_Structural_Wiring() {
  const testName = "Global Structural Wiring";
  logStart(testName);

  try {
    assert(typeof GLOBAL_SCHEMA_REGISTRY !== "undefined",
      "GLOBAL_SCHEMA_REGISTRY should exist.");

    assert(typeof GLOBAL_REPOSITORY_REGISTRY !== "undefined",
      "GLOBAL_REPOSITORY_REGISTRY should exist.");

    assert(typeof GLOBAL_REPOSITORY_REGISTRY.get === "function",
      "RepositoryRegistry should expose get().");

    logPass(testName);

  } catch (error) {
    logFail(testName, error);
    throw error;
  }
}


/* ==============================================================
 * TEST 2 — Repository Registration Integrity
 * ==============================================================
 */
function test_Repository_Registration() {
  const testName = "Repository Registration Integrity";
  logStart(testName);

  try {
    const studentRepo = GLOBAL_REPOSITORY_REGISTRY.get("Student");
    const attendanceRepo = GLOBAL_REPOSITORY_REGISTRY.get("Attendance");

    assert(studentRepo !== null, "StudentRepository should be registered.");
    assert(attendanceRepo !== null, "AttendanceRepository should be registered.");

    assert(typeof studentRepo.find === "function",
      "StudentRepository should implement find().");

    logPass(testName);

  } catch (error) {
    logFail(testName, error);
    throw error;
  }
}


/* ==============================================================
 * TEST 3 — Per-Request ORM Isolation
 * ==============================================================
 */
function test_Per_Request_ORM_Isolation() {
  const testName = "Per-Request ORM Instance Isolation";
  logStart(testName);

  try {
    const orm1 = bootstrapORM();
    const orm2 = bootstrapORM();

    assertNotEqual(orm1, orm2,
      "Each bootstrapORM() call must return a new ORM instance.");

    assert(typeof orm1.clear === "function",
      "ORM should expose clear().");

    logPass(testName);

  } catch (error) {
    logFail(testName, error);
    throw error;
  }
}


/* ==============================================================
 * TEST 4 — IdentityMap Isolation
 * ==============================================================
 */
function test_IdentityMap_Isolation() {
  const testName = "IdentityMap Isolation Across Requests";
  logStart(testName);

  try {
    const orm1 = bootstrapORM();
    const orm2 = bootstrapORM();

    logInfo("Fetching students via orm1");
    const results1 = orm1.fetch("Student", {});

    logInfo("Fetching students via orm2");
    const results2 = orm2.fetch("Student", {});

    if (results1.length > 0 && results2.length > 0) {
      const model1 = results1[0];
      const model2 = results2[0];

      assertNotEqual(model1, model2,
        "Models from different ORM instances must not share IdentityMap state.");
    } else {
      logInfo("No Student records found — skipping model comparison.");
    }

    orm1.clear();
    orm2.clear();

    logPass(testName);

  } catch (error) {
    logFail(testName, error);
    throw error;
  }
}


/* ==============================================================
 * TEST 5 — ORM Internal Wiring
 * ==============================================================
 */
function test_ORM_Internal_Wiring() {
  const testName = "ORM Internal Wiring (Lazy Resolver Exposure)";
  logStart(testName);

  try {
    const orm = bootstrapORM();

    assert(typeof orm.resolveRelation === "function",
      "ORM should expose resolveRelation().");

    orm.clear();

    logPass(testName);

  } catch (error) {
    logFail(testName, error);
    throw error;
  }
}


/* ==============================================================
 * MASTER TEST RUNNER
 * ==============================================================
 */
function run_Bootstrap_Tests() {
  Logger.log("============================================");
  Logger.log("🚀 BOOTSTRAP COMPOSITION ROOT TEST SUITE");
  Logger.log("============================================");

  try {
    test_Global_Structural_Wiring();
    test_Repository_Registration();
    test_Per_Request_ORM_Isolation();
    test_IdentityMap_Isolation();
    test_ORM_Internal_Wiring();

    Logger.log("============================================");
    Logger.log("🎉 ALL TESTS PASSED SUCCESSFULLY");
    Logger.log("============================================");

  } catch (error) {
    Logger.log("============================================");
    Logger.log("❌ TEST SUITE FAILED");
    Logger.log("============================================");
    throw error;
  }
}
