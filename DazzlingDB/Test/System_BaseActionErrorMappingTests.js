/**
 * @file System_BaseActionErrorMappingTests.js
 * Automated testing module to verify BaseAction Error Mapping Registry behavior in Apps Script.
 */

// Define a Concrete Action subclass for testing formatFailureResponse
class TestErrorDummyAction extends BaseAction {
  constructor() {
    super(ActionType.QUERY);
  }
  handle(requestContext) {
    throw requestContext.params.errorToThrow;
  }
}

/**
 * Main suite runner for BaseAction error mapping tests.
 * @returns {Object} Test results
 */
function runSystemBaseActionErrorMappingTests() {
  console.log("🚀 Starting System BaseAction Error Mapping Tests...");
  
  const results = {};
  
  console.log("\n=========================================");
  results.Scenario1_EntityNotFoundError = executeScenario_VerifyError(
    new SheetDB.EntityNotFoundError("Course", "CRS-XYZ"),
    "ENTITY_NOT_FOUND",
    "EntityNotFoundError (SheetDB database lookup failure)"
  );
  
  console.log("\n=========================================");
  results.Scenario2_ActionValidationError = executeScenario_VerifyError(
    new ActionValidationError("Invalid query parameter payload."),
    "ACTION_VALIDATION_FAILURE",
    "ActionValidationError (API-level parameter validation)"
  );

  console.log("\n=========================================");
  results.Scenario3_ValidationError = executeScenario_VerifyError(
    new SheetDB.ValidationError("Email constraint failed."),
    "VALIDATION_FAILURE",
    "ValidationError (SheetDB schema validation)"
  );

  console.log("\n=========================================");
  results.Scenario4_ConflictError = executeScenario_VerifyError(
    new SheetDB.ConflictError("Unique constraint violation: email already exists."),
    "CONFLICT_ERROR",
    "ConflictError (Duplicate key)"
  );

  console.log("\n=========================================");
  results.Scenario5_IntegrityError = executeScenario_VerifyError(
    new SheetDB.IntegrityError("Cannot delete package: active enrollments exist."),
    "INTEGRITY_VIOLATION",
    "IntegrityError (Referential check violation)"
  );

  console.log("\n=========================================");
  results.Scenario6_ForbiddenError = executeScenario_VerifyError(
    new SheetDB.ForbiddenError("Insufficient roles."),
    "FORBIDDEN_ACCESS",
    "ForbiddenError (Authorization failure)"
  );

  console.log("\n=========================================");
  results.Scenario7_GenericError = executeScenario_VerifyError(
    new Error("Any random backend crash."),
    "UNHANDLED_SERVER_FAULT",
    "Generic Error (Fallback behavior)"
  );
  
  console.log("=========================================\n");
  console.log("📊 FINAL TEST RESULTS: \n", JSON.stringify(results, null, 2));
  console.log("🏁 System BaseAction Error Mapping Tests Complete.");
  
  return results;
}

/**
 * SCENARIO: Verifies that a thrown error maps to the correct failure envelope display code.
 */
function executeScenario_VerifyError(errorInstance, expectedCode, testName) {
  console.log(`▶️ SCENARIO: Verification of ${testName}`);
  try {
    const action = new TestErrorDummyAction();
    const mockContext = {
      params: { errorToThrow: errorInstance },
      user: null,
      db: null,
      actionType: ActionType.QUERY,
      mutationManifest: [],
      headers: {}
    };

    const startTime = Date.now();
    console.log(`   ⚙️ Invoking failure formatter for ${errorInstance.name || errorInstance.constructor.name}`);
    
    // Call run which catches error and invokes formatFailureResponse
    const res = action.run(mockContext);
    
    // Assertions
    if (res.success !== false) {
      throw new Error(`Expected success envelope to be false, got: ${res.success}`);
    }
    if (!res.error || res.error.code !== expectedCode) {
      throw new Error(`Expected display code [${expectedCode}], got: [${res.error ? res.error.code : 'undefined'}]`);
    }
    
    console.log(`   ✅ Success! Envelope correctly returned code: ${res.error.code}`);
    return "✅ PASSED";
  } catch (error) {
    console.error("   ❌ Failed:");
    console.error("      Error Name:   ", error.name || "Error");
    console.error("      Error Message:", error.message);
    if (error.stack) {
      console.error("      Stack Trace:  ", error.stack);
    }
    return `❌ FAILED: ${error.message}`;
  }
}
