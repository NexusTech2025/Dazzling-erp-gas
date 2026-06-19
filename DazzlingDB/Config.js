/**
 * @file Config.js
 * Global environment configurations and system boundaries for DazzlingDB.
 */

/**
 * Resolves the database environment configuration.
 * Combines in-code defaults (Option A) with runtime script property caching (Option B).
 * Ensures zero-touch provisioning and hot-swappable environment control.
 * 
 * @returns {Object} Active environment parameters
 */
function resolveDatabaseEnvironment() {
  // Option A: Hardcoded Defaults
  const DEFAULTS = {
    ENV: "development",
    DEV_DATABASE_ROOT_FOLDER_ID: "1eyTm-n2AUvcVS_Ipus7ApC4b0sCl8Q8I", // Developer Sandbox folder
    PROD_DATABASE_ROOT_FOLDER_ID: "1LzSkVK4kYaGtv-nQX5y69TtuWtjQCWM3"   // Production Live folder
  };

  // Safe fallback if running in local compilers / CLI testing where GAS API is unavailable
  if (typeof PropertiesService === 'undefined') {
    console.log("[Config] Local execution detected. Using in-code defaults (ENV: 'development').");
    return {
      env: DEFAULTS.ENV,
      rootFolderId: DEFAULTS.DEV_DATABASE_ROOT_FOLDER_ID
    };
  }

  const scriptProperties = PropertiesService.getScriptProperties();
  let env = scriptProperties.getProperty("ENV");
  let devId = scriptProperties.getProperty("DEV_DATABASE_ROOT_FOLDER_ID");
  let prodId = scriptProperties.getProperty("PROD_DATABASE_ROOT_FOLDER_ID");

  const updates = {};

  // Self-provision missing properties from defaults
  if (!env) {
    env = DEFAULTS.ENV;
    updates.ENV = DEFAULTS.ENV;
  }
  if (!devId) {
    devId = DEFAULTS.DEV_DATABASE_ROOT_FOLDER_ID;
    updates.DEV_DATABASE_ROOT_FOLDER_ID = DEFAULTS.DEV_DATABASE_ROOT_FOLDER_ID;
  }
  if (!prodId) {
    prodId = DEFAULTS.PROD_DATABASE_ROOT_FOLDER_ID;
    updates.PROD_DATABASE_ROOT_FOLDER_ID = DEFAULTS.PROD_DATABASE_ROOT_FOLDER_ID;
  }

  // Bulk save updates to properties to avoid multiple setProperty remote network calls
  if (Object.keys(updates).length > 0) {
    console.log(`[Config] Script properties are uninitialized. Bulk provisioning defaults: ${JSON.stringify(updates)}`);
    scriptProperties.setProperties(updates);
  }

  const rootFolderId = (env === "production") ? prodId : devId;
  return { env, rootFolderId };
}

// ----------------------------------------------------
// 🚀 Expose Context-Aware Constants
// ----------------------------------------------------
const ACTIVE_CONFIG = resolveDatabaseEnvironment();
const SYSTEM_ENV = ACTIVE_CONFIG.env;
const DATABASE_ROOT_FOLDER_ID = ACTIVE_CONFIG.rootFolderId;
const SYSTEM_VERSION = "2.1.2";

// Retain security lockout details
const SECURITY_LOCKOUT_ATTEMPTS = 5;
const SECURITY_LOCKOUT_DURATION_MINS = 15;
const SESSION_TTL_HOURS = 24;

// Bulk Deletion Configuration Settings
const MAX_DELETE_BATCH_SIZE = 200;

// NOTE: The relational DATABASE_SCHEMA is automatically loaded in the global
// namespace from 'Config/database_schema.js'.

/**
 * 🔒 Security Guard: Whitelist for Global CRUD Operations.
 */
const GLOBAL_CRUD_WHITELIST = new Set([
  "Branch", "PromoCode",
  "CourseType", "Course", "Batch", "BatchAllocation", "PackageItem", "PackagePerk",
  "Address", "ContactInfo", "Education", "StudentLead",
  "TeacherSubject", "TeacherAttendance", "StudentAttendance", "TeacherDocument", "TeacherSalaryConfig", "TeacherPaymentTransaction",
  "FeePlan", "ExpenseCategory", "StaffMember", "MoneyTransaction",
  "Test", "TestMarks", "TestPaper"
]);

/**
 * 🏷️ ID Prefix Fallback Registry.
 * Used when schema definitions are not fully hydrated or available.
 */
const ID_PREFIX_FALLBACK_REGISTRY = {
  Student: "STU",
  Address: "ADDR",
  ContactInfo: "CONT",
  Education: "EDU",
  Enrollment: "ENR",
  StudentFeeAccount: "SFA",
  Installment: "INS",
  Payment: "PAY",
  BatchAllocation: "BAL",
  FeePlan: "FPL",
  Branch: "BRN",
  PromoCode: "PRM",
  CourseType: "SEG",
  Course: "CRS",
  Package: "PKG",
  PackageItem: "PKI",
  PackagePerk: "PRK",
  Batch: "BAT",
  StudentLead: "SLD",
  Teacher: "TCH",
  TeacherSubject: "TSB",
  TeacherAttendance: "TAT",
  StudentAttendance: "ATT",
  TeacherDocument: "TDO",
  TeacherSalaryConfig: "TSC",
  TeacherPaymentTransaction: "TPT",
  ExpenseCategory: "EXC",
  StaffMember: "STF",
  MoneyTransaction: "MTX",
  Test: "TST",
  TestMarks: "TMK",
  TestPaper: "TPP"
};