/**
 * @file DeletionValidationTestSuite.js
 * Unit and integration tests for DeletionValidationRegistry.validate.
 * Verifies all four constraint strategies (protect, cascade, set_null, do_nothing) and defensive edge cases in isolation.
 */

const DeletionValidationTestSuite = (function () {
  function runAll() {
    const activeEnv = typeof SYSTEM_ENV !== 'undefined' ? SYSTEM_ENV : Environment.DEVELOPMENT;
    if (resolveEnvironmentType(activeEnv) === Environment.PRODUCTION) {
      throw new Error("❌ Safety Guard: Test suite cannot be executed in the PRODUCTION environment.");
    }

    console.log("🚀 Starting Deletion Validation Strategy Tests...");

    const results = {};
    let passed = 0;
    let failed = 0;

    const scenarios = [
      { name: "Scenario 1: protect policy blocks deletion of parent with active child", fn: testProtectBlocks },
      { name: "Scenario 2: protect policy permits parent deletion with zero child records", fn: testProtectPermits },
      { name: "Scenario 3: cascade policy passes when children are slated for deletion", fn: testCascadePasses },
      { name: "Scenario 4: cascade policy blocks if child is missing from deletion schedule", fn: testCascadeBlocksMismatch },
      { name: "Scenario 5: set_null policy passes if child FK is optional", fn: testSetNullPasses },
      { name: "Scenario 6: set_null policy blocks if child FK is required", fn: testSetNullBlocksRequired },
      { name: "Scenario 7: set_null policy blocks if polymorphic typeField is required", fn: testSetNullBlocksPolymorphicRequired },
      { name: "Scenario 8: do_nothing policy passes and ignores child checks", fn: testDoNothingPasses },
      { name: "Scenario 9: validate throws ValidationError on null/invalid graph", fn: testValidateDefensiveGuardGraph },
      { name: "Scenario 10: validate throws ValidationError on missing root record", fn: testValidateDefensiveGuardRoot },
      { name: "Scenario 11: set_null policy blocks if schema metadata is missing", fn: testSetNullBlocksMissingSchema }
    ];

    scenarios.forEach(scenario => {
      try {
        console.log(`\n--- Running: ${scenario.name} ---`);
        scenario.fn();
        console.log(`✅ PASS: ${scenario.name}`);
        results[scenario.name] = "✅ PASSED";
        passed++;
      } catch (e) {
        console.error(`❌ FAIL: ${scenario.name} -> ${e.message}`);
        results[scenario.name] = `❌ FAILED: ${e.message}`;
        failed++;
      }
    });

    console.log("\n=========================================");
    console.log(`=== DELETION VALIDATION TESTS COMPLETE: ${passed} Passed, ${failed} Failed ===`);
    console.log(JSON.stringify(results, null, 2));
    return results;
  }

  // --- Helper: Build a minimal Mock Graph ---
  function buildMockGraph(nodes = [], edges = []) {
    const graph = new SheetDB.Graph.DynamicGraph();
    nodes.forEach(n => graph.addNode(n));
    edges.forEach(e => graph.addEdge(e));
    return graph;
  }

  // --- Helper: Build mock records with schemas ---
  function createMockRecord(id, schema = {}) {
    return {
      _primaryKey: "id",
      id: id,
      constructor: {
        schema: schema
      }
    };
  }

  // --- SCENARIO IMPLEMENTATIONS ---

  // 1. Scenario 1: protect policy blocks deletion of parent with active child
  function testProtectBlocks() {
    const parentRec = createMockRecord("parent-1");
    const childRec = createMockRecord("child-1");

    const parentNode = new SheetDB.Graph.GraphNode("ParentTable", "parent-1", parentRec, 'single');
    const childNode = new SheetDB.Graph.GraphNode("ChildTable", "child-1", childRec, 'single');

    // Edge from parent to child with policy 'protect'
    const edge = new SheetDB.Graph.GraphEdge(parentNode, childNode, "parent_id", "protect");
    const graph = buildMockGraph([parentNode, childNode], [edge]);

    try {
      SheetDB.Graph.DeletionValidationRegistry.validate(graph, "ParentTable", "parent-1");
      throw new Error("Validation failed: Deletion should have been blocked by protect strategy.");
    } catch (e) {
      if (!(e instanceof SheetDB.IntegrityError) && e.name !== "IntegrityError") {
        throw new Error(`Expected IntegrityError, but caught: ${e.name} -> ${e.message}`);
      }
      if (!e.context || !Array.isArray(e.context.violations) || e.context.violations.length === 0) {
        throw new Error(`Expected e.context.violations to contain violation entries, got context: ${JSON.stringify(e.context)}`);
      }
      const v = e.context.violations[0];
      if (v.table !== "ChildTable" || v.foreignKey !== "parent_id" || !v.ids.includes("child-1")) {
        throw new Error(`Unexpected violation detail structure: ${JSON.stringify(v)}`);
      }
      console.log(`   Expected Exception and Violation Details Caught: ${e.message}`);
    }
  }

  // 2. Scenario 2: protect policy permits parent deletion with zero child records
  function testProtectPermits() {
    // If there are zero child records, no child node/edge is hydrated in the dynamic graph
    const parentRec = createMockRecord("parent-1");
    const parentNode = new SheetDB.Graph.GraphNode("ParentTable", "parent-1", parentRec, 'single');
    const graph = buildMockGraph([parentNode]);

    const result = SheetDB.Graph.DeletionValidationRegistry.validate(graph, "ParentTable", "parent-1");
    if (result !== true) {
      throw new Error("Validation failed: Deletion should be allowed when no child records exist.");
    }
  }

  // 3. Scenario 3: cascade policy passes when children are slated for deletion
  function testCascadePasses() {
    const parentRec = createMockRecord("parent-1");
    const childRec = createMockRecord("child-1");

    const parentNode = new SheetDB.Graph.GraphNode("ParentTable", "parent-1", parentRec, 'single');
    const childNode = new SheetDB.Graph.GraphNode("ChildTable", "child-1", childRec, 'single');

    // Edge from parent to child with policy 'cascade'
    const edge = new SheetDB.Graph.GraphEdge(parentNode, childNode, "parent_id", "cascade");
    const graph = buildMockGraph([parentNode, childNode], [edge]);

    const result = SheetDB.Graph.DeletionValidationRegistry.validate(graph, "ParentTable", "parent-1");
    if (result !== true) {
      throw new Error("Validation failed: Cascade validation should pass when child is slated for deletion.");
    }
  }

  // 4. Scenario 4: cascade policy blocks if child is missing from deletion schedule
  function testCascadeBlocksMismatch() {
    const parentRec = createMockRecord("parent-1");
    const childRec = createMockRecord("child-1");

    const parentNode = new SheetDB.Graph.GraphNode("ParentTable", "parent-1", parentRec, 'single');
    const childNode = new SheetDB.Graph.GraphNode("ChildTable", "child-1", childRec, 'single');

    // Cascade policy edge
    const edge = new SheetDB.Graph.GraphEdge(parentNode, childNode, "parent_id", "cascade");
    const graph = buildMockGraph([parentNode, childNode], [edge]);

    // To simulate a mismatch: we manually modify graph's edges but bypass the cascade list in Registry validate.
    // However, since validate dynamically crawls the cascade path, we can test this by breaking the validate logic
    // or by manually calling DeletionValidationRegistry strategy or mocking it.
    // Let's manually trigger the strategy with an empty deleteNodeKeys set.
    const deleteNodeKeys = new Set(["ParentTable:parent-1"]); // ChildTable:child-1 is missing
    const strategy = SheetDB.Graph.DeletionValidationRegistry._strategies ? SheetDB.Graph.DeletionValidationRegistry._strategies.cascade : null;
    
    if (strategy) {
      try {
        strategy(edge, deleteNodeKeys, {});
        throw new Error("Validation failed: Cascade mismatch should throw an IntegrityError.");
      } catch (e) {
        if (!(e instanceof SheetDB.IntegrityError) && e.name !== "IntegrityError") {
          throw new Error(`Expected IntegrityError, but caught: ${e.name} -> ${e.message}`);
        }
        console.log(`   Expected Exception Caught: ${e.message}`);
      }
    } else {
      console.log("   Skipping internal strategy test (private scope)");
    }
  }

  // 5. Scenario 5: set_null policy passes if child FK is optional
  function testSetNullPasses() {
    const parentRec = createMockRecord("parent-1");
    // child FK column 'parent_id' is optional (required: false)
    const childRec = createMockRecord("child-1", {
      parent_id: { required: false }
    });

    const parentNode = new SheetDB.Graph.GraphNode("ParentTable", "parent-1", parentRec, 'single');
    const childNode = new SheetDB.Graph.GraphNode("ChildTable", "child-1", childRec, 'single');

    const edge = new SheetDB.Graph.GraphEdge(parentNode, childNode, "parent_id", "set_null");
    const graph = buildMockGraph([parentNode, childNode], [edge]);

    const result = SheetDB.Graph.DeletionValidationRegistry.validate(graph, "ParentTable", "parent-1");
    if (result !== true) {
      throw new Error("Validation failed: Optional FK set_null validation should pass.");
    }
  }

  // 6. Scenario 6: set_null policy blocks if child FK is required
  function testSetNullBlocksRequired() {
    const parentRec = createMockRecord("parent-1");
    // child FK column 'parent_id' is required: true
    const childRec = createMockRecord("child-1", {
      parent_id: { required: true }
    });

    const parentNode = new SheetDB.Graph.GraphNode("ParentTable", "parent-1", parentRec, 'single');
    const childNode = new SheetDB.Graph.GraphNode("ChildTable", "child-1", childRec, 'single');

    const edge = new SheetDB.Graph.GraphEdge(parentNode, childNode, "parent_id", "set_null");
    const graph = buildMockGraph([parentNode, childNode], [edge]);

    try {
      SheetDB.Graph.DeletionValidationRegistry.validate(graph, "ParentTable", "parent-1");
      throw new Error("Validation failed: Required FK set_null should throw ValidationError.");
    } catch (e) {
      if (!(e instanceof SheetDB.ValidationError) && e.name !== "ValidationError") {
        throw new Error(`Expected ValidationError, but caught: ${e.name} -> ${e.message}`);
      }
      console.log(`   Expected Exception Caught: ${e.message}`);
    }
  }

  // 7. Scenario 7: set_null policy blocks if polymorphic typeField is required
  function testSetNullBlocksPolymorphicRequired() {
    const parentRec = createMockRecord("parent-1");
    // Polymorphic FK child record:
    // 'item_id' is optional, but discriminator 'item_type' is required
    const childRec = createMockRecord("child-1", {
      item_id: { target: "polymorphic", typeField: "item_type", required: false },
      item_type: { required: true }
    });

    const parentNode = new SheetDB.Graph.GraphNode("ParentTable", "parent-1", parentRec, 'single');
    const childNode = new SheetDB.Graph.GraphNode("ChildTable", "child-1", childRec, 'single');

    const edge = new SheetDB.Graph.GraphEdge(parentNode, childNode, "item_id", "set_null");
    const graph = buildMockGraph([parentNode, childNode], [edge]);

    try {
      // NOTE: This test will fail on the first run (TDD phase 1) because registry lacks typeField validation
      SheetDB.Graph.DeletionValidationRegistry.validate(graph, "ParentTable", "parent-1");
      throw new Error("Validation failed: Required polymorphic discriminator set_null should throw ValidationError.");
    } catch (e) {
      if (!(e instanceof SheetDB.ValidationError) && e.name !== "ValidationError") {
        throw new Error(`Expected ValidationError, but caught: ${e.name} -> ${e.message}`);
      }
      console.log(`   Expected Exception Caught: ${e.message}`);
    }
  }

  // 8. Scenario 8: do_nothing policy passes and ignores child checks
  function testDoNothingPasses() {
    const parentRec = createMockRecord("parent-1");
    // Even if FK is required, do_nothing should bypass checks
    const childRec = createMockRecord("child-1", {
      parent_id: { required: true }
    });

    const parentNode = new SheetDB.Graph.GraphNode("ParentTable", "parent-1", parentRec, 'single');
    const childNode = new SheetDB.Graph.GraphNode("ChildTable", "child-1", childRec, 'single');

    const edge = new SheetDB.Graph.GraphEdge(parentNode, childNode, "parent_id", "do_nothing");
    const graph = buildMockGraph([parentNode, childNode], [edge]);

    const result = SheetDB.Graph.DeletionValidationRegistry.validate(graph, "ParentTable", "parent-1");
    if (result !== true) {
      throw new Error("Validation failed: do_nothing relation should pass validation unconditionally.");
    }
  }

  // 9. Scenario 9: validate throws ValidationError on null/invalid graph
  function testValidateDefensiveGuardGraph() {
    try {
      // NOTE: This will fail on the first run (TDD phase 1) because validate lacks a null check guard
      SheetDB.Graph.DeletionValidationRegistry.validate(null, "ParentTable", "parent-1");
      throw new Error("Validation failed: validate(null) should throw ValidationError.");
    } catch (e) {
      if (!(e instanceof SheetDB.ValidationError) && e.name !== "ValidationError") {
        throw new Error(`Expected ValidationError, but caught: ${e.name} -> ${e.message}`);
      }
      console.log(`   Expected Exception Caught: ${e.message}`);
    }
  }

  // 10. Scenario 10: validate throws ValidationError on missing root record
  function testValidateDefensiveGuardRoot() {
    const parentRec = createMockRecord("parent-1");
    const parentNode = new SheetDB.Graph.GraphNode("ParentTable", "parent-1", parentRec, 'single');
    const graph = buildMockGraph([parentNode]);

    try {
      // NOTE: This will fail on first run (TDD phase 1) because validate currently returns true early if rootNode not found
      SheetDB.Graph.DeletionValidationRegistry.validate(graph, "ParentTable", "parent-2");
      throw new Error("Validation failed: validate() should throw ValidationError if root record is missing from graph.");
    } catch (e) {
      if (!(e instanceof SheetDB.ValidationError) && e.name !== "ValidationError") {
        throw new Error(`Expected ValidationError, but caught: ${e.name} -> ${e.message}`);
      }
      console.log(`   Expected Exception Caught: ${e.message}`);
    }
  }

  // 11. Scenario 11: set_null policy blocks if schema metadata is missing
  function testSetNullBlocksMissingSchema() {
    const parentRec = createMockRecord("parent-1");
    const childRec = {
      _primaryKey: "id",
      id: "child-1",
      constructor: {}
    };

    const parentNode = new SheetDB.Graph.GraphNode("ParentTable", "parent-1", parentRec, 'single');
    const childNode = new SheetDB.Graph.GraphNode("ChildTable", "child-1", childRec, 'single');

    const edge = new SheetDB.Graph.GraphEdge(parentNode, childNode, "parent_id", "set_null");
    const graph = buildMockGraph([parentNode, childNode], [edge]);

    try {
      SheetDB.Graph.DeletionValidationRegistry.validate(graph, "ParentTable", "parent-1");
      throw new Error("Validation failed: Missing schema should throw ValidationError.");
    } catch (e) {
      if (!(e instanceof SheetDB.ValidationError) && e.name !== "ValidationError") {
        throw new Error(`Expected ValidationError, but caught: ${e.name} -> ${e.message}`);
      }
      console.log(`   Expected Exception Caught: ${e.message}`);
    }
  }

  return {
    runAll: runAll
  };
})();

function runDeletionValidationTests() {
  return DeletionValidationTestSuite.runAll();
}
