/**
 * @file DebugFormatter.js
 * Debug formatter strategy (Level 3 verbosity). Prints deep trace information and metadata using Logger helpers.
 */

const BaseStrategy = require('./BaseStrategy');

class DebugFormatter extends BaseStrategy {
  format(event) {
    // Lazy load Logger to prevent circular dependency
    const Logger = require('../Logger');

    const debugTag = Logger.colorize('gray', `[DEBUG] [${event.category || 'general'}]`);
    
    let metaStr = '';
    if (event.metadata && Object.keys(event.metadata).length > 0) {
      const branchSym = Logger.colorize('gray', Logger.symbol('branch'));
      metaStr = `\n    ${branchSym} ${Logger.colorize('gray', `Meta: ${JSON.stringify(event.metadata)}`)}`;
    }

    const message = event.message;

    if (event.level === 'error') {
      const errSym = Logger.colorize('red', Logger.symbol('error'));
      const errTag = Logger.colorize('red', '[ERROR]');
      console.error(`\n  ${errSym} ${errTag} ${debugTag} ${Logger.colorize('red', message)}${metaStr}\n`);
    } else if (event.level === 'warning') {
      const warnSym = Logger.colorize('yellow', Logger.symbol('warning'));
      const warnTag = Logger.colorize('yellow', '[WARNING]');
      console.log(`\n  ${warnSym} ${warnTag} ${debugTag} ${Logger.colorize('yellow', message)}${metaStr}\n`);
    } else {
      const arrowSym = Logger.colorize('green', Logger.symbol('arrow'));
      const output = `\n  ${arrowSym} ${debugTag} ${message}${metaStr}\n`;
      console.log(output);
    }
  }
}

module.exports = DebugFormatter;
