/**
 * @file GraphBuilderTestSuite.js
 * Unit and integration tests for the SheetDB Dynamic Graph Builder and Deletion Validator.
 * Verifies relationships, sorting, cycle safety, do_nothing, and strategy constraints in-memory.
 */

const GraphBuilderTestSuite = (function () {
  const TEST_FOLDER_ID = DATABASE_ROOT_FOLDER_ID;

  function runAll() {
    const activeEnv = typeof SYSTEM_ENV !== 'undefined' ? SYSTEM_ENV : 'development';
    if (activeEnv === 'production') {
      throw new Error("❌ Safety Guard: Test suite cannot be executed in the PRODUCTION environment.");
    }

    const db = DBContext.getInstance();
    console.log("🚀 Starting Graph Builder & Constraint Strategy Tests...");

    const results = {};
    let passed = 0;
    let failed = 0;

    const scenarios = [
      { name: "Scenario 1: Full Student Graph Resolution & Formatting Logs", fn: () => testFullStudentGraph(db) },
      { name: "Scenario 2: Topological Sorting Leaf-First Order", fn: () => testTopologicalSorting(db) },
      { name: "Scenario 3: Visited Set Cycle Prevention", fn: () => testCyclePrevention(db) },
      { name: "Scenario 4: do_nothing Relationship Bypassing", fn: () => testDoNothingBypassing(db) },
      { name: "Scenario 5: Deletion Strategy Constraint Validation", fn: () => testConstraintStrategies(db) }
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
        if (e.stack) console.error(e.stack);
        results[scenario.name] = `❌ FAILED: ${e.message}`;
        failed++;
      }
    });

    console.log("\n=========================================");
    console.log(`=== GRAPH BUILDER TESTS COMPLETE: ${passed} Passed, ${failed} Failed ===`);
    console.log(JSON.stringify(results, null, 2));
    return results;
  }

  /**
   * Helper to format and log the dynamic graph nodes, attributes, and relationships.
   */
  function logGraph(graph, label = "GRAPH TOPOLOGY LOG") {
    console.log(`\n----- ${label} -----`);
    const nodes = graph.getNodes();
    nodes.forEach(node => {
      const cleanAttrs = {};
      for (const [k, v] of Object.entries(node.record)) {
        if (!k.startsWith("_") && typeof v !== 'function') {
          cleanAttrs[k] = v;
        }
      }
      console.log(`Node: [${node.entityName}] ID: ${node.id} attributes: ${JSON.stringify(cleanAttrs)}`);
      node.outgoing.forEach(edge => {
        console.log(`  --> Dependent: [${edge.toNode.entityName}] ID: ${edge.toNode.id} via FK: '${edge.foreignKey}' policy: '${edge.onDelete}'`);
      });
    });
    console.log("---------------------------------\n");
  }

  /**
   * Helper to wrap query delegate with database retrieval logging.
   */
  function createLoggedQueryDelegate(db) {
    return (table, fk, parentId) => {
      const results = db[table].where({ [fk]: parentId });
      console.log(`  [Query DB] Table: '${table}' where '${fk}' = '${parentId}' -> Found ${results.length} record(s)`);
      results.forEach((r, idx) => {
        const clean = {};
        for (const [k, v] of Object.entries(r)) {
          if (!k.startsWith("_") && typeof v !== 'function') {
            clean[k] = v;
          }
        }
        console.log(`    -> [${idx}]: ${JSON.stringify(clean)}`);
      });
      return results;
    };
  }

  // --- SCENARIO IMPLEMENTATIONS ---

  function testFullStudentGraph(db) {
    const curriculum = TestMockData.setupCurriculum(db);
    const salt = Math.random().toString(36).substring(2, 9).toUpperCase();
    let studentId = null;

    try {
      const regPayload = {
        profile: { student_name: "Graph Test Student " + salt, gender: "Male", dob: "2004-05-12", status: "active" },
        address: { line1: "Graph Lane " + salt, city: "Jaipur", state: "Rajasthan", pin_code: "302017", country: "India" },
        contact: { mobile_number: "8" + Math.floor(100000000 + Math.random() * 900000000), email: "graph_" + salt.toLowerCase() + "@test.com" },
        education: [{ highest_qualification: "Class 12", institution_name: "Graph School", year_of_passing: 2023, percentage_or_cgpa: "85%" }],
        enrollments: [{
          enrollment_type: "package",
          item_id: curriculum.packageId,
          fee: 12000,
          package_batches: [
            { course_id: curriculum.physicsId, batch_id: curriculum.batchPhyId },
            { course_id: curriculum.chemistryId, batch_id: curriculum.batchCheId }
          ]
        }],
        feeAccount: {
          total_fee: 12000,
          discount: 1000,
          final_fee: 11000,
          amount_paid: 5000,
          installments: [
            { installment_number: 1, due_amount: 5500, paid_amount: 5000, due_date: "2026-06-15" },
            { installment_number: 2, due_amount: 5500, paid_amount: 0, due_date: "2026-07-15" }
          ]
        },
        payment: { amount_paid: 5000, payment_method: "upi", transaction_reference: "TXN-GRAPH-TEST-" + salt }
      };

      const regAction = new RegisterStudentAction({
        db: db,
        user: { role: "admin", username: "admin_test", isValid: true },
        params: { token: "MOCK_TOKEN", payload: regPayload }
      });

      const response = regAction.run();
      if (!response.success) {
        throw new Error("Failed to register student for graph test: " + response.error.message);
      }

      studentId = response.data.student_id;
      const student = db.Student.findById(studentId);

      // Resolve Graph configuration
      const queryDelegate = createLoggedQueryDelegate(db);
      const staticGraph = SheetDB.Graph.StaticGraphBuilder.compile(db._schema);
      
      const builder = new SheetDB.Graph.DynamicGraphBuilder(staticGraph, queryDelegate);
      const graph = builder.build("Student", studentId, student);

      logGraph(graph, `FULL RESOLVED GRAPH FOR STUDENT ${studentId}`);

      // Verification checks:
      const nodes = graph.getNodes();
      if (nodes.length !== 9) {
        throw new Error(`Expected exactly 9 nodes in the graph. Found: ${nodes.length}`);
      }

      // Check key node types
      const studentNode = graph.getNode("Student", studentId);
      if (!studentNode) throw new Error("Student node is missing.");
      if (studentNode.outgoing.length !== 5) {
        throw new Error(`Expected Student node to have 5 outgoing edges. Found: ${studentNode.outgoing.length}`);
      }

    } finally {
      _cleanupStudent(db, studentId);
    }
  }

  function testTopologicalSorting(db) {
    const curriculum = TestMockData.setupCurriculum(db);
    const salt = Math.random().toString(36).substring(2, 9).toUpperCase();
    let studentId = null;

    try {
      const regPayload = {
        profile: { student_name: "Sort Test Student " + salt, gender: "Female", dob: "2005-04-12", status: "active" },
        address: { line1: "Sort Lane " + salt, city: "Jaipur", state: "Rajasthan", pin_code: "302017", country: "India" },
        contact: { mobile_number: "8" + Math.floor(100000000 + Math.random() * 900000000), email: "sort_" + salt.toLowerCase() + "@test.com" },
        education: [{ highest_qualification: "Class 10", institution_name: "Sort School", year_of_passing: 2024, percentage_or_cgpa: "92%" }],
        enrollments: [{
          enrollment_type: "package",
          item_id: curriculum.packageId,
          fee: 12000,
          package_batches: [
            { course_id: curriculum.physicsId, batch_id: curriculum.batchPhyId },
            { course_id: curriculum.chemistryId, batch_id: curriculum.batchCheId }
          ]
        }],
        feeAccount: {
          total_fee: 12000,
          discount: 1200,
          final_fee: 10800,
          amount_paid: 4800,
          installments: [{ installment_number: 1, due_amount: 10800, paid_amount: 4800, due_date: "2026-06-15" }]
        },
        payment: { amount_paid: 4800, payment_method: "cash", transaction_reference: "TXN-SORT-TEST-" + salt }
      };

      const regAction = new RegisterStudentAction({
        db: db,
        user: { role: "admin", username: "admin_test", isValid: true },
        params: { token: "MOCK_TOKEN", payload: regPayload }
      });

      const response = regAction.run();
      studentId = response.data.student_id;

      const student = db.Student.findById(studentId);
      const queryDelegate = createLoggedQueryDelegate(db);
      const staticGraph = SheetDB.Graph.StaticGraphBuilder.compile(db._schema);
      
      const builder = new SheetDB.Graph.DynamicGraphBuilder(staticGraph, queryDelegate);
      const graph = builder.build("Student", studentId, student);

      logGraph(graph, `TOPOLOGICAL SORT FULL GRAPH FOR STUDENT ${studentId}`);

      const sorted = graph.topologicalSort();
      console.log("\n----- TOPOLOGICAL SORT ORDER LOG (Leaves-First) -----");
      sorted.forEach((node, index) => {
        console.log(`Position [${index}]: [${node.entityName}] ID: ${node.id}`);
      });
      console.log("-----------------------------------------------------\n");

      // Assert that Student (root) is the very last node
      const lastNode = sorted[sorted.length - 1];
      if (lastNode.entityName !== "Student" || lastNode.id !== studentId) {
        throw new Error(`Topological Sort failed: Root node 'Student:${studentId}' must be the last element. Found: '${lastNode.entityName}:${lastNode.id}'`);
      }

      // Assert child tables appear before parent tables
      const getIndex = (entity) => sorted.findIndex(n => n.entityName === entity);
      
      const paymentIndex = getIndex("Payment");
      const sfaIndex = getIndex("StudentFeeAccount");
      const enrollmentIndex = getIndex("Enrollment");

      if (paymentIndex === -1 || sfaIndex === -1 || enrollmentIndex === -1) {
        throw new Error("Missing required node types in sorted array.");
      }

      if (paymentIndex >= sfaIndex) {
        throw new Error("Sorting failed: Dependent 'Payment' must be sorted before its parent 'StudentFeeAccount'.");
      }
      if (sfaIndex >= enrollmentIndex) {
        throw new Error("Sorting failed: 'StudentFeeAccount' must be sorted before its parent 'Enrollment'.");
      }

    } finally {
      _cleanupStudent(db, studentId);
    }
  }

  function testCyclePrevention(db) {
    // 1. Mock cycle dependency schema configuration: A -> B -> A
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

    logGraph(graph, "CYCLICAL GRAPH RESOLUTION TEST");

    const nodes = graph.getNodes();
    if (nodes.length !== 2) {
      throw new Error(`Cycle Resolution failed. Expected exactly 2 nodes. Found: ${nodes.length}`);
    }

    const nodeA = graph.findNodeContaining("TableA", "A-1");
    const nodeB = graph.findNodeContaining("TableB", "B-1");

    if (!nodeA || !nodeB) {
      throw new Error("Missing nodes in cyclical graph resolution.");
    }
  }

  function testDoNothingBypassing(db) {
    // 1. Mock graph schema with one cascading relation and one do_nothing relation
    const mockGraphConfig = {
      TableA: [
        { table: "TableB", fk: "a_id", onDelete: "cascade" },
        { table: "TableC", fk: "a_id", onDelete: "do_nothing" }
      ]
    };

    const mockQueryDelegate = (table, fk, parentId) => {
      if (table === "TableB" && parentId === "A-1") {
        return [{ b_id: "B-1", a_id: "A-1", _primaryKey: "b_id" }];
      }
      if (table === "TableC" && parentId === "A-1") {
        return [{ c_id: "C-1", a_id: "A-1", _primaryKey: "c_id" }];
      }
      return [];
    };

    const staticGraph = SheetDB.Graph.StaticGraphBuilder.compileFromDependencyGraph(mockGraphConfig);
    const builder = new SheetDB.Graph.DynamicGraphBuilder(staticGraph, mockQueryDelegate);
    const mockRecord = { a_id: "A-1", _primaryKey: "a_id" };
    const graph = builder.build("TableA", "A-1", mockRecord);

    logGraph(graph, "DO_NOTHING POLICY BYPASS TEST");

    const nodes = graph.getNodes();
    
    // TableC should be skipped because onDelete was set to 'do_nothing'
    const nodeC = graph.findNodeContaining("TableC", "C-1");
    if (nodeC !== null) {
      throw new Error("Verification failed: TableC was traversed despite 'do_nothing' onDelete policy.");
    }

    const nodeB = graph.findNodeContaining("TableB", "B-1");
    if (!nodeB) {
      throw new Error("Verification failed: TableB was not resolved in the graph.");
    }
  }

  function testConstraintStrategies(db) {
    const curriculum = TestMockData.setupCurriculum(db);
    const salt = Math.random().toString(36).substring(2, 9).toUpperCase();
    
    let studentActiveId = null;
    let studentCleanId = null;

    try {
      // Setup Student 1: Active Ledger (Installments & Payments present)
      const activePayload = {
        profile: { student_name: "Active Student " + salt, dob: "2004-01-01" },
        address: { line1: "Active St " + salt, city: "Jaipur", state: "Rajasthan", pin_code: "302017", country: "India" },
        contact: { mobile_number: "8" + Math.floor(100000000 + Math.random() * 900000000), email: "act_" + salt.toLowerCase() + "@test.com" },
        enrollments: [{ enrollment_type: "course", item_id: curriculum.physicsId, fee: 6000, batch_id: curriculum.batchPhyId }],
        feeAccount: {
          total_fee: 6000,
          final_fee: 6000,
          amount_paid: 2000,
          installments: [{ installment_number: 1, due_amount: 6000, paid_amount: 2000, due_date: "2026-06-15" }]
        },
        payment: { amount_paid: 2000, payment_method: "upi" }
      };

      const regActionActive = new RegisterStudentAction({
        db: db,
        user: { role: "admin", username: "admin_test", isValid: true },
        params: { token: "MOCK_TOKEN", payload: activePayload }
      });
      studentActiveId = regActionActive.run().data.student_id;

      // Setup Student 2: Clean Ledger (Omit feeAccount & payment, only course enrollment)
      const cleanPayload = {
        profile: { student_name: "Clean Student " + salt, dob: "2004-01-02" },
        address: { line1: "Clean St " + salt, city: "Jaipur", state: "Rajasthan", pin_code: "302017", country: "India" },
        contact: { mobile_number: "8" + Math.floor(100000000 + Math.random() * 900000000), email: "cln_" + salt.toLowerCase() + "@test.com" },
        enrollments: [{ enrollment_type: "course", item_id: curriculum.physicsId, fee: 6000, batch_id: curriculum.batchPhyId }]
      };

      const regActionClean = new RegisterStudentAction({
        db: db,
        user: { role: "admin", username: "admin_test", isValid: true },
        params: { token: "MOCK_TOKEN", payload: cleanPayload }
      });
      studentCleanId = regActionClean.run().data.student_id;

      const queryDelegate = createLoggedQueryDelegate(db);
      const staticGraph = SheetDB.Graph.StaticGraphBuilder.compile(db._schema);
      const builder = new SheetDB.Graph.DynamicGraphBuilder(staticGraph, queryDelegate);

      // Validate Student 1 (Should FAIL protect check on Installments/Payments)
      const activeStudent = db.Student.findById(studentActiveId);
      const activeGraph = builder.build("Student", studentActiveId, activeStudent);
      logGraph(activeGraph, "ACTIVE STUDENT CONSTRAINTS TEST (EXPECT FAIL)");
      
      try {
        SheetDB.Graph.DeletionValidationRegistry.validate(activeGraph, "Student", studentActiveId);
        throw new Error("Constraint Validation Failed: Active Student deletion was NOT blocked by outstanding installments.");
      } catch (e) {
        if (!(e instanceof SheetDB.IntegrityError)) {
          throw new Error(`Expected IntegrityError, but caught: ${e.name} -> ${e.message}`);
        }
        console.log(`   ✅ Caught expected validation block: ${e.message}`);
      }

      // Validate Student 2 (Should PASS validation as ledger is clean)
      const cleanStudent = db.Student.findById(studentCleanId);
      const cleanGraph = builder.build("Student", studentCleanId, cleanStudent);
      logGraph(cleanGraph, "CLEAN STUDENT CONSTRAINTS TEST (EXPECT PASS)");

      const validationPassed = SheetDB.Graph.DeletionValidationRegistry.validate(cleanGraph, "Student", studentCleanId);
      if (!validationPassed) {
        throw new Error("Constraint Validation Failed: Clean Student graph was blocked unexpectedly.");
      }
      console.log("   ✅ Clean student graph validation passed successfully!");

    } finally {
      _cleanupStudent(db, studentActiveId);
      _cleanupStudent(db, studentCleanId);
    }
  }

  // Helper cleanup method
  function _cleanupStudent(db, studentId) {
    if (!studentId) return;
    try {
      const enrollments = db.Enrollment.where({ student_id: studentId });
      enrollments.forEach(enr => {
        const sfa = db.StudentFeeAccount.findOne({ enrollment_id: enr.enrollment_id });
        if (sfa) {
          const payments = db.Payment.where({ student_fee_id: sfa.student_fee_id });
          payments.forEach(pay => { try { db.Payment.remove(pay.payment_id); } catch(e) {} });

          const installments = db.Installment.where({ student_fee_id: sfa.student_fee_id });
          installments.forEach(ins => { try { db.Installment.remove(ins.installment_id); } catch(e) {} });

          try { db.StudentFeeAccount.remove(sfa.student_fee_id); } catch(e) {}
        }
        
        const allocs = db.BatchAllocation.where({ enrollment_id: enr.enrollment_id });
        allocs.forEach(alloc => { try { db.BatchAllocation.remove(alloc.allocation_id); } catch(e) {} });

        try { db.Enrollment.remove(enr.enrollment_id); } catch(e) {}
      });

      const address = db.Address.all().find(addr => addr.student_id === studentId);
      if (address) try { db.Address.remove(address.address_id); } catch(e) {}

      const contact = db.ContactInfo.all().find(c => c.student_id === studentId);
      if (contact) try { db.ContactInfo.remove(contact.contact_id); } catch(e) {}

      const educations = db.Education.where({ student_id: studentId });
      educations.forEach(edu => { try { db.Education.remove(edu.education_id); } catch(e) {} });

      try { db.Student.remove(studentId); } catch(e) {}
    } catch (err) {
      console.error(`Error during cleanup of student ${studentId}: ${err.message}`);
    }
  }

  return {
    runAll: runAll
  };
})();

function runGraphBuilderTests() {
  return GraphBuilderTestSuite.runAll();
}
