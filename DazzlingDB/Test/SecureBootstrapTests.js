/**
 * @file SecureBootstrapTests.js
 * Automated test suite to verify the security of the admin bootstrap process.
 */

function runSecureBootstrapTests() {
  console.log("🚀 Starting Secure Admin Panel Bootstrap Test Suite...");
  
  // Set up sandbox environment
  PropertiesService.getScriptProperties().setProperty('ENV', 'TESTING');
  DBContext.getInstance().bootstrapRepositories();
  
  const db = DBContext.getInstance();
  const results = {};
  const timings = {};

  try {
    // Ensure we start with a clean User table for testing setup (destructive for sandbox)
    db.setup.provision();
    _clearUserTable(db);
    PropertiesService.getScriptProperties().deleteProperty("SETUP_KEY");

    // ⏱️ Start Timing
    const startOverall = Date.now();

    // 1. Verify Status check generates and emails Setup Key
    const startS1 = Date.now();
    console.log("▶️ SCENARIO 1: Verify Status check generates Setup Key...");
    const isInitBefore = AuthBridge.isSystemInitialized();
    if (isInitBefore) {
      throw new Error("System should not be initialized before bootstrap.");
    }
    
    // Trigger the email generation
    AuthBridge.ensureSetupKeyEmailed();
    
    const generatedKey = PropertiesService.getScriptProperties().getProperty("SETUP_KEY");
    if (!generatedKey) {
      throw new Error("Setup key was not generated/stored in Script Properties.");
    }
    console.log(`   ✅ Success: Key generated: ${generatedKey.substring(0, 8)}...`);
    timings["Scenario 1: Generate Key"] = Date.now() - startS1;
    results.Scenario1 = "✅ PASSED";

    // 2. Verify invalid Setup Key is rejected
    const startS2 = Date.now();
    console.log("▶️ SCENARIO 2: Verify invalid Setup Key rejection...");
    const bootstrapAction2 = new AdminBootstrapAction();
    const mockContext2 = {
      params: {
        payload: {
          setupKey: "INVALID_KEY_12345",
          userData: {
            username: "test_sec_admin",
            email: "sec@dazzling.com",
            password: "SecurePassword123!"
          }
        }
      },
      user: null,
      db: db,
      actionType: ActionType.CREATE,
      mutationManifest: [],
      headers: {}
    };
    
    const res2 = bootstrapAction2.run(mockContext2);
    if (res2.success !== false) {
      throw new Error("Expected ForbiddenError, but authorization passed.");
    }
    if (!res2.error || res2.error.message.indexOf("Invalid Setup Key") === -1) {
      throw new Error(`Expected Invalid Setup Key error, got: ${res2.error ? res2.error.message : 'No error'}`);
    }
    console.log("   ✅ Success: Correctly rejected invalid setup key.");
    timings["Scenario 2: Reject Invalid Key"] = Date.now() - startS2;
    results.Scenario2 = "✅ PASSED";

    // 3. Verify valid Setup Key registers admin and deletes the property (one-time use)
    const startS3 = Date.now();
    console.log("▶️ SCENARIO 3: Verify successful bootstrap and setup key cleanup...");
    
    const bootstrapAction3 = new AdminBootstrapAction();
    const mockContext3 = {
      params: {
        payload: {
          setupKey: generatedKey,
          userData: {
            username: "test_sec_admin",
            email: "sec@dazzling.com",
            password: "SecurePassword123!"
          }
        }
      },
      user: null,
      db: db,
      actionType: ActionType.CREATE,
      mutationManifest: [],
      headers: {}
    };

    const res3 = bootstrapAction3.run(mockContext3);
    if (!res3.success) {
      throw new Error(`Bootstrap failed: ${res3.error ? res3.error.message : 'Unknown error'}`);
    }

    // Verify system is initialized now
    if (!AuthBridge.isSystemInitialized()) {
      throw new Error("System is not initialized after successful bootstrap.");
    }

    // Verify key was deleted
    const keyAfter = PropertiesService.getScriptProperties().getProperty("SETUP_KEY");
    if (keyAfter) {
      throw new Error("Setup key was not deleted after successful bootstrap.");
    }
    console.log("   ✅ Success: Admin registered and setup key cleaned up successfully.");
    timings["Scenario 3: Successful Bootstrap & Deletion"] = Date.now() - startS3;
    results.Scenario3 = "✅ PASSED";

    // 4. Verify password complexity constraints
    const startS4 = Date.now();
    console.log("▶️ SCENARIO 4: Verify password complexity constraints...");
    const weakPasswords = [
      "short",
      "nouppercase123!",
      "NOLOWERCASE123!",
      "NoDigitsHere!",
      "NoSpecialChars123"
    ];
    
    weakPasswords.forEach(pwd => {
      if (AuthCore.isStrongPassword(pwd)) {
        throw new Error(`Expected password '${pwd}' to be rejected as weak, but it passed.`);
      }
    });

    if (!AuthCore.isStrongPassword("SecurePass123!")) {
      throw new Error("Expected password 'SecurePass123!' to be accepted as strong, but it was rejected.");
    }
    console.log("   ✅ Success: All weak passwords rejected and strong password accepted.");
    timings["Scenario 4: Password Complexity Checks"] = Date.now() - startS4;
    results.Scenario4 = "✅ PASSED";

    // Timing Summary
    console.log("\n========================================================");
    console.log("⏱️  SECURE BOOTSTRAP PERFORMANCE TIMING SUMMARY  ⏱️");
    console.log("========================================================");
    let totalTime = 0;
    Object.keys(timings).forEach(step => {
      console.log(`- ${step.padEnd(50)}: ${timings[step]} ms`);
      totalTime += timings[step];
    });
    console.log("--------------------------------------------------------");
    console.log(`- Total Execution Time                             : ${totalTime} ms`);
    console.log("========================================================\n");

  } catch (e) {
    console.error("❌ Test Suite failed:", e.message, e.stack);
    results.TestSuiteStatus = "❌ FAILED: " + e.message;
  } finally {
    // Restore environment back to DEVELOPMENT
    PropertiesService.getScriptProperties().setProperty('ENV', 'DEVELOPMENT');
    DBContext.getInstance().bootstrapRepositories();
  }

  console.log("📊 Final Secure Admin Panel Test Results:", JSON.stringify(results, null, 2));
  return results;
}

/**
 * Clean up User table for testing bootstrap logic in isolated sandbox.
 * @private
 */
function _clearUserTable(db) {
  try {
    if (db.User.isTableExist()) {
      const users = db.User.all();
      users.forEach(u => {
        db.User.remove(u.user_id);
      });
    }
  } catch (e) {
    console.warn("User table cleanup failed:", e.message);
  }
}
