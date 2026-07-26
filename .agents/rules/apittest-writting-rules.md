---
trigger: manual
---

# Enterprise Engineering Specification: Standard Governance & Pattern Guide for `apitest` Suites
**Author:** Principal Software Architect & Systems Documentator
**Target Audience:** Core Backend Engineers & Autonomous AI Agents
**Framework Context:** DazzlingDB / SheetDB (Google Apps Script Relational ORM)

---

## Executive Architectural Summary

An analysis of the existing API test harness (`apitest/ApiTestHelper.js`, `apitest/utils.js`, `Core_GenericCrud_ApiTest.js`, `StudentRegistration_ApiTest.js`, `StudentDeleteLifecycle_ApiTest.js`, and `PackageCreate_ApiTest.js`) reveals a standardized, highly disciplined pattern for unit, integration, and E2E verification.

Because DazzlingDB operates over Google Apps Script (GAS) and Google Sheets, API tests cannot rely on ephemeral database containers or standard external test runners (like Jest or Mocha) during live execution. Instead, the test suite executes **in-realm** against live singleton database instances while enforcing zero data pollution, environment sandboxing, token session caching, and strict LIFO teardowns.

---

## Architectural Alignment Matrix

| Architectural Axiom | How `apitest` Enforces It | Primary Reference Code |
| --- | --- | --- |
| **Axiom 1: Decoupled Contract-to-Seat** | Tests independently verify administrative enrollment (`Enrollment` / `StudentFeeAccount`) and seating assignments (`BatchAllocation` / `Batch`). | `StudentRegistration_ApiTest.js` |
| **Axiom 2: Polymorphic Discriminators** | Payloads supply `entity_type` + `entity_id` rather than hardcoded ID string prefixes. | `PackageCreate_ApiTest.js` |
| **Axiom 3: High-Performance In-Memory Batch** | Asserts bulk API actions run in $O(1)$ single-pass range updates. | `Core_GenericCrud_ApiTest.js` |
| **Axiom 4: Transaction & LIFO Rollbacks** | Cleans up database state in strict reverse-topological (leaf-first) order inside `finally` blocks. | `StudentRegistration_ApiTest.js`, `StudentDeleteLifecycle_ApiTest.js` |
| **Axiom 5: Zero-Hardcoding Mandate** | ID prefixes (e.g., `BRN-`, `STU-`) are dynamic; assertions verify metadata resolution. | `Core_GenericCrud_ApiTest.js` |
| **Axiom 6: Absolute Testing Governance** | Every test logs timing benchmarks ($\Delta t$) and prints runtime ASCII tables. | `ApiTestHelper.js`, `Core_GenericCrud_ApiTest.js` |

---

## Anatomy of the `apitest` Execution Lifecycle

```
+-----------------------------------------------------------------------------------+
|                        APITEST EXECUTION & GOVERNANCE FLOW                        |
+-----------------------------------------------------------------------------------+
| 1. ENVIRONMENT CONTEXT LOCK                                                       |
|    - Read initial environment state from PropertiesService                         |
|    - Force environment to target ('TESTING') & invoke DBContext.bootstrap()       |
|    - Provision sandbox schemas: db.setup.provision()                              |
|                                                                                   |
| 2. AUTHENTICATION & TOKEN INJECTION                                               |
|    - Fetch DEV_SUPER_TOKEN from PropertiesService                                 |
|    - Fall back to DevBootstrap.run('TESTING') to provision dev_admin_moni         |
|                                                                                   |
| 3. PHASED SCENARIO EXECUTION                                                      |
|    +--> Phase 0: Setup Academic & System Dependencies                             |
|    +--> Phase 1: Happy-Path API Action Dispatch (ApiTestHelper.callApi)           |
|    +--> Phase 2: Hydrated Query Verification (data_query API)                     |
|    +--> Phase 3: Negative Validation & Envelope Format Audits                     |
|    +--> Phase 4: Direct ORM State Consistency Check (DBContext.getInstance())     |
|                                                                                   |
| 4. METRIC AGGREGATION & REPORTING                                                 |
|    - Calculate step durations: \Delta t = t_{end} - t_{start}                     |
|    - Output ASCII performance summary & scenario status matrix                    |
|                                                                                   |
| 5. LIFO REVERSE-TOPOLOGICAL TEARDOWN (finally Block)                              |
|    - Evict Leaf Entities -> Intermediate Dependencies -> Master Parent Entities   |
|    - Restore initial environment state in PropertiesService                       |
|    - Re-bootstrap DBContext to guarantee clean context release                    |
+-----------------------------------------------------------------------------------+

```

---

## The 8 Mandatory Rules for Writing New `apitest` Suites

### Rule 1: Module Encapsulation via IIFE and Global Trigger

Every API test suite must be wrapped in an Immediately Invoked Function Expression (IIFE) assigned to a PascalCase constant, and expose a top-level parameterless function for execution via the Apps Script IDE.

```javascript
// Example: DazzlingDB/apitest/Finance_Payment_ApiTest.js
const Finance_Payment_ApiTest = (function () {
  function run() {
    // Test logic...
  }
  return { run };
})();

// Global Apps Script Entry Point
function runFinancePaymentApiTest() {
  Finance_Payment_ApiTest.run();
}

```

### Rule 2: Environment Sandboxing & Context Restoration Guarantee

Tests must **never** execute against `PRODUCTION`. The initial environment state must be saved at entry, swapped to `TESTING` during execution, and restored inside a mandatory `finally` block.

$$\text{Environment Lifecycle Invariant: } \text{ENV}_{\text{exit}} \equiv \text{ENV}_{\text{entry}}$$

```javascript
const initialEnv = typeof PropertiesService !== "undefined"
  ? PropertiesService.getScriptProperties().getProperty("ENV")
  : "DEVELOPMENT";

try {
  if (typeof PropertiesService !== "undefined") {
    PropertiesService.getScriptProperties().setProperty("ENV", "TESTING");
  }
  DBContext.getInstance().bootstrapRepositories();
  const db = DBContext.getInstance();
  // db.setup.provision(); // Hydrate sandbox sheets on requirement
  
  // Scenarios...
} finally {
  if (typeof PropertiesService !== "undefined") {
    PropertiesService.getScriptProperties().setProperty("ENV", initialEnv);
  }
  DBContext.getInstance().bootstrapRepositories(); // Re-bootstrap initial context
}

```

### Rule 3: Session Authentication & `DevBootstrap` Integration

API actions requiring auth must pass a valid session token. Tests must pull `DEV_SUPER_TOKEN` or `TESTING_AUTH_TOKEN` from `PropertiesService`. If missing, invoke `DevBootstrap.run(targetEnv)` or throw an explicit pre-flight error.

```javascript
const superToken = typeof PropertiesService !== "undefined"
  ? PropertiesService.getScriptProperties().getProperty("DEV_SUPER_TOKEN")
  : null;

if (!superToken) {
  throw new Error("Bootstrap Token Missing: Please run DevBootstrap.run('TESTING') first.");
}

```

### Rule 4: Structured Phase Telemetry & Scenario Wrapping

Utilize `ApiTestHelper.logger` for phase announcements. Wrap scenario blocks in a tracked executor function to collect pass/fail metrics without halting premature execution when collecting multi-step reports.

```javascript
const { logger, callApi, printTable } = ApiTestHelper; //
const stats = { passed: 0, failed: 0, scenarios: [] };

function runScenario(name, fn) {
  try {
    fn();
    stats.passed++;
    stats.scenarios.push({ name: name, status: "PASSED" });
  } catch (error) {
    stats.failed++;
    stats.scenarios.push({ name: name, status: "FAILED", error: error.message });
    throw error; // Re-throw if phase dependencies are fatal
  }
}

```

### Rule 5: Dynamic Seed Data Isolation

To prevent record collisions during parallel or repeated execution, all text identifiers, usernames, emails, and phone numbers **must** append a high-entropy dynamic suffix.

```javascript
const suffix = Math.random().toString(36).substring(7).toUpperCase();
const uniqueEmail = `test.user.${suffix.toLowerCase()}@example.com`;
const uniqueMobile = "9" + Math.floor(100000000 + Math.random() * 900000000);

```

### Rule 6: The Triple Verification Pattern

A complete API test scenario must verify state mutations across 3 distinct boundaries:

1. **API Envelope Level:** Calling `callApi(action, payload, token)` and asserting returned `data`.
2. **DSL Query Engine Level:** Executing `data_query` to verify deep relational graph hydration (`include`).
3. **Direct ORM Level:** Querying `DBContext.getInstance().<Model>.findOne()` to assert row-level consistency.

```javascript
// 1. API Action Execution
const student = callApi("student_register", regPayload, superToken); //

// 2. DSL Hydration Check
const queryRes = callApi("data_query", {
  target: "Student",
  where: { student_id: student.student_id },
  include: { address: {}, contact: {} }
}, superToken); //
if (typeof queryRes.data[0].address !== "object") throw new Error("Hydration failure"); //

// 3. Direct ORM Consistency
const dbStudent = DBContext.getInstance().Student.findById(student.student_id);
if (!dbStudent) throw new Error("ORM persistence failure");

```

### Rule 7: Strict LIFO Reverse-Topological Teardown

All database entities created during setup or execution must be tracked in local variable references and deleted in **exact reverse order of creation** (Leaf/Child nodes $\rightarrow$ Parent/Root nodes). Every deletion statement in the `finally` block must be wrapped in `try...catch` to prevent teardown crashes.

$$\text{Teardown Sequence: } \text{Child (Enrollment, Address, Contact)} \longrightarrow \text{Parent (Student, Teacher)} \longrightarrow \text{Master (Course, User)}$$

```javascript
finally {
  logger.phase("N: Teardown and Cleanup"); //
  const db = DBContext.getInstance();

  // 1. Child / Relational Records First
  if (createdStudentId) {
    try { db.Enrollment.where({ student_id: createdStudentId }).forEach(e => db.Enrollment.remove(e.enrollment_id)); } catch (_) {} //
    try { const a = db.Address.findOne({ student_id: createdStudentId }); if (a) db.Address.remove(a.address_id); } catch (_) {} //
    try { const c = db.ContactInfo.findOne({ student_id: createdStudentId }); if (c) db.ContactInfo.remove(c.contact_id); } catch (_) {} //
    try { db.Student.remove(createdStudentId); } catch (_) {} //
  }

  // 2. Master Dependencies
  if (createdBatchId) try { db.Batch.remove(createdBatchId); } catch (_) {} //
  if (createdCourseId) try { db.Course.remove(createdCourseId); } catch (_) {} //
}

```

### Rule 8: Performance Benchmarking & Envelope Assertion

Tests must measure execution timing using `Date.now()` and print an ASCII performance table matching Rule G / Axiom 6 compliance. When testing envelope standards, dispatch directly to `ApiDispatcher.dispatch()` to inspect `success`, `context.execution_time_ms`, `context.mutated_records`, and `meta.correlation_id`.

```javascript
const timings = {};
const start = Date.now();

// Execute operation...
timings["Phase 1: Student Registration"] = Date.now() - start; //

// Print Performance Table
console.log("\n========================================================");
console.log("⏱️  API TEST PERFORMANCE TIMINGS                        ⏱️");
console.log("========================================================");
let total = 0;
for (const [step, time] of Object.entries(timings)) {
  console.log(`- ${step.padEnd(46)}: ${time} ms`);
  total += time;
}
console.log(`- Total execution time                         : ${total} ms`);
console.log("========================================================\n");

```

---

use the apitest template from `.agents\memory\apitest_template.md`
