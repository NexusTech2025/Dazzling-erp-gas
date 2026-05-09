/**
 * @file SystemDiagnosticsTests.js
 * Diagnostic suite to verify environment integrity before UI interactions.
 */

function runSystemDiagnostics() {
  console.log("🚀 Starting System Diagnostics...");
  
  const results = {
    errors: testErrorDefinitions(),
    initialization: testInitializationLogic(),
    db: testDatabaseConnectivity()
  };

  console.log("📊 Diagnostic Results:", JSON.stringify(results, null, 2));
  return results;
}

/**
 * Verify all required Error classes are defined and accessible.
 */
function testErrorDefinitions() {
  const required = [
    "SheetDB.SheetDBError", 
    "SheetDB.ForbiddenError", 
    "SheetDB.ValidationError", 
    "SheetDB.ConflictError", 
    "SheetDB.TableNotFoundError",
    "AuthAccountLockedError"
  ];
  
  const status = {};
  required.forEach(err => {
    try {
      const exists = eval(`typeof ${err} !== 'undefined'`);
      status[err] = exists ? "✅ OK" : "❌ MISSING";
    } catch (e) {
      status[err] = "❌ CRASH: " + e.message;
    }
  });

  return status;
}

/**
 * Test the First-Run initialization check.
 */
function testInitializationLogic() {
  try {
    const isInit = isSystemInitialized();
    return {
      canRun: true,
      result: isInit,
      message: isInit ? "System already contains data." : "Clean system detected (Correct for first-run)."
    };
  } catch (e) {
    return { canRun: false, error: e.message };
  }
}

/**
 * Verify DBContext and basic SheetDB connectivity.
 */
function testDatabaseConnectivity() {
  try {
    const db = DBContext.getInstance();
    const tableExists = db.User.isTableExist();
    return {
      connected: true,
      userTablePhysical: tableExists
    };
  } catch (e) {
    return { connected: false, error: e.message };
  }
}
