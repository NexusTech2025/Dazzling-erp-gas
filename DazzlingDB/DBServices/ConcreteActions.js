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
    // Note: token is usually passed in the root of the request, not payload, 
    // but we support it in payload for consistency if provided.
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
class QueryAction extends BaseAction {
  _validate() {
    this._requireParam("payload");
    if (!this._params.payload.target) {
      throw new ActionValidationError("Query 'target' table is required.");
    }
  }

  _execute() {
    // Inject the DB instance automatically via BaseAction's this._db
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
    // Check inside payload
    if (this._params.payload.setupKey !== masterKey) {
      throw new SheetDB.ForbiddenError("Invalid Setup Key.");
    }
  }

  _execute() {
    const { userData } = this._params.payload;

    // 1. Physically provision infrastructure (Self-Healing)
    console.log("[AdminBootstrapAction] Provisioning physical infrastructure...");
    this._db.setup.provision();

    // 2. Register the Superadmin
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
    // SchemaSetupEngine.plan() returns the full intent/health check
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
    // SchemaSetupEngine.provision() performs actual repair/creation
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
    
    // Return last 5 rows
    return this._db[table].where({}, { limit: 5 });
  }
}
