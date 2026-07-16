# Implementation Plan: TestTeacherSubject_Transaction

This plan outlines the design and architecture for the new test suite `TestTeacherSubject_Transaction.js` to verify relational synchronization, transaction tracker rollback capability, and snapshot capturing behavior.

---

## 1. Objectives

1. **Transaction Sandboxing**: Maintain testing environment isolation by setting `ENV` to `TESTING`, bootstrapping repositories, provisioning schemas, and restoring environment state to `DEVELOPMENT` in a `finally` block.
2. **Case 1 (Successful Bulk Insertion)**: Verify that multiple teacher-subject records can be successfully added to the database, tracked, and verified.
3. **Case 2 (Transactional Rollback)**: Verify that when a transaction fails mid-operation, the LIFO `TransactionTracker.rollback()` execution reverts the database to its exact pre-transaction state.
4. **Case 3 (Snapshot Integrity Verification)**: Verify that the `TransactionTracker` holds both the original state backup (old snapshot) and database changes (new snapshot) for comparison.
5. **Clean Teardown**: Remove all generated mock records (Course, CourseType, Teacher, TeacherSubject) at the end of the test.
6. **Performance Summary**: Log execution time for each stage and display a benchmark summary.

---

## 2. Test Architecture & Design

### A. Environment Execution & Sandboxing
The test suite will execute using standard `DazzlingDB` test wrappers:
```javascript
function runTeacherSubjectTransactionTests() {
  console.log("🚀 Starting TeacherSubject Transaction Tests...");
  
  // Guard environment
  const activeEnv = typeof SYSTEM_ENV !== 'undefined' ? SYSTEM_ENV : 'development';
  if (activeEnv === 'production') {
    throw new Error("❌ Safety Guard: Test suite cannot be executed in the PRODUCTION environment.");
  }
  
  const timing = {};
  let startTime = Date.now();
  
  try {
    // 1. Sandbox setup
    PropertiesService.getScriptProperties().setProperty('ENV', 'TESTING');
    DBContext.getInstance().bootstrapRepositories();
    const db = DBContext.getInstance();
    db.setup.provision();
    
    // 2. Execute Scenarios...
  } finally {
    // 3. Restore Environment
    PropertiesService.getScriptProperties().setProperty('ENV', 'DEVELOPMENT');
    DBContext.getInstance().bootstrapRepositories();
  }
}
```

### B. Implementation Details for Scenarios

#### Scenario 1: Bulk Insertion & Verification
- Retrieve the pre-existing teacher `TCH-F652A058` if available, or insert it as a fallback (avoiding teardown cleanup if pre-existing).
- Retrieve the pre-existing segment `SEG-2D17C607` and courses `CRS-753D2CDB`, `CRS-56D32B73`, `CRS-638DD67B` if available, or insert them as fallbacks.
- Instantiate `TransactionTracker`.
- For the Courses, insert the `TeacherSubject` records in bulk using `db.TeacherSubject.insertMany` and track them individually using `tx.trackInsert()`.
- Assert that the database contains the records and their primary keys match.

#### Scenario 2: Mid-Transaction Failure & Rollback
- Create pre-existing state (e.g. 1 valid `TeacherSubject` record).
- Begin tracking a transaction.
- Insert a new valid `TeacherSubject` record and track it.
- Introduce an explicit validation exception (e.g., trying to insert a payload missing `teacher_id` or similar required field to trigger a database exception).
- Capture the exception, run `tx.rollback()`.
- Assert that the database does NOT contain the record from the failed transaction, but still contains the pre-existing record.

#### Scenario 3: Old & New Snapshot Integrity Verification
- **Update Test**:
  - Insert a record.
  - Clone/snapshot original record state.
  - Perform an update using `db.TeacherSubject.update(id, {...})`.
  - Track update via `tx.trackUpdate(db.TeacherSubject, id, originalState)`.
  - Retrieve the current record from the database (New Snapshot).
  - Verify that `tx.steps` holds the exact original state properties (Old Snapshot).
  - Verify that the database record holds the updated properties (New Snapshot).
- **Rollback & Verify**:
  - Execute `tx.rollback()`.
  - Verify that the database is restored back to the old snapshot state.

---

## 3. Teardown Strategy
All records generated during setup and test runs will be cleaned up in a try-finally context to keep the test environment pristine.

---

## 4. Performance Summary Format
A formatted output table containing performance steps measured in milliseconds:
```text
========================================================
⏱️  TEACHER-SUBJECT TRANSACTION PERFORMANCE TIMING  ⏱️
========================================================
- Step 1: Sandbox & Mock Bootstrapping             :    X ms
- Scenario 1: Bulk Insertion & Verification        :    X ms
- Scenario 2: Failure & LIFO Rollback Execution    :    X ms
- Scenario 3: Snapshot Verification (Old vs New)   :    X ms
- Step 5: Teardown Cleanup                         :    X ms
--------------------------------------------------------
- Total Execution Time                             :    Y ms
========================================================
```
