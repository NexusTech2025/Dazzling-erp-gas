/**
 * @file Logger.js
 * Centralized, strategy-based console logger for dazzlingdb-tools diagnostic outputs.
 */

const QuietFormatter = require('./strategies/QuietFormatter');
const VerboseFormatter = require('./strategies/VerboseFormatter');
const DebugFormatter = require('./strategies/DebugFormatter');

class Logger {
  /**
   * Initializes the logger strategy based on verbosity level.
   * @param {number} level - Verbosity level (1, 2, or 3)
   */
  static init(level = 1) {
    if (level === 2) {
      this.strategy = new VerboseFormatter();
    } else if (level === 3) {
      this.strategy = new DebugFormatter();
    } else {
      this.strategy = new QuietFormatter();
    }
  }

  /**
   * Logs a structured event using the active strategy.
   * @param {Object} event - Structured LogEvent
   */
  static logEvent(event) {
    if (!this.strategy) {
      this.init(1);
    }
    this.strategy.format(event);
  }

  // --- Helper Formatting Wrappers ---

  /**
   * Colors text using ANSI escape codes.
   * @param {string} color - cyan | green | yellow | red | magenta | gray
   * @param {string} text 
   * @returns {string} Colorized text
   */
  static colorize(color, text) {
    const codes = {
      cyan: '\x1b[36m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      red: '\x1b[31m',
      magenta: '\x1b[35m',
      gray: '\x1b[90m',
      reset: '\x1b[0m'
    };
    const code = codes[color] || codes.reset;
    return `${code}${text}${codes.reset}`;
  }

  /**
   * Resolves a stylized CLI symbol.
   * @param {string} name - arrow | branch | info | success | warning | error | action
   * @returns {string} Stylized symbol
   */
  static symbol(name) {
    const symbols = {
      arrow: '➤',
      branch: '└──',
      info: 'ℹ️ ',
      success: '✅',
      warning: '⚠️ ',
      error: '❌',
      action: '▶️ '
    };
    return symbols[name] || '';
  }

  // Standard static wrappers
  static info(msg) {
    console.log(`${Logger.colorize('cyan', `${Logger.symbol('info')} [INFO] ${msg}`)}`);
  }

  static success(msg) {
    console.log(`${Logger.colorize('green', `${Logger.symbol('success')} [SUCCESS] ${msg}`)}`);
  }

  static warning(msg) {
    console.log(`${Logger.colorize('yellow', `${Logger.symbol('warning')} [WARNING] ${msg}`)}`);
  }

  static error(msg) {
    console.error(`${Logger.colorize('red', `${Logger.symbol('error')} [ERROR] ${msg}`)}`);
  }

  static action(msg) {
    console.log(`${Logger.colorize('magenta', `${Logger.symbol('action')} [ACTION] ${msg}`)}`);
  }
  
  static detail(msg) {
    console.log(`   ${Logger.colorize('gray', msg)}`);
  }
}

module.exports = Logger;
