# DazzlingDB Relational Schema Integrity, Polymorphic Foreign Keys, and Deletion Cascades

**Date:** 2026-06-07

This session established strict relational integrity across the database schemas, repaired the schema compilation and validation rules, introduced a dedicated `ForeignKeyField` class inside SheetDB, and implemented dynamic deletion constraints (protect, cascade, set_null) across all repository layers.

---

## 1. Schema Compilation & Linter Relational Alignment

Before these changes, the schema compiler and linter rules were completely non-functional for relationship checking because they scanned columns for a legacy `"type": "foreign_key"` definition, whereas DazzlingDB defines relations in a root-level `"relations"` block and represents foreign key columns as standard types.

### Key Refactorings:
- **Graph Builder Repair:** Updated [GraphBuilder.js](E:/NAST/Dazzling/GAS/dazzlingdb-tools/src/compiler/GraphBuilder.js) to resolve dependencies by checking schema `"relations"` blocks of type `"belongsTo"`. It now builds a populated directed relationship adjacency list in [dependency_graph.js](E:/NAST/Dazzling/GAS/DazzlingDB/Config/dependency_graph.js).
- **Linter Rule Upgrades:** Modified [ForwardRefRule.js](E:/NAST/Dazzling/GAS/dazzlingdb-tools/src/compiler/rules/ForwardRefRule.js) and [BackwardRefRule.js](E:/NAST/Dazzling/GAS/dazzlingdb-tools/src/compiler/rules/BackwardRefRule.js) to properly parse the `"relations"` block structure, validating target table existence, column mappings (for both ends of the relationship), and reverse reference symmetry.
- **Relational Symmetry Fixes:**
  - Swapped relationship directions from `hasOne` to `belongsTo` in child tables that physically hold the foreign keys: [Address.json](E:/NAST/Dazzling/GAS/DazzlingDB/Config/Schema/Students/Address.json), [ContactInfo.json](E:/NAST/Dazzling/GAS/DazzlingDB/Config/Schema/Students/ContactInfo.json), and [StudentFeeAccount.json](E:/NAST/Dazzling/GAS/DazzlingDB/Config/Schema/Finance/StudentFeeAccount.json).
  - Added missing reverse relationships (`hasMany` or `hasOne`) in the parent schemas (e.g. `batches` to `Teacher`, etc.) to clean up `BackwardRefWarning`s and enable bidirectional query traversals.
- **CLI Commands:** Integrated these schema updates into the CLI tool in [index.js](E:/NAST/Dazzling/GAS/dazzlingdb-tools/index.js) and [SchemaMigrationTools.js](E:/NAST/Dazzling/GAS/dazzlingdb-tools/src/compiler/SchemaMigrationTools.js) under:
  - `npm run fix-fk-types` (maps all relationship fields to `"type": "foreign_key"`).
  - `npm run fix-backward-refs` (automatically appends missing reverse relations to parent schemas).

---

## 2. Repository-Level Deletion Constraints

To prevent database corruption and orphaned records, we centralized delete-time constraint enforcement inside the repository layer using the compiled `DEPENDENCY_GRAPH`.

- **Strategy Pattern Integration:** Created a `DELETE_STRATEGIES` dictionary at the top of [DynamicRepository.js](E:/NAST/Dazzling/GAS/SheetDB/Repositories/DynamicRepository.js) mapping each policy to its execution handler:
  - `protect`: Queries the dependent repository using `count` and throws an `IntegrityError` if any matching records are found.
  - `cascade`: Programmatically retrieves all matching children and invokes `deleteMany`.
  - `set_null`: Retrieves all matching children and updates their foreign key fields to `null` using `updateMany`.
- **Latency Optimization:** Keeps constraint execution at the repository level rather than doing row-by-row model deletions. This allows us to call optimized batch operations (`deleteMany`, `updateMany`) on Google Sheets, completing cascades in a single API roundtrip.
- **Formalized Guidelines:** Updated [GEMINI.md](E:/NAST/Dazzling/GAS/GEMINI.md) coding standards to mandate the **Declarative Strategy Pattern / Mapping Registry** for multi-branch logic, and **Custom Error Handling** (requiring `IntegrityError` subclasses for referential blocks).

---

## 3. Active Record ORM Field-Level Refactoring

Previously, the `FieldMapper` used a generic `CharField` fallback for foreign key columns, and parent-key validation occurred in a separate `_validateRelational()` step during `BaseModel.save()`. We refactored this logic into the field layer.

- **`ForeignKeyField` Class:** Introduced a dedicated `ForeignKeyField` class in [Fields.js](E:/NAST/Dazzling/GAS/SheetDB/ORM/Fields.js) that inherits from `CharField` and encapsulates relational metadata (`target` table, `onDelete` policy, and polymorphic `typeField`).
- **FieldMapper & ModelRegistry Updates:** Updated [FieldMapper.js](E:/NAST/Dazzling/GAS/SheetDB/SchemaDriver/FieldMapper.js) to instantiate `ForeignKeyField` for `"foreign_key"` columns, and updated [ModelRegistry.js](E:/NAST/Dazzling/GAS/SheetDB/Registries/ModelRegistry.js) to enrich the field instances with relationship metadata.
- **Unified Validation Context:** Refactored [BaseModel.js](E:/NAST/Dazzling/GAS/SheetDB/ORM/BaseModel.js)'s `validate()` to pass the database facade and active model context `{ db, model }` directly to field validation rules.
- **Encapsulated Referential Integrity:** Moved the check verifying that a foreign key exists in the parent table's `PrimaryKeyCache` directly into the `ForeignKeyField.validate()` method.
- **Polymorphic & Casing Resolution:**
  - Resolved UUID casing mismatches by performing case-insensitive lookups on the cached primary keys.
  - Resolved polymorphic targets dynamically via the `PolymorphicRegistry` to prevent crashes when resolving lowercase table type codes (e.g. `'package'` to repository `'Package'`).

---

## 4. Refactoring and Testing Student Deletions

We standardized single-record and bulk student deletions to use our optimized `DELETE_STRATEGIES` engine rather than hand-coded service-level iterations.

- **`DeleteStudentAction`:** Defined a new single-student deletion action mapped to `"student_delete"` in [ApiDispatcher.js](E:/NAST/Dazzling/GAS/DazzlingDB/ApiDispatcher.js) and implemented in [ConcreteActions.js](E:/NAST/Dazzling/GAS/DazzlingDB/DBServices/ConcreteActions.js).
- **`DeleteManyStudentsAction`:** Refactored this bulk action in [ConcreteActionsX.js](E:/NAST/Dazzling/GAS/DazzlingDB/DBServices/ConcreteActionsX.js) to delegate cascading and protection checks to the ORM repository's `deleteMany()` and `enforceDeleteConstraints()` rather than hardcoding manual validation/cascade loops.
- **Integration Test Suites:**
  - [StudentRegistrationTests.js](E:/NAST/Dazzling/GAS/DazzlingDB/Test/StudentRegistrationTests.js): Tests the `RegisterStudentAction` in isolation to ensure that the student profile and related child tables are successfully registered with correct proportional financial splits.
  - [StudentDeleteTests.js](e:/NAST/Dazzling/GAS/DazzlingDB/Test/StudentDeleteTests.js): Completely rewritten from scratch to run a single, high-fidelity production-safe deletion protection scenario. It boots a mock curriculum, registers a student with complete financial data (Student, Address, ContactInfo, Education, Enrollment, BatchAllocation, StudentFeeAccount, Installment, Payment), attempts to delete the student, and asserts that deletion is blocked due to active payments/installments. It then performs a deep field-by-field database integrity check verifying that all 9 tables are 100% intact post-deletion attempt, followed by a bottom-up reverse-topological cleanup.
- **REST API Reference Documentation**: Documented the specialized `student_delete` REST API endpoint in [REST-api-doc.md](e:/NAST/Dazzling/GAS/DazzlingDB/REST-api-doc.md) (Section 3.B and Section 10), detailing its request/response structures and safety attributes.
