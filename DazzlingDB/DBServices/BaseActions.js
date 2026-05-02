/**
 * @file BaseActions.js
 * Layer: Application Service Layer (Ported from DazzlingApp)
 */

/**
 * Root error type for all Action layer failures.
 */
class BaseActionError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = this.constructor.name;
    this.meta = meta;
  }
}

/**
 * Thrown when request parameters fail validation.
 */
class ValidationError extends BaseActionError {}

/**
 * Thrown when access is denied.
 */
class AuthorizationError extends BaseActionError {}

/**
 * Abstract base class for all API Actions.
 */
class BaseAction {
  /**
   * @param {Object} options
   * @param {Object} options.db - The active SheetDB instance
   * @param {Object} options.params - Request parameters
   * @param {Object} [options.user] - Optional auth context
   */
  constructor({ db, params = {}, user = null }) {
    if (!db) throw new BaseActionError("Database instance is required.");
    this._db = db;
    this._params = Object.freeze({ ...params });
    this._user = user;
    this._actionName = this.constructor.name.replace("Action", "").toLowerCase();
  }

  /**
   * Public execution entrypoint.
   */
  run() {
    try {
      this._validate();
      this._authorize();
      const result = this._execute();
      return this._successEnvelope(this._format(result));
    } catch (error) {
      console.error(`[BaseAction] Error in ${this._actionName}:`, error);
      return this._errorEnvelope(this._normalizeError(error));
    }
  }

  _validate() {}
  _authorize() {}
  _execute() { throw new BaseActionError("_execute() must be implemented."); }
  _format(result) { return result; }

  _successEnvelope(data) {
    return { success: true, action: this._actionName, data };
  }

  _errorEnvelope(error) {
    return { success: false, action: this._actionName, error };
  }

  _normalizeError(error) {
    return {
      type: error.name || "UnknownError",
      message: error.message || "Internal server error."
    };
  }

  _requireParam(name) {
    const val = this._params[name];
    if (val === undefined || val === null || val === "") {
      throw new ValidationError(`${name} is required.`);
    }
    return val;
  }
}
