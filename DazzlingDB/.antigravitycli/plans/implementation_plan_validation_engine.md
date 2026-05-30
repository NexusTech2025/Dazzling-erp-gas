# Implementation Plan: Generic `ValidationEngine` & `staff_teacher_update`

This plan proposes the creation of a generic, reusable `ValidationEngine` infrastructure component in DazzlingDB, and leverages it to implement the custom validation and sanitization workflow required for the `staff_teacher_update` action.

---

## Design Pattern: Functional Composite Pipeline (Generic Validation Engine)

We extract the pipeline validation pattern into a generic utility composed of:
1. **`ValidationContext`**: A Value Object wrapping the database instance, payload, entity identifiers, validation error collection, and dynamic execution state.
2. **`ValidationEngine`**: An orchestrator that loops through sequential validation steps (Rules descriptors).
3. **Validation Rule Descriptors**: Structured objects declaring a specific validation or transformation concern.

```
       [ Client Request ]
               │
               ▼
      ValidationContext
 ┌───────────────────────────┐
 │ db                        │
 │ entityId                  │
 │ payload (mutable patch)   │
 │ errors: []                │
 │ state: {}                 │
 └─────────────┬─────────────┘
               │
               ▼
       ValidationEngine.run(context, rules)
               │
               ├─► [ Rule 1 ] ───► .validator() ──► Success ──► .onSuccess()
               │                                └──► Failure ──► .onError() (critical? ──► Abort)
               │
               ├─► [ Rule 2 ] ───► .validator() ──► Success ──► .onSuccess()
               │                                └──► Failure ──► .onError()
               │
               ▼
       [ Validation Passed? ]
         YES ──► db.Entity.update(entityId, payload)
         NO  ──► throw ValidationError(context.errors)
```

### 1. Generic Engine Structures
We define these reusable components in a new core file: `Validate/ValidationEngine.js`.

```javascript
class ValidationContext {
  /**
   * @param {Object} db - Database instance (DBContext)
   * @param {string|number} entityId - Unique identifier of the entity being validated
   * @param {Object} payload - The input data to validate/sanitize
   */
  constructor(db, entityId, payload) {
    this.db = db;
    this.entityId = entityId;
    this.payload = { ...(payload || {}) };
    this.errors = [];
    this.state = {};
  }

  addError(field, message) {
    this.errors.push({ field, message });
  }

  isValid() {
    return this.errors.length === 0;
  }
}

class ValidationEngine {
  /**
   * Runs an array of rule descriptors sequentially against a validation context
   * @param {ValidationContext} ctx
   * @param {Array<Object>} rules
   * @returns {ValidationContext}
   */
  static run(ctx, rules) {
    for (const rule of rules) {
      const ruleName = rule.name || "anonymous_rule";
      try {
        const passed = rule.validator(ctx);

        if (passed) {
          if (typeof rule.onSuccess === "function") {
            rule.onSuccess(ctx);
          }
        } else {
          if (typeof rule.onError === "function") {
            rule.onError(ctx);
          } else {
            ctx.addError(ruleName, `Validation step failed: ${ruleName}`);
          }

          if (rule.critical) {
            console.warn(`[ValidationEngine] Critical step failed: ${ruleName}. Terminating validation early.`);
            break;
          }
        }
      } catch (err) {
        console.error(`[ValidationEngine] Exception in step "${ruleName}":`, err);
        if (typeof rule.onError === "function") {
          rule.onError(ctx, err);
        } else {
          ctx.addError(ruleName, err.message || String(err));
        }

        if (rule.critical) {
          break;
        }
      }
    }
    return ctx;
  }
}
```

---

## Proposed Changes

### Files Affected

| File | Change Type | Reason |
|---|---|---|
| [`ValidationEngine.js`](file:///E:/NAST/Dazzling/GAS/DazzlingDB/Validate/ValidationEngine.js) | **NEW** | Contains generic `ValidationContext` and `ValidationEngine` runner |
| [`TeacherUpdatePipeline.js`](file:///E:/NAST/Dazzling/GAS/DazzlingDB/Validate/TeacherUpdatePipeline.js) | **NEW** | Contains the array declaration of rules specific to Teacher updates |
| [`StaffService.js`](file:///E:/NAST/Dazzling/GAS/DazzlingDB/DBServices/StaffService.js) | MODIFY | Delegate `updateTeacher` to the `ValidationEngine` |
| [`ConcreteActions.js`](file:///E:/NAST/Dazzling/GAS/DazzlingDB/DBServices/ConcreteActions.js) | MODIFY | Implement `StaffUpdateTeacherAction` class |
| [`ApiDispatcher.js`](file:///E:/NAST/Dazzling/GAS/DazzlingDB/ApiDispatcher.js) | MODIFY | Register `"staff_update_teacher"` routing target |
| [`REST-api-doc.md`](file:///E:/NAST/Dazzling/GAS/DazzlingDB/REST-api-doc.md) | MODIFY | Document new endpoint |

---

### Detailed File Specifications

#### 1. [NEW] [ValidationEngine.js](file:///E:/NAST/Dazzling/GAS/DazzlingDB/Validate/ValidationEngine.js)
Contains classes `ValidationContext` and `ValidationEngine`.

#### 2. [NEW] [TeacherUpdatePipeline.js](file:///E:/NAST/Dazzling/GAS/DazzlingDB/Validate/TeacherUpdatePipeline.js)
Declares the rules array `TeacherUpdateRules` containing:
- **`teacher_existence`**: Checks if `entityId` exists. Assigns to `ctx.state.existingRecord`. (Critical)
- **`sanitize_immutable_fields`**: Deletes `teacher_id`, `__tx_id`, `__tx_status`, `__created_at`.
- **`unique_mobile`**: Checks uniqueness of `mobile_number` excluding self.
- **`unique_email`**: Checks uniqueness of `email` excluding self.
- **`branch_fk_check`**: If `branch_id` is supplied, validates that it resolves to a real branch.

```javascript
const TeacherUpdateRules = [
  {
    name: "teacher_existence",
    critical: true,
    validator: (ctx) => {
      ctx.state.existingRecord = ctx.db.Teacher.findById(ctx.entityId);
      return !!ctx.state.existingRecord;
    },
    onError: (ctx) => {
      ctx.addError("teacher_id", `Teacher with ID ${ctx.entityId} was not found.`);
    }
  },
  {
    name: "sanitize_immutable_fields",
    validator: (ctx) => {
      const immutables = ["teacher_id", "__tx_id", "__tx_status", "__created_at"];
      immutables.forEach(field => delete ctx.payload[field]);
      return true;
    }
  },
  {
    name: "unique_mobile",
    validator: (ctx) => {
      const { mobile_number } = ctx.payload;
      if (!mobile_number) return true;
      const duplicate = ctx.db.Teacher.findOne({ mobile_number });
      return !duplicate || duplicate.teacher_id === ctx.entityId;
    },
    onError: (ctx) => {
      ctx.addError("mobile_number", `Mobile number ${ctx.payload.mobile_number} is already in use by another teacher.`);
    }
  },
  {
    name: "unique_email",
    validator: (ctx) => {
      const { email } = ctx.payload;
      if (!email) return true;
      const duplicate = ctx.db.Teacher.findOne({ email });
      return !duplicate || duplicate.teacher_id === ctx.entityId;
    },
    onError: (ctx) => {
      ctx.addError("email", `Email address ${ctx.payload.email} is already in use by another teacher.`);
    }
  },
  {
    name: "branch_fk_check",
    validator: (ctx) => {
      const { branch_id } = ctx.payload;
      if (!branch_id) return true;
      const branch = ctx.db.Branch.findById(branch_id);
      return !!branch;
    },
    onError: (ctx) => {
      ctx.addError("branch_id", `Branch with ID ${ctx.payload.branch_id} does not exist.`);
    }
  }
];
```

#### 3. [MODIFY] [StaffService.js](file:///E:/NAST/Dazzling/GAS/DazzlingDB/DBServices/StaffService.js)
```javascript
  updateTeacher(payload) {
    const db = DBContext.getInstance();
    console.log(`[StaffService] Initiating validation for teacher update: ${payload.teacher_id}`);

    const ctx = new ValidationContext(db, payload.teacher_id, payload.data);
    ValidationEngine.run(ctx, TeacherUpdateRules);

    if (!ctx.isValid()) {
      throw new SheetDB.ValidationError("Validation failed for teacher update.", { fields: ctx.errors });
    }

    const updatedTeacher = db.Teacher.update(ctx.entityId, ctx.payload);
    console.log(`[StaffService] Update successful for teacher: ${ctx.entityId}`);
    return updatedTeacher;
  }
```

#### 4. [MODIFY] [ConcreteActions.js](file:///E:/NAST/Dazzling/GAS/DazzlingDB/DBServices/ConcreteActions.js)
```javascript
class StaffUpdateTeacherAction extends BaseAction {
  _validate() {
    this._requireParam("payload");
    if (!this._params.payload.teacher_id) {
      throw new ActionValidationError("payload must contain 'teacher_id'.");
    }
  }

  _execute() {
    return StaffService.updateTeacher(this._params.payload);
  }
}
```

#### 5. [MODIFY] [ApiDispatcher.js](file:///E:/NAST/Dazzling/GAS/DazzlingDB/ApiDispatcher.js)
Register key `"staff_update_teacher": StaffUpdateTeacherAction` inside the main router registry.

---

## Verification Plan

### Automated Tests
* Create `DazzlingDB/Test/UpdateTeacherTests.js` integrating the validation engine to assert:
  - Multi-field payload updates.
  - Interception and stripping of immutable tracking keys (`__tx_*`).
  - Validation failures collected collectively (multi-field validation return).
  - Validation short-circuiting on missing ID.
  - Foreign key verification failures.

### Manual Verification
* Run execution payload tests and assert correct Sheet mutations and logs output in the GAS logger console.
