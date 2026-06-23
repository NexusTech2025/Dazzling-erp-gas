# Database Governance & Standards

## 1. Soft-Delete Protocol
All business-critical tables must implement a soft-delete mechanism.
- **Column**: `__deleted_at` (TIMESTAMPTZ)
- **Behavior**: Rows where `__deleted_at` is NOT NULL are considered inactive and should be excluded from standard queries unless historical auditing is required.
- **Purging**: Hard deletes are only permitted via scheduled archival jobs after a retention period of [X] months.

## 2. ID Generation Strategy
- **Primary Keys**: Must use UUID v7 (time-sortable) for distributed scalability and performance.
- **Foreign Keys**: Must reference the UUID of the target entity.
- **Natural Keys**: Can be used as unique constraints but should not be the primary clustering key.

## 3. Temporal Standards
- **Timestamps**: All date/time fields MUST use `TIMESTAMPTZ` (Timestamp with Time Zone).
- **Storage**: Data must be stored in UTC. Conversion to local time happens at the Presentation Layer.
- **Standard Fields**:
    - `__created_at`: Set on INSERT, never modified.
    - `__updated_at`: Updated on every modification.

## 4. Naming Conventions
- **Documentation Files**: Must use `PascalCase` (e.g., `StudentRecords.md`).
- **Tables**: Must use `snake_case` and be plural (e.g., `academic_courses`).
- **Columns**: Must use `snake_case` (e.g., `first_name`).
- **Indexes**: `idx_{table_name}_{column_name}`.
- **Constraints**: `ck_{table_name}_{description}` or `fk_{table_name}_{target_table}`.

## 5. ACID & Transactions
- All cross-table workflows must be wrapped in a transaction.
- The `__tx_id` must be propagated across all rows modified within the same business unit of work.

## 6. Audit & Versioning
- **Optimistic Locking**: Use `__version` (Integer) to prevent lost updates in concurrent environments.
- **Audit Logs**: High-sensitivity tables must have a corresponding `_audit` table or use a centralized audit log.
