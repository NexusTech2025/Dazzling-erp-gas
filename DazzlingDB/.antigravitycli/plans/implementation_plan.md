# Implementation Plan - Phase 2 (SheetDB Database Engine Upgrades)

This implementation plan details the architectural designs, protocols, and class schemas for the SheetDB Database Engine upgrades. The goal is to build a robust, self-validating, and high-performance database foundation that handles complex associations, enforces integrity, and provides rich validation diagnostics.

---

## User Review Required

> [!IMPORTANT]
> The upgrades in Phase 2 introduce the following changes:
> 1. **Polymorphic Traversal & Validation:** Requires declaring relations as `belongsToPolymorphic` in the JSON schemas (e.g. `Enrollment.json` and `PackageItem.json`).
> 2. **Aggregated Field Validations:** Field validations will no longer throw fail-fast errors on individual fields. Instead, `BaseModel.validate()` will return all validation errors across all fields in a single consolidated `ValidationError`.
> 3. **Manual Override Security:** Prevents manual overrides on `type: "auto"` fields during record insertion unless bypassed via database configuration (`allowAutoOverride: true`).
> 4. **Production-Grade Custom Validator Registry:** Implements locked immutability, bulk registration (`registerMany`), and robust typing checks with custom errors.

---

## Architectural Design & Protocols

### 1. Unified Validation & Write Flow (Data Lifecycle)

Below is the logical flow diagram illustrating how a record is validated, relationship-checked, and written to Google Sheets:

```
      +----------------------------------------------------+
      |                  BaseModel.save()                  |
      +-------------------------+--------------------------+
                                |
                                v
      +----------------------------------------------------+
      |            BaseModel.validate() (Tier 1,2,4)       |
      |   (Runs each Field's validation rule pipeline)     |
      +-------------------------+--------------------------+
                                |
                                v
      +----------------------------------------------------+
      |       BaseModel._validateRelational() (Tier 3)     |
      |     (Verifies FKs & Polymorphic references using   |
      |             the PrimaryKeyCache Set)               |
      +-------------------------+--------------------------+
                                |
                                v
      +----------------------------------------------------+
      |             Blocked Override Check                 |
      |  (Blocks manual inputs on AutoFields if isNew)     |
      +-------------------------+--------------------------+
                                |
                                v
      +----------------------------------------------------+
      |               Persist to TableGateway              |
      |       (Invalidates & syncs PrimaryKeyCache)        |
      +----------------------------------------------------+
```

---

### 2. Code Contracts & APIs

#### A. PolymorphicRegistry Protocol
`PolymorphicRegistry` is a global mapping registry to translate logical shorthand types to table/sheet entities.

```typescript
interface PolymorphicRegistry {
  register(typeCode: string, targetTable: string): void;
  resolve(typeCode: string): string; // Returns target table name, throws if missing
  has(typeCode: string): boolean;
  clear(): void;
}
```

#### B. PrimaryKeyCache Protocol
`PrimaryKeyCache` stores the set of physical primary keys for each table to enable fast relationship validations.

```typescript
class PrimaryKeyCache {
  constructor(db: Object);
  get(tableName: string): Set<string>; // Lazily loads from spreadsheet if cache miss
  add(tableName: string, id: string): void;
  remove(tableName: string, id: string): void;
  invalidate(tableName: string): void;
  clear(): void;
}
```

#### C. ValidationRegistry Protocol (Production-Grade)
Manages custom callback registration, checking type constraints, double registration warnings, and locking behavior.

```typescript
interface ValidationRegistry {
  register(name: string, handlerFn: Function): void;
  registerMany(handlers: Record<string, Function>): void;
  execute(name: string, value: any): any; // Executes under try-catch; wraps errors
  get(name: string): Function | undefined;
  has(name: string): boolean;
  lock(): void; // Lock registry to prevent runtime tampering
  unlock(): void;
  clear(): void;
}
```

#### D. ValidationRule & Pipeline Contracts
`ValidationRule` instances are stateless rule declarations that evaluate field constraints.

```typescript
class ValidationRule {
  validate(value: any, fieldName: string): string | null; // Returns error message or null
}

class ValidationPipeline {
  constructor(fieldName: string);
  addRule(rule: ValidationRule): this;
  validate(value: any): FieldError[]; // Aggregates and returns all failures
}
```

---

## Proposed Changes

### Component 1: Custom Errors & System Safety

#### [MODIFY] [Errors.js](file:///e:/NAST/Dazzling/GAS/SheetDB/Errors.js)
Introduce validation registry exception classes:
- `ValidationRegistryError`: Base class.
- `ValidationRegistryLockedError`: Thrown on attempts to write to the locked registry.
- `ValidatorRegistrationError`: Thrown on invalid registration parameters.
- `ValidatorNotFoundError`: Thrown on references to unregistered validator names.
- `ValidatorExecutionError`: Thrown on runtime exceptions caught during execution.

---

### Component 2: Validation Rules & Engine

We will introduce a decoupled validation rules system under a new folder: [NEW] [SheetDB/Validation/](file:///e:/NAST/Dazzling/GAS/SheetDB/Validation/)

#### [NEW] [ValidationRules.js](file:///e:/NAST/Dazzling/GAS/SheetDB/Validation/ValidationRules.js)
Define standard stateless rules:
- `RequiredRule`: Verifies values are non-empty.
- `MaxLengthRule(max)`: Limits string lengths.
- `MinLengthRule(min)`: Enforces minimum string lengths.
- `MinRule(min)`: Enforces minimum numeric values.
- `MaxRule(max)`: Enforces maximum numeric values.
- `ChoiceRule(choices)`: Checks values against whitelist options.
- `RegexRule(pattern)`: Tests string pattern matching.
- `CustomCallbackRule(handlerName)`: Executes callbacks registered in `ValidationRegistry`.
- `FunctionalCallbackRule(fn)`: Executes anonymous callback functions.

#### [NEW] [ValidationPipeline.js](file:///e:/NAST/Dazzling/GAS/SheetDB/Validation/ValidationPipeline.js)
Define `ValidationPipeline` to group rules and run them sequentially, collecting all failures instead of stopping on the first error.

#### [MODIFY] [Fields.js](file:///e:/NAST/Dazzling/GAS/SheetDB/ORM/Fields.js)
- Update `BaseField` and subclasses to compile rules during construction:
  - `BaseField` compiles `RequiredRule`, `ChoiceRule`, and functional `validators`.
  - `CharField` compiles `MaxLengthRule` and `MinLengthRule`.
  - `IntegerField` compiles `MinRule` and `MaxRule`.
- Update `BaseField.prototype.validate(value)` to execute the compiled pipeline and return an array of `FieldError` objects.

---

### Component 3: Models & Relation Parsing

#### [MODIFY] [BaseModel.js](file:///e:/NAST/Dazzling/GAS/SheetDB/ORM/BaseModel.js)
- **Aggregated Field Error Collection:**
  - Update `BaseModel.prototype.validate()` to execute `field.validate(value)` for each field, gathering all returned `FieldError` elements, and raising a unified `ValidationError` at the end.
- **Relational & Polymorphic Validation:**
  - Add `BaseModel.prototype._validateRelational()` to inspect all relationships (including polymorphic associations) and verify foreign keys exist in the `PrimaryKeyCache`.
- **Manual Override Block check:**
  - Update the write pipeline within `BaseModel.prototype.save()` to scan fields. If a field is an `AutoField` and the record is new, raise a `ValidationError` if a manual ID is supplied, unless `allowAutoOverride: true` is configured.
- **Detailed Logging:**
  - Add detailed logging using `console.log` and `console.error` specifying tables, fields, and error context.

#### [MODIFY] [RelationResolver.js](file:///e:/NAST/Dazzling/GAS/SheetDB/ORM/RelationResolver.js)
- Implement `belongsToPolymorphic` relation type resolving. It reads the dynamic type column from the source model, maps it to the target table via `PolymorphicRegistry`, and queries the corresponding repository.

---

### Component 4: Registries & Caching

#### [MODIFY] [ValidationRegistry.js](file:///e:/NAST/Dazzling/GAS/SheetDB/Registries/ValidationRegistry.js)
- Implement production-grade locking state checks.
- Add `registerMany(handlers)` for bulk registrations.
- Throw custom `ValidationRegistryLockedError`, `ValidatorRegistrationError`, `ValidatorNotFoundError`, and `ValidatorExecutionError` exceptions.

#### [NEW] [PolymorphicRegistry.js](file:///e:/NAST/Dazzling/GAS/SheetDB/Registries/PolymorphicRegistry.js)
- Implement `PolymorphicRegistry` to maintain type mappings.

#### [NEW] [PrimaryKeyCache.js](file:///e:/NAST/Dazzling/GAS/SheetDB/Registries/PrimaryKeyCache.js)
- Implement `PrimaryKeyCache` for primary-key loading and operations.

#### [MODIFY] [index.js](file:///e:/NAST/Dazzling/GAS/SheetDB/index.js)
- Initialize `PolymorphicRegistry` and `PrimaryKeyCache`.
- Instantiate `PrimaryKeyCache` during `init()` and bind it to the `db` facade.
- Pass `db` or `PrimaryKeyCache` to `TableGateway` to allow cache sync on writes.
- Export new registries, errors, and rules to global namespace.

#### [MODIFY] [TableGatway.js](file:///e:/NAST/Dazzling/GAS/SheetDB/TableGateway/TableGatway.js)
- Accept the `db` facade in constructor.
- Update `insert()`, `insertBatch()`, and `remove()` to update the `db._pkCache` directly.

#### [MODIFY] [DynamicRepository.js](file:///e:/NAST/Dazzling/GAS/SheetDB/Repositories/DynamicRepository.js)
- Ensure all save/delete operations correctly flow through TableGateway to sync the cache.

#### [MODIFY] [BatchBucket.js](file:///e:/NAST/Dazzling/GAS/SheetDB/Repositories/BatchBucket.js)
- Refactor `_buildValidationContext()` to load parent PKs directly from the `db._pkCache`.
- Update logic to dynamically determine parent tables for polymorphic relationships.

#### [MODIFY] [SchemaValidator.js](file:///e:/NAST/Dazzling/GAS/SheetDB/SchemaDriver/SchemaValidator.js)
- Update `validateRelational` to validate polymorphic relationships against resolved tables in the validation context.

---

### Component 5: Application Context Setup

#### [MODIFY] [Code.js](file:///e:/NAST/Dazzling/GAS/DazzlingDB/Code.js)
- Add a setup hook `registerPolymorphicMappings()` to configure standard type mappings:
  - `"course"` -> `"Course"`
  - `"package"` -> `"Package"`
  - `"subject"` -> `"Course"`
- Wire `registerPolymorphicMappings()` to load on bootstrapping and DB initialization.
- Call `ValidationRegistry.lock()` after database configuration completes.

---

## Verification Plan

### 1. Automated Unit & Integration Tests (Report only - no auto execution)
We will add diagnostic tests in `SheetDB/Tests/` to verify:
- **Pipeline Validation:** Asserts that multiple field validation errors are gathered and returned in a single exception.
- **Relational & Polymorphic Validation:** Simulates valid and invalid relationships to verify `PrimaryKeyCache` correctly permits valid IDs and blocks mismatched IDs.
- **Override Blocker:** Verifies manual ID inserts on `AutoField` throw unless bypassed.
- **Validation Registry Locks & Custom Errors:** Verifies attempts to add validators runtime after locking throws `ValidationRegistryLockedError`, and bad registrations throw `ValidatorRegistrationError`.

### 2. Manual Execution Steps
1. Push modifications manually to Google Apps Script.
2. Execute the database test suite in the Apps Script console.
3. Review console output to verify log details indicating validation phases and cache synchronization.
