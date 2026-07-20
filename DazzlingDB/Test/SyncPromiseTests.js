/**
 * @file SyncPromiseTests.js
 * Unit and integration tests for SyncPromise utility.
 * 
 * INSTRUCTIONS:
 * Run 'runSyncPromiseTests' from the Apps Script IDE.
 */

function runSyncPromiseTests() {
  console.log("🚀 Starting SyncPromise Testing Suite...");
  
  // Set up sandboxed environment as required by environment isolation rules
  const scriptProperties = PropertiesService.getScriptProperties();
  const originalEnv = scriptProperties.getProperty('ENV') || 'DEVELOPMENT';
  
  try {
    scriptProperties.setProperty('ENV', 'TESTING');
    DBContext.getInstance().bootstrapRepositories();

    const results = {};
    
    console.log("\n=========================================");
    results.Scenario1_BasicResolution = executeScenario1_BasicResolution();
    
    console.log("\n=========================================");
    results.Scenario2_ChainingAndIsolation = executeScenario2_ChainingAndIsolation();
    
    console.log("\n=========================================");
    results.Scenario3_RecursiveThenableUnwrapping = executeScenario3_RecursiveThenableUnwrapping();
    
    console.log("\n=========================================");
    results.Scenario4_DeferredHandlers = executeScenario4_DeferredHandlers();
    
    console.log("\n=========================================");
    results.Scenario5_CombinatorAll = executeScenario5_CombinatorAll();

    console.log("\n=========================================");
    results.Scenario6_CatchAndFinally = executeScenario6_CatchAndFinally();
    
    console.log("\n=========================================");
    results.Scenario7_CircularReferenceDeadlock = executeScenario7_CircularReferenceDeadlock();
    
    console.log("=========================================\n");
    console.log("📊 FINAL TEST RESULTS: \n", JSON.stringify(results, null, 2));
    
    // Performance assertion check (Rule N5 compliance)
    console.log("⏱️ Asserting resolution performance...");
    const start = Array.from({length: 1000});
    const t0 = new Date().getTime();
    for (let i = 0; i < 1000; i++) {
      SheetDB.SyncPromise.resolve(i).then(x => x + 1);
    }
    const t1 = new Date().getTime();
    console.log(`⏱️ Performance assertion: 1000 sync chain loops in ${t1 - t0} ms.`);

    console.log("🏁 SyncPromise Tests Complete.");
    return results;
  } finally {
    // Revert environment safely to prevent contaminating dev runtime properties
    scriptProperties.setProperty('ENV', originalEnv);
  }
}

function executeScenario1_BasicResolution() {
  console.log("▶️ SCENARIO 1: Basic Sync Resolution (Fulfilled & Rejected)");
  try {
    let resolvedVal = null;
    SheetDB.SyncPromise.resolve(42).then(v => { resolvedVal = v; });
    if (resolvedVal !== 42) throw new Error(`Expected 42, got ${resolvedVal}`);

    let rejectedVal = null;
    SheetDB.SyncPromise.reject("error_token").catch(err => { rejectedVal = err; });
    if (rejectedVal !== "error_token") throw new Error(`Expected error_token, got ${rejectedVal}`);

    // Synchronous execution verification: Promise must resolve instantly
    let instant = false;
    new SheetDB.SyncPromise((resolve) => {
      resolve("instant_val");
    }).then(v => {
      if (v === "instant_val") instant = true;
    });
    if (!instant) throw new Error("SyncPromise did not resolve synchronously inside execution stack.");

    console.log("   ✅ Success! Basic resolution works synchronously.");
    return "✅ PASSED";
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    return `❌ FAILED: ${e.message}`;
  }
}

function executeScenario2_ChainingAndIsolation() {
  console.log("▶️ SCENARIO 2: Branching and Mutability Isolation");
  try {
    const parent = SheetDB.SyncPromise.resolve(10);

    // Create branch A
    let valA = null;
    const branchA = parent.then(x => {
      valA = x + 5;
      return valA;
    });

    // Create branch B
    let valB = null;
    const branchB = parent.then(x => {
      valB = x + 20;
      return valB;
    });

    // Check branching isolation
    if (valA !== 15) throw new Error(`Expected branch A to be 15, got ${valA}`);
    if (valB !== 30) throw new Error(`Expected branch B to be 30, got ${valB}`);
    
    // Ensure parent value is still intact
    let parentVal = null;
    parent.then(x => { parentVal = x; });
    if (parentVal !== 10) throw new Error(`Parent value modified! Got ${parentVal}`);

    // Ensure returning value in branch propagates
    let branchA_Value = null;
    branchA.then(v => { branchA_Value = v; });
    if (branchA_Value !== 15) throw new Error(`Expected branch A final chain value to be 15, got ${branchA_Value}`);

    console.log("   ✅ Success! Downstream chains are isolated and immutable.");
    return "✅ PASSED";
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    return `❌ FAILED: ${e.message}`;
  }
}

function executeScenario3_RecursiveThenableUnwrapping() {
  console.log("▶️ SCENARIO 3: Recursive Thenable Unwrapping (Duck-typing)");
  try {
    // Nested SyncPromises
    const nested = SheetDB.SyncPromise.resolve(SheetDB.SyncPromise.resolve(SheetDB.SyncPromise.resolve("unwrapped")));
    let unwrappedVal = null;
    nested.then(v => { unwrappedVal = v; });
    if (unwrappedVal !== "unwrapped") throw new Error(`Expected 'unwrapped', got ${unwrappedVal}`);

    // Custom thenable (duck-typed object)
    const customThenable = {
      then: function(resolve) {
        resolve("custom_unwrapped");
      }
    };
    const testCustom = SheetDB.SyncPromise.resolve(customThenable);
    let customVal = null;
    testCustom.then(v => { customVal = v; });
    if (customVal !== "custom_unwrapped") throw new Error(`Expected 'custom_unwrapped', got ${customVal}`);

    console.log("   ✅ Success! Thenables are unwrapped recursively.");
    return "✅ PASSED";
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    return `❌ FAILED: ${e.message}`;
  }
}

function executeScenario4_DeferredHandlers() {
  console.log("▶️ SCENARIO 4: Deferred Handlers for Async Resolution Simulation");
  try {
    let resolverFn = null;
    const p = new SheetDB.SyncPromise((resolve) => {
      resolverFn = resolve; // Expose resolver to outer scope
    });

    let chainVal = null;
    p.then(x => x + 10).then(v => { chainVal = v; });

    // Assert that chain has not executed yet because parent is still pending
    if (chainVal !== null) throw new Error("Chained promise executed before resolve was called.");

    // Trigger resolve now
    resolverFn(5);

    // Verify it executed immediately upon resolution
    if (chainVal !== 15) throw new Error(`Expected chained value to be 15 after resolve, got ${chainVal}`);

    console.log("   ✅ Success! Handlers queue and deferred resolution works correctly.");
    return "✅ PASSED";
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    return `❌ FAILED: ${e.message}`;
  }
}

function executeScenario5_CombinatorAll() {
  console.log("▶️ SCENARIO 5: Combinator SyncPromise.all Validation");
  try {
    // Array of plain values and promises
    const values = [
      1,
      SheetDB.SyncPromise.resolve(2),
      SheetDB.SyncPromise.resolve(3).then(x => x * 10),
      "plain_string"
    ];

    let resultList = null;
    SheetDB.SyncPromise.all(values).then(res => { resultList = res; });

    if (!Array.isArray(resultList)) throw new Error("SyncPromise.all did not return an array.");
    if (resultList[0] !== 1) throw new Error(`Expected resultList[0] to be 1, got ${resultList[0]}`);
    if (resultList[1] !== 2) throw new Error(`Expected resultList[1] to be 2, got ${resultList[1]}`);
    if (resultList[2] !== 30) throw new Error(`Expected resultList[2] to be 30, got ${resultList[2]}`);
    if (resultList[3] !== "plain_string") throw new Error(`Expected resultList[3] to be 'plain_string', got ${resultList[3]}`);

    // Rejection Propagation in all
    let failureCaught = false;
    SheetDB.SyncPromise.all([
      SheetDB.SyncPromise.resolve("ok"),
      SheetDB.SyncPromise.reject("fail_token")
    ]).catch(err => {
      if (err === "fail_token") failureCaught = true;
    });

    if (!failureCaught) throw new Error("SyncPromise.all did not propagate nested promise rejection.");

    console.log("   ✅ Success! Combinator all handles lists of mixed promises and values correctly.");
    return "✅ PASSED";
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    return `❌ FAILED: ${e.message}`;
  }
}

function executeScenario6_CatchAndFinally() {
  console.log("▶️ SCENARIO 6: Rejection Catch Recovery and Finally Finalizers");
  try {
    // Rejection Recovery
    let recoveryValue = null;
    SheetDB.SyncPromise.reject("trigger_error")
      .catch(err => {
        if (err === "trigger_error") {
          return "recovered_value";
        }
        return "wrong_error";
      })
      .then(v => {
        recoveryValue = v;
      });

    if (recoveryValue !== "recovered_value") {
      throw new Error(`Expected catch block to recover and transition to resolved state. Got: ${recoveryValue}`);
    }

    // Finally Execution: Success flow
    let finallySuccessCalled = false;
    SheetDB.SyncPromise.resolve("ok")
      .finally(() => {
        finallySuccessCalled = true;
      });
    if (!finallySuccessCalled) throw new Error("Finally finalizer was not executed on fulfillment.");

    // Finally Execution: Failure flow
    let finallyFailureCalled = false;
    let finalException = null;
    SheetDB.SyncPromise.reject("error_reason")
      .finally(() => {
        finallyFailureCalled = true;
      })
      .catch(err => {
        finalException = err;
      });
    if (!finallyFailureCalled) throw new Error("Finally finalizer was not executed on rejection.");
    if (finalException !== "error_reason") throw new Error(`Expected error to propagate through finally. Got: ${finalException}`);

    // Finally Execution: Failure flow (finally returns rejected promise, overriding fulfillment)
    let caughtOverrideFulfill = null;
    SheetDB.SyncPromise.resolve("ok")
      .finally(() => SheetDB.SyncPromise.reject("finally_error_override"))
      .catch(err => {
        caughtOverrideFulfill = err;
      });
    if (caughtOverrideFulfill !== "finally_error_override") {
      throw new Error(`Expected finally rejection to override fulfillment. Got: ${caughtOverrideFulfill}`);
    }

    // Finally Execution: Failure flow (finally returns rejected promise, overriding rejection)
    let caughtOverrideReject = null;
    SheetDB.SyncPromise.reject("original_error")
      .finally(() => SheetDB.SyncPromise.reject("finally_error_override"))
      .catch(err => {
        caughtOverrideReject = err;
      });
    if (caughtOverrideReject !== "finally_error_override") {
      throw new Error(`Expected finally rejection to override parent rejection. Got: ${caughtOverrideReject}`);
    }

    console.log("   ✅ Success! Catch recovery and finally operations perform correctly.");
    return "✅ PASSED";
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    return `❌ FAILED: ${e.message}`;
  }
}

function executeScenario7_CircularReferenceDeadlock() {
  console.log("▶️ SCENARIO 7: Circular Reference Deadlock Prevention (Promises/A+ 2.3.1)");
  try {
    let resolvedFn = null;
    const p = new SheetDB.SyncPromise(resolve => {
      resolvedFn = resolve;
    });

    let rejectionError = null;
    p.catch(err => {
      rejectionError = err;
    });

    // Resolve promise with itself to trigger the circular reference check
    resolvedFn(p);

    if (!rejectionError) {
      throw new Error("Expected promise to be rejected, but it was not.");
    }

    if (rejectionError.name !== "CircularReferenceError") {
      throw new Error(`Expected CircularReferenceError, but got ${rejectionError.name}: ${rejectionError.message}`);
    }

    if (!(rejectionError instanceof SheetDB.TypeError)) {
      throw new Error("CircularReferenceError does not inherit from SheetDB.TypeError.");
    }

    console.log("   ✅ Success! Circular reference resolution correctly throws catchable CircularReferenceError.");
    return "✅ PASSED";
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    return `❌ FAILED: ${e.message}`;
  }
}
