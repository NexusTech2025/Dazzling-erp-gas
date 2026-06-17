/**
 * @file BaseActions.js
 * Layer: Application Service Layer (Ported from DazzlingApp)
 */

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

  _validate() { }
  _authorize() { }
  _execute() { throw new BaseActionError("_execute() must be implemented."); }
  _format(result) { return result; }

  _successEnvelope(data) {
    return { success: true, action: this._actionName, data };
  }

  _errorEnvelope(error) {
    return { success: false, action: this._actionName, error };
  }

  _normalizeError(error) {
    const norm = {
      type: error.name || "UnknownError",
      message: error.message || "Internal server error."
    };

    if (error.errorCode) {
      norm.errorCode = error.errorCode;
    }

    // 1. Map details (Validation / Field-level violations)
    if (error.context && error.context.fields) {
      norm.details = error.context;
    } else if (error.details) {
      norm.details = error.details;
    }

    // 2. Map business context (Branch, Session, Role)
    if (error.businessContext) {
      norm.context = error.businessContext;
    } else if (error.context && !error.context.fields) {
      norm.context = error.context;
    }

    // 3. Map system telemetry (Timestamps, Request IDs)
    if (error.meta) {
      norm.meta = error.meta;
    } else if (error.timestamp) {
      norm.meta = { timestamp: error.timestamp };
    }

    return norm;
  }

  _requireParam(name) {
    const val = this._params[name];
    if (val === undefined || val === null || val === "") {
      throw new ActionValidationError(`${name} is required.`);
    }
    return val;
  }
}
