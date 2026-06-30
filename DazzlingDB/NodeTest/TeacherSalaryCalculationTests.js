/**
 * @file TeacherSalaryCalculationTests.js
 * Isolated Unit Test Suite for Teacher Salary Calculation Engine (Node.js Environment).
 * Path: DazzlingDB/NodeTest/TeacherSalaryCalculationTests.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// 1. Load SheetDB errors explicitly into the global environment
const errorsPath = path.resolve(__dirname, '../../SheetDB/Errors.js');
const errorsCode = fs.readFileSync(errorsPath, 'utf8');
eval(errorsCode); // Defines SheetDBError, EntityNotFoundError, ValidationError, etc.

// Expose them explicitly on the global SheetDB namespace
global.SheetDB = {
  SheetDBError,
  SpreadsheetNotFoundError,
  TableNotFoundError,
  EntityNotFoundError,
  ValidationError,
  FieldError,
  ConflictError,
  IntegrityError,
  ForbiddenError
};

// 2. Load the Salary Calculation Engine
require('../DBServices/StaffService_TeacherSalaryCalculationEngine.js');

function runTeacherSalaryCalculationTests() {
  console.log("🚀 Starting TeacherSalaryCalculationEngine Unit Tests (Node.js Environment)...");

  // Mock Database Gateway setup for isolated in-memory test execution
  const mockDb = {
    teachers: {},
    configs: [],
    transactions: [],
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
    
    MoneyTransaction: {
      where: function(filter) {
        if (!filter || typeof filter.batch_id !== 'string' || filter.status !== 'cleared') {
          throw new Error("where() expects an equality filter object");
        }
        return mockDb.transactions.filter(t => t.batch_id === filter.batch_id && t.status === filter.status);
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

  // Test Case 1: Teacher Not Found Exception
  (function() {
    const engine = new TeacherSalaryCalculationEngine(mockDb);
    assert.throws(
      function() { engine.calculateTeacherPayroll("TCH-INVALID", "2026-06"); },
      SheetDB.EntityNotFoundError
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
    mockDb.teachers = {};
    mockDb.configs = [];
    mockDb.transactions = [];

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
    mockDb.teachers = {};
    mockDb.configs = [];
    mockDb.transactions = [];

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

  // Test Case 5: Strategy C - Variable revenue_percentage strategy
  (function() {
    mockDb.teachers = {};
    mockDb.configs = [];
    mockDb.transactions = [];

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

    mockDb.transactions.push(
      { transaction_id: "MTR-001", batch_id: "BTC-101", amount: 5000, status: "cleared", transaction_date: "2026-06-10" },
      { transaction_id: "MTR-002", batch_id: "BTC-101", amount: 3000, status: "cleared", transaction_date: "2026-06-15" },
      { transaction_id: "MTR-003", batch_id: "BTC-101", amount: 4000, status: "cleared", transaction_date: "2026-07-01" },
      { transaction_id: "MTR-004", batch_id: "BTC-102", amount: 2000, status: "cleared", transaction_date: "2026-06-20" },
      { transaction_id: "MTR-005", batch_id: "BTC-101", amount: 1000, status: "pending", transaction_date: "2026-06-25" }
    );

    const engine = new TeacherSalaryCalculationEngine(mockDb);
    const txs = engine.calculateTeacherPayroll("TCH-001", "2026-06");
    assert.strictEqual(txs.length, 1);
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
      entity_id: "TCH-001",
      entity_type: "Teacher",
      salary_config_type: "recurring_monthly",
      effective_from: "2026-01-01",
      effective_to: null,
      rate_type: "monthly",
      base_value: 10000.00,
      scope_type: "batch_group",
      scope_id: '{"BTC-101":60,"BTC-102":50}',
      contract_status: "active",
      settlement_state: "unsettled"
    });

    const engine = new TeacherSalaryCalculationEngine(mockDb);
    assert.throws(
      function() { engine.calculateTeacherPayroll("TCH-001", "2026-06"); },
      /weightage total must equal 100%/
    );
    console.log("✅ Test 6: Invalid weights sum validation exception passed.");
  })();

  // Test Case 7: Temporal Boundaries Verification (Skipping Expired/Settled Contracts)
  (function() {
    mockDb.teachers = {}; mockDb.configs = []; mockDb.transactions = [];
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
    mockDb.teachers = {}; mockDb.configs = []; mockDb.transactions = [];
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

  // Test Case 9: Strategy C - Combined Revenue Percentage with Weighted Batch Groups
  (function() {
    mockDb.teachers = {}; mockDb.configs = []; mockDb.transactions = [];
    mockDb.teachers["TCH-001"] = { teacher_id: "TCH-001", full_name: "Rahul Baba" };
    mockDb.configs.push({
      salary_config_id: "TSC-REV-WEIGHT",
      entity_id: "TCH-001",
      entity_type: "Teacher",
      salary_config_type: "recurring_monthly",
      effective_from: "2026-01-01",
      effective_to: null,
      rate_type: "revenue_percentage",
      base_value: 10.0,
      scope_type: "batch_group",
      scope_id: '{"BTC-101":70,"BTC-102":30}',
      contract_status: "active",
      settlement_state: "unsettled"
    });

    mockDb.transactions.push(
      { transaction_id: "MTR-A", batch_id: "BTC-101", amount: 10000, status: "cleared", transaction_date: "2026-06-10" },
      { transaction_id: "MTR-B", batch_id: "BTC-102", amount: 20000, status: "cleared", transaction_date: "2026-06-15" }
    );

    const engine = new TeacherSalaryCalculationEngine(mockDb);
    const txs = engine.calculateTeacherPayroll("TCH-001", "2026-06");
    assert.strictEqual(txs.length, 2);
    
    txs.sort((a, b) => a.amount - b.amount);
    assert.strictEqual(txs[0].amount, 600.00);
    assert.strictEqual(txs[1].amount, 700.00);
    console.log("✅ Test 9: Complex revenue share mapping weight passed.");
  })();

  // Test Case 10: Multi-Contract Hybrid Stacking Concurrent Execution
  (function() {
    mockDb.teachers = {}; mockDb.configs = []; mockDb.transactions = [];
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
    assert.strictEqual(txs.length, 3);
    
    const combinedTotalAmount = txs.reduce((acc, row) => acc + row.amount, 0);
    assert.strictEqual(combinedTotalAmount, 22000.00);
    console.log("✅ Test 10: Stacked contracts concurrency simulation passed.");
  })();

  // Test Case 11: Mid-Month Day Proration verification
  (function() {
    mockDb.teachers = {}; mockDb.configs = []; mockDb.transactions = [];
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

  // Test Case 12: Arrears Evaluation Policy Verification (Expired + Arrears Due)
  (function() {
    mockDb.teachers = {}; mockDb.configs = []; mockDb.paymentTransactions = [];
    mockDb.teachers["TCH-001"] = { teacher_id: "TCH-001", full_name: "Rahul Baba" };

    // Config valid for January and February (2 months)
    mockDb.configs.push({
      salary_config_id: "TSC-ARREARS-1",
      entity_id: "TCH-001",
      entity_type: "Teacher",
      salary_config_type: "recurring_monthly",
      effective_from: "2026-01-01",
      effective_to: "2026-02-28",
      rate_type: "monthly",
      base_value: 10000.00, // Expected 10,000 * 2 = 20,000 total
      scope_type: "global",
      scope_id: null,
      contract_status: "expired",
      settlement_state: "arrears_due"
    });

    // Seed transaction payouts representing partial payouts (₹15,000 paid total, ₹5,000 outstanding)
    mockDb.paymentTransactions.push(
      { transaction_id: "TPT-001", salary_config_id: "TSC-ARREARS-1", amount: 15000.00 }
    );

    const engine = new TeacherSalaryCalculationEngine(mockDb);
    const txs = engine.calculateTeacherPayroll("TCH-001", "2026-06");
    assert.strictEqual(txs.length, 1);
    assert.strictEqual(txs[0].amount, 5000.00); // 20,000 expected - 15,000 paid = 5,000 arrears due
    assert.ok(txs[0].notes.indexOf("Arrears settlement payout") !== -1);
    console.log("✅ Test 12: Arrears evaluation policy calculation passed.");
  })();

  console.log("🎉 All TeacherSalaryCalculationEngine unit tests passed successfully!");
}

runTeacherSalaryCalculationTests();
