/**
 * @file Errors.js
 * Domain-Specific Error Registry for DazzlingDB.
 * Inherits from SheetDB library core for consistency.
 * 
 * Note: Core Library errors (ForbiddenError, ValidationError, etc.) 
 * MUST be accessed via the 'SheetDB' identifier.
 */

/**
 * 🧱 BASE SYSTEM ERROR (Domain Root)
 * Uses a safe fallback if the Library is not loaded.
 */
const BaseError = (typeof SheetDB !== 'undefined') ? SheetDB.SheetDBError : Error;

class SystemError extends BaseError {
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.details = options.details || null;
    this.context = options.context || null;
    this.meta = options.meta || null;
  }
}

/**
 * 🔐 AUTH ERRORS (Unique Business Logic)
 */
class AuthAuthenticationError extends SystemError {}
class AuthAccountLockedError extends AuthAuthenticationError {}

/**
 * 🏛️ ACADEMIC ERRORS
 */
class PackageOrchestrationError extends SystemError {}

/**
 * ⚡ ACTION LAYER ERRORS (UI Compatibility)
 */
class BaseActionError extends SystemError {
  constructor(message, options = {}) {
    super(message, options);
  }
}
class ActionValidationError extends BaseActionError {}
class ActionAuthorizationError extends BaseActionError {}

// Export to Global Namespace
globalThis.SystemError = SystemError;
globalThis.AuthAuthenticationError = AuthAuthenticationError;
globalThis.AuthAccountLockedError = AuthAccountLockedError;
globalThis.PackageOrchestrationError = PackageOrchestrationError;
globalThis.BaseActionError = BaseActionError;
globalThis.ActionValidationError = ActionValidationError;
globalThis.ActionAuthorizationError = ActionAuthorizationError;
