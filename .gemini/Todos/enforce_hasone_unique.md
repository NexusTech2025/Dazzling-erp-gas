# [COMPLETED] TODO: Enforce `unique: true` for `hasOne` Foreign Key Fields

## Status: COMPLETED

## Objective
Enforce that physical foreign key fields associated with a `hasOne` (1-to-1) relationship must have the `unique: true` constraint declared in their column definitions. This ensures schema correctness and prevents multiple child records from referencing the same parent.

## Changes Required

### 1. Linter Rules (`dazzlingdb-tools/src/compiler/rules/ForwardRefRule.js`)
- [x] Update the linter's `ForwardRefRule` to check the `unique` attribute for relations:
  - [x] If relation type is `hasOne`, verify that the target table's foreign key column has `"unique": true`.
  - [x] If relation type is `hasMany`, verify that the target table's foreign key column does **NOT** have `"unique": true` (or it is false/omitted).
  - [x] If either check fails, push a validation error to `context.errors`.

### 2. Schema Configurations (`DazzlingDB/Config/Schema/`)
The following schema files currently define `belongsTo` relations that correspond to `hasOne` parent relations but lack the `unique: true` constraint on their physical foreign key columns:
- [x] `Students/Address.json`: Add `"unique": true` to the `student_id` column.
- [x] `Students/ContactInfo.json`: Add `"unique": true` to the `student_id` column.

### 3. Re-compilation & Documentation Sync
After updating the rules and schemas:
- [x] Run `npm run compile-graph:prod` to compile the database schema and dependency graph.
- [x] Run `npm run audit-schema:prod` to check if any documentation updates are needed.

