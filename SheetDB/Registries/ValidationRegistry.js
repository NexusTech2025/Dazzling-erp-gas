/**
 * @file ValidationRegistry.js
 * Registry for custom schema validation handler functions.
 */

const ValidationRegistry = (function () {
  const registry = new Map();
  let isLocked = false;

  return {
    /**
     * Registers a custom validation handler function.
     * @param {string} name - Unique validation handler name
     * @param {function} handlerFn - Validation function
     */
    register(name, handlerFn) {
      if (isLocked) {
        throw new ValidationRegistryLockedError("register", name);
      }
      if (typeof name !== 'string' || name.trim() === '') {
        throw new ValidatorRegistrationError(name || "N/A", "Validator name must be a non-empty string.");
      }
      if (typeof handlerFn !== 'function') {
        throw new ValidatorRegistrationError(name, "Handler must be a function.");
      }
      if (registry.has(name)) {
        console.warn(`[ValidationRegistry] Warning: Overwriting existing validator handler '${name}'.`);
      }

      registry.set(name, handlerFn);
      console.log(`[ValidationRegistry] Successfully registered handler: ${name}`);
    },

    /**
     * Registers multiple custom validation handler functions at once.
     * @param {Object.<string, function>} handlers - Key-value map of validators
     */
    registerMany(handlers) {
      if (typeof handlers !== 'object' || handlers === null) {
        throw new ValidatorRegistrationError("registerMany", "Expected a key-value object of handlers.");
      }
      for (const [name, handlerFn] of Object.entries(handlers)) {
        this.register(name, handlerFn);
      }
    },

    /**
     * Executes a registered validator safely.
     * @param {string} name - Name of the validator
     * @param {any} value - Value to check
     * @returns {any} Result of validator (null/true if success, error message string if failed)
     */
    execute(name, value, context) {
      const handler = registry.get(name);
      if (!handler) {
        throw new ValidatorNotFoundError(name);
      }

      try {
        return handler(value, context);
      } catch (err) {
        throw new ValidatorExecutionError(name, value, err);
      }
    },

    /**
     * Retrieves a custom validation handler.
     * @param {string} name
     * @returns {function|undefined}
     */
    get(name) {
      return registry.get(name);
    },

    /**
     * Checks if a custom validation handler is registered.
     * @param {string} name
     * @returns {boolean}
     */
    has(name) {
      return registry.has(name);
    },

    /**
     * Locks the registry to prevent runtime tampering.
     */
    lock() {
      isLocked = true;
      console.log("[ValidationRegistry] Registry locked. Mutations are now blocked.");
    },

    /**
     * Unlocks the registry (useful for tests/seeding).
     */
    unlock() {
      isLocked = false;
      console.warn("[ValidationRegistry] Registry unlocked.");
    },

    /**
     * Clears all registered handlers.
     */
    clear() {
      if (isLocked) {
        throw new ValidationRegistryLockedError("clear", "all_handlers");
      }
      registry.clear();
      console.log("[ValidationRegistry] All handlers cleared.");
    }
  };
})();

// Export to Global Namespace
globalThis.ValidationRegistry = ValidationRegistry;
