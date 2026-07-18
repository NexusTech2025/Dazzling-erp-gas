---
trigger: model_decision
description: Apply This during schema compiles, table mutations, multi-file ingestions (DazzlingDB/, SheetDB/), or summaries.Wait for user confirmation token before writing heavy markdown logs or documents.
---


# Framework Governance Directive: System-Wide ChatSession Changelog Guardrail

## 1. Context & Operational Invariant
This directive establishes an absolute system constraint for all AI interaction models operating within the SheetDB and DazzlingDB engineering ecosystems. During conversational chat sessions, the unauthorized generation of sprawling markdown tables, structured change logs, or expansive file modification manifests introduces severe token inflation, consumes critical context window space, and reduces runtime processing efficiency. 

To mitigate this token-overhead anti-pattern, this standalone rule replaces aggressive autocommit documentation workflows with a strict **Reference-Only Single-Line Trace Vector** pattern, gating complex content layout compilation behind an explicit user confirmation step.

---

## 2. Rule Specifications

### Rule: Reference-Only Single-Line Traces (Changelogs)

### 2.1 Automated Output Suppression Constraint
* **Enforcement**: The AI agent is strictly prohibited from automatically writing, appending, or updating comprehensive changelog records, database modification history tables, or file directory diff summaries within routine response windows.
* **Scope**: This boundary applies to all schema alterations, entity model mutations, architectural adjustments, and source code refactoring events.

### 2.2 Standard Reference-Only Formatting
* **Syntax Invariant**: When an active development task results in a system modification, the event must be recorded using exactly **one single-line bullet point per technical change coordinate**.
* **Content Limit**: The single-line entry must function exclusively as a high-signal index anchor, recording what was altered, the target file path, and a minimal rationale in a flat alphanumeric string.
* **Token Budget Preservation**: No tables, nested sub-bullets, blocks of pseudo-code, or markdown structural expansions are permitted inside this minimal tracing trace block.

### 2.3 On-Demand Compilation & Gated Handover
* **Indexing Lifecycle**: The single-line reference logs serve exclusively as memory trace indices within the transient session timeline.
* **Explicit User Gate**: The transformation of these references into production-ready, heavy markdown documentation formats (e.g., updating a full master `CHANGELOG.md`) will **only** be initiated upon receiving an explicit confirmation instruction or direct command string from the user.

---

## 3. Reference Implementation Verification Flow


```text

[SYSTEM ALTERATION EVENT]
│
▼
[EVALUATE RULE CONSTRAINTS]
│
├─► AUTO-COMPILE FULL CHANGELOG DETAILED BLOCKS ────► (TERMINATE / BLOCKED)
│
└─► OUTPUT EXACTLY ONE-LINE ANCHOR REFERENCE BULLET ─► (PERMITTED)
│
▼
[AWAIT EXPLICIT USER CONFIRMATION]
│
└─► "Write full changelog" ──► [GENERATE COMPLETE SPEC MATRIX]

```

### Example of Compliant Session Output Profile under This Rule:
* **Schema Evolution Trace**: Refactored `TeacherPaymentTransaction.json` column definitions to replace static ID parsing keys with explicit polymorphic model properties.
* **System Governance Update**: Active framework initialization parameters bound to rule constraint `This Rule` to decouple full-scale document sync sequences from conversational cycles.

