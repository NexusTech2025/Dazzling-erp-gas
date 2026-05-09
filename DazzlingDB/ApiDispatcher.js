/**
 * @file ApiDispatcher.js
 * Central Router and Dispatcher for Web Requests.
 */

const ApiDispatcher = (function() {
  
  /**
   * Internal: Returns the map of standard action keys to classes.
   */
  function _getStandardRegistry() {
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
      "staff_add_document": StaffAddDocumentAction,
      "data_query": QueryAction
    };
  }


  /**
   * Internal: Returns the map of administrative action keys to classes.
   * ISOLATED from standard business logic.
   */
  function _getAdminRegistry() {
    return {
      "admin_system_status": AdminSystemStatusAction,
      "admin_bootstrap": AdminBootstrapAction,
      "admin_get_schema": AdminGetSchemaAction,
      "admin_analyze_table": AdminAnalyzeTableAction,
      "admin_repair_table": AdminRepairTableAction,
      "admin_peek_data": AdminPeekDataAction
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

      if (!actionKey) {
        throw new Error("No 'action' parameter provided.");
      }

      // 2. Determine Registry (Admin vs Standard)
      const isAdminAction = actionKey.startsWith("admin_");
      const registry = isAdminAction ? _getAdminRegistry() : _getStandardRegistry();

      if (!registry[actionKey]) {
        throw new Error(`Endpoint '${actionKey}' is not registered in ${isAdminAction ? 'Admin' : 'Standard'} registry.`);
      }

      // 3. Resolve User Context
      const token = params.token;
      const user = token ? AuthBridge.resolveContext(token) : null;

      // 4. Initialize the Action with automatic DB injection
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
