/**
 * @file BaseStrategy.js
 * Abstract formatter strategy for different verbosity levels.
 */

class BaseStrategy {
  /**
   * Format and print the event object.
   * @param {Object} event - Structured LogEvent
   */
  format(event) {
    throw new Error("BaseStrategy.format() must be implemented.");
  }
}

module.exports = BaseStrategy;
