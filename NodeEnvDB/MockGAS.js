/**
 * @file MockGAS.js
 * Mocks Google Apps Script global services for local Node.js execution.
 */
function mockGAS() {
  global.globalThis = global;
  
  global.PropertiesService = {
    getScriptProperties: () => {
      const store = { ENV: 'TESTING' };
      return {
        getProperty: (key) => store[key] || null,
        setProperty: (key, val) => { store[key] = val; },
        setProperties: (updates) => { Object.assign(store, updates); }
      };
    }
  };

  global.Utilities = {
    getUuid: () => {
      return 'mock-uuid-' + Math.random().toString(36).substr(2, 9);
    }
  };

  global.Logger = {
    log: (...args) => console.log('[GAS Logger]', ...args)
  };

  global.SpreadsheetApp = {
    flush: () => {
      // Mock flush execution
    }
  };

  global.Environment = {
    DEVELOPMENT: 'DEVELOPMENT',
    TESTING: 'TESTING',
    PRODUCTION: 'PRODUCTION'
  };
}

module.exports = { mockGAS };
