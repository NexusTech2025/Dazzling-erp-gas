The `staff_mark_attendance` and `staff_mark_attendance_bulk` actions operate within the **Staff & Attendance Sub-Domain**. They provide an architectural interface for recording single or multi-row staff log updates while observing the Google Apps Script execution constraints.

---

## 1. Core Architectural Differences

The separation of these actions balances conversational granularity (for single-user mobile or portal interactions) with performance boundaries (for mass payroll or day-end logs):

| Architectural Metric | `staff_mark_attendance` | `staff_mark_attendance_bulk` |
| --- | --- | --- |
| **Primary Intent** | Real-time single staff check-in/out. | Mass daily/weekly schedule uploads. |
| **Payload Mechanics** | Flat JSON object representing one entry. | Wrapped flat JSON array of data objects. |
| **Database Processing** | standard ORM `.save()` or `insertOne()`. | High-speed, in-memory `insertRowsBatch`. |
| **Network Complexity** | $O(1)$ read and write sequence. | $O(1)$ single-pass array-rewrite block. |

---

## 2. Dynamic Workflow Execution

Both endpoints inherit their core runtime lifecycle from `BaseAction` inside `DazzlingDB/DBServices/BaseActions.js`. The execution flow proceeds as follows:

```text
       [ API Client Request Payload Received ]
                         |
                         v
        +-----------------------------------+
        |       BaseAction.run() Loop       |
        | 1. Bind explicit runtime params   |
        | 2. Initialize mutationManifest[]  |
        +-----------------------------------+
                         |
                         v
        +-----------------------------------+
        |       this._validate()            |
        |   Verifies date format safety     |
        |  and composite uniqueness keys    |
        +-----------------------------------+
                         |
                         v
        +-----------------------------------+
        |       this._authorize()           |
        | Rejects callers without holding   |
        |   proper role classifications     |
        +-----------------------------------+
                         |
                         v
        +-----------------------------------+
        |      Concrete Action .handle()     |
        |  Routes straight into the target  |
        |        StaffService instance      |
        +-----------------------------------+
                         |
       +-----------------+-----------------+
       |                                   |
(staff_mark_attendance)       (staff_mark_attendance_bulk)
       |                                   |
       v                                   v
+-----------------------------+  +-----------------------------+
|    StaffService . mark()    |  |  StaffService . bulkMark()  |
| 1. Instantiate single model |  | 1. Map row items in memory  |
| 2. Commit standalone insert |  | 2. Run single-pass overwrite|
+-----------------------------+  +-----------------------------+
       |                                   |
       +-----------------+-----------------+
                         |
                         v
    [ Safe Envelope Success Response Generated & Flushed ]

```

---

## 3. Implementation Details & Optimization Drivers

### A. Single Entity Entry: `staff_mark_attendance`

When a single log is generated, the payload contains fields such as `teacher_id`, `date`, `status`, and `batch_id`.

* **Validation Façade**: The action checks for the existence of composite constraint rules to see if an attendance record for that `teacher_id` and `date` combination already exists.
* **State Behavior**: If it exists, an update is applied; otherwise, a clean row is appended.

### B. High-Performance Mass Entry: `staff_mark_attendance_bulk`

Iterating over hundreds of rows and triggering a `sheet.appendRow()` or ORM `.save()` call inside a `for` loop causes an $N+1$ write trap. This causes multiple slow REST API requests to Google's file systems, exhausting container execution limits.

* **Single-Pass Array Rewrite**: The bulk action gathers the input manifest array, extracts unique identifier coordinates, maps out active indicators inside the `PrimaryKeyCache`, and loads data arrays in RAM.
* **Write Consolidation**: It modifies a 2D matrix array in memory and triggers exactly one high-performance batch operation via `DataSource.updateRowsBatch` or `insertRowsBatch`, flushing all entries into physical storage ranges simultaneously.

### C. Timezone Drift Protections

Because Google Apps Script containers run on arbitrary localized cloud engine times, dates can slip backward or forward when cast into strings. Both attendance engines feed dates through a global normalization engine:

$$\text{Casting Workflow: } \mathbf{Payload} \longrightarrow \mathtt{SheetDBDateTime.toSheetSafeValue()} \longrightarrow \mathbf{ISO\text{-}8601\text{ String}}$$

This process handles incoming variations safely, keeping storage fields consistent.