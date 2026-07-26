# API Action Specification: `[domain_action_name]`

> **Document Status**: Production Spec  
> **Schema Version**: `[e.g., 2.2.0]`  
> **Target Subsystem**: `[e.g., Academic / Finance / Staff / Auth]`  
> **Controller Implementation**: `[e.g., DazzlingDB/DBServices/ConcreteActions.js -> ActionClassName]`

---

## 0. 6-Phase Compliance Audit Matrix

| Specification Phase | Verification Standard | Status |
| :--- | :--- | :--- |
| **Phase 1: Action Classification** | Action key, RBAC role, target tables, and execution mode defined. | PASSED |
| **Phase 2: Relational Boundaries** | Foreign keys, polymorphic discriminators, RESTRICT/CASCADE rules specified. | PASSED |
| **Phase 3: Data Contracts** | All `payload.*` parameters cataloged with types, requirements, and constraints. | PASSED |
| **Phase 4: Payload Envelopes** | Canonical Request JSON and standard `200 OK` / Error JSON envelopes provided. | PASSED |
| **Phase 5: Transaction Mechanics** | `TransactionTracker` LIFO rollback safety and error code registry cataloged. | PASSED |
| **Phase 6: Math & Accounting** | LaTeX formulations included for monetary calculations, scoring, or ledger splits. | `[PASSED / N/A]` |

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

## 3. Parameter Validation Dictionary

All incoming payload fields must be wrapped inside the root `payload` parameter object.

### 3.1 Root Protocol Request Parameters

| Attribute | Type | Required? | Validation Rules & Constraints |
| :--- | :--- | :--- | :--- |
| `action` | `string` | **Yes** | Must evaluate strictly to `"[domain_action_name]"`. |
| `token` | `string` | **Yes** | Active session token resolved via `AuthBridge`. |
| `payload` | `object` | **Yes** | Container object holding action parameters. |

### 3.2 Payload Domain Contract (`payload.*`)

| Parameter Path | Type | Required? | Enums / Constraints | Business Description |
| :--- | :--- | :--- | :--- | :--- |
| `payload.[primary_id]` | `string` | **Yes** | Dynamic Schema PK Pattern | Unique entity identifier. |
| `payload.[entity_type]` | `string` | **Yes** | Enum: `["course", "package"]` | Discriminator driving polymorphic lookups. |
| `payload.[amount]` | `number` | **Yes** | Floating point `> 0` | Monetary amount for transaction entry. |
| `payload.[effective_date]`| `string` | No | Format: `YYYY-MM-DD` | Date string normalized via `SheetDBDateTime`. |

---

## 4. API Request & Response Payload Envelopes

### 4.1 Canonical Request Envelope

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

### 4.2 Standard Success Response Envelope (`200 OK`)

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

### 4.3 Error Response Envelope

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

## 5. Error Taxonomy & System Mitigation Matrix

| Error Code | Error Class | Trigger Condition | System Mitigation & Recovery |
| --- | --- | --- | --- |
| `FORBIDDEN_ACCESS` | `ActionAuthorizationError` | Token role lacks required RBAC permission. | Request terminated before service tier. |
| `INVALID_PAYLOAD_STRUCTURE` | `ActionValidationError` | Missing required payload parameters. | Rejects write; zero sheet mutations. |
| `POLYMORPHIC_RESOLUTION_FAIL` | `EntityNotFoundError` | Discriminator fails to map in `PolymorphicRegistry`. | Prevents bad row generation. |
| `DELETE_PROTECTED` | `IntegrityError` | Foreign key constraint (`RESTRICT`) violated. | Aborts transaction before sheet flush. |
| `LIFO_ROLLBACK_TRIGGERED` | `TransactionError` | Downstream sheet flush failure mid-stream. | Restores serialized backup rows from `TransactionTracker`. |

---

## 6. Mathematical & Accounting Formulations (If Applicable)

*(Include LaTeX formulations for financial ledger splitting, interest calculation, proration, or competitive rank calculations).*

### 6.1 Financial Proportional Allocation Formula

When allocating a payment $P_{\text{total}}$ across multiple child installments $I_1, I_2, \dots, I_n$:

$$F_{\text{net}} = F_{\text{base}} - D_{\text{discount}} + A_{\text{penalty}}$$

For each installment index $k \in \{1, \dots, n\}$ with due amount $I_{\text{due}, k}$, the allocated payment $I_{\text{paid}, k}$ is calculated via:

$$I_{\text{paid}, k} = \min\left(I_{\text{due}, k}, \max\left(0, P_{\text{total}} - \sum_{j=1}^{k-1} I_{\text{due}, j}\right)\right)$$
