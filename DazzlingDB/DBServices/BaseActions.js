/**
 * @file BaseActions.js
 * Layer: Application Service Layer (Ported from DazzlingApp)
 */

/**
 * System-Wide Relational Transaction Action Types (CQS Mandate)
 * @enum {string}
 */
const ActionType = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  QUERY:  'QUERY'
};
Object.freeze(ActionType);

/**
 * System-Wide User Roles
 * @enum {string}
 */
const Roles = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  USER: 'user',
  GUEST: 'guest'
};
Object.freeze(Roles);
globalThis.Roles = Roles;

/**
 * Declarative Registry for mapping database and application errors to structured API responses.
 */
const ErrorMappingRegistry = {
  "ActionValidationError": (error) => ({
    displayCode: "ACTION_VALIDATION_FAILURE",
    clientMessage: error.message,
    errorDetails: error.details
  }),
  "EntityNotFoundError": (error) => ({
    displayCode: "ENTITY_NOT_FOUND",
    clientMessage: error.message,
    errorDetails: error.details || null
  }),
  "ValidationError": (error) => ({
    displayCode: "VALIDATION_FAILURE",
    clientMessage: error.message,
    errorDetails: error.context || null
  }),
  "ConflictError": (error) => ({
    displayCode: "CONFLICT_ERROR",
    clientMessage: error.message,
    errorDetails: error.context || null
  }),
  "IntegrityError": (error) => ({
    displayCode: "INTEGRITY_VIOLATION",
    clientMessage: error.message,
    errorDetails: error.context || null
  }),
  "ForbiddenError": (error) => ({
    displayCode: "FORBIDDEN_ACCESS",
    clientMessage: error.message,
    errorDetails: error.context || null
  }),
  "ResourceNotFoundError": (error) => ({
    displayCode: "RESOURCE_NOT_FOUND",
    clientMessage: error.message,
    errorDetails: error.context || null
  }),
  "PlatformQuotasExhaustedException": (error) => ({
    displayCode: "PLATFORM_QUOTA_BREACH",
    clientMessage: error.message,
    errorDetails: error.context || null
  }),
  "SheetDBEngineError": (error) => ({
    displayCode: "SHEET_DB_ENGINE_FAULT",
    clientMessage: error.message,
    errorDetails: error.context || null
  }),
  "StorageEngineError": (error) => ({
    displayCode: "STORAGE_ENGINE_FAULT",
    clientMessage: error.message,
    errorDetails: error.context || null
  }),
  "AuthAuthenticationError": (error) => ({
    displayCode: "AUTHENTICATION_FAILURE",
    clientMessage: error.message,
    errorDetails: error.details || null
  }),
  "AuthAccountLockedError": (error) => ({
    displayCode: "ACCOUNT_LOCKED",
    clientMessage: error.message,
    errorDetails: error.details || null
  }),
  "ActionAuthorizationError": (error) => ({
    displayCode: "FORBIDDEN_ACCESS",
    clientMessage: error.message,
    errorDetails: error.details || null
  }),
  "PackageOrchestrationError": (error) => ({
    displayCode: "PACKAGE_ORCHESTRATION_FAILURE",
    clientMessage: error.message,
    errorDetails: error.details || null
  }),
  "StudentProfileError": (error) => ({
    displayCode: error.errorCode || "STUDENT_PROFILE_FAILURE",
    clientMessage: error.message,
    errorDetails: error.details || null
  }),
  "AcademicEnrollmentError": (error) => ({
    displayCode: error.errorCode || "ACADEMIC_ENROLLMENT_FAILURE",
    clientMessage: error.message,
    errorDetails: error.details || null
  }),
  "BackupError": (error) => ({
    displayCode: error.errorCode || "DATABASE_BACKUP_FAILURE",
    clientMessage: error.message,
    errorDetails: error.details || error.context || null
  }),
  "UserAccountLinkError": (error) => ({
    displayCode: error.errorCode || "USER_ACCOUNT_LINK_FAILURE",
    clientMessage: error.message,
    errorDetails: error.details || null
  }),
  "CourseNoteError": (error) => ({
    displayCode: error.errorCode || "COURSE_NOTE_FAILURE",
    clientMessage: error.message,
    errorDetails: error.details || null
  }),
  "default": (error) => {
    if (error && error.errorCode) {
      return {
        displayCode: error.errorCode,
        clientMessage: error.message,
        errorDetails: error.details
      };
    }
    return {
      displayCode: "UNHANDLED_SERVER_FAULT",
      clientMessage: "A critical system exception was intercepted during server-side processing.",
      errorDetails: null
    };
  }
};

/**
 * Clean Protocol-Driven Base Action Controller
 */
class BaseAction {
  /**
   * @param {ActionType} actionType - Strict unified transaction parameter token
   */
  constructor(actionType) {
    if (!ActionType[actionType]) {
      throw new SystemError(`Framework Boot Error: Invalid ActionType context [${actionType}] passed to constructor.`);
    }
    this._actionType = actionType;
    this._actionName = this.constructor.name.replace("Action", "").toLowerCase();
  }

  /**
   * Execution Lifecycle Template Method
   */
  run(requestContext) {
    const startTime = Date.now();
    
    // Bind context state metadata
    requestContext.actionType = this._actionType;
    requestContext.mutationManifest = [];
    
    const correlationId = requestContext.headers?.['X-Correlation-ID'] || Utilities.getUuid();
    const environment = resolveEnvironmentType(PropertiesService.getScriptProperties().getProperty('ENV'));

    // Bind parameters to properties for helper methods compatibility
    this._params = requestContext.params;
    this._user = requestContext.user;
    this._db = requestContext.db;

    try {
      this._validate();
      this._authorize();
      // Execute the concrete sub-class business layer logic
      const dataPayload = this.handle(requestContext);
      return this.formatSuccessResponse(dataPayload, startTime, requestContext, environment);

    } catch (error) {
      this._logInternalException(error, correlationId, requestContext);
      return this.formatFailureResponse(error, startTime, correlationId, environment, requestContext);
    }
  }

  /**
   * Concrete subclass validation entrypoint.
   */
  _validate() { }

  /**
   * Concrete subclass authorization entrypoint.
   */
  _authorize() {
    const userRole = this._user ? this._user.role : null;
    if (userRole === 'superadmin') return;

    if (Array.isArray(this.requiredRoles) && this.requiredRoles.length > 0) {
      if (!this.requiredRoles.includes(userRole)) {
        throw new ActionAuthorizationError(`Access denied. Action requires one of roles: [${this.requiredRoles.join(', ')}].`);
      }
      return;
    }

    if (this.requiredRole) {
      if (userRole !== this.requiredRole) {
        throw new ActionAuthorizationError(`Access denied. Action requires '${this.requiredRole}' role.`);
      }
    }
  }

  /**
   * Execution delegate. Can be overridden in concrete subclasses.
   */
  handle(requestContext) {
    if (typeof this._execute === 'function') {
      return this._execute();
    }
    throw new BaseActionError("handle() or _execute() must be implemented.");
  }

  /**
   * Formats successful executions. Omits mutation metrics entirely on read queries.
   */
  formatSuccessResponse(dataPayload, startTime, requestContext, environment) {
    const contextBlock = { "execution_time_ms": Date.now() - startTime };

    if (requestContext.actionType !== ActionType.QUERY) {
      const rawManifest = requestContext?.mutationManifest || [];
      const uniqueMutations = [...new Set(rawManifest)];
      contextBlock.mutated_records_count = uniqueMutations.length;
      contextBlock.mutated_records = uniqueMutations;

      if (dataPayload && typeof dataPayload === 'object' && !Array.isArray(dataPayload) && !dataPayload._presentation) {
        dataPayload._presentation = {
          display_status: dataPayload.status ? this._mapStatusToHumanString(dataPayload.status) : "Success",
          toast_message: "Data transaction committed safely to physical files."
        };
      }
    }

    return {
      "success": true,
      "data": dataPayload,
      "context": contextBlock,
      "meta": { "environment": environment, "version": SYSTEM_VERSION, "timestamp": new Date().toISOString() }
    };
  }

  /**
   * Standardized Failure Envelope Formatter with error masking shielding parameters
   */
  formatFailureResponse(error, startTime, correlationId, environment, requestContext) {
    let resolved = null;

    if (error) {
      const name = error.name;
      if (name && ErrorMappingRegistry[name]) {
        resolved = ErrorMappingRegistry[name](error);
      }
    }

    if (!resolved) {
      resolved = ErrorMappingRegistry.default(error);
    }

    const { displayCode, clientMessage, errorDetails } = resolved;

    const failureEnvelope = {
      "success": false,
      "error": { "code": displayCode, "message": clientMessage, "details": errorDetails },
      "context": {
        "execution_time_ms": Date.now() - startTime,
        "active_transaction_id": requestContext.txId || "NONE",
        "transaction_status": requestContext.txRolledBack ? "ROLLED_BACK" : "FAILED"
      },
      "meta": { "environment": environment, "version": SYSTEM_VERSION, "timestamp": new Date().toISOString(), "correlation_id": correlationId }
    };

    if (environment === Environment.DEVELOPMENT) {
      failureEnvelope.meta.diagnostics = { stack_trace: error.stack ? error.stack.split('\n') : ["No trace captured."] };
    }

    return failureEnvelope;
  }

  _logInternalException(error, correlationId, context) {
    console.error(`[CRITICAL_FAULT] [CID: ${correlationId}] Details: ${JSON.stringify({
      error_name: error.name || "Error",
      message: error.message || "Unknown error",
      action_type: context.actionType,
      action_name: this._actionName || "UnknownAction",
      tables_touched: context.mutationManifest || []
    })}`);
  }

  _mapStatusToHumanString(status) {
    const mappings = { "active": "Fully Enrolled", "dropped": "Withdrawn / Dropped", "upgraded": "Upgraded to Package Plan" };
    return mappings[String(status).toLowerCase()] || status;
  }

  _requireParam(name) {
    const val = this._params[name];
    if (val === undefined || val === null || val === "") {
      throw new ActionValidationError(`${name} is required.`);
    }
    return val;
  }
}

/**
 * Domain Exception for User Account Linking and Identity Provisioning failures.
 */
class UserAccountLinkError extends Error {
  /**
   * @param {string} message - Error description.
   * @param {Object|null} [details=null] - Additional contextual details.
   * @param {string} [errorCode="USER_ACCOUNT_LINK_FAILURE"] - Explicit error code string.
   */
  constructor(message, details = null, errorCode = "USER_ACCOUNT_LINK_FAILURE") {
    super(message);
    this.name = "UserAccountLinkError";
    this.errorCode = errorCode;
    this.details = details;
  }
}

// Bind to global scope for Google Apps Script execution context
globalThis.ActionType = ActionType;
globalThis.BaseAction = BaseAction;
globalThis.UserAccountLinkError = UserAccountLinkError;

