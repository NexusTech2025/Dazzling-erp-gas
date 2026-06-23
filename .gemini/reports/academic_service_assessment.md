# Code Self-Assessment Report

| Field | Value |
|---|---|
| **File** | `AcademicService.js` |
| **Line Count** | 414 |
| **Assessment Date** | 2026-06-18 |
| **Assessor** | Aira (code-self-assessor skill) |
| **Overall Score** | **7 / 10 — Strong** |

---

## Executive Summary

`AcademicService.js` is a well-structured service layer handling core academic domain operations: course types, courses, batches, packages, and student enrollments. The majority of CRUD paths use SheetDB's Active Record API correctly and validation guards are present throughout. However, three categories of systemic risk lower the score from exceptional to strong:

1. **Error taxonomy violations** — generic `Error` instances are thrown in three places where domain-specific SheetDB errors are required (`EntityNotFoundError`, `IntegrityError`).
2. **Incomplete transactional safety** in `createPackage` — a bespoke `insertedRecords[]` rollback array is used instead of the canonical `TransactionTracker`, introducing partial-rollback risk and an inconsistent pattern.
3. **N+1 read risk** inside `createPackage`'s on-demand course loop — three independent DB reads fire per course item with no pre-fetch or bulk-lookup strategy.

Minor concerns include missing `.toJSON()` serialization on returned records and a DRY violation via the `_trackMutation` stub duplicated across all services.

---

## Critical Issues

### C-01 — Three `throw new Error(...)` violations (RULE-06)

**Locations:**
- `updatePackage` — package not-found guard
- `deletePackage` — package not-found guard and integrity check
- `enrollStudent` — student not-found guard

**Problem:**
Generic `Error` instances bypass the SheetDB domain error taxonomy. Boundary handlers, error interceptors, and any future telemetry pipeline that pattern-matches on error class will silently mis-classify these failures. `EntityNotFoundError` and `IntegrityError` are the canonical classes for these two scenarios.

**Required Fix:**
```javascript
// Current (non-compliant)
throw new Error('Student not found.');
throw new Error(`Package ${packageId} not found`);
throw new Error('Cannot delete: active enrollments exist.');

// Required (compliant)
throw new SheetDB.EntityNotFoundError('Student', payload.student_id, 'Academic');
throw new SheetDB.EntityNotFoundError('Package', packageId, 'Academic');
throw new SheetDB.IntegrityError('Package', packageId, 'active enrollments exist');
```

**Severity:** Critical — violates RULE-06, breaks error taxonomy contract.

---

### C-02 — Bespoke `insertedRecords[]` rollback in `createPackage` (RULE-04)

**Problem:**
`createPackage` implements its own rollback logic using a manually maintained `insertedRecords` array instead of `TransactionTracker`. This has multiple failure modes:

- If an insert throws *before* the record is pushed into `insertedRecords`, it will not be rolled back.
- `trackUpdate` operations have zero coverage — no equivalent in the bespoke array.
- Inconsistent with `updatePackage` and `deletePackage` which correctly use `TransactionTracker`.
- Future contributors may propagate or hybridize the pattern, making things worse.

**Required Fix:**
```javascript
// Current (non-compliant)
const insertedRecords = [{ table: 'Package', id: packageId }];
// ... manual for-loop rollback

// Required (compliant)
const tx = new TransactionTracker();
const newPackage = db.Package.insert(packageData);
tx.trackInsert('Package', newPackage);
try {
  // ... further inserts tracked via tx.trackInsert(...)
  return newPackage;
} catch (error) {
  tx.rollback();
  throw error;
}
```

**Severity:** Critical — violates RULE-04, partial rollback risk in multi-step transaction.

---

## High Priority Issues

### H-01 — N+1 Read Pattern in `createPackage` on-demand course loop (RULE-05)

**Location:** `createPackage` — `payload.courses.forEach(...)` loop

**Problem:**
For each on-demand course in the payload, the loop independently fires:
1. `db.CourseType.findOne(...)` — segment lookup
2. `db.CourseType.findById(...)` — segment validation (duplicate read)
3. `db.Course.findOne({ short_code })` — duplicate short-code check

With N courses in the payload, this produces **3N sequential spreadsheet API calls**. For a package with 10 courses, that is 30 reads. Google Apps Script has strict per-execution quotas and each `findOne` / `findById` triggers a full-sheet scan in SheetDB's in-memory model.

**Required Fix — Pre-fetch strategy:**
```javascript
// Pre-fetch all needed segments and existing short_codes once
const allSegments = db.CourseType.all();            // 1 read
const segmentMap = Object.fromEntries(allSegments.map(s => [s.id, s]));
const existingShortCodes = new Set(db.Course.all().map(c => c.short_code)); // 1 read

payload.courses.forEach(course => {
  if (!segmentMap[course.segment_id]) throw new SheetDB.EntityNotFoundError(...);
  if (existingShortCodes.has(course.short_code)) throw new SheetDB.ValidationError(...);
  // proceed with insert
});
```

**Severity:** High — violates RULE-05, degrades performance linearly with package size.

---

### H-02 — Missing `.toJSON()` Serialization on Returned Records (RULE-12)

**Affected methods:** `createCourseType`, `createCourse`, `createBatch`, `createPackage`, `enrollStudent`

**Problem:**
Raw Active Record model instances are returned directly to callers. If a caller serializes the response (e.g., `JSON.stringify` for API response, logging, or caching), it may capture internal ORM state, prototype methods, or non-serializable references. RULE-12 mandates `.toJSON()` before returning from the service boundary.

**Required Fix:**
```javascript
// Current (non-compliant)
return record;

// Required (compliant)
return record.toJSON();
```

**Severity:** High — violates RULE-12; risk of leaking ORM internals at service boundaries.

---

## Medium Priority Issues

### M-01 — `_trackMutation` DRY Violation Across Services

**Problem:**
`_trackMutation(context, tableName)` is stubbed as a local method on `AcademicService`. If this pattern is repeated across `FinanceService`, `StudentService`, etc., it represents a cross-cutting concern that should live in a shared `BaseService` mixin or utility — not duplicated per-service. Any future change to mutation tracking (e.g., adding timestamps, user attribution) must be applied to every copy.

**Recommendation:** Extract to a `ServiceBase` module or a `MutationTracker` utility and compose it in.

**Severity:** Medium — DRY violation, maintainability risk.

---

### M-02 — `createCourse` Validates `segment_id` Presence but Not Type

**Problem:**
```javascript
if (!payload.segment_id) throw new SheetDB.ValidationError("segment_id is required.");
```
This guard blocks falsy values but does not validate that `segment_id` is a non-empty string or valid numeric ID before passing it to `findById`. A payload with `segment_id: 0` or `segment_id: ""` would pass the falsy check yet reach `findById` with unpredictable results.

**Recommendation:** Use a stricter type-and-presence guard:
```javascript
if (!payload.segment_id || typeof payload.segment_id !== 'string') {
  throw new SheetDB.ValidationError('segment_id must be a non-empty string.');
}
```

**Severity:** Medium — edge case validation gap.

---

### M-03 — `createBatch` Applies Default `capacity: 30` Silently

**Problem:**
```javascript
const record = db.Batch.insert({ ...payload, status: payload.status || 'active', capacity: payload.capacity || 30 });
```
Defaulting `capacity` to `30` is a business-rule decision embedded in the service without documentation or configuration. If business rules change (different branch or course-type-specific limits), this hardcoded default becomes a silent inconsistency. Defaults of this nature should either come from schema-level defaults or a named configuration constant.

**Severity:** Medium — hardcoded business constant, low risk but poor maintainability.

---

## Low Priority / Observations

### L-01 — `createBatch`: 3 Sequential `findById` Calls (Acceptable)

`db.Course.findById`, `db.Teacher.findById`, `db.Branch.findById` are three sequential reads but occur outside any loop. Given that these are single-record lookups for a single batch creation, this is **acceptable** and does not constitute an N+1 violation. No action required.

### L-02 — `deletePackage`: `db.Enrollment.exists(...)` Guard is Good Practice

Calling `db.Enrollment.exists({ enrollment_type: 'package', item_id: packageId })` before cascade deletion is the correct integrity guard pattern. This should be preserved and extended to cascade targets if they can also be referenced by other entities.

### L-03 — `updatePackage`: `tx.trackSync` Pattern is Correct

Using `tx.trackSync` for `PackageItem` and `PackagePerk` clean-rewrite sync is the correct SheetDB pattern for "delete all children, re-insert from payload." This is consistent with the ORM architecture and should be used as the reference implementation for similar operations.

### L-04 — `createPackage`: No Pre-Generated ID (RULE-01 Compliant)

`db.Package.insert(packageData)` correctly delegates ID generation to the ORM's AutoField mechanism. No manual `Utilities.getUuid()` or pre-generated ID is used. **Compliant with RULE-01.**

---

## Strengths

| # | Strength | Detail |
|---|---|---|
| S-01 | Domain validation present on all write paths | `createCourse`, `createBatch` guard all FK references before inserting |
| S-02 | `updatePackage` uses `TransactionTracker` correctly | Canonical pattern followed for multi-step rewrite operation |
| S-03 | `deletePackage` uses integrity guard before cascade | Enrollment existence check prevents orphan-dependent deletions |
| S-04 | `createPackage` uses ORM AutoField (RULE-01 compliant) | No manual ID generation |
| S-05 | `updatePackage` uses `tx.trackSync` correctly | Correct pattern for clean-rewrite of child collections |
| S-06 | `createBatch` applies sensible defaults inline | Status and capacity defaults applied at insert boundary |
| S-07 | `createCourse` uses `SheetDB.EntityNotFoundError` correctly | Correct error taxonomy in the compliant path |

---

## Strategic Recommendations

### Priority 1 — Resolve RULE-06 Violations (Immediate)
Replace all three `throw new Error(...)` instances with the appropriate domain errors. This is a low-effort, high-impact change that restores error taxonomy compliance. Estimated effort: **< 30 minutes**.

### Priority 2 — Migrate `createPackage` to `TransactionTracker` (Short-term)
Refactor the bespoke `insertedRecords[]` rollback to use `TransactionTracker`. This eliminates partial rollback risk and aligns `createPackage` with the established pattern in `updatePackage`. Estimated effort: **1–2 hours**.

### Priority 3 — Fix N+1 Read in `createPackage` Loop (Short-term)
Pre-fetch `CourseType` and `Course` short-codes before the `forEach` loop. This converts O(N) API calls into O(1) pre-fetch + O(N) in-memory lookups. Estimated effort: **1 hour**.

### Priority 4 — Add `.toJSON()` at Service Boundaries (Medium-term)
Audit all return statements in AcademicService and add `.toJSON()` calls. Also audit peer services for the same pattern. Estimated effort: **< 1 hour** for this file.

### Priority 5 — Extract `_trackMutation` to Shared Base (Medium-term)
Create a `ServiceBase` module or `MutationTracker` utility. Refactor all services to use it. Estimated effort: **2–4 hours** across all services.

---

## SheetDB Architecture Misalignment Table

| Rule | Description | Violation Location | Severity | Status |
|---|---|---|---|---|
| RULE-04 | Use `TransactionTracker` for all multi-step writes | `createPackage` — bespoke `insertedRecords[]` array | Critical | Non-Compliant |
| RULE-05 | Avoid N+1 reads; pre-fetch outside loops | `createPackage` — 3 reads per course in `forEach` | High | Non-Compliant |
| RULE-06 | Throw domain-specific SheetDB errors only | `updatePackage`, `deletePackage`, `enrollStudent` | Critical | Non-Compliant |
| RULE-12 | Call `.toJSON()` before returning records at service boundary | All 5 create/enroll methods | High | Non-Compliant |
| RULE-01 | No manual ID generation; delegate to ORM AutoField | `createPackage` | — | Compliant |
| RULE-07 | Use `tx.trackSync` for child collection rewrites | `updatePackage` | — | Compliant |
| RULE-08 | Guard integrity before cascade delete | `deletePackage` | — | Compliant |

---

*Report generated by Aira — code-self-assessor skill · 2026-06-18*
