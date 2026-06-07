/**
 * @file StaticGraphTestSuite.js
 * Focused unit tests to verify the compile-time Static Schema Graph.
 */

const StaticGraphTestSuite = (function () {
  function runAll() {
    const db = DBContext.getInstance();
    console.log("🚀 Starting Static Schema Graph Unit Tests...");

    testStaticGraphCompile(db);
    testCycleDuplication();

    console.log("✅ PASS: All Static Graph and Cycle Prevention Tests completed successfully!");
    return { success: true };
  }

  function testStaticGraphCompile(db) {
    console.log("🔍 Running Test Case 1: Static Schema Graph Compile...");
    const staticGraph = SheetDB.Graph.StaticGraphBuilder.compile(db._schema);
    
    // Log the compiled topology
    logStaticGraph(staticGraph);

    // Assert key nodes exist
    const requiredTables = ["Student", "Enrollment", "BatchAllocation", "StudentFeeAccount", "Installment", "Payment", "Address", "ContactInfo"];
    requiredTables.forEach(table => {
      const node = staticGraph.getNode(table);
      if (!node) {
        throw new Error(`❌ Test Failed: Table node '${table}' was not compiled in the static graph.`);
      }
    });

    // Assert edge counts and relation types from Student (Root Node)
    const studentNode = staticGraph.getNode("Student");
    
    // Student has 5 outgoing relationships in schema (Address, ContactInfo, Education, Enrollment, BatchAllocation)
    if (studentNode.outgoing.length !== 5) {
      throw new Error(`❌ Test Failed: Expected Student node to have 5 outgoing relationships. Found: ${studentNode.outgoing.length}`);
    }

    // Assert correct top-to-bottom relation type resolution
    studentNode.outgoing.forEach(edge => {
      const childTable = edge.toNode.entityName;
      
      if (childTable === "Address") {
        if (edge.relationType !== "hasOne") {
          throw new Error(`❌ Test Failed: Expected Student -> Address to be 'hasOne'. Found: '${edge.relationType}'`);
        }
        if (edge.onDelete !== "cascade") {
          throw new Error(`❌ Test Failed: Expected Student -> Address onDelete to be 'cascade'. Found: '${edge.onDelete}'`);
        }
      }

      if (childTable === "BatchAllocation") {
        if (edge.relationType !== "hasMany") {
          throw new Error(`❌ Test Failed: Expected Student -> BatchAllocation to be 'hasMany'. Found: '${edge.relationType}'`);
        }
      }
    });
    console.log("  ✅ Test Case 1 Passed.");
  }

  function testCycleDuplication() {
    console.log("🔄 Running Test Case 2: Cyclical Node Duplication Prevention...");
    
    // 1. Mock cycle dependency schema configuration: TableA <-> TableB
    const mockGraphConfig = {
      TableA: [{ table: "TableB", fk: "a_id", onDelete: "cascade" }],
      TableB: [{ table: "TableA", fk: "b_id", onDelete: "cascade" }]
    };

    // 2. Mock query delegate with circular reference records
    const mockQueryDelegate = (table, fk, parentId) => {
      if (table === "TableB" && parentId === "A-1") {
        return [{ b_id: "B-1", a_id: "A-1", _primaryKey: "b_id" }];
      }
      if (table === "TableA" && parentId === "B-1") {
        return [{ a_id: "A-1", b_id: "B-1", _primaryKey: "a_id" }];
      }
      return [];
    };

    const staticGraph = SheetDB.Graph.StaticGraphBuilder.compileFromDependencyGraph(mockGraphConfig);
    const builder = new SheetDB.Graph.DynamicGraphBuilder(staticGraph, mockQueryDelegate);
    
    // We start traversal from TableA with ID 'A-1'
    const mockRecordA = { a_id: "A-1", _primaryKey: "a_id" };
    const graph = builder.build("TableA", "A-1", mockRecordA);

    const nodes = graph.getNodes();
    console.log(`  Cycle Test: Graph has ${nodes.length} nodes (Expected: 2)`);
    
    if (nodes.length !== 2) {
      throw new Error(`❌ Test Failed: Cyclical Node Duplication. Expected exactly 2 nodes, found: ${nodes.length}`);
    }

    const nodeA = graph.findNodeContaining("TableA", "A-1");
    const nodeB = graph.findNodeContaining("TableB", "B-1");

    if (!nodeA || !nodeB) {
      throw new Error("❌ Test Failed: Missing nodes in cyclical graph resolution.");
    }
    console.log("  ✅ Test Case 2 Passed.");
  }

  function logStaticGraph(graph) {
    console.log("\n----- STATIC SCHEMA GRAPH TEMPLATE -----");
    Object.values(graph.nodes).forEach(node => {
      console.log(`Table: [${node.entityName}]`);
      node.outgoing.forEach(edge => {
        console.log(`  --> Child Table: [${edge.toNode.entityName}] via FK: '${edge.foreignKey}' | Type: '${edge.relationType}' | Delete Policy: '${edge.onDelete}'`);
      });
    });
    console.log("----------------------------------------\n");
  }

  return {
    runAll
  };
})();

function runStaticGraphTests() {
  return StaticGraphTestSuite.runAll();
}
