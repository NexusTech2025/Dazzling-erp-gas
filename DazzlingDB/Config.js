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
  if (!rawString) return Environment.DEVELOPMENT;
  const normalized = String(rawString).trim().toUpperCase();
  if (normalized === 'PRODUCTION') {
    console.warn("[Config] PRODUCTION environment is locked out on this development branch. Falling back to DEVELOPMENT.");
    return Environment.DEVELOPMENT;
  }
  return Environment[normalized] || Environment.DEVELOPMENT;
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
  // Option A: Hardcoded Defaults
  const DEFAULTS = {
    ENV: Environment.DEVELOPMENT,
    DEV_DATABASE_ROOT_FOLDER_ID: "1eyTm-n2AUvcVS_Ipus7ApC4b0sCl8Q8I" // Developer Sandbox folder
  };

  const DEFAULT_FOLDER_REGISTRY = {
    [Environment.DEVELOPMENT]: DEFAULTS.DEV_DATABASE_ROOT_FOLDER_ID,
    [Environment.TESTING]: DEFAULTS.DEV_DATABASE_ROOT_FOLDER_ID
  };

  // Safe fallback if running in local compilers / CLI testing where GAS API is unavailable
  if (typeof PropertiesService === 'undefined') {
    const localEnv = resolveEnvironmentType(LOCAL_OVERRIDE || DEFAULTS.ENV);
    console.log(`[Config] Local execution detected. Using in-code defaults (ENV: '${localEnv}').`);
    return {
      env: localEnv,
      rootFolderId: DEFAULT_FOLDER_REGISTRY[localEnv] || DEFAULTS.DEV_DATABASE_ROOT_FOLDER_ID
    };
  }

  const scriptProperties = PropertiesService.getScriptProperties();
  let rawEnv = scriptProperties.getProperty("ENV");
  let devId = scriptProperties.getProperty("DEV_DATABASE_ROOT_FOLDER_ID");

  // Normalize active environment type dynamically
  const env = resolveEnvironmentType(rawEnv);
  const updates = {};

  // Self-provision and auto-normalize mismatching properties
  if (!rawEnv || rawEnv !== env) {
    updates.ENV = env;
  }
  if (!devId) {
    devId = DEFAULTS.DEV_DATABASE_ROOT_FOLDER_ID;
    updates.DEV_DATABASE_ROOT_FOLDER_ID = DEFAULTS.DEV_DATABASE_ROOT_FOLDER_ID;
  }

  // Bulk save updates to properties to avoid multiple setProperty remote network calls
  if (Object.keys(updates).length > 0) {
    console.log(`[Config] Syncing and normalizing script properties: ${JSON.stringify(updates)}`);
    scriptProperties.setProperties(updates);
  }

  const ACTIVE_FOLDER_REGISTRY = {
    [Environment.DEVELOPMENT]: devId,
    [Environment.TESTING]: devId
  };

  const rootFolderId = ACTIVE_FOLDER_REGISTRY[env] || devId;
  return { env, rootFolderId };
}

/**
 * Programmatically configures and normalizes script properties for DazzlingDB.
 * Updates local cache variables if running outside Google Apps Script environments.
 * 
 * @param {Object} [options={}] - Target parameters to write.
 * @param {string} [options.env] - Target environment (DEVELOPMENT or TESTING).
 * @param {string} [options.devFolderId] - Developer Sandbox folder ID.
 * @returns {Object} Updated database environment parameters {env, rootFolderId}.
 */
function configureScriptProperties(options = {}) {
  const targetEnv = options.env || options.ENV;
  if (targetEnv) {
    LOCAL_OVERRIDE = targetEnv;
  }
  
  if (typeof PropertiesService === 'undefined') {
    console.warn("[Config] PropertiesService is unavailable. Local override cache updated.");
    return resolveDatabaseEnvironment();
  }

  const scriptProperties = PropertiesService.getScriptProperties();
  const updates = {};

  if (targetEnv) {
    updates.ENV = resolveEnvironmentType(targetEnv);
  }
  
  const devFolderId = options.devFolderId || options.DEV_DATABASE_ROOT_FOLDER_ID;
  if (devFolderId) {
    updates.DEV_DATABASE_ROOT_FOLDER_ID = devFolderId;
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