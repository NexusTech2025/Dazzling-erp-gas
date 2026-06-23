# Code Self-Assessor Report: `StudentService.js`

**File:** [StudentService.js](file:///E:/NAST/Dazzling/GAS/DazzlingDB/DBServices/StudentService.js)
**Size:** 1,041 lines · 38,464 bytes
**Environment:** Google Apps Script (GAS) — DazzlingDB / SheetDB ORM

---

## 📊 Robustness Score: 5 / 10 — **Moderate**

> Functional and architecturally intentional, but fragile under production loads. Several critical SheetDB API contract violations, serious GAS quota risks, and a transaction model that only partially protects data integrity. Needs hardening before production release.

---

## ✅ Step 1 — Context Resolution

| Axis | Assessment |
|---|---|
| Language | Google Apps Script (ES5/ES2015 subset) |
| Framework | SheetDB ORM (custom in-house library) |
| Scope | Domain Service — Orchestrates multi-table Student CRUD |
| DB Access Pattern | `DBContext.getInstance()` singleton → `DynamicRepository` |
| Transaction Strategy | Custom `TransactionTracker` (manual LIFO rollback) |
| Relation Layer | Relies on `insertOne` (nested), `insert` (flat), `update`, `remove` |

---

## 🔴 Critical Issues

---

### CRIT-01 · `findById` Called with Array Argument on Repository — API Contract Violation

- **Cause:** Line 377: `db.Student.findById(studentId, ['Address', 'ContactInfo', 'Enrollment'])` passes a second argument (a relations array) to `findById`. SheetDB's `DynamicRepository.findById(id)` has a **single-argument signature**. It does not support eager-loading via argument — relations are only accessible via injected dynamic getter methods on the returned model (e.g., `student.Address()`).
- **Scenario:** Every call to `getProfile()` silently discards the relations array. The caller believes they are receiving a hydrated profile with address/contact/enrollment data, but they receive only the bare `Student` model. Any downstream code unpacking `profile.Address` or `profile.Enrollment` receives `undefined` or a function reference instead of data.
- **Impact:** Silent data contract violation. The `getProfile()` method is **functionally broken** for any caller expecting relational data. This is a **data integrity** and **API contract** failure.
- **Fix:**
```javascript
// WRONG — SheetDB does not support this signature
getProfile(studentId) {
  return db.Student.findById(studentId, ['Address', 'ContactInfo', 'Enrollment']);
}

// CORRECT — Use injected relation getter methods on the returned model instance
getProfile(studentId) {
  const db = DBContext.getInstance();
  const student = db.Student.findById(studentId);
  if (!student) return null;

  return {
    ...student.toJSON(),
    address: student.address ? student.address() : null,
    contact: student.contact ? student.contact() : null,
    enrollments: student.enrollments ? student.enrollments() : []
  };
}
```

---

### CRIT-02 · `insertOne` Used for Flat Records — Semantic Misuse of SheetDB API

- **Cause:** `insertOne` is SheetDB's **MongoDB-style nested insertion** method. It is designed for payloads that contain nested relation objects/arrays. It internally splits columns from relations, inserts the parent first, then walks nested children injecting FK automatically. Using `insertOne` for a **flat, non-relational payload** (e.g., `db.StudentLead.insertOne(recordPayload)`, `db.Payment.insertOne(...)`, `db.Enrollment.insert(...)`) creates an unnecessary overhead and the wrong semantic.

  More critically: `_persistStudentProfile` calls `db.Student.insertOne(profile)` where `profile` contains **manually pre-generated IDs** (e.g., `student_id: studentId`). SheetDB's `AutoField.toSheetValue()` is guarded by `allowAutoOverride` — in production environments this will throw `ValidationError: Security Error: Manual override of auto-generated field 'student_id' is blocked`.

- **Scenario:** `registerStudent()` in a **production environment** (`allowAutoOverride = false` in `DBContext._init()` for non-`DEVELOPMENT` envs) → `_persistStudentProfile` → `db.Student.insertOne(profile)` with pre-set `student_id` → `BaseModel.save()` → AutoField guard throws `ValidationError`.
- **Impact:** 🔴 **Full student registration is broken in production.** The entire `registerStudent` flow fails before writing any records.
- **Fix:**

```javascript
// WRONG — Pre-generating IDs and passing to insertOne (will fail in production)
_persistStudentProfile(payload, context) {
  const studentId = this._generateId(...); // manual generation
  db.Student.insertOne({ ...profile, student_id: studentId });
}

// CORRECT — Let AutoField generate the ID via insert(); read back the generated ID
_persistStudentProfile(payload, context) {
  const db = DBContext.getInstance();
  // Do NOT pre-generate the PK. Let AutoField handle it.
  const studentRecord = db.Student.insert({ ...payload.profile });
  this._trackMutation(context, "Student");
  return studentRecord; // studentRecord[pk] is now the AutoField-generated ID
}
```

  The `_generateId` / `_getTablePrefix` utility helpers become **entirely redundant** once AutoField is trusted. They are working around a SheetDB feature that already exists.

---

### CRIT-03 · N+1 Spreadsheet Read Problem in `markAttendanceBulk` — GAS Execution Timeout Risk

- **Cause:** Line 946: Inside the `payload.records.forEach()` loop, `db.Student.findById(studentId)` is called **for every single attendance record**. `findById` internally calls `this.gateway.all()` → `dataSource.readTable()` which performs a full spreadsheet sheet read on every call. With 50 students, this triggers 50 separate read operations.
- **Scenario:** A class of 50 students triggers bulk attendance marking. 50 × full-sheet read = 50 spreadsheet API calls, each potentially 200–500ms. Total: 10–25 seconds per operation. GAS execution limit is 6 minutes (360 seconds) for consumer accounts. For 500 students (reasonable class size across multiple batches), this **exceeds the GAS execution timeout**.
- **Impact:** 🔴 **Service crashes mid-write for large batches**, leaving partial attendance records in the database with no rollback.
- **Fix:**

```javascript
markAttendanceBulk(payload, context) {
  // Pre-load all students ONCE before the loop
  const allStudents = db.Student.all();
  const studentMap = {};
  allStudents.forEach(s => { studentMap[s.student_id] = s; });

  payload.records.forEach(rec => {
    const studentId = String(rec.student_id).trim();
    if (!studentMap[studentId]) {
      throw new SheetDB.EntityNotFoundError("Student", studentId, "Students");
    }
    // ... rest of loop, no more per-student DB calls
  });
}
```

---

### CRIT-04 · `processSubjectWithdrawal` — Argument Parsing Bug Creates Silent Data Corruption

- **Cause:** Lines 408–417: The overloaded argument dispatcher contains a logic fault:
  ```javascript
  if (studentIdOrPayload && typeof studentIdOrPayload === 'object' && !courseId) {
    studentId = studentIdOrPayload.studentId;
    courseIdVal = studentIdOrPayload.courseId;
    ctx = courseId; // ← courseId is undefined here, so ctx = undefined
  }
  ```
  When called as `processSubjectWithdrawal(payloadObj, context)`, the intent is that `context` is the second argument. But the code assigns `ctx = courseId` (which is `context` in the 2-arg call form), NOT `ctx = context` (the third parameter). In the object-form call, `ctx` will **always be `undefined`**, meaning `_trackMutation` is silently called with `undefined`, and the `TransactionTracker` created inside still works — but the mutation manifest is never updated, breaking any upstream audit/logging.
- **Scenario:** Any caller using the object-form API: `StudentService.processSubjectWithdrawal({ studentId, courseId }, context)` → `ctx = undefined` → no mutation tracking.
- **Impact:** 🔴 **Silent audit failure** — mutation tracking is broken for this call pattern. Also reveals an unresolved API design smell.
- **Fix:** Eliminate the overloaded signature entirely. Pick a single consistent call convention:

```javascript
// Single, unambiguous signature
processSubjectWithdrawal(studentId, courseId, context) {
  // Validate inputs up-front
  if (!studentId || !courseId) {
    throw new ActionValidationError("studentId and courseId are required.");
  }
  // ... rest of implementation
}
```

---

## 🟠 High Priority Issues

---

### HIGH-01 · `TransactionTracker.rollback()` Called on Insert-Only Operations — Missing `trackInsert` in `registerStudent`

- **Cause:** `registerStudent()` calls 4–7 sequential `insert` / `insertOne` operations but **never creates a `TransactionTracker`**. If `_persistContactGraph` throws after `_persistStudentProfile` has succeeded, the Student row is orphaned in the spreadsheet with no rollback mechanism.
- **Scenario:** `_persistEducationGraph` throws a `ValidationError` mid-forEach → Student + Address + Contact rows are already committed to the sheet → no cleanup happens.
- **Impact:** 🟠 **Data corruption** — orphaned Student records with partial related data. Referential integrity is violated.
- **Fix:** Wrap `registerStudent` in a `TransactionTracker` that tracks every inserted ID:

```javascript
registerStudent(payload, context) {
  const tx = new TransactionTracker();
  const db = DBContext.getInstance();
  try {
    this._verifyCurriculumCompleteness(payload);
    this._verifyLedgerAlignment(payload);
    const student = this._persistStudentProfile(payload, context, tx);
    this._persistAddressGraph(student.student_id, payload.address, context, tx);
    this._persistContactGraph(student.student_id, payload.contact, context, tx);
    this._persistEducationGraph(student.student_id, payload.education, context, tx);
    this._processEnrollmentLedgers(student.student_id, payload, context, tx);
    return student;
  } catch (error) {
    console.error("[StudentService] Registration failed, rolling back...", error);
    tx.rollback();
    throw error;
  }
}
```

---

### HIGH-02 · `_verifyLedgerAlignment` Fails to Guard `undefined` / `null` Financials — False Pass

- **Cause:** Lines 109 and 118:
  ```javascript
  if (payload.financials && payload.financials.total_fee <= 0) { ... }
  if (payload.feeAccount && payload.feeAccount.total_fee <= 0) { ... }
  ```
  If `payload.financials` is present but `total_fee` is `undefined`, then `undefined <= 0` evaluates to `false` in JavaScript. The guard silently passes, allowing a `total_fee = undefined` to propagate into the fee calculation engine, producing `NaN` arithmetic downstream.
- **Scenario:** Caller omits `total_fee` from the payload → `NaN` stored in `StudentFeeAccount.total_fee`.
- **Fix:**
```javascript
if (payload.feeAccount) {
  const fee = Number(payload.feeAccount.total_fee);
  if (isNaN(fee) || fee <= 0) {
    throw new ActionValidationError("feeAccount.total_fee must be a positive number.", { ... });
  }
}
```

---

### HIGH-03 · `_processEnrollmentLedgers` — Division by Zero Risk in Proportional Fee Split

- **Cause:** Line 292:
  ```javascript
  const proportion = item.fee / payload.feeAccount.total_fee;
  ```
  If `payload.feeAccount.total_fee` is `0` (which can slip through `_verifyLedgerAlignment` due to HIGH-02 above), this produces `Infinity`. All downstream `Math.round(x * Infinity)` calls produce `Infinity` or `NaN`, which gets written to the sheet as an empty string (`""`), corrupting `StudentFeeAccount`, `Installment`, and `Payment` records.
- **Fix:** Add a defensive guard at the start of the proportion calculation block:

```javascript
const totalFee = Number(payload.feeAccount.total_fee);
if (!totalFee || totalFee <= 0) {
  throw new ActionValidationError("Cannot compute fee proportion: total_fee is zero or invalid.");
}
const proportion = item.fee / totalFee;
```

---

### HIGH-04 · `queryAttendance` — N+1 Read Per Attendance Record

- **Cause:** Lines 1015–1024: Inside the `hydrated.map()` loop, for each attendance record, the code calls:
  - `db.Student.findById(record.student_id)` → full sheet read
  - `db.Batch.findById(record.batch_id)` → full sheet read
  - `db.Course.findById(batch.course_id)` → full sheet read

  For 100 attendance records, this is **300 separate spreadsheet reads**.
- **Scenario:** A report query for a month's attendance with 200 records → 600 Spreadsheet API calls → high risk of GAS 6-minute timeout + `Exception: Service invoked too many times for one day` quota errors.
- **Fix:** Pre-load lookups before the map loop:
```javascript
queryAttendance(payload) {
  const db = DBContext.getInstance();
  const results = QueryEngine.execute({ target: "StudentAttendance", ...payload }, db);
  const records = results.data || [];

  // Pre-load reference data ONCE
  const studentsMap = {};
  db.Student.all().forEach(s => { studentsMap[s.student_id] = s; });
  const batchesMap = {};
  db.Batch.all().forEach(b => { batchesMap[b.batch_id] = b; });
  const coursesMap = {};
  db.Course.all().forEach(c => { coursesMap[c.course_id] = c; });

  results.data = records.map(row => {
    const record = (typeof row.toJSON === 'function') ? row.toJSON() : row;
    // ... use maps instead of individual findById calls
  });
  return results;
}
```

---

### HIGH-05 · `verifyAccess` Mutates State Inside a Read Method — Side Effect Violation

- **Cause:** Lines 799–820: `verifyAccess()` is a read-access check — callers expect it to return a boolean-like status. However, it **mutates the database** by suspending `BatchAllocation` records when overdue installments are detected. This is a hidden side effect inside a query method, violating the Command-Query Separation (CQS) principle.
- **Scenario:** Any system that calls `verifyAccess()` for reporting, analytics, or audit purposes will inadvertently suspend students' allocations.
- **Fix:** Extract the suspension logic into a dedicated command method:
```javascript
// Separate the read from the write
checkAccessStatus(studentId, courseId) { /* pure read */ }
suspendAccessForOverdue(studentId, courseId, context) { /* mutation */ }
```

---

## 🟡 Medium Issues

---

### MED-01 · Manual ID Generation Bypasses SheetDB AutoField — Dual ID Authority

- **Cause:** `_generateId()` and `_getTablePrefix()` are used throughout the service to pre-generate primary key values before calling `db.Entity.insert({...entity_id: generatedId})`. SheetDB already has `AutoField` which handles this automatically with `Utilities.getUuid()` and prefix config. The service is effectively duplicating this infrastructure and creating a **dual ID authority** — if the schema's `AutoField` prefix is updated, the service's prefix registry falls out of sync.
- **Fix:** Trust `AutoField`. Remove `_generateId` and `_getTablePrefix`. Read back the generated PK from the returned model after `insert()`.

---

### MED-02 · `_processEnrollmentLedgers` — FeePlan ID Constructed Outside Schema Awareness

- **Cause:** Line 234: `const defaultPlanId = \`${feePlanPrefix}-${item.item_id}-DEFAULT\``. This constructs a primary key value using business logic inline in the service. This hard-coded key format creates a dependency on a naming convention that is not enforced anywhere in the schema and will silently break if the `item_id` format changes.
- **Fix:** Query for the plan by `entity_id + entity_type` (natural key lookup) rather than constructing the synthetic PK:
```javascript
let plan = db.FeePlan.findOne({ entity_id: item.item_id, entity_type: enrollmentType });
```

---

### MED-03 · `upgradeToPackage` — Missing Guard for Empty `currentEnrollmentIds`

- **Cause:** Line 584: `const currentEnrollmentIdsVal = payload.currentEnrollmentIds || []`. If the array is empty, `totalPaymentsToRollover` remains `0` and the package upgrade creates a new SFA with `amount_paid = 0`. This is logically correct only if the student truly has no prior payments — but the method does not validate whether this is an intentional upgrade or a malformed payload.

---

### MED-04 · `processSubjectWithdrawal` — Sorts Installments in Incorrect Order for Reduction

- **Cause:** Line 498: `installments.sort((a, b) => b.installment_number - a.installment_number)`. Installments are sorted **descending** (latest first). When reducing outstanding balances in the `else` branch (no cash refund), the loop reduces the last installment first. Standard accounting convention is to reduce the earliest (nearest-due) unpaid installment first (FIFO). This may produce confusing fee accounts where later installments are reduced before earlier ones.

---

### MED-05 · `markAttendance` — Upsert Keyed on `student_id + attendance_date` Missing `batch_id`

- **Cause:** Line 881-884:
  ```javascript
  const existing = db.StudentAttendance.findOne({
    student_id: studentId,
    attendance_date: dateStr
  });
  ```
  A student can attend multiple batches on the same date. The upsert key does not include `batch_id`, so a student's second attendance record for a different batch on the same day will **overwrite** the first. The correct composite key should be `{ student_id, batch_id, attendance_date }`.
- **Fix:**
```javascript
const existing = db.StudentAttendance.findOne({
  student_id: studentId,
  batch_id: batchId,
  attendance_date: dateStr
});
```

---

## 🟢 Low Priority Issues

---

### LOW-01 · `_trackMutation` Is Called With `undefined` Context Silently

The guard `context && context.mutationManifest && Array.isArray(...)` is correct, but when `context` is `undefined` (see CRIT-04), the entire tracking is silently skipped. A debug-level log would help diagnose missed tracking.

---

### LOW-02 · Generic `Error` Instances Thrown Instead of Domain Errors

Lines 427, 432, 435, 454, 464, 471, 609: `throw new Error(...)` is used for domain-specific failures (e.g., "Enrollment not found", "Package not found"). These should throw typed errors (`EntityNotFoundError`, `IntegrityError`) consistent with the SheetDB error taxonomy.

---

### LOW-03 · `upgradeToPackage` — Payment Method Hard-coded to `"cash"`

Lines 722, 527: `payment_method: "cash"` is hardcoded for rollover payments and refunds. This should derive from `payload.paymentMethod` or a configurable constant.

---

### LOW-04 · `self = this` Anti-pattern in Arrow-Function Contexts

Lines 439, 579: `const self = this` captures `this` for use inside try/catch. Since the try/catch bodies are not callback contexts (no async, no event handlers), `this` is already stable. The `self` alias is unnecessary — a remnant of ES5 patterns. Use `this` directly.

---

## 💪 Strengths

1. **Solid Domain Decomposition:** `registerStudent` is cleanly split into private primitives (`_persistStudentProfile`, `_persistAddressGraph`, etc.). Each primitive is focused and independently testable.
2. **TransactionTracker Usage in Complex Operations:** `processSubjectWithdrawal` and `upgradeToPackage` correctly use `TransactionTracker` with `try/catch/rollback` wrapping — the right pattern for multi-table mutations.
3. **Proportional Fee Distribution:** The fee split logic using `proportion = item.fee / total_fee` is a sound algorithmic approach for distributing discounts and payments across multi-enrollment packages.
4. **Pre-flight Validation Before Persistence:** `_verifyCurriculumCompleteness` and `_verifyLedgerAlignment` guard the entire `registerStudent` flow before any DB writes begin — correct fail-fast pattern.
5. **Attendance Upsert Pattern:** The bulk attendance route pre-loads existing records into a map (`existingMap`) before looping — partially avoiding the N+1 problem for the upsert lookup.
6. **Metadata Snapshotting:** Storing `course_fees` metadata on the `Enrollment` record is a smart denormalization that avoids re-querying the `PackageItem` table during withdrawals.

---

## 🚀 Strategic Recommendations

| Priority | Action |
|---|---|
| 🔴 Immediate | Fix `getProfile()` — use relation getter methods, not unsupported `findById` overload |
| 🔴 Immediate | Remove all `_generateId` pre-generation from insert calls; trust `AutoField` for PK generation |
| 🔴 Immediate | Fix `processSubjectWithdrawal` argument parser — eliminate overloaded signature |
| 🔴 Immediate | Add `TransactionTracker` to `registerStudent` for full rollback coverage |
| 🟠 Before Release | Pre-load Student/Batch/Course maps in `markAttendanceBulk` and `queryAttendance` |
| 🟠 Before Release | Guard `total_fee` against `undefined`/`NaN` before proportional calculation |
| 🟠 Before Release | Extract state mutation from `verifyAccess()` into a separate command |
| 🟡 Next Cycle | Fix attendance upsert composite key to include `batch_id` |
| 🟡 Next Cycle | Replace all `throw new Error(...)` with typed SheetDB domain errors |
| 🟡 Next Cycle | Fix installment reduction order to FIFO (earliest due first) |

---

## 🏗️ SheetDB Architecture Misalignment Summary

| # | Pattern Used in Service | SheetDB Contract | Classification |
|---|---|---|---|
| 1 | `findById(id, relations[])` | `findById(id)` — single arg; relations via getter methods | 🔴 API Contract Violation |
| 2 | `_generateId()` pre-generating PKs before `insert` | `AutoField` generates PK inside `toSheetValue()` on `save()` | 🔴 AutoField Security Guard Bypass (production crash) |
| 3 | `insertOne(flatPayload)` for non-nested records | `insertOne` is for nested relational payloads; `insert()` for flat | 🟠 Semantic Misuse |
| 4 | Manual `TransactionTracker` missing in `registerStudent` | SheetDB does not provide ACID; service must own rollback | 🟠 Incomplete Transaction Boundary |
| 5 | `throw new Error(...)` for domain failures | SheetDB defines `EntityNotFoundError`, `IntegrityError`, etc. | 🟡 Error Taxonomy Violation |
| 6 | N+1 `findById` calls inside loops | SheetDB repository `.all()` + in-memory map is the correct pattern | 🟠 GAS Performance Anti-pattern |
| 7 | State mutation inside a read-only accessor (`verifyAccess`) | CQS principle — read methods must not mutate | 🟡 Architectural Design Flaw |

---

*Generated by Gemini CLI `code-self-assessor` Skill · Session: 2026-06-17*
