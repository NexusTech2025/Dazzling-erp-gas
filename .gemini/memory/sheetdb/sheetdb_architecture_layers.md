### **SheetDB Architectural Layers**

```
┌───────────────────────────────────────────────────────────┐
│              1. Facade Layer (index.js)                   │
│  - Bootstraps the DB engine via SheetDB.init()            │
│  - Dynamically registers Repositories                     │
└─────────────────────────────┬─────────────────────────────┘
                              ▼
┌───────────────────────────────────────────────────────────┐
│        2. Repository Layer (DynamicRepository.js)         │
│  - Provides high-level CRUD queries (all, find, where)    │
│  - Manages delete constraints (cascade, protect, set_null)│
└─────────────────────────────┬─────────────────────────────┘
                              ▼
┌───────────────────────────────────────────────────────────┐
│        3. Active Record / ORM Layer (BaseModel.js)        │
│  - Hydrates raw rows into smart models with properties    │
│  - Handles save(), delete(), and relationship getters     │
└─────────────────────────────┬─────────────────────────────┘
                              ▼
┌───────────────────────────────────────────────────────────┐
│          4. Table Gateway Layer (TableGatway.js)          │
│  - Maps abstract queries/rows to specific sheet index coordinates│
│  - Optimizes bulk batch deletion & updating routines      │
└─────────────────────────────┬─────────────────────────────┘
                              ▼
┌───────────────────────────────────────────────────────────┐
│   5. Data Source & File System (DataSource.js & FS)       │
│  - Handles sheet caching, sheet retrieval, & API locks    │
│  - Low-level wrapper around the Spreadsheet App           │
└───────────────────────────────────────────────────────────┘
```

#### **1. Facade Layer (`SheetDB/index.js`)**
*   **Role:** The bootstrapping layer.
*   **Details:** Accepts root Folder ID and schemas, constructs the schema registry, initializes the caching namespaces, dynamically binds a `DynamicRepository` to the `db` context for each table, and publishes public ORM classes/errors to the global namespace.

#### **2. Repository Layer (`SheetDB/Repositories/DynamicRepository.js`)**
*   **Role:** Entity/Collection manager.
*   **Details:** Executes client CRUD requests. Intercepts modifications to execute relation validations and deletion rules (`enforceDeleteConstraints`) before sending raw operations to the Table Gateway.

#### **3. Active Record / ORM Layer (`SheetDB/ORM/BaseModel.js`)**
*   **Role:** Entity instance encapsulation.
*   **Details:** Manages the lifecycle of a single row. It binds table rows to dynamic getters/setters, parses data types, runs the validation pipeline, manages relation traversals, and maps individual active record updates (`save()`) and deletes (`delete()`).

#### **4. Table Gateway Layer (`SheetDB/TableGateway/TableGatway.js`)**
*   **Role:** Relational abstraction mapper.
*   **Details:** Bridges Javascript logic to tabular spreadsheet rows. Computes headers, keeps track of row index coordinates, parses IDs, and translates bulk requests (`deleteMany`, `updateMany`) into optimized in-memory array operations before writing.

#### **5. Data Source & File System Layer (`SheetDB/DataSource/DataSource.js`)**
*   **Role:** Physical I/O and caching client.
*   **Details:** Reads/writes directly from/to the Google Sheets API. Employs caching logic to limit roundtrips to the cloud.

