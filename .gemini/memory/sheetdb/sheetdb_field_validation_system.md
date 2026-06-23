# SheetDB — Field System, Validation System & Graph Algorithm Reference

> **Session:** 2026-06-17 | Scope: SheetDB Field System · Validation Pipeline · Insertion Flow · Graph-Based Deletion
> **Source files analyzed:** `SheetDB/ORM/Fields.js`, `SheetDB/Validation/ValidationRules.js`, `SheetDB/Validation/ValidationPipeline.js`, `SheetDB/Graph/*`, `SheetDB/Repositories/DynamicRepository.js`, `SheetDB/TableGateway/TableGatway.js`, `SheetDB/ORM/BaseModel.js`, `SheetDB/Errors.js`, `SheetDB/Registries/ValidationRegistry.js`

---

## 1. Field System (SheetDB/ORM/Fields.js)

The Field System is the **type-safe value gateway** between raw Google Sheets cell values and JavaScript runtime types. Every column in a model is described by a `Field` subclass.

### 1.1 Class Hierarchy

```
BaseField
├── CharField          — String columns; escapes formula injection (=, +, -, @)
│   └── ForeignKeyField — Relational FK column; extends CharField with referential checks
├── IntegerField       — parseInt() with min/max range rules
├── FloatField         — parseFloat() with range rules
├── BooleanField       — Normalizes truthy/falsy strings ("true","1","yes","y")
├── JSONField          — JSON.parse / JSON.stringify <-> sheet string
├── DateTimeField      — ISO Date string handling; autoNow / autoNowAdd support
└── AutoField          — Auto-generates UUID-prefix PKs (e.g. "ID-A3F9B2")
```

### 1.2 BaseField Contract

Every Field instance owns a `ValidationPipeline` compiled in `_compilePipeline()` during construction.

| Option | Pipeline Rule Compiled |
|---|---|
| `required: true` (default) | `RequiredRule` |
| `choices: [...]` | `ChoiceRule` |
| `validators: [fn]` | `FunctionalCallbackRule` per fn |
| `validations: [{rule:"regex", pattern}]` | `RegexRule` |
| `validations: [{rule:"custom", handler}]` | `CustomCallbackRule` |

Core interface:
- `field.fromSheetValue(raw)` — Sheet cell -> JS type (reads)
- `field.toSheetValue(value)` — JS type -> Sheet-safe value (writes)
- `field.validate(value, ctx)` — Returns FieldError[] (empty = valid)

### 1.3 Key Field Behaviors

**CharField**
- `toSheetValue`: Prepends `'` to any value starting with `=`, `+`, `-`, `@` to prevent formula injection.
- `fromSheetValue`: Casts to `String`.
- Additional pipeline rules: `MaxLengthRule`, `MinLengthRule`.

**IntegerField / FloatField**
- `fromSheetValue`: Strict `parseInt` / `parseFloat`; returns `null` on `NaN`.
- Pipeline: `MinRule`, `MaxRule`.

**BooleanField**
- `required` forced to `false` (booleans are rarely truly "missing").
- Normalizes sheet truthy strings: `["true","1","yes","y"]`.
- `toSheetValue`: Returns native JS `boolean`.

**JSONField**
- `toSheetValue`: `JSON.stringify(value)` stored as text in cell.
- `fromSheetValue`: `JSON.parse(val)` wrapped in try/catch; falls back to `{}`.

**DateTimeField**
- Uses the cross-realm-safe `isDate()` utility from `Utils.js` instead of `instanceof Date`.
- `autoNow: true` — always updates timestamp on every `toSheetValue` call.
- `autoNowAdd: true` — stamps only when no value is provided (creation-only).
- Returns ISO string to the sheet.

**AutoField**
- Forces `primaryKey: true`, `required: false`.
- `toSheetValue`: If value is empty -> generates `"{prefix}-{UUID_SEGMENT}"` using `Utilities.getUuid()`.

**ForeignKeyField** (extends CharField)
- Stores `target`, `onDelete`, `typeField`, `mapping`.
- **Target Resolution:**
  - Standard: reads `this.target` directly.
  - Polymorphic (`target === "polymorphic"`): reads `model[typeField]`, resolves via `this.mapping` dict or falls back to `PolymorphicRegistry`.
- **Validation:** After CharField checks, performs O(1) lookup against `db._pkCache.get(targetTable)` (case-insensitive: original / UPPER / lower).
- Throws `FieldError` with message `"Foreign Key Mismatch: ID '...' not found in parent table '...'."`
- If no `db` context is available (offline test), skips relational check silently.

---

## 2. Validation System

### 2.1 ValidationRule Catalogue (ValidationRules.js)

All validation is stateless. Each rule: `validate(value, fieldName, context) -> string|null`

| Class | Purpose | Null-passthrough |
|---|---|---|
| `RequiredRule` | Blocks null/undefined/"" | No |
| `MaxLengthRule(max)` | String max character count | Yes |
| `MinLengthRule(min)` | String min character count | Yes |
| `MinRule(min)` | Numeric floor | Yes |
| `MaxRule(max)` | Numeric ceiling | Yes |
| `ChoiceRule(choices)` | Whitelist enforcement | Yes |
| `RegexRule(pattern)` | Regex pattern match | Yes |
| `CustomCallbackRule(handlerName)` | Invokes `ValidationRegistry.execute()` | Yes |
| `FunctionalCallbackRule(fn)` | Direct function call | Yes |

> **Null-passthrough = Yes** means the rule returns `null` early if the value is empty (allows optional fields to skip constraint rules).

### 2.2 ValidationPipeline (ValidationPipeline.js)

Aggregator that runs multiple rules sequentially against one field value.
- `addRule(rule)` — validates rule is `instanceof ValidationRule`
- `validate(value, ctx)` — iterates all rules, wraps exceptions in `FieldError`, returns full `FieldError[]` (not fail-fast).

### 2.3 ValidationRegistry (Registries/ValidationRegistry.js)

Singleton IIFE registry for named custom validators.
- `register(name, fn)` — register by name string
- `registerMany({name: fn})` — batch register
- `execute(name, value, ctx)` — invoke safely; throws `ValidatorNotFoundError` or `ValidatorExecutionError`
- `lock()` / `unlock()` — post-boot lock to prevent runtime tampering
- `clear()` — blocked if locked

### 2.4 Validation Tiers (invoked inside model.validate())

1. **Required** — `RequiredRule`
2. **Length / Range** — `MaxLengthRule`, `MinLengthRule`, `MinRule`, `MaxRule`
3. **Choice / Pattern** — `ChoiceRule`, `RegexRule`
4. **Custom** — `CustomCallbackRule` (registry), `FunctionalCallbackRule` (inline fn)
5. **Relational (FK)** — `ForeignKeyField.validate()` -> `db._pkCache` lookup

---

## 3. Insertion Flow

### 3.1 Single Insert

`db.Entity.insert(payload)`
1. `new ModelClass(payload, { gateway, registry, resolver })`
   - `schema[field].fromSheetValue(raw)` for each field
   - `_injectRelations()` — mount dynamic relation getter methods
2. `instance.save()`
   - `validate()` — run all field pipelines
   - `toDatabaseRow()` — `field.toSheetValue()` per field (triggers AutoField PK gen + DateTimeField stamps)
   - `_isNew === true` → `_performInsert(rowData)`
   - `gateway.insert(rowData)` → `_mapObjectToRow()` → `dataSource.insertRows()`
   - `pkCache.add(tableName, newId)`
   - `_isNew = false` — state transition

### 3.2 Nested Insert (insertOne — MongoDB-style)

Parent inserted first to generate PK. Then for each nested relation:
1. `item[relDef.foreignKey] = parentPkValue` — FK auto-injected
2. `targetRepo.insert(item)` — recursive insertion

### 3.3 Batch Insert (insertMany)

Uses `BatchBucket` to buffer writes:
1. **Phase 1 (Memory):** Validate + serialize all parent and child rows grouped by table.
2. **Phase 2 (Disk):** `bucket.execute()` — parents written first, children after (topological order).
3. **Phase 3:** Hydrate and return parent `BaseModel[]`.

---

## 4. Graph Algorithm — Deletion System

### 4.1 Two-Graph Architecture

| Graph | When Built | Contents |
|---|---|---|
| `StaticGraph` | Once at first deletion; cached on `db._staticGraph` | Table nodes + schema-defined relationship edges — no record data |
| `DynamicGraph` | Per delete operation, per root record | Hydrated record nodes (GraphNode) + live FK edges (GraphEdge) |

### 4.2 StaticGraph Compilation (StaticGraph.js / StaticGraphBuilder.js)

`StaticGraphBuilder.compile(schema)` — two phases:

**Phase 1 — Node Registration:** All tables across all schema categories added as `StaticNode`.

**Phase 2 — Edge Compilation:**
- `belongsTo` → parent = `rel.target`, child = `currentTable`
- `hasMany` / `hasOne` → parent = `currentTable`, child = `rel.target`
- `belongsToPolymorphic` → each mapping entry creates a separate parent→child edge
- `onDelete: "do_nothing"` edges are SKIPPED (not added to graph)
- Strict referential integrity: both tables must exist in schema; FK column must exist in child's columns block
- Duplicate edges suppressed

Result: directed `parent → child` edges labelled with `foreignKey` and `onDelete` policy.

### 4.3 DynamicGraph Hydration (DynamicGraphBuilder.js)

BFS traversal from root record:
1. Create `GraphNode(rootEntity, rootId, rootRecord, 'single')`
2. BFS queue — for each current node:
   - Get `staticNode` from `staticGraph`
   - For each outgoing `staticEdge`:
     - `queryDelegate(child_table, fk, parentId)` → child records
     - If `hasMany`: group into `GraphNode('grouped')`, dedup via `findNodeContaining()`
     - If `hasOne`: individual `GraphNode('single')`
     - Create `GraphEdge(currentNode, childNode, fk, onDelete)`
     - Add child to BFS queue if not already visited

**Cycle protection:** `findNodeContaining()` scans existing nodes before creating new ones. Already-mapped records are linked but not re-queued.

### 4.4 DeletionValidationRegistry — Strategy Pattern

| Strategy | Behavior |
|---|---|
| `protect` | Child NOT in `deleteNodeKeys` → throws `IntegrityError` |
| `cascade` | Child must BE in `deleteNodeKeys` → throws `IntegrityError` if missing |
| `set_null` | Checks FK field is not `required:true`; also checks polymorphic `typeField` nullability |
| `do_nothing` | No-op |

`DeletionValidationRegistry.validate(graph, rootEntity, rootId, globalDeleteNodeKeys?)`:
1. BFS to collect cascade-reachable keys into `deleteNodeKeys`
2. For each graph edge where `fromNode` is in `deleteNodeKeys` → dispatch registered strategy
3. `globalDeleteNodeKeys` (batch mode) overrides local set to prevent false-positives

### 4.5 Single Delete Flow (DynamicRepository.remove(id))

`remove(id)`
  → `enforceDeleteConstraints(id)`
    1. Lazy-compile `StaticGraph` if not cached
    2. `findById(id)` — fetch root record
    3. `DynamicGraphBuilder.build(entity, id, record)` — hydrate dynamic graph
    4. `DeletionValidationRegistry.validate(graph, entity, id)` — DRY-RUN
    5a. set_null edges → `targetRepo.updateMany({childId: {fk: null}})`
    5b. cascade nodes → reverse topological sort → `targetRepo.gateway.deleteMany(childIds)`
  → `gateway.remove(id)` — physical root row deletion
    → `dataSource.deleteRow(category, table, __rowNumber)`
    → `pkCache.remove(tableName, id)`

### 4.6 Batch Delete Flow (DynamicRepository.deleteMany(ids))

6-stage process inside `enforceDeleteConstraintsBatch(ids, { dryRun, failFast })`:

| Stage | Action |
|---|---|
| **1. Dedup & Pre-filter** | O(1) check against `pkCache.get(entity)` → skip non-existent IDs |
| **2. Pre-load** | Discover descendant tables via StaticGraph BFS; load ALL rows into `loadedTables` (1 read/table) |
| **3a. Build Graphs** | `DynamicGraphBuilder.build()` per parent ID using in-memory delegate (no Sheets I/O) |
| **3b. Aggregate keys** | Pre-scan all graphs → build `globalDeleteNodeKeys` union Set |
| **3c. Validate** | `DeletionValidationRegistry.validate()` per ID with global keys |
| **4. Set-null updates** | Aggregate `updatesByTable` → `targetRepo.updateMany()` per table (bulk, 1 write/table) |
| **5. Cascade deletes** | Sort descendant tables topologically (leaf-first) → `targetRepo.gateway.deleteMany()` per table |
| **6. Rollback (on error)** | Re-insert deleted rows (parents first) from `loadedTables` snapshots + restore nullified FKs |

After completion, `deleteMany` calls `gateway.deleteMany(manifest.deleted)` to delete the parent root rows.

### 4.7 Topological Sort (DynamicGraph.topologicalSort())

Post-order DFS: recurse into outgoing child edges first, then push current node. Yields **leaf-first** order — children are deleted before parents during cascade operations.

### 4.8 Physical Batch Deletion (DataSource level)

`SheetDataSource.deleteRowsBatch(category, table, pk, ids)`:
1. **Lock** — `LockService.getScriptLock()`
2. **Single read** — `sheet.getDataRange().getValues()` → 2D array into RAM
3. **In-memory filter** — `Set(ids)` for O(1) matching; keep non-matching rows in `remainingRows`
4. **Two-call write** — `clearContent()` on data range + `setValues(remainingRows)`
   - Result: O(1) read + O(1) write instead of O(N) individual deletions

---

## 5. Error Hierarchy

```
SheetDBError (base)
├── SpreadsheetNotFoundError
├── TableNotFoundError
├── EntityNotFoundError
├── ValidationError
│   └── FieldError (fieldName, value)
├── ConflictError
├── IntegrityError             <- raised by protect strategy
├── ForbiddenError
├── BatchDeleteError
├── ValidationRegistryError
│   ├── ValidationRegistryLockedError
│   ├── ValidatorRegistrationError
│   ├── ValidatorNotFoundError
│   └── ValidatorExecutionError
├── RelationError
│   ├── RelationResolutionError
│   └── RelationValidationError
└── SystemError
    └── DependencyGraphError   <- raised when StaticGraph is missing
```

---

## 6. Key Cross-Cutting Rules

1. **Always use `isDate(val)`** (Utils.js) instead of `instanceof Date` — GAS cross-realm boundary makes `instanceof` unreliable for Date objects.
2. **ForeignKeyField skips validation** when `db` context is absent (`!db || !db._pkCache`). Intentional for offline testing.
3. **StaticGraph is lazily compiled** once and cached on `db._staticGraph`. Reused for all subsequent deletes in the session.
4. **`globalDeleteNodeKeys`** in batch mode prevents false-positive `protect` errors: a child being cascade-deleted by a sibling parent is pre-added to the global deletion set.
5. **`loadedTables`** snapshots all affected table data before any mutation — enables surgical rollback without re-reading from Sheets.
6. **PrimaryKeyCache** synchronized on every insert (`pkCache.add`) and delete (`pkCache.remove`). FK validation reads from this O(1) cache, not the spreadsheet.
7. **`_isNew` flag** controls insert vs update routing in `BaseModel.save()`. Set to `false` after successful insert; `false` when records are hydrated from DB.
8. **Formula injection escaping** in `CharField.toSheetValue()`: any string starting with `=`, `+`, `-`, `@` is prefixed with `'` to prevent Google Sheets formula evaluation.
