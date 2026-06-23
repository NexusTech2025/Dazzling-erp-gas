# TODO: Handle `belongsToPolymorphic` Relation Type in the StaticGraph

## Objective
Support polymorphic associations (`belongsToPolymorphic`) in the static dependency graph compiler (`GraphBuilder.js`). This will ensure that delete-protection policies (`protect`, `cascade`, `set_null`) can be correctly resolved at runtime when parent records are deleted.

## Context
Currently, `GraphBuilder.js` only parses standard `belongsTo` relationships. Polymorphic relationships (like `item` in `Enrollment.json` and `entity` in `PackageItem.json`) are completely omitted from `dependency_graph.js`. Consequently, referential integrity checks for polymorphic references are not statically tracked.

---

## Proposed Changes

### 1. Update Graph Builder (`dazzlingdb-tools/src/compiler/GraphBuilder.js`)
Modify the `build()` method in `GraphBuilder.js` to handle `belongsToPolymorphic` relation types:
*   Extract the `typeField`, `idField` (`fk`), and the `mapping` object from the polymorphic relationship.
*   Iterate through the `mapping` registry (which maps type values to target parent tables).
*   For each mapping entry `[typeValue, parentTable]`:
    *   Validate that `parentTable` exists in schemas.
    *   Determine the `onDelete` policy. (Lookup the `idField`'s column definition in the schema; fallback to `relSchema.onDelete` or `"protect"` if not specified).
    *   Append a dependency entry to `graph[parentTable]` with a `polymorphic` metadata block:
        ```javascript
        {
          table: tableName,
          fk: idField,
          onDelete: onDelete,
          polymorphic: {
            typeField: typeField,
            typeValue: typeValue
          }
        }
        ```

### 2. Validation & Compilation Test
*   Run the production build: `npm run compile-graph:prod`
*   Verify that `DazzlingDB/Config/dependency_graph.js` now contains polymorphic entries under keys like `"Course"` and `"Package"`. For example:
    ```json
    "Course": [
      ...
      {
        "table": "Enrollment",
        "fk": "item_id",
        "onDelete": "protect",
        "polymorphic": {
          "typeField": "enrollment_type",
          "typeValue": "course"
        }
      }
    ]
    ```
*   Ensure that the runtime delete engines are updated to filter by `polymorphic.typeField === polymorphic.typeValue` when processing these dependencies.
