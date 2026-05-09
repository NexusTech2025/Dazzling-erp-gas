/**
 * @file FirstRunTestSuite.js
 * Automated testing module for initialization and login flows.
 * Refactored for Schema-Driven Architecture (SheetDB v1.0).
 * 
 * INSTRUCTIONS:
 * 1. Set ENABLE_DESTRUCTIVE_TESTS to true (ONLY on a Dev Database).
 * 2. Run 'runAllFirstRunTests' from the script editor.
 */

const TEST_CONFIG = {
  // ⚠️ DANGER: Set to true ONLY on a development database!
  ENABLE_DESTRUCTIVE_TESTS: false, 
  TEST_USER: "test_admin",
  TEST_PASS: "Admin@123!",
  SETUP_KEY: "DAZZLING_2026"
};

function runAllFirstRunTests() {
  console.log("🚀 Starting Bulletproof First-Run Test Suite...");
  
  if (!TEST_CONFIG.ENABLE_DESTRUCTIVE_TESTS) {
    console.warn("⚠️ Destructive tests disabled. Reset 'ENABLE_DESTRUCTIVE_TESTS: true' to run Scenarios.");
    return;
  }

  const db = DBContext.getInstance();
  const results = {};

  // --- PRE-TEST CLEANUP ---
  _teardown(db);

  console.log("\n=========================================");
  results.Scenario1 = executeScenario1_MissingTable(db);
  
  console.log("\n=========================================");
  results.Scenario2 = executeScenario2_MissingFile(db);
  
  console.log("\n=========================================");
  results.Scenario3 = executeScenario3_ProvisionAndRegister(db);
  
  console.log("\n=========================================");
  results.Scenario4 = executeScenario4_AuthFlow(db);
  console.log("=========================================\n");

  console.log("📊 FINAL TEST RESULTS: ", JSON.stringify(results, null, 2));
  
  // Restore infrastructure after tests
  db.setup.provision();
  
  return results;
}

/**
 * Ensures a clean state by deleting the test admin if it exists.
 * @private
 */
function _teardown(db) {
  try {
    console.log("   🧹 Performing pre-test cleanup...");
    if (db.User.isTableExist()) {
      const user = db.User.findOne({ username: TEST_CONFIG.TEST_USER });
      if (user) {
        db.User.remove(user.user_id);
        console.log(`   ✅ Deleted existing test user: ${TEST_CONFIG.TEST_USER}`);
      }
    }
  } catch (e) {
    console.warn("   ⚠️ Cleanup warning:", e.message);
  }
}

/**
 * SCENARIO 1: Test behavior when the sheet (table) is missing.
 * Uses renaming to avoid "Cannot delete last sheet" crash.
 */
function executeScenario1_MissingTable(db) {
  console.log("▶️ SCENARIO 1: Testing Missing Table (Sheet)...");
  try {
    const category = db._registry.getCategoryForTable("User");
    const fileMeta = db._fs.findByName(category);
    
    if (fileMeta) {
      const ss = db._fs.open(fileMeta.id);
      const sheet = ss.getSheetByName("User");
      if (sheet) {
        // Rename instead of delete to be safe
        sheet.setName("User_TEST_HIDDEN");
        console.log(`   ⚙️ Renamed 'User' sheet to 'User_TEST_HIDDEN'`);
      }
    }

    const isInit = isSystemInitialized();
    console.log(`   ⚙️ isSystemInitialized() = ${isInit} (Expected: false)`);
    
    return isInit === false ? "✅ PASSED" : "❌ FAILED: System claims initialized but User table is renamed.";
  } catch (e) {
    return `❌ FAILED: ${e.message}`;
  }
}

/**
 * SCENARIO 2: Test behavior when the physical file is missing.
 */
function executeScenario2_MissingFile(db) {
  console.log("▶️ SCENARIO 2: Testing Missing File (Spreadsheet)...");
  try {
    const category = db._registry.getCategoryForTable("User");
    const fileMeta = db._fs.findByName(category);
    
    if (fileMeta) {
      const file = DriveApp.getFileById(fileMeta.id);
      file.setName(`${category}_TEST_HIDDEN`);
      console.log(`   ⚙️ Renamed physical file to '${category}_TEST_HIDDEN'`);
    }

    const isInit = isSystemInitialized();
    console.log(`   ⚙️ isSystemInitialized() = ${isInit} (Expected: false)`);

    // Restore file name for next scenario
    if (fileMeta) {
      DriveApp.getFileById(fileMeta.id).setName(category);
    }
    
    return isInit === false ? "✅ PASSED" : "❌ FAILED: System claims initialized but Auth file is renamed.";
  } catch (e) {
    return `❌ FAILED: ${e.message}`;
  }
}

/**
 * SCENARIO 3: Test Provisioning and proper Admin Registration.
 */
function executeScenario3_ProvisionAndRegister(db) {
  console.log("▶️ SCENARIO 3: Provisioning & Registration...");
  try {
    // 1. Re-create physical tables (Simulates Wizard Submit)
    console.log("   ⚙️ Running physical provisioning...");
    db.setup.provision();

    // 2. Cleanup potential rename from Scenario 1 if provision didn't handle it
    const category = db._registry.getCategoryForTable("User");
    const fileMeta = db._fs.findByName(category);
    const ss = db._fs.open(fileMeta.id);
    const oldSheet = ss.getSheetByName("User_TEST_HIDDEN");
    if (oldSheet) ss.deleteSheet(oldSheet);

    // 3. Register Admin via production AuthBridge
    console.log("   ⚙️ Registering Superadmin...");
    const adminUser = AuthBridge.registerUser({
      username: TEST_CONFIG.TEST_USER,
      password: TEST_CONFIG.TEST_PASS,
      role: "admin"
    });

    const isInit = isSystemInitialized();
    return isInit ? "✅ PASSED" : "❌ FAILED: System uninitialized after registration.";
  } catch (e) {
    return `❌ FAILED: ${e.message}`;
  }
}

/**
 * SCENARIO 4: Test full authentication flow.
 */
function executeScenario4_AuthFlow(db) {
  console.log("▶️ SCENARIO 4: Authentication Flow...");
  try {
    console.log(`   ⚙️ Attempting login for: ${TEST_CONFIG.TEST_USER}`);
    const response = AuthBridge.login(TEST_CONFIG.TEST_USER, TEST_CONFIG.TEST_PASS);
    
    if (response && response.token) {
      console.log(`   🔑 Login Success! Session Token: ${response.token.substring(0, 10)}...`);
      return "✅ PASSED";
    }
    throw new Error("Login failed: Response missing token.");
  } catch (e) {
    return `❌ FAILED: ${e.message}`;
  }
}
