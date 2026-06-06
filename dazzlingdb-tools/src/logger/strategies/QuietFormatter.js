/**
 * @file QuietFormatter.js
 * Quiet formatter strategy (Level 1 verbosity). Prints only critical events.
 */

const BaseStrategy = require('./BaseStrategy');

class QuietFormatter extends BaseStrategy {
  format(event) {
    // Lazy load Logger to prevent circular dependency
    const Logger = require('../Logger');
    
    // Normalize and map levels
    const level = event.level === 'verbose' || event.level === 'debug' ? null : event.level;
    if (level && typeof Logger[level] === 'function') {
      Logger[level](event.message);
    }
  }
}

module.exports = QuietFormatter;
