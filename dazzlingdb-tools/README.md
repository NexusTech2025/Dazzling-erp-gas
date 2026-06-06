# DazzlingDB Unified Tooling (`dazzlingdb-tools`)

A unified Node.js CLI tool suite and API client utility package for **DazzlingDB**. It combines compile-time schema validation and dependency graph compilation with client-side execution scripts to interact with the DazzlingDB API.

---

## Directory Structure

```text
dazzlingdb-tools/
├── package.json               # Shared package configurations and scripts
├── index.js                   # Compiler & linter CLI Entrypoint
├── README.md                  # Package documentation and usage examples
├── config/
│   └── tool_config.json       # Path configurations for development and production environments
├── data/                      # Local data cache, active sessions, and metadata lists
│   ├── session_token.json     # Cached authentication token
│   └── memory/                # Execution log dumps and query cache files
├── payloads/                  # Directory for JSON query filters and payloads
├── responses/                 # Output directory for query responses
├── test_schemas/              # Local copy of schemas for sandbox testing (dev env)
├── test_build/                # Output directory for sandbox compiled contracts (dev env)
└── src/
    ├── compiler/              # Schema compiler & validation strategies
    │   ├── SchemaLinter.js    # Linter orchestrator
    │   ├── GraphBuilder.js    # Dependency graph generator
    │   └── rules/
    │       ├── BaseRule.js
    │       ├── PKRule.js
    │       ├── ForwardRefRule.js
    │       ├── BackwardRefRule.js
    │       └── NullabilityRule.js
    ├── client/                # Client-side API execution utilities
    │   ├── api_client.js      # Native fetch-based HTTP API Client
    │   ├── display_controller.js # Prettified, colorized console output formatter
    │   └── actions/
    │       ├── login.js       # Authentication action wrapper
    │       ├── query.js       # Database querying action wrapper
    │       ├── run_action.js  # Generic action execution wrapper
    │       └── clean_courses.js # Course audit and cleanup routine
    ├── logger/
    │   └── Logger.js          # Colored logger utility with ANSI escape codes
    └── exceptions/
        └── Exceptions.js      # Custom compilation exception classes
```

---

## Setup and Configuration

Configure your environment paths in `config/tool_config.json`:

```json
{
  "development": {
    "schemaDir": "./test_schemas",
    "targetSchemaJs": "./test_build/database_schema.js",
    "targetGraphJs": "./test_build/dependency_graph.js"
  },
  "production": {
    "schemaDir": "../DazzlingDB/Config/Schema",
    "targetSchemaJs": "../DazzlingDB/Config/database_schema.js",
    "targetGraphJs": "../DazzlingDB/Config/dependency_graph.js"
  }
}
```

---

## Scripts & CLI Commands

All commands should be executed from the `dazzlingdb-tools/` directory.

### 1. Compile-Time Schema Linter
Validate all schemas for primary key rules, forward references, relational symmetry (backward references), and nullability constraints.

* **Development (test_schemas/)**:
  ```bash
  npm run lint-schema:dev
  ```
* **Production (Official Schemas)**:
  ```bash
  npm run lint-schema:prod
  ```
* **Verbosity levels**: Append `-- -vv` (Verbose) or `-- -vvv` (Debug Trace) to inspect details:
  ```bash
  npm run lint-schema:dev -- -vvv
  ```

### 2. Schema Compiler & Graph Builder
Perform full schema validation. If validation passes, compile the unified database schema contract (`database_schema.js`) and build the directed dependency graph (`dependency_graph.js`).

* **Development (Writes to test_build/)**:
  ```bash
  npm run compile-graph:dev
  ```
* **Production (Writes directly to DazzlingDB/Config/)**:
  ```bash
  npm run compile-graph:prod
  ```

### 3. API Login & Session Authentication
Log in with configured credentials and cache the session token locally for subsequent commands.
```bash
npm run api-login
```

### 4. Database Query Tool
Query any database table using flexible CLI flags or custom JSON query files. Renders output in colorized, aligned tabular forms or prettified JSON.
```bash
npm run api-query Course
```

### 5. Automated Course Cleanup Routine
Audit the database to find orphaned courses.
```bash
npm run clean-courses
```
To delete orphaned records:
```bash
npm run clean-courses --delete
```
