# DazzlingDB API Test Pattern Rulebook

> **Scope:** Governs the authoring of all API integration tests residing under `DazzlingDB/apitest/`.
> **Derived from:** Full pattern analysis of all 13 test modules in that directory.
> **Authority:** This rulebook supersedes ad-hoc test writing. Every new `*_ApiTest.js` file must comply.

---

## 1. Module Identity & File Naming

### Rule AT-01: File Naming Convention

Every test file must follow the `<Domain>_ApiTest.js` pattern. The domain segment is PascalCase and describes the business action being tested.

| ✅ Correct | ❌ Wrong |
|---|---|
| `StudentRegistration_ApiTest.js` | `studentRegTest.js` |
| `TeacherUpdate_ApiTest.js` | `UpdateTeacher_Test.js` |
| `GlobalCrud_ApiTest.js` | `crudApiTest.js` |

**Exceptions:** Infrastructure-level utilities that are not domain tests may use a descriptive compound name without the `_ApiTest` suffix — e.g., `ApiTestHelper.js`, `CacheAnalyzer.js`.

---

### Rule AT-02: IIFE Module Encapsulation

Every test module **must** be wrapped in an IIFE (Immediately Invoked Function Expression) assigned to a `const` with a name matching the file.

```javascript
const TeacherUpdate_ApiTest = (function () {

  function run() { ... }

  // private helpers prefixed with _

  return { run: run };

})();
```

**Rationale:** GAS has a flat global scope. The IIFE provides private function namespacing and prevents global pollution from helper functions.

---

### Rule AT-03: Mandatory Top-Level Entry Point Function

Every module **must** export a standalone global trigger function below the IIFE. This is the function the developer manually invokes from the Apps Script editor.

```javascript
function runTeacherRegistrationTest() {
  TeacherRegistration_ApiTest.run();
}
```

- Name must be `run<Domain>` or `run<Domain>Test` — readable, clearly tied to domain.
- Never invoke test logic directly at the global scope (outside a function).

---

## 2. Test Infrastructure: ApiTestHelper

### Rule AT-04: Always Destructure from ApiTestHelper

The shared `ApiTestHelper` module is the **only** sanctioned test utility. Always destructure from it at the top of `run()`.

```javascript
function run() {
  const { logger, callApi } = ApiTestHelper;
  ...
}
```

Never instantiate a standalone logger or write raw `console.log` calls for structured test output. Use the `logger` object exclusively.

---

### Rule AT-05: Logger Usage Conventions

The `logger` object from `ApiTestHelper` provides five semantic log levels. Use them in strict semantic context:

| Method | When to Use |
|---|---|
| `logger.phase(msg)` | Opening a major numbered test phase. **Always** use a number prefix: `"1: Setup"` |
| `logger.action(msg)` | Announcing the intent of a single operation before it executes |
| `logger.detail(msg)` | Logging a resolved sub-value, ID, or intermediate state after an action |
| `logger.success(msg)` | Confirming that an assertion or operation passed |
| `logger.error(msg)` | Logging a failure observation (non-throwing) |
| `logger.data(label, obj)` | Dumping a full object payload to console. Always pass a human label |

---

### Rule AT-06: The Two Dispatch Modes — callApi vs. _dispatch

There are two sanctioned patterns for hitting the dispatcher. Choose based on your assertion needs.

#### Mode A — `callApi` (via ApiTestHelper)

Use when you **expect the call to succeed** and want to throw immediately on failure.

```javascript
const result = callApi("student_register", payload);
// result === response.data directly
// throws [API Error] automatically if response.success === false
```

#### Mode B — `_dispatch` (local raw dispatcher)

Use when you need to **inspect the raw response envelope** — particularly for negative/failure flow tests where you need to read `res.error.details.fields`.

```javascript
function _dispatch(action, payload, token = null) {
  const mockEvent = {
    postData: {
      contents: JSON.stringify({ action, token, payload })
    }
  };
  const output = ApiDispatcher.dispatch(mockEvent);
  return output.getContent ? JSON.parse(output.getContent()) : output;
}
// res.success, res.data, res.error are all accessible
```

**Rule:** Never mix the two modes for the same test scenario. Pick one and be consistent within a phase.

---

## 3. Mock Event Construction

### Rule AT-07: The Canonical Mock Event Shape

The mock event that simulates a real web POST request **must always** follow this exact shape:

```javascript
const mockEvent = {
  postData: {
    contents: JSON.stringify({
      action: action,   // string — the action key
      token: token,     // string | null — auth token
      payload: payload  // object — the request parameters
    })
  }
};
```

- `token` must always be included. Pass `null` explicitly when no auth is needed.
- Never pass additional top-level keys outside `action`, `token`, `payload`.
- `payload` must be a plain object — never a pre-stringified string.

---

## 4. Phase Architecture

### Rule AT-08: Number All Phases Sequentially

Every logical section of a test suite must be announced with `logger.phase()` using a sequential numeric prefix. Phases map directly to business lifecycle steps.

```
Phase 0 — Dependency resolution / setup prerequisites
Phase 1 — Primary happy-path action
Phase 2 — Verification / assertion
Phase 3 — Failure / negative flow
Phase N — Teardown / cleanup
```

**Phase 0 is reserved for dependency bootstrap** — resolving foreign key dependencies (e.g., finding or creating a Batch before testing a StudentLead).

---

### Rule AT-09: Dependency Resolution Pattern (Phase 0)

When a test requires a pre-existing record (e.g., `batch_id`, `course_id`), use a "resolve or create" helper prefixed with `_getOrCreate`:

```javascript
function _getOrCreateTestBatch(logger, callApi) {
  logger.phase("0: Resolve Batch Dependency");
  const result = callApi("data_query", { target: "Batch", where: { status: "active" } });

  if (result && result.data && result.data.length > 0) {
    return result.data[0].batch_id; // reuse existing
  }

  // Fall through: create temporary record chain
  const courseType = callApi("academic_create_course_type", { ... });
  const course     = callApi("academic_create_course",      { ... });
  const batch      = callApi("academic_create_batch",       { ... });
  return batch.batch_id;
}
```

**Never hardcode IDs** (e.g., `"BRN-3GVP91T"`) in dependency resolution. The only exception is setup-only direct DB inserts in isolated teardown tests where the ID is tracked and cleaned.

---

## 5. Assertion Patterns

### Rule AT-10: Positive Flow Assertions

After a successful `callApi`, verify the returned data explicitly. Check:

1. **Record identity** — primary key exists and starts with the correct prefix.
2. **Field integrity** — specific field values match the payload sent.
3. **Default values** — fields with server-set defaults (e.g., `is_registered: false`) are verified.

```javascript
const lead = callApi("student_add_lead", payload);
if (!lead.lead_id)                        throw new Error("...");
if (!lead.lead_id.startsWith("SLD-"))     throw new Error("...");
if (lead.student_name !== "Lead API Tester") throw new Error("...");
if (lead.is_registered !== false)         throw new Error("...");
```

---

### Rule AT-11: Negative Flow Assertions (Validation & Security Boundaries)

For every negative test, **wrap the call in a try/catch** and assert that it threw. Never use `callApi` for negative tests — use `_dispatch` to inspect the error envelope.

```javascript
// Pattern A — Simple block assertion (via callApi)
try {
  callApi("student_add_lead", {}); // missing required field
  throw new Error("Should have failed but succeeded.");
} catch (e) {
  logger.success(`Validation correctly blocked: ${e.message}`);
}

// Pattern B — Multi-field error accumulation (via _dispatch)
const res = _dispatch("staff_onboard_teacher", duplicatePayload, token);
if (res.success) throw new Error("Expected failure but got success!");

const fields = res.error.details && res.error.details.fields ? res.error.details.fields : [];
const foundViolations = fields.map(f => f.field);
["mobile_number", "email", "userData.username", "subjects"].forEach(expected => {
  if (!foundViolations.includes(expected)) {
    logger.error(`System failed to capture violation for field: ${expected}`);
  }
});
```

---

### Rule AT-12: Relational Hydration Verification

When testing `data_query` with `include` blocks, always verify the hydrated relation is present and is the correct type (array vs. object):

```javascript
// hasMany → verify array
if (!Array.isArray(course.batches)) throw new Error("Hydration failure: batches");

// belongsTo → verify object
const mappedCourse = teacher.subjects[0].course ? teacher.subjects[0].course.name : "MISSING";
if (mappedCourse !== "Expected Name") throw new Error("Relational mapping failed");
```

---

## 6. Data Uniqueness Strategy

### Rule AT-13: Dynamic Unique Credentials on Every Run

Tests that create records with uniqueness constraints (email, mobile, username) **must** generate dynamic values per run. Use a random suffix pattern:

```javascript
const suffix       = Math.random().toString(36).substring(7).toUpperCase();
const uniqueMobile = "9" + Math.floor(100000000 + Math.random() * 900000000);
const uniqueEmail  = `teacher_${suffix.toLowerCase()}@example.com`;
const uniqueUsername = `teacher_${suffix.toLowerCase()}`;
```

**Never hardcode static test credentials** that would collide on a second run.

---

## 7. Auth Token Pattern

### Rule AT-14: Token Resolution from PropertiesService

For tests that require an authenticated session, always resolve the `DEV_SUPER_TOKEN` from `PropertiesService` at the top of `run()`. Never hardcode tokens.

```javascript
const superToken = typeof PropertiesService !== "undefined"
  ? PropertiesService.getScriptProperties().getProperty("DEV_SUPER_TOKEN")
  : null;

if (!superToken) {
  logger.detail("⚠️ DEV_SUPER_TOKEN not found. Running without token...");
} else {
  logger.success("🔑 Bootstrapped Super Token loaded.");
}
```

**Run `DevBootstrap_ApiTest.run()` first** to mint and persist the `DEV_SUPER_TOKEN` before executing authenticated tests.

---

### Rule AT-15: Token Propagation to callApi / _dispatch

Always pass `superToken` as the third argument to `callApi` or `_dispatch`. Pass `null` explicitly for unauthenticated calls.

```javascript
callApi("data_query", queryPayload, superToken);   // authenticated
callApi("data_query", queryPayload);               // anonymous (token defaults to null)
```

---

## 8. Direct ORM Access Pattern

### Rule AT-16: ORM Direct Access for Teardown and Low-Level Checks

When testing ORM-level behavior (not via the dispatcher), access the `DBContext` singleton directly. This is the only approved path for direct table gateway calls in tests.

```javascript
const db = DBContext.getInstance();

// Direct ORM update/delete
const updated = db.Student.update(studentId, { student_name: "Updated" });
const deleted  = db.Student.remove(studentId);

// Direct ORM query
const adminUser = db.User.findOne({ username: "dev_admin_moni" });
```

**ORM direct access is permitted for:**
- Teardown / cleanup in `finally` blocks
- Setup fixtures that bypass the dispatcher (e.g., `TeacherUpdate_ApiTest` direct insert)
- Bootstrapping utility modules (`DevBootstrap_ApiTest`)

**ORM direct access is NOT permitted for:**
- Primary happy-path assertions — always use the dispatcher for those.

---

## 9. Teardown & Cleanup

### Rule AT-17: Mandatory finally Block for Destructive Tests

Any test that creates test fixture records must clean them up in a `finally` block. Never rely on test success for cleanup execution.

```javascript
let mockTeacherId = null;
try {
  const teacher = db.Teacher.insert({ ... });
  mockTeacherId = teacher.teacher_id;
  // ... run assertions ...
} catch (error) {
  logger.error(`Test failed: ${error.message}`);
} finally {
  if (mockTeacherId) {
    logger.phase("N: Teardown and Cleanup");
    // Delete children first (LIFO order)
    db.TeacherSubject.where({ teacher_id: mockTeacherId }).forEach(s => {
      try { db.TeacherSubject.remove(s.teacher_subject_id); } catch (_) { }
    });
    db.Teacher.remove(mockTeacherId);
    logger.success("Cleanup complete.");
  }
}
```

**Cleanup must follow LIFO (child-first) deletion order** to respect relational integrity constraints.

---

## 10. Test Suite Lifecycle: The Full Canonical Structure

### Rule AT-18: Canonical run() Function Shape

Every `run()` function must follow this canonical skeleton:

```javascript
function run() {
  const { logger, callApi } = ApiTestHelper;
  console.log("\n🧪 STARTING <DOMAIN> API TEST SUITE 🧪");

  try {
    // Phase 0: Resolve dependencies (if needed)
    const dep = _resolveOrCreateDependency(logger, callApi);

    // Phase 1: Primary positive flow
    const createdId = _testCreate(dep, logger, callApi);

    // Phase 2: Verification via query engine
    _verifyData(createdId, logger, callApi);

    // Phase 3: Validation / failure / negative flow
    _testValidation(logger, callApi);

    // Phase N: ORM structural check (if applicable)
    _testOrmDirectAccess(createdId, logger);

    console.log("\n🎉 <DOMAIN> API TEST SUITE COMPLETED SUCCESSFULLY! 🎉\n");
  } catch (error) {
    ApiTestHelper.logger.error(`API Test Suite Failed: ${error.message}`);
  }
}
```

---

## 11. Private Helper Naming

### Rule AT-19: Private Helper Prefix Convention

All helper functions inside the IIFE that are not part of the public `return {}` interface must be named with a `_` prefix.

| ✅ Correct | ❌ Wrong |
|---|---|
| `_setupAcademicEnvironment` | `setupEnv` |
| `_testValidation` | `validatePayload` |
| `_getOrCreateTestBatch` | `getBatch` |
| `_executePhase1_Security` | `phase1` |

**Multi-phase tests** may use the `_executePhase<N>_<Name>` convention for clarity when the phases are logically distinct enough to warrant their own named helpers.

---

## 12. Anti-Patterns (Prohibited)

### Rule AT-20: Prohibited Patterns

| ❌ Anti-Pattern | ✅ Correct Pattern |
|---|---|
| Hardcoded static IDs (e.g., `"BRN-3GVP91T"`) in dependency resolution | Use `_getOrCreate*` helpers that query live data |
| Calling `ApiDispatcher.dispatch()` outside of a test module | Route through `ApiTestHelper.callApi` or local `_dispatch` |
| Writing `console.log` directly for test output | Use `logger.phase / action / detail / success / error / data` |
| Missing `try/catch` around `run()` body | Wrap entire body in `try {} catch (error) {}` |
| Asserting on `res.success` for happy-path via `callApi` | `callApi` already throws — no need to check `success` |
| Leaving test data in the sheet without cleanup | Use `finally` blocks with LIFO deletion |
| Token hardcoded as a string | Always read from `PropertiesService` or pass `null` |

---

## 13. Query Engine Test Conventions

### Rule AT-21: data_query Payload Shape

All `data_query` calls must follow the standardized payload contract:

```javascript
const queryPayload = {
  target:     "EntityName",           // PascalCase table name
  where:      { field: "value" },     // optional filter
  include:    {                       // optional relational hydration
    relationName: {},                 // flat include
    nestedRelation: {                 // nested include
      include: { childRelation: {} }
    }
  },
  select:     ["id", "field_name"],  // optional column projection
  pagination: { limit: 50 }          // optional, default 50, max 200
};

const result = callApi("data_query", queryPayload);
// result.data  → array of records
// result.count → total count of matched records
```

---

*Last updated: 2026-06-19 | Derived from full analysis of DazzlingDB/apitest/ (13 modules)*
