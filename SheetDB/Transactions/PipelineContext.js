/**
 * @file PipelineContext.js
 * Domain-agnostic transaction execution context interface.
 * Exposes the mandatory contract required by AtomicPipeline for cache manifest synchronization.
 */
class PipelineContext {
  /**
   * Initializes the pipeline context with client metadata.
   * @param {Object} [rawContext={}] - Client-provided application context.
   */
  constructor(rawContext = {}) {
    /**
     * List of repository names mutated during the transaction.
     * @type {Array<string>}
     */
    this.mutationManifest = Array.isArray(rawContext.mutationManifest)
      ? rawContext.mutationManifest
      : [];

    // Safely transfer client-specific metadata dynamically (auth, env, roles)
    Object.keys(rawContext).forEach(key => {
      if (key !== "mutationManifest") {
        this[key] = rawContext[key];
      }
    });
  }

  /**
   * Registers a structural table/repository mutation.
   * @param {string} repositoryName - Uppercase model name.
   * @returns {void}
   */
  trackMutation(repositoryName) {
    if (!this.mutationManifest.includes(repositoryName)) {
      this.mutationManifest.push(repositoryName);
    }
  }
}

globalThis.PipelineContext = PipelineContext;
