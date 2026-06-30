# DazzlingDB Toolchain CLI & Compiler Architecture Specification

## 1. Executive Architectural System Design

The `dazzlingdb-tools` suite is an out-of-container, build-time compilation, validation, and network synchronization layer designed to interface directly with SheetDB and DazzlingDB (the server-side Google Apps Script/Google Sheets ORM). Because Google Apps Script (GAS) runs within a highly constrained execution sandbox with a 6-minute execution window, performing intensive schema reflection or structural validation at runtime degrades efficiency.

To optimize performance, `dazzlingdb-tools` acts as a **Schema-First Relational Architecture Compiler**. It parses decentralized JSON files locally, executes rigid constraint audits, and outputs performance-tuned runtime abstractions (`database_schema.js` and `dependency_graph.js`) that are consumed directly by the server-side persistence engines.

### 1.1 Complete Dual-Tier Subsystem Flow Topology

The system is bifurcated into two core architectural pipelines:

1. **Compile-Time Engineering Pipeline:** Handles loading, static analysis, type assertion, metadata injection, and directed adjacency dependency serialization.
2. **Client-Time Gateway Pipeline:** Governs secure session caching, relational data hydration rendering, automated course cleanups, and batch data processing engines.

```default
                                 [ AUTHORITATIVE MODULAR SCHEMAS ]
                                   DazzlingDB/Config/Schema/...
                                                 │
                                                 ▼
                             ┌───────────────────────────────────────┐
                             │           index.js Core Boot          │
                             └───────────────────┬───────────────────┘
                                                 │
                   ┌─────────────────────────────┴─────────────────────────────┐
                   ▼ (Compile-Time Subsystem)                                  ▼ (Client-Time Subsystem)
      ┌─────────────────────────┐                                 ┌─────────────────────────┐
      │   SchemaLinter Engine   │                                 │   api_client.js Core    │
      └───────────┬─────────────┘                                 └────────────┬────────────┘
                  │ (Passes Verification)                                      │ (Dispatches Tokenized Requests)
                  ▼                                                            ▼
      ┌─────────────────────────┐                                 ┌─────────────────────────┐
      │ Runtime Schema Compiler │                                 │ HomogeneousBatchEngine  │
      └───────────┬─────────────┘                                 └────────────┬────────────┘
                  ├──────────────────────────────┐                             │ (Pipes Ordered Rows)
                  ▼                              ▼                             ▼
      ┌─────────────────────────┐    ┌─────────────────────────┐   ┌─────────────────────────┐
      │    database_schema.js   │    │   dependency_graph.js   │   │  Remote GAS Production  │
      │   (Metadata + Systems)  │    │  (Directed Adjacency Map)│   │    Singleton Target     │
      └─────────────────────────┘    └─────────────────────────┘   └─────────────────────────┘

```

---

## 2. Compile-Time Subsystem Engines & Codebase Mechanics

### 2.1 Environmental Path Router (`loadSchemas`)

The application boots by parsing CLI parameters to bind the active environment framework via `tool_config.json`. The recursive scanner iterates over folder scopes, maps schemas into category models, and formats two core components: a global `flatSchemas` registry mapped by table name and a deep tree layout called `categoryStructure`.

```javascript
// Environment target path mappings resolved from config dynamically
const CONFIG_PATH = path.resolve(__dirname, 'config', 'tool_config.json');

```

### 2.2 System Column Injection Criteria

When writing out production contracts, the compiler acts upon string models and stamps specialized transactional system metadata attributes onto every model to protect against race conditions and facilitate LIFO rollbacks:

* **String Capacity Guarantee:** Every column with a primitive type definition of `"string"` lacking an explicit limit is assigned a property mapping of `maxLength: 255` to safely allocate memory buffers.
* **System Columns Isolation:** 3 foundational metadata rows are automatically injected during serialization:
```json
"__tx_id": { "type": "string", "system": true, "required": false, "editable": false },
"__tx_status": { "type": "string", "choices": ["PENDING", "COMMITTED", "FAILED"], "default": "PENDING", "system": true },
"__created_at": { "type": "datetime", "autoNowAdd": true, "system": true }

```



### 2.3 Relational Type Integrity Proofing

To guarantee that cascade deletion arrays and sequential database updates evaluate cleanly, the build pipeline enforces data type compatibility across related tables. Foreign key relationships must match the exact primitive data type of the target parent primary key, which can be expressed as:

$$\text{Relation Pair Harmony} \implies \left( \text{Model}_{\text{Child}}.\text{Foreign_Key}_{\text{Type}} \equiv \text{Model}_{\text{Parent}}.\text{Primary_Key}_{\text{Type}} \right)$$

---

## 3. Core Compile-Time CLI Commands Reference Manual

These commands run within `index.js` to manage the static validation pipeline.

### 3.1 `--lint-only`

* **NPM Alias Hook:** `npm run lint-schema` | `npm run lint-schema:dev` | `npm run lint-schema:prod`
* **Underlying Handler:** Instantiates the `SchemaLinter` object passing the flat mapping array and calls `.lint()`.
* **Internal Behavior:** Runs four sequential evaluation strategies (`PKRule`, `ForwardRefRule`, `BackwardRefRule`, `NullabilityRule`) wrapped within isolated exception traps to catch schema anomalies. If error contexts are generated, it calls `process.exit(1)` to block the deployment pipeline.

### 3.2 `--build`

* **NPM Alias Hook:** `npm run compile-graph` | `npm run compile-graph:dev` | `npm run compile-graph:prod`
* **Underlying Handler:** Executes `compileRuntimeSchema()` and `GraphBuilder.write()`.
* **Internal Behavior:** Evaluates linter policies. If valid, it writes out the global database wrapper `database_schema.js` and transforms relationship definitions into a single directed adjacency map file (`dependency_graph.js`). This approach allows the server-side ORM to handle cascade triggers without performing expensive runtime calculations over multiple spreadsheet files.

### 3.3 `--audit-docs`

* **NPM Alias Hook:** `npm run audit-schema` | `npm run audit-schema:dev` | `npm run audit-schema:prod`
* **Underlying Handler:** Invokes `auditSchemaDocs(SCHEMA_DIR, DOCS_DIR)`.
* **Internal Behavior:** Scans column arrays inside JSON model definitions and checks them against the corresponding column descriptions in the markdown documentation files. Throws a build failure if structural inconsistencies or missing column keys are detected.

### 3.4 `--fix-fk-types`

* **NPM Alias Hook:** `npm run fix-fk-types`
* **Underlying Handler:** Invokes `fixFkTypes(SCHEMA_DIR)`.
* **Internal Behavior:** A data migration utility that modifies raw localized JSON files to standardize old custom relationships into explicit, uniform relationship models.

### 3.5 `--fix-backward-refs`

* **NPM Alias Hook:** `npm run fix-backward-refs`
* **Underlying Handler:** Invokes `fixBackwardRefs(SCHEMA_DIR)`.
* **Internal Behavior:** Analyzes child-to-parent associations across tables and automatically updates parent models with missing backward tracking relationship declarations.

---

## 4. Remote Client Subsystem Engine & API Commands Manual

The files under `src/client/` handle runtime network synchronization with the production environments, leveraging Node.js native fetch interfaces to process data payloads.

### 4.1 Authentication Caching Architecture

Network operations utilize cached access states to secure and streamline API calls:

```default
 [ npm run api-login ] ──► Reads settings.json Credentials ──► Dispatches 'user_login'
                                                                     │
                                                                     ▼
 [ Local JSON Cache ] ◄── Writes session_token.json ◄── Returns Encrypted Token

```

* **`api-login` (`node src/client/actions/login.js`):** Authenticates a user against the remote environment. It extracts username and password values from `settings.json`, executes a token call to the `user_login` endpoint, and stores the resulting credential string inside `session_token.json` to authenticate subsequent script executions.

---

### 4.2 Core Network Data Access Commands List

#### `api-query <Table>`

* **Invocation:** `npm run api-query -- <Table_Name> [--where JSON] [--include Array]`
* **Execution Block:** `src/client/actions/query.js`
* **Internal Architecture:** Dispatches a structured request to the `data_query` endpoint. It captures the resulting data rows and pipes them into the `display_controller.js` decoupling pipeline. This engine handles sorting and formatting operations before outputting a formatted text matrix via `console.table`.

#### `api-sheet-query <Payload>`

* **Invocation:** `npm run api-sheet-query -- <payload_file_or_raw_json> [--output override_path]`
* **Execution Block:** `src/client/actions/sheet_query.js`
* **Internal Architecture:** Bypasses table abstracts to pass custom SheetDB DSL JSON queries directly to the server's data processing gateway, outputting colorized JSON objects to the console or an explicit file target.

#### `api-batch-insert`

* **Invocation:** `npm run api-batch-insert -- <action_name> <table_name> <payload_file_or_json>`
* **Execution Block:** `src/client/actions/batch_insert.js`
* **Internal Architecture:** Instantiates the `HomogeneousBatchEngine` to stream arrays of data records. To protect server constraints, it executes single-row inserts using sequential loops. If a validation error occurs on a row, the engine logs the exception to a failure context registry and continues processing subsequent rows, generating a telemetry report when complete:

```javascript
// Homogeneous processing loop prevents single failures from crashing whole streams
for (let index = 0; index < records.length; index++) {
  try {
    const response = await callApi(actionName, apiPayload);
    successManifest.push({ inputPayloadIndex: index, resolvedId: response[primaryKeyField] });
  } catch (exception) {
    failureManifest[index] = { message: exception.message, attemptedData: currentItem };
  }
}

```

#### `api-admin-action`

* **Invocation:** `npm run api-admin-action -- <admin_action_key> [payload_file_or_json]`
* **Execution Block:** `src/client/actions/admin_action.js`
* **Internal Architecture:** A low-level administration proxy that validates that incoming action parameters are prefixed with `admin_` before dispatching them. This utility bypasses standard application business rules to perform maintenance operations, such as calling `admin_repair_table` or `admin_purge_cache`.

#### `clean-courses`

* **Invocation:** `npm run clean-courses [-- --delete]`
* **Execution Block:** `src/client/actions/clean_courses.js`
* **Internal Architecture:** A business cleanup script that queries the database for all available courses, requesting explicit hydration hooks for their `batches` and `enrollments` relations. It processes the returned relational data graphs inside local memory; rows registering zero links are flagged as orphaned. Passing the `--delete` flag triggers automated batch deletions to clear out unreferenced items.

#### `push-apps`

* **Invocation:** `npm run push-apps [-- -s | -d]`
* **Execution Block:** `src/client/actions/push_apps_script.js`
* **Internal Architecture:** A code synchronization coordinator. It reads local deployment configurations, switches directories to resolve local workspace scopes, and triggers automated `clasp push` shell processes to push script changes directly into the SheetDB or DazzlingDB Google Apps Script containers.

---

## 5. Summary Matrix of Available CLI Core Commands

The following reference table maps the full toolchain CLI interface across compile-time automation tasks and client-side runtime integrations:

| NPM Execution Script | Script Purpose & Scope | Target Subsystem Path File | Primary Command Flags |
| --- | --- | --- | --- |
| `npm run help` | Prints the toolchain user manual via colorized marked AST streams. | `index.js` | `--help` |
| `npm run lint-schema` | Performs static analysis and schema validation on source structures. | `index.js` | `--lint-only` |
| `npm run compile-graph` | Compiles optimization assets and directed adjacency maps. | `index.js` | `--build` |
| `npm run audit-schema` | Cross-checks JSON model definitions with Markdown documentation. | `index.js` | `--audit-docs` |
| `npm run fix-fk-types` | Auto-migrates legacy key configurations into standardized structures. | `index.js` | `--fix-fk-types` |
| `npm run fix-backward-refs` | Generates missing reverse relationship rows in parent schemas. | `index.js` | `--fix-backward-refs` |
| `npm run api-login` | Authenticates credentials and stores the token in local storage. | `src/client/actions/login.js` | None (Reads file) |
| `npm run api-query` | Queries database tables and displays results in text tables. | `src/client/actions/query.js` | `--where` | `--include` |
| `npm run api-sheet-query` | Passes custom JSON payloads directly to the Sheet API gateway. | `src/client/actions/sheet_query.js` | `--output <path>` |
| `npm run api-batch-insert` | Streams sequential data inserts with validation error grouping. | `src/client/actions/batch_insert.js` | `<action> <table_name>` |
| `npm run api-admin-action` | Dispatches administrative tasks with strict `admin_` prefix checks. | `src/client/actions/admin_action.js` | `<admin_action_key>` |
| `npm run clean-courses` | Identifies and deletes course records lacking active relations. | `src/client/actions/clean_courses.js` | `--delete` |
| `npm run push-apps` | Coordinates clasp deployment sequences across target script environments. | `src/client/actions/push_apps_script.js` | `-s` (SheetDB) | `-d` (Dazzling) |

> [!WARNING]
> **Axiomatic Enforcement Directive:** All command actions acknowledge environment flags (`--env development` vs `--env production`). Sandbox testing schemas reside strictly within `./test_schemas` and write builds to `./test_build` to prevent unintended mutations to the production schema configurations located under `../DazzlingDB/Config/Schema`.