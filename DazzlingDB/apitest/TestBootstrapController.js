/**
 * @file TestBootstrapController.js
 * Path: DazzlingDB/apitest/TestBootstrapController.js
 * Standalone, domain-agnostic Stateful Bootstrap & Environment Controller for DazzlingDB Test Suites.
 * 
 * Provides centralized container warmup tracking, lazy repository bootstrapping,
 * environment variable preservation/restoration, and PrimaryKeyCache override configuration.
 */

var TestBootstrapController = (function () {
  var _isBootstrapped = false;
  var _activeEnv = null;
  var _capturedEnv = null;

  /**
   * Captures and preserves the active script environment from PropertiesService.
   * @returns {string} The captured environment string (e.g. "DEVELOPMENT" or "TESTING").
   */
  function captureEnvironment() {
    if (_capturedEnv !== null) return _capturedEnv;
    _capturedEnv = (typeof PropertiesService !== "undefined" && PropertiesService.getScriptProperties())
      ? (PropertiesService.getScriptProperties().getProperty("ENV") || "DEVELOPMENT")
      : "DEVELOPMENT";
    return _capturedEnv;
  }

  /**
   * Restores the preserved original script environment back into PropertiesService.
   * @param {string} [overrideEnv=null] - Optional explicit environment string to restore.
   */
  function restoreEnvironment(overrideEnv) {
    var target = overrideEnv || _capturedEnv || "DEVELOPMENT";
    if (typeof PropertiesService !== "undefined" && PropertiesService.getScriptProperties()) {
      PropertiesService.getScriptProperties().setProperty("ENV", target);
    }
    _capturedEnv = null;
  }

  /**
   * Guarantees that the DBContext singleton is initialized in the target environment
   * exactly ONCE per execution session unless a forced re-bootstrap is requested.
   *
   * @param {Object} [options={}] - Bootstrap configuration parameters.
   * @param {string} [options.env="TESTING"] - Target environment setting.
   * @param {boolean} [options.allowAutoOverride=true] - Enable primary key override policy on DBContext config.
   * @param {boolean} [options.force=false] - Force explicit container re-bootstrapping even if already warm.
   * @returns {Object} The active DBContext singleton instance.
   * @throws {Error} If DBContext or PropertiesService execution boundaries fail.
   */
  function ensureBootstrapped(options) {
    options = options || {};
    var targetEnv = options.env || "TESTING";
    var setOverride = options.allowAutoOverride !== false;
    var force = options.force === true;

    // 1. Warm Container Check - Return existing instance if already warm in target env
    if (_isBootstrapped && _activeEnv === targetEnv && !force) {
      var existingDb = DBContext.getInstance();
      if (setOverride && existingDb._config) {
        existingDb._config.allowAutoOverride = true;
      }
      return existingDb;
    }

    // 2. Lock Target Environment
    if (typeof PropertiesService !== "undefined" && PropertiesService.getScriptProperties()) {
      PropertiesService.getScriptProperties().setProperty("ENV", targetEnv);
    }

    // 3. Initialize / Bootstrap Singleton
    var db = DBContext.getInstance();
    db.bootstrapRepositories();

    // 4. Update Internal Stateful Flags
    _isBootstrapped = true;
    _activeEnv = targetEnv;

    if (setOverride && db._config) {
      db._config.allowAutoOverride = true;
    }

    return db;
  }

  /**
   * Resets internal bootstrap state tracking.
   * Call when full database purge or teardown invalidates existing dynamic repositories.
   */
  function invalidate() {
    _isBootstrapped = false;
    _activeEnv = null;
  }

  /**
   * Returns current container bootstrap status.
   * @returns {boolean} True if DBContext container is warm and bootstrapped.
   */
  function isBootstrapped() {
    return _isBootstrapped;
  }

  return {
    captureEnvironment: captureEnvironment,
    restoreEnvironment: restoreEnvironment,
    ensureBootstrapped: ensureBootstrapped,
    invalidate: invalidate,
    isBootstrapped: isBootstrapped
  };
})();

// Global Apps Script Context Export
if (typeof globalThis !== "undefined") {
  globalThis.TestBootstrapController = TestBootstrapController;
}
