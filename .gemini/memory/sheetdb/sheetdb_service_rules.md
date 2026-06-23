# SheetDB Service Architecture Rules
## Mandatory Compliance Guide for All Domain Services & Agents

> **Audience:** Every domain service (e.g., `StudentService`, `StaffService`, `AcademicService`), every agent session, and every engineer writing code that consumes the SheetDB ORM.
> **Authority:** Derived from direct analysis of `SheetDB/` source, `DazzlingDB/DBServices/` patterns, and `StudentService` assessment (2026-06-17).
> **Status:** Binding. Violations are classified as bugs, not style issues.

---

## RULE-01 · Never Pre-Generate Primary Keys — Trust AutoField

### Rule
Do **not** generate primary key values manually before calling `insert()` or `insertOne()`. SheetDB's `AutoField` is the sole authority for PK generation. It generates a prefixed UUID (`"{prefix}-{UUID_SEGMENT}"`) inside `toSheetValue()` at save time.

### Why It Matters
In non-Development environments, `DBContext` boots SheetDB with `allowAutoOverride: false`. Any attempt to pass a pre-filled PK into a model backed by an `AutoField` triggers:
```
ValidationError: Security Error: Manual override of auto-generated field '{pk}' is blocked.
```
This causes the entire operation to fail before a single row is written.

### Anti-Pattern ❌
```javascript
// WRONG — Pre-generating ID and forcing it into insert
const studentId = this._generateId("STU");
db.Student.insert({ student_id: studentId, ...profile });
```

### Correct Pattern ✅
```javascript
// CORRECT — Let AutoField handle PK generation
const studentRecord = db.Student.insert({ ...profile });
// Read the generated ID from the returned model
const studentId = studentRecord.student_id;
```

### Corollary
Helper utilities like `_generateId()` and `_getTablePrefix()` that duplicate AutoField logic are **dead code** and must be removed. The schema's `idPrefix` configuration on the `AutoField` column is the single source of truth for PK prefixes.

---

## RULE-02 · Use the Correct Insertion Method for the Correct Payload Shape

### Rule
SheetDB provides two distinct insertion interfaces. Using the wrong one causes silent failures, performance overhead, or security guard violations.

| Method | When to Use | Payload Shape |
|---|---|---|
| `db.Entity.insert(flatObj)` | Single flat record with no nested relations | `{ col1, col2, fk_col }` |
| `db.Entity.insertOne(nestedDoc)` | Record with embedded child relation objects/arrays | `{ col1, children: [...] }` |
| `db.Entity.insertMany(array)` | Bulk insert of multiple flat or nested documents | `[{ col1 }, { col1 }]` |

### Why It Matters
`insertOne` is a MongoDB-style orchestrator that internally splits the payload into parent columns and nested child relations, inserts the parent first to generate its PK, then injects that PK as the FK into each child before inserting them. Calling it with a flat payload causes unnecessary schema inspection and relation-splitting overhead with no benefit.

### Anti-Pattern ❌
```javascript
// WRONG — Using insertOne for a completely flat record (Payment has no nested children)
db.Payment.insertOne({
  payment_id: generatedId, // also violates RULE-01
  student_fee_id: feeAccountId,
  amount_paid: 500
});
```

### Correct Pattern ✅
```javascript
// CORRECT — Flat record → use insert()
db.Payment.insert({
  student_fee_id: feeAccountId,
  amount_paid: 500,
  payment_date: new Date(),
  payment_method: "cash"
});

// CORRECT — Nested document → use insertOne()
db.Student.insertOne({
  student_name: "Alice",
  email: "alice@example.com",
  address: { city: "Delhi", pincode: "110001" },     // hasOne relation
  enrollments: [{ item_id: "CRS-101", ... }]         // hasMany relation
});
```

---

## RULE-03 · `findById` Takes Exactly One Argument — No Eager-Loading Via Arguments

### Rule
`DynamicRepository.findById(id)` accepts **one argument only**: the primary key value. It does not support a second argument for eager-loading relations. Relations are accessible exclusively via the **dynamic getter methods** injected on the returned model instance.

### Why It Matters
Passing extra arguments to `findById` causes silent failure — the extra arguments are ignored by the method signature, no error is thrown, and the caller believes they received relational data when they did not.

### Anti-Pattern ❌
```javascript
// WRONG — SheetDB ignores the second argument entirely
const student = db.Student.findById(studentId, ['Address', 'ContactInfo', 'Enrollment']);
// student.Address is now a function (getter), NOT loaded data
```

### Correct Pattern ✅
```javascript
// CORRECT — Fetch parent, then call injected relation getters
const student = db.Student.findById(studentId);
if (!student) return null;

const address = student.address ? student.address() : null;
const enrollments = student.enrollments ? student.enrollments() : [];

return { ...student.toJSON(), address, enrollments };
```

### Tip
Relation method names injected by `_injectRelations()` match the relation definition name in the schema's `relations` block (e.g., if the schema declares `"address": { type: "hasOne" }`, the method is `student.address()`).

---

## RULE-04 · Always Wrap Multi-Table Write Operations in a TransactionTracker

### Rule
SheetDB does not provide native ACID transactions. Google Sheets has no rollback mechanism. Any service method that writes to **more than one table** must create a `TransactionTracker`, wrap all writes in a `try/catch`, and call `tx.rollback()` in the catch block.

### Why It Matters
Without a `TransactionTracker`, a failure midway through a multi-table write sequence leaves the database in a **partially mutated state** — orphaned parent records with no children, or child records with dangling foreign keys pointing to non-existent parents.

### Anti-Pattern ❌
```javascript
// WRONG — No transaction wrapper. If _persistContactGraph throws,
// the Student and Address rows are orphaned with no cleanup.
registerStudent(payload, context) {
  const student = this._persistStudentProfile(payload, context);
  this._persistAddressGraph(student.student_id, payload.address, context);
  this._persistContactGraph(student.student_id, payload.contact, context); // throws?
}
```

### Correct Pattern ✅
```javascript
// CORRECT — Full TransactionTracker coverage
registerStudent(payload, context) {
  const db = DBContext.getInstance();
  const tx = new TransactionTracker();
  try {
    const student = this._persistStudentProfile(payload, context, tx);
    this._persistAddressGraph(student.student_id, payload.address, context, tx);
    this._persistContactGraph(student.student_id, payload.contact, context, tx);
    this._processEnrollmentLedgers(student.student_id, payload, context, tx);
    return student;
  } catch (error) {
    console.error("[Service] Orchestration failed. Rolling back...", error);
    tx.rollback();
    throw error;
  }
}

// Each private method tracks its insert:
_persistStudentProfile(payload, context, tx) {
  const record = db.Student.insert({ ...payload.profile });
  tx.trackInsert(db.Student, record.student_id);
  return record;
}
```

### Tracking Reference
| Operation | Tracker Method |
|---|---|
| New record inserted | `tx.trackInsert(repo, generatedId)` |
| Existing record updated | `tx.trackUpdate(repo, id, originalSnapshot)` |
| Record deleted | `tx.trackDelete(repo, hydratedModelInstance)` |

---

## RULE-05 · Never Call `findById` / `where` Inside Loops — Pre-Load Reference Tables

### Rule
Never call any SheetDB repository read method (`findById`, `where`, `findOne`, `all`) **inside a loop**. Each call triggers a full spreadsheet sheet read (a network I/O operation). For N iterations, this produces N reads — an O(N) I/O pattern that exceeds GAS execution limits at production data volumes.

Pre-load all required reference tables into in-memory maps **before** entering the loop.

### Why It Matters
GAS execution is capped at **6 minutes**. A single `findById` call on a medium-sized sheet takes ~200–500ms. A loop over 100 records with 3 lookups each = 300 reads × 350ms = 105 seconds → guaranteed timeout. Mid-loop timeouts leave partial writes with no rollback.

### Anti-Pattern ❌
```javascript
// WRONG — findById called on every loop iteration
payload.records.forEach(rec => {
  const student = db.Student.findById(rec.student_id); // full sheet read each time
  const batch = db.Batch.findById(rec.batch_id);       // full sheet read each time
  // ...
});
```

### Correct Pattern ✅
```javascript
// CORRECT — Pre-load once, then use O(1) map lookups inside the loop
const studentMap = {};
db.Student.all().forEach(s => { studentMap[s.student_id] = s; });

const batchMap = {};
db.Batch.all().forEach(b => { batchMap[b.batch_id] = b; });

payload.records.forEach(rec => {
  const student = studentMap[rec.student_id]; // O(1) in-memory lookup
  const batch = batchMap[rec.batch_id];       // O(1) in-memory lookup
  if (!student) throw new SheetDB.EntityNotFoundError("Student", rec.student_id);
  // ...
});
```

### Extended Rule
This applies equally to `queryAttendance`, `getProfile`, and any reporting/hydration method that joins data from multiple tables during a `map()` or `forEach()`.

---

## RULE-06 · Throw Typed Domain Errors — Never Throw Generic `Error`

### Rule
SheetDB defines a complete error taxonomy in `SheetDB/Errors.js`. Domain services must throw the most specific applicable error class. Generic `throw new Error("message")` is forbidden for domain-level failures.

### Why It Matters
Typed errors enable precise `catch` blocks at the API boundary, structured error logging, consistent HTTP status code mapping (e.g., `EntityNotFoundError` → 404, `IntegrityError` → 409, `ValidationError` → 400), and downstream diagnostics.

### Error Taxonomy Reference
| Situation | Correct Error Class |
|---|---|
| Record not found by PK or filter | `EntityNotFoundError(entity, id, domain)` |
| FK constraint blocked a delete | `IntegrityError(message)` |
| Field-level schema violation | `ValidationError(message, { errors })` |
| Business rule / logical violation | `ActionValidationError(message, { errorCode, details })` |
| Batch delete input violation | `BatchDeleteError(message, context)` |
| Custom domain orchestration failure | Extend `SheetDBError` with a named subclass |

### Anti-Pattern ❌
```javascript
// WRONG — Generic errors lose type information at the API boundary
if (!enrollment) throw new Error(`Enrollment ${id} not found.`);
if (!package) throw new Error(`Package ${packageId} not found.`);
```

### Correct Pattern ✅
```javascript
// CORRECT — Typed errors with structured context
if (!enrollment) throw new EntityNotFoundError("Enrollment", id, "Academic");
if (!pkg) throw new EntityNotFoundError("Package", packageId, "Finance");
if (totalFee <= 0) throw new ActionValidationError("total_fee must be positive.", {
  errorCode: "INVALID_LEDGER_VALUATION",
  details: [{ field: "total_fee", issue: "Value must be greater than zero." }]
});
```

---

## RULE-07 · Validate All Numeric Inputs Before Arithmetic — Guard Against NaN and Infinity

### Rule
Before performing any arithmetic on values received from the payload or from database reads, validate that the value is a **finite, non-zero number** using `Number(val)` and `isNaN()` / `isFinite()`. Division operations require an explicit non-zero denominator guard.

### Why It Matters
In JavaScript, `undefined <= 0` is `false` (the guard silently passes), `x / 0 = Infinity`, and `Math.round(Infinity)` = `Infinity`. SheetDB writes `Infinity` to the sheet as an empty string `""`, silently corrupting numeric columns. NaN propagates through all downstream calculations.

### Anti-Pattern ❌
```javascript
// WRONG — If total_fee is undefined, this guard passes silently
if (payload.feeAccount && payload.feeAccount.total_fee <= 0) {
  throw new ActionValidationError("...");
}
// Later: proportion = item.fee / undefined → NaN → sheet corruption
const proportion = item.fee / payload.feeAccount.total_fee;
```

### Correct Pattern ✅
```javascript
// CORRECT — Explicit numeric coercion and guard before arithmetic
const totalFee = Number(payload.feeAccount?.total_fee);
if (!isFinite(totalFee) || totalFee <= 0) {
  throw new ActionValidationError("feeAccount.total_fee must be a positive finite number.", {
    errorCode: "INVALID_LEDGER_VALUATION",
    details: [{ field: "feeAccount.total_fee", issue: "Must be > 0 and not NaN/Infinity." }]
  });
}
const proportion = item.fee / totalFee; // Safe: denominator validated
```

---

## RULE-08 · Obey Command-Query Separation — Read Methods Must Not Mutate State

### Rule
A method that **reads** or **checks** state (a Query) must not write to, update, or delete any database record. A method that **changes** state (a Command) must not be named or used as a query. These are two separate, distinct responsibilities and must never be combined.

### Why It Matters
Violating CQS makes it impossible for callers to safely call a check method without triggering invisible side effects. Reporting pipelines, audit logs, and health check callers will accidentally mutate production data.

### Anti-Pattern ❌
```javascript
// WRONG — verifyAccess() is named as a query but suspends allocations as a side effect
verifyAccess(studentId, courseId, context) {
  // ... reads installments ...
  if (isOverdue) {
    db.BatchAllocation.update(allocationId, { status: "suspended" }); // MUTATION inside a query!
    return { allowed: false };
  }
  return { allowed: true };
}
```

### Correct Pattern ✅
```javascript
// CORRECT — Separate the query from the command
checkAccessStatus(studentId, courseId) {
  // Pure read — returns status object, never writes anything
  const isOverdue = this._computeOverdueStatus(studentId, courseId);
  return isOverdue
    ? { allowed: false, reason: "Overdue installment." }
    : { allowed: true };
}

suspendOverdueAccess(studentId, courseId, context) {
  // Command — explicitly named, explicitly tracked
  const tx = new TransactionTracker();
  try {
    db.BatchAllocation.update(allocationId, { status: "suspended" });
    tx.trackUpdate(db.BatchAllocation, allocationId, backup);
  } catch (e) { tx.rollback(); throw e; }
}
```

---

## RULE-09 · Use Composite Keys for Upsert Lookups — Never Partial Key Matching

### Rule
When implementing an upsert pattern (find-existing-then-update-or-insert), the `findOne()` filter must include **all columns that together form the unique business identity** of the record. Using a partial key produces incorrect matches and data overwrites.

### Why It Matters
A student attending two different batches on the same date will have two distinct attendance records. Keying the upsert on only `{ student_id, attendance_date }` causes the second batch attendance to overwrite the first, silently destroying valid data.

### Anti-Pattern ❌
```javascript
// WRONG — partial key: student can have multiple batch attendances on same date
const existing = db.StudentAttendance.findOne({
  student_id: studentId,
  attendance_date: dateStr
  // missing: batch_id
});
```

### Correct Pattern ✅
```javascript
// CORRECT — full composite business key
const existing = db.StudentAttendance.findOne({
  student_id: studentId,
  batch_id: batchId,
  attendance_date: dateStr
});
```

### General Principle
Always identify the **minimum set of columns that makes a record unique** in business terms, and use all of them in upsert lookups.

---

## RULE-10 · Use `SheetDB.isDate()` — Never Use `instanceof Date` for Date Validation

### Rule
In Google Apps Script, when SheetDB is used as a library (loaded via Script ID), Date objects created inside the library exist in a **different JavaScript realm** than the consuming script. As a result, `value instanceof Date` always returns `false` for Date objects from the library, even when the value is a valid Date.

Always prefer using `SheetDB.isDate(value)` which is bound to the `SheetDB` namespace, or the global `isDate(value)` utility function from `SheetDB/Utils.js` which is bound to `globalThis.isDate`.

### Why It Matters
A false `instanceof Date` check causes valid Date objects to be treated as non-dates — they may be re-parsed, double-converted, or fail type checks, producing corrupt ISO strings or `Invalid Date` values written to the sheet.

### Anti-Pattern ❌
```javascript
// WRONG — always false in GAS library context
if (value instanceof Date) {
  return value.toISOString();
}
```

### Correct Pattern ✅
```javascript
// CORRECT — cross-realm safe utility
if (SheetDB.isDate(value)) {
  return value.toISOString();
}
// OR
if (globalThis.isDate && globalThis.isDate(value)) {
  return value.toISOString();
}
```

---

## RULE-11 · Never Construct Synthetic Primary Keys from Business Logic

### Rule
Primary key values must not be assembled from business data (e.g., entity IDs, type codes, or hardcoded suffixes) to produce a "known" key that can be looked up later. This pattern creates an implicit naming convention that is invisible to the schema, fragile to input changes, and breaks the responsibility boundary of `AutoField`.

### Why It Matters
A synthetically constructed PK like `"FPL-CRS-101-DEFAULT"` creates a hidden contract between the insertion code and the lookup code. If the `item_id` format changes, all existing synthetic PKs become orphaned. There is no schema-level enforcement of this format.

### Anti-Pattern ❌
```javascript
// WRONG — constructing a PK from business logic
const defaultPlanId = `${feePlanPrefix}-${item.item_id}-DEFAULT`;
let plan = db.FeePlan.findById(defaultPlanId);
if (!plan) {
  db.FeePlan.insert({ fee_plan_id: defaultPlanId, ... });
}
```

### Correct Pattern ✅
```javascript
// CORRECT — query by natural/business key columns, not synthetic PK
let plan = db.FeePlan.findOne({
  entity_id: item.item_id,
  entity_type: enrollmentType,
  plan_name: "Default Standard Plan"
});
if (!plan) {
  plan = db.FeePlan.insert({
    entity_id: item.item_id,
    entity_type: enrollmentType,
    plan_name: "Default Standard Plan",
    total_fee: baseFee,
    discount_allowed: true,
    installment_allowed: true
  });
}
```

---

## RULE-12 · Use `toJSON()` for API Serialization — Never Expose Raw Model Instances

### Rule
Before returning data from a service method to an API action controller or external caller, call `.toJSON()` on every `BaseModel` instance. Never return raw model instances to the API boundary.

### Why It Matters
`BaseModel` instances contain internal framework properties (`_gateway`, `_registry`, `_resolver`, `_isNew`, etc.) and injected relation getter functions. Serializing these to JSON creates circular reference errors, leaks internal architecture details, and produces unpredictable JSON shapes.

### Anti-Pattern ❌
```javascript
// WRONG — returning raw model instance to the API layer
const student = db.Student.findById(id);
return student; // contains _gateway, _resolver, _isNew, function properties
```

### Correct Pattern ✅
```javascript
// CORRECT — serialize to clean JSON before returning
const student = db.Student.findById(id);
if (!student) throw new EntityNotFoundError("Student", id);
return student.toJSON(); // clean: dates as ISO strings, no internal props
```

---

## RULE-13 · Always Backup State Before Update in TransactionTracker

### Rule
When calling `tx.trackUpdate(repo, id, originalState)`, the `originalState` must be a **plain object snapshot** taken *before* the update is applied. Use `{ ...model }` (shallow clone) or `model.toJSON()` to capture it. Never pass the live model reference — it will reflect the post-update state and the rollback will restore the wrong values.

### Anti-Pattern ❌
```javascript
// WRONG — backup captured AFTER update (reference, not snapshot)
db.Enrollment.update(eid, { status: "completed" });
tx.trackUpdate(db.Enrollment, eid, enr); // enr is a live reference, now showing "completed"
```

### Correct Pattern ✅
```javascript
// CORRECT — snapshot BEFORE mutation
const enr = db.Enrollment.findById(eid);
const backup = { ...enr }; // or enr.toJSON()
db.Enrollment.update(eid, { status: "completed" });
tx.trackUpdate(db.Enrollment, eid, backup); // backup holds original state
```

---

## RULE-14 · Obey Single-Argument Method Signatures — Do Not Add Overloaded Call Forms

### Rule
JavaScript does not enforce function signatures. Adding dual-mode argument parsing (e.g., accepting either `(id, courseId, context)` or `(payloadObj, context)`) creates invisible bugs when the branching logic is incorrect, as was observed in `processSubjectWithdrawal`. Every service method must have **exactly one call convention**, documented explicitly.

### Anti-Pattern ❌
```javascript
// WRONG — two call forms with brittle branch logic
processSubjectWithdrawal(studentIdOrPayload, courseId, context) {
  let studentId, courseIdVal, ctx;
  if (typeof studentIdOrPayload === 'object' && !courseId) {
    studentId = studentIdOrPayload.studentId;
    ctx = courseId; // BUG: courseId is the 2nd param, not context
  } else {
    studentId = studentIdOrPayload;
    ctx = context;
  }
}
```

### Correct Pattern ✅
```javascript
// CORRECT — single, documented call signature
/**
 * @param {string} studentId
 * @param {string} courseId
 * @param {Object} context
 */
processSubjectWithdrawal(studentId, courseId, context) {
  if (!studentId || !courseId) throw new ActionValidationError("studentId and courseId are required.");
  // single path, no branching on argument shape
}
```

---

## RULE-15 · DBContext.getInstance() Must Be Called Per Method — Never Cached in Service-Level Variables

### Rule
`DBContext.getInstance()` is a singleton that resolves the correct database instance based on the active environment (`ENV` script property). It must be called at the **start of each service method** that needs DB access. Never assign `DBContext.getInstance()` to a module-level or `const` variable outside a method body.

### Why It Matters
In GAS, the script container is cold-started on each execution. The `DBContext` singleton implements a folder-ID-based cache validation (`instance._fs.rootFolderId !== activeFolderId`). Caching the instance outside method scope defeats this check and can cause the service to use a stale DB connection pointing to the wrong environment folder.

### Anti-Pattern ❌
```javascript
// WRONG — db cached at module level
const db = DBContext.getInstance(); // resolved once, wrong environment possible

const StudentService = {
  registerStudent(payload) {
    db.Student.insert(...); // uses stale instance
  }
};
```

### Correct Pattern ✅
```javascript
// CORRECT — resolved fresh per method call
const StudentService = {
  registerStudent(payload, context) {
    const db = DBContext.getInstance(); // resolves correct env instance
    // ...
  },
  getProfile(studentId) {
    const db = DBContext.getInstance();
    // ...
  }
};
```

---

## Quick Reference Cheatsheet

| Rule | One-Line Summary |
|---|---|
| **RULE-01** | Never pre-generate PKs — trust `AutoField` |
| **RULE-02** | `insert()` for flat, `insertOne()` for nested, `insertMany()` for bulk |
| **RULE-03** | `findById(id)` is single-arg — relations via getter methods only |
| **RULE-04** | All multi-table writes need `TransactionTracker` + `try/catch/rollback` |
| **RULE-05** | Never call read methods inside loops — pre-load into maps |
| **RULE-06** | Throw typed SheetDB errors — never generic `new Error()` |
| **RULE-07** | Validate numerics before arithmetic — guard NaN and division-by-zero |
| **RULE-08** | Query methods must not mutate — CQS is mandatory |
| **RULE-09** | Upsert `findOne()` must use the full composite business key |
| **RULE-10** | Use `isDate(val)` — never `instanceof Date` in GAS library scope |
| **RULE-11** | Never construct synthetic PKs from business logic — query by natural key |
| **RULE-12** | Call `.toJSON()` before returning models to the API boundary |
| **RULE-13** | Snapshot state (`{ ...model }`) BEFORE update for `trackUpdate()` |
| **RULE-14** | One call signature per method — no overloaded argument forms |
| **RULE-15** | Call `DBContext.getInstance()` inside each method — never at module level |

---

*Generated by Aira · Session 2026-06-17 · Based on: SheetDB source analysis + StudentService assessment*
