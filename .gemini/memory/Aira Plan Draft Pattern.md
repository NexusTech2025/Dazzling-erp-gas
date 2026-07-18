# **Dynamic Implementation Plan Template & Architectural Guidelines**

This document serves as the authoritative, mandatory blueprint for generating any technical implementation plans or system refactoring proposals. When drafting an architectural change, the system must structure its response according to the rules and layouts defined below.

## **1. Non-Domain Driven Infrastructure Rules**

The following block defines the technical guidelines governing code blocks, positional signatures, platform-specific limitations, and legacy system mitigations.

---

# AIRA SYSTEM DESIGN DECREE: INFRASTRUCTURE & PLATFORM RULES (NON-DOMAIN)
`
When proposing a structural code update, you must adhere to these six strict technical constraints.

---

### Rule N1: Explicit Positional Signatures & Execution Blueprints

Every proposed method update or introduction must be detailed with its exact path reference, followed by a clean, commented JavaScript code block showcasing JSDoc parameters, return types, and explicit exception scenarios. You must accompany each block with a step-by-step technical breakdown of its logical execution workflow.

**Required Method Layout Format:**

```javascript
/**
 * Detailed description of the helper's algorithm and parsing safeguards.
 * @param {string|Object} input - Target payload data segment to analyze.
 * @param {Object} options - Structural configuration options.
 * @param {string} [options.delimiter="-"] - Target split token character.
 * @param {string} [options.format="YYYY-MM-DD"] - Positional template layout sequence.
 * @returns {Object|null} Hash mapping of {year, month, day} integers, or null if invalid.
 * @throws {SheetDB.ValidationError} Form validation or data configuration error.
 */
ClassName.methodName = function(input, options = {}) {
  // Positional parsing logic...
}
```

---

### **Rule N2: Absolute Background Base Knowledge Traceability**

You must explicitly declare the exact files, schema configurations, runtime documentation chapters, or knowledge graph nodes that you used as reference files to formulate your solution design.

* **Trace Pattern:**
  * **Referenced Schemas:** `DazzlingDB/Config/Schema/Category/Table.json`
  * **Referenced Core Modules:** `SheetDB/Core/DataSource.js`
  * **Design Runbooks:** Chapter 1: SheetDB Core Infrastructure

---

### **Rule N3: Explicit Fact vs. Assumption Boundary Declaration**

To eliminate ambiguity, organize your technical design findings into two distinct sections:

1. **Actual Verified Facts:** Directly confirmed by analyzing modular JSON schemas, functional codebase files, or runtime test suites.
2. **System Assumptions:** Inferred because of Google Apps Script container conditions, spreadsheet timezone mismatches, or platform multi-realm execution rules.

---

### **Rule N4: GAS Execution Boundary & Round-Trip Round Up**

Google Apps Script enforces strict wall-clock timeout constraints (`6 minutes` maximum execution time). You are strictly prohibited from nesting any native Google Sheets SpreadsheetApp API call (such as SpreadsheetApp operations, cell evaluations, `.setValue()`, `.getValues()`, or `.appendRow()`) inside loops.

* **The Mandate:** You must process all reads and modifications inside RAM using 2D arrays.
* **The Operation:** Execute exactly `1` single, locked in-memory batch write using `DataSource.deleteRowsBatch` or `updateRowsBatch` to synchronize state back to Sheets.

---

### **Rule N5: Performance Regression & Benchmark Assertions**

Every plan must contain explicit time performance constraints. You must state the target test-harness path under `DazzlingDB/Test/` and integrate console timing assertions tracking execution speeds.

* **Metric Formula:** `T(n) = O(1) API calls — independent of record count n`
* **Harness Assertion:** You must output a timing table to the Apps Script logging console upon execution.

---

### **Rule N6: Legacy Maintenance Mitigation & Red Flag Isolation**

Whenever an implementation plan addresses or refactors older architecture, or relies on an implicit backwards-compatibility fallback path, you must encapsulate that detail inside a red-flag caution block. This gives the reviewer visibility to decide whether to maintain legacy behavior or prune the technical debt.

> [!CAUTION]
> **LEGACY MAINTENANCE IDENTIFIED:**
>
> * **Technical Path Endpoint:** [Specify legacy file/method e.g. `AttendanceUtil.js` line 112]
> * **Core Technical Debt Risk:** [Describe parsing drift, timezone shift, or O(n) execution overhead]
> * **Remediation Option:** [Provide alternative code path to completely decouple from legacy support if approved]

---

### **Rule N7: Two-Phase Plan Separation (Testing & Verification)**

You are strictly prohibited from auto-writing or updating any test files during the primary plan execution. Do not combine functional code modifications and test suite implementations into a single implementation phase.

* **No Inline Test Files in Phase 1**: The initial `implementation_plan.md` must not contain any file write/update actions or snippets targeting `DazzlingDB/Test/` or `apitest/` files.
* **Define Plan Phase 2**: Instead, dedicate a section at the end of the implementation plan labeled `Plan Phase 2 (Testing & Verification)` detailing the required test files, scenarios, and validation strategies we will plan, review, and execute as a separate subsequent step.

---

## **2. Domain-Driven Business Rules**

The following block defines the relational boundaries and business policies governing financial splitting, administrative separation, polymorphic registries, and transaction boundaries.

---

# AIRA SYSTEM DESIGN DECREE: COGNITIVE BUSINESS & DOMAIN CONSTRAINTS

Whenever designing domain services, tracking entities, or validating records across SheetDB and DazzlingDB, you must enforce the official Ubiquitous Language and adhere to these strict business constraints.

---

### Rule D1: Decoupled Contract-to-Seat Model

Administrative Contracts (`Enrollment` table) must remain strictly segregated from Operational Seating Assignments (`BatchAllocation` table).

* **The Domain Contract:** `Enrollment` maps financial obligation ledgers (`StudentFeeAccount` and `Installments`) and program selections; it must never contain batch or scheduling references.
* **The Allocation Contract:** `BatchAllocation` maps attendance, grading logs, and physical batch seats.

---

### Rule D2: Polymorphic Referencing via Type Discriminators

When mapping polymorphic relationships (such as checking package items wrapping courses or subjects), you must route your validations exclusively through the global `PolymorphicRegistry` using type fields (e.g., `belongsToPolymorphic` configurations).

* **The Constraint:** You are completely blocked from hardcoding raw prefix-string parsing rules (such as matching `"CRS-"` or `"PKG-"` manually) to determine entity models.

---

### Rule D3: Relational Transaction Boundary & LIFO Rollback Traceability

All sequential multi-sheet persistence routines (such as writing an `Enrollment` record followed by generating an installment schedule) must execute inside an active `TransactionTracker` instance.

* **The Recovery Path:** If any phase of the transaction throws a validation exception, you must trace the recovery path showing how a Last-In, First-Out (LIFO) rollback restores the original data snapshots directly through the table gateways, bypassing ORM `AutoField` locks.

---

### Rule D4: Zero-Hardcoding Metadata Schema Compliance

You are prohibited from embedding raw database strings, column offsets, or ID prefix configurations directly inside code routines.

* **The Mandate:** All table structures, requirements, primary keys, and relationship directions must be resolved dynamically at runtime by querying the Compiled Schema metadata configurations located under `DazzlingDB/Config/Schema/`.

---

### Rule D5: Mutation Manifest & Presentation Envelope Compliance

All modifications (writes, updates, drops, or deletions) must append their changes to the active thread context (`context.mutationManifest`).

* **The Envelope:** The final API response payload must format cleanly using standard framework checks, returning a structured `_presentation` envelope conforming to the configured PascalCase table schema structures.

---

### Rule D6: Relational Cascade Boundaries & Cycle Prevention Checks

When removing parent entities, you must construct a leaf-first topological sorting roadmap to isolate relational dependencies.

* **Financial Protection:** Active payment lines (`Payment`, `Installments`) must block deletions of parent administrative contracts (`Enrollment`) by throwing a `SheetDB.ValidationError`.
* **Cycle Check:** Independent child records must be evaluated against the "Visited Set Cycle Prevention" rules to bypass circular reference loops.
