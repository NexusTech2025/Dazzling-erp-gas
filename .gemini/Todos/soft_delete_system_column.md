# TODO: Soft Deletion System Column Implementation (`__deleted`)

This document outlines the detailed roadmap for implementing soft deletion capability natively within the SheetDB ORM and DazzlingDB Action controllers using a system-level marker column `__deleted`.

---

## **1. Compiler Configuration (`dazzlingdb-tools`)**

- [ ] Add `__deleted` to the `SYSTEM_COLUMNS` registry in [index.js](e:/NAST/Dazzling/GAS/dazzlingdb-tools/index.js):
  ```javascript
  "__deleted": {
    "type": "boolean",
    "default": false,
    "system": true,
    "required": true,
    "editable": false,
    "description": "Soft deletion status marker"
  }
  ```
- [ ] Run compiler schema audit and lint validation checks to ensure compile pipeline handles boolean system defaults correctly.
- [ ] Compile schemas (`npm run compile-graph:prod`) to regenerate `database_schema.js` and verify `__deleted` column is injected in all table models.

---

## **2. ORM Data Hydration & Read Filters (`SheetDB`)**

- [ ] Update `BaseModel.js` and `Fields.js` to support parsing of the boolean `__deleted` values from Sheet rows (ensuring `"true"`, `true`, `1` are cast correctly to JS Boolean).
- [ ] Modify read query methods in `TableGateway.js` and `DynamicRepository.js`:
  - **`all(options)`**: Filter out rows where `__deleted === true` by default.
  - **`findById(id, options)`**: Prevent returning soft-deleted records unless explicit override is provided.
  - **`where(query, options)`**: Filter matches to active records.
- [ ] Introduce a query override parameter `includeDeleted: true` to bypass the default soft-delete filter:
  ```javascript
  const allStudentsIncludingDeleted = db.Student.all({ includeDeleted: true });
  ```

---

## **3. Write/Delete Mutations (`SheetDB`)**

- [ ] Refactor the repository delete entrypoints:
  - **`remove(id)`**: Instead of physically slicing the row array and splicing sheet ranges, update the row's `__deleted` property to `true` and trigger a cell write update.
  - **`removeMany(ids)`**: Batch update `__deleted = true` across the targeting rows.
- [ ] Handle **Cascading Soft Deletes** inside `DeletionValidationRegistry.js` or delete validation loops:
  - If a deleted parent cascades to child records, apply soft-deletion `__deleted = true` to those children dynamically.
  - For `set_null` policies, continue nullifying foreign keys on active child records.

---

## **4. Data Archiving & Restoration APIs**

- [ ] Implement an administrative action `admin_archive_deleted_records` to:
  - Scan all tables for rows where `__deleted === true`.
  - Copy these stale records to an offline archive spreadsheet.
  - Physically purge (hard delete) the rows from the active operational sheets to reclaim space.
- [ ] Implement a restore utility `restore(id)` to revert `__deleted` status back to `false`.
