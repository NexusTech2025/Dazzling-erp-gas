# Table: {{ Table Name }}

---

# 1. Overview
[Long paragraph explaining the purpose, business role, importance, and lifecycle of the table.]

# 2. Business Context
[Explain where it's used, who uses it, and its operational significance.]
Used By:
- [Module A]
- [Module B]

# 3. Lifecycle Narrative
[Explain lifecycle stages and status transitions. Example: Applicant -> Active Student -> Enrolled]

# 4. Column Documentation

## 4.1 Technical Implementation Summary
| Column | Storage Type | Nullable | Index Type | Constraint | Default |
| :--- | :--- | :--- | :--- | :--- | :--- |
| {{ column_name }} | {{ storage_type }} | {{ is_nullable }} | {{ index_type }} | {{ constraint }} | {{ default }} |

## 4.2 Inherited System Fields
These fields are automatically managed by the system and present in all enterprise tables.

- `__tx_id`: UUID of the transaction that last modified this row. Used for cross-table reconciliation.
- `__version`: Integer incremented on every update for optimistic locking.
- `__created_at`: TIMESTAMPTZ of initial insertion.
- `__deleted_at`: TIMESTAMPTZ for soft-delete auditing. Null if active.

## 4.3 Detailed Column Logic

### {{ column_name }}
*   **Purpose:** [Why field exists]
*   **Data Type:** `{{ type }}`
*   **Validation Rules:**
    - Required: {{ is_required }}
    - [Other rules]
*   **Sanitization:** [e.g., "Trim whitespace", "Force lowercase"]
*   **Business Notes:** [Real-world logic, e.g., "If changed, log old value to AuditTrail"]
*   **Edge Cases:** [Failure conditions]

# 5. Relationship Documentation
[Explain why the relationship exists, ownership model, cascade expectations, and deletion rules.]

### {{ Table }} → {{ Related Table }}
*   **Relationship Type:** {{ Type }}
*   **Cascade Rule:** {{ Cascade Rule, e.g., "RESTRICT", "SET NULL", "CASCADE" }}
*   **Business Logic:** [Why this link exists and what happens if the parent is deleted.]

# 6. Real-World Use Cases
[VERY IMPORTANT. What makes docs enterprise-grade. E.g., Use Case 1: Student switches packages mid-session.]

# 7. Access Patterns & Performance
### Key Access Patterns
- **Pattern 1:** [e.g., "Lookup by email for login authentication"] -> **Frequency:** [High/Medium/Low]
- **Pattern 2:** [e.g., "Filter by status for dashboard reporting"] -> **Frequency:** [High]

### Indexing Strategy
[Detailed indexing requirements based on the access patterns above.]

# 8. Sanitization & Validation Summary
Define how data should be formatted and sanitized before insertion into this table.

- **Field Name**: [Formatting Rule, e.g., "Strip whitespace", "Lowercase email", "Force UTC"]

# 9. Query Examples
[SQL, ORM, API Examples]

# 10. Security & Privacy
[Sensitive fields, compliance concerns, PII handling, encryption requirements]

# 11. Future Evolution
[Explain expected schema growth for this table, e.g., "Planned migration to partitioned table if row count exceeds 10M".]

# 12. Change Log
> **v{{ Version }} ({{ Date }}):** [Summary of changes: e.g., "Initial v2.0 structure. Normalized address into separate table."]
