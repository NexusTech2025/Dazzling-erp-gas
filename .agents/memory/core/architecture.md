# DazzlingDB Architectural Blueprint

This reference guide details the core conceptual architecture of **DazzlingDB** (Google Apps Script). It functions as the technical compass for developers and AI agents extending or modifying system components.

---

## 1. Domain-Driven Three-Tier Architecture

DazzlingDB operates on a clean, decoupled three-tier system:

```
┌────────────────────────────────────────────────────────┐
│                      REST API Layer                     │
│  (ApiDispatcher ──► BaseAction ──► ConcreteActions)     │
└───────────────────────────┬────────────────────────────┘
                            │ (Calls Domain Services)
                            ▼
┌────────────────────────────────────────────────────────┐
│                    Domain Service Layer                │
│  (StaffService, StudentService, AcademicService, etc.)  │
└───────────────────────────┬────────────────────────────┘
                            │ (Uses SheetDB ORM Objects)
                            ▼
┌────────────────────────────────────────────────────────┐
│                      SheetDB ORM Layer                 │
│  (SheetDB, DBContext, TableGateway, Model Repositories)│
└────────────────────────────────────────────────────────┘
```

### 1.1 REST API Layer (Request routing & envelope formatting)
*   **`ApiDispatcher`**: The single routing gateway. Parses standard incoming JSON payloads containing `action`, `token`, and `payload` parameters. Maps action keys (e.g., `"staff_update_teacher"`) directly to action classes.
*   **`BaseAction`**: Outlines the standard action execution lifecycle:
    `run()` ──► `_validate()` ──► `_authorize()` ──► `_execute()` ──► returns `{ success: true, action: "name", data: result }`
*   **`ConcreteActions`**: Implements individual action classes (e.g., `StaffUpdateTeacherAction`). Validates parameters and triggers domain service logic.

### 1.2 Domain Service Layer (Business rules & transactions)
*   Encapsulates multi-table operations, custom business validations, and relational mapping orchestrations.
*   Acts as the **Transaction Boundary**. Manages record staging and handles transactional **rollbacks** in reverse order of insertions to prevent orphaned records in secondary sheets (e.g., compensation configs, mapping tables) when a downstream database write fails.

### 1.3 SheetDB ORM Layer (Database abstraction & active record)
*   Abstracts underlying Google Sheets spreadsheet tabs as database collections.
*   Provides structured Model interfaces mapping columns directly to attributes.
*   **`DBContext`**: Singleton instance keeping database schema configs in-memory and coordinating repository registries.
*   **Active Record CRUD methods**:
    *   `db[Entity].findById(id)`
    *   `db[Entity].findOne(filter)`
    *   `db[Entity].where(filter)`
    *   `db[Entity].exists(filter)`
    *   `db[Entity].insert(data)`
    *   `db[Entity].insertMany(array)`
    *   `db[Entity].update(id, data)`
    *   `db[Entity].remove(id)`

---

## 2. Declarative Validation Framework

To enforce strict domain constraints before committing updates, DazzlingDB utilizes a decoupled validation pipeline in `DazzlingDB/Validate/`:

*   **`ValidationContext`**: Holds active database connection (`db`), target entity ID, payload object, errors array, and temporary state variables.
*   **`ValidationEngine`**: Runs an array of rule descriptors sequentially.
*   **Pipeline Rules**: Structured objects with validation properties:
    ```javascript
    {
      name: "rule_name",
      critical: true, // If true, immediately halts the validation pipeline on failure
      validator: (ctx) => { ... returns boolean ... },
      onError: (ctx) => { ctx.addError("field", "message"); }
    }
    ```

---

## 3. Relational Mapping & Batch Mechanics

Because Google Sheets does not support natural SQL joins, relationships are managed programmatically:
*   **1-to-Many Mappings**: Stored in bridge/joining tables (e.g., `TeacherSubject`).
*   **Sync Patterns**: Consolidated actions perform an atomic sync of assignments by querying existing maps with `db.EntitySubject.where({ entity_id })`, bulk-deleting currently mapped rows, and batch-inserting updated listings using the optimized `insertMany` ORM utility.
