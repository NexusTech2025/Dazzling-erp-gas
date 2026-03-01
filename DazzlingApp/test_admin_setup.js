/**
 * ==============================================================
 * test_admin_setup.gs
 * ==============================================================
 * 
 * Purpose:
 * Manual bootstrap script to create the FIRST admin account.
 * 
 * Instructions:
 * 1. Open this file in the Google Apps Script Editor.
 * 2. Select the 'runAdminBootstrap' function.
 * 3. Click 'Run'.
 * 4. Check the Execution Log for success message.
 * 
 * IMPORTANT: 
 * This script will only work ONCE. If an admin already exists in 
 * the 'Users' sheet, it will fail for security reasons.
 * ==============================================================
 */

const DUMMY_SETUP_KEY = "DAZZLING_INITIAL_2026";

/**
 * Main execution function
 */
function runAdminBootstrap() {
  console.log("🚀 Starting Admin Bootstrap Process...");

  try {
    // 1. Temporarily set the SETUP_KEY in Script Properties
    // In a real scenario, you'd do this manually in Settings.
    PropertiesService.getScriptProperties().setProperty("SETUP_KEY", DUMMY_SETUP_KEY);
    console.log("✅ Setup Key configured.");

    // 2. Prepare the Bootstrap Request Payload
    const payload = {
      action: "bootstrap_admin",
      setupKey: DUMMY_SETUP_KEY,
      userData: {
        username: "superadmin",
        password: "adminPassword123!", // CHANGE THIS IMMEDIATELY AFTER SETUP
        email: "admin@nast.edu"
      },
      profileData: {
        name: "Main Administrator",
        designation: "Principal / IT Director"
      }
    };

    // 3. Simulate the doPost entry point internally
    // We bootstrap the ORM and ActionRegistry directly since we are inside the project.
    const orm = bootstrapORM();
    const ActionClass = ActionRegistry.resolve(payload.action);

    const actionInstance = new ActionClass({
      orm,
      params: payload,
      context: { method: "INTERNAL_BOOTSTRAP" }
    });

    console.log("🛰️ Executing Bootstrap Action...");
    const result = actionInstance.run();

    // 4. Output results
    if (result.success) {
      console.log("🎊 SUCCESS: First Admin Account Created!");
      console.log("User ID: " + result.data.id);
      console.log("⚠️  SECURITY: The SETUP_KEY has been automatically deleted.");
      console.log("👉 Next step: You can now use the 'login' action with these credentials.");
    } else {
      console.error("❌ BOOTSTRAP FAILED:");
      console.error(JSON.stringify(result.error, null, 2));
    }

  } catch (error) {
    console.error("💥 SYSTEM ERROR during bootstrap:");
    console.error(error.stack);
  }
}

/**
 * Helper to check if the system is already initialized
 */
function checkAdminStatus() {
  const orm = bootstrapORM();
  const userRepo = orm.getRepository("User");
  const exists = userRepo.exists({ role: "admin" });
  
  console.log(exists 
    ? "⚠️  Admin already exists. Bootstrap is LOCKED." 
    : "✅ No admin found. System is ready for Bootstrap.");
}
