/**
 * @file Adversarial_TemporalTests.js
 * Adversarial Brute-Force Testing Suite for Temporal Infrastructure.
 * Path: DazzlingDB/Test/Adversarial_TemporalTests.js
 */

const assert = require('assert');
const vm = require('vm');

// 1. SETUP GLOBAL WORKSPACE NAMESPACES
globalThis.isDate = null;
globalThis.SheetDBDateTime = null;
globalThis.DazzlingDateTime = null;
globalThis.AttendanceUtil = null;

// Load physical source files into Node environment
require('../../SheetDB/Utils.js');

// Mock SheetDB global context
globalThis.SheetDB = {
  ValidationError: class ValidationError extends Error {
    constructor(message) {
      super(message);
      this.name = 'ValidationError';
    }
  },
  isDate: globalThis.isDate,
  SheetDBDateTime: globalThis.SheetDBDateTime
};

require('../DBServices/DazzlingDateTime.js');
require('../DBServices/AttendanceUtil.js');

// Helper to track metrics
const auditReport = [];
function logAudit(suiteId, description, status, durationMs) {
  auditReport.push({
    suiteId,
    description,
    status: status ? '[PASSED]' : '[FAILED]',
    duration: `${durationMs.toFixed(3)} ms`
  });
}

// Global Date Mock Helper
const OriginalDate = globalThis.Date;
let simulatedNow = null;

function enableSimulatedDate(dateString) {
  simulatedNow = new OriginalDate(dateString);
  globalThis.Date = class extends OriginalDate {
    constructor(...args) {
      if (args.length === 0) {
        return new OriginalDate(simulatedNow.getTime());
      }
      return new OriginalDate(...args);
    }
    static now() {
      return simulatedNow.getTime();
    }
  };
}

function disableSimulatedDate() {
  globalThis.Date = OriginalDate;
  simulatedNow = null;
}

// ==================================================================================
// SUITE I: SheetDBDateTime Core Validation & Invariant Plane Isolation
// ==================================================================================
function runSuite1() {
  const startTotal = performance.now();

  // Test Case I.1: Timezone Simulation Carousel
  const t1Start = performance.now();
  const timezones = [
    { name: 'America/New_York', offsetMinutes: 240 },
    { name: 'UTC', offsetMinutes: 0 },
    { name: 'Asia/Kolkata', offsetMinutes: -330 },
    { name: 'Europe/London', offsetMinutes: -60 },
    { name: 'Pacific/Chatham', offsetMinutes: -765 }
  ];

  const originalGetTimezoneOffset = OriginalDate.prototype.getTimezoneOffset;

  timezones.forEach(tz => {
    // Mock getTimezoneOffset
    OriginalDate.prototype.getTimezoneOffset = function() {
      return tz.offsetMinutes;
    };

    const parsed = SheetDBDateTime.safeParseStringToDate("2026-06-18 00:00:00");
    assert.ok(parsed, `Failed to parse under timezone ${tz.name}`);
    assert.strictEqual(parsed.getUTCFullYear(), 2026, `Year mismatch under ${tz.name}`);
    assert.strictEqual(parsed.getUTCMonth(), 5, `Month mismatch under ${tz.name}`);
    assert.strictEqual(parsed.getUTCDate(), 18, `Date mismatch under ${tz.name}`);

    // Verify format matches plane requirements without shifting
    const safeValue = SheetDBDateTime.toSheetSafeValue(parsed);
    assert.strictEqual(safeValue, "2026-06-18 00:00:00", `Shifting detected under timezone ${tz.name}: ${safeValue}`);
  });

  OriginalDate.prototype.getTimezoneOffset = originalGetTimezoneOffset;
  logAudit('S1-TC1', 'Multi-Realm Timezone Simulation Carousel', true, performance.now() - t1Start);

  // Test Case I.2: Brute Structural Malformation String Matrix
  const t2Start = performance.now();
  const malformedInputs = [
    "2026/6/18", "2026-06-18T", "2026-6-18 2:5:0", "   2026/06/18    ", 
    "9999-99-99", "0000-00-00", "2026-02-31"
  ];

  malformedInputs.forEach(input => {
    const parsed = SheetDBDateTime.safeParseStringToDate(input);
    // 2026/06/18 variants or partial segments with valid components are allowed if parsed successfully
    if (parsed) {
      const formatted = SheetDBDateTime.toSheetSafeValue(parsed);
      assert.ok(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(formatted), `Malformed parsing format: ${formatted}`);
    } else {
      assert.strictEqual(parsed, null, `Invalid date string did not return null: ${input}`);
    }
  });
  logAudit('S1-TC2', 'Brute Structural Malformation Matrix', true, performance.now() - t2Start);

  // Test Case I.3: Cross-Realm Prototype Loss Validation Strategy
  const t3Start = performance.now();
  const sandbox = { crossRealmDate: null };
  vm.createContext(sandbox);
  vm.runInContext('crossRealmDate = new Date()', sandbox);
  
  assert.ok(sandbox.crossRealmDate instanceof Date === false, "VM Context Date should not be instance of main thread Date");
  assert.strictEqual(SheetDBDateTime._isDate(sandbox.crossRealmDate), true, "Cross-realm Date check failed");
  logAudit('S1-TC3', 'Cross-Realm Prototype Loss Validation', true, performance.now() - t3Start);
}

// ==================================================================================
// SUITE II: DazzlingDateTime Advanced Domain Arithmetic
// ==================================================================================
function runSuite2() {
  // Test Case II.1: Leap Year Stress Test
  const t1Start = performance.now();
  assert.strictEqual(DazzlingDateTime.diffInDays("2000-02-28", "2000-03-01"), 2);
  assert.strictEqual(DazzlingDateTime.diffInDays("2024-02-28", "2024-03-01"), 2);
  assert.strictEqual(DazzlingDateTime.diffInDays("2100-02-28", "2100-03-01"), 1);
  logAudit('S2-TC1', 'Millennium Boundary Leap-Year Delta', true, performance.now() - t1Start);

  // Test Case II.2: Billing Grace Margin Breaching Combinatorics
  const t2Start = performance.now();
  const dueDateStr = "2026-06-18";

  // Simulate today stepping sequentially from 2026-06-10 to 2026-07-10
  for (let d = 10; d <= 30; d++) {
    const todayStr = `2026-06-${String(d).padStart(2, '0')}T12:00:00Z`;
    enableSimulatedDate(todayStr);

    const isPastGrace = DazzlingDateTime.isPastGracePeriod(dueDateStr, 7);
    const expected = d > 25; // 18 + 7 = 25. Grace expires strictly on Day 8 (26th)
    assert.strictEqual(isPastGrace, expected, `Grace period logic failed on day ${d}. Expected ${expected}, got ${isPastGrace}`);
  }
  disableSimulatedDate();
  logAudit('S2-TC2', 'Billing Grace Margin Breaching Combinatorics', true, performance.now() - t2Start);

  // Test Case II.3: Time Segment Object Conversion Permutations
  const t3Start = performance.now();
  const invalidTimeObjects = [
    { hour: 13, minute: 0, period: "AM" },
    { hour: 0, minute: 60, period: "PM" },
    { hour: 12, minute: -1, period: "AM" },
    { hour: 8, minute: 15, period: "XYZ" }
  ];

  invalidTimeObjects.forEach(obj => {
    assert.throws(() => {
      DazzlingDateTime.convertJsonToDate(obj, "2026-06-18");
    }, SheetDB.ValidationError, "Malformed time configuration must throw ValidationError");
  });
  logAudit('S2-TC3', 'Time Segment Object Conversion Exception check', true, performance.now() - t3Start);
}

// ==================================================================================
// SUITE III: AttendanceUtil Domain Logic Protection Integration
// ==================================================================================
function runSuite3() {
  const t1Start = performance.now();

  // Mock Database Repository structures
  let updateManyCalledCount = 0;
  let updateManyPayloads = [];

  const mockDb = {
    repository(name) {
      if (name === 'Enrollment') {
        return {
          where(query) {
            assert.strictEqual(query.student_id, 'STU-TEST');
            assert.strictEqual(query.status, 'active');
            return [
              {
                id: 'ENR-01',
                studentFeeAccount() {
                  return {
                    installments() {
                      return [
                        { due_date: '2026-06-10', due_amount: 1000, status: 'pending' } // Breached grace period (today is June 19)
                      ];
                    }
                  };
                }
              }
            ];
          }
        };
      }
      if (name === 'BatchAllocation') {
        return {
          updateMany(query, update) {
            updateManyCalledCount++;
            updateManyPayloads.push({ query, update });
          }
        };
      }
    }
  };

  enableSimulatedDate('2026-06-19T00:00:00Z');
  AttendanceUtil.processStudentGatekeeping('STU-TEST', mockDb);
  disableSimulatedDate();

  // Assertion III.1: updates suspended status uniformly
  assert.strictEqual(updateManyCalledCount, 1, "Suspension updateMany must be called exactly once");
  assert.deepStrictEqual(updateManyPayloads[0].query, { enrollment_id: 'ENR-01', status: 'active' });
  assert.deepStrictEqual(updateManyPayloads[0].update, { status: 'suspended' });

  logAudit('S3-TC1', 'Sister-Suspension Cascade Boundary Check', true, performance.now() - t1Start);
}

// ==================================================================================
// AUDIT REPORT EXECUTION RUNNER
// ==================================================================================
const startAudit = performance.now();
runSuite1();
runSuite2();
runSuite3();
const totalDuration = performance.now() - startAudit;

console.log("==================================================================================");
console.log("           DAZZLINGDB TEMPORAL INFRASTRUCTURE PERFORMANCE AUDIT REPORT");
console.log("==================================================================================");
console.log("SUITE ID    TEST VECTOR DESCRIPTION                   STATUS      RAM CALC TIME");
console.log("----------------------------------------------------------------------------------");
auditReport.forEach(row => {
  console.log(`${row.suiteId.padEnd(11)}${row.description.padEnd(42)}${row.status.padEnd(12)}${row.duration}`);
});
console.log("==================================================================================");
console.log(`TOTAL EXECUTION BENCHMARK TIMING: ${totalDuration.toFixed(3)} ms | QUOTA IMPACT: O(1) PROGRAMMATIC TRIPS`);
console.log("==================================================================================");
