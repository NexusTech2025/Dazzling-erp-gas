# DazzlingDB Transaction & Batch Operations Architecture

**Date:** 2026-06-06

The last two architectural sessions have fundamentally stabilized the DazzlingDB engine, focusing on **Package Transaction Lifecycles & LIFO Rollbacks** and **High-Performance In-Memory Batch Operations & Schema Engine Validation**.

Below is the definitive architectural extraction of the system state shifts, performance optimizations, and documentation alignments executed across both sessions.

## 1. Package Transaction Lifecycles & LIFO Rollbacks

We conducted a deep trace analysis on the `AcademicService.updatePackage` transaction failure. The core issue was a hydration state conflict: during a failed package update, the catch block attempted to restore database backups using the ORM's high-level `insert()` method. Because these backup models had their internal `_isNew` flag set to `false`, the persistence router attempted to route them to `_performUpdate()` on rows that had already been physically deleted, triggering a `Row/Record Not Found` exception.

### Implementation: Generic TransactionTracker
To ensure atomic transaction safety and bypass `AutoField` security blockers on primary keys, we implemented a generic, LIFO-based (Last-In, First-Out) `TransactionTracker` class. 

```text
+-------------------------+
| TransactionTracker flow |
+-------------------------+
       |
       v (Success Path)
  1. trackInsert(id)
  2. trackUpdate(oldState)
  3. trackSync(oldArray)
       |
       v (Exception Raised -> tx.rollback())
       |
  [ LIFO Rollback Execution ]
  3. Undo Sync: Delete new children -> gateway.insert(backup.toDatabaseRow())
  2. Undo Update: Overwrite with oldState properties
  1. Undo Insert: remove(id)
```

> **CRITICAL DATA WARNING:** By invoking `gateway.insert(item.toDatabaseRow())`, the LIFO sequence directly serializes the model back into a plain row object, completely bypassing standard ORM hydration, validation, and auto-field security checks, thus appending the original state directly to the Google Sheet with its original primary key.

We also formalized the `academic_delete_package` action into `ApiDispatcher.js`, strictly enforcing RESTRICT constraints against active `Enrollment` dependencies and cascading deletions downward to `PackagePerk` and `PackageItem` records.

### Domain Analysis Gap: Proportional Ledger Math
During an audit of the `student_registraton.md` domain runbook against active logic in `StudentService.js`, a severe operational risk was identified in proportional ledger accounting. The design spec dictates utilizing a cumulative sum against the first $N - 1$ items, applying the residual to the $N$-th item to avoid fractional currency unit shifts.

Mathematically, for a total ledger value $V$, and fractional proportions $P_i$:
$$ \text{Residual Allocation}_N = V - \sum_{i=1}^{N-1} \text{round}(V \times P_i) $$

However, the active codebase executes independent `Math.round()` calculations in a loop, allowing a rounding error of $\pm 1$ or $\pm 2$ currency units to mismatch the consolidated ledger. Timezone parsing inside the service was also noted to rely on local container offsets rather than UTC serialization.

## 2. Decoupled Contract-to-Seat Architecture
We fully transitioned the system to **Option A: Strict Decoupled Contract + Seat Model**. This entirely segregates the administrative financial contracts from physical class scheduling. 

*   **`Enrollment` (Contract):** Captures the business ledger contract (either `type: "course"` or `type: "package"`) and its snapshot fee object in metadata. 
*   **`BatchAllocation` (Seat):** Manages the physical slot, mapping the student to a specific `course_id` and `batch_id`. 

Bi-directional `hasMany` relationships via the `allocations` key were injected into the schema definitions (`Enrollment.json`, `Student.json`, and `Batch.json`) to allow automatic ORM relation traversals, alongside new audit fields `remarks` and `dropped_at`. 

## 3. High-Performance In-Memory Batch Operations
To respect Google Apps Script (GAS) API rate limits, we completely abandoned row-by-row SpreadsheetApp updates within loops. We engineered a strict **In-Memory Filtering & Single-Write Overwrite** architecture for `DataSource.deleteRowsBatch` and `DataSource.updateRowsBatch`.

This limits the operation to exactly 3 physical API calls, regardless of dataset size:
1.  **Read (`sheet.getDataRange().getValues()`)**: Extract the complete 2D array into V8 memory.
2.  **Filter/Mutate (RAM)**: Apply filters or column overrides via mapping without API latency.
3.  **Clear & Write (`sheet.getRange().setValues()`)**: Push the fully compiled payload back to the grid.

### Execution Timing Matrix
We shifted benchmark tests to `DazzlingDB/Test/Academic_BatchUpdateTests.js` and instantiated mandatory execution timing tables using `Date.getTime()`. Below are the printed architectural limits against 100 polymorphic items:

| Operation Phase | Records Target | Measured Execution Time | API Cost Strategy |
| :--- | :--- | :--- | :--- |
| **Bootstrapping (Insert Parents)** | - | 5,407 ms | Standard `insert()` loop |
| **insertMany** | 100 | 3,321 ms | Model hydration + UUID gen + bulk write |
| **updateMany** | 100 | **981 ms** | $O(1)$ read + RAM mutation + $O(1)$ write |
| **deleteMany** | 100 | **488 ms** | $O(1)$ read + RAM filter + $O(1)$ write |

## 4. Unified Schema Compiler & Linter Tooling
We deprecated scattered legacy scripts and unified them under the `dazzlingdb-tools/` Node.js package environment. We built an independent `SchemaLinter.js` utilizing Strategy Pattern formatter logic for dynamic terminal verbosity (Quiet, Verbose, Debug Trace).

The static linter now parses against four core architectural rules:
1.  **`PKRule`**: Validates `primaryKey` column definitions and type assignments.
2.  **`ForwardRefRule`**: Ensures `foreign_key` reference targets exist.
3.  **`BackwardRefRule`**: Analyzes relational symmetry to detect missing parent back-references.
4.  **`NullabilityRule`**: Verifies `set_null` foreign key policies do not apply to `required: true` fields or AutoFields.

We introduced `tool_config.json` supporting dual configuration properties for `production` and `development` (pointing to `test_schemas/` sandboxes) enabling dynamic testing.

### Runtime Engine Foreign Key Constraints
Using the output from the tool chain, the ORM generates a `DEPENDENCY_GRAPH`. The `TableGateway.js` implements a recursive `_runOnDeleteActions` interceptor utilizing this graph to perform safe deletes:
*   **`PROTECT`**: Rejects structural deletes immediately if child records exist.
*   **`SET_NULL`**: Executes bulk updates resolving nullification across the foreign key hierarchy.
*   **`CASCADE`**: Traverses up to a recursive depth limit of 3 to clean dead tree allocations entirely.

## 5. Absolute Testing Governance
Lastly, we codified technical testing mandates into the `testing_governance_rules.md` system document. We strictly enforced that all test operations reside exclusively inside the `DazzlingDB/Test/` path, run against a live database singleton (`DBContext.getInstance()`), log `Date.getTime()` intervals into generated timing tables, and never hardcode structural paths using the `file:///` prefix but rather absolute routing references.