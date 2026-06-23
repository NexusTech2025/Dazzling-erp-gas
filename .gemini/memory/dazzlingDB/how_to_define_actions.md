# How to Define Actions in DazzlingDB

This document defines the strict architectural rules, lifecycle contracts, and structural patterns for writing new API Action handlers in DazzlingDB. All rules are derived from the existing production codebase.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Client POST Request (JSON body)                                │
│  { action: "domain_verb", payload: {...}, token: "..." }        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  ApiDispatcher.dispatch(e)                                       │
│  1. _parseEvent(e) → params object                              │
│  2. Route action key → Registry (Standard / Admin / Sheet)      │
│  3. Resolve user context via AuthBridge                         │
│  4. Construct requestContext                                    │
│  5. new ActionClass() → action.run(requestContext)              │
│  6. _processGatewayAction() intercepts Generic CRUD results     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  BaseAction.run(requestContext)  [Template Method]              │
│  1. Bind actionType + mutationManifest to requestContext        │
│  2. Bind this._params, this._user, this._db                    │
│  3. Call this._validate()                                       │
│  4. Call this._authorize()                                      │
│  5. Call this.handle(requestContext) → dataPayload              │
│  6. Call this.formatSuccessResponse(dataPayload, ...)           │
│  [On error] → this.formatFailureResponse(error, ...)           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Action Categories

DazzlingDB actions fall into **four** structural categories:

| Category | Pattern | Example |
|---|---|---|
| **Service-Delegating** | Delegates to a domain service (e.g., `StudentService`) | `RegisterStudentAction` |
| **Direct ORM** | Uses `this._db` directly inside `handle()` | `DeleteStudentAction`, `AdminPeekDataAction` |
| **Generic CRUD** | Returns `{ isGenericCrudResult: true, payload: {...} }` for gateway interception | `CreateRecordAction`, `UpdateRecordAction` |
| **Bulk Delete (Subclass)** | Extends `DeleteManyRecordsAction` with cascade/restrict hooks | `DeleteManyUsersAction`, `DeleteManyEnrollmentsAction` |

---

## 3. BaseAction Class Contract

**Source:** [BaseActions.js](e:/NAST/Dazzling/GAS/DazzlingDB/DBServices/BaseActions.js)

### 3.1 Constructor

```javascript
constructor(actionType)
```

| Parameter | Type | Description |
|---|---|---|
| `actionType` | `ActionType` enum | One of `CREATE`, `UPDATE`, `DELETE`, `QUERY`. Determines CQS envelope behavior. |

**Rules:**
- Must call `super(ActionType.TOKEN)` exactly once.
- Invalid tokens throw `SystemError` at boot time.
- The constructor auto-derives `this._actionName` from the class name by stripping `"Action"` suffix and lowercasing.

### 3.2 Instance Properties (Auto-Bound by `run()`)

These are populated automatically during `run(requestContext)`. **Do NOT set them in the constructor.**

| Property | Type | Source | Description |
|---|---|---|---|
| `this._params` | `Object` | `requestContext.params` | Merged query + POST body parameters. Contains `action`, `payload`, `token`, `options`, etc. |
| `this._user` | `Object\|null` | `requestContext.user` | Resolved user context from `AuthBridge.resolveContext(token)`. `null` if no token. |
| `this._db` | `Object` | `requestContext.db` | The `DBContext` singleton. Access repositories via `this._db.Student`, `this._db.Enrollment`, etc. |

---

## 4. Lifecycle Methods (Override Points)

### 4.1 `_validate()` — Input Validation

```javascript
// Input:  None (reads from this._params)
// Output: void (throws on failure)
// Called: Before _authorize() and handle()
```

**Purpose:** Validate that all required parameters exist and are structurally correct before any business logic executes.

**Rules:**
- Use `this._requireParam("paramName")` for top-level required fields.
- For nested field checks, read from `this._params.payload` and throw `ActionValidationError` with a descriptive message.
- **Never** access `this._db` or perform database reads inside `_validate()`. This method is purely structural.

**Patterns observed in codebase:**

```javascript
// Pattern A: Simple payload presence check
_validate() {
  this._requireParam("payload");
}

// Pattern B: Nested field validation
_validate() {
  this._requireParam("payload");
  const p = this._params.payload;
  if (!p.student_id || !p.course_id) {
    throw new ActionValidationError("payload must contain 'student_id' and 'course_id'.");
  }
}

// Pattern C: Multi-field deep validation
_validate() {
  this._requireParam("payload");
  const p = this._params.payload;
  if (!p.leadData) {
    throw new ActionValidationError("payload must contain 'leadData'.");
  }
  if (!p.leadData.student_name) {
    throw new ActionValidationError("leadData must contain 'student_name'.");
  }
}

// Pattern D: Array structure validation
_validate() {
  this._requireParam("payload");
  if (!this._params.payload || !Array.isArray(this._params.payload.targets)) {
    throw new ActionValidationError("'payload.targets' must be an array of table names.");
  }
}
```

---

### 4.2 `_authorize()` — Access Control

```javascript
// Input:  None (reads from this._user)
// Output: void (throws on failure)
// Called: After _validate(), before handle()
```

**Purpose:** Enforce role-based or resource-based access restrictions.

**Rules:**
- Default implementation is a no-op (open access).
- Throw `ActionAuthorizationError` for role failures.
- Throw `SheetDB.ForbiddenError` for system-level access blocks.

**Patterns observed in codebase:**

```javascript
// Pattern A: Role-based admin guard
_authorize() {
  if (!this._user || this._user.role !== "admin") {
    throw new ActionAuthorizationError("Superadmin privileges required.");
  }
}

// Pattern B: Resource-level access check via AuthBridge
_authorize() {
  if (!AuthBridge.checkAccess(this._user, "Student")) {
    throw new ActionAuthorizationError("Access denied: You are not authorized to delete students.");
  }
}

// Pattern C: System state guard (bootstrap lock)
_authorize() {
  if (AuthBridge.isSystemInitialized()) {
    throw new SheetDB.ForbiddenError("System already initialized. Bootstrap disabled.");
  }
}
```

---

### 4.3 `handle(requestContext)` — Business Logic Execution

```javascript
// Input:  requestContext {Object}
//   - requestContext.params     → merged request parameters
//   - requestContext.db         → DBContext singleton
//   - requestContext.user       → resolved user (or null)
//   - requestContext.actionType → ActionType enum value
//   - requestContext.mutationManifest → mutable array for tracking writes
//   - requestContext.headers    → request headers object
//
// Output: {any} — The data payload to be wrapped by formatSuccessResponse()
//   - For QUERY actions: the raw query result (object, array, or primitive)
//   - For CREATE/UPDATE/DELETE actions: an object describing the result
//   - For Generic CRUD actions: { isGenericCrudResult: true, payload: {...} }
```

**Purpose:** Execute the core business logic. This is the **primary override point** for concrete actions.

**Rules:**
- **Always override either `handle()` or `_execute()`**, never both. The base `handle()` falls back to `this._execute()` if defined.
- Read parameters from `requestContext.params` (not `this._params`). Both point to the same object, but `requestContext` is the canonical source.
- For mutating operations, push PascalCase table names to `requestContext.mutationManifest`:
  ```javascript
  requestContext.mutationManifest.push("Student");
  ```
- The return value of `handle()` becomes the `"data"` field in the API response envelope.

**Patterns observed in codebase:**

```javascript
// Pattern A: Service delegation (most common)
handle(requestContext) {
  return StudentService.registerStudent(requestContext.params.payload, requestContext);
}

// Pattern B: Direct ORM with inline logic
handle(requestContext) {
  const { student_id, dryRun } = requestContext.params.payload;
  const student = this._db.Student.findById(student_id);
  if (!student) {
    throw new SheetDB.EntityNotFoundError("Student", student_id, "Academic");
  }
  // ... business logic ...
  return { success: true, message: "...", student_id };
}

// Pattern C: Static data return (health check, schema)
handle(requestContext) {
  return {
    status: "Online",
    timestamp: new Date().toISOString(),
    database: DATABASE_SCHEMA.database,
    version: DATABASE_SCHEMA.version
  };
}

// Pattern D: Composite logic with conditional side effects
handle(requestContext) {
  const p = requestContext.params.payload;
  const access = StudentService.checkAccessStatus(p.student_id, p.course_id);
  if (!access.allowed && access.isOverdue) {
    StudentService.suspendOverdueAccess(p.student_id, p.course_id, requestContext);
  }
  return access;
}
```

---

## 5. Response Envelope Contract

### 5.1 Success Envelope (auto-generated by `formatSuccessResponse`)

The return value from `handle()` is wrapped automatically. **Do NOT manually construct this envelope inside `handle()`.**

```json
{
  "success": true,
  "data": "<return value from handle()>",
  "context": {
    "execution_time_ms": 142,
    "mutated_records_count": 3,       // only for CREATE/UPDATE/DELETE
    "mutated_records": ["Student", "Address", "Enrollment"]  // only for CREATE/UPDATE/DELETE
  },
  "meta": {
    "environment": "DEVELOPMENT",
    "version": "2.0.0",
    "timestamp": "2026-06-20T14:00:00.000Z"
  }
}
```

**CQS Behavior:**
- `QUERY` actions: `context` contains only `execution_time_ms`. No mutation tracking.
- `CREATE/UPDATE/DELETE` actions: `context` includes `mutated_records_count` and `mutated_records`. A `_presentation` block is injected into the `data` object if it is a non-array object.

### 5.2 Failure Envelope (auto-generated by `formatFailureResponse`)

Errors are caught by `run()` and mapped via the `ErrorMappingRegistry`:

```json
{
  "success": false,
  "error": {
    "code": "ACTION_VALIDATION_FAILURE",
    "message": "payload must contain 'student_id'.",
    "details": null
  },
  "context": {
    "execution_time_ms": 5,
    "active_transaction_id": "NONE",
    "transaction_status": "FAILED"
  },
  "meta": {
    "environment": "DEVELOPMENT",
    "version": "2.0.0",
    "timestamp": "2026-06-20T14:00:00.000Z",
    "correlation_id": "uuid",
    "diagnostics": { "stack_trace": ["..."] }
  }
}
```

> [!IMPORTANT]
> **Diagnostics block** (`stack_trace`) is only included when `environment === 'development'`.

---

## 6. Error Classes Available

### DazzlingDB Domain Errors ([Errors.js](e:/NAST/Dazzling/GAS/DazzlingDB/Errors.js))

| Class | Use Case |
|---|---|
| `ActionValidationError` | Invalid or missing request parameters |
| `ActionAuthorizationError` | User lacks permission for the operation |
| `SystemError` | Generic system-level failures |
| `PackageOrchestrationError` | Academic package operation failures |

### SheetDB Library Errors (accessed via `SheetDB.*`)

| Class | Use Case |
|---|---|
| `SheetDB.EntityNotFoundError` | Record not found by ID in a table |
| `SheetDB.ValidationError` | Schema-level validation failure (type, choice, required) |
| `SheetDB.IntegrityError` | Referential integrity / foreign key constraint violation |
| `SheetDB.ForbiddenError` | System-level access denial |
| `SheetDB.ConflictError` | Duplicate or conflicting record state |
| `SheetDB.ResourceNotFoundError` | Infrastructure resource (spreadsheet/file) not found |
| `SheetDB.PlatformQuotasExhaustedException` | Google API rate limit exhaustion |
| `SheetDB.SheetDBEngineError` | Unhandled ORM/engine-level fault |

---

## 7. Step-by-Step: Creating a New Standard Action

### Step 1: Define the class in [ConcreteActions.js](e:/NAST/Dazzling/GAS/DazzlingDB/DBServices/ConcreteActions.js)

```javascript
/**
 * <Domain> Domain: <Brief description of what this action does>
 */
class MyNewAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE); // or QUERY, UPDATE, DELETE
  }

  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.required_field) {
      throw new ActionValidationError("payload must contain 'required_field'.");
    }
  }

  // Optional: Only override if access control is needed
  _authorize() {
    if (!AuthBridge.checkAccess(this._user, "TargetTable")) {
      throw new ActionAuthorizationError("Access denied.");
    }
  }

  handle(requestContext) {
    // Delegate to domain service OR use this._db directly
    return SomeDomainService.doSomething(requestContext.params.payload, requestContext);
  }
}
```

### Step 2: Register to globalThis

Append at the bottom of the globalThis binding block in [ConcreteActions.js](e:/NAST/Dazzling/GAS/DazzlingDB/DBServices/ConcreteActions.js):

```javascript
globalThis.MyNewAction = MyNewAction;
```

### Step 3: Register in ApiDispatcher registry

Add the action key mapping inside [ApiDispatcher.js](e:/NAST/Dazzling/GAS/DazzlingDB/ApiDispatcher.js):

```javascript
// Inside _getStandardRegistry(), _getAdminRegistry(), or _getAdvancedSheetRegistry()
"domain_verb": MyNewAction,
```

**Registry Selection Rules:**

| Action Key Prefix | Registry Function | Example |
|---|---|---|
| `admin_*` | `_getAdminRegistry()` | `admin_system_status` |
| `sheet_*` | `_getAdvancedSheetRegistry()` | `sheet_fetch_data_matrix` |
| Everything else | `_getStandardRegistry()` | `student_register`, `data_query` |

### Step 4: Action Key Naming Convention

```
<domain>_<verb>[_<qualifier>]
```

Examples: `student_register`, `academic_create_course`, `staff_mark_attendance_bulk`, `data_delete_many`

---

## 8. Special Pattern: Generic CRUD Actions

Generic CRUD actions (`CreateRecordAction`, `UpdateRecordAction`, `DeleteRecordAction`, `DeleteManyRecordsAction`) follow a **different return contract**. Their `handle()` returns an intermediate object that is intercepted by `ApiDispatcher._processGatewayAction()`.

### Return contract:

```javascript
handle(requestContext) {
  // ... business logic ...
  return {
    isGenericCrudResult: true,
    payload: {
      message: "Successfully created record...",
      id: createdId,
      record: newRecord
    }
  };
}
```

The `_processGatewayAction` interceptor in ApiDispatcher detects `result.isGenericCrudResult` and re-routes formatting through `formatSuccessResponse(result.payload, ...)` with computed mutation manifests.

> [!WARNING]
> **Standard actions must NEVER return `{ isGenericCrudResult: true }`** unless they are explicitly intended to be intercepted by the gateway. This flag bypasses the normal `BaseAction.run()` formatting pipeline.

---

## 9. Special Pattern: Bulk Delete Subclasses

To create a domain-specific bulk delete action, extend `DeleteManyRecordsAction` in [ConcreteActionsX.js](e:/NAST/Dazzling/GAS/DazzlingDB/DBServices/ConcreteActionsX.js):

```javascript
class DeleteManyXxxAction extends DeleteManyRecordsAction {
  // Step 1: Pin the target table and add domain restrictions
  _validate() {
    this._params.payload.table = "TargetTable";
    super._validate();

    // Optional: RESTRICT checks (block deletion if business rule violated)
    const { ids } = this._params.payload;
    ids.forEach(id => {
      // e.g., block if active references exist
    });
  }

  // Step 2: Define cascade deletions before parent delete
  _execute() {
    const { ids } = this._params.payload;
    const dryRun = this._params.payload.dryRun !== false;

    if (!dryRun) {
      ids.forEach(id => {
        // CASCADE: delete dependent child rows
      });
    }

    return super._execute(); // Delegates to parent for actual deletion
  }
}
```

---

## 10. Mandatory Checklist for New Actions

- [ ] Class extends `BaseAction` (or `DeleteManyRecordsAction` for bulk deletes)
- [ ] Constructor calls `super(ActionType.TOKEN)` with the correct CQS token
- [ ] `_validate()` checks all required parameters and throws `ActionValidationError`
- [ ] `_authorize()` enforces access control (if applicable)
- [ ] `handle()` returns raw data payload (not a pre-formatted envelope)
- [ ] `handle()` pushes PascalCase table names to `requestContext.mutationManifest` for write operations
- [ ] Class is bound to `globalThis.ClassName` at the bottom of the file
- [ ] Action key is registered in the correct `ApiDispatcher` registry
- [ ] Action key follows `<domain>_<verb>[_<qualifier>]` naming convention
- [ ] Custom errors use domain-specific exception classes, not generic `Error`

---

## 11. Files Involved

| File | Role |
|---|---|
| [BaseActions.js](e:/NAST/Dazzling/GAS/DazzlingDB/DBServices/BaseActions.js) | `BaseAction` class, `ActionType` enum, `ErrorMappingRegistry` |
| [ConcreteActions.js](e:/NAST/Dazzling/GAS/DazzlingDB/DBServices/ConcreteActions.js) | All standard and admin action class definitions |
| [ConcreteActionsX.js](e:/NAST/Dazzling/GAS/DazzlingDB/DBServices/ConcreteActionsX.js) | Bulk delete action subclasses |
| [ApiDispatcher.js](e:/NAST/Dazzling/GAS/DazzlingDB/ApiDispatcher.js) | Action key → Class routing registries |
| [Errors.js](e:/NAST/Dazzling/GAS/DazzlingDB/Errors.js) | DazzlingDB domain error classes |
