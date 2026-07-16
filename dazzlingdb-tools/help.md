# DazzlingDB Toolchain CLI Help

Compile-time linting, compilation, and documentation auditing for database
schemas across the SheetDB and DazzlingDB relational framework tiers.

  Usage:  node index.js <command> [flags]
  Alt:    npm run <alias>

---

## 1. Core CLI Commands

Low-level flags passed directly to the entrypoint:

  --lint-only         Run static schema validations and relational integrity
                      checks (PKs, nullability, FK references).

  --build             Validate all schemas then compile runtime outputs:
                        database_schema.js   — centralized runtime dictionary
                        dependency_graph.js  — directed relational chart

  --audit-docs        Audit schema JSON columns against Markdown doc tables
                      to detect documentation drift.

  --fix-fk-types      Coerce legacy FK column definitions to the uniform
                      'foreign_key' data type.

  --fix-backward-refs Add missing reverse references (belongsTo / hasMany)
                      to parent schema configurations.

  --help, -h          Show this help screen.

---

## 2. Command Parameters & Execution Flags

Control environment targets, verbosity, and output behaviour:

  Flag                Values              Default    Description
  ──────────────────  ──────────────────  ─────────  ──────────────────────────────────────────
  --env <name>        development         development  Route actions against local test_schemas/.
                      production                       Route against live DazzlingDB/Config/.
  --verbosity <N>     1  Quiet            2            Console log detail level.
                      2  Verbose
                      3  Debug / AST trace
  -vv                 (alias)             —            Equivalent to --verbosity 2.
  -vvv                (alias)             —            Equivalent to --verbosity 3 (AST trace).

---

## 3. NPM Script Alias Reference

Run from the project root with `npm run <alias>`:

### Compiler & Relational Validation Pipelines

* **`npm run lint-schema`** — Executes a static schema check loop using the default runtime settings.
* **`npm run lint-schema:dev`** — Validates sandbox models under the `./test_schemas/` directory space.
* **`npm run lint-schema:prod`** — Validates live production database configurations inside the primary repository.
* **`npm run compile-graph`** — Compiles database schema blueprints without explicit environment bounds.
* **`npm run compile-graph:dev`** — Compiles sandbox schemas and outputs files to `./test_build/`.
* **`npm run compile-graph:prod`** — Compiles official schemas directly into production configurations (`DazzlingDB/Config/`).
* **`npm run audit-schema`** — Audits documentation tables across default schema environments.
* **`npm run audit-schema:dev`** — Runs documentation sync validation over sandbox testing assets.
* **`npm run audit-schema:prod`** — Verifies production metadata definitions against official specification sheets.
* **`npm run fix-fk-types`** — Performs automatic column data-type normalization migrations.
* **`npm run fix-backward-refs`** — Re-aligns relational symmetry across multi-table schema borders.
* **`npm run help`** — Renders this help console document screen.

### API Client Utilities & Remote Network Actions

Usage:
  npm run <command> [arguments]

Available Commands
──────────────────────────────────────────────────────────────────────────────

  - api-login

        Authenticate workspace credentials against the server gateway and
        cache the session token in the local filesystem for subsequent API
        requests.


  - api-query <table>

      Query a target database sheet model table and display matching records
      in a colorized console grid.


  - api-sheet-query <payload_file | raw_json>

      Execute custom Domain Specific Language (DSL) queries or JSON payloads
      against the Sheet API gateway.


  - api-batch-insert <action_key> <table_name> <payload_file | raw_json>

      Stream an array of homogeneous records into a target table using a
      single-pass batch execution pipeline with centralized error grouping
      for improved performance.


  - api-admin-action <admin_action_key> [payload_file | raw_json]

      Execute privileged server-side administrative utilities such as cache
      purging, table repair, and maintenance operations.

      Note:
        • Action keys must begin with the "admin_" prefix.
        • Intended for administrative use only.


  - api-simulate-teacher-attendance [start_date] [end_date]

      Generate simulated faculty attendance records for the specified date
      range.

      Features:
        • Daily attendance generation
        • Biometric timing simulation
        • Automatic Sunday exclusion
        • Dynamic proration calculations


  - clean-courses [--delete]

      Audit course records to identify entries without active tracking
      relationships.

      Options:
        --delete    Remove orphaned course records after auditing.


  - push-apps

      Deploy the latest SheetDB framework updates, service-layer changes,
      and Google Apps Script transformations.

──────────────────────────────────────────────────────────────────────────────

---

## 4. Practical Implementation Blueprints

```bash
# Example 1: Execute production linter validations with extreme trace debugging logs
npm run lint-schema:prod -- -vvv

# Example 2: Run a structural audit checking schema properties against Markdown columns
node index.js --audit-docs --env production

# Example 3: Execute bulk course record inserts using a local asset data array source
npm run api-batch-insert data_create Course ./payloads/new_courses_manifest.json -- --env development

# Example 4: Flush remote runtime indexes to eliminate memory fragmentation risks
npm run api-admin-action admin_purge_cache -- --env production

```

---

```
╔══════════════════════════════════════════════════════════════════════╗
║  ⚠  CRITICAL DATA WARNING                                           ║
╠══════════════════════════════════════════════════════════════════════╣
║  Bulk tools (api-batch-insert, api-simulate-teacher-attendance)      ║
║  push sequential updates over live network connections.              ║
║                                                                      ║
║  When touching production data, wrap multi-table workflows inside    ║
║  an atomic transaction manager to guarantee full LIFO rollback       ║
║  safety if a script failure occurs mid-stream.                       ║
╚══════════════════════════════════════════════════════════════════════╝
```