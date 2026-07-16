/**
 * @file RunAttendanceTimezoneDiagnostic.js
 * Standalone Node.js script to execute Attendance_TimezoneDiagnosticTests.js in a Node environment.
 */

const fs = require('fs');
const path = require('path');

console.log("🚀 STARTING ATTENDANCE TIMEZONE DIAGNOSTIC SIMULATOR RUNNER (NODE.JS)...");

// 1. Mock Google Apps Script Globals
global.globalThis = global;
global.PropertiesService = {
  getScriptProperties: () => {
    const store = { ENV: 'development' };
    return {
      getProperty: (key) => store[key] || null,
      setProperties: (updates) => { Object.assign(store, updates); }
    };
  }
};
global.Utilities = {
  getUuid: () => 'mock-uuid-1234'
};

// 2. Load Source Files via eval in Global Context
const workspaceRoot = path.resolve(__dirname, '../..'); // e:/NAST/Dazzling/GAS/

function loadSourceFile(relativePath) {
  const filePath = path.join(workspaceRoot, relativePath);
  const code = fs.readFileSync(filePath, 'utf8');
  // Execute eval in global context so functions are globally registered
  global.eval(code);
}

// Load SheetDB core libraries
loadSourceFile('SheetDB/Errors.js');
loadSourceFile('SheetDB/Utils/Utils.js');
loadSourceFile('SheetDB/Utils/DateCmp.js');
loadSourceFile('SheetDB/Validation/ValidationPipeline.js');
loadSourceFile('SheetDB/Validation/ValidationRules.js');
loadSourceFile('SheetDB/ORM/Fields.js');

global.SheetDB = global;
global.isDate = globalThis.isDate;

// Load DazzlingDB Date & Attendance Utilities
loadSourceFile('DazzlingDB/DBServices/AttendanceUtil.js');
loadSourceFile('DazzlingDB/DBServices/DazzlingDateTime.js');

// Enforce prototype inheritance mapping in Node environment
if (globalThis.AttendanceUtil && globalThis.DazzlingDateTime) {
  Object.setPrototypeOf(globalThis.AttendanceUtil, globalThis.DazzlingDateTime);
}

// Load the test script itself
loadSourceFile('DazzlingDB/Test/Attendance_TimezoneDiagnosticTests.js');

// 3. Execute the diagnostic tests
runAttendanceTimezoneDiagnosticTests();
