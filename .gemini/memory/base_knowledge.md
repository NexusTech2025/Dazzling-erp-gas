# DazzlingDB & SheetDB - Project Base Knowledge

This document provides a concise overview of the project structure, main components, compilation workflows, and architecture boundaries for Aira.

---

## 1. Directory Structure Overview

The project is structured into three primary sub-projects/modules and a documentation directory:

### Core Codebases
- **[DazzlingDB](e:/NAST/Dazzling/GAS-PROD/dazzling-db-prod-feature/DazzlingDB)**: The main database application and API services layer designed to run within the Google Apps Script environment.
- **[SheetDB](e:/NAST/Dazzling/GAS-PROD/dazzling-db-prod-feature/SheetDB)**: The database driver and Object-Relational Mapping (ORM) library that interfaces directly with Google Sheets.
- **[dazzlingdb-tools](e:/NAST/Dazzling/GAS-PROD/dazzling-db-prod-feature/dazzlingdb-tools)**: Node.js tooling for compiler rules, schema compilation, schema linting, API querying, and developer tasks.

### Documentation & Logs
- **[docs/changelogs/](e:/NAST/Dazzling/GAS-PROD/dazzling-db-prod-feature/docs/changelogs)**: Contains structured engineering change records (Change Logs) documenting features, bug fixes, schema shifts, or API contract updates.

---

## 2. Key Directories & Architectural Components

### A. DazzlingDB (App & Service Layer)
- **[DazzlingDB/Auth/](e:/NAST/Dazzling/GAS-PROD/dazzling-db-prod-feature/DazzlingDB/Auth)**: Implements Session Management, RBAC (Role-Based Access Control), Setup routines, and Auth bridging logic.
- **[DazzlingDB/Config/Schema/](e:/NAST/Dazzling/GAS-PROD/dazzling-db-prod-feature/DazzlingDB/Config/Schema)**: Defines table schemas in JSON format, segmented by domains (e.g., `Academic`, `Attendance`, `Auth`, `Core`, `Finance`, `Staff`, `Students`, `Test`).
- **[DazzlingDB/Config/](e:/NAST/Dazzling/GAS-PROD/dazzling-db-prod-feature/DazzlingDB/Config)**: Holds compiled schema and dependency graph runtimes:
  - `database_schema.js`: Global compiled schema registry.
  - `dependency_graph.js`: Automatically compiled foreign-key dependency relationships.
- **[DazzlingDB/DBServices/](e:/NAST/Dazzling/GAS-PROD/dazzling-db-prod-feature/DazzlingDB/DBServices)**: Implements core transactional workflows and service handlers (e.g., `AcademicService.js`, `StudentService.js`, `StaffService.js`, `DBContext.js`).
- **[DazzlingDB/QueryEngine/](e:/NAST/Dazzling/GAS-PROD/dazzling-db-prod-feature/DazzlingDB/QueryEngine)**: Implements DSL Parser, Predicate Builder, Relation Hydrator, and Projection Engine.
- **[DazzlingDB/Validate/](e:/NAST/Dazzling/GAS-PROD/dazzling-db-prod-feature/DazzlingDB/Validate)**: Implements pipeline validations (e.g., `ValidationEngine.js`).
- **[DazzlingDB/Test/](e:/NAST/Dazzling/GAS-PROD/dazzling-db-prod-feature/DazzlingDB/Test)**: System integration, bootstrap, and unit testing suites. Runs under the sandboxed `TESTING` environment.

### B. SheetDB (Database & ORM Engine)
- **[SheetDB/DataSource/](e:/NAST/Dazzling/GAS-PROD/dazzling-db-prod-feature/SheetDB/DataSource)**: Lower-level Google Sheets communication layer, processing batch reads and batch writes.
- **[SheetDB/Graph/](e:/NAST/Dazzling/GAS-PROD/dazzling-db-prod-feature/SheetDB/Graph)**: Dynamic and static relationship graph builders tracking foreign keys to enforce relational integrity and cascade-delete bounds.
- **[SheetDB/ORM/](e:/NAST/Dazzling/GAS-PROD/dazzling-db-prod-feature/SheetDB/ORM)**: ORM Models, Field types, and relation types (`HasOne`, `HasMany`, `BelongsTo`, `BelongsToPolymorphic`).
- **[SheetDB/Registries/](e:/NAST/Dazzling/GAS-PROD/dazzling-db-prod-feature/SheetDB/Registries)**: Runtime registers for Models, Validations, Polymorphic relations, and Primary Key Caches.
- **[SheetDB/SchemaDriver/](e:/NAST/Dazzling/GAS-PROD/dazzling-db-prod-feature/SheetDB/SchemaDriver)**: Handles sheet setup, structural inspections, schema validations, and multi-storage spreadsheet coordination.

### C. dazzlingdb-tools (Development Tools)
- **[dazzlingdb-tools/src/compiler/](e:/NAST/Dazzling/GAS-PROD/dazzling-db-prod-feature/dazzlingdb-tools/src/compiler)**: Builds schema dependencies, lints JSON schemas against backward/forward reference rules, and produces runtime configs.
- **[dazzlingdb-tools/src/client/actions/](e:/NAST/Dazzling/GAS-PROD/dazzling-db-prod-feature/dazzlingdb-tools/src/client/actions)**: Contains command runners to interface with the active spreadsheet/Apps Script environment.

---

## 3. Core Operational Workflows

### Schema Compilation Process
When any database table schema JSON under `DazzlingDB/Config/Schema/` is modified, the compiler must run to regenerate system-wide dependency configurations:
1. Navigate to `dazzlingdb-tools/`.
2. Run the compilation script:
   ```bash
   npm run compile-graph:prod
   ```
3. This regenerates:
   - `DazzlingDB/Config/database_schema.js`
   - `DazzlingDB/Config/dependency_graph.js`

### Testing Sandbox Flow
All tests must execute inside the sandboxed `TESTING` environment:
1. Setup sandbox context:
   ```javascript
   PropertiesService.getScriptProperties().setProperty('ENV', 'TESTING');
   ```
2. Initialize DBContext:
   ```javascript
   DBContext.getInstance().bootstrapRepositories();
   ```
3. Execute testing procedures.
4. Finally, revert database execution environment:
   ```javascript
   PropertiesService.getScriptProperties().setProperty('ENV', 'DEVELOPMENT');
   ```
