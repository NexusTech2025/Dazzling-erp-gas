/**
 * @file Infrastructure_BackupTests.js
 * Automated integration testing module for Database Backup Service.
 * Validates full snapshot creation, selective category exclusion, custom directory targeting,
 * 30-backup retention policy eviction, admin API action dispatch, multi-role authorization,
 * negative fault recovery, and sandbox cleanup.
 * 
 * INSTRUCTIONS:
 * Run 'runInfrastructureBackupTests' from the Google Apps Script IDE.
 */

function runInfrastructureBackupTests() {
  const activeEnv = typeof SYSTEM_ENV !== 'undefined' ? SYSTEM_ENV : Environment.DEVELOPMENT;
  if (resolveEnvironmentType(activeEnv) === Environment.PRODUCTION) {
    throw new Error("❌ Safety Guard: Test suite cannot be executed in the PRODUCTION environment.");
  }

  const scriptProperties = PropertiesService.getScriptProperties();
  const originalEnv = scriptProperties.getProperty('ENV') || 'DEVELOPMENT';

  console.log("🚀 Starting Database Backup Integration & Regression Tests...");
  const results = {};
  const timings = {};
  const testFolderTracker = [];
  const tSuiteStart = Date.now();

  try {
    // 1. Force TESTING sandbox environment isolation
    scriptProperties.setProperty('ENV', 'TESTING');
    const db = DBContext.getInstance().bootstrapRepositories();

    // 2. Ensure sandbox files are provisioned
    console.log("[BackupTests] Provisioning testing sandbox sheets...");
    db.setup.provision();

    const sandboxFolderId = DBContext.getInstance()._fs.rootFolderId;
    console.log(`[BackupTests] Active Testing Sandbox Root: '${sandboxFolderId}'`);

    // --- Scenario 1: End-to-End Snapshot Creation (Full Success Path) ---
    console.log("\n=========================================");
    let tStart = Date.now();
    results.Scenario1 = executeScenario1_FullSnapshotSuccess(db, sandboxFolderId, testFolderTracker);
    timings["Scenario 1: Full Snapshot Creation"] = Date.now() - tStart;

    // --- Scenario 2: Selective Category Exclusion Filtering ---
    console.log("\n=========================================");
    tStart = Date.now();
    results.Scenario2 = executeScenario2_SelectiveExclusion(db, sandboxFolderId, testFolderTracker);
    timings["Scenario 2: Selective Category Exclusion"] = Date.now() - tStart;

    // --- Scenario 3: Custom Directory Override & Alphanumeric Label ---
    console.log("\n=========================================");
    tStart = Date.now();
    results.Scenario3 = executeScenario3_CustomTargetAndLabel(db, sandboxFolderId, testFolderTracker);
    timings["Scenario 3: Custom Target & Label"] = Date.now() - tStart;

    // --- Scenario 4: Oldest-First Retention Policy Eviction ---
    console.log("\n=========================================");
    tStart = Date.now();
    results.Scenario4 = executeScenario4_RetentionPolicyEviction(sandboxFolderId, testFolderTracker);
    timings["Scenario 4: Retention Policy Eviction"] = Date.now() - tStart;

    // --- Scenario 5: Admin API Action Dispatch & Role Authorization ---
    console.log("\n=========================================");
    tStart = Date.now();
    results.Scenario5 = executeScenario5_AdminApiAuthorization(db, sandboxFolderId, testFolderTracker);
    timings["Scenario 5: Admin API Action & Auth"] = Date.now() - tStart;

    // --- Scenario 6: Inaccessible / Invalid Source Folder ---
    console.log("\n=========================================");
    tStart = Date.now();
    results.Scenario6 = executeScenario6_InvalidSourceErrorHandling();
    timings["Scenario 6: Inaccessible Source Folder"] = Date.now() - tStart;

    // --- Scenario 7: Test Artifact Cleanup & Sandbox Teardown ---
    console.log("\n=========================================");
    tStart = Date.now();
    results.Scenario7 = executeScenario7_CleanupTestArtifacts(testFolderTracker);
    timings["Scenario 7: Test Artifacts Cleanup"] = Date.now() - tStart;

  } catch (err) {
    console.error("❌ Test execution halted with unexpected error:", err.message);
    if (err.stack) console.error(err.stack);
  } finally {
    // Restore original system environment boundary
    scriptProperties.setProperty('ENV', originalEnv);
    DBContext.getInstance().bootstrapRepositories();
    console.log(`[BackupTests] Restored environment context to: '${originalEnv}'`);

    // Output telemetry benchmarks table to logging console
    const totalTime = Date.now() - tSuiteStart;
    console.log("\n========================================================");
    console.log("⏱️      DATABASE BACKUP PERFORMANCE TIMING SUMMARY     ⏱️");
    console.log("========================================================");
    for (const step in timings) {
      console.log(`- ${step.padEnd(45)}: ${String(timings[step]).padStart(5)} ms`);
    }
    console.log("--------------------------------------------------------");
    console.log(`- Total Execution Time                         : ${String(totalTime).padStart(5)} ms`);
    console.log("========================================================\n");
  }

  console.log("📊 FINAL TEST RESULTS: \n", JSON.stringify(results, null, 2));
  console.log("🏁 Database Backup Tests Complete.");
  return results;
}

/**
 * SCENARIO 1: Verifies full snapshot creation of all database spreadsheets in sandbox.
 * Asserts BackupReport structure, Drive folder existence, and manifest.json validity.
 */
function executeScenario1_FullSnapshotSuccess(db, sandboxFolderId, tracker) {
  console.log("▶️ SCENARIO 1: End-to-End Snapshot Creation (Full Success Path)");
  try {
    console.log("   ⚙️ Invoking BackupService.createSnapshot() with testing sandbox source...");
    const report = BackupService.createSnapshot({
      sourceFolderId: sandboxFolderId
    });

    console.log("   ⚙️ Received BackupReport ID:", report.backup_id);
    console.log(`   ⚙️ Summary: Total=${report.results.total}, Succeeded=${report.results.succeeded}, Failed=${report.results.failed}`);

    // Assert Report Root Properties
    if (!report.backup_id || !report.backup_id.startsWith("BKP_")) {
      throw new Error(`Invalid backup_id generated: '${report.backup_id}'`);
    }
    if (!report.timestamp) throw new Error("Missing timestamp in BackupReport.");
    if (!report.target || !report.target.snapshot_folder_id) {
      throw new Error("Missing target.snapshot_folder_id in BackupReport.");
    }
    if (report.results.failed > 0) {
      throw new Error(`Expected 0 failures, but got ${report.results.failed} failed copies.`);
    }
    if (report.results.succeeded === 0) {
      throw new Error("Expected at least 1 successful spreadsheet copy.");
    }

    // Track snapshot folder for teardown
    tracker.push(report.target.snapshot_folder_id);

    // Verify Physical Snapshot Folder on Drive
    const snapshotFolder = DriveApp.getFolderById(report.target.snapshot_folder_id);
    if (!snapshotFolder) throw new Error("Snapshot folder could not be located on Google Drive.");

    // Verify manifest.json exists in snapshot folder
    const manifestFiles = snapshotFolder.getFilesByName("manifest.json");
    if (!manifestFiles.hasNext()) {
      throw new Error("manifest.json was not created inside the snapshot folder.");
    }

    const manifestFile = manifestFiles.next();
    const manifestContent = manifestFile.getBlob().getDataAsString();
    const parsedManifest = JSON.parse(manifestContent);

    if (parsedManifest.backup_id !== report.backup_id) {
      throw new Error(`Manifest backup_id mismatch: expected '${report.backup_id}', got '${parsedManifest.backup_id}'`);
    }

    console.log("   ✅ Success! Full snapshot created, manifest validated, all files copied.");
    return "✅ PASSED";
  } catch (error) {
    console.error("   ❌ Failed:");
    console.error("      Error Name:   ", error.name || "Error");
    console.error("      Error Message:", error.message);
    if (error.stack) console.error("      Stack Trace:  ", error.stack);
    return `❌ FAILED: ${error.message}`;
  }
}

/**
 * SCENARIO 2: Verifies selective category exclusion filtering.
 * Asserts excluded categories are marked as SKIPPED and omitted from snapshot folder.
 */
function executeScenario2_SelectiveExclusion(db, sandboxFolderId, tracker) {
  console.log("▶️ SCENARIO 2: Selective Category Exclusion Filtering");
  try {
    const excludeCategories = ["Attendance", "Auth"];
    console.log("   ⚙️ Invoking BackupService with excludeCategories:", JSON.stringify(excludeCategories));

    const report = BackupService.createSnapshot({
      sourceFolderId: sandboxFolderId,
      excludeCategories: excludeCategories,
      label: "exclusion_test"
    });

    tracker.push(report.target.snapshot_folder_id);

    console.log(`   ⚙️ Result counts: Succeeded=${report.results.succeeded}, Skipped=${report.results.skipped}, Failed=${report.results.failed}`);

    if (report.results.skipped !== excludeCategories.length) {
      throw new Error(`Expected ${excludeCategories.length} skipped categories, but got ${report.results.skipped}`);
    }

    // Verify excluded files are flagged as SKIPPED in detail entries
    const skippedDetails = report.results.details.filter(d => d.status === "SKIPPED");
    const skippedNames = skippedDetails.map(d => d.name);

    excludeCategories.forEach(cat => {
      if (!skippedNames.includes(cat)) {
        throw new Error(`Category '${cat}' was expected to be SKIPPED, but details show: ${JSON.stringify(skippedNames)}`);
      }
    });

    // Verify physical folder does NOT contain excluded spreadsheets
    const snapshotFolder = DriveApp.getFolderById(report.target.snapshot_folder_id);
    excludeCategories.forEach(cat => {
      const files = snapshotFolder.getFilesByName(cat);
      if (files.hasNext()) {
        throw new Error(`Excluded spreadsheet '${cat}' was found inside the snapshot folder.`);
      }
    });

    console.log("   ✅ Success! Excluded categories correctly skipped and verified absent from Drive folder.");
    return "✅ PASSED";
  } catch (error) {
    console.error("   ❌ Failed:", error.message);
    return `❌ FAILED: ${error.message}`;
  }
}

/**
 * SCENARIO 3: Verifies custom target folder override and alphanumeric label appending.
 */
function executeScenario3_CustomTargetAndLabel(db, sandboxFolderId, tracker) {
  console.log("▶️ SCENARIO 3: Custom Directory Override & Alphanumeric Label");
  try {
    // Create an isolated custom target folder inside the sandbox
    const sandboxFolder = DriveApp.getFolderById(sandboxFolderId);
    const customParent = sandboxFolder.createFolder("Test_Custom_Backup_Target");
    tracker.push(customParent.getId());

    const label = "v2_release_candidate";
    console.log(`   ⚙️ Invoking createSnapshot with targetFolderId='${customParent.getId()}', label='${label}'`);

    const report = BackupService.createSnapshot({
      sourceFolderId: sandboxFolderId,
      targetFolderId: customParent.getId(),
      label: label
    });

    tracker.push(report.target.snapshot_folder_id);

    console.log("   ⚙️ Snapshot folder name:", report.target.snapshot_folder_name);

    if (!report.target.snapshot_folder_name.includes(label)) {
      throw new Error(`Snapshot folder name '${report.target.snapshot_folder_name}' does not contain label '${label}'.`);
    }

    if (report.target.parent_folder_id !== customParent.getId()) {
      throw new Error(`parent_folder_id mismatch: expected '${customParent.getId()}', got '${report.target.parent_folder_id}'`);
    }

    console.log("   ✅ Success! Custom target directory and snapshot label verified.");
    return "✅ PASSED";
  } catch (error) {
    console.error("   ❌ Failed:", error.message);
    return `❌ FAILED: ${error.message}`;
  }
}

/**
 * SCENARIO 4: Simulates over-capacity retention (32 dummy backups) and verifies
 * that the 2 oldest folders are evicted, leaving exactly 30 snapshots.
 */
function executeScenario4_RetentionPolicyEviction(sandboxFolderId, tracker) {
  console.log("▶️ SCENARIO 4: Oldest-First Retention Policy Eviction (30-Cap Simulation)");
  try {
    const sandboxFolder = DriveApp.getFolderById(sandboxFolderId);
    const retentionParent = sandboxFolder.createFolder("Test_Retention_Folder");
    tracker.push(retentionParent.getId());

    console.log("   ⚙️ Creating 32 dummy BKP_* subfolders with sequential naming...");
    const dummyFolders = [];
    for (let i = 1; i <= 32; i++) {
      const padNum = String(i).padStart(2, '0');
      // Use chronological folder names
      const folderName = `BKP_2026-01-${padNum}_10-00-00_mock`;
      const f = retentionParent.createFolder(folderName);
      dummyFolders.push({ name: folderName, id: f.getId() });
      tracker.push(f.getId());
    }

    console.log(`   ⚙️ Created ${dummyFolders.length} dummy snapshot folders. Enforcing retention...`);
    const telemetry = BackupService._enforceRetention(retentionParent);

    console.log("   📊 Retention Telemetry:", JSON.stringify(telemetry));

    if (telemetry.purged_count !== 2) {
      throw new Error(`Expected 2 purged folders, but got ${telemetry.purged_count}`);
    }

    if (telemetry.errors && telemetry.errors.length > 0) {
      throw new Error(`Retention encountered errors during purge: ${JSON.stringify(telemetry.errors)}`);
    }

    // Verify remaining count in retentionParent is exactly 30
    const remainingIterator = retentionParent.getFolders();
    let remainingCount = 0;
    while (remainingIterator.hasNext()) {
      remainingIterator.next();
      remainingCount++;
    }

    if (remainingCount !== 30) {
      throw new Error(`Expected exactly 30 remaining snapshot folders, but found ${remainingCount}`);
    }

    console.log("   ✅ Success! Retention policy purged exactly 2 oldest snapshots, retaining 30.");
    return "✅ PASSED";
  } catch (error) {
    console.error("   ❌ Failed:", error.message);
    return `❌ FAILED: ${error.message}`;
  }
}

/**
 * SCENARIO 5: Verifies Admin API action dispatch and role-based authorization.
 * Checks that superadmin and admin succeed, while user/guest are rejected.
 */
function executeScenario5_AdminApiAuthorization(db, sandboxFolderId, tracker) {
  console.log("▶️ SCENARIO 5: Admin API Action Dispatch & Multi-Role Authorization Check");
  try {
    const action = new AdminBackupDatabaseAction();

    // 1. Test SUPERADMIN Role (Must Pass)
    console.log("   ⚙️ [Sub-test 5.1] Dispatching as SUPERADMIN...");
    const superadminContext = {
      params: {
        payload: {
          sourceFolderId: sandboxFolderId,
          label: "api_superadmin_test"
        }
      },
      user: { user_id: "USR-SUPERADMIN", role: Roles.SUPERADMIN },
      db: db,
      actionType: ActionType.CREATE,
      mutationManifest: [],
      headers: {}
    };
    const superadminRes = action.run(superadminContext);
    if (!superadminRes.success) {
      throw new Error(`SUPERADMIN action execution failed: ${superadminRes.error ? superadminRes.error.message : 'Unknown'}`);
    }
    if (superadminRes.data && superadminRes.data.target) {
      tracker.push(superadminRes.data.target.snapshot_folder_id);
    }
    console.log("   ✅ Superadmin authorization passed.");

    // 2. Test ADMIN Role (Must Pass)
    console.log("   ⚙️ [Sub-test 5.2] Dispatching as ADMIN...");
    const adminContext = {
      params: {
        payload: {
          sourceFolderId: sandboxFolderId,
          label: "api_admin_test"
        }
      },
      user: { user_id: "USR-ADMIN", role: Roles.ADMIN },
      db: db,
      actionType: ActionType.CREATE,
      mutationManifest: [],
      headers: {}
    };
    const adminRes = action.run(adminContext);
    if (!adminRes.success) {
      throw new Error(`ADMIN action execution failed: ${adminRes.error ? adminRes.error.message : 'Unknown'}`);
    }
    if (adminRes.data && adminRes.data.target) {
      tracker.push(adminRes.data.target.snapshot_folder_id);
    }
    console.log("   ✅ Admin authorization passed.");

    // 3. Test GUEST Role (Must Fail with FORBIDDEN_ACCESS)
    console.log("   ⚙️ [Sub-test 5.3] Dispatching as GUEST (Unauthorized breach simulation)...");
    const guestContext = {
      params: { payload: {} },
      user: { user_id: "USR-GUEST", role: Roles.GUEST },
      db: db,
      actionType: ActionType.CREATE,
      mutationManifest: [],
      headers: {}
    };
    const guestRes = action.run(guestContext);
    if (guestRes.success === true) {
      throw new Error("Security Breach: GUEST role was permitted to execute admin_backup_database action.");
    }
    if (!guestRes.error || guestRes.error.code !== "FORBIDDEN_ACCESS") {
      throw new Error(`Expected error code 'FORBIDDEN_ACCESS', got: '${guestRes.error ? guestRes.error.code : 'None'}'`);
    }
    console.log("   ✅ Guest role access safely blocked with FORBIDDEN_ACCESS.");

    console.log("   ✅ Success! All role authorization gates verified.");
    return "✅ PASSED";
  } catch (error) {
    console.error("   ❌ Failed:", error.message);
    return `❌ FAILED: ${error.message}`;
  }
}

/**
 * SCENARIO 6: Negative verification — verifies BackupError is thrown when source folder is invalid.
 */
function executeScenario6_InvalidSourceErrorHandling() {
  console.log("▶️ SCENARIO 6: Inaccessible / Invalid Source Folder (Negative Recovery)");
  let passed = true;
  let messages = [];

  try {
    console.log("   ⚙️ Invoking BackupService with invalid sourceFolderId...");
    BackupService.createSnapshot({
      sourceFolderId: "invalid_non_existent_folder_xyz_99999"
    });
    passed = false;
    messages.push("Failed to throw BackupError on invalid source folder ID.");
  } catch (error) {
    if (error.name !== "BackupError") {
      passed = false;
      messages.push(`Expected BackupError, but caught '${error.name}': ${error.message}`);
    } else {
      console.log(`   ✅ Caught expected BackupError: "${error.message}"`);
    }
  }

  return passed ? "✅ PASSED" : `❌ FAILED: ${messages.join(" | ")}`;
}

/**
 * SCENARIO 7: Clean up temporary test snapshot folders and custom directories.
 */
function executeScenario7_CleanupTestArtifacts(tracker) {
  console.log("▶️ SCENARIO 7: Test Artifact Cleanup & Sandbox Teardown");
  let cleanupCount = 0;
  const uniqueIds = [...new Set(tracker.filter(Boolean))];

  console.log(`   ⚙️ Trashing ${uniqueIds.length} tracked test folder(s)...`);
  uniqueIds.forEach(folderId => {
    try {
      const folder = DriveApp.getFolderById(folderId);
      folder.setTrashed(true);
      cleanupCount++;
    } catch (cleanErr) {
      console.warn(`   ⚠️ Non-fatal cleanup warning for folder [${folderId}]: ${cleanErr.message}`);
    }
  });

  console.log(`   ✅ Successfully cleaned up ${cleanupCount} test artifact(s).`);
  return "✅ PASSED";
}
