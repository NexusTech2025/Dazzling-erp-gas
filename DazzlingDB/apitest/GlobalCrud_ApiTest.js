/**
 * @file GlobalCrud_ApiTest.js
 * API Test for testing the Generic CRUD Endpoints (data_create, data_update, data_delete)
 * and their whitelist security boundaries.
 * 
 * Instructions: Run `GlobalCrud_ApiTest.run()` from the Apps Script editor.
 */

const GlobalCrud_ApiTest = (function() {

  /**
   * Main entry point to run the complete end-to-end generic CRUD test lifecycle.
   */
  function run() {
    const { logger, callApi } = ApiTestHelper;

    console.log("\n🧪 STARTING GLOBAL CRUD API TEST SUITE 🧪");
    
    try {
      // 0. Retrieve the globally cached developer session token
      const superToken = _getSuperToken(logger);

      // 1. PHASE 1: Security Negative Boundary checks
      _executePhase1_Security(callApi, superToken, logger);

      // 2. PHASE 2: Record Creation (Positive Test)
      const storedBranchId = _executePhase2_Create(callApi, superToken, logger);

      // 3. PHASE 3: Record Update (Positive Test)
      _executePhase3_Update(callApi, storedBranchId, superToken, logger);

      // 4. PHASE 4: Fetch & Verify State Integrity
      _executePhase4_Verify(callApi, storedBranchId, superToken, logger);

      // 5. PHASE 5: Record Deletion (Positive Test)
      _executePhase5_Delete(callApi, storedBranchId, superToken, logger);

      // 6. PHASE 6: Deletion Verification (Negative Test)
      _executePhase6_VerifyDelete(callApi, storedBranchId, superToken, logger);

      console.log("\n🎉 GLOBAL CRUD API TEST SUITE COMPLETED SUCCESSFULLY! 🎉\n");
    } catch (error) {
      ApiTestHelper.logger.error(`API Test Failed: ${error.message}`);
    }
  }

  /**
   * Helper: Resolves and fetches the globally cached DEV_SUPER_TOKEN from PropertiesService.
   */
  function _getSuperToken(logger) {
    let superToken = null;
    try {
      superToken = typeof PropertiesService !== "undefined" ? PropertiesService.getScriptProperties().getProperty("DEV_SUPER_TOKEN") : null;
      if (!superToken) {
         logger.detail("⚠️ DEV_SUPER_TOKEN not found in ScriptProperties. Running without token...");
      } else {
         logger.success("🔑 Bootstrapped Super Token loaded successfully!");
      }
    } catch (e) {
      logger.error("Failed to load script properties token: " + e.message);
    }
    return superToken;
  }

  /**
   * Helper: Executes Phase 1 Security negative testing targeting invalid constraints.
   */
  function _executePhase1_Security(callApi, superToken, logger) {
    logger.phase("1: Security & Boundary Defenses (Negative Tests)");
    
    // Test A: Locked/restricted table insert
    logger.action("Attempting data_create on blocked table (User)...");
    let caughtSecurityError = false;
    try {
      callApi("data_create", {
        table: "User",
        data: { username: "malicious_user", password: "123" }
      }, superToken);
    } catch (e) {
      caughtSecurityError = true;
      logger.success(`Security block successful: ${e.message}`);
    }
    if (!caughtSecurityError) {
      throw new Error("Security Failure: API allowed generic insert into 'User' table!");
    }

    // Test B: Missing ID validation
    logger.action("Attempting data_update missing required 'id' parameter...");
    let caughtValidationError = false;
    try {
      callApi("data_update", {
        table: "Branch",
        data: { status: "inactive" }
      }, superToken);
    } catch (e) {
      caughtValidationError = true;
      logger.success(`Validation block successful: ${e.message}`);
    }
    if (!caughtValidationError) {
      throw new Error("Validation Failure: API allowed update without 'id'.");
    }
  }

  /**
   * Helper: Executes Phase 2 Record Creation test, returning the resolved record's Auto-ID.
   */
  function _executePhase2_Create(callApi, superToken, logger) {
    logger.phase("2: Record Creation (Positive Test)");
    logger.action("Dispatching data_create on 'Branch'...");
    
    const createPayload = {
      table: "Branch",
      data: {
        branch_name: "API Test Branch",
        location: "Virtual Sector",
        status: "active"
      }
    };
    
    const createResult = callApi("data_create", createPayload, superToken);
    const storedBranchId = createResult.id;
    logger.success(`Branch created successfully with Auto-ID: ${storedBranchId}`);
    logger.data("Created Record Payload", createResult.record);
    return storedBranchId;
  }

  /**
   * Helper: Executes Phase 3 Record modification and validation update.
   */
  function _executePhase3_Update(callApi, branchId, superToken, logger) {
    logger.phase("3: Record Update (Positive Test)");
    logger.action(`Dispatching data_update for Branch ID: ${branchId}...`);
    
    const updatePayload = {
      table: "Branch",
      id: branchId,
      data: {
        location: "Updated Sector",
        status: "inactive"
      }
    };
    
    const updateResult = callApi("data_update", updatePayload, superToken);
    logger.success("Branch updated successfully.");
    logger.data("Updated Record Diff", updateResult.record);
  }

  /**
   * Helper: Executes Phase 4 State Integrity check using standard query.
   */
  function _executePhase4_Verify(callApi, branchId, superToken, logger) {
    logger.phase("4: State Integrity Verification");
    logger.action(`Dispatching data_query to fetch Branch ID: ${branchId}...`);
    
    const queryResult = callApi("data_query", {
      target: "Branch",
      where: { branch_id: branchId }
    }, superToken);

    if (queryResult.data.length === 0) {
      throw new Error(`Integrity Failure: Branch ${branchId} not found by Query Engine!`);
    }
    
    const verifiedRecord = queryResult.data[0];
    if (verifiedRecord.location !== "Updated Sector" || verifiedRecord.status !== "inactive") {
      throw new Error("Integrity Failure: Fetched record properties do not match updated state!");
    }
    logger.success(`Verified: Record successfully updated to ${verifiedRecord.location} and ${verifiedRecord.status}.`);
  }

  /**
   * Helper: Executes Phase 5 Record deletion command.
   */
  function _executePhase5_Delete(callApi, branchId, superToken, logger) {
    logger.phase("5: Record Deletion (Positive Test)");
    logger.action(`Dispatching data_delete for Branch ID: ${branchId}...`);
    
    callApi("data_delete", {
      table: "Branch",
      id: branchId
    }, superToken);
    logger.success("Branch deleted successfully.");
  }

  /**
   * Helper: Executes Phase 6 verification confirming deleted records block updates.
   */
  function _executePhase6_VerifyDelete(callApi, branchId, superToken, logger) {
    logger.phase("6: Deletion Verification (Negative Test)");
    logger.action(`Attempting data_update on deleted Branch ID: ${branchId}...`);
    
    let caughtDeletedError = false;
    try {
      callApi("data_update", {
        table: "Branch",
        id: branchId,
        data: { status: "active" }
      }, superToken);
    } catch (e) {
      caughtDeletedError = true;
      logger.success(`Verified deletion: EntityNotFoundError properly thrown -> ${e.message}`);
    }
    
    if (!caughtDeletedError) {
      throw new Error("Integrity Failure: API allowed update on a deleted record!");
    }
  }

  return {
    run: run
  };

})();

function runGlobalCrudTest(){
  GlobalCrud_ApiTest.run();
}
