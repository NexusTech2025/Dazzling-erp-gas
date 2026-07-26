---
name: api-endpoint-document
description: Generates or updates standardized DazzlingDB REST API endpoint specifications conforming to the official 6-Phase blueprint. Use when documenting new API action endpoints or updating existing API documentation in create or update mode.
---

# API Endpoint Document Generator & Updater

This skill automates the creation and updating of enterprise-grade DazzlingDB REST API endpoint specifications. Every output file strictly adheres to the official 6-Phase Documentation Protocol and incorporates an interactive 6-Phase Compliance Audit Matrix.

---

## Reference Architecture

Before documenting or updating endpoints, read the relevant reference materials:

- **Protocol & 6-Phase Blueprint**: See [protocol_rules.md](references/protocol_rules.md) for full phase definitions, RBAC matrices, LIFO transactions, canonical envelopes, and LaTeX math notation.
- **Production Template**: See [template.md](references/template.md) for the canonical Markdown layout.
- **Update & Drift Detection Strategy**: See [update_strategy.md](references/update_strategy.md) for diff/merge rules and schema drift analysis.

---

## Storage Location Rule

> [!IMPORTANT]
> **Mandatory Documentation Directory:**
> All API endpoint specification documents created or managed by this skill MUST be saved under [docs/api_docs/](e:/NAST/Dazzling/GAS/docs/api_docs/) (absolute path: `e:\NAST\Dazzling\GAS\docs\api_docs\`).
> Standard naming convention: `<domain>_<action_name>_api_doc.md` (e.g., `finance_payment_record_api_doc.md`).

---

## Operating Modes & Command Execution

This skill supports two execution modes based on the user's intent:

### 1. `create` Mode
Use when generating a brand-new API endpoint specification file for a newly implemented controller action or endpoint group.

**Workflow:**
1. **Identify Target Action Key**: Locate action key (e.g. `academic_create_batch`, `finance_payment_record`) in controller code (e.g. `DazzlingDB/DBServices/ConcreteActions.js`).
2. **Inspect Schemas & Code**: Read table schemas under `DazzlingDB/Config/Schema/` for primary/secondary entity structures, PK generation rules, and foreign keys.
3. **Assemble 6-Phase Blueprint**:
   - Phase 1: Action Classification & Metadata.
   - Phase 2: Architectural Axioms (Polymorphic discriminators, CASCADE/RESTRICT rules, data sanitization).
   - Phase 3: Parameter Validation Dictionary (`payload.*`).
   - Phase 4: Payload Envelopes (Canonical Request, `200 OK` Success, Error Response).
   - Phase 5: Transaction Mechanics & Error Code Registry.
   - Phase 6: LaTeX Math & Ledger Formulations (if applicable).
4. **Populate Audit Matrix**: Mark all satisfied phases as `PASSED` in Section 0 (6-Phase Compliance Audit Matrix).
5. **Output & Save**: Save the generated Markdown file in [docs/api_docs/](e:/NAST/Dazzling/GAS/docs/api_docs/) adhering to the naming convention `docs/api_docs/<domain>_<action_name>_api_doc.md`.

---

### 2. `update` Mode
Use when updating an existing API documentation file located under [docs/api_docs/](e:/NAST/Dazzling/GAS/docs/api_docs/) to reflect recent codebase or schema modifications.

**Workflow:**
1. **Read Existing Spec**: Parse current section structures, parameter dictionaries, error matrices, and human-written narratives from `docs/api_docs/<target_file>.md`.
2. **Run Schema & Code Drift Detection**:
   - Compare documented parameter tables against active JSON schemas in `DazzlingDB/Config/Schema/`.
   - Identify added fields (`NEW_FIELD_DRIFT`), modified data types (`TYPE_DRIFT`), removed fields (`DEPRECATED_FIELD`), and new error codes (`MISSING_ERROR_CODE`).
3. **Execute Smart Merge**:
   - Follow section merge rules in [update_strategy.md](references/update_strategy.md).
   - **Auto-Update**: Parameter tables, JSON envelopes, error matrices, and compliance status.
   - **Preserve**: Human-authored business descriptions, domain narratives, and LaTeX math formulas.
4. **Re-Evaluate Compliance Audit Matrix**: Re-verify all 6 phases and update Section 0 statuses.
5. **Generate Drift Summary**: Append a concise Schema & Code Drift Summary report detailing all detected parameter/schema changes.
6. **Output & Save**: Write the updated Markdown specification back to its file under [docs/api_docs/](e:/NAST/Dazzling/GAS/docs/api_docs/).

---

## Execution Guardrails & Best Practices

- **Mandatory Storage Location**: Never write endpoint documentation files outside `docs/api_docs/`.
- **Zero Assumption**: Always inspect the authoritative schema JSON (`DazzlingDB/Config/Schema/`) and controller code before generating or updating documentation.
- **Link Format Rule**: All file links in documentation must use plain Markdown path formatting (e.g., `[file.js](DazzlingDB/file.js)`), never prefixing paths with `file:///`.
- **Envelope Standardization**: Ensure JSON envelopes include standard `context` (execution timing, mutated records count) and `meta` (environment, version, timestamp) blocks.
