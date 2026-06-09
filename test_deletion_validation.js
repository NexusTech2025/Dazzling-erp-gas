const fs = require('fs');
const path = require('path');

console.log("🧪 Starting Node-Level Deletion Validation Test Runner...\n");

// 1. Load Errors (defines global ValidationError and IntegrityError)
require('./SheetDB/Errors.js');

// 2. Load Graph validation components
require('./SheetDB/Graph/GraphNode.js');
require('./SheetDB/Graph/GraphEdge.js');
require('./SheetDB/Graph/DynamicGraph.js');
require('./SheetDB/Graph/DeletionValidationRegistry.js');

// 3. Set up global SheetDB namespace matching the Apps Script structure
globalThis.SheetDB = {
  Graph: {
    DynamicGraph: globalThis.DynamicGraph,
    GraphNode: globalThis.GraphNode,
    GraphEdge: globalThis.GraphEdge,
    DeletionValidationRegistry: globalThis.DeletionValidationRegistry
  },
  ValidationError: globalThis.ValidationError,
  IntegrityError: globalThis.IntegrityError
};

// 4. Load the test suite globally
const testSuitePath = path.join(__dirname, 'DazzlingDB', 'Test', 'DeletionValidationTestSuite.js');
const testSuiteCode = fs.readFileSync(testSuitePath, 'utf8');
(0, eval)(testSuiteCode);

// 5. Run the test suite
try {
  const results = runDeletionValidationTests();
  
  // Calculate failed counts
  let failed = 0;
  for (const name in results) {
    if (results[name].startsWith("❌")) {
      failed++;
    }
  }

  if (failed > 0) {
    console.error(`\n❌ Node-level test run failed: ${failed} scenarios failed.`);
    process.exit(1);
  } else {
    console.log(`\n🎉 ALL ${Object.keys(results).length} DELETION VALIDATION SCENARIOS PASSED SUCCESSFULLY!`);
    process.exit(0);
  }
} catch (e) {
  console.error("❌ Exception during test runner execution:", e);
  process.exit(1);
}
