# DazzlingDB REST API Endpoint Documentation Protocol

This document details the mandatory 6-Phase structural blueprint and architectural axioms for all DazzlingDB REST API specifications.

---

## 1. The 6-Phase Blueprint Overview

Every DazzlingDB REST API endpoint document MUST adhere to the following sequence:

1. **Phase 1: Metadata Header & Classification Matrix**
2. **Phase 2: Architectural Axioms & Relational Boundaries**
3. **Phase 3: Schema & Data Contract Dictionary**
4. **Phase 4: Standard Request / Response Payload Envelopes**
5. **Phase 5: Transaction Mechanics & Error Code Registry**
6. **Phase 6: Mathematical Ledger & Accounting Formulations**

---

## 2. 6-Phase Compliance Audit Matrix Checklist

Every endpoint documentation file must begin with a 6-Phase Compliance Audit Matrix verifying spec completeness:

| Specification Phase | Verification Standard | Status |
| :--- | :--- | :--- |
| **Phase 1: Action Classification** | Action key, RBAC role, target tables, and execution mode defined. | `[PASSED / PENDING]` |
| **Phase 2: Relational Boundaries** | Foreign keys, polymorphic discriminators, RESTRICT/CASCADE rules specified. | `[PASSED / PENDING]` |
| **Phase 3: Data Contracts** | All `payload.*` parameters cataloged with types, requirements, and constraints. | `[PASSED / PENDING]` |
| **Phase 4: Payload Envelopes** | Canonical Request JSON and standard `200 OK` / Error JSON envelopes provided. | `[PASSED / PENDING]` |
| **Phase 5: Transaction Mechanics** | `TransactionTracker` LIFO rollback safety and error code registry cataloged. | `[PASSED / PENDING]` |
| **Phase 6: Math & Accounting** | LaTeX formulations included for monetary calculations, scoring, or ledger splits. | `[PASSED / N/A]` |

---

## 3. Detailed Phase Specifications

### Phase 1: Action Classification & Metadata
- **Action Key**: Lowercase snake_case identifier (e.g., `finance_payment_record`, `academic_create_batch`).
- **HTTP Method**: Always `POST` (routed via `ApiDispatcher.dispatch`).
- **RBAC Privileges**: Target access tier (`superadmin`, `admin`, `teacher`, `student`, `guest`).
- **Controller Type**: Specialized Domain Action Controller vs. Generic CRUD Controller (`GLOBAL_CRUD_WHITELIST`).
- **Target Gateway Tables**: Primary entity table and any secondary/child tables.

### Phase 2: Relational & Architectural Boundaries
- **Polymorphic Discriminator Mapping**: Document explicit type fields (e.g., `party_type`, `item_type`) and target entity resolution via `PolymorphicRegistry` and `ModelRegistry`. Raw string prefix parsing (e.g., matching `"CRS-"` manually) is strictly prohibited.
- **`RESTRICT` Safety Guards**: Conditions under which deletion/modification is blocked (e.g., active downstream payments or enrollment contracts). Throws `DELETE_PROTECTED` error.
- **`CASCADE` Cleanups**: Child tables automatically wiped in RAM prior to batch overwrites.
- **Sanitizing Safeguards**: Mandatory stripping of sensitive fields (`password_hash`, `password_salt`) before returning responses.

### Phase 3: Parameter Validation Dictionary
Catalog all parameter fields in a structured table:
- `action`: `string` (Required) - Must match action key.
- `token`: `string` (Required) - Active session token.
- `payload`: `object` (Required) - Input container.
- `payload.*`: Specific parameters with explicit JS data types, default values, enums, and dynamic schema PK formats.

### Phase 4: Standard Payload Envelopes
Document complete JSON bodies for:
1. **Canonical Request Payload**: Root object with `action`, `token`, and `payload`.
2. **Success Envelope (`200 OK`)**: Standard response wrapper containing `success: true`, `action`, `data` (with `__tx_id`, `__tx_status`), `context` (execution speed, mutation count), and `meta` (environment, version, timestamp).
3. **Error Response Envelope**: Standard error object with `success: false`, `error` object (`type`, `message`, `errorCode`, `details`), `context`, and `meta`.

### Phase 5: Transaction & Error Code Registry
- **Transaction Safety**: Document `TransactionTracker` LIFO rollback behavior on mid-stream failure.
- **Error Registry Matrix**: Map explicit error codes (`FORBIDDEN_ACCESS`, `INVALID_PAYLOAD_STRUCTURE`, `POLYMORPHIC_RESOLUTION_FAIL`, `DELETE_PROTECTED`, `LIFO_ROLLBACK_TRIGGERED`) to their trigger conditions and recovery mitigations.

### Phase 6: Mathematical & Accounting Formulations
Use standard LaTeX notation for domain math:
- **Proportional Financial Allocation**:
  $$F_{\text{net}} = F_{\text{base}} - D_{\text{discount}} + A_{\text{penalty}}$$
  $$I_{\text{paid}, k} = \min\left(I_{\text{due}, k}, \max\left(0, P_{\text{total}} - \sum_{j=1}^{k-1} I_{\text{due}, j}\right)\right)$$
- **Competitive Rank Formulation**:
  $$R(S_i) = 1 + \left\vert{} \left\{ S_j \in \mathbf{S} \mid S_j > S_i \right\} \right\vert{}$$
