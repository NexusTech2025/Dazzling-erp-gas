/**
 * @file UserSecureCrudTests.js
 * Automated integration test suite to verify superadmin user management actions:
 * user_query, user_update, and user_delete.
 */

function runUserSecureCrudTests() {
  console.log("🚀 Starting User Secure CRUD Test Suite...");

  // Set up sandbox environment
  PropertiesService.getScriptProperties().setProperty('ENV', 'TESTING');
  DBContext.getInstance().bootstrapRepositories();

  const db = DBContext.getInstance();
  const results = {};
  const timings = {};

  // Suffix for collision prevention
  const suffix = Math.random().toString(36).substring(7).toUpperCase();
  const createdUserIds = [];

  try {
    // 0. Ensure schema is provisioned in sandbox
    db.setup.provision();

    // Setup Mock Users
    const superadminUser = db.User.insert({
      username: "test_super_" + suffix.toLowerCase(),
      role: "superadmin",
      status: "active",
      password_hash: "MOCK_HASH_SUPER",
      password_salt: "MOCK_SALT_SUPER"
    });
    createdUserIds.push(superadminUser.user_id);

    const adminUser = db.User.insert({
      username: "test_admin_" + suffix.toLowerCase(),
      role: "admin",
      status: "active",
      password_hash: "MOCK_HASH_ADMIN",
      password_salt: "MOCK_SALT_ADMIN"
    });
    createdUserIds.push(adminUser.user_id);

    const normalUser = db.User.insert({
      username: "test_normal_" + suffix.toLowerCase(),
      role: "guest",
      status: "active",
      password_hash: "MOCK_HASH_NORMAL",
      password_salt: "MOCK_SALT_NORMAL"
    });
    createdUserIds.push(normalUser.user_id);

    // 1. Scenario 1: Authorization Guards
    const startS1 = Date.now();
    console.log("▶️ SCENARIO 1: Verify role-based authorization guards block non-superadmins...");

    // Normal admin trying to query
    const queryAction = new UserQueryAction();
    const resS1A = queryAction.run({
      params: { payload: {} },
      user: { role: "admin", user_id: adminUser.user_id },
      db: db,
      headers: {}
    });
    if (resS1A.success !== false || resS1A.error.code !== "FORBIDDEN_ACCESS") {
      throw new Error("Expected Forbidden Access error for non-superadmin user query.");
    }

    // Normal user trying to update
    const updateAction = new UserUpdateAction();
    const resS1B = updateAction.run({
      params: { payload: { user_id: normalUser.user_id, data: { status: "locked" } } },
      user: { role: "guest", user_id: normalUser.user_id },
      db: db,
      headers: {}
    });
    if (resS1B.success !== false || resS1B.error.code !== "FORBIDDEN_ACCESS") {
      throw new Error("Expected Forbidden Access error for non-superadmin user update.");
    }

    // Admin trying to delete
    const deleteAction = new UserDeleteAction();
    const resS1C = deleteAction.run({
      params: { payload: { user_id: normalUser.user_id } },
      user: { role: "admin", user_id: adminUser.user_id },
      db: db,
      headers: {}
    });
    if (resS1C.success !== false || resS1C.error.code !== "FORBIDDEN_ACCESS") {
      throw new Error("Expected Forbidden Access error for non-superadmin user deletion.");
    }

    console.log("   ✅ Success: Correctly restricted access to superadmin only.");
    timings["Scenario 1: Authorization Guards"] = Date.now() - startS1;
    results.Scenario1 = "✅ PASSED";

    // 2. Scenario 2: user_query execution & sanitization
    const startS2 = Date.now();
    console.log("▶️ SCENARIO 2: Verify user query and credentials sanitization...");
    const resS2 = queryAction.run({
      params: {
        payload: {
          where: { username: "test_normal_" + suffix.toLowerCase() }
        }
      },
      user: { role: "superadmin", user_id: superadminUser.user_id },
      db: db,
      headers: {}
    });

    if (!resS2.success) {
      throw new Error(`Query failed: ${resS2.error ? resS2.error.message : 'Unknown error'}`);
    }
    const queryResult = resS2.data;
    if (!queryResult || !queryResult.data || queryResult.data.length !== 1) {
      throw new Error("Query did not return the expected normal user.");
    }
    const queriedUsers = queryResult.data;
    if (queriedUsers[0].password_hash !== undefined || queriedUsers[0].password_salt !== undefined) {
      throw new Error("Credentials Leakage: Query response exposed password hashes/salts!");
    }

    console.log("   ✅ Success: Query returned records and sanitized credentials.");
    timings["Scenario 2: User Query Sanitization"] = Date.now() - startS2;
    results.Scenario2 = "✅ PASSED";

    // 3. Scenario 3: user_update hashing & sole superadmin protection
    const startS3 = Date.now();
    console.log("▶️ SCENARIO 3: Verify user update, hashing, and demotion/lock guards...");

    // Test password hashing
    const resS3A = updateAction.run({
      params: {
        payload: {
          user_id: normalUser.user_id,
          data: { password: "NewSecurePassword123!" }
        }
      },
      user: { role: "superadmin", user_id: superadminUser.user_id },
      db: db,
      headers: {}
    });

    if (!resS3A.success) {
      throw new Error(`Password update failed: ${resS3A.error ? resS3A.error.message : 'Unknown'}`);
    }

    const updatedUserObj = db.User.findById(normalUser.user_id);
    if (!AuthCore.verifyPassword("NewSecurePassword123!", updatedUserObj.password_hash, updatedUserObj.password_salt)) {
      throw new Error("AuthCore verification failed for updated password hash/salt.");
    }

    // Test sole superadmin protection (demotion)
    const resS3B = updateAction.run({
      params: {
        payload: {
          user_id: superadminUser.user_id,
          data: { role: "admin" }
        }
      },
      user: { role: "superadmin", user_id: superadminUser.user_id },
      db: db,
      headers: {}
    });
    if (resS3B.success !== false || resS3B.error.code !== "ACTION_VALIDATION_FAILURE") {
      throw new Error("Expected block when trying to demote the sole active superadmin.");
    }

    // Test sole superadmin protection (status lock)
    const resS3C = updateAction.run({
      params: {
        payload: {
          user_id: superadminUser.user_id,
          data: { status: "locked" }
        }
      },
      user: { role: "superadmin", user_id: superadminUser.user_id },
      db: db,
      headers: {}
    });
    if (resS3C.success !== false || resS3C.error.code !== "ACTION_VALIDATION_FAILURE") {
      throw new Error("Expected block when trying to disable/lock the sole active superadmin.");
    }

    console.log("   ✅ Success: Updates validated, hashing working, sole superadmin protected.");
    timings["Scenario 3: User Update & Guards"] = Date.now() - startS3;
    results.Scenario3 = "✅ PASSED";

    // 4. Scenario 4: user_delete, self-deletion, and session cascade
    const startS4 = Date.now();
    console.log("▶️ SCENARIO 4: Verify user delete, self-deletion block, and session cascade...");

    // Test self-deletion block
    const resS4A = deleteAction.run({
      params: { payload: { user_id: superadminUser.user_id } },
      user: { role: "superadmin", user_id: superadminUser.user_id },
      db: db,
      headers: {}
    });
    if (resS4A.success !== false) {
      throw new Error("Self-deletion of active superadmin should be blocked.");
    }

    // Test deleting other superadmin block
    const superadmin2 = db.User.insert({
      username: "test_super2_" + suffix.toLowerCase(),
      role: "superadmin",
      status: "active",
      password_hash: "MOCK",
      password_salt: "MOCK"
    });
    createdUserIds.push(superadmin2.user_id);

    const resS4B = deleteAction.run({
      params: { payload: { user_id: superadmin2.user_id } },
      user: { role: "superadmin", user_id: superadminUser.user_id },
      db: db,
      headers: {}
    });
    if (resS4B.success !== false) {
      throw new Error("Deleting other superadmin users should be blocked.");
    }

    // Setup session to test cascade delete
    const sessionToken = "T-SESS-" + suffix;
    db.Session.insert({
      token: sessionToken,
      user_id: normalUser.user_id,
      expires_at: new Date(Date.now() + 3600000),
      client_info: "Test Session"
    });

    const resS4C = deleteAction.run({
      params: { payload: { user_id: normalUser.user_id } },
      user: { role: "superadmin", user_id: superadminUser.user_id },
      db: db,
      headers: {}
    });

    if (!resS4C.success) {
      throw new Error(`Deletion failed: ${resS4C.error ? resS4C.error.message : 'Unknown'}`);
    }

    // Verify user is removed
    if (db.User.findById(normalUser.user_id)) {
      throw new Error("Normal user record still exists after deletion.");
    }

    // Verify session is cascaded
    if (db.Session.findOne({ token: sessionToken })) {
      throw new Error("Session record was not cascaded (removed) upon user deletion.");
    }

    console.log("   ✅ Success: Deletion guards and session cascades verified.");
    timings["Scenario 4: User Deletion & Session Cascade"] = Date.now() - startS4;
    results.Scenario4 = "✅ PASSED";

  } catch (e) {
    console.error("❌ Test Suite failed:", e.message, e.stack);
    results.TestSuiteStatus = "❌ FAILED: " + e.message;
  } finally {
    // Teardown LIFO
    console.log("▶️ TEARDOWN: Cleaning up test user records...");
    for (let i = createdUserIds.length - 1; i >= 0; i--) {
      try {
        db.User.remove(createdUserIds[i]);
      } catch (_) { }
    }

    // Restore environment back to DEVELOPMENT
    PropertiesService.getScriptProperties().setProperty('ENV', 'DEVELOPMENT');
    DBContext.getInstance().bootstrapRepositories();
  }

  // Print Timing Summary
  console.log("\n========================================================");
  console.log("⏱  USER SECURE CRUD PERFORMANCE TIMING SUMMARY  ⏱");
  console.log("========================================================");
  let totalTime = 0;
  Object.keys(timings).forEach(step => {
    console.log(`- ${step.padEnd(50)}: ${timings[step]} ms`);
    totalTime += timings[step];
  });
  console.log("--------------------------------------------------------");
  console.log(`- Total Execution Time                             : ${totalTime} ms`);
  console.log("========================================================\n");

  console.log("📊 Final User Secure CRUD Test Results:", JSON.stringify(results, null, 2));
  return results;
}
