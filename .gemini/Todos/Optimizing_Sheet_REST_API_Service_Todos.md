# Todos: Optimizing Sheet REST API & Deletion Constraint Details

This document outlines the tasks required to implement value normalization/type-casting in the REST API batch-read service and enrich deletion constraint violations with structured relational detail contexts.

---

## Task 1: Type-Casting & Value Normalization in `SheetBatchReadAction`

### Goal
Ensure that values fetched via the optimized `MultiStorageCoordinator` batch read paths are normalized and cast to their schema-defined types (e.g., casting string numbers to integers/floats, booleans, and JSON) by reusing the existing ORM field specification pipeline.

### Steps
- [x] ✅ Update `BaseStorageDriver._matrixToObjects` in `e:/NAST/Dazzling/GAS/SheetDB/SchemaDriver/MultiStorageCoordinator.js` to accept `tableName`.
- [x] ✅ Inside `BaseStorageDriver._matrixToObjects`, attempt to retrieve the compiled schema from the model registry:
  ```javascript
  let schema = null;
  try {
    if (typeof ModelRegistry !== 'undefined') {
      const ModelClass = ModelRegistry.getModel(tableName);
      if (ModelClass && ModelClass.schema) {
        schema = ModelClass.schema;
      }
    }
  } catch (e) {
    // Gracefully ignore if model is not registered
  }
  ```
- [x] ✅ For each cell value, if a schema field exists for the column, invoke `schema[header].fromSheetValue(value)` to execute standard type casting.
- [x] ✅ Update strategy drivers (`StandardAppDriver` and `AdvancedRestDriver`) in `e:/NAST/Dazzling/GAS/SheetDB/SchemaDriver/MultiStorageCoordinator.js` to pass the `sheetTitle` (table name) to `_matrixToObjects`.
- [x] ✅ Verify that integers, floats, booleans, and datetime fields are correctly type-cast before returning response data.

---

## Task 2: Rich Referential Constraint Violations for Blocked Deletions

### Goal
When a delete constraint (e.g., `protect`) is violated, enrich the thrown `IntegrityError` with a structured payload containing the referencing records' IDs and tables. This allows the client to identify the blockers and present interactive resolution options.

### Steps
- [ ] Modify `protect` and other relevant constraint strategies in `e:/NAST/Dazzling/GAS/SheetDB/Graph/DeletionValidationRegistry.js` to accept and populate a `violations` array inside the traversal context instead of throwing instantly:
  ```javascript
  protect: (edge, deleteNodeKeys, context) => {
    const childKey = `${edge.toNode.entityName}:${edge.toNode.id}`;
    if (!deleteNodeKeys.has(childKey)) {
      const violation = {
        table: edge.toNode.entityName,
        foreignKey: edge.foreignKey,
        ids: edge.toNode.ids,
        policy: "protect",
        message: `Delete Protected: Cannot delete from '${edge.fromNode.entityName}' because active records in '${edge.toNode.entityName}' refer to it (FK: '${edge.foreignKey}').`
      };
      if (context && context.violations) {
        context.violations.push(violation);
      } else {
        throw new IntegrityError(violation.message, violation);
      }
    }
  }
  ```
- [ ] Update `DeletionValidationRegistry.validate` to initialize `violations = []`, pass it in the context block, evaluate all edges, and throw a single `IntegrityError` at the end containing the accumulated details:
  ```javascript
  if (violations.length > 0) {
    throw new IntegrityError(violations[0].message, {
      parentTable: rootEntityName,
      parentId: rootId,
      violations: violations
    });
  }
  ```
- [ ] Enrich manual deletion checks (such as in `AcademicService.deletePackage` in `e:/NAST/Dazzling/GAS/DazzlingDB/DBServices/AcademicService.js`) to query the referencing items and throw `IntegrityError` with the same structured context:
  ```javascript
  const enrollments = db.Enrollment.where({ enrollment_type: "package", item_id: packageId });
  throw new SheetDB.IntegrityError(`Cannot delete Package '${packageId}' because it has active student enrollments.`, {
    parentTable: "Package",
    parentId: packageId,
    violations: [{
      table: "Enrollment",
      foreignKey: "item_id",
      ids: enrollments.map(e => e.enrollment_id),
      policy: "protect"
    }]
  });
  ```
- [ ] Update `DeleteStudentAction` catch block in `e:/NAST/Dazzling/GAS/DazzlingDB/DBServices/ConcreteActions.js` to propagate the context block:
  ```javascript
  throw new ActionValidationError(e.message, { details: e.context });
  ```
- [ ] Update `enforceDeleteConstraintsBatch` inside `e:/NAST/Dazzling/GAS/SheetDB/Repositories/DynamicRepository.js` to capture the structured error details and populate `manifest.failed[id]` with the connection/constraint details:
  ```javascript
  manifest.failed[id] = {
    message: err.message,
    violations: err.context ? err.context.violations : []
  };
  ```
- [ ] Update batch deletion exception generation in `enforceDeleteConstraintsBatch` to attach `manifest.failed` inside the `ValidationError` context:
  ```javascript
  throw new ValidationError("Batch Delete Failed", { failed: manifest.failed });
  ```
