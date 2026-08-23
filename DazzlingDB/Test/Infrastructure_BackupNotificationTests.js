/**
 * @file Infrastructure_BackupNotificationTests.js
 * Automated integration test module verifying backup email notification dispatch,
 * manifest.json file attachment integrity, custom recipient resolution, and quota tracking.
 * 
 * INSTRUCTIONS:
 * Run 'runInfrastructureBackupNotificationTests' from the Google Apps Script IDE.
 */

function runInfrastructureBackupNotificationTests() {
  const activeEnv = typeof SYSTEM_ENV !== 'undefined' ? SYSTEM_ENV : Environment.DEVELOPMENT;
  if (resolveEnvironmentType(activeEnv) === Environment.PRODUCTION) {
    throw new Error("❌ Safety Guard: Test suite cannot be executed in the PRODUCTION environment.");
  }

  const scriptProperties = PropertiesService.getScriptProperties();
  const originalEnv = scriptProperties.getProperty('ENV') || 'DEVELOPMENT';

  console.log("🚀 Starting Backup Notification & Attachment Verification Tests...");
  const results = {};
  const timings = {};
  const testFolderTracker = [];
  const tSuiteStart = Date.now();

  try {
    // 1. Force TESTING sandbox environment isolation
    scriptProperties.setProperty('ENV', 'TESTING');
    const db = DBContext.getInstance().bootstrapRepositories();

    // 2. Ensure sandbox files are provisioned
    console.log("[NotificationTests] Provisioning testing sandbox sheets...");
    db.setup.provision();

    const sandboxFolderId = DBContext.getInstance()._fs.rootFolderId;
    console.log(`[NotificationTests] Active Testing Sandbox Root: '${sandboxFolderId}'`);

    // --- Scenario 1: Snapshot Creation with Attached manifest.json ---
    console.log("\n=========================================");
    let tStart = Date.now();
    results.Scenario1 = executeScenario1_EmailDispatchWithManifestAttachment(db, sandboxFolderId, testFolderTracker);
    timings["Scenario 1: Email Dispatch with Manifest Attachment"] = Date.now() - tStart;

    // --- Scenario 2: Admin API Action with Explicit Recipient ---
    console.log("\n=========================================");
    tStart = Date.now();
    results.Scenario2 = executeScenario2_AdminApiCustomRecipient(db, sandboxFolderId, testFolderTracker);
    timings["Scenario 2: Admin API Custom Recipient"] = Date.now() - tStart;

    // --- Scenario 3: Email Quota Availability Check ---
    console.log("\n=========================================");
    tStart = Date.now();
    results.Scenario3 = executeScenario3_EmailQuotaCheck();
    timings["Scenario 3: Email Quota Check"] = Date.now() - tStart;

    // --- Scenario 4: Test Artifact Cleanup & Sandbox Teardown ---
    console.log("\n=========================================");
    tStart = Date.now();
    results.Scenario4 = executeScenario4_CleanupNotificationTestArtifacts(testFolderTracker);
    timings["Scenario 4: Test Artifacts Cleanup"] = Date.now() - tStart;

  } catch (err) {
    console.error("❌ Test execution halted with unexpected error:", err.message);
    if (err.stack) console.error(err.stack);
  } finally {
    // Restore original system environment boundary
    scriptProperties.setProperty('ENV', originalEnv);
    DBContext.getInstance().bootstrapRepositories();
    console.log(`[NotificationTests] Restored environment context to: '${originalEnv}'`);

    // Output telemetry benchmarks table to logging console
    const totalTime = Date.now() - tSuiteStart;
    console.log("\n========================================================");
    console.log("⏱️   BACKUP NOTIFICATION PERFORMANCE TIMING SUMMARY   ⏱️");
    console.log("========================================================");
    for (const step in timings) {
      console.log(`- ${step.padEnd(48)}: ${String(timings[step]).padStart(5)} ms`);
    }
    console.log("--------------------------------------------------------");
    console.log(`- Total Execution Time                           : ${String(totalTime).padStart(5)} ms`);
    console.log("========================================================\n");
  }

  console.log("📊 FINAL TEST RESULTS: \n", JSON.stringify(results, null, 2));
  console.log("🏁 Backup Notification Tests Complete.");
  return results;
}

/**
 * SCENARIO 1: Verifies that creating a snapshot sends an email with attached manifest.json
 * to the target recipient 'academydazzlingdream@gmail.com'.
 */
function executeScenario1_EmailDispatchWithManifestAttachment(db, sandboxFolderId, tracker) {
  console.log("▶️ SCENARIO 1: Email Dispatch with Manifest Attachment Verification");
  try {
    const targetRecipient = "academydazzlingdream@gmail.com";
    console.log(`   ⚙️ Invoking BackupService.createSnapshot() with notifyEmail='${targetRecipient}'...`);

    const report = BackupService.createSnapshot({
      sourceFolderId: sandboxFolderId,
      notifyEmail: targetRecipient,
      label: "mail_test"
    });

    if (report.target && report.target.snapshot_folder_id) {
      tracker.push(report.target.snapshot_folder_id);
    }

    console.log("   📊 Notification Report Payload:", JSON.stringify(report.notification, null, 2));

    // Assertion 1: Email delivery status
    if (!report.notification || report.notification.email_sent !== true) {
      throw new Error(`Email notification was not sent. Details: ${report.notification ? report.notification.error : 'No notification payload'}`);
    }

    // Assertion 2: Target recipient
    if (report.notification.recipient !== targetRecipient) {
      throw new Error(`Recipient mismatch: expected '${targetRecipient}', got '${report.notification.recipient}'`);
    }

    // Assertion 3: Manifest attachment confirmation
    if (report.notification.manifest_attached !== true) {
      throw new Error("Manifest attachment flag 'manifest_attached' was not true in notification payload.");
    }

    // Assertion 4: Attachment file name convention
    const expectedAttachmentName = `manifest_${report.backup_id}.json`;
    if (report.notification.attachment_name !== expectedAttachmentName) {
      throw new Error(`Attachment name mismatch: expected '${expectedAttachmentName}', got '${report.notification.attachment_name}'`);
    }

    // Assertion 5: Error is null
    if (report.notification.error !== null) {
      throw new Error(`Unexpected error in notification payload: ${report.notification.error}`);
    }

    console.log(`   ✅ Success! Email dispatched to '${targetRecipient}' with attached '${expectedAttachmentName}'.`);
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
 * SCENARIO 2: Verifies Admin API action 'admin_backup_database' dispatches email
 * with attached manifest to the recipient passed in the API payload.
 */
function executeScenario2_AdminApiCustomRecipient(db, sandboxFolderId, tracker) {
  console.log("▶️ SCENARIO 2: Admin API Action with Explicit Recipient & Manifest Attachment");
  try {
    const action = new AdminBackupDatabaseAction();
    const targetRecipient = "academydazzlingdream@gmail.com";

    const mockContext = {
      params: {
        payload: {
          sourceFolderId: sandboxFolderId,
          notifyEmail: targetRecipient,
          label: "api_mail_test"
        }
      },
      user: { user_id: "USR-ADMIN", role: Roles.ADMIN },
      db: db,
      actionType: ActionType.CREATE,
      mutationManifest: [],
      headers: {}
    };

    console.log(`   ⚙️ Dispatching 'admin_backup_database' action as ADMIN with notifyEmail='${targetRecipient}'...`);
    const response = action.run(mockContext);

    if (!response.success) {
      throw new Error(`Admin action failed: ${response.error ? response.error.message : 'Unknown'}`);
    }

    const report = response.data;
    if (report.target && report.target.snapshot_folder_id) {
      tracker.push(report.target.snapshot_folder_id);
    }

    console.log("   📊 API Action Notification Response:", JSON.stringify(report.notification, null, 2));

    if (!report.notification || report.notification.email_sent !== true) {
      throw new Error(`API Action failed to send email: ${report.notification ? report.notification.error : 'No notification'}`);
    }

    if (report.notification.recipient !== targetRecipient) {
      throw new Error(`API Action recipient mismatch: expected '${targetRecipient}', got '${report.notification.recipient}'`);
    }

    if (report.notification.manifest_attached !== true) {
      throw new Error("API Action did not attach manifest file.");
    }

    console.log("   ✅ Success! Admin API action executed and delivered backup report with manifest attachment.");
    return "✅ PASSED";
  } catch (error) {
    console.error("   ❌ Failed:", error.message);
    return `❌ FAILED: ${error.message}`;
  }
}

/**
 * SCENARIO 3: Checks remaining daily MailApp email quota to ensure account health.
 */
function executeScenario3_EmailQuotaCheck() {
  console.log("▶️ SCENARIO 3: MailApp Quota & Health Verification");
  try {
    if (typeof MailApp === 'undefined') {
      throw new Error("MailApp service is not available in the current environment.");
    }

    const remainingQuota = MailApp.getRemainingDailyQuota();
    console.log(`   ⚙️ Remaining daily email quota: ${remainingQuota}`);

    if (typeof remainingQuota !== 'number' || remainingQuota < 0) {
      throw new Error(`Invalid remaining daily quota value: ${remainingQuota}`);
    }

    console.log(`   ✅ Success! MailApp quota verified (${remainingQuota} remaining).`);
    return "✅ PASSED";
  } catch (error) {
    console.error("   ❌ Failed:", error.message);
    return `❌ FAILED: ${error.message}`;
  }
}

/**
 * SCENARIO 4: Cleans up temporary snapshot folders created during notification tests.
 */
function executeScenario4_CleanupNotificationTestArtifacts(tracker) {
  console.log("▶️ SCENARIO 4: Test Artifact Cleanup & Sandbox Teardown");
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

  console.log(`   ✅ Successfully cleaned up ${cleanupCount} notification test artifact(s).`);
  return "✅ PASSED";
}
