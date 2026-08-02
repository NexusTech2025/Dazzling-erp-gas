# AtomicPipeline Architecture Reference & Sequence Graph

This document details the architectural design, component interactions, step execution flow, and LIFO rollback mechanisms of the **`AtomicPipeline`** transaction engine in SheetDB/DazzlingDB.

---

## 1. System Components & Responsibilities

```
+-----------------------------------------------------------------------------------+
|                                  AtomicPipeline                                   |
| - Fluent transaction initiator (AtomicPipeline.begin(db, context))                |
| - Duck-typed PipelineContext validation                                           |
| - Step boundary exception interception                                            |
| - Automated LIFO rollback trigger on error                                         |
+--------------------------+------------------------------+-------------------------+
                           |                              |
                           v                              v
           +-------------------------------+    +-------------------+
           |      TrackingRepository       |    | PipelineContext   |
           | - Intercepts insert/update/del|    | - Client metadata |
           | - Snapshots original rows     |    | - Mutation        |
           | - Logs undo steps in Tracker  |    |   Manifest sync   |
           +---------------+---------------+    +-------------------+
                           |
                           v
           +-------------------------------+
           |      TransactionTracker       |
           | - Ordered LIFO undo stack     |
           | - Executes reverse rollback   |
           | - Restores via TableGateway   |
           +-------------------------------+
```

---

## 2. Logical Step Execution & Rollback Flow

```
[ Client Request ] ──► AtomicPipeline.begin(db, context)
                             │
                             ▼
              [ Check PipelineContext Contract ]
                             │
                             ▼
              [ Execute Step Block (addStep) ]
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   [ Intercept Mutations ]          [ Intercept Exception ]
   (TrackingRepository)             (Step Boundary Catch)
            │                                 │
   Logs Undo Operations              Calls tx.rollback()
   in TransactionTracker             (LIFO Undo Operations)
            │                                 │
   Executes Raw Repo Mutation        Re-throws Boundary Exception
            │                                 │
            └────────────────┬────────────────┘
                             │
                             ▼
               [ Pipeline.execute() Payload ]
```

---

## 3. LIFO Rollback Operations Matrix

| Mutation Executed | `TrackingRepository` Action | `TransactionTracker` LIFO Rollback Action |
| :--- | :--- | :--- |
| `repo.insert(payload)` | `tx.trackInsert(repo, newId)` | `step.repository.remove(id)` |
| `repo.insertMany(payloads)` | `tx.trackInsertMany(repo, ids)` | `step.repository.deleteMany(ids)` |
| `repo.update(id, payload)` | Snapshots `originalRow` -> `tx.trackUpdate(repo, id, originalRow)` | `step.repository.update(id, backup)` |
| `repo.updateMany(updatesMap)` | Snapshots original rows -> `tx.trackUpdate` per ID | Restores original row state per ID |
| `repo.remove(id)` | Snapshots `backupModel` -> `tx.trackDelete(repo, backupModel)` | `step.repository.gateway.insert(backup.toDatabaseRow())` |
| `repo.deleteMany(ids)` | Snapshots `backupModels` -> `tx.trackDelete` per item | Re-inserts backup models via `gateway.insert()` |

---

## 4. Architectural Verification Summary

1. **All-or-Nothing Guarantee**: If any step in an `AtomicPipeline` chain fails, all preceding mutations committed during that pipeline invocation are cleanly rolled back in reverse order before the error propagates out.
2. **Primary Key Preservation**: Deleted rows restored during rollback are written directly via `TableGateway.insert(toDatabaseRow())`, preserving the exact original primary key string (`SFA-xxx`, `INS-xxx`, `FAD-xxx`) without triggering `AutoField` auto-generation.
3. **Zero Boilerplate**: Application controllers do not need manual `try { ... } catch { tx.rollback(); }` blocks; `AtomicPipeline.then()` intercepts step failures automatically.
