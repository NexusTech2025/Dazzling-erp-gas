/**
 * @file VerboseFormatter.js
 * Verbose formatter strategy (Level 2 verbosity). Prints standard flow and summary info.
 */

const BaseStrategy = require('./BaseStrategy');

class VerboseFormatter extends BaseStrategy {
  format(event) {
    // Lazy load Logger to prevent circular dependency
    const Logger = require('../Logger');

    if (event.level === 'verbose') {
      Logger.detail(event.message);
    } else if (event.level === 'debug') {
      // Bypassed in verbose mode
      return;
    } else {
      if (typeof Logger[event.level] === 'function') {
        Logger[event.level](event.message);
      }
    }
  }
}

module.exports = VerboseFormatter;
