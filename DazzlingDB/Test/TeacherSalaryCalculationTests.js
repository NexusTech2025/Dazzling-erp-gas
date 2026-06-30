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
        if (!expectedRegex.test(err.message)) {
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
    transactions: [],
    
    Teacher: {
      findById: function(id) {
        return mockDb.teachers[id] || null;
      }
    },
    
    TeacherSalaryConfig: {
      where: function(filter) {
        if (!filter || typeof filter.teacher_id !== 'string') {
          throw new Error("where() expects an equality filter object");
        }
        return mockDb.configs.filter(c => c.teacher_id === filter.teacher_id);
      }
    },
    
    MoneyTransaction: {
      where: function(filter) {
        if (!filter || typeof filter.batch_id !== 'string' || filter.status !== 'cleared') {
          throw new Error("where() expects an equality filter object");
        }
        return mockDb.transactions.filter(t => t.batch_id === filter.batch_id && t.status === filter.status);
      }
    }
  };

  // Test Case 1: Teacher Not Found Exception
  (function() {
    const engine = new TeacherSalaryCalculationEngine(mockDb);
    assert.throws(
      function() { engine.calculateTeacherPayroll("TCH-INVALID", "2026-06"); },
      /Teacher record 'TCH-INVALID' not found/
    );
    console.log("✅ Test 1: Teacher Not Found exception passed.");
  })();

  // Test Case 2: Strategy A - Flat monthly global configuration
  (function() {
    mockDb.teachers = {};
    mockDb.configs = [];
    mockDb.transactions = [];

    mockDb.teachers["TCH-001"] = { teacher_id: "TCH-001", full_name: "Rahul Baba" };
    mockDb.configs.push({
      salary_config_id: "TSC-001",
      teacher_id: "TCH-001",
      salary_config_type: "recurring_monthly",
      effective_from: "2026-01-01",
      effective_to: null,
      rate_type: "monthly",
      base_value: 15000.00,
      scope_type: "global",
      scope_id: null
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
    mockDb.teachers = {};
    mockDb.configs = [];
    mockDb.transactions = [];

    mockDb.teachers["TCH-001"] = { teacher_id: "TCH-001", full_name: "Rahul Baba" };
    mockDb.configs.push({
      salary_config_id: "TSC-002",
      teacher_id: "TCH-001",
      salary_config_type: "recurring_monthly",
      effective_from: "2026-01-01",
      effective_to: null,
      rate_type: "monthly",
      base_value: 10000.00,
      scope_type: "batch_group",
      scope_id: '{"BTC-101":60,"BTC-102":40}'
    });

    const engine = new TeacherSalaryCalculationEngine(mockDb);
    const txs = engine.calculateTeacherPayroll("TCH-001", "2026-06");
    assert.strictEqual(txs.length, 2);
    
    // Sort transactions by batch note for deterministic assertion
    txs.sort((a, b) => a.notes.localeCompare(b.notes));
    
    assert.strictEqual(txs[0].amount, 6000.00);
    assert.ok(txs[0].notes.indexOf("BTC-101") !== -1);
    assert.strictEqual(txs[1].amount, 4000.00);
    assert.ok(txs[1].notes.indexOf("BTC-102") !== -1);
    console.log("✅ Test 3: Flat monthly batch_group split calculation passed.");
  })();

  // Test Case 4: Strategy B - Amortized yearly strategy
  (function() {
    mockDb.teachers = {};
    mockDb.configs = [];
    mockDb.transactions = [];

    mockDb.teachers["TCH-001"] = { teacher_id: "TCH-001", full_name: "Rahul Baba" };
    mockDb.configs.push({
      salary_config_id: "TSC-003",
      teacher_id: "TCH-001",
      salary_config_type: "fixed_duration_pool",
      effective_from: "2026-01-01",
      effective_to: "2026-12-31",
      rate_type: "yearly",
      base_value: 120000.00,
      scope_type: "global",
      scope_id: null
    });

    const engine = new TeacherSalaryCalculationEngine(mockDb);
    const txs = engine.calculateTeacherPayroll("TCH-001", "2026-06");
    assert.strictEqual(txs.length, 1);
    assert.strictEqual(txs[0].amount, 10000.00); // 120,000 / 12
    console.log("✅ Test 4: Amortized yearly strategy calculation passed.");
  })();

  // Test Case 5: Strategy C - Variable revenue_percentage strategy
  (function() {
    mockDb.teachers = {};
    mockDb.configs = [];
    mockDb.transactions = [];

    mockDb.teachers["TCH-001"] = { teacher_id: "TCH-001", full_name: "Rahul Baba" };
    mockDb.configs.push({
      salary_config_id: "TSC-004",
      teacher_id: "TCH-001",
      salary_config_type: "recurring_monthly",
      effective_from: "2026-06-01",
      effective_to: "2026-11-30",
      rate_type: "revenue_percentage",
      base_value: 20.0,
      scope_type: "single_batch",
      scope_id: "BTC-101"
    });

    // Seed money transactions
    mockDb.transactions.push(
      { transaction_id: "MTR-001", batch_id: "BTC-101", amount: 5000, status: "cleared", transaction_date: "2026-06-10" },
      { transaction_id: "MTR-002", batch_id: "BTC-101", amount: 3000, status: "cleared", transaction_date: "2026-06-15" },
      // Same batch but next month (should be ignored)
      { transaction_id: "MTR-003", batch_id: "BTC-101", amount: 4000, status: "cleared", transaction_date: "2026-07-01" },
      // Different batch same month (should be ignored)
      { transaction_id: "MTR-004", batch_id: "BTC-102", amount: 2000, status: "cleared", transaction_date: "2026-06-20" },
      // Uncleared payment (should be ignored)
      { transaction_id: "MTR-005", batch_id: "BTC-101", amount: 1000, status: "pending", transaction_date: "2026-06-25" }
    );

    const engine = new TeacherSalaryCalculationEngine(mockDb);
    const txs = engine.calculateTeacherPayroll("TCH-001", "2026-06");
    assert.strictEqual(txs.length, 1);
    // Cleared revenue for BTC-101 in June = 5000 + 3000 = 8000. 20% of 8000 = 1600.
    assert.strictEqual(txs[0].amount, 1600.00);
    console.log("✅ Test 5: Variable revenue_percentage strategy calculation passed.");
  })();

  // Test Case 6: Invalid Weights Validation Failure
  (function() {
    mockDb.teachers = {};
    mockDb.configs = [];
    mockDb.transactions = [];

    mockDb.teachers["TCH-001"] = { teacher_id: "TCH-001", full_name: "Rahul Baba" };
    mockDb.configs.push({
      salary_config_id: "TSC-005",
      teacher_id: "TCH-001",
      salary_config_type: "recurring_monthly",
      effective_from: "2026-01-01",
      effective_to: null,
      rate_type: "monthly",
      base_value: 10000.00,
      scope_type: "batch_group",
      scope_id: '{"BTC-101":60,"BTC-102":50}' // Sums to 110%
    });

    const engine = new TeacherSalaryCalculationEngine(mockDb);
    assert.throws(
      function() { engine.calculateTeacherPayroll("TCH-001", "2026-06"); },
      /weightage total must equal 100%/
    );
    console.log("✅ Test 6: Invalid weights sum validation exception passed.");
  })();

  // Test Case 7: Temporal Boundaries Verification (Skipping Expired Contracts)
  (function() {
    mockDb.teachers = {}; mockDb.configs = []; mockDb.transactions = [];
    mockDb.teachers["TCH-001"] = { teacher_id: "TCH-001", full_name: "Rahul Baba" };
    
    // Contract expired in May 2026
    mockDb.configs.push({
      salary_config_id: "TSC-EXP",
      teacher_id: "TCH-001",
      salary_config_type: "fixed_duration_pool",
      effective_from: "2026-01-01",
      effective_to: "2026-05-31",
      rate_type: "monthly",
      base_value: 20000.00,
      scope_type: "global",
      scope_id: null
    });

    const engine = new TeacherSalaryCalculationEngine(mockDb);
    const txs = engine.calculateTeacherPayroll("TCH-001", "2026-06"); // Processing June
    assert.strictEqual(txs.length, 0, "Expired contract must not generate payroll lines.");
    console.log("✅ Test 7: Temporal boundary expiration parsing passed.");
  })();

  // Test Case 8: Malformed JSON Syntax Handling
  (function() {
    mockDb.teachers = {}; mockDb.configs = []; mockDb.transactions = [];
    mockDb.teachers["TCH-001"] = { teacher_id: "TCH-001", full_name: "Rahul Baba" };
    mockDb.configs.push({
      salary_config_id: "TSC-MAL",
      teacher_id: "TCH-001",
      salary_config_type: "recurring_monthly",
      effective_from: "2026-01-01",
      effective_to: null,
      rate_type: "monthly",
      base_value: 10000.00,
      scope_type: "batch_group",
      scope_id: '{"BTC-101":60, "corrupted_syntax": }' // Malformed JSON string
    });

    const engine = new TeacherSalaryCalculationEngine(mockDb);
    assert.throws(
      function() { engine.calculateTeacherPayroll("TCH-001", "2026-06"); },
      /valid JSON/i,
      "Engine must throw a descriptive exception when parsing invalid scope JSON structures."
    );
    console.log("✅ Test 8: Malformed scope_id JSON catch exception passed.");
  })();

  // Test Case 9: Strategy C - Combined Revenue Percentage with Weighted Batch Groups
  (function() {
    mockDb.teachers = {}; mockDb.configs = []; mockDb.transactions = [];
    mockDb.teachers["TCH-001"] = { teacher_id: "TCH-001", full_name: "Rahul Baba" };
    mockDb.configs.push({
      salary_config_id: "TSC-REV-WEIGHT",
      teacher_id: "TCH-001",
      salary_config_type: "recurring_monthly",
      effective_from: "2026-01-01",
      effective_to: null,
      rate_type: "revenue_percentage",
      base_value: 10.0, // 10% overall share cut
      scope_type: "batch_group",
      scope_id: '{"BTC-101":70,"BTC-102":30}' // Distributed weights across pools
    });

    // Seed transaction allocations for both batches in June
    mockDb.transactions.push(
      { transaction_id: "MTR-A", batch_id: "BTC-101", amount: 10000, status: "cleared", transaction_date: "2026-06-10" }, // 10% of 10000 * 70% = 700
      { transaction_id: "MTR-B", batch_id: "BTC-102", amount: 20000, status: "cleared", transaction_date: "2026-06-15" }  // 10% of 20000 * 30% = 600
    );

    const engine = new TeacherSalaryCalculationEngine(mockDb);
    const txs = engine.calculateTeacherPayroll("TCH-001", "2026-06");
    assert.strictEqual(txs.length, 2);
    
    txs.sort((a, b) => a.amount - b.amount); // Deterministic ordering
    assert.strictEqual(txs[0].amount, 600.00, "BTC-102 line should evaluate to exactly 600.");
    assert.strictEqual(txs[1].amount, 700.00, "BTC-101 line should evaluate to exactly 700.");
    console.log("✅ Test 9: Complex revenue share mapping with multi-batch weights passed.");
  })();

  // Test Case 10: Multi-Contract Hybrid Stacking Concurrent Execution
  (function() {
    mockDb.teachers = {}; mockDb.configs = []; mockDb.transactions = [];
    mockDb.teachers["TCH-001"] = { teacher_id: "TCH-001", full_name: "Rahul Baba" };
    
    // Config 1: Flat global monthly allocation
    mockDb.configs.push({
      salary_config_id: "TSC-STACK1",
      teacher_id: "TCH-001",
      salary_config_type: "recurring_monthly",
      effective_from: "2026-01-01",
      effective_to: null,
      rate_type: "monthly",
      base_value: 12000.00,
      scope_type: "global",
      scope_id: null
    });

    // Config 2: Weighted batch groups running simultaneously
    mockDb.configs.push({
      salary_config_id: "TSC-STACK2",
      teacher_id: "TCH-001",
      salary_config_type: "recurring_monthly",
      effective_from: "2026-01-01",
      effective_to: null,
      rate_type: "monthly",
      base_value: 10000.00,
      scope_type: "batch_group",
      scope_id: '{"BTC-101":50,"BTC-102":50}'
    });

    const engine = new TeacherSalaryCalculationEngine(mockDb);
    const txs = engine.calculateTeacherPayroll("TCH-001", "2026-06");
    
    // Output check: should yield 1 global line item + 2 weighted split lines = 3 transactions total
    assert.strictEqual(txs.length, 3, "Engine must successfully compile multi-tiered hybrid stacked entries.");
    
    const combinedTotalAmount = txs.reduce((acc, row) => acc + row.amount, 0);
    assert.strictEqual(combinedTotalAmount, 22000.00, "Sum total of stacked items should be exactly ₹22,000.");
    console.log("✅ Test 10: Concurrent multi-contract stacking simulation passed.");
  })();

  // Test Case 11: Mid-Month Day Proration verification (Strategy B)
  (function() {
    mockDb.teachers = {}; mockDb.configs = []; mockDb.transactions = [];
    mockDb.teachers["TCH-001"] = { teacher_id: "TCH-001", full_name: "Rahul Baba" };
    
    // Contract starts mid-month: June 16, 2026.
    // June 2026 has 30 days. Active days: 15 days (June 16 to June 30).
    mockDb.configs.push({
      salary_config_id: "TSC-PRORATE",
      teacher_id: "TCH-001",
      salary_config_type: "fixed_duration_pool",
      effective_from: "2026-06-16",
      effective_to: null,
      rate_type: "yearly",
      base_value: 120000.00, // Monthly draw base: 10,000
      scope_type: "global",
      scope_id: null
    });

    const engine = new TeacherSalaryCalculationEngine(mockDb);
    const txs = engine.calculateTeacherPayroll("TCH-001", "2026-06");
    assert.strictEqual(txs.length, 1);
    // 10,000 * (15 / 30) = 5,000
    assert.strictEqual(txs[0].amount, 5000.00);
    console.log("✅ Test 11: Mid-month day proration calculation passed.");
  })();

  console.log("🎉 All TeacherSalaryCalculationEngine unit tests passed successfully!");
}

// Auto-run if executed directly via Node.js
if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  runTeacherSalaryCalculationTests();
}
