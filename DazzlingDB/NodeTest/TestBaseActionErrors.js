/**
 * @file TestBaseActionErrors.js
 * Standalone Node.js test script to verify BaseAction error registry mapping.
 */

const fs = require('fs');
const path = require('path');

// 1. Mock Google Apps Script Globals
global.globalThis = global;
global.PropertiesService = {
  getScriptProperties: () => {
    const store = { ENV: 'development' };
    return {
      getProperty: (key) => store[key] || null,
      setProperties: (updates) => {
        Object.assign(store, updates);
      }
    };
  }
};
global.Utilities = {
  getUuid: () => 'mock-uuid-1234'
};

// 2. Load Source Files via eval in Global Context
const workspaceRoot = path.resolve(__dirname, '../..'); // E:/NAST/Dazzling/GAS/

function loadSourceFile(relativePath) {
  const filePath = path.join(workspaceRoot, relativePath);
  const code = fs.readFileSync(filePath, 'utf8');
  // Safe eval to execute inside mock global environment
  eval(code);
}

// Load SheetDB errors first to populate global scope with real classes
loadSourceFile('SheetDB/Errors.js');

// Establish namespace redirect for SheetDB library cross-checking in DazzlingDB
global.SheetDB = global;

// Load Config next to bind SYSTEM_VERSION and resolve ACTIVE_CONFIG
loadSourceFile('DazzlingDB/Config.js');
// Load Errors to bind custom exception classes
loadSourceFile('DazzlingDB/Errors.js');
// Load BaseActions to bind ActionType, ErrorMappingRegistry, and BaseAction
loadSourceFile('DazzlingDB/DBServices/BaseActions.js');

// 3. Define a Concrete Action subclass for testing
class TestDummyAction extends BaseAction {
  constructor() {
    super(ActionType.QUERY);
  }
  handle(requestContext) {
    throw requestContext.params.errorToThrow;
  }
}

// 4. Test Suite Execution
console.log('🧪 Starting BaseAction Error Mapping Verification Suite\n');

const action = new TestDummyAction();

const mockContext = {
  params: {},
  user: null,
  db: null,
  actionType: ActionType.QUERY,
  mutationManifest: [],
  headers: {}
};

function runTest(errorInstance, expectedCode, testName) {
  mockContext.params.errorToThrow = errorInstance;
  const startTime = Date.now();
  
  // Directly trigger formatFailureResponse to inspect output
  const res = action.formatFailureResponse(errorInstance, startTime, 'correlation-123', 'development', mockContext);

  console.log(`Test: ${testName}`);
  console.log(`  - Thrown Class: ${errorInstance.constructor.name} (name property: "${errorInstance.name}")`);
  console.log(`  - Envelope Success: ${res.success}`);
  console.log(`  - Envelope Error Code: "${res.error.code}"`);
  console.log(`  - Envelope Error Message: "${res.error.message}"`);
  
  if (res.success !== false) {
    throw new Error(`[FAIL] ${testName}: Expected success to be false.`);
  }
  if (res.error.code !== expectedCode) {
    throw new Error(`[FAIL] ${testName}: Expected error code "${expectedCode}", but got "${res.error.code}"`);
  }
  
  console.log('  ✅ PASSED\n');
}

try {
  // Test Case 1: EntityNotFoundError
  const errEntity = new SheetDB.EntityNotFoundError("Course", "CRS-XYZ");
  runTest(errEntity, 'ENTITY_NOT_FOUND', 'EntityNotFoundError (SheetDB database lookup failure)');

  // Test Case 2: ActionValidationError
  const errActionVal = new ActionValidationError("Invalid query parameter payload.");
  runTest(errActionVal, 'ACTION_VALIDATION_FAILURE', 'ActionValidationError (API-level parameter validation)');

  // Test Case 3: ValidationError
  const errVal = new ValidationError("Email constraint failed.");
  runTest(errVal, 'VALIDATION_FAILURE', 'ValidationError (SheetDB schema validation)');

  // Test Case 4: ConflictError
  const errConflict = new ConflictError("Unique constraint violation: email already exists.");
  runTest(errConflict, 'CONFLICT_ERROR', 'ConflictError (Duplicate key)');

  // Test Case 5: IntegrityError
  const errIntegrity = new IntegrityError("Cannot delete package: active enrollments exist.");
  runTest(errIntegrity, 'INTEGRITY_VIOLATION', 'IntegrityError (Referential check violation)');

  // Test Case 6: ForbiddenError
  const errForbidden = new ForbiddenError("Insufficient roles.");
  runTest(errForbidden, 'FORBIDDEN_ACCESS', 'ForbiddenError (Authorization failure)');

  // Test Case 7: Unhandled Generic Error
  const errGeneric = new Error("Any random backend crash.");
  runTest(errGeneric, 'UNHANDLED_SERVER_FAULT', 'Generic Error (Fallback behavior)');

  console.log('🎉 ALL TEST CASES PASSED SUCCESSFULLY!');

} catch (suiteError) {
  console.error(`\n❌ TEST SUITE FAILED:\n${suiteError.message}`);
  process.exit(1);
}
