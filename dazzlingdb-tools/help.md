# DazzlingDB Toolchain CLI Help

This utility provides compile-time linting, compilation, and documentation auditing for database schemas.

## Available Commands
- `--lint-only`    Runs static schema validations and relational linter checks.
- `--build`        Validates all schemas and compiles runtime contracts (`database_schema.js` and `dependency_graph.js`).
- `--audit-docs`   Audits schema JSON columns against Markdown documentation table columns.
- `--fix-fk-types`  Migrates and corrects foreign key column types to 'foreign_key'.
- `--fix-backward-refs` Adds missing reverse relationship definitions to parent schemas.
- `--help, -h`     Displays this help utility.

## Available Arguments & Flags
- `--env <name>`   Sets execution environment. Options: `production` | `development` (default: `production`).
- `--verbosity <N>` Sets verbosity logs: `1` (Quiet), `2` (Verbose), or `3` (Debug Trace).
- `-vv, -vvv`      Shorthand alias flags for verbosity levels 2 and 3 respectively.

## NPM Script Command Aliases
You can execute these aliases directly from the `dazzlingdb-tools/` folder:

### Linter & Compiler Tasks
- `npm run lint-schema:prod`    Validate production schemas.
- `npm run lint-schema:dev`     Validate development sandbox schemas (contains intentional failures).
- `npm run compile-graph:prod`  Compile production schemas and dependency graph.
- `npm run compile-graph:dev`   Compile development schemas and sandbox graph.
- `npm run audit-schema:prod`   Audit production schemas against Markdown tables.
- `npm run audit-schema:dev`    Audit development schemas against Markdown tables.
- `npm run fix-fk-types`        Auto-migrate foreign key column types to 'foreign_key'.
- `npm run fix-backward-refs`   Auto-add missing reverse relationship mappings.
- `npm run help`                Show this help console screen.

### API Client Utilities
- `npm run api-login`           Login with credentials and cache the session token.
- `npm run api-query <Table>`   Query DazzlingDB API for a specific table (e.g. `Course`).
- `npm run api-sheet-query <Payload>` Query DazzlingDB Sheet API using a JSON payload. Use `--output [override_path]` to persist results.
- `npm run clean-courses`       Audit the database for orphaned courses. Use `--delete` to clean them.
- `npm run push-apps`           Push local SheetDB and DazzlingDB changes to Google Apps Script.

## Practical Examples
```bash
# Perform linter checks on production schemas:
node index.js --lint-only --env production

# Compile schemas and relationship graph for development sandbox:
node index.js --build --env development

# Run documentation columns and schema sync audit:
node index.js --audit-docs --env production
```
