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
 * Student Domain: Provision & Link User Credentials to Existing Student
 */
class StudentCreateUserAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE);
    this.requiredRole = Roles.ADMIN;
  }

  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.student_id || typeof p.student_id !== 'string' || !p.student_id.trim()) {
      throw new ActionValidationError("payload must contain a non-empty string 'student_id'.");
    }
    if (!p.userData || typeof p.userData !== 'object' || !p.userData.username || typeof p.userData.username !== 'string' || !p.userData.username.trim() || !p.userData.password || typeof p.userData.password !== 'string' || !p.userData.password) {
      throw new ActionValidationError("payload.userData must contain non-empty 'username' and 'password'.");
    }
  }

  handle(requestContext) {
    const { student_id, userData } = requestContext.params.payload;
    return StudentService.createStudentUser(student_id, userData, requestContext);
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
    const isHard = (this._params?.payload?.mode || "").toLowerCase() === "hard";
    const isForce = this._params?.payload?.force === true;

    if (isHard && isForce) {
      if (!this._user || this._user.role !== "superadmin") {
        throw new ActionAuthorizationError("Access denied: Force hard-deletion requires 'superadmin' privileges.");
      }
    }

    const requiredTables = isHard
      ? ["Student", "Enrollment", "BatchAllocation", "StudentFeeAccount", "Installment", "Address", "ContactInfo", "Education"]
      : ["Student", "Enrollment", "BatchAllocation", "StudentFeeAccount", "Installment"];

    for (let i = 0; i < requiredTables.length; i++) {
      const tableName = requiredTables[i];
      if (!AuthBridge.checkAccess(this._user, tableName)) {
        throw new ActionAuthorizationError(
          `Access denied: User '${this._user ? this._user.username : 'unknown'}' (role: '${this._user ? this._user.role : 'guest'}') lacks authorization for required table '${tableName}'.`
        );
      }
    }
  }

  handle(requestContext) {
    const payload = requestContext.params.payload;
    const mode = (payload.mode || "soft").toLowerCase();
    const service = (typeof StudentService !== 'undefined') ? StudentService : globalThis.StudentService;

    if (mode === "hard") {
      const result = service.hardDeleteStudent(payload, requestContext);
      return {
        success: true,
        message: `Successfully hard-deleted Student '${payload.student_id}'.`,
        data: result
      };
    }

    // Default mode: "soft"
    const result = service.softDeleteStudent(payload, requestContext);
    return {
      success: true,
      message: `Successfully soft-deleted Student '${payload.student_id}'.`,
      data: result
    };
  }
}

/**
 * Students Domain: Delete untouched duplicate student account
 * Endpoint Action Name: "student_delete_untouched"
 */
class DeleteUntouchedStudentAction extends BaseAction {
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
    const requiredTables = ["Student", "Enrollment", "BatchAllocation", "StudentFeeAccount", "Installment", "Address", "ContactInfo", "Education"];
    for (let i = 0; i < requiredTables.length; i++) {
      const tableName = requiredTables[i];
      if (!AuthBridge.checkAccess(this._user, tableName)) {
        throw new ActionAuthorizationError(
          `Access denied: User '${this._user ? this._user.username : 'unknown'}' (role: '${this._user ? this._user.role : 'guest'}') lacks authorization for required table '${tableName}'.`
        );
      }
    }
  }

  handle(requestContext) {
    const payload = requestContext.params.payload;
    const service = (typeof StudentService !== 'undefined') ? StudentService : globalThis.StudentService;
    const result = service.hardDeleteStudent({ ...payload, mode: "hard", force: false }, requestContext);
    return {
      success: true,
      message: `Successfully purged untouched Student '${payload.student_id}'.`,
      data: result
    };
  }
}

globalThis.DeleteUntouchedStudentAction = DeleteUntouchedStudentAction;

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
 * Academic Domain: Update existing administrative enrollment contract and seating allocations.
 */
class UpdateEnrollmentAction extends BaseAction {
  constructor() {
    super(ActionType.UPDATE);
  }

  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.enrollment_id || typeof p.enrollment_id !== "string" || !p.enrollment_id.trim()) {
      throw new ActionValidationError("payload must contain a non-empty string 'enrollment_id'.");
    }
  }

  handle(requestContext) {
    const service = (typeof AcademicEnrollmentService !== 'undefined' && AcademicEnrollmentService.getInstance)
      ? AcademicEnrollmentService.getInstance()
      : globalThis.AcademicEnrollmentService.getInstance();
    return service.updateEnrollment(requestContext.params.payload, requestContext);
  }
}

/**
 * Academic Domain: Soft-delete an enrollment contract with configurable financial settlement.
 * Marks enrollment status as 'discarded', cascades seating allocations to 'dropped',
 * and settles the linked StudentFeeAccount as either refunded or cancelled.
 *
 * @extends BaseAction
 */
class DiscardEnrollmentAction extends BaseAction {
  constructor() {
    super(ActionType.DELETE);
  }

  /**
   * Pre-flight validation: enrollment_id and discard_mode are mandatory.
   * @throws {ActionValidationError} If enrollment_id or discard_mode is invalid.
   */
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.enrollment_id || typeof p.enrollment_id !== "string" || !p.enrollment_id.trim()) {
      throw new ActionValidationError("payload must contain a non-empty string 'enrollment_id'.");
    }
    const allowedModes = ["refund", "no_refund"];
    if (!p.discard_mode || !allowedModes.includes(p.discard_mode)) {
      throw new ActionValidationError("payload must contain 'discard_mode': 'refund' | 'no_refund'.");
    }
  }

  /**
   * Delegates to AcademicEnrollmentService.discardEnrollment().
   * @param {Object} requestContext - Dispatched execution context.
   * @returns {Object} Presentation envelope with settled financial summary.
   */
  handle(requestContext) {
    const service = (typeof AcademicEnrollmentService !== 'undefined' && AcademicEnrollmentService.getInstance)
      ? AcademicEnrollmentService.getInstance()
      : globalThis.AcademicEnrollmentService.getInstance();
    return service.discardEnrollment(requestContext.params.payload, requestContext);
  }
}

/**
 * Academic Domain: Migrate an existing enrollment to a new Package or Course.
 * Closes the old enrollment, rolls over financial obligations (optional),
 * and creates a fresh Enrollment + BatchAllocation + StudentFeeAccount contract.
 *
 * @extends BaseAction
 */
class MigrateEnrollmentAction extends BaseAction {
  constructor() {
    super(ActionType.UPDATE);
  }

  /**
   * Pre-flight validation: enrollment_id, target_type, target_id are mandatory.
   * @throws {ActionValidationError} If required migration parameters are missing.
   */
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.enrollment_id || typeof p.enrollment_id !== "string" || !p.enrollment_id.trim()) {
      throw new ActionValidationError("payload must contain a non-empty string 'enrollment_id'.");
    }
    const allowedTypes = ["course", "package"];
    if (!p.target_type || !allowedTypes.includes(p.target_type)) {
      throw new ActionValidationError("payload must contain 'target_type': 'course' | 'package'.");
    }
    if (!p.target_id || typeof p.target_id !== "string" || !p.target_id.trim()) {
      throw new ActionValidationError("payload must contain a non-empty string 'target_id'.");
    }
  }

  /**
   * Delegates to AcademicEnrollmentService.migrateEnrollment().
   * @param {Object} requestContext - Dispatched execution context.
   * @returns {Object} Presentation envelope with new enrollment contract details.
   */
  handle(requestContext) {
    const service = (typeof AcademicEnrollmentService !== 'undefined' && AcademicEnrollmentService.getInstance)
      ? AcademicEnrollmentService.getInstance()
      : globalThis.AcademicEnrollmentService.getInstance();
    const result = service.migrateEnrollment(requestContext.params.payload, requestContext);
    return result && result.data ? result.data : result;
  }
}

globalThis.UpdateEnrollmentAction = UpdateEnrollmentAction;
globalThis.DiscardEnrollmentAction = DiscardEnrollmentAction;
globalThis.MigrateEnrollmentAction = MigrateEnrollmentAction;




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
 * Auth Domain: Queries user profiles using the database QueryEngine.
 * Enforces superadmin authorization and sanitizes sensitive fields.
 * 
 * @extends BaseAction
 */
class UserQueryAction extends BaseAction {
  constructor() {
    super(ActionType.QUERY);
  }

  /**
   * Validates that payload exists.
   * @throws {ActionValidationError} If payload is missing.
   */
  _validate() {
    this._requireParam("payload");
  }

  /**
   * Restricts access to superadmins only.
   * @throws {ActionAuthorizationError} If user role is not superadmin.
   */
  _authorize() {
    if (!this._user || this._user.role !== Roles.SUPERADMIN) {
      throw new ActionAuthorizationError("Access denied. Superadmin privileges required.");
    }
  }

  /**
   * Executes the query on the User table and sanitizes sensitive credentials.
   * @param {Object} requestContext - Context metadata payload.
   * @returns {Object|Array} Sanitized User record(s) matching criteria.
   */
  handle(requestContext) {
    const payload = { ...requestContext.params.payload, target: "User" };
    const results = QueryEngine.execute(payload, this._db);

    const sanitize = (user) => {
      if (user && typeof user === 'object') {
        delete user.password_hash;
        delete user.password_salt;
      }
      return user;
    };

    if (results && results.data && Array.isArray(results.data)) {
      results.data = results.data.map(sanitize);
    }
    return results;
  }
}

/**
 * Auth Domain: Updates a user record. Supports plaintext password update by rehashing.
 * Enforces superadmin authorization, validates strength, and sanitizes output.
 * 
 * @extends BaseAction
 */
class UserUpdateAction extends BaseAction {
  constructor() {
    super(ActionType.UPDATE);
  }

  /**
   * Validates payload contains identifiers and data payload.
   * @throws {ActionValidationError} If identifier or data is missing.
   */
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.user_id && !p.id) {
      throw new ActionValidationError("Payload must contain 'user_id' or 'id'.");
    }
    if (!p.data || typeof p.data !== "object") {
      throw new ActionValidationError("Payload must contain a valid 'data' object.");
    }
  }

  /**
   * Restricts access to superadmins only.
   * @throws {ActionAuthorizationError} If user role is not superadmin.
   */
  _authorize() {
    if (!this._user || this._user.role !== Roles.SUPERADMIN) {
      throw new ActionAuthorizationError("Access denied. Superadmin privileges required.");
    }
  }

  /**
   * Performs the update on the User entity. Handles password hashing and session termination.
   * @param {Object} requestContext - Context metadata payload.
   * @returns {Object} Update result and updated User details.
   */
  handle(requestContext) {
    const p = requestContext.params.payload;
    const userId = p.user_id || p.id;
    const data = { ...p.data };

    const existingUser = this._db.User.findById(userId);
    if (!existingUser) {
      throw new SheetDB.EntityNotFoundError("User", userId, "Auth");
    }

    // 1. Password change detection and handling
    if (data.password) {
      if (!AuthCore.isStrongPassword(data.password)) {
        throw new ActionValidationError("Password is too weak (minimum 8 characters, with uppercase, lowercase, digit, and special char).");
      }
      const salt = AuthCore.generateSalt();
      data.password_salt = salt;
      data.password_hash = AuthCore.hashPassword(data.password, salt);
      delete data.password;
    }

    // 2. Prevent role demotion of the target user if they are a superadmin and there are no other active superadmins
    if (existingUser.role === Roles.SUPERADMIN && data.role && data.role !== Roles.SUPERADMIN) {
      const allUsers = this._db.User.all();
      const otherSuperAdmins = allUsers.filter(u => u.user_id !== userId && u.role === Roles.SUPERADMIN && u.status === "active");
      if (otherSuperAdmins.length === 0) {
        throw new ActionValidationError("Cannot demote the sole active superadmin.");
      }
    }

    // 3. Prevent locking/disabling the target user if they are the sole active superadmin
    if (existingUser.role === Roles.SUPERADMIN && data.status && data.status !== "active") {
      const allUsers = this._db.User.all();
      const otherSuperAdmins = allUsers.filter(u => u.user_id !== userId && u.role === Roles.SUPERADMIN && u.status === "active");
      if (otherSuperAdmins.length === 0) {
        throw new ActionValidationError("Cannot disable or lock the sole active superadmin.");
      }
    }

    // 4. Terminate sessions if role or status changes
    const roleChanged = data.role && data.role !== existingUser.role;
    const statusChanged = data.status && data.status !== existingUser.status;
    if (roleChanged || statusChanged) {
      const allSessions = this._db.Session.all();
      allSessions.forEach(sess => {
        if (sess.user_id === userId) {
          this._db.Session.remove(sess.session_id);
        }
      });
    }

    // 5. Update user record
    const updatedUser = this._db.User.update(userId, data);
    requestContext.mutationManifest.push("User");

    // 6. Return sanitized updated user record
    const result = { ...updatedUser };
    delete result.password_hash;
    delete result.password_salt;

    return {
      success: true,
      message: `Successfully updated user '${userId}'.`,
      user: result
    };
  }
}

/**
 * Auth Domain: Deletes a single user and cascades deletion to sessions.
 * Enforces superadmin checks, blocks self-deletion, and prevents deleting other superadmins.
 * 
 * @extends BaseAction
 */
class UserDeleteAction extends BaseAction {
  constructor() {
    super(ActionType.DELETE);
  }

  /**
   * Validates target identifier is present.
   * @throws {ActionValidationError} If user_id/id is missing.
   */
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.user_id && !p.id) {
      throw new ActionValidationError("Payload must contain 'user_id' or 'id'.");
    }
  }

  /**
   * Restricts access to superadmins only.
   * @throws {ActionAuthorizationError} If user role is not superadmin.
   */
  _authorize() {
    if (!this._user || this._user.role !== Roles.SUPERADMIN) {
      throw new ActionAuthorizationError("Access denied. Superadmin privileges required.");
    }
  }

  /**
   * Deletes user record and cascade removes user sessions.
   * @param {Object} requestContext - Context metadata payload.
   * @returns {Object} Success response envelope details.
   */
  handle(requestContext) {
    const p = requestContext.params.payload;
    const userId = p.user_id || p.id;
    const selfId = this._user ? this._user.user_id : null;

    if (selfId && userId === selfId) {
      throw new ActionValidationError("Self-deletion is prohibited.");
    }

    const usr = this._db.User.findById(userId);
    if (!usr) {
      throw new SheetDB.EntityNotFoundError("User", userId, "Auth");
    }

    // Prohibit deleting other superadmins to preserve system administration integrity
    if (usr.role === Roles.SUPERADMIN) {
      throw new ActionValidationError("Deleting other superadmins is prohibited.");
    }

    // Cascade delete user sessions
    const allSessions = this._db.Session.all();
    allSessions.forEach(sess => {
      if (sess.user_id === userId) {
        this._db.Session.remove(sess.session_id);
      }
    });

    // Delete user
    this._db.User.remove(userId);
    requestContext.mutationManifest.push("User");

    return {
      success: true,
      message: `Successfully deleted user '${userId}' and cleared all active sessions.`,
      deleted_id: userId
    };
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

/**
 * 👨‍🏫 HR DOMAIN: Provision & Link User Credentials to Existing Teacher
 */
class StaffCreateTeacherUserAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE);
    this.requiredRole = Roles.ADMIN;
  }
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.teacher_id || typeof p.teacher_id !== 'string' || !p.teacher_id.trim()) {
      throw new ActionValidationError("payload must contain a non-empty string 'teacher_id'.");
    }
    if (!p.userData || typeof p.userData !== 'object' || !p.userData.username || typeof p.userData.username !== 'string' || !p.userData.username.trim() || !p.userData.password || typeof p.userData.password !== 'string' || !p.userData.password) {
      throw new ActionValidationError("payload.userData must contain non-empty 'username' and 'password'.");
    }
  }
  handle(requestContext) {
    const { teacher_id, userData } = requestContext.params.payload;
    return StaffService.createTeacherUser(teacher_id, userData, requestContext);
  }
}

/**
 * 🏢 HR DOMAIN: Provision & Link User Credentials to Existing Staff Member
 */
class StaffCreateMemberUserAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE);
    this.requiredRole = Roles.ADMIN;
  }
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.staff_id || typeof p.staff_id !== 'string' || !p.staff_id.trim()) {
      throw new ActionValidationError("payload must contain a non-empty string 'staff_id'.");
    }
    if (!p.userData || typeof p.userData !== 'object' || !p.userData.username || typeof p.userData.username !== 'string' || !p.userData.username.trim() || !p.userData.password || typeof p.userData.password !== 'string' || !p.userData.password) {
      throw new ActionValidationError("payload.userData must contain non-empty 'username' and 'password'.");
    }
  }
  handle(requestContext) {
    const { staff_id, userData } = requestContext.params.payload;
    return StaffService.createStaffMemberUser(staff_id, userData, requestContext);
  }
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

/**
 * Action to retrieve all salary configuration records for a staff member.
 * Operates on QUERY action type.
 */
class StaffGetSalaryConfigsAction extends BaseAction {
  constructor() {
    super(ActionType.QUERY);
  }

  /**
   * Validates that the request payload contains either 'entity_id' or 'teacher_id'.
   * @override
   * @throws {ActionValidationError} If validation parameters are missing.
   */
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.entity_id && !p.teacher_id) {
      throw new ActionValidationError("payload must contain 'entity_id' or 'teacher_id'.");
    }
  }

  /**
   * Resolves the target entity and fetches the corresponding salary configurations.
   * @override
   * @param {RequestContext} requestContext - Context containing request payload details.
   * @returns {Object[]} Array of retrieved salary configuration records.
   */
  handle(requestContext) {
    const p = requestContext.params.payload;
    const entityType = p.entity_type || "Teacher";
    const entityId = p.entity_id || p.teacher_id;
    return StaffService.getSalaryConfigs(entityId, entityType, requestContext);
  }
}


class StaffGetSalaryConfigAction extends BaseAction {
  constructor() {
    super(ActionType.QUERY);
  }
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if ((!p.entity_id && !p.teacher_id) || !p.salary_config_id) {
      throw new ActionValidationError("payload must contain ('entity_id' or 'teacher_id') and 'salary_config_id'.");
    }
  }
  handle(requestContext) {
    const p = requestContext.params.payload;
    const entityType = p.entity_type || "Teacher";
    const entityId = p.entity_id || p.teacher_id;
    return StaffService.getSalaryConfig(entityId, entityType, p.salary_config_id, requestContext);
  }
}

class StaffUpdateSalaryConfigAction extends BaseAction {
  constructor() {
    super(ActionType.UPDATE);
  }
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if ((!p.entity_id && !p.teacher_id) || !p.salary_config_id || !p.data || typeof p.data !== "object") {
      throw new ActionValidationError("payload must contain ('entity_id' or 'teacher_id'), 'salary_config_id', and a 'data' object.");
    }
  }
  handle(requestContext) {
    const p = requestContext.params.payload;
    const entityType = p.entity_type || "Teacher";
    const entityId = p.entity_id || p.teacher_id;
    return StaffService.updateSalaryConfig(entityId, entityType, p.salary_config_id, p.data, requestContext);
  }
}

class StaffDeleteSalaryConfigAction extends BaseAction {
  constructor() {
    super(ActionType.DELETE);
  }
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if ((!p.entity_id && !p.teacher_id) || !p.salary_config_id) {
      throw new ActionValidationError("payload must contain ('entity_id' or 'teacher_id') and 'salary_config_id'.");
    }
  }
  handle(requestContext) {
    const p = requestContext.params.payload;
    const entityType = p.entity_type || "Teacher";
    const entityId = p.entity_id || p.teacher_id;
    return StaffService.deleteSalaryConfig(entityId, entityType, p.salary_config_id, requestContext);
  }
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
 * 📚 ACADEMIC COURSE NOTES ACTIONS
 */
class UploadCourseNoteAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE);
  }
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.course_id || !p.title || !p.file) {
      throw new ActionValidationError("payload must contain 'course_id', 'title', and 'file'.");
    }
  }
  handle(requestContext) {
    return AcademicNotesService.uploadCourseNote(requestContext.params.payload, requestContext);
  }
}

class DeleteCourseNoteAction extends BaseAction {
  constructor() {
    super(ActionType.DELETE);
  }
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.note_id) {
      throw new ActionValidationError("payload must contain 'note_id'.");
    }
  }
  handle(requestContext) {
    return AcademicNotesService.deleteCourseNote(requestContext.params.payload.note_id, requestContext);
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
    const isInitialized = AuthBridge.isSystemInitialized();
    if (!isInitialized) {
      AuthBridge.ensureSetupKeyEmailed();
    }
    return {
      isInitialized: isInitialized,
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

    const masterKey = PropertiesService.getScriptProperties().getProperty("SETUP_KEY");
    if (!masterKey || this._params.payload.setupKey !== masterKey) {
      throw new SheetDB.ForbiddenError("Invalid Setup Key.");
    }
  }

  handle(requestContext) {
    const { userData } = requestContext.params.payload;

    console.log("[AdminBootstrapAction] Provisioning physical infrastructure...");
    this._db.setup.provision();

    console.log("[AdminBootstrapAction] Registering superadmin...");
    const result = AuthBridge.registerUser({
      ...userData,
      role: "superadmin"
    }, requestContext);

    // Clear setup key after successful initialization to prevent reuse
    PropertiesService.getScriptProperties().deleteProperty("SETUP_KEY");

    return result;
  }
}

class AdminGetSchemaAction extends BaseAction {
  constructor() {
    super(ActionType.QUERY);
  }
  _authorize() {
    if (!this._user || (this._user.role !== "admin" && this._user.role !== "superadmin")) {
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
    if (!this._user || (this._user.role !== "admin" && this._user.role !== "superadmin")) {
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
    if (!this._user || (this._user.role !== "admin" && this._user.role !== "superadmin")) {
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
    if (!this._user || (this._user.role !== "admin" && this._user.role !== "superadmin")) {
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
    if (!this._user || (this._user.role !== "admin" && this._user.role !== "superadmin")) {
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
    if (!this._user || (this._user.role !== "admin" && this._user.role !== "superadmin")) {
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

    const tableSchema = SheetDB.SchemaResolver.getTableSchema(this._db, table);
    if (!tableSchema) {
      throw new ActionValidationError(`Table '${table}' schema definition not found.`);
    }

    // Apply Override Policy Boundary (resiliently clears overrides in production)
    AutoKeyField_Override_Policy.evaluate(table, data, this._db, tableSchema);

    const primaryKey = tableSchema.primaryKey;
    const newRecord = dbGateway.insert(data);
    const createdId = newRecord[primaryKey] || "";

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
globalThis.StudentCreateUserAction = StudentCreateUserAction;
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
globalThis.UserQueryAction = UserQueryAction;
globalThis.UserUpdateAction = UserUpdateAction;
globalThis.UserDeleteAction = UserDeleteAction;
globalThis.StaffOnboardTeacherAction = StaffOnboardTeacherAction;
globalThis.StaffCreateTeacherUserAction = StaffCreateTeacherUserAction;
globalThis.StaffCreateMemberUserAction = StaffCreateMemberUserAction;
globalThis.StaffUpdateTeacherAction = StaffUpdateTeacherAction;
globalThis.StaffAssignSubjectsAction = StaffAssignSubjectsAction;
globalThis.StaffSetSalaryConfigAction = StaffSetSalaryConfigAction;
globalThis.StaffGetSalaryConfigsAction = StaffGetSalaryConfigsAction;
globalThis.StaffGetSalaryConfigAction = StaffGetSalaryConfigAction;
globalThis.StaffUpdateSalaryConfigAction = StaffUpdateSalaryConfigAction;
globalThis.StaffDeleteSalaryConfigAction = StaffDeleteSalaryConfigAction;
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
globalThis.UploadCourseNoteAction = UploadCourseNoteAction;
globalThis.DeleteCourseNoteAction = DeleteCourseNoteAction;
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

// ==========================================
// 📊 ADVANCED SHEET OPERATIONS DOMAIN
// ==========================================

/**
 * Action Handler to extract data matrices across spreadsheets.
 * Inherits from BaseAction.
 */
class SheetBatchReadAction extends BaseAction {
  constructor() {
    super(ActionType.QUERY);
  }

  _validate() {
    this._requireParam("payload");
  }

  handle(requestContext) {
    const db = requestContext.db;
    const payload = requestContext.params.payload;
    const options = requestContext.params.options || {};
    const responseKeyType = String(options.responseKey || "ID").toUpperCase(); // "ID" | "NAME"

    const idToResponseKeyMap = {};
    const inverseCache = responseKeyType === "NAME" ? this._getInverseCacheMap() : {};

    const resolvedPayload = payload.map(item => {
      const target = item.spreadsheetId;
      const resolvedId = this._resolveSpreadsheetId(target, db);

      if (responseKeyType === "NAME") {
        const isPhysicalId = /^[a-zA-Z0-9-_]{44}$/.test(target);
        const name = !isPhysicalId ? target : (inverseCache[resolvedId] || resolvedId);
        idToResponseKeyMap[resolvedId] = name;
      } else {
        idToResponseKeyMap[resolvedId] = resolvedId;
      }

      return {
        ...item,
        spreadsheetId: resolvedId
      };
    });

    const orchestrator = new SheetDB.MultiStorageCoordinator();
    const result = orchestrator.fetchDataRanges(
      resolvedPayload,
      options
    );

    // Remap output keys from physical IDs to response keys
    const finalData = {};
    Object.keys(result.data).forEach(resolvedId => {
      const finalKey = idToResponseKeyMap[resolvedId] || resolvedId;
      finalData[finalKey] = result.data[resolvedId];
    });

    return finalData;
  }

  /**
   * Resolves a target string (spreadsheet name or physical ID) to a physical Google Sheet ID
   * @private
   */
  _resolveSpreadsheetId(target, db) {
    // 1. If it's already a valid 44-character physical spreadsheet ID, return it directly
    const isPhysicalId = /^[a-zA-Z0-9-_]{44}$/.test(target);
    if (isPhysicalId) return target;

    // 2. Try looking up in the cache mapping (PropertiesService)
    let cacheMap = {};
    if (typeof PropertiesService !== 'undefined') {
      try {
        const cached = PropertiesService.getScriptProperties().getProperty('DB_FILE_IDS');
        if (cached) {
          cacheMap = JSON.parse(cached);
          if (cacheMap[target]) {
            return cacheMap[target]; // Cache Hit (O(1))
          }
        }
      } catch (err) {
        console.warn(`[SheetBatchReadAction] Failed to parse script properties cache: ${err.message}`);
      }
    }

    // 3. Cache Miss: Query the Drive-based file system (slow query fallback)
    console.log(`[SheetBatchReadAction] Cache miss for category file '${target}'. Fallback to FileSystem search...`);
    const fileMeta = db._fs.findByName(target);
    if (!fileMeta) {
      throw new SheetDB.ResourceNotFoundError(`Target category/spreadsheet file '${target}' was not found in the database directory.`);
    }

    // 4. Update the properties cache payload
    cacheMap[target] = fileMeta.id;
    if (typeof PropertiesService !== 'undefined') {
      try {
        PropertiesService.getScriptProperties().setProperty('DB_FILE_IDS', JSON.stringify(cacheMap));
      } catch (err) {
        console.warn(`[SheetBatchReadAction] Failed to update script properties cache: ${err.message}`);
      }
    }

    return fileMeta.id;
  }

  /**
   * Builds an inverse cache map linking physical IDs back to category names
   * @private
   */
  _getInverseCacheMap() {
    if (typeof PropertiesService === 'undefined') return {};
    try {
      const cached = PropertiesService.getScriptProperties().getProperty('DB_FILE_IDS');
      if (!cached) return {};
      const cacheMap = JSON.parse(cached);
      const inverseMap = {};
      Object.keys(cacheMap).forEach(name => {
        inverseMap[cacheMap[name]] = name;
      });
      return inverseMap;
    } catch (err) {
      console.warn(`[SheetBatchReadAction] Failed to read inverse cache map: ${err.message}`);
      return {};
    }
  }
}

globalThis.SheetBatchReadAction = SheetBatchReadAction;

/**
 * Finance Domain: Fetch all transactional accounting data via Advanced Sheet REST API (MVP Phase)
 */
class GetAccountingDataAction extends BaseAction {
  constructor() {
    super(ActionType.QUERY);
  }

  handle(requestContext) {
    const db = requestContext.db;

    // Resolve the "Finance" spreadsheet workbook file ID
    const financeSpreadsheetId = this._resolveSpreadsheetId("Finance", db);

    const manifest = [
      {
        spreadsheetId: financeSpreadsheetId,
        sheets: ["StudentFeeAccount", "Installment", "Payment", "FeeAdjustment"]
      }
    ];

    const orchestrator = new SheetDB.MultiStorageCoordinator();
    const result = orchestrator.fetchDataRanges(manifest, { driverType: "ADVANCED" });

    // Extract raw sheet matrix results mapping
    const financeData = result.data[financeSpreadsheetId] || {};

    return {
      studentFeeAccounts: financeData.StudentFeeAccount || [],
      installments: financeData.Installment || [],
      payments: financeData.Payment || [],
      feeAdjustments: financeData.FeeAdjustment || []
    };
  }

  /**
   * Helper to resolve category name to spreadsheet file ID
   * @private
   */
  _resolveSpreadsheetId(target, db) {
    const isPhysicalId = /^[a-zA-Z0-9-_]{44}$/.test(target);
    if (isPhysicalId) return target;

    let cacheMap = {};
    if (typeof PropertiesService !== 'undefined') {
      try {
        const cached = PropertiesService.getScriptProperties().getProperty('DB_FILE_IDS');
        if (cached) {
          cacheMap = JSON.parse(cached);
          if (cacheMap[target]) {
            return cacheMap[target];
          }
        }
      } catch (err) {
        console.warn(`[GetAccountingDataAction] Failed to parse script properties cache: ${err.message}`);
      }
    }

    console.log(`[GetAccountingDataAction] Cache miss for category file '${target}'. Fallback to FileSystem search...`);
    const fileMeta = db._fs.findByName(target);
    if (!fileMeta) {
      throw new SheetDB.ResourceNotFoundError(`Target category/spreadsheet file '${target}' was not found in the database directory.`);
    }

    cacheMap[target] = fileMeta.id;
    if (typeof PropertiesService !== 'undefined') {
      try {
        PropertiesService.getScriptProperties().setProperty('DB_FILE_IDS', JSON.stringify(cacheMap));
      } catch (err) {
        console.warn(`[GetAccountingDataAction] Failed to update script properties cache: ${err.message}`);
      }
    }

    return fileMeta.id;
  }
}

globalThis.GetAccountingDataAction = GetAccountingDataAction;

/**
 * Finance Domain: Record Student Payment Transaction
 * 
 * Orchestrates an atomic 3-step payment processing pipeline across Payment, Installment, 
 * and StudentFeeAccount entities leveraging SheetDB.AtomicPipeline for fail-safe transactions.
 */
class RecordPaymentAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE);
  }

  /**
   * Pre-flight input validation step.
   * Manually selects specific validation rules from globalThis.PaymentValidationRules object mapping
   * and executes them via ValidationEngine before transaction initialization.
   */
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;

    // Pick required payment validation rules manually from global object mapping
    const rules = [
      globalThis.PaymentValidationRules.payment_amount_positive,
      globalThis.PaymentValidationRules.payment_method_enum_valid,
      globalThis.PaymentValidationRules.payment_date_format_valid,
      globalThis.PaymentValidationRules.payment_references_required
    ];

    const valCtx = new ValidationContext(DBContext.getInstance(), p.installment_id, p);
    ValidationEngine.run(valCtx, rules);
    if (!valCtx.isValid()) {
      throw new ActionValidationError(`Validation failed: ${valCtx.errors.map(e => e.message).join("; ")}`);
    }
  }

  /**
   * Executes the atomic 3-step student fee payment pipeline using SheetDB.AtomicPipeline.
   * 
   * STEP 1: PAYMENT RECEIPT CREATION
   * - Inserts a new Payment record into the Payment table (PAY-xxx) logging the transaction receipt.
   * 
   * STEP 2: INSTALLMENT SCHEDULE CASCADING REBALANCE
   * - Fetches all installments for the account, sorts by sequence, satisfies the target installment,
   *   and propagates any excess funds down the timeline to subsequent pending installments.
   * 
   * STEP 3: MASTER FEE ACCOUNT REBALANCE
   * - Fetches the parent StudentFeeAccount row (SFA-xxx) and balances global paid vs due metrics.
   * 
   * @param {Object} requestContext - Execution request context supplied by ApiDispatcher.
   * @returns {Object} Compiled transaction summary presentation payload.
   */
  handle(requestContext) {
    const payload = requestContext.params.payload;
    const db = requestContext.db;

    const { student_fee_id, installment_id, amount_paid, payment_method, payment_date, transaction_reference, remarks, created_by } = payload;
    const paymentAmount = Number(amount_paid);

    // Resolves payment date string safely using DazzlingDateTime to prevent cross-realm and timezone shift issues
    let safePaymentDate;
    if (payment_date) {
      const parsed = typeof DazzlingDateTime !== 'undefined' && DazzlingDateTime.safeParseStringToDate
        ? DazzlingDateTime.safeParseStringToDate(String(payment_date))
        : new Date(payment_date);
      safePaymentDate = (parsed && typeof DazzlingDateTime !== 'undefined' && DazzlingDateTime.toSheetSafeValue)
        ? DazzlingDateTime.toSheetSafeValue(parsed)
        : new Date().toISOString();
    } else {
      safePaymentDate = (typeof DazzlingDateTime !== 'undefined' && DazzlingDateTime.toSheetSafeValue)
        ? DazzlingDateTime.toSheetSafeValue(new Date())
        : new Date().toISOString();
    }

    const pipeCtx = new SheetDB.PipelineContext(requestContext);

    // Initialize the Atomic Pipeline transaction engine
    const result = SheetDB.AtomicPipeline.begin(db, pipeCtx)

      /* =========================================================================
       * PIPELINE STEP 1: Insert Payment Receipt Row (Table: Payment)
       * ========================================================================= */
      .addStep("Payment", (repo, state) => {
        console.log(`[RecordPaymentAction] Step 1: Creating Payment Receipt row for Fee Account ${student_fee_id}`);
        const paymentData = {
          student_fee_id,
          installment_id,
          amount_paid: paymentAmount,
          payment_date: safePaymentDate,
          payment_method: payment_method || "upi",
          transaction_reference: transaction_reference || "",
          status: "success",
          remarks: remarks || "",
          created_by: created_by || "System"
        };
        state.newPayment = repo.insert(paymentData);
        console.log(`[RecordPaymentAction] Step 1 complete: Inserted Payment ID ${state.newPayment.payment_id}`);
      })

      /* =========================================================================
       * PIPELINE STEP 2: Update Target & Cascading Installments (Table: Installment)
       * Description: Sells down the balance sequentially across installments.
       * ========================================================================= */
      .addStep("Installment", (repo, state) => {
        console.log(`[RecordPaymentAction] Step 2: Processing allocation for Installment ${installment_id}`);

        const targetInstallment = repo.findById(installment_id);
        if (!targetInstallment) {
          throw new SheetDB.EntityNotFoundError("Installment", installment_id, "Finance");
        }

        // 1. Fetch all installments for this student fee account safely
        let allInstallments = [];
        if (typeof repo.where === 'function') {
          allInstallments = repo.where({ student_fee_id });
        } else if (typeof repo.findAll === 'function') {
          allInstallments = repo.findAll().filter(i => i.student_fee_id === student_fee_id);
        } else {
          allInstallments = [targetInstallment];
        }

        // Sort sequentially by installment number
        allInstallments.sort((a, b) => Number(a.installment_number || 0) - Number(b.installment_number || 0));

        let balanceToAllocate = paymentAmount;

        // 2. Determine target installment's capacity to absorb funds
        const targetCurrentPaid = Number(targetInstallment.paid_amount || 0);
        const targetDue = Number(targetInstallment.due_amount || 0);
        const targetRemaining = Math.max(0, targetDue - targetCurrentPaid);

        let targetAllocation = Math.min(balanceToAllocate, targetRemaining);
        let targetNewPaid = targetCurrentPaid + targetAllocation;
        balanceToAllocate -= targetAllocation;

        // 3. Propagate remaining excess balance to subsequent installments
        if (balanceToAllocate > 0) {
          const targetNum = Number(targetInstallment.installment_number || 0);

          for (const inst of allInstallments) {
            if (Number(inst.installment_number || 0) > targetNum) {
              if (balanceToAllocate <= 0) break;

              const instCurrentPaid = Number(inst.paid_amount || 0);
              const instDue = Number(inst.due_amount || 0);
              const instRemaining = Math.max(0, instDue - instCurrentPaid);

              if (instRemaining > 0) {
                const alloc = Math.min(balanceToAllocate, instRemaining);
                const newPaid = instCurrentPaid + alloc;
                const status = newPaid >= instDue ? "paid" : "partially_paid";

                repo.update(inst.installment_id, {
                  paid_amount: newPaid,
                  status: status
                });

                balanceToAllocate -= alloc;
                console.log(`[RecordPaymentAction] Rolled over ₹${alloc} to Installment ${inst.installment_id}. New Paid: ₹${newPaid}, Status: '${status}'`);
              }
            }
          }
        }

        // 4. If an ultimate excess remains after completely satisfying all downstream obligations,
        // credit it back to the target installment as an overpayment buffer.
        if (balanceToAllocate > 0) {
          targetNewPaid += balanceToAllocate;
        }

        const targetStatus = targetNewPaid >= targetDue ? "paid" : "partially_paid";
        repo.update(installment_id, {
          paid_amount: targetNewPaid,
          status: targetStatus
        });

        state.instStatus = targetStatus;
        state.newInstPaid = targetNewPaid;
        console.log(`[RecordPaymentAction] Step 2 complete: Target Installment ${installment_id} resolved. Final Paid: ₹${targetNewPaid}, Status: '${targetStatus}'`);
      })

      /* =========================================================================
       * PIPELINE STEP 3: Recalculate Master Fee Account Balances (Table: StudentFeeAccount)
       * ========================================================================= */
      .addStep("StudentFeeAccount", (repo, state) => {
        console.log(`[RecordPaymentAction] Step 3: Updating StudentFeeAccount ${student_fee_id}`);
        const feeAccount = repo.findById(student_fee_id);
        if (!feeAccount) {
          throw new SheetDB.EntityNotFoundError("StudentFeeAccount", student_fee_id, "Finance");
        }

        const currentAccPaid = Number(feeAccount.amount_paid || 0);
        const newAccPaid = currentAccPaid + paymentAmount;
        const finalFee = Number(feeAccount.final_fee || 0);
        const newBalance = Math.max(0, finalFee - newAccPaid);
        const accStatus = newBalance === 0 ? "completed" : "active";

        repo.update(student_fee_id, {
          amount_paid: newAccPaid,
          balance_due: newBalance,
          status: accStatus
        });

        state.newBalance = newBalance;
        state.newAccPaid = newAccPaid;
        state.accStatus = accStatus;
        console.log(`[RecordPaymentAction] Step 3 complete: StudentFeeAccount ${student_fee_id} updated. New Balance: ₹${newBalance}, Account Status: '${accStatus}'`);
      })

      /* =========================================================================
       * PIPELINE EXECUTION & PRESENTATION COMPOSITION
       * ========================================================================= */
      .execute(state => ({
        success: true,
        message: "Student payment transaction processed successfully.",
        data: {
          payment_id: state.newPayment.payment_id,
          installment_id,
          student_fee_id,
          amount_paid: paymentAmount,
          balance_due: state.newBalance,
          installment_status: state.instStatus,
          account_status: state.accStatus
        }
      }));

    // Register mutated tables in request context for framework tracking
    requestContext.mutationManifest.push("Payment", "Installment", "StudentFeeAccount");
    return result;
  }
}

globalThis.RecordPaymentAction = RecordPaymentAction;

/**
 * Finance Domain: Reschedule Installment Schedule Action
 * Thin action controller that validates pre-flight parameters and delegates execution
 * to AcademicEnrollmentService.
 */
class RescheduleInstallmentsAction extends BaseAction {
  constructor() {
    super(ActionType.UPDATE);
  }

  /**
   * Pre-flight input parameter validation.
   */
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.student_fee_id || !String(p.student_fee_id).startsWith("SFA-")) {
      throw new ActionValidationError("Valid 'student_fee_id' (SFA-xxx) is required in payload.");
    }
  }

  /**
   * Delegates execution to AcademicEnrollmentService.rescheduleInstallments().
   *
   * @param {Object} requestContext - Execution request context provided by ApiDispatcher.
   * @returns {Object} Presentation success envelope.
   */
  handle(requestContext) {
    const service = (typeof AcademicEnrollmentService !== 'undefined' && AcademicEnrollmentService.getInstance)
      ? AcademicEnrollmentService.getInstance()
      : globalThis.AcademicEnrollmentService.getInstance();
    return service.rescheduleInstallments(requestContext.params.payload, requestContext);
  }
}

globalThis.RescheduleInstallmentsAction = RescheduleInstallmentsAction;

/**
 * Finance Domain: Update Student Fee Account Action
 * Thin action controller that validates pre-flight parameters and delegates execution
 * to AcademicEnrollmentService.updateFeeAccount().
 */
class UpdateFeeAccountAction extends BaseAction {
  constructor() {
    super(ActionType.UPDATE);
  }

  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.student_fee_id || !String(p.student_fee_id).startsWith("SFA-")) {
      throw new ActionValidationError("Valid 'student_fee_id' (SFA-xxx) is required in payload.");
    }
  }

  handle(requestContext) {
    const service = (typeof AcademicEnrollmentService !== 'undefined' && AcademicEnrollmentService.getInstance)
      ? AcademicEnrollmentService.getInstance()
      : globalThis.AcademicEnrollmentService.getInstance();
    return service.updateFeeAccount(requestContext.params.payload, requestContext);
  }
}

/**
 * Finance Domain: Apply Fee Adjustment Action (Scholarship, Coupon, Referral, Manual)
 * Thin action controller that validates pre-flight parameters and delegates execution
 * to AcademicEnrollmentService.adjustFee().
 */
class ApplyFeeAdjustmentAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE);
  }

  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.student_fee_id || !String(p.student_fee_id).startsWith("SFA-")) {
      throw new ActionValidationError("Valid 'student_fee_id' (SFA-xxx) is required in payload.");
    }
    if (!p.amount || isNaN(Number(p.amount)) || Number(p.amount) <= 0) {
      throw new ActionValidationError("Positive numeric 'amount' is required for fee adjustment.");
    }
  }

  handle(requestContext) {
    const service = (typeof AcademicEnrollmentService !== 'undefined' && AcademicEnrollmentService.getInstance)
      ? AcademicEnrollmentService.getInstance()
      : globalThis.AcademicEnrollmentService.getInstance();
    return service.adjustFee(requestContext.params.payload, requestContext);
  }
}

globalThis.UpdateFeeAccountAction = UpdateFeeAccountAction;
globalThis.ApplyFeeAdjustmentAction = ApplyFeeAdjustmentAction;

/**
 * Student Domain: Atomic Profile Update (Upsert across Student, Address, ContactInfo, Education)
 */
class UpdateStudentProfileAction extends BaseAction {
  constructor() {
    super(ActionType.UPDATE);
  }

  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.student_id || !String(p.student_id).startsWith("STU-")) {
      throw new ActionValidationError("Valid 'student_id' (STU-xxx) is required in payload.");
    }
  }

  handle(requestContext) {
    return StudentService.updateStudentProfile(requestContext.params.payload, requestContext);
  }
}

globalThis.UpdateStudentProfileAction = UpdateStudentProfileAction;

/**
 * Admin Action: Triggers a full database backup snapshot.
 * Accessible by SUPERADMIN and ADMIN roles.
 */
class AdminBackupDatabaseAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE);
    this.requiredRoles = [Roles.SUPERADMIN, Roles.ADMIN];
  }

  handle(requestContext) {
    const payload = (requestContext.params && requestContext.params.payload) ? requestContext.params.payload : {};
    const report = BackupService.createSnapshot({
      targetFolderId: payload.targetFolderId,
      sourceFolderId: payload.sourceFolderId,
      label: payload.label,
      excludeCategories: payload.excludeCategories,
      notifyEmail: payload.notifyEmail
    });
    return report;
  }
}

globalThis.AdminBackupDatabaseAction = AdminBackupDatabaseAction;
