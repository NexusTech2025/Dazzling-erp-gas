/**
 * @file TeacherSalaryCalculationTests.js
 * Isolated Unit Test Suite for Teacher Salary Calculation Engine (GAS compatible).
 * Path: DazzlingDB/Test/TeacherSalaryCalculationTests.js
 */

function runTeacherSalaryCalculationTests() {
  console.log("🚀 Starting TeacherSalaryCalculationEngine Unit Tests...");

  // Load the engine if running under Node.js
  if (typeof require !== 'undefined') {
    globalThis.SheetDB = {
      EntityNotFoundError: class EntityNotFoundError extends Error {
        constructor(entity, id, domain) {
          super(`${entity} with ID '${id}' not found in ${domain}`);
        }
      },
      ValidationError: class ValidationError extends Error {}
    };
    require('../DBServices/StaffService_TeacherSalaryCalculationEngine.js');
  }

  // Simple assert library helper for GAS compatibility
  const assert = {
    strictEqual: function(actual, expected, message) {
      if (actual !== expected) {
        throw new Error((message || "") + " -> Expected: " + expected + ", Got: " + actual);
      }
    },
    throws: function(fn, expectedRegex, message) {
      let threw = false;
      try {
        fn();
      } catch (err) {
        threw = true;
        if (expectedRegex && !expectedRegex.test(err.message)) {
          throw new Error((message || "") + " -> Expected error matching " + expectedRegex + ", but got: " + err.message);
        }
      }
      if (!threw) {
        throw new Error((message || "") + " -> Expected function to throw an error, but it succeeded.");
      }
    },
    ok: function(value, message) {
      if (!value) {
        throw new Error(message || "Expected truthy value");
      }
    }
  };

  // Mock Database Gateway setup for isolated in-memory test execution
  const mockDb = {
    teachers: {},
    configs: [],
    allocations: [],
    enrollments: {},
    studentFeeAccounts: [],
    payments: [],
    paymentTransactions: [],
    
    Teacher: {
      findById: function(id) {
        return mockDb.teachers[id] || null;
      }
    },
    
    TeacherSalaryConfig: {
      where: function(filter) {
        if (!filter || typeof filter.entity_id !== 'string') {
          throw new Error("where() expects an equality filter object");
        }
        return mockDb.configs.filter(c => c.entity_id === filter.entity_id && c.entity_type === filter.entity_type);
      }
    },

    BatchAllocation: {
      where: function(filter) {
        if (!filter || typeof filter.batch_id !== 'string') {
          throw new Error("where() expects an equality filter object");
        }
        return mockDb.allocations.filter(a => a.batch_id === filter.batch_id);
      }
    },

    Enrollment: {
      findById: function(id) {
        return mockDb.enrollments[id] || null;
      }
    },

    StudentFeeAccount: {
      where: function(filter) {
        if (!filter || typeof filter.enrollment_id !== 'string') {
          throw new Error("where() expects an equality filter object");
        }
        return mockDb.studentFeeAccounts.filter(s => s.enrollment_id === filter.enrollment_id);
      }
    },

    Payment: {
      where: function(filter) {
        if (!filter || typeof filter.student_fee_id !== 'string') {
          throw new Error("where() expects an equality filter object");
        }
        return mockDb.payments.filter(p => p.student_fee_id === filter.student_fee_id);
      }
    },

    TeacherPaymentTransaction: {
      where: function(filter) {
        if (!filter || typeof filter.salary_config_id !== 'string') {
          throw new Error("where() expects an equality filter object");
        }
        return mockDb.paymentTransactions.filter(t => t.salary_config_id === filter.salary_config_id);
      }
    }
  };

  function resetDb() {
    mockDb.teachers = {};
    mockDb.configs = [];
    mockDb.allocations = [];
    mockDb.enrollments = {};
    mockDb.studentFeeAccounts = [];
    mockDb.payments = [];
    mockDb.paymentTransactions = [];
  }

  // Test Case 1: Teacher Not Found Exception
  (function() {
    resetDb();
    const engine = new TeacherSalaryCalculationEngine(mockDb);
    assert.throws(
      function() { engine.calculateTeacherPayroll("TCH-INVALID", "2026-06"); },
      /Teacher.*not found/i
    );
    console.log("✅ Test 1: Teacher Not Found exception passed.");
  })();

  // Test Case 2: Strategy A - Flat monthly global configuration
  (function() {
    resetDb();

    mockDb.teachers["TCH-001"] = { teacher_id: "TCH-001", full_name: "Rahul Baba" };
    mockDb.configs.push({
      salary_config_id: "TSC-001",
      entity_id: "TCH-001",
      entity_type: "Teacher",
      salary_config_type: "recurring_monthly",
      effective_from: "2026-01-01",
      effective_to: null,
      rate_type: "monthly",
      base_value: 15000.00,
      scope_type: "global",
      scope_id: null,
      contract_status: "active",
      settlement_state: "unsettled"
    });

    const engine = new TeacherSalaryCalculationEngine(mockDb);
    const txs = engine.calculateTeacherPayroll("TCH-001", "2026-06");
    assert.strictEqual(txs.length, 1);
    assert.strictEqual(txs[0].amount, 15000.00);
    assert.ok(txs[0].notes.indexOf("Target Scope Boundary: Global Systems Block") !== -1);
    console.log("✅ Test 2: Flat monthly global strategy calculation passed.");
  })();

  // Test Case 3: Strategy A - Flat monthly with batch_group weight splits
  (function() {
    resetDb();

    mockDb.teachers["TCH-001"] = { teacher_id: "TCH-001", full_name: "Rahul Baba" };
    mockDb.configs.push({
      salary_config_id: "TSC-002",
      entity_id: "TCH-001",
      entity_type: "Teacher",
      salary_config_type: "recurring_monthly",
      effective_from: "2026-01-01",
      effective_to: null,
      rate_type: "monthly",
      base_value: 10000.00,
      scope_type: "batch_group",
      scope_id: '{"BTC-101":60,"BTC-102":40}',
      contract_status: "active",
      settlement_state: "unsettled"
    });

    const engine = new TeacherSalaryCalculationEngine(mockDb);
    const txs = engine.calculateTeacherPayroll("TCH-001", "2026-06");
    assert.strictEqual(txs.length, 2);
    
    txs.sort((a, b) => a.notes.localeCompare(b.notes));
    
    assert.strictEqual(txs[0].amount, 6000.00);
    assert.ok(txs[0].notes.indexOf("BTC-101") !== -1);
    assert.strictEqual(txs[1].amount, 4000.00);
    assert.ok(txs[1].notes.indexOf("BTC-102") !== -1);
    console.log("✅ Test 3: Flat monthly batch_group split calculation passed.");
  })();

  // Test Case 4: Strategy B - Amortized yearly strategy
  (function() {
    resetDb();

    mockDb.teachers["TCH-001"] = { teacher_id: "TCH-001", full_name: "Rahul Baba" };
    mockDb.configs.push({
      salary_config_id: "TSC-003",
      entity_id: "TCH-001",
      entity_type: "Teacher",
      salary_config_type: "fixed_duration_pool",
      effective_from: "2026-01-01",
      effective_to: "2026-12-31",
      rate_type: "yearly",
      base_value: 120000.00,
      scope_type: "global",
      scope_id: null,
      contract_status: "active",
      settlement_state: "unsettled"
    });

    const engine = new TeacherSalaryCalculationEngine(mockDb);
    const txs = engine.calculateTeacherPayroll("TCH-001", "2026-06");
    assert.strictEqual(txs.length, 1);
    assert.strictEqual(txs[0].amount, 10000.00);
    console.log("✅ Test 4: Amortized yearly strategy calculation passed.");
  })();

  // Test Case 5: Strategy C - Variable revenue_percentage strategy on single_batch via Payment
  (function() {
    resetDb();

    mockDb.teachers["TCH-001"] = { teacher_id: "TCH-001", full_name: "Rahul Baba" };
    mockDb.configs.push({
      salary_config_id: "TSC-004",
      entity_id: "TCH-001",
      entity_type: "Teacher",
      salary_config_type: "recurring_monthly",
      effective_from: "2026-06-01",
      effective_to: "2026-11-30",
      rate_type: "revenue_percentage",
      base_value: 20.0,
      scope_type: "single_batch",
      scope_id: "BTC-101",
      contract_status: "active",
      settlement_state: "unsettled"
    });

    mockDb.allocations.push({ allocation_id: "BAL-001", batch_id: "BTC-101", enrollment_id: "ENR-001", course_id: "CRS-001" });
    mockDb.enrollments["ENR-001"] = { enrollment_id: "ENR-001", enrollment_type: "course" };
    mockDb.studentFeeAccounts.push({ student_fee_id: "SFA-001", enrollment_id: "ENR-001" });

    mockDb.payments.push(
      { payment_id: "PAY-001", student_fee_id: "SFA-001", amount_paid: 5000, status: "success", payment_date: "2026-06-10" },
      { payment_id: "PAY-002", student_fee_id: "SFA-001", amount_paid: 3000, status: "success", payment_date: "2026-06-15" },
      { payment_id: "PAY-003", student_fee_id: "SFA-001", amount_paid: 4000, status: "success", payment_date: "2026-07-01" },
      { payment_id: "PAY-004", student_fee_id: "SFA-001", amount_paid: 1000, status: "pending", payment_date: "2026-06-25" }
    );

    const engine = new TeacherSalaryCalculationEngine(mockDb);
    const txs = engine.calculateTeacherPayroll("TCH-001", "2026-06");
    assert.strictEqual(txs.length, 1);
    assert.strictEqual(txs[0].amount, 1600.00);
    console.log("✅ Test 5: Variable revenue_percentage strategy calculation passed.");
  })();

  // Test Case 6: Invalid Percentage Rate (>100) Validation Failure
  (function() {
    resetDb();

    mockDb.teachers["TCH-001"] = { teacher_id: "TCH-001", full_name: "Rahul Baba" };
    mockDb.configs.push({
      salary_config_id: "TSC-005",
      entity_id: "TCH-001",
      entity_type: "Teacher",
      salary_config_type: "recurring_monthly",
      effective_from: "2026-01-01",
      effective_to: null,
      rate_type: "revenue_percentage",
      base_value: 120.00,
      scope_type: "single_batch",
      scope_id: "BTC-101",
      contract_status: "active",
      settlement_state: "unsettled"
    });

    const engine = new TeacherSalaryCalculationEngine(mockDb);
    assert.throws(
      function() { engine.calculateTeacherPayroll("TCH-001", "2026-06"); },
      /Invalid base_value percentage/
    );
    console.log("✅ Test 6: Invalid percentage rate (>100) validation exception passed.");
  })();

  // Test Case 7: Temporal Boundaries Verification (Skipping Expired/Settled Contracts)
  (function() {
    resetDb();
    mockDb.teachers["TCH-001"] = { teacher_id: "TCH-001", full_name: "Rahul Baba" };
    
    mockDb.configs.push({
      salary_config_id: "TSC-EXP",
      entity_id: "TCH-001",
      entity_type: "Teacher",
      salary_config_type: "fixed_duration_pool",
      effective_from: "2026-01-01",
      effective_to: "2026-05-31",
      rate_type: "monthly",
      base_value: 20000.00,
      scope_type: "global",
      scope_id: null,
      contract_status: "expired",
      settlement_state: "settled"
    });

    const engine = new TeacherSalaryCalculationEngine(mockDb);
    const txs = engine.calculateTeacherPayroll("TCH-001", "2026-06");
    assert.strictEqual(txs.length, 0);
    console.log("✅ Test 7: Skip expired and settled configurations passed.");
  })();

  // Test Case 8: Malformed JSON Syntax Handling
  (function() {
    resetDb();
    mockDb.teachers["TCH-001"] = { teacher_id: "TCH-001", full_name: "Rahul Baba" };
    mockDb.configs.push({
      salary_config_id: "TSC-MAL",
      entity_id: "TCH-001",
      entity_type: "Teacher",
      salary_config_type: "recurring_monthly",
      effective_from: "2026-01-01",
      effective_to: null,
      rate_type: "monthly",
      base_value: 10000.00,
      scope_type: "batch_group",
      scope_id: '{"BTC-101":60, "corrupted_syntax": }',
      contract_status: "active",
      settlement_state: "unsettled"
    });

    const engine = new TeacherSalaryCalculationEngine(mockDb);
    assert.throws(
      function() { engine.calculateTeacherPayroll("TCH-001", "2026-06"); },
      /valid JSON/i
    );
    console.log("✅ Test 8: Malformed scope_id JSON catch exception passed.");
  })();

  // Test Case 9: Strategy C - Independent Multi-Batch Percentage Rates (batch_group)
  (function() {
    resetDb();
    mockDb.teachers["TCH-001"] = { teacher_id: "TCH-001", full_name: "Rahul Baba" };
    mockDb.configs.push({
      salary_config_id: "TSC-REV-MULTI",
      entity_id: "TCH-001",
      entity_type: "Teacher",
      salary_config_type: "recurring_monthly",
      effective_from: "2026-01-01",
      effective_to: null,
      rate_type: "revenue_percentage",
      base_value: 0,
      scope_type: "batch_group",
      scope_id: '{"BTC-101":25,"BTC-102":20}',
      contract_status: "active",
      settlement_state: "unsettled"
    });

    mockDb.allocations.push({ allocation_id: "BAL-001", batch_id: "BTC-101", enrollment_id: "ENR-001", course_id: "CRS-001" });
    mockDb.enrollments["ENR-001"] = { enrollment_id: "ENR-001", enrollment_type: "course" };
    mockDb.studentFeeAccounts.push({ student_fee_id: "SFA-001", enrollment_id: "ENR-001" });
    mockDb.payments.push({ payment_id: "PAY-001", student_fee_id: "SFA-001", amount_paid: 10000, status: "success", payment_date: "2026-06-10" });

    mockDb.allocations.push({ allocation_id: "BAL-002", batch_id: "BTC-102", enrollment_id: "ENR-002", course_id: "CRS-002" });
    mockDb.enrollments["ENR-002"] = { enrollment_id: "ENR-002", enrollment_type: "course" };
    mockDb.studentFeeAccounts.push({ student_fee_id: "SFA-002", enrollment_id: "ENR-002" });
    mockDb.payments.push({ payment_id: "PAY-002", student_fee_id: "SFA-002", amount_paid: 20000, status: "success", payment_date: "2026-06-15" });

    const engine = new TeacherSalaryCalculationEngine(mockDb);
    const txs = engine.calculateTeacherPayroll("TCH-001", "2026-06");
    assert.strictEqual(txs.length, 2);
    
    txs.sort((a, b) => a.amount - b.amount);
    assert.strictEqual(txs[0].amount, 2500.00);
    assert.strictEqual(txs[1].amount, 4000.00);
    console.log("✅ Test 9: Independent multi-batch rate mapping passed.");
  })();

  // Test Case 10: Multi-Contract Hybrid Stacking Concurrent Execution
  (function() {
    resetDb();
    mockDb.teachers["TCH-001"] = { teacher_id: "TCH-001", full_name: "Rahul Baba" };
    
    mockDb.configs.push({
      salary_config_id: "TSC-STACK1",
      entity_id: "TCH-001",
      entity_type: "Teacher",
      salary_config_type: "recurring_monthly",
      effective_from: "2026-01-01",
      effective_to: null,
      rate_type: "monthly",
      base_value: 12000.00,
      scope_type: "global",
      scope_id: null,
      contract_status: "active",
      settlement_state: "unsettled"
    });

    mockDb.configs.push({
      salary_config_id: "TSC-STACK2",
      entity_id: "TCH-001",
      entity_type: "Teacher",
      salary_config_type: "recurring_monthly",
      effective_from: "2026-01-01",
      effective_to: null,
      rate_type: "monthly",
      base_value: 10000.00,
      scope_type: "batch_group",
      scope_id: '{"BTC-101":50,"BTC-102":50}',
      contract_status: "active",
      settlement_state: "unsettled"
    });

    const engine = new TeacherSalaryCalculationEngine(mockDb);
    const txs = engine.calculateTeacherPayroll("TCH-001", "2026-06");
    
    assert.strictEqual(txs.length, 3, "Engine must successfully compile multi-tiered hybrid stacked entries.");
    
    const combinedTotalAmount = txs.reduce((acc, row) => acc + row.amount, 0);
    assert.strictEqual(combinedTotalAmount, 22000.00, "Sum total of stacked items should be exactly ₹22,000.");
    console.log("✅ Test 10: Concurrent multi-contract stacking simulation passed.");
  })();

  // Test Case 11: Mid-Month Day Proration verification (Strategy B)
  (function() {
    resetDb();
    mockDb.teachers["TCH-001"] = { teacher_id: "TCH-001", full_name: "Rahul Baba" };
    
    mockDb.configs.push({
      salary_config_id: "TSC-PRORATE",
      entity_id: "TCH-001",
      entity_type: "Teacher",
      salary_config_type: "fixed_duration_pool",
      effective_from: "2026-06-16",
      effective_to: null,
      rate_type: "yearly",
      base_value: 120000.00,
      scope_type: "global",
      scope_id: null,
      contract_status: "active",
      settlement_state: "unsettled"
    });

    const engine = new TeacherSalaryCalculationEngine(mockDb);
    const txs = engine.calculateTeacherPayroll("TCH-001", "2026-06");
    assert.strictEqual(txs.length, 1);
    assert.strictEqual(txs[0].amount, 5000.00);
    console.log("✅ Test 11: Mid-month day proration calculation passed.");
  })();

  // Test Case 12: Package Enrollment with metadata.course_fees proportional split
  (function() {
    resetDb();

    mockDb.teachers["TCH-001"] = { teacher_id: "TCH-001", full_name: "Rahul Baba" };
    mockDb.configs.push({
      salary_config_id: "TSC-PKG",
      entity_id: "TCH-001",
      entity_type: "Teacher",
      salary_config_type: "recurring_monthly",
      effective_from: "2026-01-01",
      effective_to: null,
      rate_type: "revenue_percentage",
      base_value: 20.0,
      scope_type: "single_batch",
      scope_id: "BTC-101",
      contract_status: "active",
      settlement_state: "unsettled"
    });

    mockDb.enrollments["ENR-PKG"] = {
      enrollment_id: "ENR-PKG",
      enrollment_type: "package",
      metadata: {
        course_fees: {
          "CRS-PHY": 30000,
          "CRS-CHE": 70000
        }
      }
    };
    mockDb.allocations.push(
      { allocation_id: "BAL-PKG-1", batch_id: "BTC-101", enrollment_id: "ENR-PKG", course_id: "CRS-PHY" },
      { allocation_id: "BAL-PKG-2", batch_id: "BTC-102", enrollment_id: "ENR-PKG", course_id: "CRS-CHE" }
    );
    mockDb.studentFeeAccounts.push({ student_fee_id: "SFA-PKG", enrollment_id: "ENR-PKG" });
    mockDb.payments.push({ payment_id: "PAY-PKG", student_fee_id: "SFA-PKG", amount_paid: 10000, status: "success", payment_date: "2026-06-20" });

    const engine = new TeacherSalaryCalculationEngine(mockDb);
    const txs = engine.calculateTeacherPayroll("TCH-001", "2026-06");
    assert.strictEqual(txs.length, 1);
    assert.strictEqual(txs[0].amount, 600.00);
    console.log("✅ Test 12: Package enrollment proportional course_fees split calculation passed.");
  })();

  console.log("🎉 All TeacherSalaryCalculationEngine unit tests passed successfully!");
}

// Auto-run if executed directly via Node.js
if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  runTeacherSalaryCalculationTests();
}

globalThis.runTeacherSalaryCalculationTests = runTeacherSalaryCalculationTests;
