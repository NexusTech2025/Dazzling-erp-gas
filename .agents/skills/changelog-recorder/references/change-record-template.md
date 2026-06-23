# CHANGE RECORD

---

## Change Metadata

Change ID:
CHG-{YYYY}-{MM}-{DD}-{NNN}

Timestamp (UTC):
{YYYY-MM-DDTHH:MM:SSZ}

Timestamp (Local):
{YYYY-MM-DD HH:MM:SS IST}

Version:
v{MAJOR}.{MINOR}.{PATCH}

Release Type:
[MAJOR | MINOR | PATCH | HOTFIX]

Environment:
[Development | Testing | Staging | Production]

Status:
[Draft | In Review | Approved | Implemented | Rolled Back]

Priority:
[Low | Medium | High | Critical]

Risk Level:
[Low | Medium | High]

Author:
Moni

Reviewer:
Architecture Review Board

Approval Date:
{YYYY-MM-DD}

---

## Executive Summary

One paragraph explaining:

- What changed
- Why it changed
- Expected impact

---

## Business Motivation

Problem Statement:
{Describe the existing design problem or gap that prompted this change.}

Impact:

- {Impact item 1}
- {Impact item 2}
- {Impact item 3}

Expected Benefit:

- {Benefit 1}
- {Benefit 2}
- {Benefit 3}

---

## Architecture Decision

Decision Type:
[New Feature | Refactor | Bug Fix | Optimization | Security | Schema Change | Dependency Upgrade]

Architecture Pattern:

- {Pattern 1}
- {Pattern 2}

Decision:
{State the architectural decision made in one or two sentences.}

Reasoning:
{Explain why this was the correct approach.}

Alternatives Considered:

Option A:
{Description}

Pros:
- {Pro}

Cons:
- {Con}

Option B:
{Description}

Pros:
- {Pro}

Cons:
- {Con}

Chosen:
{Option A | Option B | ...}

---

## Scope of Change

Affected Domains:

- {Domain 1}
- {Domain 2}

Affected Modules:

- {Module 1}
- {Module 2}

Affected Files:

<!-- Repeat this block for every file touched. Never list a file without completing its block. -->

### `{RelativePath/file1.js}`

**Layer / Role:** {Which architectural layer this file belongs to and its single responsibility in the system — e.g., "ORM Field Layer — defines the type contract for all model columns."}

**Change Type:** [Added | Modified | Deleted | Renamed]

**What Changed:** {2–4 sentence description of exactly what was changed inside this file. Be specific: which class, which method, which property. A developer reading this 6 months later must understand the change without opening the file.}

**Before:**

```javascript
// Paste the key lines as they existed BEFORE the change.
// Taken directly from git diff -U0 context lines or the original file.
// Focus on the changed function/class/block only — not the entire file.
```

**After:**

```javascript
// Paste the key lines as they exist AFTER the change.
// Must be the actual committed code — not a paraphrase.
```

**Why This File:** {1–2 sentences explaining why this file needed to change to support the broader feature or fix.}

---

### `{RelativePath/file2.js}`

**Layer / Role:** {Layer and responsibility}

**Change Type:** [Added | Modified | Deleted | Renamed]

**What Changed:** {Specific description of the change in this file.}

**Before:**

```javascript
// Key code before the change
```

**After:**

```javascript
// Key code after the change
```

**Why This File:** {Reason this file was part of the change scope.}

---

Affected APIs:

<!-- Repeat this block for every function, method, class constructor, or JSON endpoint whose contract or behavior changed. -->

### `{functionName(param1, param2)}`

**File:** `{RelativePath/file.js}`

**Change Type:** [Added | Modified | Removed | Signature Changed | Behavior Changed]

**Description:** {What this function/method does, and what specifically changed about it. Include the class it belongs to if it is a method.}

**Signature / Payload — Before:**

```javascript
// Full function signature or JSON request/response shape as it existed before.
// For GAS API actions: show the full params object structure.
// For ORM methods: show the method signature and return type in a comment.
// Example:
// function enrollStudent(params) {
//   // params: { student_id: string, course_id: string, session_id: string }
//   // returns: Enrollment model instance
// }
```

**Signature / Payload — After:**

```javascript
// Full function signature or JSON request/response shape after the change.
// Must reflect the actual committed code.
// Example:
// function enrollStudent(params) {
//   // params: { student_id: string, course_id: string, session_id: string, package_id?: string }
//   // returns: { enrollment: Enrollment, packageItem: PackageItem | null }
// }
```

**Behavioral Delta:** {Precisely describe what the function does differently. What inputs produce different outputs? What side effects changed? What validations were added or removed?}

**Breaking Change:** [Yes | No]

**Migration Note:** {If breaking: what callers must change to remain compatible — or "N/A" if not breaking.}

---

### `{anotherFunction(param)}`

**File:** `{RelativePath/file.js}`

**Change Type:** [Added | Modified | Removed | Signature Changed | Behavior Changed]

**Description:** {What changed about this function.}

**Signature / Payload — Before:**

```javascript
// Before
```

**Signature / Payload — After:**

```javascript
// After
```

**Behavioral Delta:** {What the function does differently.}

**Breaking Change:** [Yes | No]

**Migration Note:** {Migration instructions or N/A.}

Affected Database Objects:

- {Table name or schema field — or None}

Affected Infrastructure:

- {GAS project, Drive folder, clasp config — or None}

---

## Detailed Change Description

### Before

{Describe the old behavior in plain language or with an ASCII flow.}

```text
{Old architecture / flow diagram}
```

### After

{Describe the new behavior.}

```text
{New architecture / flow diagram}
```

### Technical Details

1. {Technical step 1}
2. {Technical step 2}
3. {Technical step 3}

---

## Change Classification

### Added

* {New class, function, field, or endpoint added}

### Changed

* {Existing behavior that was modified}

### Deprecated

* {Items deprecated but not yet removed}

### Removed

* {Items fully removed}

### Fixed

* {Bug or constraint violation that was corrected}

### Security

* {Security-related fix or hardening — or None}

---

## DazzlingDB / SheetDB Impact

> Complete this section only when the change touches SheetDB ORM, DazzlingDB schema, or the API layer.

### Schema Impact

- Schema file(s) modified: {e.g., DazzlingDB/Config/Schema/Academic/Enrollment.json — or None}
- `compile_schema.js` run required: [Yes | No]
- Column added / removed / renamed: {Describe or None}

### ORM / Active Record Impact

- BaseModel affected: [Yes | No]
- Field type changes: {e.g., IntegerField → FloatField on 'fee' column — or None}
- Validation pipeline changes: {New rules added, old rules removed — or None}
- ForeignKeyField target changes: {Target table changed — or None}

### API Contract Impact

- Action class(es) affected: {e.g., EnrollStudentAction, UpdateCourseAction — or None}
- Request payload shape changed: [Yes | No — describe if Yes]
- Response envelope shape changed: [Yes | No — describe if Yes]
- Breaking change to API consumers: [Yes | No]

### Registry Impact

- ModelRegistry re-initialization required: [Yes | No]
- ValidationRegistry handlers added/removed: {List — or None}
- PolymorphicRegistry mappings changed: {List — or None}

### Transaction / Rollback Impact

- Rollback array logic modified: [Yes | No]
- New insert sequences added: {Describe — or None}
- Orphaned record risk: [Yes — describe | No]

---

## Breaking Changes

BREAKING: [YES | NO]

Affected Components:

* {Component — or None}

Migration Required:
[YES | NO]

Migration Steps:

1. {Step 1 — or N/A}
2. {Step 2}

Backward Compatibility:
[FULL | PARTIAL | NONE]

---

## Impact Analysis

Performance Impact:
{Measured or estimated change — or Negligible}

Memory Impact:
{Measured or estimated change — or Negligible}

Network Impact:
{Number of additional API calls, Sheets reads/writes — or None}

Database Impact:
{Row-level or schema-level impact on Google Sheets data — or None}

Security Impact:
{Any change to validation rules, access control, or data escaping — or None}

Operational Impact:
[Low | Medium | High]

---

## Testing Evidence

Unit Tests:
[✓ Passed | ✗ Failed | ⚠ Skipped | N/A]

Integration Tests:
[✓ Passed | ✗ Failed | ⚠ Skipped | N/A]

Regression Tests:
[✓ Passed | ✗ Failed | ⚠ Skipped | N/A]

Manual Validation:
[✓ Completed | ✗ Not done | N/A]

Coverage:
{N%}

Test File(s):
{e.g., DazzlingDB/Test/Academic_BatchUpdateTests.js — or N/A}

---

## Risk Assessment

Potential Risks:

1. {Risk 1}
2. {Risk 2}

Probability:
[Low | Medium | High]

Severity:
[Low | Medium | High | Critical]

Mitigation:

* {Mitigation action 1}
* {Mitigation action 2}

Rollback Complexity:
[Low | Medium | High]

Rollback Procedure:

1. {Rollback step 1}
2. {Rollback step 2}

Estimated Rollback Time:
{N minutes}

---

## Dependencies

Requires:

* {Upstream dependency — or None}

Blocks:

* {Downstream feature blocked — or None}

Dependent Features:

* {Feature that depends on this change — or None}

---

## Documentation Updates

Updated Documents:

* {doc path or None}

Updated Diagrams:

* {diagram path or None}

Updated ADRs:

* {ADR-XXX or None}

Updated Memory Files:

* {e.g., .agents/memory/core/architecture.md — or None}

---

## Metrics

Implementation Time:
{N hours}

Review Time:
{N hours}

Deployment Time:
{N minutes}

Total Effort:
{N hours}

---

## References

Issue / Task:
{e.g., GitHub Issue #NNN — or None}

Pull Request:
{e.g., PR-NNN — or None}

ADR:
{e.g., ADR-NNN — or None}

Design Doc:
{e.g., .agents/memory/core/architecture.md — or None}

Related Changes:

* {CHG-YYYY-MM-DD-NNN — or None}

---

## Sign-Off

Developer:
☐ Moni

Reviewer:
☐ Architecture Team

QA:
☐ Approved

Release Manager:
☐ Approved

---

## Audit Trail

{YYYY-MM-DDTHH:MMZ}
Created change request.

{YYYY-MM-DDTHH:MMZ}
Implementation completed.

{YYYY-MM-DDTHH:MMZ}
Testing completed.

{YYYY-MM-DDTHH:MMZ}
Released.
