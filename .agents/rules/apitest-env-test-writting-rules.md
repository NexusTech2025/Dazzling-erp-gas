---
trigger: model_decision
description: This Protocol & Rule must be applied only when we are trying to add a new test in the `./DazzlingDB/apitest` directory to write a test, to test the api end point.
---

# **Protocol Rules for Writing DazzlingDB API Tests (`apitest`)**

All API integration tests located under the [apitest](file:///e:/NAST/Dazzling/GAS/DazzlingDB/apitest) directory must conform to this standard protocol to ensure isolation, reproducibility, safety, and consistent verification.

---

### **Rule 1: Encapsulation & IIFE Structure**
All API tests must be encapsulated in an **IIFE (Immediately Invoked Function Expression)** to protect the Google Apps Script global namespace.
* The namespace object must expose a `run` method.
* A single, plain global trigger function must be defined at the end of the file to allow execution from the Apps Script menu.

**Example:**
```javascript
const ResourceAction_ApiTest = (function () {
  function run() {
    // Test logic here
  }
  return { run: run };
})();

function runResourceActionApiTest() {
  ResourceAction_ApiTest.run();
}
```

---

### **Rule 2: Environment Sandboxing & Safety Guards**
To protect development, staging, and production database environments, tests must enforce sandbox isolation:
1. **Safety Block:** Assert that the current environment is not `production` or `Environment.PRODUCTION`.
2. **Setup Phase:** Set the active environment to `Environment.TESTING` and call `bootstrapRepositories()` to bind database operations to the mock/sandbox spreadsheets.
3. **Restoration Phase:** Ensure the environment is reverted back to `Environment.DEVELOPMENT` (or its initial state) inside a `finally` block **without** performing bootstrapping.

**Example:**
```javascript
const initialEnv = typeof PropertiesService !== "undefined"
  ? PropertiesService.getScriptProperties().getProperty("ENV")
  : "development";

if (initialEnv === "production") {
  throw new Error("❌ Safety Guard: Test suite cannot be executed in the PRODUCTION environment.");
}

try {
  PropertiesService.getScriptProperties().setProperty("ENV", "TESTING");
  DBContext.getInstance().bootstrapRepositories();
  // execute tests...
} finally {
  // Only restore properties, do NOT bootstrap again here
  PropertiesService.getScriptProperties().setProperty("ENV", initialEnv);
}
```

---

### **Rule 3: Authentication and Session Tokens**
* **Token Resolution:** Always try to fetch the pre-bootstrapped `DEV_SUPER_TOKEN` from `PropertiesService.getScriptProperties().getProperty("DEV_SUPER_TOKEN")` first.
* **Fallback Resolution:** If the bootstrapped token is missing or if the test requires a fresh session lifecycle, register a mock user (`user_register` action) and execute a mock login (`user_login` action) to obtain a valid bearer token dynamically.

---

### **Rule 4: Web Request Dispatch Protocol**
Tests must invoke API endpoints using `ApiTestHelper.callApi(action, payload, token)` rather than invoking service classes directly. This ensures that the dispatching, authorization check, routing, parsing, and response envelope matching logic are fully tested.

* **No Payload Nesting:** Never wrap the payload parameters inside an extra nested `payload` key when calling `callApi()` or `_dispatch()`.
  * **Incorrect:** `callApi("action_name", { payload: { param1: "val" } })`
  * **Correct:** `callApi("action_name", { param1: "val" })`

---

### **Rule 5: Dynamic Collision Prevention**
To support concurrent or repeated execution of tests on the same physical spreadsheet, all test records must use a dynamically generated suffix (e.g., random string, timestamp) for unique constraint fields like `username`, `email`, and `mobile_number`.

**Example:**
```javascript
const suffix = Math.random().toString(36).substring(7).toUpperCase();
const uniqueEmail = `teacher_${suffix.toLowerCase()}@example.com`;
const uniqueMobile = "9" + Math.floor(100000000 + Math.random() * 900000000);
```

---

### **Rule 6: Structured Phase-Based Logging**
Use the standard log levels provided by `ApiTestHelper.logger` to make execution traces clear and readable in the test runner log:
* `logger.phase("...")`: Marks the beginning of a key testing stage.
* `logger.action("...")`: Describes the action request currently being dispatched.
* `logger.detail("...")`: Outputs minor parameters or assertion statuses.
* `logger.success("...")` / `logger.error("...")`: Signals assertion completions.
* `logger.data("label", object)`: Serializes relevant JSON output to trace raw responses.

---

### **Rule 7: Negative Assertion Verification**
API tests must test both positive paths (valid inputs succeed) and negative boundary paths (invalid inputs fail).
* Wrap failing actions in a `try/catch` block.
* Assert that the caught error matches the expected custom error envelope code (e.g., `AUTHENTICATION_FAILURE`, `FORBIDDEN_ACCESS`, `INTEGRITY_ERROR`).
* Fail the test if a negative check unexpectedly succeeds.

**Example:**
```javascript
let caughtForbidden = false;
try {
  callApi("action_name", payload, "WRONG_TOKEN");
} catch (e) {
  caughtForbidden = true;
  logger.success("Properly blocked: " + e.message);
}
if (!caughtForbidden) {
  throw new Error("Security Failure: Action allowed execution with invalid token.");
}
```

---

### **Rule 8: LIFO Teardown Hygiene**
Every test that inserts or updates data must record created primary keys (e.g., `student_id`, `teacher_id`) and clean them up in a `finally` block.
* Clean up records in **LIFO (Last-In, First-Out)** order to avoid relational integrity violations (e.g., remove references in relation tables before deleting the primary parent record).
* **Do not use hardcoded cleanups:** Always base cleanups on the actual identifiers created during the execution run.

---

### **Rule 9: Structured Test Summarization**
All tests must track their scenario results internally in a centralized results object. At the end of the test run, output a complete JSON summary showing:
* **overall:** `true`/`false` success status.
* **passed_count** & **failed_count**.
* **scenarios:** An array containing each test scenario name, status (`PASSED`/`FAILED`), a dynamic description detailing the verification parameters or resolved attributes (e.g., created IDs), and the root cause description if it failed.

**Example:**
```javascript
const testSummary = {
  overall: true,
  passed_count: 0,
  failed_count: 0,
  scenarios: []
};

// Example scenario wrapper
function runScenario(name, fn) {
  try {
    const resultContext = fn(); // Return metadata or attributes from the scenario
    testSummary.passed_count++;
    testSummary.scenarios.push({
      name: name,
      status: "PASSED",
      description: `Scenario '${name}' completed successfully.${resultContext ? " Metadata: " + JSON.stringify(resultContext) : ""}`
    });
  } catch (error) {
    testSummary.overall = false;
    testSummary.failed_count++;
    testSummary.scenarios.push({ 
      name: name, 
      status: "FAILED", 
      description: `Scenario '${name}' failed.`,
      cause: error.message || error.toString() 
    });
    throw error;
  }
}
```

---

### **Rule 10: Phase Execution Benchmarking**
Tests must track the elapsed execution time for each testing phase. At the conclusion of the test run, print a formatted ASCII table summarizing the duration of each phase and the total runtime.

**Example:**
```javascript
const timings = {};

function trackTime(phaseName, fn) {
  const start = Date.now();
  try {
    return fn();
  } finally {
    timings[phaseName] = Date.now() - start;
  }
}

// At the end, output the ASCII table:
function printTimingReport(timings) {
  console.log("\n========================================================");
  console.log("⏱️  PHASE EXECUTION PERFORMANCE TIMING SUMMARY  ⏱️");
  console.log("========================================================");
  let totalTime = 0;
  for (const [phase, duration] of Object.entries(timings)) {
    console.log(`- ${phase.padEnd(45)}: ${duration} ms`);
    totalTime += duration;
  }
  console.log("--------------------------------------------------------");
  console.log(`- ${"Total Execution Time".padEnd(45)}: ${totalTime} ms`);
  console.log("========================================================\n");
}
```

---

### **Rule 11: Schema-Aligned Mocking & Out-of-Sync Verification**
* **Standardized Factory Usage:** All test insertion payloads must be prepared using [TestMockHelper.js](file:///e:/NAST/Dazzling/GAS/DazzlingDB/Test/TestMockHelper.js) or [TestMockData.js](file:///e:/NAST/Dazzling/GAS/DazzlingDB/Test/TestMockData.js) instead of writing raw inline JSON payloads.
* **Schema Matching:** Before constructing any mock payload, verify that the fields match the schema definitions found in [database_schema.js](file:///e:/NAST/Dazzling/GAS/DazzlingDB/Config/database_schema.js).
* **Out-of-Sync / Stale Detection:** If you detect a column mismatch (e.g., the schema requires a new field but the mock helpers or datasets do not provide it), do **not** patch the payload silently. You must stop, notify the user about the discrepancy, present the proposed changes, and get user approval before modifying either the mock helpers or the test payloads.

---

### **Rule 12: Primary Key Isolation**
When dispatching a `create` or `update` action through `callApi()` or `_dispatch()`, you must **never** specify or pass the primary key value (e.g., `student_id`, `teacher_id`, `branch_id`, etc.) in the `data` properties of the request payload. All primary keys are system-generated (either auto-incremented, UUID-based, or formatted prefixes) by the underlying database handlers upon record creation and should not be manually set or modified.