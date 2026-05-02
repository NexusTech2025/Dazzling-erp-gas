/**
 * @file ApiDispatcher.js
 * Central Router and Dispatcher for Web Requests.
 */

const ApiDispatcher = (function() {
  
  /**
   * Internal: Returns the map of action keys to classes.
   * Defined as a function to ensure all classes are loaded by GAS before access.
   */
  function _getRegistry() {
    return {
      "ping": PingAction,
      "student_register": RegisterStudentAction,
      "academic_create_course_type": CreateCourseTypeAction,
      "academic_create_course": CreateCourseAction,
      "academic_create_batch": CreateBatchAction,
      "academic_create_package": CreatePackageAction,
      "academic_enroll_student": EnrollStudentAction,
      "core_create_branch": CreateBranchAction,
      "core_create_promo": CreatePromoCodeAction,
      "core_validate_promo": ValidatePromoCodeAction,
      "user_register": UserRegisterAction,
      "user_login": UserLoginAction,
      "user_logout": UserLogoutAction,
      "staff_onboard_teacher": StaffOnboardTeacherAction,
      "staff_assign_subjects": StaffAssignSubjectsAction,
      "staff_set_salary_config": StaffSetSalaryConfigAction,
      "staff_mark_attendance": StaffMarkAttendanceAction,
      "staff_record_payment": StaffRecordPaymentAction,
      "staff_add_document": StaffAddDocumentAction
    };
  }

  /**
   * Main entry point for processing an event.
   * @param {Object} e - GAS event object from doGet or doPost.
   */
  function dispatch(e) {
    let response;
    
    try {
      // 1. Parse Request
      const params = _parseEvent(e);
      const actionKey = params.action;
      const registry = _getRegistry();

      if (!actionKey || !registry[actionKey]) {
        throw new Error(`Endpoint '${actionKey}' is not registered.`);
      }

      // 2. Resolve User Context (Optional for now, required for protected actions)
      const token = params.token;
      const user = token ? AuthService.validateSession(token) : null;

      // 3. Initialize the Action with automatic DB injection
      const ActionClass = registry[actionKey];
      const db = DBContext.getInstance();
      
      const action = new ActionClass({
        db: db,
        params: params,
        user: user
      });

      // 3. Execute
      response = action.run();

    } catch (error) {
      console.error("[ApiDispatcher] Critical Dispatch Error:", error);
      response = {
        success: false,
        error: {
          type: "DispatchError",
          message: error.message
        }
      };
    }

    // 4. Return as JSON
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  }

  /**
   * Internal: Consolidates query parameters and POST body.
   * @private
   */
  function _parseEvent(e) {
    const params = { ...e.parameter };

    // Parse JSON body if present
    if (e.postData && e.postData.contents) {
      try {
        const body = JSON.parse(e.postData.contents);
        Object.assign(params, body);
      } catch (err) {
        console.warn("[ApiDispatcher] Failed to parse JSON body:", err.message);
      }
    }

    return params;
  }

  return {
    dispatch: dispatch
  };

})();
