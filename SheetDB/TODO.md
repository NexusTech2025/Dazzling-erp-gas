# SheetDB Future Framework Enhancements

This file documents future tasks for upgrading the `SheetDB` database framework to support high-performance bulk write operations (Approach B).

## Future Roadmap

### 1. Implement `deleteBatch(table, filter)` / `deleteMany`
*   Add a generic batch delete method inside `TableGateway` and `DynamicRepository`.
*   Support row removal filtering (e.g. removing rows where `teacher_id === 'TCH-123'`) in a single sheet operation instead of sequential `remove(id)` calls.

### 2. Implement `insertMany` Aliases
*   Provide a standardized MongoDB-style `insertMany` alias mapping directly to `insertBatch`.
*   Integrate with `BatchBucket` validation and transaction rollback logs.

### 3. Implement Transaction Rollback Support for Batch Operations
*   Ensure that failures in `insertMany` or `deleteMany` record their operations correctly in the rollback transaction log to revert all affected records gracefully.
