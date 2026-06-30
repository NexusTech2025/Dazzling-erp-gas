To implement the **`Non-Disruptive Bulk Deletion Manifests (with Relational Violation Isolation)`** architectural feature for `DeleteManyCourseTypeAction`, we will extend `DeleteManyRecordsAction` within the bulk deletion layer.

This action must safely sweep a target batch array of `CourseType` records, perform individual pre-flight verification checks against active schema-driven dependency chains, isolate any `protect` violations, and compile a structured, non-crashing output manifest.

---

## 🛠️ Step-by-Step Implementation Plan

### Phase 1: Action Class Construction

We will append the `DeleteManyCourseTypeAction` subclass to **`ConcreteActionsX.js`**. This class overrides the base lifecycle parameters to enforce strict isolation boundaries.

```javascript
/**
 * Academic Domain: Delete many course types (Segments)
 * Implementation of: Non-Disruptive Bulk Deletion Manifests (with Relational Violation Isolation)
 */
class DeleteManyCourseTypeAction extends DeleteManyRecordsAction {
  _validate() {
    // 1. Force the target system table context to CourseType
    this._params.payload.table = "CourseType";
    super._validate();
  }

  _execute() {
    const { ids } = this._params.payload;
    const dryRun = this._params.payload.dryRun !== false;
    
    let deletedCount = 0;
    const failed = {};
    const safeToQuery = [];

    if (!dryRun) {
      // 2. Commit Execution Path: High-performance RAM-bound deletion via ORM gateway
      try {
        deletedCount = this._db.CourseType.deleteMany(ids);
      } catch (e) {
        if (e instanceof SheetDB.IntegrityError || e.name === "IntegrityError") {
          throw new ActionValidationError(e.message);
        }
        throw e;
      }
    } else {
      // 3. Dry Run Path: Loop over target primary keys sequentially to gather comprehensive violations
      ids.forEach(id => {
        try {
          // Trigger underlying graph database structural constraints check
          this._db.CourseType.enforceDeleteConstraints(id);
          safeToQuery.push(id);
        } catch (e) {
          if (e instanceof SheetDB.IntegrityError || e.name === "IntegrityError") {
            // Isolate referential blockages into structured tracking payload schemas instead of crashing
            failed[id] = {
              message: e.message,
              violations: e.context || []
            };
          } else {
            throw e;
          }
        }
      });
    }

    // 4. Return the non-disruptive, protocol-driven manifest payload
    return {
      success: true,
      dryRun: dryRun,
      deletedCount: dryRun ? 0 : ids.length,
      manifest: {
        deleted: dryRun ? safeToQuery : ids,
        skipped: [],
        failed: failed
      }
    };
  }
}

```

---

### Phase 2: Global Context & Core Routing Registration

To wire the new class into the application pipeline, we perform the global container bindings across the database infrastructure layer:

1. **Namespace Binding (Bottom of `ConcreteActionsX.js`):**
```javascript
globalThis.DeleteManyCourseTypeAction = DeleteManyCourseTypeAction;

```



```
2. **ApiDispatcher Router Mapping (Inside `_getStandardRegistry()` in `ApiDispatcher.js`):**
   We add the standardized endpoint mapping to the business layer router array:
   ```javascript
   "academic_delete_many_course_types": DeleteManyCourseTypeAction,

```

---

### Phase 3: Verification & Response Protocol

#### Expected Dry Run Failure Response Schema

When client apps request a verification drop on a mix of clean and attached course segment rows, the output provides detailed error descriptions without breaking the server instance:

```json
{
  "success": true,
  "data": {
    "success": true,
    "dryRun": true,
    "deletedCount": 0,
    "manifest": {
      "deleted": ["CT-VOCATIONAL"],
      "skipped": [],
      "failed": {
        "CT-ACADEMIC": {
          "message": "Delete Protected: Cannot delete from 'CourseType' because active records in 'Course' refer to it.",
          "violations": [
            {
              "table": "Course",
              "foreignKey": "segment_id",
              "ids": ["CRS-MATH11", "CRS-SCI12"],
              "policy": "protect"
            }
          ]
        }
      }
    }
  },
  "context": {
    "execution_time_ms": 38
  },
  "meta": {
    "environment": "PRODUCTION",
    "version": "2.2.0",
    "timestamp": "2026-06-24T15:50:00.000Z"
  }
}

```