# SheetDB ORM & Infrastructure Reference

This directory serves as the centralized, compiled reference for the **SheetDB** module architecture, directory structure, and functional execution layers inside Google Apps Script (GAS).

---

## 1. Directory Tree & Module Map

Below is the directory layout of SheetDB. Each link points directly to the module source file:

*   **[SheetDB](e:/NAST/Dazzling/GAS/SheetDB/)**
    *   **[Api](e:/NAST/Dazzling/GAS/SheetDB/Api/)**
        *   [GenericActions.js](e:/NAST/Dazzling/GAS/SheetDB/Api/GenericActions.js) — Generic Action controllers mapping REST/RPC requests to basic CRUD persistences (`QueryAction`, `CreateRecordAction`, `UpdateRecordAction`, `DeleteRecordAction`).
    *   **[DataSource](e:/NAST/Dazzling/GAS/SheetDB/DataSource/)**
        *   [DataSource.js](e:/NAST/Dazzling/GAS/SheetDB/DataSource/DataSource.js) — The database driver wrapper interfacing directly with `SpreadsheetApp` and executing script-level transaction concurrency locking (`LockService`).
    *   **[Graph](e:/NAST/Dazzling/GAS/SheetDB/Graph/)**
        *   [DeletionValidationRegistry.js](e:/NAST/Dazzling/GAS/SheetDB/Graph/DeletionValidationRegistry.js) — Validates deletion graphs against relational policies before physical execution.
        *   [DynamicGraph.js](e:/NAST/Dazzling/GAS/SheetDB/Graph/DynamicGraph.js) — Memory-representation of relational rows as graph nodes and dependency edges.
        *   [DynamicGraphBuilder.js](e:/NAST/Dazzling/GAS/SheetDB/Graph/DynamicGraphBuilder.js) — Breadth-First Search (BFS) record hydrator building dependency networks for targeted record IDs in memory.
        *   [GraphEdge.js](e:/NAST/Dazzling/GAS/SheetDB/Graph/GraphEdge.js) — Representation of dynamic parent-child relational edges.
        *   [GraphNode.js](e:/NAST/Dazzling/GAS/SheetDB/Graph/GraphNode.js) — Stores collections of matching IDs and record structures.
        *   [StaticEdge.js](e:/NAST/Dazzling/GAS/SheetDB/Graph/StaticEdge.js) — Stores compile-time mapping boundaries (cardinality, target table, onDelete strategy).
        *   [StaticGraph.js](e:/NAST/Dazzling/GAS/SheetDB/Graph/StaticGraph.js) — Centralized static schema compilation map.
        *   [StaticNode.js](e:/NAST/Dazzling/GAS/SheetDB/Graph/StaticNode.js) — Static schema representation of a database table.
    *   **[ORM](e:/NAST/Dazzling/GAS/SheetDB/ORM/)**
        *   [BaseModel.js](e:/NAST/Dazzling/GAS/SheetDB/ORM/BaseModel.js) — Abstract BaseModel mapping row values to active records, coordinating validations, saves, and lifecycle callbacks.
        *   [Fields.js](e:/NAST/Dazzling/GAS/SheetDB/ORM/Fields.js) — Casts and sanitizes sheet cells to JS types. Implements `ForeignKeyField`, `CharField`, `IntegerField`, `FloatField`, `BooleanField`, `JSONField`, `DateTimeField`, `AutoField`. Handles formula CSV injections.
        *   [RelationResolver.js](e:/NAST/Dazzling/GAS/SheetDB/ORM/RelationResolver.js) — Mounts getter/setter properties to dynamically retrieve relational fields.
        *   **[Relations](e:/NAST/Dazzling/GAS/SheetDB/ORM/Relations/)**
            *   [BaseRelation.js](e:/NAST/Dazzling/GAS/SheetDB/ORM/Relations/BaseRelation.js) — Base relational schema configuration.
            *   [BelongsToPolymorphicRelation.js](e:/NAST/Dazzling/GAS/SheetDB/ORM/Relations/BelongsToPolymorphicRelation.js) — Direct polymorphic target mapper resolving models from `typeField`/`idField` configurations.
            *   [BelongsToRelation.js](e:/NAST/Dazzling/GAS/SheetDB/ORM/Relations/BelongsToRelation.js) — Resolves standard target parent models.
            *   [HasManyRelation.js](e:/NAST/Dazzling/GAS/SheetDB/ORM/Relations/HasManyRelation.js) — Resolves lists of downstream child records.
            *   [HasOneRelation.js](e:/NAST/Dazzling/GAS/SheetDB/ORM/Relations/HasOneRelation.js) — Resolves a single downstream child record.
    *   **[Registries](e:/NAST/Dazzling/GAS/SheetDB/Registries/)**
        *   [ModelRegistry.js](e:/NAST/Dazzling/GAS/SheetDB/Registries/ModelRegistry.js) — Centralized registry connecting model strings to active model classes.
        *   [PolymorphicRegistry.js](e:/NAST/Dazzling/GAS/SheetDB/Registries/PolymorphicRegistry.js) — Decodes polymorphic type strings (e.g. `"course"`) to model class keys (e.g. `"Course"`).
        *   [PrimaryKeyCache.js](e:/NAST/Dazzling/GAS/SheetDB/Registries/PrimaryKeyCache.js) — In-memory primary key storage to optimize relational lookups during validations.
        *   [Registries.js](e:/NAST/Dazzling/GAS/SheetDB/Registries/Registries.js) — Singleton exports wrapper.
        *   [ValidationRegistry.js](e:/NAST/Dazzling/GAS/SheetDB/Registries/ValidationRegistry.js) — Lockable registry containing customized data field validators.
    *   **[Repositories](e:/NAST/Dazzling/GAS/SheetDB/Repositories/)**
        *   [BatchBucket.js](e:/NAST/Dazzling/GAS/SheetDB/Repositories/BatchBucket.js) — Unit of work transaction buffer capturing updates before commits.
        *   [DynamicRepository.js](e:/NAST/Dazzling/GAS/SheetDB/Repositories/DynamicRepository.js) — Persistence gateway managing model CRUD operations, cascade deletion validations, and bulk updates/deletions.
    *   **[SchemaDriver](e:/NAST/Dazzling/GAS/SheetDB/SchemaDriver/)**
        *   [Exports.js](e:/NAST/Dazzling/GAS/SheetDB/SchemaDriver/Exports.js) — Exports configuration schema models.
        *   [FieldMapper.js](e:/NAST/Dazzling/GAS/SheetDB/SchemaDriver/FieldMapper.js) — Maps schema JSON objects into instantiated Field classes.
        *   [SchemaInspector.js](e:/NAST/Dazzling/GAS/SheetDB/SchemaDriver/SchemaInspector.js) — Extracts relational schema properties.
        *   [SchemaSetupEngine.js](e:/NAST/Dazzling/GAS/SheetDB/SchemaDriver/SchemaSetupEngine.js) — Idempotent Google Sheets schema provisioner and repair planning engine.
        *   [SchemaValidator.js](e:/NAST/Dazzling/GAS/SheetDB/SchemaDriver/SchemaValidator.js) — Evaluates object properties against raw schema rules.
        *   [SpreadsheetFileSystem.js](e:/NAST/Dazzling/GAS/SheetDB/SchemaDriver/SpreadsheetFileSystem.js) — Integrates Google Drive folders and files, filtering by root parents, MIME types, and trash states.
        *   [Validate.js](e:/NAST/Dazzling/GAS/SheetDB/SchemaDriver/Validate.js) — Data type utility validation hooks.
        *   [temp.js](e:/NAST/Dazzling/GAS/SheetDB/SchemaDriver/temp.js) — Setup script references.
    *   **[TableGateway](e:/NAST/Dazzling/GAS/SheetDB/TableGateway/)**
        *   [TableGatway.js](e:/NAST/Dazzling/GAS/SheetDB/TableGateway/TableGatway.js) — Lower-level physical cell range mutations using private `__rowNumber` pointers and caching snapshots.
    *   **[Tests](e:/NAST/Dazzling/GAS/SheetDB/Tests/)**
        *   [test_academic_provisioning.js](e:/NAST/Dazzling/GAS/SheetDB/Tests/test_academic_provisioning.js) — Verification test verifying core academic structures.
        *   [test_batch_performance.js](e:/NAST/Dazzling/GAS/SheetDB/Tests/test_batch_performance.js) — Performance benchmark evaluating roundtrip write rates.
        *   [test_crud_operations.js](e:/NAST/Dazzling/GAS/SheetDB/Tests/test_crud_operations.js) — Verifies basic database insert, read, update, and remove functions.
        *   [test_schema_driver.js](e:/NAST/Dazzling/GAS/SheetDB/Tests/test_schema_driver.js) — Tests file creation and header validations.
    *   **[Validation](e:/NAST/Dazzling/GAS/SheetDB/Validation/)**
        *   [ValidationPipeline.js](e:/NAST/Dazzling/GAS/SheetDB/Validation/ValidationPipeline.js) — Chains validation routines.
        *   [ValidationRules.js](e:/NAST/Dazzling/GAS/SheetDB/Validation/ValidationRules.js) — Standard validators (regex, limits, choices).
    *   [Errors.js](e:/NAST/Dazzling/GAS/SheetDB/Errors.js) — Domain-specific base exceptions (`ValidationError`, `IntegrityError`).
    *   [Utils.js](e:/NAST/Dazzling/GAS/SheetDB/Utils.js) — Generic helper utilities.
    *   [index.js](e:/NAST/Dazzling/GAS/SheetDB/index.js) — Boots SheetDB context singletons.

---

## 2. Core Architectural Design Layers

SheetDB overrides the limitations of Google Sheets (statelessness, execution bounds, and lack of transaction management) using a multi-tiered architecture:

```
+---------------------------------------------------------------+
|                       API Routing Layer                       |
|           (ApiDispatcher.js / Action Controllers)              |
+------------------------------┬--------------------------------+
                               │
                               ▼
+---------------------------------------------------------------+
|                      Domain Services Layer                    |
|             (StudentService.js / StaffService.js)             |
+------------------------------┬--------------------------------+
                               │
                               ▼
+---------------------------------------------------------------+
|                         ORM Registry                          |
|             (BaseModel.js / ForeignKeyField / ORM)            |
+------------------------------┬--------------------------------+
                               │
                               ▼
+---------------------------------------------------------------+
|                      Repositories & Units                     |
|           (DynamicRepository.js / BatchBucket.js)             |
+------------------------------┬--------------------------------+
                               │
                               ▼
+---------------------------------------------------------------+
|                       Physical Data Access                    |
|           (TableGateway.js / SpreadsheetFileSystem.js)        |
+---------------------------------------------------------------+
```

### 1. Script Locking & Concurrency Control
Stateless Google Apps Script threads executing writes can overwrite cell ranges. SheetDB encapsulates write procedures with an automatic script locking pattern:
*   Uses a `_withLock(fn)` helper utilizing GAS `LockService.getScriptLock()`.
*   Blocks subsequent execution paths for up to 10 seconds.
*   Guarantees lock release inside a `finally` block to prevent deadlock states.

### 2. Surgical Row Indexing (`__rowNumber`)
Physical row deletion shifts spreadsheet indexes. SheetDB reads tables in single passes and injects the row reference in a private `__rowNumber` field:
*   Allows $O(1)$ updates using targeted cell ranges: `sheet.getRange(rowNumber, col, 1, width)`.
*   Saves database runtime from slow linear table lookups.
*   Triggers cache flushes immediately on deletion to prevent outdated indexing conflicts.

### 3. Relational Mapping & Bidirectional Graphing
Google Sheets has no relational keys or cascades. SheetDB solves this via:
*   **Forward Relations (`belongsTo`, `belongsToPolymorphic`):** Checked using the request-level `PrimaryKeyCache` during inserts/updates.
*   **Backward Relations (`hasMany`, `hasOne`):** Checked during deletions. Uses a centralized `DELETE_STRATEGIES` dictionary mapping policies (`protect`, `cascade`, `set_null`) to repository functions.
*   **Topological Sorting:** Dynamic dependency graphs are sorted leaf-first (leaves deleted first, parents last) during cascade deletions, avoiding referential check violations.

### 4. Transactions, Buckets & Surgical Rollbacks
SheetDB tracks multi-table updates using an in-memory `BatchBucket` and UUID transaction IDs (`__tx_id`):
*   Validates properties against `SchemaValidator` before commits.
*   Pipes records in correct topological insert order (parents before children).
*   Implements surgical rollback: if any insertion fails, it removes pending records using criterion `DELETE WHERE __tx_id = failed_uuid`. This approach prevents database corruption from partial write sequences.
