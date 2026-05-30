/**
 * @file ValidationRegistry.js
 * Registry for custom schema validation handler functions.
 */

const ValidationRegistry = (function () {
  const registry = new Map();

  return {
    /**
     * Registers a custom validation handler function.
     * @param {string} name - Unique validation handler name
     * @param {function} handlerFn - Validation function
     */
    register(name, handlerFn) {
      if (typeof handlerFn !== 'function') {
        throw new Error(`Validation handler '${name}' must be a function.`);
      }
      registry.set(name, handlerFn);
      console.log(`[ValidationRegistry] Registered handler: ${name}`);
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
     * Clears all registered handlers.
     */
    clear() {
      registry.clear();
    }
  };
})();
