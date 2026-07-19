/**
 * @file RunSyncPromiseTests.js
 * Standalone Node.js runner to execute SyncPromiseTests.js in a mock Node environment.
 */
const path = require('path');
const { bootstrapVirtualEnv, loadSourceFile } = require(path.resolve(__dirname, '../../NodeEnvDB/setup'));

console.log("🚀 BOOTSTRAPPING VIRTUAL NODE ENVIRONMENT...");
bootstrapVirtualEnv();

console.log("🚀 LOADING SOURCE AND TEST FILES...");
loadSourceFile('SheetDB/Utils/Utils.js');
loadSourceFile('SheetDB/Utils/SyncPromise.js');

// Map global SheetDB facade to satisfy library namespacing used in tests
global.SheetDB = {
  SyncPromise: global.SyncPromise,
  TypeError: global.CircularReferenceError,
  CircularReferenceError: global.CircularReferenceError
};

loadSourceFile('DazzlingDB/Test/SyncPromiseTests.js');

console.log("🚀 RUNNING SYNC PROMISE TEST SUITE...");
try {
  const results = runSyncPromiseTests();
  console.log("🎉 RunSyncPromiseTests execution finished successfully in Node.js!");
  
  // Verify if any scenario failed
  const failed = Object.entries(results).filter(([name, status]) => status.startsWith('❌'));
  if (failed.length > 0) {
    console.error(`❌ Some scenarios failed: ${failed.map(f => f[0]).join(', ')}`);
    process.exit(1);
  }
} catch (e) {
  console.error("❌ RunSyncPromiseTests crashed with error:", e);
  process.exit(1);
}
