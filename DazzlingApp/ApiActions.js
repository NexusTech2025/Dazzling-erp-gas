/**
 * ==============================================================
 * BaseAction.gs (Production Ready - V2 - Fully Documented)
 * ==============================================================
 *
 * Layer: Application Service Layer
 *
 * Architectural Context:
 * ----------------------------------------------------------------
 * BaseAction represents the formal Application Service boundary
 * between the HTTP transport layer (e.g., GAS doGet/doPost) and
 * the ORM Core layer.
 *
 * This class standardizes how every API action behaves.
 * It enforces:
 *   - Deterministic execution lifecycle
 *   - Strict validation boundary
 *   - Centralized error normalization
 *   - Consistent response envelopes
 *   - ORM-only delegation
 *
 * Why This Exists:
 * ----------------------------------------------------------------
 * Without BaseAction:
 *   - Controller logic grows uncontrollably (switch-case sprawl)
 *   - Response formats become inconsistent
 *   - Error handling becomes fragmented
 *   - Cross-cutting concerns (auth, logging) become scattered
 *
 * With BaseAction:
 *   - All actions follow the same lifecycle
 *   - The system adheres to Clean Architecture principles
 *   - The Application Layer becomes independently extensible
 *
 * Architectural Guarantees:
 * ----------------------------------------------------------------
 * MUST NOT:
 *   - Access Repository directly
 *   - Access TableGateway
 *   - Access SpreadsheetApp
 *   - Instantiate ORM
 *   - Call orm.clear()
 *
 * MUST:
 *   - Treat ORM as execution boundary
 *   - Return structured response envelope
 *   - Normalize all thrown errors
 *
 * Design Pattern:
 * ----------------------------------------------------------------
 * Implements the Template Method Pattern.
 *
 * Concrete actions MUST override:
 *   - _execute()
 *
 * Concrete actions MAY override:
 *   - _validate()
 *   - _authorize()
 *   - _format()
 *
 * run() MUST NEVER be overridden.
 * ==============================================================
 */

/**
 * --------------------------------------------------------------
 * BaseActionError
 * --------------------------------------------------------------
 * Root error type for all Action layer failures.
 *
 * Why This Exists:
 * - Prevents leaking raw system errors
 * - Allows structured error normalization
 * - Establishes Action-layer error boundary
 */
class BaseActionError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = "BaseActionError";
    this.meta = meta;
  }
}

/**
 * --------------------------------------------------------------
 * ValidationError
 * --------------------------------------------------------------
 * Thrown when request parameters fail validation.
 *
 * Purpose:
 * - Explicitly distinguish client input errors
 * - Ensure predictable API error type
 */
class ValidationError extends BaseActionError {
  constructor(message, meta = {}) {
    super(message, meta);
    this.name = "ValidationError";
  }
}

/**
 * --------------------------------------------------------------
 * AuthorizationError
 * --------------------------------------------------------------
 * Reserved for future authentication/authorization layer.
 *
 * Purpose:
 * - Centralize permission failures
 * - Enable role-based extension later
 */
class AuthorizationError extends BaseActionError {
  constructor(message, meta = {}) {
    super(message, meta);
    this.name = "AuthorizationError";
  }
}

/**
 * --------------------------------------------------------------
 * BaseAction
 * --------------------------------------------------------------
 * Abstract base class for all API Actions.
 *
 * Each concrete Action represents one endpoint behavior.
 */
class BaseAction {

  /**
   * Constructor
   * ----------------------------------------------------------
   * Initializes immutable execution context.
   *
   * @param {Object} options
   * @param {ORM} options.orm - Pre-bootstrapped ORM instance
   * @param {Object} options.params - Parsed request parameters
   * @param {BaseModel|null} options.user - Authenticated user model
   * @param {Object} [options.context] - Optional metadata (IP, timestamp, etc.)
   *
   * Architectural Reasoning:
   * - ORM is injected (Inversion of Control)
   * - BaseAction must not create runtime dependencies
   * - Params are frozen to prevent mutation during execution
   * - User is injected for identity-aware logic
   */
  constructor({ orm, params = {}, user = null, context = {} }) {
    if (!orm) {
      throw new BaseActionError("ORM instance is required.");
    }

    if (typeof params !== "object" || Array.isArray(params)) {
      throw new BaseActionError("params must be a plain object.");
    }

    this._orm = orm;
    this._params = Object.freeze({ ...params });
    this._user = user;
    this._context = Object.freeze({ ...context });

    // Action name derived from class name convention
    this._actionName = this.constructor.name.replace("Action", "").toLowerCase();

    // Optional entity reference for response formatting
    this._entity = null;
  }

  /**
   * run()
   * ----------------------------------------------------------
   * Public execution entrypoint.
   *
   * This method orchestrates the full deterministic lifecycle:
   *   1. Validation
   *   2. Authorization (Mandatory hook)
   *   3. Execution
   *   4. Formatting
   *   5. Envelope wrapping
   *
   * Why It Is Final (Do Not Override):
   * - Ensures lifecycle consistency
   * - Prevents bypassing validation or formatting
   * - Centralizes error normalization
   *
   * @returns {Object} Structured API response envelope
   */
  run() {
    try {
      this._validate();
      this._authorize();

      const result = this._execute();
      return this._successEnvelope(this._format(result));

    } catch (error) {
      return this._errorEnvelope(this._normalizeError(error));
    }
  }

  /**
   * _validate()
   * ----------------------------------------------------------
   * Override to validate required parameters.
   *
   * Rules:
   * - Must NOT call ORM
   * - Must NOT fetch data
   * - Must throw ValidationError on failure
   *
   * Purpose:
   * - Separate input validation from business execution
   */
  _validate() {}

  /**
   * _authorize()
   * ----------------------------------------------------------
   * Identity and access control hook.
   *
   * Default behavior: No-op (Public access allowed)
   * Override in concrete actions to enforce security.
   *
   * Intended Usage:
   * - if (!this._user) throw new AuthorizationError("Login required");
   * - if (this._user.get("role") !== "admin") throw new AuthorizationError("Forbidden");
   */
  _authorize() {}

  /**
   * _execute()
   * ----------------------------------------------------------
   * Abstract execution logic.
   *
   * MUST be implemented by concrete action.
   *
   * Expected Behavior:
   * - Call ORM methods
   * - Return BaseModel | Array<BaseModel> | Primitive | null
   *
   * Must NOT:
   * - Format output
   * - Catch errors silently
   * - Return response envelope
   */
  _execute() {
    throw new BaseActionError("_execute() must be implemented by concrete Action.");
  }

  /**
   * _format(result)
   * ----------------------------------------------------------
   * Converts execution result into serializable payload.
   *
   * Handles:
   * - Array<BaseModel>
   * - Single BaseModel
   * - Primitive values
   * - Null values
   *
   * Rationale:
   * - Keep serialization centralized
   * - Guarantee consistent API structure
   */
  _format(result) {
    if (result === null || result === undefined) {
      return { data: null };
    }

    if (Array.isArray(result)) {
      return {
        entity: this._entity || null,
        count: result.length,
        data: result.map(item => this._serialize(item))
      };
    }

    if (typeof result === "object" && typeof result.toJSON === "function") {
      return {
        entity: this._entity || null,
        data: result.toJSON()
      };
    }

    return { data: result };
  }

  /**
   * _serialize(item)
   * ----------------------------------------------------------
   * Internal helper for safe model serialization.
   *
   * Ensures that BaseModel instances are converted
   * using toJSON() before being returned.
   */
  _serialize(item) {
    if (item && typeof item.toJSON === "function") {
      return item.toJSON();
    }
    return item;
  }

  /**
   * _successEnvelope(payload)
   * ----------------------------------------------------------
   * Wraps formatted payload in standardized success structure.
   *
   * Guarantees:
   * - success flag
   * - action name
   */
  _successEnvelope(payload) {
    return {
      success: true,
      action: this._actionName,
      ...payload
    };
  }

  /**
   * _normalizeError(error)
   * ----------------------------------------------------------
   * Converts thrown errors into safe response objects.
   *
   * Prevents leaking stack traces.
   * Ensures predictable error shape.
   */
  _normalizeError(error) {
    if (error instanceof ValidationError) {
      return { type: "ValidationError", message: error.message };
    }

    if (error instanceof AuthorizationError) {
      return { type: "AuthorizationError", message: error.message };
    }

    if (error instanceof BaseActionError) {
      return { type: error.name, message: error.message };
    }

    if (error && error.name) {
      return { type: error.name, message: error.message || "Unexpected error." };
    }

    return { type: "UnknownError", message: "Unexpected system failure." };
  }

  /**
   * _errorEnvelope(errorObject)
   * ----------------------------------------------------------
   * Wraps normalized error in failure response structure.
   */
  _errorEnvelope(errorObject) {
    return {
      success: false,
      action: this._actionName,
      error: errorObject
    };
  }

  /**
   * _requireParam(name)
   * ----------------------------------------------------------
   * Convenience helper to enforce required parameters.
   *
   * @param {string} name - Parameter key
   * @returns {*} Parameter value
   *
   * Throws ValidationError if missing.
   */
  _requireParam(name) {
    const value = this._params[name];

    if (value === undefined || value === null || value === "") {
      throw new ValidationError(`${name} is required.`);
    }

    return value;
  }

  /**
   * _setEntity(entityName)
   * ----------------------------------------------------------
   * Optional helper for tagging entity name in response.
   *
   * Used by concrete actions when operating on specific entity.
   */
  _setEntity(entityName) {
    this._entity = entityName;
  }
}


/**
 * ==============================================================
 * ConcreteActions.gs (Phase 1 - Read API)
 * ==============================================================
 *
 * Layer: Application Service Layer
 *
 * This module defines the Phase‑1 concrete Actions:
 *   - QueryAction
 *   - RetrieveAction
 *   - RelatedQueryAction
 *
 * These actions implement the read-only API surface of the system.
 *
 * Architectural Rules:
 * --------------------------------------------------------------
 * - MUST delegate only to ORM
 * - MUST NOT access Repository directly
 * - MUST NOT access TableGateway or DataSource
 * - MUST NOT interpret relation metadata manually
 * - MUST NOT manage IdentityMap
 *
 * All graph behavior flows through ORM → LazyRelationResolver.
 * ==============================================================
 */

/**
 * --------------------------------------------------------------
 * QueryAction
 * --------------------------------------------------------------
 *
 * Purpose:
 * General entity retrieval.
 *
 * Supports:
 * - Full collection fetch (no filters)
 * - Equality-based filtering (MVP)
 *
 * Expected Params:
 * - entity (required)
 * - filter (optional JSON string or object)
 */
class QueryAction extends BaseAction {

  _validate() {
    const entity = this._requireParam("entity");
    this._setEntity(entity);

    const filter = this._params.filter;

    if (filter !== undefined) {
      if (typeof filter === "string") {
        try {
          JSON.parse(filter);
        } catch (e) {
          throw new ValidationError("filter must be valid JSON string.");
        }
      } else if (typeof filter !== "object") {
        throw new ValidationError("filter must be an object or JSON string.");
      }
    }
  }

  _execute() {
    const entity = this._entity;

    let filterObject = {};

    if (this._params.filter) {
      filterObject = typeof this._params.filter === "string"
        ? JSON.parse(this._params.filter)
        : this._params.filter;
    }

    return this._orm.fetch(entity, filterObject);
  }
}


/**
 * --------------------------------------------------------------
 * RetrieveAction
 * --------------------------------------------------------------
 *
 * Purpose:
 * Retrieve single entity by primary key.
 *
 * Expected Params:
 * - entity (required)
 * - id (required)
 */
class RetrieveAction extends BaseAction {

  _validate() {
    const entity = this._requireParam("entity");
    this._setEntity(entity);

    this._requireParam("id");
  }

  _execute() {
    const entity = this._entity;
    const id = this._params.id;

    return this._orm.findById(entity, id);
  }
}


/**
 * --------------------------------------------------------------
 * RelatedQueryAction
 * --------------------------------------------------------------
 *
 * Purpose:
 * Resolve relation from a source entity instance.
 *
 * This activates the ORM graph layer.
 *
 * Expected Params:
 * - entity (required)
 * - id (required)
 * - relation (required)
 */
class RelatedQueryAction extends BaseAction {

  _validate() {
    const entity = this._requireParam("entity");
    this._setEntity(entity);

    this._requireParam("id");
    this._requireParam("relation");
  }

  _execute() {
    const entity = this._entity;
    const id = this._params.id;
    const relation = this._params.relation;

    const sourceModel = this._orm.findById(entity, id);

    if (!sourceModel) {
      return null;
    }

    const related = this._orm.resolveRelation(sourceModel, relation);

    return related;
  }

  _format(result) {
    const base = super._format(result);

    return {
      relation: this._params.relation,
      ...base
    };
  }
}

/**
 * --------------------------------------------------------------
 * RegisterAction
 * --------------------------------------------------------------
 *
 * Purpose:
 * Atomically create a User and their corresponding Profile.
 *
 * Authorization:
 * - Requires "admin" role.
 *
 * Expected Params (from POST body):
 * - userData { username, password, email, role }
 * - profileData { ... entity specific fields }
 */
class RegisterAction extends BaseAction {

  _authorize() {
    if (!this._user) {
      throw new AuthorizationError("Authentication required to register users.");
    }

    const authService = this._orm.getAuthService();
    if (!authService.hasRole(this._user, "admin")) {
      throw new AuthorizationError("Only administrators can register new users.");
    }
  }

  _validate() {
    const userData = this._requireParam("userData");
    
    if (!userData.username || !userData.password || !userData.role) {
      throw new ValidationError("userData must include username, password, and role.");
    }

    this._requireParam("profileData");
  }

  _execute() {
    const authService = this._orm.getAuthService();
    const userData = this._params.userData;
    const profileData = this._params.profileData;

    // Delegate atomic registration to AuthService
    return authService.register(userData, profileData);
  }
}

/**
 * --------------------------------------------------------------
 * LoginAction
 * --------------------------------------------------------------
 *
 * Purpose:
 * Authenticate user and return session token.
 */
class LoginAction extends BaseAction {

  _validate() {
    this._requireParam("username");
    this._requireParam("password");
  }

  _execute() {
    const authService = this._orm.getAuthService();
    const { username, password } = this._params;

    return authService.login(username, password);
  }

  _format(result) {
    // result contains { token, user }
    return {
      token: result.token,
      user: result.user.toJSON()
    };
  }
}

/**
 * --------------------------------------------------------------
 * LogoutAction
 * --------------------------------------------------------------
 *
 * Purpose:
 * Invalidate active session token.
 */
class LogoutAction extends BaseAction {

  _validate() {
    this._requireParam("token");
  }

  _execute() {
    const authService = this._orm.getAuthService();
    authService.logout(this._params.token);
    return "Logged out successfully.";
  }
}

/**
 * --------------------------------------------------------------
 * BootstrapAdminAction
 * --------------------------------------------------------------
 *
 * Purpose:
 * Secure one-time setup for the very first Admin account.
 * Permanently disables itself once an admin exists.
 */
class BootstrapAdminAction extends BaseAction {

  _authorize() {
    const userRepo = this._orm.getRepository("User");
    
    // Safety: Permanent block if any admin already exists
    if (userRepo.exists({ role: "admin" })) {
      throw new AuthorizationError("System is already initialized. Bootstrap is disabled.");
    }

    // Optional: Secret setup key check from Script Properties
    const setupKey = PropertiesService.getScriptProperties().getProperty("SETUP_KEY");
    if (setupKey && this._params.setupKey !== setupKey) {
      throw new AuthorizationError("Invalid setup key.");
    }
  }

  _validate() {
    const userData = this._requireParam("userData");
    if (!userData.username || !userData.password || !userData.email) {
      throw new ValidationError("userData must include username, password, and email.");
    }

    this._requireParam("profileData");
  }

  _execute() {
    const authService = this._orm.getAuthService();
    
    // Force role to admin for this action
    const userData = {
      ...this._params.userData,
      role: "admin"
    };

    const result = authService.register(userData, this._params.profileData);

    // After successful creation, clear the setup key if it existed
    PropertiesService.getScriptProperties().deleteProperty("SETUP_KEY");

    return result;
  }
}
