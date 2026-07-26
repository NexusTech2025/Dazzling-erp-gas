## Architectural Assessment & Standardization Audit

An audit of `REST-api-doc.md`, `user-rest-api-doc.md`, and `student_registration_payload.md` reveals a well-structured Command-Action protocol built over Google Apps Script (GAS) and Google Sheets. However, variations exist between general endpoints (e.g., `academic_create_batch`), administrative actions (`user_update`), and multi-table transactional endpoints (`student_register`).

To eliminate documentation technical debt and enforce strict alignment across all DazzlingDB REST API actions, we must establish a **Standardized API Documentation Protocol**. This blueprint ensures every endpoint spec explicitly defines:

1. **Transactional and Cascade Boundaries** (`TransactionTracker`, LIFO Rollback execution).
2. **Polymorphic Registries** (driven by explicit type discriminators like `party_type` or `enrollment_type`).
3. **Strict Parameter Encapsulation** (enforcing root `{ action, token, payload }` constraints).
4. **Structured Error Code Taxonomies** (standardizing error types and specific `errorCode` identifiers).
5. **Memory & Sheet Operation Constraints** (distinguishing generic whitelisted CRUD vs. specialized transactional domain handlers).

---

## The DazzlingDB Endpoint Documentation Protocol Specification

Every single REST API endpoint document or endpoint group spec created for DazzlingDB **MUST** adhere to the following 6-phase structural blueprint.

```
+-----------------------------------------------------------------------+
|                DAZZLINGDB ENDPOINT SPECIFICATION STRUCTURE            |
+-----------------------------------------------------------------------+
| 1. Metadata Header & Classification (Action Key, Whitelist, RBAC)    |
| 2. Architectural Axioms & Relational Boundaries (Cascade/RESTRICT)   |
| 3. Schema & Data Contract Dictionary (Types, Discriminators, Enums)  |
| 4. Standard Request / Response Envelopes (Payload Anatomy & Mock Data)|
| 5. Transaction & Error Code Registry (LIFO States & Fault Vectors)    |
| 6. Math & Amortization Formulations (Ledger & Accounting Math)       |
+-----------------------------------------------------------------------+

```

---

### Phase 1: Endpoint Metadata Header & Classification Matrix

Every document must begin with a standardized metadata block detailing routing, access requirements, and execution speed profiles.


# [Endpoint Action Key / Group Name] API Specification

## 1. Endpoint Overview & Classification

| Property | Value / Specification |
| :--- | :--- |
| **Action Key(s)** | `action_name_here` |
| **HTTP Method** | `POST` (GAS Web App Dispatcher) |
| **Access Control (RBAC)** | `superadmin` \| `admin` \| `teacher` \| `student` \| `guest` |
| **Endpoint Category** | `Specialized Domain Action` OR `Generic CRUD (GLOBAL_CRUD_WHITELIST)` |
| **Target Table(s)** | Primary: `TableName` \| Secondary: `ChildTable1`, `ChildTable2` |
| **Execution Mode** | Single-pass In-Memory Batch (`DataSource`) \| Transactional Gateway |



---

### Phase 2: Relational Schema & Architectural Boundaries

Explicitly define foreign key behaviors, polymorphic relationships, and safety guards.

1. **Polymorphic Discriminator Mapping**: Document if the endpoint uses `belongsToPolymorphic` links. Define the exact type field (e.g., `party_type`, `enrollment_type`) and allowed target mappings from the `PolymorphicRegistry`.
2. **Deletion & Cascade Guardrails**:
* **`RESTRICT` Constraints**: Conditions that block execution (e.g., blocking student deletion if active `Installment` records exist).
* **`CASCADE` Cleanups**: Child tables automatically wiped in RAM before single-pass sheet clear/write.


3. **Sanitizing & Privacy Safeguards**: Explicitly list stripped parameters (e.g., automatic purging of `password_hash` and `password_salt` from responses).

---

### Phase 3: Schema & Data Contract Dictionary

All input properties must be cataloged in a tabular contract format with field validation rules.

#### Parameter Dictionary Format

| Field Path | Type | Required? | Default / Constraints | Description |
| --- | --- | --- | --- | --- |
| `payload.id` | `string` | **Yes** | Valid primary key | Auto-generated ID (e.g., `BAT-E20D1E4B`). |
| `payload.data.status` | `string` | No | Enum: `active`, `inactive` | Status filter state. |
| `payload.data.time` | `object` | No | `{ hour, minute, period }` | Boundary-safe structured JSON time object. |

---

### Phase 4: Payload Anatomy & Envelope Examples

Documentation must show the **Full HTTP Body JSON**, enforcing root-level encapsulation (`action`, `token`, `payload`).

#### 1. Standard Request Payload

```json
{
  "action": "example_action_key",
  "token": "SESSION_TOKEN_STRING",
  "payload": {
    "key_1": "value_1",
    "nested_object": {
      "key_2": "value_2"
    }
  }
}

```

#### 2. Standard Success Envelope (`200 OK`)

```json
{
  "success": true,
  "action": "example_action_key",
  "data": {
    "id": "KEY-123456",
    "record": {},
    "__tx_id": "TX-98765432",
    "__tx_status": "COMMITTED"
  }
}

```

---

### Phase 5: Transaction Mechanics & Error Code Registry

Specify transaction guarantees and document all system error codes.

#### Error Response Envelope Structure

```json
{
  "success": false,
  "action": "example_action_key",
  "error": {
    "type": "ActionValidationError",
    "message": "Detailed description of constraint failure.",
    "errorCode": "SPECIFIC_ERROR_ENUM"
  }
}

```

#### Error Code Registry Matrix

| Error Code | Error Type | Trigger Condition | System Mitigation |
| --- | --- | --- | --- |
| `FORBIDDEN_ACCESS` | `ForbiddenError` | Token role lacks RBAC privileges. | Immediate request termination. |
| `DUPLICATE_SHORT_CODE` | `ConflictError` | On-demand creation hits existing unique index. | LIFO Rollback via `TransactionTracker`. |
| `DELETE_PROTECTED` | `ValidationError` | Active downstream FK dependencies exist. | Halts execution during dry-run scan. |

---

### Phase 6: Mathematical Ledger & Accounting Formulations

For financial, test scoring, or fee recalculation endpoints (e.g., `student_register`, `finance_delete_many_payments`, `test_query_report`), document the underlying formulas using standard mathematical notation.

#### Proportional Fee Split Formulation

When distributing a net payment across multiple installments:

$$F_{\text{final}} = F_{\text{total}} - D_{\text{discount}} + A_{\text{adjustment}}$$

For installment index $k$ with due amount $I_{\text{due}, k}$, the allocated payment $I_{\text{paid}, k}$ is given by:

$$I_{\text{paid}, k} = \min\left(I_{\text{due}, k}, \max\left(0, P_{\text{total}} - \sum_{j=1}^{k-1} I_{\text{due}, j}\right)\right)$$

#### Standard Competition Rank Formulation (Class Test Scoring)

For a student with obtained marks $S_i$, the dense competitive rank $R(S_i)$ among $N$ present students is derived as:

$$R(S_i) = 1 + \left\vert{} \left\{ S_j \in \mathbf{S} \mid S_j > S_i \right\} \right\vert{}$$

---

## Universal REST API Documentation Template

*(Use the standard template below when documenting any new DazzlingDB REST endpoint)*

```markdown
# [Module Name]: [Endpoint Name] REST API Specification

## 1. Overview & Metadata
* **Action Key:** `module_action_name`
* **HTTP Method:** `POST`
* **Access Control:** `superadmin` | `admin`
* **Category:** Specialized Domain Endpoint
* **Target Table:** `PrimaryTable` (Cascades to `ChildTable`)

## 2. Relational & Transactional Mechanics
* **Polymorphic Referencing:** Maps `party_id` via `party_type` discriminator (`student` -> `Student`, `teacher` -> `Teacher`).
* **Cascade Behavior:** Deleting parent record cascades to `ChildTable` via `TransactionTracker`.
* **RESTRICT Guards:** Blocked if active transactions exist in `FinancialLedger`.

## 3. Request Payload Contract

### Root Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `action` | `string` | **Yes** | Must be `"module_action_name"`. |
| `token` | `string` | **Yes** | Valid session token. |
| `payload` | `object` | **Yes** | Parameters wrapper. |

### Payload Object Attributes (`payload.*`)
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | `string` | **Yes** | Primary key of the entity. |
| `dryRun` | `boolean` | No | Default `true`. Evaluates constraints without writing. |

## 4. API Request & Response Examples

### Request
```json
{
  "action": "module_action_name",
  "token": "SESSION_TOKEN",
  "payload": {
    "id": "PRM-12345",
    "dryRun": false
  }
}

```

### Success Response

```json
{
  "success": true,
  "action": "module_action_name",
  "data": {
    "success": true,
    "message": "Operation completed successfully.",
    "id": "PRM-12345"
  }
}

```

### Error Response

```json
{
  "success": false,
  "action": "module_action_name",
  "error": {
    "type": "ActionValidationError",
    "message": "Cannot delete record: Referenced in child table.",
    "errorCode": "DELETE_PROTECTED"
  }
}

```

## 5. Domain Logic & Edge Cases

* **In-Memory Batch Execution:** Operates on single-pass RAM arrays using `DataSource.updateRowsBatch`.
* **Rollback Guarantees:** On failure, `TransactionTracker` triggers a LIFO restoration bypassing AutoField locks.

```



--------


# Production Specification Template: Single/Group API Action Endpoint

This standardized Markdown specification template is designed for documenting any single REST API action endpoint or action group within **SheetDB / DazzlingDB**.

When creating documentation for a new or refactored endpoint, copy the template below and replace the placeholder text bracketed in `[ ]`.

---

```markdown
# API Action Specification: `[domain_action_name]`

> **Document Status**: Production Spec  
> **Schema Version**: `[e.g., 2.2.0]`  
> **Target Subsystem**: `[e.g., Academic / Finance / Staff / Auth]`  
> **Controller Implementation**: `[e.g., DazzlingDB/DBServices/ConcreteActions.js -> ActionClassName]`

---

## 1. Action Metadata Matrix

| Metadata Field | Execution Attribute / Constraint |
| :--- | :--- |
| **Action Key** | `[domain_action_name]` |
| **HTTP Dispatch Method** | `POST` (Routed via `ApiDispatcher.dispatch`) |
| **RBAC Access Privileges** | `[superadmin | admin | teacher | student | guest]` |
| **Controller Type** | `[Specialized Domain Action Controller | Generic CRUD Controller]` |
| **Target Gateway Table(s)** | Primary: `[PrimaryTable]` <br> Secondary: `[ChildTable1]`, `[ChildTable2]` |
| **Execution Performance Target** | `$O(1)$` Single-Pass RAM Array Write (`< 150 ms`) |
| **Transaction Boundary** | `TransactionTracker` LIFO Rollback Guaranteed |

---

## 2. Architectural Axioms & Relational Boundaries

### 2.1 Decoupled Contract-to-Seat Alignment
* **Administrative Ledger Contract**: `[e.g., Maps Enrollment and StudentFeeAccount records for financial tracking.]`
* **Seating & Classroom Slot Assignment**: `[e.g., Binds classroom attendance through BatchAllocation without mutating financial contracts.]`

### 2.2 Polymorphic Discriminators & Model Mappings
* **Type Discriminator Field**: `[e.g., item_type ("course" | "package")]`
* **Target Reference Field**: `[e.g., item_id]`
* **Registry Gateway**: Resolved dynamically via `PolymorphicRegistry` and `ModelRegistry`. Raw string prefix parsing (e.g., `STU-`, `BAL-`) is strictly prohibited.

### 2.3 Deletion, Cascade & Foreign Key Guardrails
* **`RESTRICT` Violations**: `[Conditions that halt execution, e.g., Throws DELETE_PROTECTED error if active downstream Installment records exist.]`
* **`CASCADE` Mutations**: `[Child tables automatically cleaned up in RAM before single-pass overwrite, e.g., Address, ContactInfo.]`
* **Data Sanitization Safeguard**: `[Fields stripped before response emission, e.g., Purges password_hash and password_salt.]`

---

## 3. End-to-End Action Execution Sequence


```

+------------------+         +------------------+         +-------------------+         +---------------------+
|  Client Browser  |         |  ApiDispatcher   |         | Action Controller |         |  TransactionTracker |
+--------+---------+         +--------+---------+         +---------+---------+         +----------+----------+
|                            |                             |                                |
| POST {action, token, payload}                            |                                |
+--------------------------->|                             |                                |
|                            | Validate Session Token & RBAC                       |
|                            +---------------------------->|                                |
|                            |                             | Initialize TX Session          |
|                            |                             +------------------------------->|
|                            |                             |                                |
|                            |                             | Single-Pass RAM Mutation / Read|
|                            |                             | [DataSource.updateRowsBatch]   |
|                            |                             |                                |
|                            |                             | On Success: Commit Range Write |
|                            |<----------------------------+                                |
|                            | Format Response Envelope    |                                |
|<---------------------------+                             |                                |
|  200 OK Response Envelope  |                             | On Fail: Trigger LIFO Rollback |
|                            |                             +------------------------------->|

```

---

## 4. Parameter Validation Dictionary

All incoming payload fields must be wrapped inside the root `payload` parameter object.

### 4.1 Root Protocol Request Parameters

| Attribute | Type | Required? | Validation Rules & Constraints |
| :--- | :--- | :--- | :--- |
| `action` | `string` | **Yes** | Must evaluate strictly to `"[domain_action_name]"`. |
| `token` | `string` | **Yes** | Active session token resolved via `AuthBridge`. |
| `payload` | `object` | **Yes** | Container object holding action parameters. |

### 4.2 Payload Domain Contract (`payload.*`)

| Parameter Path | Type | Required? | Enums / Constraints | Business Description |
| :--- | :--- | :--- | :--- | :--- |
| `payload.[primary_id]` | `string` | **Yes** | Dynamic Schema PK Pattern | Unique entity identifier. |
| `payload.[entity_type]` | `string` | **Yes** | Enum: `["course", "package"]` | Discriminator driving polymorphic lookups. |
| `payload.[amount]` | `number` | **Yes** | Floating point `> 0` | Monetary amount for transaction entry. |
| `payload.[effective_date]`| `string` | No | Format: `YYYY-MM-DD` | Date string normalized via `SheetDBDateTime`. |

---

## 5. API Request & Response Payload Envelopes

### 5.1 Canonical Request Envelope

```json
{
  "action": "[domain_action_name]",
  "token": "USR_SESSION_TOKEN_STRING_12345",
  "payload": {
    "primary_id": "PRM-5C100273",
    "entity_type": "course",
    "amount": 15000.00,
    "effective_date": "2026-08-01"
  }
}

```

### 5.2 Standard Success Response Envelope (`200 OK`)

```json
{
  "success": true,
  "action": "[domain_action_name]",
  "data": {
    "success": true,
    "message": "Operation executed successfully.",
    "id": "PRM-5C100273",
    "record": {
      "id": "PRM-5C100273",
      "status": "active",
      "__tx_id": "TX-88392011",
      "__tx_status": "COMMITTED"
    }
  },
  "context": {
    "execution_time_ms": 114,
    "mutated_records_count": 1,
    "mutated_records": ["PrimaryTable"]
  },
  "meta": {
    "environment": "PRODUCTION",
    "version": "2.2.0",
    "timestamp": "2026-07-25T21:30:00.000Z"
  }
}

```

### 5.3 Error Response Envelope

```json
{
  "success": false,
  "action": "[domain_action_name]",
  "error": {
    "type": "ActionValidationError",
    "message": "Cannot modify record: Referenced in active downstream child table.",
    "errorCode": "DELETE_PROTECTED",
    "details": [
      {
        "field": "primary_id",
        "issue": "Active foreign key references present in [ChildTable]."
      }
    ]
  },
  "context": {
    "execution_time_ms": 42,
    "mutated_records_count": 0,
    "mutated_records": []
  },
  "meta": {
    "environment": "PRODUCTION",
    "version": "2.2.0",
    "timestamp": "2026-07-25T21:30:01.000Z"
  }
}

```

---

## 6. Error Taxonomy & System Mitigation Matrix

| Error Code | Error Class | Trigger Condition | System Mitigation & Recovery |
| --- | --- | --- | --- |
| `FORBIDDEN_ACCESS` | `ActionAuthorizationError` | Token role lacks required RBAC permission. | Request terminated before service tier. |
| `INVALID_PAYLOAD_STRUCTURE` | `ActionValidationError` | Missing required payload parameters. | Rejects write; zero sheet mutations. |
| `POLYMORPHIC_RESOLUTION_FAIL` | `EntityNotFoundError` | Discriminator fails to map in `PolymorphicRegistry`. | Prevents bad row generation. |
| `DELETE_PROTECTED` | `IntegrityError` | Foreign key constraint (`RESTRICT`) violated. | Aborts transaction before sheet flush. |
| `LIFO_ROLLBACK_TRIGGERED` | `TransactionError` | Downstream sheet flush failure mid-stream. | Restores serialized backup rows from `TransactionTracker`. |

---

## 7. Mathematical & Accounting Formulations (If Applicable)

*(Include LaTeX formulations for financial ledger splitting, interest calculation, proration, or competitive rank calculations).*

### 7.1 Financial Proportional Allocation Formula

When allocating a payment $P_{\text{total}}$ across multiple child installments $I_1, I_2, \dots, I_n$:

$$F_{\text{net}} = F_{\text{base}} - D_{\text{discount}} + A_{\text{penalty}}$$

For each installment index $k \in \{1, \dots, n\}$ with due amount $I_{\text{due}, k}$, the allocated payment $I_{\text{paid}, k}$ is calculated via:

$$I_{\text{paid}, k} = \min\left(I_{\text{due}, k}, \max\left(0, P_{\text{total}} - \sum_{j=1}^{k-1} I_{\text{due}, j}\right)\right)$$

---

## 8. Integration & Verification Test Suite

All integration and performance benchmarks for this endpoint must reside under `DazzlingDB/Test/` or `DazzlingDB/apitest/` and execute against live database singletons.

### 8.1 Test Execution Command

```bash
# Execute local integration test suite
npm run apitest -- --suite=[Domain]_[ActionName]_ApiTest.js

```

### 8.2 Execution Timing Output Target

Upon completing the test suite execution, the runner must log an ASCII performance matrix:

```
+------------------------------------+-----------+----------------+---------------+
| Test Scenario / Execution Phase    | Duration  | Memory Delta   | Status        |
+------------------------------------+-----------+----------------+---------------+
| Pre-flight Payload Validation      | 12 ms     | +0.1 MB        | PASSED        |
| In-Memory Batch Array Mutation     | 45 ms     | +0.4 MB        | PASSED        |
| Single-Pass Sheet Range Overwrite  | 68 ms     | +0.2 MB        | PASSED        |
| Transaction Commit Verification     | 8 ms      | +0.0 MB        | PASSED        |
+------------------------------------+-----------+----------------+---------------+
| TOTAL LIFECYCLE EXECUTION TIME     | 133 ms    | O(1) Memory    | 100% SUCCESS  |
+------------------------------------+-----------+----------------+---------------+

```

```

```