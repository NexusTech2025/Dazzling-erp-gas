/**
 * @file RunStudentDeleteUntouchedTests.js
 * Path: DazzlingDB/NodeTest/RunStudentDeleteUntouchedTests.js
 * Node.js execution harness for Student_DeleteUntouchedTests.js.
 */
const path = require('path');
const { bootstrapVirtualEnv, loadSourceFile } = require(path.resolve(__dirname, '../../NodeEnvDB/setup'));

console.log("🚀 BOOTSTRAPPING VIRTUAL ENVIRONMENT FOR STUDENT DELETE UNTOUCHED TESTS...");
bootstrapVirtualEnv();

// Load Compiled Full Production Database Schema
loadSourceFile('DazzlingDB/Config/database_schema.js');

// Initialize SheetDB with full schema
const dbInstance = SheetDB.init("Virtual_Sandbox_Folder", DATABASE_SCHEMA, {
  allowAutoOverride: true
});

dbInstance.bootstrapRepositories = function() {
  return dbInstance;
};

// Rebind DBContext singleton to full database instance
global.DBContext = {
  getInstance: function() {
    return dbInstance;
  },
  bootstrapRepositories: function() {
    return dbInstance;
  }
};

// Load DazzlingDB Validation & Domain Files
loadSourceFile('DazzlingDB/Errors.js');
loadSourceFile('DazzlingDB/Validate/ValidationEngine.js');
loadSourceFile('DazzlingDB/Validate/StudentDeleteUntouchedValidationPipeline.js');
loadSourceFile('DazzlingDB/DBServices/BaseActions.js');
loadSourceFile('DazzlingDB/DBServices/AcademicEnrollmentService.js');
loadSourceFile('DazzlingDB/DBServices/StudentService.js');
loadSourceFile('DazzlingDB/DBServices/ConcreteActions.js');
loadSourceFile('DazzlingDB/ApiDispatcher.js');

// Load Mock Data & Test Suite
loadSourceFile('DazzlingDB/Test/SeedMockData.js');
loadSourceFile('DazzlingDB/Test/Student_DeleteUntouchedTests.js');

console.log("▶ RUNNING STUDENT DELETE UNTOUCHED TEST SUITE...");
try {
  runStudentDeleteUntouchedTests();
  console.log("✨ ALL STUDENT DELETE UNTOUCHED TESTS COMPLETED SUCCESSFULLY!");
} catch (error) {
  console.error("❌ TEST SUITE FAILED WITH ERROR:", error);
  process.exit(1);
}
