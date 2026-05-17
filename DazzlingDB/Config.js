/**
 * @file Config.js
 * Global environment configurations and system boundaries for DazzlingDB.
 */

// 1. Spreadsheet Root Folder ID (Sandbox isolation)
const DATABASE_ROOT_FOLDER_ID = "1PmHsRpmGXirOh5fmuA3VpNlDn2KuyKlp";

// 2. Security & Lockout Constraints
const SECURITY_LOCKOUT_ATTEMPTS = 5;
const SECURITY_LOCKOUT_DURATION_MINS = 15;

// 3. Active Session Lifetime
const SESSION_TTL_HOURS = 24;

// NOTE: The relational DATABASE_SCHEMA is automatically loaded in the global
// namespace from 'Config/database_schema.js'.

/**
 * 🔒 Security Guard: Whitelist for Global CRUD Operations.
 */
const GLOBAL_CRUD_WHITELIST = new Set([
    "Branch", "PromoCode",
    "CourseType", "Course", "Batch", "PackageItem", "PackageCourse", "PackagePerk",
    "Address", "ContactInfo", "Education",
    "TeacherSubject", "TeacherAttendance", "TeacherDocument", "TeacherSalaryConfig", "TeacherPaymentTransaction",
    "FeePlan"
]);