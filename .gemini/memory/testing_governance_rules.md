# DazzlingDB & SheetDB Testing Governance Rules

This document defines the strict architectural and organizational rules for writing and executing tests within the project workspace. To maintain code hygiene, prevent configuration mismatches, and ensure consistent execution contexts, these guidelines must be strictly adhered to by all developers and agent workflows.

---

## 1. Unified Test Directory Mandate

> [!IMPORTANT]
> **Never write or store test scripts in the `SheetDB/Tests/` folder.**
> All unit, integration, functional, and performance tests for both `SheetDB` and `DazzlingDB` must reside exclusively within the [DazzlingDB/Test/](e:/NAST/Dazzling/GAS/DazzlingDB/Test/) directory.

### Rationale
* **Environment Context Sync**: SheetDB tests in `SheetDB/Tests/` run in isolation with mock schemas. However, they lack the actual validation pipelines, auto-generation prefix configurations, relational constraints, and environment safety guards configured in DazzlingDB.
* **Redundancy Reduction**: Storing tests across multiple directories makes tracking test coverage difficult and leads to duplicate files testing identical ORM APIs.
* **Unified Setup/Teardown**: Executing tests under `DazzlingDB/Test/` allows tests to share mock registries and bootstrapping helpers (e.g. `TestMockData.js`).

---

## 2. DazzlingDB Test Script Rules

When writing test scripts in the [DazzlingDB/Test/](e:/NAST/Dazzling/GAS/DazzlingDB/Test/) directory, they must adhere to the following architecture:

### A. Resolve the Singleton DB Context
Do not initialize new `SheetDB` database objects directly. Instead, retrieve the active database singleton via `DBContext.getInstance()`:
```javascript
const db = DBContext.getInstance();
```

### B. Satisfy Core Schema Column Constraints
DazzlingDB enforces strict database schema validations defined under `DazzlingDB/Config/Schema/`. All records inserted during tests must satisfy column properties (e.g., choices, types, required fields).

#### Example (Course Table Validation):
```javascript
// Valid Course payload satisfying Course.json constraints
const coursePayload = {
  segment_id: "SEG-TEST-1", // Must reference a valid segment
  name: "Test Curriculum Course",
  language_medium: "English", // Must match choice constraints
  base_fee: 2500, // Numeric type constraint
  status: "active" // Default enum choice
};
```

### C. Leverage Centralized Mock Data Bootstrapping
Before testing relational layers, use `TestMockData.js` to seed the database with reference metadata (like Branches and CourseTypes).
```javascript
// Step 0: Bootstrap mock curriculum
const mockIds = TestMockData.setupCurriculum(db);
const segmentId = mockIds.courseTypeId; // "SEG-TEST-1"
```

### D. AutoField and PK Mutation Safeguards
* **Auto-generated IDs**: If a table specifies its primary key as `type: "auto"` (e.g., `course_id`), do not supply custom IDs unless the DB instance explicitly has `allowAutoOverride: true`. Instead, read the returned auto-generated ID from the returned insert payloads.
* **Primary Key Protection**: Test updates (like `updateMany`) must never mutate primary key values. Verify that attempts to alter the primary key field are safely ignored by the repository and gateway layers.

### E. Environment Execution Guards
To prevent accidental data loss in staging or production spreadsheets, always guard testing suites against executing in non-development environments:
```javascript
const activeEnv = typeof SYSTEM_ENV !== 'undefined' ? SYSTEM_ENV : 'development';
if (activeEnv === 'production') {
  throw new Error("❌ Safety Guard: Test suite cannot be executed in the PRODUCTION environment.");
}
```

### F. Clean Setup & Teardown Lifecycle
All tests must execute a clean teardown at the end of execution to clean up database test records physically from the sheets:
```javascript
// Clean up seeded records using batch deleteMany
const deletedCount = db.Course.deleteMany(courseIds);
console.log(`✅ Success: Cleaned up ${deletedCount} records.`);
```

### G. Capture and Log Operation Execution Times
To prevent performance regression and track database write efficiency in Google Apps Script, all integration and benchmark tests must record and display execution times for every transaction and setup operation:
1. Wrap each logical operation or scenario block in `Date.getTime()` measurements.
2. Accumulate the execution time of each operation under a structured dictionary/object.
3. Output a formatted performance summary table at the end of execution.

#### Example (Performance Summary Format):
```text
========================================================
⏱️  BATCH UPDATE BENCHMARK PERFORMANCE TIMING SUMMARY  ⏱️
========================================================
- Step 0: Bootstrapping Mock Curriculum            :    150 ms
- Scenario 1: Setup 100 Course Records (insertMany):    832 ms
- Scenario 2: Batch Update 100 Records (updateMany):   1026 ms
- Scenario 3: Verifying Updated Values             :     45 ms
- Scenario 4: Verify Primary Key Protection        :    120 ms
- Scenario 5: Cleanup Test Data (deleteMany)       :    475 ms
--------------------------------------------------------
- Total Execution Time                             :   2648 ms
========================================================
```

### H. Testing Environment Sandboxing
All tests must execute within the isolated `TESTING` sandbox environment to protect development and production databases from test mutations.
1. Set the environment property to `TESTING` and call bootstrap:
   ```javascript
   PropertiesService.getScriptProperties().setProperty('ENV', 'TESTING');
   DBContext.getInstance().bootstrapRepositories();
   ```
2. Provision the sandbox schemas:
   ```javascript
   const db = DBContext.getInstance();
   db.setup.provision();
   ```
3. Use a `finally` block to restore the active environment back to `DEVELOPMENT` and re-bootstrap:
   ```javascript
   try {
     // run tests
   } finally {
     PropertiesService.getScriptProperties().setProperty('ENV', 'DEVELOPMENT');
     DBContext.getInstance().bootstrapRepositories();
   }
   ```

### I. Redundant Payload Wrapping in Dispatch Calls
When simulating API requests via helper functions (such as `_dispatch()` or `callApi()`), do not wrap your parameter objects inside a nested `"payload"` key. These mock request dispatchers automatically serialize the second parameter under the `"payload"` field of the event body. Manually nesting this key causes parameters to be unrecognized during action pre-flight validation.

* **Incorrect**:
  ```javascript
  _dispatch("student_delete", {
    payload: { student_id: "STU1", dryRun: false }
  }, token);
  ```

* **Correct**:
  ```javascript
  _dispatch("student_delete", {
    student_id: "STU1",
    dryRun: false
  }, token);
  ```

---

## 3. Reference Files & Directory Mapping

* **JSON Schemas**: Located at [DazzlingDB/Config/Schema/](e:/NAST/Dazzling/GAS/DazzlingDB/Config/Schema/) (e.g., [Course.json](e:/NAST/Dazzling/GAS/DazzlingDB/Config/Schema/Academic/Course.json)).
* **Test Modules**: Located at [DazzlingDB/Test/](e:/NAST/Dazzling/GAS/DazzlingDB/Test/) (e.g., [Academic_BatchUpdateTests.js](e:/NAST/Dazzling/GAS/DazzlingDB/Test/Academic_BatchUpdateTests.js)).
* **Mock Registry**: Exposed via [TestMockData.js](e:/NAST/Dazzling/GAS/DazzlingDB/Test/TestMockData.js).
