/**
 * @file ConcreteActions.js
 * Definitions for all API Endpoints in DazzlingDB.
 */

/**
 * Health Check Action
 */
class PingAction extends BaseAction {
  _execute() {
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
  _validate() {
    this._requireParam("payload");
  }

  _execute() {
    return StudentService.registerStudent(this._params.payload);
  }
}

/**
 * Student Domain: Withdraw a subject from package enrollment
 */
class WithdrawStudentSubjectAction extends BaseAction {
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.student_id || !p.course_id) {
      throw new ActionValidationError("payload must contain 'student_id' and 'course_id'.");
    }
  }

  _execute() {
    return StudentService.processSubjectWithdrawal(this._params.payload.student_id, this._params.payload.course_id);
  }
}

/**
 * Student Domain: Upgrade standalone course enrollments to a package
 */
class UpgradeStudentPackageAction extends BaseAction {
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.student_id || !p.current_enrollment_ids || !p.target_package_id || !p.package_batches) {
      throw new ActionValidationError("payload must contain 'student_id', 'current_enrollment_ids', 'target_package_id', and 'package_batches'.");
    }
  }

  _execute() {
    const { student_id, current_enrollment_ids, target_package_id, package_batches } = this._params.payload;
    return StudentService.upgradeToPackage(student_id, current_enrollment_ids, target_package_id, package_batches);
  }
}

/**
 * Student Domain: Verify class/portal access control
 */
class VerifyStudentAccessAction extends BaseAction {
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.student_id || !p.course_id) {
      throw new ActionValidationError("payload must contain 'student_id' and 'course_id'.");
    }
  }

  _execute() {
    return StudentService.verifyAccess(this._params.payload.student_id, this._params.payload.course_id);
  }
}

/**
 * Student Lead Domain: Add a new student lead
 */
class AddStudentLeadAction extends BaseAction {
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

  _execute() {
    return StudentService.addStudentLead(this._params.payload.leadData);
  }
}

/**
 * Academic Domain: Create CourseType (Segment)
 */
class CreateCourseTypeAction extends BaseAction {
  _validate() {
    this._requireParam("payload");
  }
  _execute() {
    return AcademicService.createCourseType(this._params.payload);
  }
}

/**
 * Academic Domain: Create Course (Subject)
 */
class CreateCourseAction extends BaseAction {
  _validate() {
    this._requireParam("payload");
  }
  _execute() {
    return AcademicService.createCourse(this._params.payload);
  }
}

/**
 * Academic Domain: Create Batch
 */
class CreateBatchAction extends BaseAction {
  _validate() {
    this._requireParam("payload");
  }
  _execute() {
    return AcademicService.createBatch(this._params.payload);
  }
}

/**
 * Academic Domain: Bulk Package Creation
 */
class CreatePackageAction extends BaseAction {
  _validate() {
    this._requireParam("payload");
  }
  _execute() {
    return AcademicService.createPackage(this._params.payload);
  }
}

/**
 * Academic Domain: Package Updates with Polymorphic & Casing Support
 */
class UpdatePackageAction extends BaseAction {
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.package_id) {
      throw new ActionValidationError("Payload must contain 'package_id'.");
    }
  }

  _execute() {
    return AcademicService.updatePackage(this._params.payload);
  }
}

/**
 * Academic Domain: Specialized Package Deletion Action
 */
class DeletePackageAction extends BaseAction {
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.package_id) {
      throw new ActionValidationError("Payload must contain 'package_id'.");
    }
  }

  _execute() {
    return AcademicService.deletePackage(this._params.payload.package_id);
  }
}

/**
 * Academic Domain: Enroll Student
 */
class EnrollStudentAction extends BaseAction {
  _validate() {
    this._requireParam("payload");
  }
  _execute() {
    return AcademicService.enrollStudent(this._params.payload);
  }
}

/**
 * 🛠️ CORE DOMAIN ACTIONS
 */

class CreateBranchAction extends BaseAction {
  _validate() { this._requireParam("payload"); }
  _execute() { return CoreService.createBranch(this._params.payload); }
}

class CreatePromoCodeAction extends BaseAction {
  _validate() { this._requireParam("payload"); }
  _execute() { return CoreService.createPromoCode(this._params.payload); }
}

class ValidatePromoCodeAction extends BaseAction {
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.code || !p.entity_type || !p.entity_id) {
      throw new ActionValidationError("payload must contain 'code', 'entity_type', and 'entity_id'.");
    }
  }
  _execute() {
    const { code, entity_type, entity_id } = this._params.payload;
    return CoreService.validatePromoCode(code, entity_type, entity_id);
  }
}

/**
 * 🔐 AUTH DOMAIN ACTIONS
 */

class UserRegisterAction extends BaseAction {
  _validate() { this._requireParam("payload"); }
  _execute() { return AuthBridge.registerUser(this._params.payload); }
}

class UserLoginAction extends BaseAction {
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.username || !p.password) {
      throw new ActionValidationError("payload must contain 'username' and 'password'.");
    }
  }
  _execute() {
    const { username, password } = this._params.payload;
    return AuthBridge.login(username, password, {});
  }
}

class UserLogoutAction extends BaseAction {
  _execute() {
    const token = this._params.token || (this._params.payload && this._params.payload.token);
    if (!token) throw new ActionValidationError("token is required.");
    return AuthBridge.logout(token);
  }
}

/**
 * 👩‍🏫 STAFF DOMAIN ACTIONS
 */

class StaffOnboardTeacherAction extends BaseAction {
  _validate() { this._requireParam("payload"); }
  _execute() { return StaffService.onboardTeacher(this._params.payload); }
}

class StaffUpdateTeacherAction extends BaseAction {
  _validate() {
    this._requireParam("payload");
    if (!this._params.payload.teacher_id) {
      throw new ActionValidationError("payload must contain 'teacher_id'.");
    }
  }

  _execute() {
    return StaffService.updateTeacher(this._params.payload);
  }
}

class StaffAssignSubjectsAction extends BaseAction {
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.teacher_id || !p.subject_ids) {
      throw new ActionValidationError("payload must contain 'teacher_id' and 'subject_ids'.");
    }
  }
  _execute() {
    const { teacher_id, subject_ids } = this._params.payload;
    return StaffService.assignSubjects(teacher_id, subject_ids);
  }
}

class StaffSetSalaryConfigAction extends BaseAction {
  _validate() { this._requireParam("payload"); }
  _execute() { return StaffService.setSalaryConfig(this._params.payload); }
}

class StaffMarkAttendanceAction extends BaseAction {
  _validate() { this._requireParam("payload"); }
  _execute() { return StaffService.markAttendance(this._params.payload); }
}

class StaffRecordPaymentAction extends BaseAction {
  _validate() { this._requireParam("payload"); }
  _execute() { return StaffService.recordPayment(this._params.payload); }
}

class StaffAddDocumentAction extends BaseAction {
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.teacher_id || !p.document) {
      throw new ActionValidationError("payload must contain 'teacher_id' and 'document'.");
    }
  }
  _execute() {
    const { teacher_id, document } = this._params.payload;
    return StaffService.addDocument(teacher_id, document);
  }
}

/**
 * 🔍 ADVANCED QUERY ENGINE ACTION
 */
class InitErpAction extends BaseAction {
  _validate() {
    this._requireParam("payload");
    if (!this._params.payload || !Array.isArray(this._params.payload.targets)) {
      throw new ActionValidationError("'payload.targets' must be an array of table names or query objects.");
    }
  }

  _execute() {
    var targets = this._params.payload.targets;
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
  _validate() {
    this._requireParam("payload");
    if (!this._params.payload.target) {
      throw new ActionValidationError("Query 'target' table is required.");
    }
  }

  _execute() {
    return QueryEngine.execute(this._params.payload, this._db);
  }
}

/**
 * 🛠️ ADMIN CONTROL CENTER (ACC) ACTIONS
 */

class AdminSystemStatusAction extends BaseAction {
  _execute() {
    return {
      isInitialized: AuthBridge.isSystemInitialized(),
      database: DATABASE_SCHEMA.database,
      version: DATABASE_SCHEMA.version,
      timestamp: new Date().toISOString()
    };
  }
}

class AdminBootstrapAction extends BaseAction {
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

  _execute() {
    const { userData } = this._params.payload;

    console.log("[AdminBootstrapAction] Provisioning physical infrastructure...");
    this._db.setup.provision();

    console.log("[AdminBootstrapAction] Registering superadmin...");
    return AuthBridge.registerUser({
      ...userData,
      role: "admin"
    });
  }
}

class AdminGetSchemaAction extends BaseAction {
  _authorize() {
    if (!this._user || this._user.role !== "admin") {
      throw new ActionAuthorizationError("Superadmin privileges required.");
    }
  }
  _execute() { return DATABASE_SCHEMA; }
}

class AdminAnalyzeTableAction extends BaseAction {
  _authorize() {
    if (!this._user || this._user.role !== "admin") {
      throw new ActionAuthorizationError("Superadmin privileges required.");
    }
  }
  _execute() {
    return this._db.setup.plan();
  }
}

class AdminRepairTableAction extends BaseAction {
  _authorize() {
    if (!this._user || this._user.role !== "admin") {
      throw new ActionAuthorizationError("Superadmin privileges required.");
    }
  }
  _execute() {
    return this._db.setup.provision();
  }
}

class AdminPeekDataAction extends BaseAction {
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
  _execute() {
    const { table } = this._params.payload;
    if (!this._db[table]) throw new ActionValidationError(`Table '${table}' not found.`);

    return this._db[table].where({}, { limit: 5 });
  }
}

class AdminCacheAnalyzeAction extends BaseAction {
  _authorize() {
    if (!this._user || this._user.role !== "admin") {
      throw new ActionAuthorizationError("Superadmin privileges required.");
    }
  }
  _execute() {
    return CacheAnalyzer.getReportData();
  }
}

class AdminPurgeCacheAction extends BaseAction {
  _authorize() {
    if (!this._user || this._user.role !== "admin") {
      throw new ActionAuthorizationError("Superadmin privileges required.");
    }
  }
  _execute() {
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
  constructor(options) {
    super(options);
    this._actionName = "data_create";
  }

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

  _execute() {
    const { table, data } = this._params.payload;
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
      message: `Successfully created record in table '${table}' with ID '${createdId}'.`,
      id: createdId,
      record: newRecord
    };
  }
}

class UpdateRecordAction extends BaseAction {
  constructor(options) {
    super(options);
    this._actionName = "data_update";
  }

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

  _execute() {
    const { table, id, data } = this._params.payload;

    const record = this._db[table].findById(id);
    if (!record) {
      throw new SheetDB.EntityNotFoundError(table, id, "Category");
    }

    const updatedRecord = this._db[table].update(id, data);

    console.log(`[UpdateRecordAction] [User: ${this._user ? this._user.username : 'Guest'}] [Table: ${table}] [ID: ${id}] [Status: SUCCESS]`);

    return {
      message: `Successfully updated record in table '${table}' with ID '${id}'.`,
      id: id,
      record: updatedRecord
    };
  }
}

class DeleteRecordAction extends BaseAction {
  constructor(options) {
    super(options);
    this._actionName = "data_delete";
  }

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

  _execute() {
    const { table, id } = this._params.payload;

    const record = this._db[table].findById(id);
    if (!record) {
      throw new SheetDB.EntityNotFoundError(table, id, "Category");
    }

    this._db[table].remove(id);

    console.log(`[DeleteRecordAction] [User: ${this._user ? this._user.username : 'Guest'}] [Table: ${table}] [ID: ${id}] [Status: SUCCESS]`);

    return {
      message: `Successfully deleted record in table '${table}' with ID '${id}'.`,
      id: id
    };
  }
}

class DeleteManyRecordsAction extends BaseAction {
  constructor(options) {
    super(options);
    this._actionName = "data_delete_many";
  }

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

  _execute() {
    const { table, ids } = this._params.payload;
    // Default dryRun to true unless explicitly set to false
    const dryRun = this._params.payload.dryRun !== false;

    console.log(`[DeleteManyRecordsAction] Resolving dependencies for table: ${table}. Dry-run: ${dryRun}`);
    const dependencies = this._getDependentTables(table);
    console.log(`[DeleteManyRecordsAction] Found ${dependencies.length} dependent relations: ${JSON.stringify(dependencies)}`);

    // 1. Build foreign key Sets for each dependency
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

    // 2. Fetch target table primary keys
    const targetGateway = this._db[table].gateway;
    const targetPk = targetGateway.primaryKey;
    const allTargetRows = this._db[table].all();
    const targetIdsSet = new Set(allTargetRows.map(row => String(row[targetPk] || "").trim()));

    // 3. Evaluate each ID
    const safeToQuery = [];
    const skipped = [];
    const failed = {};

    ids.forEach(rawId => {
      const id = String(rawId).trim();
      
      // Check existence
      if (!targetIdsSet.has(id)) {
        skipped.push(id);
        return;
      }

      // Check relation constraint
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
      success: true,
      dryRun: dryRun,
      deletedCount: deletedCount,
      manifest: {
        deleted: safeToQuery,
        skipped: skipped,
        failed: failed
      }
    };
  }

  /**
   * Identifies all downstream referencing tables and their foreign keys.
   * @private
   */
  _getDependentTables(targetTable) {
    const dependencies = [];
    const schema = DATABASE_SCHEMA;
    
    // Find the target table's category & definition
    let targetTableDef = null;
    for (const cat in schema.categories) {
      if (schema.categories[cat].tables[targetTable]) {
        targetTableDef = schema.categories[cat].tables[targetTable];
        break;
      }
    }
    
    if (!targetTableDef) return dependencies;
    
    // 1. Scan target table's own hasMany/hasOne relations
    if (targetTableDef.relations) {
      Object.keys(targetTableDef.relations).forEach(relKey => {
        const rel = targetTableDef.relations[relKey];
        if (rel.type === "hasMany" || rel.type === "hasOne") {
          dependencies.push({ table: rel.target, fk: rel.foreignKey });
        }
      });
    }
    
    // 2. Scan all other tables in the schema for belongsTo pointing to targetTable
    for (const cat in schema.categories) {
      const tables = schema.categories[cat].tables;
      for (const tableName in tables) {
        if (tableName === targetTable) continue;
        const tDef = tables[tableName];
        if (tDef.relations) {
          Object.keys(tDef.relations).forEach(relKey => {
            const rel = tDef.relations[relKey];
            if (rel.type === "belongsTo" && rel.target === targetTable) {
              // Avoid duplicates
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
