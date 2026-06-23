# Code Self-Assessor Report: StaffService.js

## 📊 Robustness Score: 6/10 (Moderate)

### 📝 Executive Summary

`StaffService.js` (587 lines) is the primary service layer for teacher lifecycle management in the Dazzling ERP system. It covers teacher onboarding, subject assignment, attendance marking (single and bulk), and attendance querying. The service demonstrates several strong patterns — notably its fail-fast validation aggregation in `onboardTeacher`, its composite-key upsert strategy in `markAttendance`, and its correct use of `insertMany` in `updateTeacherSubjects`.

However, the file contains **three confirmed N+1 read violations** (RULE-05), which mirror the critical anti-patterns already identified in `StudentService.js`. These violations are especially damaging in a Google Apps Script environment where each `SpreadsheetApp` read operation carries a fixed ~100–200ms network round-trip cost. Additionally, the rollback strategy in `onboardTeacher` diverges from the architectural standard (`TransactionTracker`), and two locations throw generic `Error` objects instead of domain-typed exceptions (RULE-06).

The service is functionally correct and structurally coherent, but it is **not production-safe at scale** without resolving the N+1 read patterns. With 30+ teachers, bulk attendance operations will routinely exceed Apps Script's 6-minute execution limit.

**SheetDB Rule Violations Summary:**
| Rule | Severity | Count | Description |
|------|----------|-------|-------------|
| RULE-05 | 🟠 High | 3 | N+1 sheet reads in loops |
| RULE-04 | 🟡 Medium | 1 | Custom rollback instead of TransactionTracker |
| RULE-05 | 🟡 Medium | 1 | Individual row deletion in loop |
| RULE-06 | 🟡 Medium / 🟢 Low | 2 | Generic `Error` instead of typed exceptions |

---

## 🔴 Critical Issues

> No critical (data-corruption, security breach, or silent failure) issues were identified in this assessment cycle. The service correctly validates inputs before writes and does not expose raw sheet access outside the ORM layer.

---

## 🟠 High Priority Issues

### [HIGH-01] N+1 Reads in `markAttendanceBulk` — Teacher & Batch Lookups Inside Loop
- **Rule**: RULE-05 (Minimize Sheet Reads — Batch Queries)
- **Location**: Lines 355–360
- **Cause**: `db.Teacher.findById(teacherId)` and `db.Batch.findById(batchId)` are called **inside** `payload.records.forEach(...)`. Neither the Teacher table nor the Batch table is pre-loaded before the loop begins.
- **Scenario**: A bulk attendance call for 30 records with 10 unique teachers and 5 unique batches triggers up to 60 individual sheet reads — one `findById` per record for each table.
- **Impact**: O(N) sheet reads per bulk call. At 30 records, this is 60 reads before any write occurs. In GAS (~150ms/read), this alone consumes ~9 seconds, risking timeout on large rosters. Identical anti-pattern to `StudentService` CRIT-03.
- **Fix**:
  ```javascript
  // BEFORE markAttendanceBulk loop — pre-load Teacher and Batch maps
  const teacherIds = [...new Set(payload.records.map(r => r.teacher_id))];
  const batchIds   = [...new Set(payload.records.map(r => r.batch_id))];

  const teachers = await db.Teacher.findMany({ teacher_id: teacherIds });
  const batches  = await db.Batch.findMany({ batch_id: batchIds });

  const teacherMap = Object.fromEntries(teachers.map(t => [t.teacher_id, t]));
  const batchMap   = Object.fromEntries(batches.map(b => [b.batch_id, b]));

  // Inside the loop — replace findById calls:
  const teacher = teacherMap[record.teacher_id];
  const batch   = batchMap[record.batch_id];

  if (!teacher) errors.push(`Unknown teacher_id: ${record.teacher_id}`);
  if (!batch)   errors.push(`Unknown batch_id: ${record.batch_id}`);
  ```

---

### [HIGH-02] N+1 Reads in `queryAttendance` — Teacher, Batch & Course Lookups Inside `records.map()`
- **Rule**: RULE-05
- **Location**: Lines 432, 436, 441
- **Cause**: `db.Teacher.findById(...)`, `db.Batch.findById(...)`, and `db.Course.findById(...)` are all called inside `records.map()` for each attendance record row.
- **Scenario**: Querying attendance for a date range with 50 records across 10 teachers, 8 batches, and 5 courses triggers up to 150 individual sheet reads.
- **Impact**: O(N×3) reads per query. At scale (semester-level queries), this will time out or produce stale partial results. Identical to `StudentService.queryAttendance`.
- **Fix**:
  ```javascript
  // After fetching raw records, before the enrichment map:
  const uniqueTeacherIds = [...new Set(records.map(r => r.teacher_id))];
  const uniqueBatchIds   = [...new Set(records.map(r => r.batch_id))];
  const uniqueCourseIds  = [...new Set(records.map(r => r.course_id).filter(Boolean))];

  const [teachers, batches, courses] = await Promise.all([
    db.Teacher.findMany({ teacher_id: uniqueTeacherIds }),
    db.Batch.findMany({ batch_id: uniqueBatchIds }),
    db.Course.findMany({ course_id: uniqueCourseIds }),
  ]);

  const teacherMap = Object.fromEntries(teachers.map(t => [t.teacher_id, t]));
  const batchMap   = Object.fromEntries(batches.map(b => [b.batch_id, b]));
  const courseMap  = Object.fromEntries(courses.map(c => [c.course_id, c]));

  // Inside records.map():
  const enriched = records.map(r => ({
    ...r,
    teacher_name: teacherMap[r.teacher_id]?.name ?? null,
    batch_name:   batchMap[r.batch_id]?.name ?? null,
    course_name:  courseMap[r.course_id]?.name ?? null,
  }));
  ```

---

### [HIGH-03] N+1 Reads in `onboardTeacher` Subject Validation — `findById` Inside `for...of`
- **Rule**: RULE-05
- **Location**: Lines 67–77
- **Cause**: `db.Course.findById(subId)` is called **inside** a `for...of` loop over `payload.subjects`. Each subject ID triggers a separate sheet read against the Course table.
- **Scenario**: Onboarding a teacher assigned to 8 subjects triggers 8 sequential `Course` sheet reads before the teacher record is even written.
- **Impact**: O(N) reads during onboarding. While teacher onboarding is not a bulk operation, it violates RULE-05 and sets a dangerous precedent as subject counts grow.
- **Fix**:
  ```javascript
  // Pre-load all courses for the given subject IDs in one batch read:
  const courseRecords = await db.Course.findMany({ course_id: payload.subjects });
  const courseMap = Object.fromEntries(courseRecords.map(c => [c.course_id, c]));

  for (const subId of payload.subjects) {
    const course = courseMap[subId];
    if (!course) {
      validationErrors.push(`Subject with ID '${subId}' does not exist.`);
    }
  }
  ```

---

## 🟡 Medium & 🟢 Low Priority Issues

### [MED-01] `onboardTeacher` — Custom `insertedRecords[]` Rollback Instead of `TransactionTracker`
- **Rule**: RULE-04 (Use TransactionTracker for Rollback)
- **Location**: `onboardTeacher` rollback block (post-insert error handler)
- **Cause**: A manual `insertedRecords[]` array is maintained, and rollback is performed via `db[record.table].remove(record.id)`. This bypasses `TransactionTracker` — the canonical rollback mechanism for the SheetDB ORM.
- **Scenario**: If a mid-transaction failure occurs after the `AuthBridge.registerUser()` call succeeds but a downstream insert fails, the User record may be left orphaned. `db.User.remove()` may trigger the graph-based cascade/protect pipeline, which is not appropriate for a transactional undo.
- **Impact**: Architectural inconsistency. More critically, `AuthBridge` may maintain its own internal state (e.g., session tokens, auth cache) that `db.User.remove()` does not purge, leaving a ghost auth record.
- **Fix**:
  ```javascript
  const tracker = new TransactionTracker();
  try {
    const user = await AuthBridge.registerUser(payload);
    tracker.track('User', user.user_id);
    // ... subsequent inserts tracked similarly
  } catch (err) {
    await tracker.rollback();
    throw err;
  }
  ```

---

### [MED-02] `updateTeacherSubjects` — Individual Row Deletion Inside `forEach` Loop
- **Rule**: RULE-05
- **Location**: Lines 553–558
- **Cause**: `db.TeacherSubject.remove(sub.teacher_subject_id)` is called **inside a `forEach` loop** over subject records to be removed. Each call triggers an individual delete operation against the sheet.
- **Scenario**: Updating a teacher's subjects where 10 old subjects need to be removed triggers 10 separate `remove()` calls.
- **Impact**: O(N) writes. `deleteMany` exists in the SheetDB API and should be used for batch deletion in a single sheet operation.
- **Fix**:
  ```javascript
  // Collect all IDs to remove, then batch delete:
  const idsToRemove = subjectsToRemove.map(sub => sub.teacher_subject_id);
  if (idsToRemove.length > 0) {
    await db.TeacherSubject.deleteMany(idsToRemove);
  }
  ```

---

### [MED-03] `updateTeacherSubjects` — Generic `Error` for Validation Failure
- **Rule**: RULE-06 (Domain-Typed Exceptions)
- **Location**: Line 548
- **Cause**: `throw new Error('teacher_id is required for updating subjects.')` uses the generic base `Error` class.
- **Impact**: Callers cannot distinguish a validation failure from a runtime/system error without string-matching the message. Breaks the standardized error categorization contract established by `ValidationError` / `ActionValidationError`.
- **Fix**:
  ```javascript
  throw new ActionValidationError('teacher_id is required for updating subjects.', {
    field: 'teacher_id',
    action: 'updateTeacherSubjects',
  });
  ```

---

### [LOW-01] `markAttendance` — Generic `Error` for Required Field Validation
- **Rule**: RULE-06
- **Location**: Lines 239–242
- **Cause**: `throw new Error('teacher_id is required.')` and similar guards use the generic `Error` class.
- **Impact**: Same categorization problem as MED-03. Lower severity because `markAttendance` is a single-record path with less critical downstream routing.
- **Fix**:
  ```javascript
  if (!payload.teacher_id) throw new ActionValidationError('teacher_id is required.', { field: 'teacher_id' });
  if (!payload.batch_id)   throw new ActionValidationError('batch_id is required.',   { field: 'batch_id' });
  ```

---

## 💪 Strengths

### [STR-01] `markAttendanceBulk` Pre-loads Existing Attendance Map (RULE-05 Partial Compliance)
Line 328 correctly loads all existing `TeacherAttendance` records for the target date into an `existingMap` **before** the loop begins. This eliminates N+1 reads for the upsert check — the most frequent inner-loop lookup. This is the correct pattern; it should now be extended to Teacher and Batch pre-loading (see HIGH-01).

### [STR-02] `onboardTeacher` — Fail-Fast Validation Aggregation
The onboarding flow collects **all** validation errors into a `validationErrors[]` array before throwing, rather than failing on the first error. This provides complete, actionable feedback in a single round-trip — a best-practice fail-fast aggregation pattern that avoids the "fix one error at a time" loop for the caller.

### [STR-03] `updateTeacherSubjects` — Correct Batch Insert via `insertMany`
Line 578 uses `db.TeacherSubject.insertMany(recordsToInsert)` for adding new subject assignments. This is fully RULE-05 compliant for the write path and demonstrates correct understanding of the SheetDB batch API.

### [STR-04] `markAttendance` — Correct Composite Upsert Key
The single-record attendance mark uses `{ teacher_id, batch_id, attendance_date }` as the composite upsert key, which is the semantically correct uniqueness constraint for teacher attendance. This is RULE-09 compliant and prevents duplicate attendance records without requiring a separate pre-read.

### [STR-05] `onboardTeacher` — Structured Multi-Entity Transaction Sequencing
The onboarding flow correctly sequences entity creation (User → Teacher → TeacherSubject) and maintains an `insertedRecords[]` trail for rollback awareness. While the rollback mechanism itself needs upgrading (MED-01), the intent and sequencing demonstrate sound transactional thinking.

---

## 🚀 Strategic Recommendations

### Priority 1 — Resolve All Three N+1 Read Violations (HIGH-01, HIGH-02, HIGH-03)
These three violations are the single largest performance risk in this file. The fix pattern is identical for all three: **extract IDs → batch `findMany` → build in-memory lookup map → use map inside loop**. This pattern should be formalized as a project-wide pre-load utility (e.g., `preloadEntities(db, { Teacher: ids, Batch: ids, Course: ids })`) to prevent future recurrence across all service files.

### Priority 2 — Migrate `onboardTeacher` Rollback to `TransactionTracker` (MED-01)
The custom rollback array is a maintenance liability. Migrating to `TransactionTracker` provides uniform rollback semantics, audit traceability, and eliminates the risk of cascade pipeline interference. Coordinate with `AuthBridge` to add a `deregisterUser()` compensation method for rollback safety.

### Priority 3 — Replace `forEach` Deletion with `deleteMany` in `updateTeacherSubjects` (MED-02)
A straightforward one-line fix. Collect IDs before the loop and call `deleteMany` once. This should be a zero-risk refactor.

### Priority 4 — Standardize Exception Types Across All Service Files (MED-03, LOW-01)
Conduct a global grep for `throw new Error(` across all `*Service.js` files and replace with `ActionValidationError` or `ValidationError` as appropriate. This should be a cross-cutting refactor tracked as a single ticket.

### Priority 5 — Create a Shared `buildEntityMap` Utility
Both `StudentService.js` and `StaffService.js` share identical N+1 violation patterns and identical fix patterns. Extract the pre-load + map-build logic into a shared utility in `SheetDB/Utils.js` or a new `ServiceHelpers.js` to enforce DRY and prevent future services from repeating this anti-pattern.

---

## 📋 Issue Tracker Summary

| ID | Severity | Rule | Location | Title |
|----|----------|------|----------|-------|
| HIGH-01 | 🟠 High | RULE-05 | Lines 355–360 | N+1 reads: Teacher & Batch in `markAttendanceBulk` |
| HIGH-02 | 🟠 High | RULE-05 | Lines 432, 436, 441 | N+1 reads: Teacher, Batch, Course in `queryAttendance` |
| HIGH-03 | 🟠 High | RULE-05 | Lines 67–77 | N+1 reads: Course in `onboardTeacher` subject loop |
| MED-01 | 🟡 Medium | RULE-04 | `onboardTeacher` rollback | Custom array rollback vs. TransactionTracker |
| MED-02 | 🟡 Medium | RULE-05 | Lines 553–558 | Individual `remove()` in `forEach` in `updateTeacherSubjects` |
| MED-03 | 🟡 Medium | RULE-06 | Line 548 | Generic `Error` in `updateTeacherSubjects` |
| LOW-01 | 🟢 Low | RULE-06 | Lines 239–242 | Generic `Error` in `markAttendance` required field guards |

---

*Generated by Gemini CLI `code-self-assessor` Skill — 2026-06-18*
