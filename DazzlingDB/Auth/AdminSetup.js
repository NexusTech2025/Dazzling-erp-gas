/**
 * @file admin_setup.js
 * Server-side entry point for the Admin Setup/First-Run logic.
 */

/**
 * Checks if the system is initialized (i.e., if any admin user exists).
 * Leverages SheetDB library methods for safe physical state detection.
 * @returns {boolean}
 */
function isSystemInitialized() {
  try {
    const db = DBContext.getInstance();
    
    // 1. Check if the User table physically exists
    if (!db.User.isTableExist()) {
      console.warn("[AdminSetup] Physical User table not found. System uninitialized.");
      return false;
    }

    // 2. Logic Check: Does an admin record exist?
    // exists() is safe because we verified physical existence above.
    return db.User.exists({ role: "admin" });

  } catch (e) {
    console.error("[AdminSetup] Fatal error during initialization check:", e.message);
    return false;
  }
}

/**
 * Initializes the Admin database and creates the first admin account.
 * This is triggered by the admin.html setup form.
 * 
 * @param {Object} payload - Data from the setup form.
 * @returns {Object} Success/Failure envelope.
 */
function bootstrapAdminSystem(payload) {
  try {
    console.log("[AdminSetup] Starting bootstrap sequence...");

    // 1. Authorization: Check if already initialized
    if (isSystemInitialized()) {
      throw new SheetDB.ForbiddenError("System is already initialized. Bootstrap is disabled.");
    }

    // 2. Authorization: Verify Setup Key
    const masterKey = PropertiesService.getScriptProperties().getProperty("SETUP_KEY") || "DAZZLING_2026";
    if (payload.setupKey !== masterKey) {
      throw new SheetDB.ForbiddenError("Invalid Setup Key.");
    }

    // 3. Database Provisioning: Create Spreadsheets and Tables
    const db = DBContext.getInstance();
    console.log("[AdminSetup] Provisioning physical infrastructure...");
    
    // provision() is idempotent and handles file/sheet creation
    const result = db.setup.provision();
    console.log("[AdminSetup] Provisioning complete:", JSON.stringify(result));

    // 4. Create Admin Account
    console.log("[AdminSetup] Registering primary superadmin...");
    const adminUser = AuthBridge.registerUser({
      ...payload.userData,
      ...payload.profileData,
      role: "admin"
    });

    return { 
      success: true, 
      message: "Admin system initialized successfully.",
      user: { username: adminUser.username }
    };

  } catch (e) {
    console.error("[AdminSetup] Bootstrap failed:", e.stack);
    return { 
      success: false, 
      error: { 
        type: e.name,
        message: e.message 
      } 
    };
  }
}

/**
 * UI Service: Returns the appropriate view for the admin panel.
 */
function getAdminPanelContent() {
  const isInitialized = isSystemInitialized();
  const template = HtmlService.createTemplateFromFile('views/admin_acc');
  
  // Pass state to the template if needed (optional)
  // template.isInitialized = isInitialized;

  return template.evaluate()
    .setTitle(isInitialized ? "Admin Control Center | Dazzling CRM" : "System Setup | Dazzling CRM")
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
