/**
 * @file ApiDispatcher.js
 * Central Router and Dispatcher for Web Requests.
 */

const ApiDispatcher = (function () {

  /**
   * Internal: Returns the map of standard action keys to classes.
   */
  function _getStandardRegistry() {
    return {
      "ping": PingAction,
      "student_register": RegisterStudentAction,
      "student_withdraw_subject": WithdrawStudentSubjectAction,
      "student_upgrade_package": UpgradeStudentPackageAction,
      "student_verify_access": VerifyStudentAccessAction,
      "student_add_lead": AddStudentLeadAction,
      "academic_create_course_type": CreateCourseTypeAction,
      "academic_create_course": CreateCourseAction,
      "academic_create_batch": CreateBatchAction,
      "academic_create_package": CreatePackageAction,
      "academic_update_package": UpdatePackageAction,
      "academic_delete_package": DeletePackageAction,
      "academic_enroll_student": EnrollStudentAction,
      "core_create_branch": CreateBranchAction,
      "core_create_promo": CreatePromoCodeAction,
      "core_validate_promo": ValidatePromoCodeAction,
      "user_register": UserRegisterAction,
      "user_login": UserLoginAction,
      "user_logout": UserLogoutAction,
      "staff_onboard_teacher": StaffOnboardTeacherAction,
      "staff_update_teacher": StaffUpdateTeacherAction,
      "staff_assign_subjects": StaffAssignSubjectsAction,
      "staff_set_salary_config": StaffSetSalaryConfigAction,
      "staff_mark_attendance": StaffMarkAttendanceAction,
      "staff_mark_attendance_bulk": StaffMarkAttendanceBulkAction,
      "staff_query_attendance": StaffQueryAttendanceAction,
      "student_mark_attendance": StudentMarkAttendanceAction,
      "student_mark_attendance_bulk": StudentMarkAttendanceBulkAction,
      "student_query_attendance": StudentQueryAttendanceAction,
      "test_create": CreateTestAction,
      "test_save_marks_bulk": SaveTestMarksBulkAction,
      "test_query_report": QueryTestReportAction,
      "staff_record_payment": StaffRecordPaymentAction,
      "staff_add_document": StaffAddDocumentAction,
      "data_query": QueryAction,
      "data_create": CreateRecordAction,
      "data_update": UpdateRecordAction,
      "data_delete": DeleteRecordAction,
      "student_delete": DeleteStudentAction,
      "data_delete_many": DeleteManyRecordsAction,
      "auth_delete_many_users": DeleteManyUsersAction,
      "auth_delete_many_sessions": DeleteManySessionsAction,
      "academic_delete_many_enrollments": DeleteManyEnrollmentsAction,
      "academic_delete_many_packages": DeleteManyPackagesAction,
      "academic_delete_many_courses": DeleteManyCoursesAction,
      "student_delete_many_students": DeleteManyStudentsAction,
      "finance_delete_many_fee_accounts": DeleteManyStudentFeeAccountsAction,
      "finance_delete_many_installments": DeleteManyInstallmentsAction,
      "finance_delete_many_payments": DeleteManyPaymentsAction,
      "finance_delete_many_adjustments": DeleteManyFeeAdjustmentsAction,
      "staff_delete_many_teachers": DeleteManyTeachersAction,
      "academic_delete_many_course_types": DeleteManyCourseTypeAction,
      "init_erp": InitErpAction
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
      "admin_peek_data": AdminPeekDataAction,
      "admin_cache_analyze": AdminCacheAnalyzeAction,
      "admin_purge_cache": AdminPurgeCacheAction,
      "admin_purge_database": PurgeDatabaseAction
    };
  }

  /**
   * Internal: Returns the map of advanced sheet action keys to classes.
   * Scoped for batch spreadsheet operations.
   */
  function _getAdvancedSheetRegistry() {
    return {
      "sheet_batch_read": SheetBatchReadAction,
      "sheet_get_accounting_data": GetAccountingDataAction
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

      // 2. Determine Registry (Admin vs Advanced vs Standard)
      let registry;
      let registryName = "Standard";
      
      if (actionKey.startsWith("admin_")) {
        registry = _getAdminRegistry();
        registryName = "Admin";
      } else if (actionKey.startsWith("sheet_")) {
        registry = _getAdvancedSheetRegistry();
        registryName = "AdvancedSheet";
      } else {
        registry = _getStandardRegistry();
      }

      if (!registry[actionKey]) {
        throw new Error(`Endpoint '${actionKey}' is not registered in ${registryName} registry.`);
      }

      // 3. Resolve User Context
      const token = params.token;
      const user = token ? AuthBridge.resolveContext(token) : null;

      // 4. Initialize the Action
      const ActionClass = registry[actionKey];
      const db = DBContext.getInstance();

      const action = new ActionClass();

      const requestContext = {
        db: db,
        params: params,
        user: user,
        actionName: actionKey,
        headers: {}
      };

      // 5. Execute via Gateway Interceptor
      response = _processGatewayAction(action, requestContext);

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
   * Intercepts generic operations to dynamically deduce the mutation array manifest
   */
  function _processGatewayAction(actionInstance, requestContext) {
    const startTime = Date.now();
    
    try {
      const result = actionInstance.run(requestContext);
      
      // Check if the endpoint executed falls under abstract generic CRUD operations
      if (result && result.isGenericCrudResult) {
        const affectedTable = requestContext.params.table || requestContext.params.target;
        
        // If it's a delete operation, check dryRun
        const payload = requestContext.params.payload || {};
        const isDryRun = payload.dryRun === true || (actionInstance.constructor.name.includes("DeleteMany") && payload.dryRun !== false);
        const computedMutations = (affectedTable && !isDryRun) ? [affectedTable] : [];
        
        return actionInstance.formatSuccessResponse(result.payload, startTime, {
          actionType: requestContext.actionType,
          mutationManifest: computedMutations
        }, resolveEnvironmentType(PropertiesService.getScriptProperties().getProperty('ENV')));
      }
      
      return result;
    } catch (globalError) {
      // Uncaught fallback protection wrapper routing path
      const fallback = new SystemError(globalError.message, { errorCode: "GATEWAY_DISPATCH_CRASH" });
      const activeEnv = (typeof PropertiesService !== 'undefined')
        ? resolveEnvironmentType(PropertiesService.getScriptProperties().getProperty('ENV'))
        : Environment.DEVELOPMENT;
      return actionInstance.formatFailureResponse(fallback, startTime, Utilities.getUuid(), activeEnv, requestContext);
    }
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
