/**
 * @file RunAdvancedSheetActionsSimulation.js
 * Standalone Node.js script to run and verify AdvancedSheetActionsTests.js.
 */

const fs = require('fs');
const path = require('path');

console.log("🚀 STARTING ADVANCED SHEET ACTIONS SIMULATOR RUNNER (NODE.JS)...");

// 1. Mock Google Apps Script Globals
global.globalThis = global;

// Mock ContentOutput object returned by ContentService
class TextOutput {
  constructor(content) {
    this.content = content;
    this.mimeType = "";
  }
  setMimeType(mime) {
    this.mimeType = mime;
    return this;
  }
  getContent() {
    return this.content;
  }
}

global.ContentService = {
  MimeType: {
    JSON: "application/json"
  },
  createTextOutput: (text) => new TextOutput(text)
};

// Mock SpreadsheetApp
global.SpreadsheetApp = {
  openById: (id) => {
    console.log(`  [SpreadsheetApp Mock] opening spreadsheet: ${id}`);
    return {
      getSheets: () => [
        {
          getName: () => "Address",
          getLastRow: () => 2,
          getDataRange: () => ({
            getValues: () => [
              ["address_id", "student_id"],
              ["ADR-1", "STU-1"]
            ]
          })
        }
      ]
    };
  }
};

// Mock Sheets Advanced REST Service
global.Sheets = {
  Spreadsheets: {
    Values: {
      batchGet: (id, options) => {
        console.log(`  [Sheets API Mock] batchGet ranges: ${JSON.stringify(options.ranges)}`);
        return {
          valueRanges: options.ranges.map(range => ({
            values: [
              ["address_id", "student_id"],
              ["ADR-1", "STU-1"]
            ]
          }))
        };
      }
    }
  }
};

global.PropertiesService = {
  getScriptProperties: () => ({
    getProperty: (key) => "development"
  })
};

global.Utilities = {
  getUuid: () => 'mock-uuid-1234'
};

// Mock DBContext & FileSystem
global.DBContext = {
  getInstance: () => ({
    _fs: {
      listAll: () => [
        { id: "1RwtbuO9m1gN8X8kGeDjATnerZVTiCXvWAE-EM0KJUbI", name: "Mock Students" }
      ]
    }
  })
};

// 2. Load Source Files via eval
const workspaceRoot = path.resolve(__dirname, '../..');

function loadSourceFile(relativePath) {
  const filePath = path.join(workspaceRoot, relativePath);
  const code = fs.readFileSync(filePath, 'utf8');
  global.eval(code);
}

loadSourceFile('SheetDB/Errors.js');
loadSourceFile('SheetDB/SchemaDriver/MultiStorageCoordinator.js');

// Establish namespace redirect for SheetDB library cross-checking in DazzlingDB
global.SheetDB = global;

loadSourceFile('DazzlingDB/Config.js');
loadSourceFile('DazzlingDB/Errors.js');
loadSourceFile('DazzlingDB/DBServices/BaseActions.js');
loadSourceFile('DazzlingDB/DBServices/AdvancedSheetActions.js');
loadSourceFile('DazzlingDB/ApiDispatcher.js');
loadSourceFile('DazzlingDB/Test/AdvancedSheetActionsTests.js');

// 3. Execute the dispatcher test suite
try {
  runAdvancedSheetActionsTests();
  console.log("\n🎉 ADVANCED SHEET ACTIONS SIMULATION COMPLETED SUCCESSFULLY! 🎉");
} catch (e) {
  console.error("❌ SIMULATION CRASHED:", e);
  process.exit(1);
}
