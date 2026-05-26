/**
 * Generic Validation Framework context container.
 */
class ValidationContext {
  /**
   * @param {Object} db - Database instance (DBContext)
   * @param {string|number} entityId - Unique identifier of the entity being validated
   * @param {Object} payload - The input data to validate/sanitize
   */
  constructor(db, entityId, payload) {
    this.db = db;
    this.entityId = entityId;
    this.payload = { ...(payload || {}) };
    this.errors = [];
    this.state = {};
  }

  addError(field, message) {
    this.errors.push({ field, message });
  }

  isValid() {
    return this.errors.length === 0;
  }
}

/**
 * Executes a declarative pipeline of validation and mapping steps.
 */
class ValidationEngine {
  /**
   * Runs an array of rule descriptors sequentially against a validation context
   * @param {ValidationContext} ctx
   * @param {Array<Object>} rules
   * @returns {ValidationContext}
   */
  static run(ctx, rules) {
    for (const rule of rules) {
      const ruleName = rule.name || "anonymous_rule";
      try {
        const passed = rule.validator(ctx);

        if (passed) {
          if (typeof rule.onSuccess === "function") {
            rule.onSuccess(ctx);
          }
        } else {
          if (typeof rule.onError === "function") {
            rule.onError(ctx);
          } else {
            ctx.addError(ruleName, `Validation step failed: ${ruleName}`);
          }

          if (rule.critical) {
            console.warn(`[ValidationEngine] Critical step failed: ${ruleName}. Terminating validation early.`);
            break;
          }
        }
      } catch (err) {
        console.error(`[ValidationEngine] Exception in step "${ruleName}":`, err);
        if (typeof rule.onError === "function") {
          rule.onError(ctx, err);
        } else {
          ctx.addError(ruleName, err.message || String(err));
        }

        if (rule.critical) {
          break;
        }
      }
    }
    return ctx;
  }
}

// Global exports for Google Apps Script execution context
globalThis.ValidationContext = ValidationContext;
globalThis.ValidationEngine = ValidationEngine;
