/**
 * @file ConcreteActions.js
 * Definitions for all API Endpoints in DazzlingDB.
 */

/**
 * Health Check Action
 */
class PingAction extends BaseAction {
  constructor() {
    super(ActionType.QUERY);
  }

  handle(requestContext) {
    return {
      status: "Online",
      timestamp: new Date().toISOString(),
      database: DATABASE_SCHEMA.database,
      version: DATABASE_SCHEMA.version
    };
  }
}

/**
 * Student Domain: Comprehensive Registration
 */
class RegisterStudentAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE);
  }

  handle(requestContext) {
    return StudentService.registerStudent(requestContext.params.payload, requestContext);
  }
}

/**
 * Student Domain: Withdraw a subject from package enrollment
 */
class WithdrawStudentSubjectAction extends BaseAction {
  constructor() {
    super(ActionType.DELETE);
  }

  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.student_id || !p.course_id) {
      throw new ActionValidationError("payload must contain 'student_id' and 'course_id'.");
    }
  }

  handle(requestContext) {
    const p = requestContext.params.payload;
    return StudentService.processSubjectWithdrawal(p.student_id, p.course_id, requestContext);
  }
}

/**
 * Student Domain: Upgrade standalone course enrollments to a package
 */
class UpgradeStudentPackageAction extends BaseAction {
  constructor() {
    super(ActionType.UPDATE);
  }

  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.student_id || !p.current_enrollment_ids || !p.target_package_id || !p.package_batches) {
      throw new ActionValidationError("payload must contain 'student_id', 'current_enrollment_ids', 'target_package_id', and 'package_batches'.");
    }
  }

  handle(requestContext) {
    const { student_id, current_enrollment_ids, target_package_id, package_batches } = requestContext.params.payload;
    return StudentService.upgradeToPackage({
      studentId: student_id,
      currentEnrollmentIds: current_enrollment_ids,
      targetPackageId: target_package_id,
      packageBatches: package_batches
    }, requestContext);
  }
}

/**
 * Student Domain: Verify class/portal access control
 */
class VerifyStudentAccessAction extends BaseAction {
  constructor() {
    super(ActionType.QUERY);
  }

  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.student_id || !p.course_id) {
      throw new ActionValidationError("payload must contain 'student_id' and 'course_id'.");
    }
  }

  handle(requestContext) {
    const p = requestContext.params.payload;
    const access = StudentService.checkAccessStatus(p.student_id, p.course_id);
    if (!access.allowed && access.isOverdue) {
      StudentService.suspendOverdueAccess(p.student_id, p.course_id, requestContext);
    }
    return access;
  }
}

/**
 * Student Lead Domain: Add a new student lead
 */
class AddStudentLeadAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE);
  }

  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.leadData) {
      throw new ActionValidationError("payload must contain 'leadData'.");
    }
    if (!p.leadData.student_name) {
      throw new ActionValidationError("leadData must contain 'student_name'.");
    }
    if (!p.leadData.phone) {
      throw new ActionValidationError("leadData must contain 'phone'.");
    }
  }

  handle(requestContext) {
    return StudentService.addStudentLead(requestContext.params.payload.leadData, requestContext);
  }
}

/**
 * Students Domain: Delete single student
 */
class DeleteStudentAction extends BaseAction {
  constructor() {
    super(ActionType.DELETE);
  }

  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.student_id) {
      throw new ActionValidationError("Payload must contain 'student_id'.");
    }
  }

  _authorize() {
    if (!AuthBridge.checkAccess(this._user, "Student")) {
      throw new ActionAuthorizationError("Access denied: You are not authorized to delete students.");
    }
  }

  handle(requestContext) {
    const { student_id, dryRun } = requestContext.params.payload;
    const isDryRun = dryRun !== false;

    const student = this._db.Student.findById(student_id);
    if (!student) {
      throw new SheetDB.EntityNotFoundError("Student", student_id, "Academic");
    }

    if (isDryRun) {
      this._db.Student.enforceDeleteConstraints(student_id);
    } else {
      try {
        this._db.Student.remove(student_id);
        if (requestContext.mutationManifest) {
          requestContext.mutationManifest.push("Student");
        }
      } catch (e) {
        if (e instanceof SheetDB.IntegrityError || e.name === "IntegrityError") {
          throw new ActionValidationError(e.message);
        }
        throw e;
      }
    }

    return {
      success: true,
      message: `Successfully deleted Student '${student_id}'.`,
      student_id: student_id
    };
  }
}

/**
 * Academic Domain: Create CourseType (Segment)
 */
class CreateCourseTypeAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE);
  }
  _validate() {
    this._requireParam("payload");
  }
  handle(requestContext) {
    return AcademicService.createCourseType(requestContext.params.payload, requestContext);
  }
}

/**
 * Academic Domain: Create Course (Subject)
 */
class CreateCourseAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE);
  }
  _validate() {
    this._requireParam("payload");
  }
  handle(requestContext) {
    return AcademicService.createCourse(requestContext.params.payload, requestContext);
  }
}

/**
 * Academic Domain: Create Batch
 */
class CreateBatchAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE);
  }
  _validate() {
    this._requireParam("payload");
  }
  handle(requestContext) {
    return AcademicService.createBatch(requestContext.params.payload, requestContext);
  }
}

/**
 * Academic Domain: Bulk Package Creation
 */
class CreatePackageAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE);
  }
  _validate() {
    this._requireParam("payload");
  }
  handle(requestContext) {
    return AcademicService.createPackage(requestContext.params.payload, requestContext);
  }
}

/**
 * Academic Domain: Package Updates with Polymorphic & Casing Support
 */
class UpdatePackageAction extends BaseAction {
  constructor() {
    super(ActionType.UPDATE);
  }
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.package_id) {
      throw new ActionValidationError("Payload must contain 'package_id'.");
    }
  }
  handle(requestContext) {
    return AcademicService.updatePackage(requestContext.params.payload, requestContext);
  }
}

/**
 * Academic Domain: Specialized Package Deletion Action
 */
class DeletePackageAction extends BaseAction {
  constructor() {
    super(ActionType.DELETE);
  }
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.package_id) {
      throw new ActionValidationError("Payload must contain 'package_id'.");
    }
  }
  handle(requestContext) {
    return AcademicService.deletePackage(requestContext.params.payload.package_id, requestContext);
  }
}

/**
 * Academic Domain: Enroll Student
 */
class EnrollStudentAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE);
  }
  _validate() {
    this._requireParam("payload");
  }
  handle(requestContext) {
    return AcademicService.enrollStudent(requestContext.params.payload, requestContext);
  }
}

/**
 * 🛠️ CORE DOMAIN ACTIONS
 */
class CreateBranchAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE);
  }
  _validate() { this._requireParam("payload"); }
  handle(requestContext) { return CoreService.createBranch(requestContext.params.payload, requestContext); }
}

class CreatePromoCodeAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE);
  }
  _validate() { this._requireParam("payload"); }
  handle(requestContext) { return CoreService.createPromoCode(requestContext.params.payload, requestContext); }
}

class ValidatePromoCodeAction extends BaseAction {
  constructor() {
    super(ActionType.QUERY);
  }
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.code || !p.entity_type || !p.entity_id) {
      throw new ActionValidationError("payload must contain 'code', 'entity_type', and 'entity_id'.");
    }
  }
  handle(requestContext) {
    const { code, entity_type, entity_id } = requestContext.params.payload;
    return CoreService.validatePromoCode(code, entity_type, entity_id, requestContext);
  }
}

/**
 * 🔐 AUTH DOMAIN ACTIONS
 */
class UserRegisterAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE);
  }
  _validate() { this._requireParam("payload"); }
  handle(requestContext) { return AuthBridge.registerUser(requestContext.params.payload, requestContext); }
}

class UserLoginAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE);
  }
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.username || !p.password) {
      throw new ActionValidationError("payload must contain 'username' and 'password'.");
    }
  }
  handle(requestContext) {
    const { username, password } = requestContext.params.payload;
    return AuthBridge.login(username, password, {}, requestContext);
  }
}

class UserLogoutAction extends BaseAction {
  constructor() {
    super(ActionType.DELETE);
  }
  handle(requestContext) {
    const token = requestContext.params.token || (requestContext.params.payload && requestContext.params.payload.token);
    if (!token) throw new ActionValidationError("token is required.");
    return AuthBridge.logout(token, requestContext);
  }
}

/**
 * 👩‍🏫 STAFF DOMAIN ACTIONS
 */
class StaffOnboardTeacherAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE);
  }
  _validate() { this._requireParam("payload"); }
  handle(requestContext) { return StaffService.onboardTeacher(requestContext.params.payload, requestContext); }
}

class StaffUpdateTeacherAction extends BaseAction {
  constructor() {
    super(ActionType.UPDATE);
  }
  _validate() {
    this._requireParam("payload");
    if (!this._params.payload.teacher_id) {
      throw new ActionValidationError("payload must contain 'teacher_id'.");
    }
  }
  handle(requestContext) {
    return StaffService.updateTeacher(requestContext.params.payload, requestContext);
  }
}

class StaffAssignSubjectsAction extends BaseAction {
  constructor() {
    super(ActionType.UPDATE);
  }
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.teacher_id || !p.subject_ids) {
      throw new ActionValidationError("payload must contain 'teacher_id' and 'subject_ids'.");
    }
  }
  handle(requestContext) {
    const { teacher_id, subject_ids } = requestContext.params.payload;
    return StaffService.assignSubjects(teacher_id, subject_ids, requestContext);
  }
}

class StaffSetSalaryConfigAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE);
  }
  _validate() { this._requireParam("payload"); }
  handle(requestContext) { return StaffService.setSalaryConfig(requestContext.params.payload, requestContext); }
}

class StaffMarkAttendanceAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE);
  }
  _validate() { this._requireParam("payload"); }
  handle(requestContext) { return StaffService.markAttendance(requestContext.params.payload, requestContext); }
}

class StaffMarkAttendanceBulkAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE);
  }
  _validate() { this._requireParam("payload"); }
  handle(requestContext) { return StaffService.markAttendanceBulk(requestContext.params.payload, requestContext); }
}

class StaffQueryAttendanceAction extends BaseAction {
  constructor() {
    super(ActionType.QUERY);
  }
  _validate() { this._requireParam("payload"); }
  handle(requestContext) { return StaffService.queryAttendance(requestContext.params.payload, requestContext); }
}

class StudentMarkAttendanceAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE);
  }
  _validate() { this._requireParam("payload"); }
  handle(requestContext) { return StudentService.markAttendance(requestContext.params.payload, requestContext); }
}

class StudentMarkAttendanceBulkAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE);
  }
  _validate() { this._requireParam("payload"); }
  handle(requestContext) { return StudentService.markAttendanceBulk(requestContext.params.payload, requestContext); }
}

class StudentQueryAttendanceAction extends BaseAction {
  constructor() {
    super(ActionType.QUERY);
  }
  _validate() { this._requireParam("payload"); }
  handle(requestContext) { return StudentService.queryAttendance(requestContext.params.payload, requestContext); }
}

class CreateTestAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE);
  }
  _validate() { this._requireParam("payload"); }
  handle(requestContext) { return TestService.createTest(requestContext.params.payload, requestContext); }
}

class SaveTestMarksBulkAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE);
  }
  _validate() { this._requireParam("payload"); }
  handle(requestContext) { return TestService.saveTestMarksBulk(requestContext.params.payload, requestContext); }
}

class QueryTestReportAction extends BaseAction {
  constructor() {
    super(ActionType.QUERY);
  }
  _validate() { this._requireParam("payload"); }
  handle(requestContext) { return TestService.queryTestReport(requestContext.params.payload, requestContext); }
}

class StaffRecordPaymentAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE);
  }
  _validate() { this._requireParam("payload"); }
  handle(requestContext) { return StaffService.recordPayment(requestContext.params.payload, requestContext); }
}

class StaffAddDocumentAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE);
  }
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.teacher_id || !p.document) {
      throw new ActionValidationError("payload must contain 'teacher_id' and 'document'.");
    }
  }
  handle(requestContext) {
    const { teacher_id, document } = requestContext.params.payload;
    return StaffService.addDocument(teacher_id, document, requestContext);
  }
}

/**
 * 🔍 ADVANCED QUERY ENGINE ACTION
 */
class InitErpAction extends BaseAction {
  constructor() {
    super(ActionType.QUERY);
  }
  _validate() {
    this._requireParam("payload");
    if (!this._params.payload || !Array.isArray(this._params.payload.targets)) {
      throw new ActionValidationError("'payload.targets' must be an array of table names or query objects.");
    }
  }

  handle(requestContext) {
    var targets = requestContext.params.payload.targets;
    var result = {};

    for (var i = 0; i < targets.length; i++) {
      var item = targets[i];
      var queryPayload;

      if (typeof item === "string") {
        queryPayload = {
          target: item,
          pagination: { limit: 1000 }
        };
      } else if (item && typeof item === "object" && item.target) {
        queryPayload = item;
        if (!queryPayload.pagination) {
          queryPayload.pagination = { limit: 1000 };
        } else if (typeof queryPayload.pagination.limit === "undefined") {
          queryPayload.pagination.limit = 1000;
        }
      } else {
        throw new ActionValidationError("Invalid target at index " + i + ". Must be string or object with 'target' property.");
      }

      var target = queryPayload.target;

      try {
        var data = QueryEngine.execute(queryPayload, this._db);
        var key = (target === "Batch") ? "batches" : (target.toLowerCase() + "s");
        result[key] = data;
      } catch (e) {
        throw new Error("Failed to hydrate " + target + ": " + e.message);
      }
    }

    return result;
  }
}

class QueryAction extends BaseAction {
  constructor() {
    super(ActionType.QUERY);
  }
  _validate() {
    this._requireParam("payload");
    if (!this._params.payload.target) {
      throw new ActionValidationError("Query 'target' table is required.");
    }
  }

  handle(requestContext) {
    return QueryEngine.execute(requestContext.params.payload, this._db);
  }
}

/**
 * 🛠️ ADMIN CONTROL CENTER (ACC) ACTIONS
 */
class AdminSystemStatusAction extends BaseAction {
  constructor() {
    super(ActionType.QUERY);
  }
  handle(requestContext) {
    return {
      isInitialized: AuthBridge.isSystemInitialized(),
      database: DATABASE_SCHEMA.database,
      version: DATABASE_SCHEMA.version,
      timestamp: new Date().toISOString()
    };
  }
}

class AdminBootstrapAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE);
  }
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.setupKey || !p.userData) {
      throw new ActionValidationError("payload must contain 'setupKey' and 'userData'.");
    }
  }

  _authorize() {
    if (AuthBridge.isSystemInitialized()) {
      throw new SheetDB.ForbiddenError("System already initialized. Bootstrap disabled.");
    }

    const masterKey = PropertiesService.getScriptProperties().getProperty("SETUP_KEY") || "DAZZLING_2026";
    if (this._params.payload.setupKey !== masterKey) {
      throw new SheetDB.ForbiddenError("Invalid Setup Key.");
    }
  }

  handle(requestContext) {
    const { userData } = requestContext.params.payload;

    console.log("[AdminBootstrapAction] Provisioning physical infrastructure...");
    this._db.setup.provision();

    console.log("[AdminBootstrapAction] Registering superadmin...");
    return AuthBridge.registerUser({
      ...userData,
      user_id: "ADMIN-SUPER",
      role: "admin"
    }, requestContext);
  }
}

class AdminGetSchemaAction extends BaseAction {
  constructor() {
    super(ActionType.QUERY);
  }
  _authorize() {
    if (!this._user || this._user.role !== "admin") {
      throw new ActionAuthorizationError("Superadmin privileges required.");
    }
  }
  handle(requestContext) { return DATABASE_SCHEMA; }
}

class AdminAnalyzeTableAction extends BaseAction {
  constructor() {
    super(ActionType.QUERY);
  }
  _authorize() {
    if (!this._user || this._user.role !== "admin") {
      throw new ActionAuthorizationError("Superadmin privileges required.");
    }
  }
  handle(requestContext) {
    return this._db.setup.plan();
  }
}

class AdminRepairTableAction extends BaseAction {
  constructor() {
    super(ActionType.UPDATE);
  }
  _authorize() {
    if (!this._user || this._user.role !== "admin") {
      throw new ActionAuthorizationError("Superadmin privileges required.");
    }
  }
  handle(requestContext) {
    return this._db.setup.provision();
  }
}

class AdminPeekDataAction extends BaseAction {
  constructor() {
    super(ActionType.QUERY);
  }
  _validate() {
    this._requireParam("payload");
    if (!this._params.payload.table) {
      throw new ActionValidationError("payload must contain 'table'.");
    }
  }
  _authorize() {
    if (!this._user || this._user.role !== "admin") {
      throw new ActionAuthorizationError("Superadmin privileges required.");
    }
  }
  handle(requestContext) {
    const { table } = requestContext.params.payload;
    if (!this._db[table]) throw new ActionValidationError(`Table '${table}' not found.`);

    return this._db[table].where({}, { limit: 5 });
  }
}

class AdminCacheAnalyzeAction extends BaseAction {
  constructor() {
    super(ActionType.QUERY);
  }
  _authorize() {
    if (!this._user || this._user.role !== "admin") {
      throw new ActionAuthorizationError("Superadmin privileges required.");
    }
  }
  handle(requestContext) {
    return CacheAnalyzer.getReportData();
  }
}

class AdminPurgeCacheAction extends BaseAction {
  constructor() {
    super(ActionType.DELETE);
  }
  _authorize() {
    if (!this._user || this._user.role !== "admin") {
      throw new ActionAuthorizationError("Superadmin privileges required.");
    }
  }
  handle(requestContext) {
    this._db.purge();
    return {
      message: "System caches purged successfully."
    };
  }
}

// ----------------------------------------------------
// GLOBAL CRUD ACTION CONTROLLERS & SAFEGUARD WHITELIST
// ----------------------------------------------------

class CreateRecordAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE);
    this._actionName = "data_create";
  }

  get isGenericCrudResult() { return true; }

  _validate() {
    this._requireParam("payload");
    const payload = this._params.payload;
    if (!payload.table) {
      throw new ActionValidationError("Payload must contain 'table' property.");
    }
    if (!payload.data || typeof payload.data !== "object") {
      throw new ActionValidationError("Payload must contain a valid 'data' object.");
    }
    if (!GLOBAL_CRUD_WHITELIST.has(payload.table)) {
      throw new ActionValidationError(`Table '${payload.table}' is not eligible for generic CRUD operations. Please use specialized endpoints.`);
    }
  }

  _authorize() {
    const tableName = this._params.payload.table;
    if (!AuthBridge.checkAccess(this._user, tableName)) {
      throw new ActionAuthorizationError(`Access denied: You are not authorized to create records in '${tableName}'.`);
    }
  }

  handle(requestContext) {
    const { table, data } = requestContext.params.payload;
    const dbGateway = this._db[table];

    let tableSchema = null;
    for (var cat in DATABASE_SCHEMA.categories) {
      var tables = DATABASE_SCHEMA.categories[cat].tables;
      if (tables[table]) {
        tableSchema = tables[table];
        break;
      }
    }

    if (!tableSchema) {
      throw new ActionValidationError(`Table '${table}' schema definition not found.`);
    }

    const primaryKey = tableSchema.primaryKey;
    let generatedId = null;

    if (primaryKey && tableSchema.columns[primaryKey]) {
      const pkCol = tableSchema.columns[primaryKey];
      if (pkCol.type === "auto" && !data[primaryKey]) {
        const fallbackRegistry = typeof ID_PREFIX_FALLBACK_REGISTRY !== 'undefined' ? ID_PREFIX_FALLBACK_REGISTRY : {};
        const prefix = pkCol.idPrefix || fallbackRegistry[table] || "ID";
        const utils = typeof SheetDB.Utils !== 'undefined' ? SheetDB.Utils : {
          generateId: (p) => p + "-" + Math.random().toString(36).substring(2, 9).toUpperCase()
        };
        generatedId = utils.generateId(prefix);
        data[primaryKey] = generatedId;
      }
    }

    const newRecord = dbGateway.insert(data);
    const createdId = newRecord[primaryKey] || generatedId || "";

    console.log(`[CreateRecordAction] [User: ${this._user ? this._user.username : 'Guest'}] [Table: ${table}] [ID: ${createdId}] [Status: SUCCESS]`);

    return {
      isGenericCrudResult: true,
      payload: {
        message: `Successfully created record in table '${table}' with ID '${createdId}'.`,
        id: createdId,
        record: newRecord
      }
    };
  }
}

class UpdateRecordAction extends BaseAction {
  constructor() {
    super(ActionType.UPDATE);
    this._actionName = "data_update";
  }

  get isGenericCrudResult() { return true; }

  _validate() {
    this._requireParam("payload");
    const payload = this._params.payload;
    if (!payload.table) {
      throw new ActionValidationError("Payload must contain 'table' property.");
    }
    if (payload.id === undefined || payload.id === null || payload.id === "") {
      throw new ActionValidationError("Payload must contain 'id' parameter.");
    }
    if (!payload.data || typeof payload.data !== "object") {
      throw new ActionValidationError("Payload must contain a valid 'data' object.");
    }
    if (!GLOBAL_CRUD_WHITELIST.has(payload.table)) {
      throw new ActionValidationError(`Table '${payload.table}' is not eligible for generic CRUD operations. Please use specialized endpoints.`);
    }
  }

  _authorize() {
    const tableName = this._params.payload.table;
    if (!AuthBridge.checkAccess(this._user, tableName)) {
      throw new ActionAuthorizationError(`Access denied: You are not authorized to update records in '${tableName}'.`);
    }
  }

  handle(requestContext) {
    const { table, id, data } = requestContext.params.payload;

    const record = this._db[table].findById(id);
    if (!record) {
      throw new SheetDB.EntityNotFoundError(table, id, "Category");
    }

    const updatedRecord = this._db[table].update(id, data);

    console.log(`[UpdateRecordAction] [User: ${this._user ? this._user.username : 'Guest'}] [Table: ${table}] [ID: ${id}] [Status: SUCCESS]`);

    return {
      isGenericCrudResult: true,
      payload: {
        message: `Successfully updated record in table '${table}' with ID '${id}'.`,
        id: id,
        record: updatedRecord
      }
    };
  }
}

class DeleteRecordAction extends BaseAction {
  constructor() {
    super(ActionType.DELETE);
    this._actionName = "data_delete";
  }

  get isGenericCrudResult() { return true; }

  _validate() {
    this._requireParam("payload");
    const payload = this._params.payload;
    if (!payload.table) {
      throw new ActionValidationError("Payload must contain 'table' property.");
    }
    if (payload.id === undefined || payload.id === null || payload.id === "") {
      throw new ActionValidationError("Payload must contain 'id' parameter.");
    }
    if (!GLOBAL_CRUD_WHITELIST.has(payload.table)) {
      throw new ActionValidationError(`Table '${payload.table}' is not eligible for generic CRUD operations. Please use specialized endpoints.`);
    }
  }

  _authorize() {
    const tableName = this._params.payload.table;
    if (!AuthBridge.checkAccess(this._user, tableName)) {
      throw new ActionAuthorizationError(`Access denied: You are not authorized to delete records from '${tableName}'.`);
    }
  }

  handle(requestContext) {
    const { table, id } = requestContext.params.payload;

    const record = this._db[table].findById(id);
    if (!record) {
      throw new SheetDB.EntityNotFoundError(table, id, "Category");
    }

    this._db[table].remove(id);

    console.log(`[DeleteRecordAction] [User: ${this._user ? this._user.username : 'Guest'}] [Table: ${table}] [ID: ${id}] [Status: SUCCESS]`);

    return {
      isGenericCrudResult: true,
      payload: {
        message: `Successfully deleted record in table '${table}' with ID '${id}'.`,
        id: id
      }
    };
  }
}

class DeleteManyRecordsAction extends BaseAction {
  constructor() {
    super(ActionType.DELETE);
    this._actionName = "data_delete_many";
  }

  get isGenericCrudResult() { return true; }

  _validate() {
    this._requireParam("payload");
    const payload = this._params.payload;
    if (!payload.table) {
      throw new ActionValidationError("Payload must contain 'table' property.");
    }
    if (!payload.ids || !Array.isArray(payload.ids)) {
      throw new ActionValidationError("Payload must contain 'ids' array parameter.");
    }
    if (payload.ids.length === 0) {
      throw new ActionValidationError("Payload 'ids' array must contain at least one ID.");
    }
    const maxLimit = typeof MAX_DELETE_BATCH_SIZE !== 'undefined' ? MAX_DELETE_BATCH_SIZE : 200;
    if (payload.ids.length > maxLimit) {
      throw new ActionValidationError(`Payload 'ids' array size (${payload.ids.length}) exceeds the maximum limit of ${maxLimit}.`);
    }
    if (this.constructor === DeleteManyRecordsAction) {
      if (!GLOBAL_CRUD_WHITELIST.has(payload.table)) {
        throw new ActionValidationError(`Table '${payload.table}' is not eligible for generic CRUD operations. Please use specialized endpoints.`);
      }
    }
  }

  _authorize() {
    const tableName = this._params.payload.table;
    if (!AuthBridge.checkAccess(this._user, tableName)) {
      throw new ActionAuthorizationError(`Access denied: You are not authorized to delete records from '${tableName}'.`);
    }
  }

  handle(requestContext) {
    // If subclass implements its own handle/execute, execute it (for ConcreteActionsX.js subclasses)
    if (this.constructor !== DeleteManyRecordsAction && typeof this._execute === 'function') {
      const result = this._execute();
      if (result && result.isGenericCrudResult) {
        return result;
      }
      return {
        isGenericCrudResult: true,
        payload: result
      };
    }

    const { table, ids } = requestContext.params.payload;
    const dryRun = requestContext.params.payload.dryRun !== false;

    console.log(`[DeleteManyRecordsAction] Resolving dependencies for table: ${table}. Dry-run: ${dryRun}`);
    const dependencies = this._getDependentTables(table);
    console.log(`[DeleteManyRecordsAction] Found ${dependencies.length} dependent relations: ${JSON.stringify(dependencies)}`);

    const dependencySets = dependencies.map(dep => {
      let depRows = [];
      try {
        if (this._db[dep.table]) {
          depRows = this._db[dep.table].all();
        }
      } catch (e) {
        console.warn(`[DeleteManyRecordsAction] Could not load dependent table '${dep.table}': ${e.message}`);
      }

      const set = new Set();
      depRows.forEach(row => {
        if (row[dep.fk] !== undefined && row[dep.fk] !== null) {
          set.add(String(row[dep.fk]).trim());
        }
      });
      return { table: dep.table, fk: dep.fk, set };
    });

    const targetGateway = this._db[table].gateway;
    const targetPk = targetGateway.primaryKey;
    const allTargetRows = this._db[table].all();
    const targetIdsSet = new Set(allTargetRows.map(row => String(row[targetPk] || "").trim()));

    const safeToQuery = [];
    const skipped = [];
    const failed = {};

    ids.forEach(rawId => {
      const id = String(rawId).trim();

      if (!targetIdsSet.has(id)) {
        skipped.push(id);
        return;
      }

      let violationMsg = null;
      for (let i = 0; i < dependencySets.length; i++) {
        const dep = dependencySets[i];
        if (dep.set.has(id)) {
          violationMsg = `Blocked: Active reference found in dependent table '${dep.table}' (column '${dep.fk}').`;
          break;
        }
      }

      if (violationMsg) {
        failed[id] = violationMsg;
        console.warn(`[DeleteManyRecordsAction] Deletion blocked for ID '${id}': ${violationMsg}`);
      } else {
        safeToQuery.push(id);
      }
    });

    let deletedCount = 0;
    if (!dryRun && safeToQuery.length > 0) {
      console.log(`[DeleteManyRecordsAction] Performing physical deletion of ${safeToQuery.length} records in table '${table}'`);
      deletedCount = this._db[table].deleteMany(safeToQuery);
    } else if (dryRun) {
      console.log(`[DeleteManyRecordsAction] [DRY RUN] Would have deleted ${safeToQuery.length} records in table '${table}': ${JSON.stringify(safeToQuery)}`);
    }

    return {
      isGenericCrudResult: true,
      payload: {
        success: true,
        dryRun: dryRun,
        deletedCount: deletedCount,
        manifest: {
          deleted: safeToQuery,
          skipped: skipped,
          failed: failed
        }
      }
    };
  }

  _getDependentTables(targetTable) {
    const dependencies = [];
    const schema = DATABASE_SCHEMA;

    let targetTableDef = null;
    for (const cat in schema.categories) {
      if (schema.categories[cat].tables[targetTable]) {
        targetTableDef = schema.categories[cat].tables[targetTable];
        break;
      }
    }

    if (!targetTableDef) return dependencies;

    if (targetTableDef.relations) {
      Object.keys(targetTableDef.relations).forEach(relKey => {
        const rel = targetTableDef.relations[relKey];
        if (rel.type === "hasMany" || rel.type === "hasOne") {
          dependencies.push({ table: rel.target, fk: rel.foreignKey });
        }
      });
    }

    for (const cat in schema.categories) {
      const tables = schema.categories[cat].tables;
      for (const tableName in tables) {
        if (tableName === targetTable) continue;
        const tDef = tables[tableName];
        if (tDef.relations) {
          Object.keys(tDef.relations).forEach(relKey => {
            const rel = tDef.relations[relKey];
            if (rel.type === "belongsTo" && rel.target === targetTable) {
              if (!dependencies.some(d => d.table === tableName && d.fk === rel.foreignKey)) {
                dependencies.push({ table: tableName, fk: rel.foreignKey });
              }
            }
          });
        }
      }
    }

    return dependencies;
  }
}

// Bind subclasses to global namespace
globalThis.PingAction = PingAction;
globalThis.RegisterStudentAction = RegisterStudentAction;
globalThis.WithdrawStudentSubjectAction = WithdrawStudentSubjectAction;
globalThis.UpgradeStudentPackageAction = UpgradeStudentPackageAction;
globalThis.VerifyStudentAccessAction = VerifyStudentAccessAction;
globalThis.AddStudentLeadAction = AddStudentLeadAction;
globalThis.DeleteStudentAction = DeleteStudentAction;
globalThis.CreateCourseTypeAction = CreateCourseTypeAction;
globalThis.CreateCourseAction = CreateCourseAction;
globalThis.CreateBatchAction = CreateBatchAction;
globalThis.CreatePackageAction = CreatePackageAction;
globalThis.UpdatePackageAction = UpdatePackageAction;
globalThis.DeletePackageAction = DeletePackageAction;
globalThis.EnrollStudentAction = EnrollStudentAction;
globalThis.CreateBranchAction = CreateBranchAction;
globalThis.CreatePromoCodeAction = CreatePromoCodeAction;
globalThis.ValidatePromoCodeAction = ValidatePromoCodeAction;
globalThis.UserRegisterAction = UserRegisterAction;
globalThis.UserLoginAction = UserLoginAction;
globalThis.UserLogoutAction = UserLogoutAction;
globalThis.StaffOnboardTeacherAction = StaffOnboardTeacherAction;
globalThis.StaffUpdateTeacherAction = StaffUpdateTeacherAction;
globalThis.StaffAssignSubjectsAction = StaffAssignSubjectsAction;
globalThis.StaffSetSalaryConfigAction = StaffSetSalaryConfigAction;
globalThis.StaffMarkAttendanceAction = StaffMarkAttendanceAction;
globalThis.StaffMarkAttendanceBulkAction = StaffMarkAttendanceBulkAction;
globalThis.StaffQueryAttendanceAction = StaffQueryAttendanceAction;
globalThis.StudentMarkAttendanceAction = StudentMarkAttendanceAction;
globalThis.StudentMarkAttendanceBulkAction = StudentMarkAttendanceBulkAction;
globalThis.StudentQueryAttendanceAction = StudentQueryAttendanceAction;
globalThis.CreateTestAction = CreateTestAction;
globalThis.SaveTestMarksBulkAction = SaveTestMarksBulkAction;
globalThis.QueryTestReportAction = QueryTestReportAction;
globalThis.StaffRecordPaymentAction = StaffRecordPaymentAction;
globalThis.StaffAddDocumentAction = StaffAddDocumentAction;
globalThis.InitErpAction = InitErpAction;
globalThis.QueryAction = QueryAction;
globalThis.AdminSystemStatusAction = AdminSystemStatusAction;
globalThis.AdminBootstrapAction = AdminBootstrapAction;
globalThis.AdminGetSchemaAction = AdminGetSchemaAction;
globalThis.AdminAnalyzeTableAction = AdminAnalyzeTableAction;
globalThis.AdminRepairTableAction = AdminRepairTableAction;
globalThis.AdminPeekDataAction = AdminPeekDataAction;
globalThis.AdminCacheAnalyzeAction = AdminCacheAnalyzeAction;
globalThis.AdminPurgeCacheAction = AdminPurgeCacheAction;
globalThis.CreateRecordAction = CreateRecordAction;
globalThis.UpdateRecordAction = UpdateRecordAction;
globalThis.DeleteRecordAction = DeleteRecordAction;
globalThis.DeleteManyRecordsAction = DeleteManyRecordsAction;
