# TODO: Implement a Robust In-Memory Database Cache System for SheetDB

## Status: PENDING

## Objective
Introduce a transaction-aware, read-write in-memory caching layer for `SheetDB` to optimize data access performance and eliminate the N+1 database query problem globally. Currently, every call to `TableGateway.all()`, `find()`, or `where()` performs a physical `sheet.getDataRange().getValues()` call to Google Sheets, leading to high latency in execution loops. An in-memory cache will store parsed datasets upon their first query in a script execution session, servicing all subsequent reads instantly in O(1) time.

## Proposed System Architecture

```text
  +------------------+
  |    Repository    |
  +------------------+
            │
            ▼
  +------------------+
  |   TableGateway   |
  +------------------+
            │
            ▼
  +------------------+
  | SheetDataSource  |
  +------------------+
            │
            ├──► [Cached?] ──YES──► Return In-Memory JS Object Array
            │
            └──► [Cached?] ──NO───► sheet.getDataRange().getValues()
                                          │
                                          ├──► Parse & Cache in Memory
                                          └──► Return JS Object Array
```

## Changes Required

### 1. In-Memory Cache in `SheetDataSource` (`SheetDB/DataSource/DataSource.js`)
- Implement a centralized `_tableCache` map on `SheetDataSource` (e.g. `this._tableCache = {}`).
- Update `readTable(categoryName, tableName)` to check if the table cache exists.
  - If a cache hit occurs: Return the cached array.
  - If a cache miss occurs: Physically read from the sheet, save the rows into the cache, and return them.

### 2. Cache Invalidation & Synced Writes
Ensure all write operations modify the in-memory cache dynamically to prevent stale reads:
- **`insertRows`**: Append the new records to the local cache array.
- **`updateRow`**: Locate the row in the local cache array by its row number/ID and update its values.
- **`deleteRow` / `deleteRowsBatch`**: Filter out deleted row indices from the local cache array.
- **`purgeCache`**: Clear all internal caches to force physical reads on next requests.

### 3. Transaction-Aware Cache State (Staged Commit / Rollback)
Integrate the caching layer with [TransactionTracker.js](e:/NAST/Dazzling/GAS/DazzlingDB/DBServices/TransactionTracker.js) or a custom transaction boundary:
- When starting a transaction, clone the cache state for modified tables.
- If a write fails during a transaction, rollback the in-memory cache to the checkpointed state along with the physical sheet updates.
- If the transaction succeeds, finalize the staged cache.

## Benefits
- **Performance**: Reduces read latency by over 95% in execution contexts where records are queried repeatedly.
- **Time Limits**: Minimizes the risk of hitting Google Apps Script's 6-minute execution limit.
- **DRY Code**: Removes the need to manually implement pre-loaded maps (`studentMap`, `allowedStudents`) inside individual services.
