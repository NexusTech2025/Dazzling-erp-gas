/**
 * @file Staff_SalaryCalculationTests.js
 * Isolated Node.js Unit Test Suite verifying Polymorphic Bindings and the FSM State Interaction Matrix.
 * Path: DazzlingDB/NodeTest/Staff_SalaryCalculationTests.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// 1. Mock Google Apps Script environment properties for DBContext bootstrapping
global.PropertiesService = {
  getScriptProperties: () => {
    const store = { ENV: 'TESTING' };
    return {
      getProperty: (key) => store[key] || null,
      setProperties: (updates) => { Object.assign(store, updates); }
    };
  }
};
global.Utilities = {
  getUuid: () => Math.random().toString(36).substring(2, 10).toUpperCase()
};

// 2. Load SheetDB errors explicitly from SheetDB/Errors.js
const errorsPath = path.resolve(__dirname, '../../SheetDB/Errors.js');
const errorsCode = fs.readFileSync(errorsPath, 'utf8');
eval(errorsCode); // Defines SheetDBError, EntityNotFoundError, ValidationError, etc.

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

// 3. Load the Salary Calculation Engine
require('../DBServices/StaffService_TeacherSalaryCalculationEngine.js');

// =========================================================================
// DATABASE PRINTING VISUALIZER HELPER
// =========================================================================

function printTable(title, headers, rows) {
  console.log(`\n+${'-'.repeat(100)}+`);
  console.log(`| ${title.padEnd(98)} |`);
  console.log(`+${'-'.repeat(100)}+`);
  
  const colWidths = headers.map((h, i) => {
    const maxValLen = rows.reduce((max, r) => Math.max(max, String(r[i] !== undefined ? r[i] : '').length), 0);
    return Math.max(h.length, maxValLen) + 2;
  });

  const headerStr = headers.map((h, i) => h.padEnd(colWidths[i])).join('| ');
  console.log(`| ${headerStr.padEnd(98)} |`);
  console.log(`+${colWidths.map(w => '-'.repeat(w)).join('+')}+`);

  rows.forEach(r => {
    const rowStr = r.map((val, i) => String(val !== undefined ? val : '').padEnd(colWidths[i])).join('| ');
    console.log(`| ${rowStr.padEnd(98)} |`);
  });
  console.log(`+${'-'.repeat(100)}+\n`);
}

// =========================================================================
// RUN TEST SUITE
// =========================================================================

function runStaffSalaryCalculationTests() {
  console.log("🚀 Bootstrapping Isolated FSM state matrix tests...");

  // Mock Database Setup
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

  // =========================================================================
  // PHASE 0: Seed In-Memory Database
  // =========================================================================
  console.log("\n=== Phase 0: Seeding In-Memory Mock Database ===");
  
  // Seed 5 Teachers
  const teacherRows = [];
  for (let i = 1; i <= 5; i++) {
    const tId = `TCH-M0${i}`;
    mockDb.teachers[tId] = {
      teacher_id: tId,
      full_name: `Mock Instructor ${i}`,
      mobile_number: `900000000${i}`,
      email: `teacher${i}@test.com`
    };
    teacherRows.push([tId, mockDb.teachers[tId].full_name, mockDb.teachers[tId].mobile_number, mockDb.teachers[tId].email]);
  }
  printTable("Seeded Teachers Table (In-Memory)", ["ID", "Full Name", "Mobile Number", "Email"], teacherRows);

  // Seed 10 Batches allocated to these teachers
  const batchRows = [];
  for (let i = 1; i <= 10; i++) {
    const teacherIdx = (i - 1) % 5 + 1;
    batchRows.push([`BAT-M${String(i).padStart(2, '0')}`, `Morning Alpha Class ${i}`, `TCH-M0${teacherIdx}`, "active"]);
  }
  printTable("Seeded Batches Table (In-Memory)", ["ID", "Batch Name", "Teacher ID", "Status"], batchRows);

  // =========================================================================
  // PHASE 1: Architectural validations
  // =========================================================================
  console.log("=== Phase 1: Running Architectural Integrity Tests ===");

  // TC-1.1: Dynamic Schema Metadata Validation (Zero-Hardcoding Guard)
  // Ensure that no logic file hardcodes "TSC-" or "TCH-" inside executable lines
  const calculationEngineCode = fs.readFileSync(path.resolve(__dirname, '../DBServices/StaffService_TeacherSalaryCalculationEngine.js'), 'utf8');
  const cleanEngineCode = calculationEngineCode.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '');
  assert.strictEqual(cleanEngineCode.includes("TSC-"), false, "Calculation Engine must not hardcode 'TSC-' ID prefixes.");
  assert.strictEqual(cleanEngineCode.includes("TCH-"), false, "Calculation Engine must not hardcode 'TCH-' ID prefixes.");
  console.log("✅ TC-1.1 Dynamic Schema Metadata prefix safeguard checks passed.");

  // =========================================================================
  // PHASE 2: State Interaction Matrix Testing (10 Permutations)
  // =========================================================================
  console.log("=== Phase 2: Running FSM State Interaction Matrix Tests ===");

  const engine = new TeacherSalaryCalculationEngine(mockDb);

  const testPermutation = (testId, status, state, expectedTxsCount, expectedAmount, arrearsDelta = 0, seedHistory = false) => {
    // 1. Cleanup old configurations
    mockDb.configs = [];
    mockDb.paymentTransactions = [];

    // 2. Insert test target configuration
    mockDb.configs.push({
      salary_config_id: `TSC-${testId}`,
      entity_type: "Teacher",
      entity_id: "TCH-M02",
      salary_config_type: "recurring_monthly",
      effective_from: "2026-05-01",
      effective_to: status === "expired" || status === "terminated" ? "2026-05-31" : null,
      rate_type: "monthly",
      base_value: 20000,
      scope_type: "global",
      contract_status: status,
      settlement_state: state
    });

    // 3. Seed historical payouts if specified
    if (seedHistory) {
      if (state === "settled") {
        mockDb.paymentTransactions.push({
          transaction_id: `TPT-${testId}-1`,
          salary_config_id: `TSC-${testId}`,
          amount: 20000.00
        });
      } else if (state === "arrears_due") {
        mockDb.paymentTransactions.push({
          transaction_id: `TPT-${testId}-1`,
          salary_config_id: `TSC-${testId}`,
          amount: 20000.00 - arrearsDelta
        });
      }
    }

    // 4. Print current test configurations table
    const configRows = mockDb.configs.map(c => [c.salary_config_id, c.entity_id, c.contract_status, c.settlement_state, c.base_value]);
    printTable(`FSM Config Inputs - ${testId}`, ["Config ID", "Entity ID", "Status", "Settlement", "Base Value"], configRows);

    // 5. Execute calculations engine
    const txs = engine.calculateTeacherPayroll("TCH-M02", "2026-06");

    // 6. Output calculation trace logs in table form
    const rows = txs.map(t => [t.salary_config_id, t.payment_type, t.amount, t.salary_month, t.notes]);
    printTable(`Matrix Output Trace - ${testId} (Status: ${status} | Settlement: ${state})`, ["Config ID", "Type", "Amount", "Month", "Notes"], rows);

    // 6. Assert outputs
    assert.strictEqual(txs.length, expectedTxsCount, `Expected ${expectedTxsCount} transactions generated.`);
    if (expectedTxsCount > 0) {
      const totalAmount = txs.reduce((acc, t) => acc + t.amount, 0);
      assert.strictEqual(totalAmount, expectedAmount, `Expected total amount to be ₹${expectedAmount}.`);
    }
    console.log(`✅ ${testId} state permutation check passed.`);
  };

  // Run Matrix Permutations (TC-M01 to TC-M10)
  testPermutation("TC-M01", "drafted", "unsettled", 0, 0);
  testPermutation("TC-M02", "active", "unsettled", 1, 20000);
  testPermutation("TC-M03", "active", "settled", 0, 0, 0, true);
  testPermutation("TC-M04", "active", "arrears_due", 1, 20000, 5000, true);
  testPermutation("TC-M05", "expired", "settled", 0, 0, 0, true);
  testPermutation("TC-M06", "expired", "arrears_due", 1, 8000, 8000, true);
  testPermutation("TC-M07", "terminated", "settled", 0, 0, 0, true);
  testPermutation("TC-M08", "terminated", "arrears_due", 1, 5000, 5000, true);
  testPermutation("TC-M09", "voided", "settled", 0, 0);
  testPermutation("TC-M10", "voided", "arrears_due", 0, 0);

  // =========================================================================
  // ARCHITECTURAL SWEEP: CLOSING 5 CRITICAL MATRIX PERMUTATION GAPS
  // =========================================================================

  /**
   * TC-M11: drafted + settled
   * Context: Erroneous financial allocation against a non-approved draft contract.
   * Expectation: The calculation engine must completely bypass the configuration.
   */
  testPermutation("TC-M11", "drafted", "settled", 0, 0);

  /**
   * TC-M12: drafted + arrears_due
   * Context: Historical or system-drift liability attached to an unapproved draft.
   * Expectation: Obligations remain blocked from processing; returns 0 pay items.
   */
  testPermutation("TC-M12", "drafted", "arrears_due", 0, 0);

  /**
   * TC-M13: expired + unsettled
   * Context: Chronologically out-of-bounds record that missed its reconciliation pass.
   * Expectation: Blocked from current cycle processing; no current generation allowed.
   */
  testPermutation("TC-M13", "expired", "unsettled", 0, 0);

  /**
   * TC-M14: terminated + unsettled
   * Context: Contract short-closed by an admin event without immediate severance allocation.
   * Expectation: Excluded from active looping; requires explicit calculation to settle.
   */
  testPermutation("TC-M14", "terminated", "unsettled", 0, 0);

  /**
   * TC-M15: voided + unsettled
   * Context: Soft-deleted administrative entry error marked with a lingering unsettled flag.
   * Expectation: Complete structural invisibility. Zero items processed or surfaced.
   */
  testPermutation("TC-M15", "voided", "unsettled", 0, 0);

  console.log("\n🎉 All polymorphic FSM unit test assertions passed successfully!");
}

runStaffSalaryCalculationTests();
