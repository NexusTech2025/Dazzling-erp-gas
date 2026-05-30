# Implementation Plan: `staff_teacher_update` — Design Pattern Approach

> [!NOTE]
> No test file exists yet for teacher update scenarios. A follow-up test file `UpdateTeacherTests.js` in `DazzlingDB/Test/` can be created after approval.

## Design Pattern Proposal

Two complementary patterns solve this cleanly in the GAS global-scope environment:

### Pattern 1: Chain of Responsibility — Validation Pipeline

Each validation concern becomes an independent **handler** with a single job. They are composed into a chain and executed in sequence. Critically, all handlers **collect errors** rather than short-circuit on the first failure.

```
 TeacherUpdateContext
 { db, teacher_id, patch, errors: [] }
       │
       ▼
 ┌─────────────────────────────┐
 │ ExistenceCheckHandler       │  Does teacher_id exist?
 └──────────┬──────────────────┘
            │
            ▼
 ┌─────────────────────────────┐
 │ ImmutableFieldStripHandler  │  Removes teacher_id, __tx_*, __created_at
 └──────────┬──────────────────┘
            │
            ▼
 ┌─────────────────────────────┐
 │ UniqueMobileHandler         │  mobile_number conflict (excluding self)
 └──────────┬──────────────────┘
            │
            ▼
 ┌─────────────────────────────┐
 │ UniqueEmailHandler          │  email conflict (excluding self)
 └──────────┬──────────────────┘
            │
            ▼
 ┌─────────────────────────────┐
 │ BranchFKHandler             │  branch_id must resolve to real Branch
 └──────────┬──────────────────┘
            │
            ▼
      [ errors.length > 0 ]
         YES → throw ValidationError (consolidated)
         NO  → db.Teacher.update(teacher_id, patch)
```

### Pattern 2: Context Object (Value Object)

A plain `TeacherUpdateContext` object carries all shared state through the chain — avoiding threading multiple parameters through every handler signature:

```javascript
// { db, teacher_id, patch, errors[], existingRecord }
const ctx = new TeacherUpdateContext(db, "TCH-...", { full_name: "..." });
```

### Context Class Implementation Detail
```javascript
class TeacherUpdateContext {
  /**
   * @param {Object} db - Database Instance
   * @param {string} teacherId - Teacher ID to update
   * @param {Object} patch - Fields to update
   */
  constructor(db, teacherId, patch) {
    this.db = db;
    this.teacherId = teacherId;
    this.patch = { ...(patch || {}) };
    this.errors = [];
    this.existingRecord = null;
  }

  /**
   * Adds a validation error to the context
   * @param {string} field - Field that failed validation
   * @param {string} message - Descriptive error message
   */
  addError(field, message) {
    this.errors.push({ field, message });
  }
}
```

### Chain of Responsibility Implementation Detail
#### 1. Base Handler Structure
```javascript
class TeacherUpdateHandler {
  constructor() {
    this.nextHandler = null;
  }

  setNext(handler) {
    this.nextHandler = handler;
    return handler; // Allows chaining: h1.setNext(h2).setNext(h3)
  }

  handle(ctx) {
    this.process(ctx);
    if (this.nextHandler) {
      this.nextHandler.handle(ctx);
    }
  }

  /**
   * @abstract
   * @param {TeacherUpdateContext} ctx 
   */
  process(ctx) {
    throw new Error("process() must be implemented by concrete subclass");
  }
}
```

#### 2. Example Concrete Handler
```javascript
class UniqueMobileHandler extends TeacherUpdateHandler {
  process(ctx) {
    const { mobile_number } = ctx.patch;
    if (!mobile_number) return; 

    const duplicate = ctx.db.Teacher.findOne({ mobile_number });
    if (duplicate && duplicate.teacher_id !== ctx.teacherId) {
      ctx.addError("mobile_number", `Mobile number ${mobile_number} is already in use by teacher ${duplicate.teacher_id}.`);
    }
  }
}
```

#### 3. Chain Execution and Orchestration
```javascript
class TeacherUpdateValidationChain {
  static run(ctx) {
    const existenceCheck = new ExistenceCheckHandler();
    const immutableStrip = new ImmutableFieldStripHandler();
    const uniqueMobile   = new UniqueMobileHandler();
    const uniqueEmail    = new UniqueEmailHandler();
    const branchFK       = new BranchFKHandler();

    existenceCheck
      .setNext(immutableStrip)
      .setNext(uniqueMobile)
      .setNext(uniqueEmail)
      .setNext(branchFK);

    existenceCheck.handle(ctx);
  }
}
```

**Benefit**: Every handler only receives `ctx` and mutates it. Adding a new validation rule = adding a new handler and wiring it in. Zero changes to existing handlers or the service method.

---

## Why Not Other Patterns?

| Pattern | Why Rejected |
|---|---|
| **Strategy** | Strategies swap algorithms — validators don't swap, they *compose*. CoR is the correct fit. |
| **Decorator** | Best for wrapping a single object; our validators operate on shared mutable context, not wrapping each other. |
| **Template Method** | Already used by `BaseAction`. Applying it to the service layer would create an inheritance hierarchy for a single use case — over-engineering. |
| **Builder** | Good for constructing objects step-by-step; the patch isn't being *built* — it's being validated and stripped. Semantics don't match. |

---

## Proposed Changes

## Verification Plan
* Create a dedicated integration suite `DazzlingDB/Test/UpdateTeacherTests.js` covering:
  - Base field updates (e.g. `full_name`, `address`).
  - Mobile number uniqueness validation (excluding own ID).
  - Email uniqueness validation (excluding own ID).
  - User credentials creation/updating with dynamic hashing.
  - Verification of teaching subjects synchronization.
  - Foreign key verification on `branch_id`.
  - Non-existent teacher ID rejection.

### Manual Verification
* Deploy a test payload and confirm proper database state updates and transaction-level integrity on GSheets.
