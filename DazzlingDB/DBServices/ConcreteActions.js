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
    this._requireParam("code");
    this._requireParam("entity_type");
    this._requireParam("entity_id");
  }
  _execute() {
    const { code, entity_type, entity_id } = this._params;
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
    this._requireParam("username");
    this._requireParam("password");
  }
  _execute() {
    const { username, password } = this._params;
    return AuthBridge.login(username, password, this._context);
  }
}

class UserLogoutAction extends BaseAction {
  _validate() { this._requireParam("token"); }
  _execute() { return AuthBridge.logout(this._params.token); }
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
    this._requireParam("teacher_id");
    this._requireParam("subject_ids");
  }
  _execute() {
    return StaffService.assignSubjects(this._params.teacher_id, this._params.subject_ids);
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
    this._requireParam("teacher_id");
    this._requireParam("document");
  }
  _execute() {
    return StaffService.addDocument(this._params.teacher_id, this._params.document);
  }
}
