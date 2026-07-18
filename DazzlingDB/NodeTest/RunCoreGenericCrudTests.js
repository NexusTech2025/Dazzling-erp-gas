/**
 * @file RunCoreGenericCrudTests.js
 * Standalone Node.js script to execute Core_GenericCrudTests.js in a Node environment.
 */

const fs = require('fs');
const path = require('path');

console.log("🚀 STARTING CORE GENERIC CRUD SIMULATOR RUNNER (NODE.JS)...");

// 1. Mock Google Apps Script Globals
global.globalThis = global;
global.PropertiesService = {
  getScriptProperties: () => {
    const store = { ENV: 'TESTING' };
    return {
      getProperty: (key) => store[key] || null,
      setProperty: (key, val) => { store[key] = val; },
      setProperties: (updates) => { Object.assign(store, updates); }
    };
  }
};
global.Utilities = {
  getUuid: () => 'mock-uuid-1234-5678'
};

// Mock framework base actions & exception classes
global.SystemError = class SystemError extends Error {};
global.ActionValidationError = class ActionValidationError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "ActionValidationError";
    this.details = details;
  }
};
global.ActionAuthorizationError = class ActionAuthorizationError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "ActionAuthorizationError";
    this.details = details;
  }
};
global.AuthBridge = {
  checkAccess: () => true
};

// Bind system constants to global scope to prevent ReferenceErrors in Node.js eval contexts
global.SYSTEM_VERSION = "2.1.2";
global.GLOBAL_CRUD_WHITELIST = new Set([
  "Branch", "PromoCode",
  "CourseType", "Course", "Batch", "BatchAllocation", "PackageItem", "PackagePerk",
  "Address", "ContactInfo", "Education", "StudentLead",
  "TeacherSubject", "TeacherAttendance", "StudentAttendance", "TeacherDocument", "TeacherPaymentTransaction",
  "FeePlan", "ExpenseCategory", "StaffMember", "MoneyTransaction",
  "Test", "TestMarks", "TestPaper"
]);
global.Environment = {
  DEVELOPMENT: "DEVELOPMENT",
  TESTING: "TESTING"
};

// 2. Load Source Files via eval in Global Context
const workspaceRoot = path.resolve(__dirname, '../..'); // e:/NAST/Dazzling/GAS/

function loadSourceFile(relativePath) {
  const filePath = path.join(workspaceRoot, relativePath);
  const code = fs.readFileSync(filePath, 'utf8');
  global.eval(code);
}

// Load Config first to populate SYSTEM_VERSION, Environment, and GLOBAL_CRUD_WHITELIST
loadSourceFile('DazzlingDB/Config.js');
loadSourceFile('SheetDB/Utils/Utils.js');
loadSourceFile('DazzlingDB/DBServices/Policies/AutoKeyField_Override_Policy.js');
loadSourceFile('DazzlingDB/DBServices/BaseActions.js');
loadSourceFile('DazzlingDB/DBServices/ConcreteActions.js');

// 3. Define the Database and Context mock structures
const mockDb = {
  _config: {
    allowAutoOverride: true
  },
  _schema: {
    categories: {
      Core: {
        tables: {
          Branch: {
            primaryKey: "branch_id",
            columns: {
              branch_id: { type: "auto", idPrefix: "BRN" },
              branch_name: { type: "string" }
            }
          }
        }
      }
    }
  },
  setup: {
    provision: () => {}
  },
  Branch: {
    insert: (data) => {
      const pk = "branch_id";
      // Simulate SheetDB ORM AutoField behaviour
      if (!data[pk] || data[pk] === "") {
        data[pk] = "BRN-MOCK-AUTO-KEY";
      }
      return { ...data };
    }
  }
};

global.DATABASE_SCHEMA = mockDb._schema;

// Wire DBContext Singleton
global.DBContext = {
  getInstance: () => ({
    bootstrapRepositories: () => {},
    setup: mockDb.setup,
    Branch: mockDb.Branch,
    _config: mockDb._config,
    _schema: mockDb._schema
  })
};

global.TestHelper = {
  truncateSheet: () => {}
};

// Load the integration test script itself
loadSourceFile('DazzlingDB/Test/Core_GenericCrudTests.js');

// 4. Run the test suite
try {
  runCoreGenericCrudTests();
  console.log("🎉 RunCoreGenericCrudTests execution finished successfully!");
} catch (e) {
  console.error("❌ RunCoreGenericCrudTests crashed with error:", e);
  process.exit(1);
}
