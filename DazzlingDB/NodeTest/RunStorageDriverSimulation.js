/**
 * @file RunStorageDriverSimulation.js
 * Standalone Node.js script to run isolated simulation and verify OrchestratedStorageDriverTests.js.
 */

const fs = require('fs');
const path = require('path');

console.log("🚀 STARTING STORAGE DRIVER SIMULATOR RUNNER (NODE.JS)...");

// 1. Mock Google Apps Script Globals
global.globalThis = global;

// Mock SpreadsheetApp
global.SpreadsheetApp = {
  openById: (id) => {
    console.log(`  [SpreadsheetApp Mock] opening spreadsheet: ${id}`);
    if (id.includes("INVALID") || (id !== "1RwtbuO9m1gN8X8kGeDjATnerZVTiCXvWAE-EM0KJUbI" && id !== "1zVWS2FCMtMHcHVadNyZbOvuelOo21Kj1zG-X9iebG_M")) {
      throw new Error(`Spreadsheet not found: target spreadsheet could not be opened for ID ${id}`);
    }
    return {
      getSheets: () => [
        {
          getName: () => "Student",
          getLastRow: () => 3,
          getDataRange: () => ({
            getValues: () => [
              ["student_id", "student_name"],
              ["STU-1", "Alexander Pierce"],
              ["STU-2", "Jane Doe"]
            ]
          })
        },
        {
          getName: () => "Enrollment",
          getLastRow: () => 2,
          getDataRange: () => ({
            getValues: () => [
              ["enrollment_id", "student_id"],
              ["ENR-1", "STU-1"]
            ]
          })
        }
      ],
      getSheetByName: (name) => {
        console.log(`  [SpreadsheetApp Mock] getSheetByName: ${name}`);
        if (name === "Student") {
          return {
            getName: () => "Student",
            getLastRow: () => 3,
            getDataRange: () => ({
              getValues: () => [
                ["student_id", "student_name"],
                ["STU-1", "Alexander Pierce"],
                ["STU-2", "Jane Doe"]
              ]
            })
          };
        }
        if (name === "Enrollment") {
          return {
            getName: () => "Enrollment",
            getLastRow: () => 2,
            getDataRange: () => ({
              getValues: () => [
                ["enrollment_id", "student_id"],
                ["ENR-1", "STU-1"]
              ]
            })
          };
        }
        return null;
      }
    };
  }
};

// Mock Sheets Advanced REST Service
global.Sheets = {
  Spreadsheets: {
    get: (id) => {
      console.log(`  [Sheets API Mock] get metadata for: ${id}`);
      if (id.includes("INVALID") || (id !== "1RwtbuO9m1gN8X8kGeDjATnerZVTiCXvWAE-EM0KJUbI" && id !== "1zVWS2FCMtMHcHVadNyZbOvuelOo21Kj1zG-X9iebG_M")) {
        throw new Error(`API call failed: Spreadsheet not found (404) for ID ${id}`);
      }
      return {
        sheets: [
          { properties: { title: "Student" } },
          { properties: { title: "Enrollment" } }
        ]
      };
    },
    Values: {
      batchGet: (id, options) => {
        console.log(`  [Sheets API Mock] batchGet ranges: ${JSON.stringify(options.ranges)}`);
        if (id.includes("INVALID") || (id !== "1RwtbuO9m1gN8X8kGeDjATnerZVTiCXvWAE-EM0KJUbI" && id !== "1zVWS2FCMtMHcHVadNyZbOvuelOo21Kj1zG-X9iebG_M")) {
          throw new Error(`API call failed: Spreadsheet not found (404) for ID ${id}`);
        }
        return {
          valueRanges: options.ranges.map(range => {
            const name = range.split('!')[0];
            if (name === "Student") {
              return {
                values: [
                  ["student_id", "student_name"],
                  ["STU-1", "=Alexander Pierce"], // Formula Injection Test
                  ["STU-2", "Jane Doe"]
                ]
              };
            }
            if (name === "Enrollment") {
              return {
                values: [
                  ["enrollment_id", "student_id"],
                  ["ENR-1", "STU-1"]
                ]
              };
            }
            return { values: [] };
          })
        };
      }
    }
  }
};

// Mock DBContext & FileSystem
global.DBContext = {
  getInstance: () => ({
    _fs: {
      listAll: () => [
        { id: "1RwtbuO9m1gN8X8kGeDjATnerZVTiCXvWAE-EM0KJUbI", name: "Mock Students" },
        { id: "1zVWS2FCMtMHcHVadNyZbOvuelOo21Kj1zG-X9iebG_M", name: "Mock Academic" }
      ]
    }
  })
};

// 2. Load Source Files via eval
const workspaceRoot = path.resolve(__dirname, '../..');

function loadSourceFile(relativePath) {
  const filePath = path.join(workspaceRoot, relativePath);
  const code = fs.readFileSync(filePath, 'utf8');
  // Evaluate in the global context
  global.eval(code);
}

loadSourceFile('SheetDB/Errors.js');
loadSourceFile('SheetDB/SchemaDriver/MultiStorageCoordinator.js');
loadSourceFile('DazzlingDB/Test/OrchestratedStorageDriverTests.js');

// 3. Execute the benchmark function
try {
  executePolymorphicDriverBenchmark();
  console.log("\n🎉 SIMULATION COMPLETED SUCCESSFULLY! 🎉");
} catch (e) {
  console.error("❌ SIMULATION CRASHED:", e);
  process.exit(1);
}
