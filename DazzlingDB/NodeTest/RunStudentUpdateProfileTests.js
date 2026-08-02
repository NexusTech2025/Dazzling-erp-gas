/**
 * @file RunStudentUpdateProfileTests.js
 * Node.js execution harness for Student_UpdateProfileTests.js.
 */
const path = require('path');
const { bootstrapVirtualEnv, loadSourceFile } = require(path.resolve(__dirname, '../../NodeEnvDB/setup'));

console.log("🚀 BOOTSTRAPPING VIRTUAL ENVIRONMENT FOR STUDENT UPDATE PROFILE TESTS...");
bootstrapVirtualEnv();

// Load Compiled Full Production Database Schema
loadSourceFile('DazzlingDB/Config/database_schema.js');

// Initialize SheetDB with full schema including Students tables (Student, Address, ContactInfo, Education)
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

// Load DazzlingDB Domain Files
loadSourceFile('DazzlingDB/Errors.js');
loadSourceFile('DazzlingDB/DBServices/BaseActions.js');
loadSourceFile('DazzlingDB/DBServices/AcademicEnrollmentService.js');
loadSourceFile('DazzlingDB/DBServices/StudentService.js');
loadSourceFile('DazzlingDB/DBServices/ConcreteActions.js');
loadSourceFile('DazzlingDB/ApiDispatcher.js');

// Load Test Suite
loadSourceFile('DazzlingDB/Test/Student_UpdateProfileTests.js');

console.log("▶ RUNNING STUDENT UPDATE PROFILE TEST SUITE...");
try {
  runStudentUpdateProfileTests();
  console.log("✨ ALL STUDENT UPDATE PROFILE TESTS COMPLETED SUCCESSFULLY!");
} catch (error) {
  console.error("❌ TEST SUITE FAILED WITH ERROR:", error);
  process.exit(1);
}
