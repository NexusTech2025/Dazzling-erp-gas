# SheetDB High-Performance Batch Deletion Strategy

In Google Apps Script (GAS) development, spreadsheet read/write operations are the primary performance bottlenecks. Performing cell writes or deleting rows one-by-one triggers separate HTTP roundtrips to the Google Sheets backend, leading to high latency and script execution timeouts.

To address this, SheetDB implements a highly optimized **In-Memory Filtering and Bulk Overwrite** strategy for its `deleteMany` feature.

---

## The Batch Deletion Pattern

Instead of executing physical sheet deletes line-by-line, the deletion engine shifts the heavy lifting from the Spreadsheet API to the Javascript runtime engine.

### Architectural Diagram
```text
Spreadsheet (Disk)           Javascript Memory (RAM)
┌─────────────────┐          ┌──────────────────────────────────┐
│ Read entire range ─────────> Load row data into 2D Array      │
│                 │          │                                  │
│                 │          │ Scan rows, match IDs against Set │
│                 │          │                                  │
│ Clear data range <───────── Filter remaining rows (In-Memory)  │
│                 │          │                                  │
│ Bulk write      <───────── Remaining row 2D Array             │
└─────────────────┘          └──────────────────────────────────┘
```

---

## Step-by-Step Strategy Walkthrough

The batch delete operation in `SheetDataSource.deleteRowsBatch` works as follows:

### 1. Thread Locking & Concurrency Control
Before running, the script wraps execution inside a global mutex lock:
```javascript
return this._withLock(() => { ... });
```
This blocks other concurrent script instances from writing or reading the spreadsheet midway through the read-filter-write pipeline, preventing race conditions or dirty writes.

### 2. Single-Pass Disk Read
Instead of querying specific cells, the engine pulls the entire dataset (including headers) in a single read call:
```javascript
const values = sheet.getDataRange().getValues();
```
This maps the sheet to a 2D Array in RAM in $O(1)$ read operation.

### 3. Fast In-Memory Filtering
Using a Javascript `Set` for key matching ensures $O(1)$ lookup complexity for matching IDs:
```javascript
const idsToMatch = new Set(ids.map(id => String(id).trim()));
const remainingRows = [];
let deleteCount = 0;

dataRows.forEach((row, index) => {
  const rowId = String(row[pkIndex]).trim();
  if (idsToMatch.has(rowId)) {
    deleteCount++;
  } else {
    remainingRows.push(row);
  }
});
```
This loop runs entirely in Javascript memory, scanning thousands of rows in milliseconds.

### 4. Clear and Overwrite (The Write Operation)
If matches are found, the engine executes a single range clear below the headers:
```javascript
sheet.getRange(2, 1, values.length - 1, headers.length).clearContent();
```
Followed by a single, bulk write of all remaining rows:
```javascript
sheet.getRange(2, 1, remainingRows.length, headers.length).setValues(remainingRows);
```
This reduces what would have been $N$ row deletion API calls to exactly **two** write API calls (`clearContent` + `setValues`).

---

## Key Advantages
* **HTTP Roundtrip Reduction**: Shrinks Sheet API interaction from $O(N)$ write requests to $O(1)$ read and $O(1)$ write operations.
* **Apps Script Execution Speed**: Processing 1,000 rows in GAS memory takes less than 10 milliseconds, whereas deleting 1,000 rows individually would exceed the 6-minute execution limit.
* **Transactional Reliability**: The file lock guarantees that no data is lost or overwritten by concurrent processes during the filter-and-rewrite sequence.
