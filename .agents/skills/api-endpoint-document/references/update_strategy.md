# API Specification Update & Drift Detection Strategy

This reference defines the procedural strategy for running `api-endpoint-document` in `update` mode on existing REST API documentation files located under `docs/api_docs/`.

---

## 1. Schema & Code Drift Detection Algorithm

When updating an existing specification doc in `docs/api_docs/`:

1. **Locate Target Controller & Schemas**:
   - Identify target action key from doc header metadata (e.g., `finance_payment_record`).
   - Read corresponding controller implementation file (e.g., `DazzlingDB/DBServices/ConcreteActions.js`).
   - Read schema JSON configuration files from `DazzlingDB/Config/Schema/` for primary and secondary tables.

2. **Extract Active Contract**:
   - Parse active schema columns, data types, required fields, foreign keys, and polymorphic discriminators.
   - Extract validation checks and raised error classes (`ValidationError`, `IntegrityError`).

3. **Compare Against Documented Parameter Tables**:
   - **New Fields (Added in Schema/Code)**: Fields present in schema/controller but missing from doc -> **Flag as "NEW_FIELD_DRIFT"** and append to parameter dictionary.
   - **Type Mismatches**: Field type changed (e.g., `string` to `object`) -> **Flag as "TYPE_DRIFT"** and update constraint column.
   - **Deprecated Fields**: Parameter documented but removed from schema/controller -> **Flag as "DEPRECATED_FIELD"** and add `[DEPRECATED]` tag in doc.
   - **Missing Error Codes**: New exception classes raised in controller missing from Error Taxonomy Matrix -> **Flag as "MISSING_ERROR_CODE"** and add row.

---

## 2. Section-by-Section Merge Rules

To avoid wiping out human-written domain logic, follow this section governance strategy:

| Document Section | Merge Action | Handling Rule |
| :--- | :--- | :--- |
| **0. 6-Phase Compliance Audit Matrix** | **Re-Evaluate & Overwrite** | Re-check all 6 phases against current code/schema and update matrix statuses. |
| **1. Action Metadata Matrix** | **Selective Update** | Update implementation file path, table targets, or RBAC if code changed. Keep description intact. |
| **2. Architectural Axioms** | **Preserve & Enrich** | Keep existing domain narratives. Append newly identified polymorphic discriminators or CASCADE/RESTRICT rules. |
| **3. Parameter Validation Dictionary** | **Smart Merge** | Update types, constraints, and required flags. Add missing fields. Preserve human-written business descriptions. |
| **4. Request/Response Envelopes** | **Regenerate Envelopes** | Update JSON schemas, keys, and envelope payloads to reflect new field structures while retaining mock format. |
| **5. Error Taxonomy Matrix** | **Append Missing Rows** | Preserve existing error descriptions. Add rows for any newly detected `errorCode` triggers. |
| **6. Math & Accounting Formulations** | **Strictly Preserve** | Never alter or remove LaTeX mathematical formulas unless explicitly requested by Moni. |

---

## 3. Drift Summary Report Format

Upon completing an update pass, append or present a brief **Drift Summary Report**:

```markdown
### Schema & Code Drift Summary
- **Target File**: `docs/api_docs/[domain]_[action_name]_api_doc.md`
- **Target Action Key**: `[Action Key]`
- **Detected Drifts**:
  - `[ADDED]`: `payload.payment_method` (string, Enum: ["cash", "card", "online"])
  - `[TYPE_DRIFT]`: `payload.due_date` updated from `string` to `string (Format: YYYY-MM-DD)`
  - `[ERROR_CODE_ADDED]`: `PAYMENT_EXCEEDS_BALANCE` added to Error Taxonomy.
- **Merge Status**: 100% Preserved Human Narratives; Updated Parameter Dictionary & Envelopes.
```
