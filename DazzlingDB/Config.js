/**
 * @file Config.js
 * Global environment configurations and system boundaries for DazzlingDB.
 */

/**
 * Global Environment Enum
 * @enum {string}
 */
const Environment = Object.freeze({
  DEVELOPMENT: 'DEVELOPMENT',
  TESTING: 'TESTING'
});

/**
 * Standardized safe resolver for environment type strings.
 * @param {string} rawString - Raw property string from script properties or defaults.
 * @returns {string} One of the Environment enum values.
 */
function resolveEnvironmentType(rawString) {
  // Always return PRODUCTION for this production-locked branch
  return Environment.PRODUCTION;
}

// Bind to global scope for cross-file accessibility in GAS
globalThis.Environment = Environment;
globalThis.resolveEnvironmentType = resolveEnvironmentType;

/** @type {string|null} */
let LOCAL_OVERRIDE = null;

/**
 * Resolves the database environment configuration.
 * Combines in-code defaults (Option A) with runtime script property caching (Option B).
 * Ensures zero-touch provisioning and hot-swappable environment control.
 * 
 * @returns {Object} Active environment parameters
 */
function resolveDatabaseEnvironment() {
  // Option A: Hardcoded Defaults (Production only)
  const DEFAULTS = {
    ENV: Environment.PRODUCTION,
    PROD_DATABASE_ROOT_FOLDER_ID: "1LzSkVK4kYaGtv-nQX5y69TtuWtjQCWM3"   // Production Live folder
  };

  // Safe fallback if running in local compilers / CLI testing where GAS API is unavailable
  if (typeof PropertiesService === 'undefined') {
    return {
      env: DEFAULTS.ENV,
      rootFolderId: DEFAULTS.PROD_DATABASE_ROOT_FOLDER_ID
    };
  }

  const scriptProperties = PropertiesService.getScriptProperties();
  let rawEnv = scriptProperties.getProperty("ENV");
  let prodId = scriptProperties.getProperty("PROD_DATABASE_ROOT_FOLDER_ID");

  const updates = {};

  // Self-provision and auto-normalize mismatching properties
  if (!rawEnv || rawEnv !== Environment.PRODUCTION) {
    updates.ENV = Environment.PRODUCTION;
  }
  if (!prodId) {
    prodId = DEFAULTS.PROD_DATABASE_ROOT_FOLDER_ID;
    updates.PROD_DATABASE_ROOT_FOLDER_ID = DEFAULTS.PROD_DATABASE_ROOT_FOLDER_ID;
  }

  // Bulk save updates to properties to avoid multiple setProperty remote network calls
  if (Object.keys(updates).length > 0) {
    console.log(`[Config] Syncing and normalizing script properties: ${JSON.stringify(updates)}`);
    scriptProperties.setProperties(updates);
  }

  return { env: Environment.PRODUCTION, rootFolderId: prodId };
}

/**
 * Programmatically configures and normalizes script properties for DazzlingDB.
 * Updates local cache variables if running outside Google Apps Script environments.
 * 
 * @param {Object} [options={}] - Target parameters to write.
 * @param {string} [options.env] - Target environment (locked to PRODUCTION).
 * @param {string} [options.prodFolderId] - Production folder ID.
 * @returns {Object} Updated database environment parameters {env, rootFolderId}.
 */
function configureScriptProperties(options = {}) {
  const targetEnv = options.env || options.ENV;
  if (targetEnv) {
    LOCAL_OVERRIDE = Environment.PRODUCTION;
  }

  if (typeof PropertiesService === 'undefined') {
    console.warn("[Config] PropertiesService is unavailable. Local override cache updated.");
    return resolveDatabaseEnvironment();
  }

  const scriptProperties = PropertiesService.getScriptProperties();
  const updates = {};

  if (targetEnv) {
    updates.ENV = Environment.PRODUCTION;
  }

  const prodFolderId = options.prodFolderId || options.PROD_DATABASE_ROOT_FOLDER_ID;
  if (prodFolderId) {
    updates.PROD_DATABASE_ROOT_FOLDER_ID = prodFolderId;
  }

  if (Object.keys(updates).length > 0) {
    console.log(`[Config] Manually configuring script properties: ${JSON.stringify(updates)}`);
    scriptProperties.setProperties(updates);
  }

  return resolveDatabaseEnvironment();
}

// Bind configureScriptProperties to global scope
globalThis.configureScriptProperties = configureScriptProperties;

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
  "TeacherSubject", "TeacherAttendance", "StudentAttendance", "TeacherDocument", "TeacherPaymentTransaction",
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