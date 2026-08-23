---
trigger: manual
---

# **Aira Production-Ready Code Standard & Quality Decree**

This document establishes the mandatory engineering standards for writing, refactoring, and reviewing production-grade code across **DazzlingDB**, **SheetDB**, and related **Google Apps Script** services. All code contributed to the codebase must strictly satisfy these principles before deployment.

---

## **1. Core Architectural Pillars**

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      PRODUCTION-READY CODE PILLARS                     │
 ├────────────────┬─────────────────┬─────────────────┬───────────────────┤
 │ 1. CONTRACTS   │ 2. RESILIENCE   │ 3. OBSERVABILITY│ 4. GAS PERFORMANCE│
 │ Robust JSDoc   │ Custom Errors   │ Context Logging │ In-Memory 2D RAM  │
 │ Positional Sig │ Fail-Fast Gates │ Leveled Traces  │ Single Batch Sync │
 │ Explicit Throws│ LIFO Rollbacks  │ Zero PII Leaks  │ Cross-Realm Safe  │
 └────────────────┴─────────────────┴─────────────────┴───────────────────┘
```

---

## **2. Detailed Quality Standards**

### **Pillar I: Method Documentation & Signature Contracts**
1. **Explicit JSDoc on All Methods:** Every class method, repository action, and standalone utility must include complete JSDoc annotations detailing:
   * Descriptive summary of purpose and business logic.
   * Every parameter with exact primitive/object types, nested field definitions, and defaults.
   * Return type with explicit structure (never vague `Object`).
   * `@throws` tags enumerating every domain-specific exception class raised.
2. **Comment Intent, Not Syntax:** Do not explain self-evident JavaScript syntax. Reserve inline comments strictly for algorithmic rationale, business edge cases, timezone workarounds, or platform idiosyncrasies.

---

### **Pillar II: Exception Handling & Defensive Boundaries**
1. **Domain-Specific Custom Exceptions:** Throwing generic `new Error(...)` is strictly prohibited. Always throw structured domain exceptions derived from system base errors (e.g., `ValidationError`, `IntegrityError`, `NotFoundError`, `ConflictError`, `TransactionError`).
2. **Fail-Fast Boundary Validation:** Validate all incoming arguments, schemas, required properties, and runtime preconditions at the method's entry point before allocating resources or mutating state.
3. **No Silent Swallowing:** Never use empty `catch` blocks or catch-and-ignore patterns. Every caught exception must either be:
   * Gracefully handled and remediated,
   * Enriched with domain context and rethrown, or
   * Captured in a transaction rollback tracker to trigger state restoration.
4. **Transactional Rollback Assurance:** Multi-sheet write, update, or delete sequences must execute within an active `TransactionTracker` to ensure complete Last-In, First-Out (LIFO) rollbacks upon unexpected failures.

---

### **Pillar III: Structured Logging & Observability**
1. **Context-Enriched Traces:** Log entries must carry structural context (e.g., `[ServiceName:methodName]`, `entityId`, `operationType`, `executionTimeMs`).
2. **Log Level Discipline:**
   * `DEBUG`: Detailed diagnostic payloads, intermediate calculation steps, and memory snapshots (suppressed in production).
   * `INFO`: Major lifecycle events (transaction started, record persisted, batch completed).
   * `WARN`: Recoverable anomalies, fallback strategies activated, or deprecated code paths invoked.
   * `ERROR`: Critical failures, rejected mutations, integrity constraint violations, and unhandled exceptions.
3. **Zero PII & Secret Leakage:** Never log raw passwords, authentication tokens, API keys, student personal identity numbers, or private financial card credentials.

---

### **Pillar IV: Google Apps Script Platform & Performance Bounds**
1. **Zero SpreadsheetApp API Calls in Loops:** Reading or writing spreadsheet cells iteratively inside loops is strictly prohibited.
   * Ingest data into RAM as 2D arrays via `getValues()`.
   * Perform all transforms, filtering, and indexing in memory.
   * Persist state changes in exactly **one** atomic batch call (`DataSource.updateRowsBatch`, `deleteRowsBatch`, `setValues`).
2. **Cross-Realm Prototype Safety:** Never use `instanceof Date`, `instanceof Array`, or `instanceof RegExp` when handling cross-library or external realm objects. Always use environment-safe utilities (e.g., `Utils.isDate()`, `Array.isArray()`).
3. **Execution Budget & Timeout Awareness:** Keep execution paths optimized to avoid GAS 6-minute wall-clock execution limits.

---

### **Pillar V: Architectural Modularity & Clean Code**
1. **Declarative Strategy Pattern:** Eliminate multi-branch `if-else` cascades or sprawling `switch` statements. Use declarative Strategy Registries to decouple conditional execution flows.
2. **Zero-Hardcoding Schema Metadata:** Column names, table keys, and relationship bindings must be dynamically resolved from compiled schema metadata (`DazzlingDB/Config/Schema/`), never from hardcoded string literals or column indices.
3. **Decoupled Stateless Utilities:** Functions that do not depend on class state or instance variables must be extracted as pure, standalone utility functions.

---

## **3. Standard Production Method Blueprint**

Every production method should reflect the following gold standard implementation pattern:

```javascript
/**
 * Executes a batch status update for academic enrollments with transactional safety.
 *
 * @param {string[]} enrollmentIds - Array of unique enrollment primary keys to transition.
 * @param {string} targetStatus - New enrollment status (e.g., "COMPLETED", "SUSPENDED").
 * @param {Object} [options={}] - Execution configuration options.
 * @param {boolean} [options.cascadeBatchAllocation=false] - Whether to update linked seat allocations.
 * @param {SheetDB.TransactionTracker} [options.tracker=null] - Active transaction context for rollback tracing.
 * @returns {Object} Mutation summary containing { updatedCount: number, affectedIds: string[] }.
 * @throws {SheetDB.ValidationError} When enrollmentIds array is empty or targetStatus is invalid.
 * @throws {SheetDB.IntegrityError} When any enrollment record is locked or missing required dependencies.
 * @throws {SheetDB.TransactionError} When underlying persistence fails and triggers a rollback.
 */
EnrollmentService.prototype.batchUpdateStatus = function(enrollmentIds, targetStatus, options = {}) {
  const startTime = Date.now();
  const methodName = 'EnrollmentService.batchUpdateStatus';

  // 1. Fail-Fast Boundary Validation
  if (!Array.isArray(enrollmentIds) || enrollmentIds.length === 0) {
    throw new SheetDB.ValidationError(
      `[${methodName}] "enrollmentIds" must be a non-empty array of strings.`
    );
  }
  if (typeof targetStatus !== 'string' || !targetStatus.trim()) {
    throw new SheetDB.ValidationError(
      `[${methodName}] "targetStatus" must be a valid non-empty string.`
    );
  }

  Logger.log(`[INFO] [${methodName}] Initiating batch update for ${enrollmentIds.length} records to status "${targetStatus}".`);

  const tracker = options.tracker || new SheetDB.TransactionTracker();
  const isSelfManagedTransaction = !options.tracker;

  try {
    // 2. RAM In-Memory Processing & Batch Persistence
    const repository = this.getEnrollmentRepository();
    const records = repository.findByIds(enrollmentIds);

    if (records.length !== enrollmentIds.length) {
      const foundIds = new Set(records.map(r => r.getId()));
      const missingIds = enrollmentIds.filter(id => !foundIds.has(id));
      throw new SheetDB.NotFoundError(
        `[${methodName}] Records not found for IDs: [${missingIds.join(', ')}]`
      );
    }

    // Prepare batch update payloads in memory (O(1) IO operations)
    const updatePayloads = records.map(record => {
      tracker.recordSnapshot('Enrollment', record.getId(), record.toRowObject());
      return {
        id: record.getId(),
        status: targetStatus,
        updatedAt: new Date()
      };
    });

    const result = repository.updateRowsBatch(updatePayloads);

    // 3. Structured Performance & Success Logging
    const executionDuration = Date.now() - startTime;
    Logger.log(`[INFO] [${methodName}] Successfully updated ${result.updatedCount} records in ${executionDuration}ms.`);

    return {
      updatedCount: result.updatedCount,
      affectedIds: enrollmentIds
    };

  } catch (error) {
    Logger.log(`[ERROR] [${methodName}] Execution failed: ${error.message}`);

    // 4. LIFO Transactional Rollback
    if (isSelfManagedTransaction && tracker.hasRecordedSnapshots()) {
      Logger.log(`[WARN] [${methodName}] Rolling back transaction snapshots...`);
      tracker.rollback();
    }

    // Re-throw categorized error
    if (error instanceof SheetDB.BaseException) {
      throw error;
    }
    throw new SheetDB.TransactionError(
      `[${methodName}] Unexpected failure during batch status update: ${error.message}`,
      error
    );
  }
};
```

---

## **4. Strict Prohibitions & Anti-Patterns**

| Anti-Pattern | Why It Is Blocked | Approved Replacement |
| :--- | :--- | :--- |
| `SpreadsheetApp.*` inside `for`/`forEach` loops | Causes Google Apps Script 6-minute timeout limits | In-memory 2D array manipulation + `updateRowsBatch` |
| `throw new Error("...")` | Inconsistent error identification and caller handling | `throw new SheetDB.ValidationError(...)` / `IntegrityError` |
| `catch (e) {}` (empty catch) | Silently masks production bugs and corrupts data state | Context logging + explicit cleanup + rethrow |
| Hardcoded column indices e.g. `row[4]` | Breaks immediately when schema columns are reordered | Schema metadata resolution e.g. `schema.getColumnIndex("status")` |
| `value instanceof Date` | Fails across GAS library / external execution realms | `SheetDB.Utils.isDate(value)` |
| Arbitrary `console.log(data)` with raw entities | Leaks sensitive personal credentials and clutter logs | Leveled, structured `[TAG]` logging with sanitization |

---

## **5. Pre-Release Production Readiness Checklist**

Before marking any task, pull request, or refactor complete, verify:

- [ ] **JSDoc Complete:** All parameters, types, returns, and exception classes documented.
- [ ] **Preconditions Checked:** Fail-fast input validations active at method entry.
- [ ] **No Generic Errors:** Custom domain exceptions used exclusively.
- [ ] **RAM-First Operations:** Zero API read/write operations inside loops.
- [ ] **Rollback Protected:** Multi-sheet mutations wrapped in transaction trackers.
- [ ] **Leveled Logging:** Diagnostic and contextual logs present without leaking secrets.
- [ ] **Cross-Realm Safe:** Type checks use safe utilities (`Utils.isDate()`).
- [ ] **Schema-Driven:** No hardcoded column offsets or entity table names.
