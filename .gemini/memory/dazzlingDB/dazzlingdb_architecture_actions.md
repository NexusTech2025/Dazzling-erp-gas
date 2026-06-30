# DazzlingDB System Architecture & Runtime State Briefing

## 1. Core System Architecture Overview & Architectural State Analysis

DazzlingDB is a schema-first, protocol-driven relational domain layer built over Google Apps Script (GAS) and Google Sheets. The project utilizes a Command-Action architectural pattern where incoming HTTP traffic is parsed, sanitized, authorized, and dispatched to individual transaction-safe `BaseAction` instances.

An architectural review of the provided baseline source code (`ApiDispatcher.js` and `BaseActions.js`) along with the developer handbook (`REST-api-doc.md`) confirms the operational state of the engine:

* **Decoupled Gateway Interception:** The execution architecture decouples request routing from business evaluation via three distinct registries inside `ApiDispatcher.js` (*Standard*, *Admin*, and *AdvancedSheet*).
* **Template Method Execution Lifecycle:** Business domain logic inherits from `BaseAction`, enforcing an invariant runtime lifecycle hook routine (`run() -> _validate() -> _authorize() -> handle() -> formatSuccessResponse() / formatFailureResponse()`).
* **Unified Error Masking:** Low-level database and framework validation exceptions are intercepted by `ErrorMappingRegistry` inside the base controller, shielding the frontend from raw execution trace leaks while exposing standardized client-facing error structures.

---

## 2. High-Level Request Execution Topology

The ASCII flow chart below traces an external RPC/REST JSON application client payload as it routes through the top two system layers down to the persistence infrastructure:

```text
    +--------------------------------------------------------+
    | PRESENTATION LAYER: Client JSON Request Payload Body   |
    | { "action": "student_register", "payload": { ... } }   |
    +--------------------------------------------------------+
                                |
                                v
    +--------------------------------------------------------+
    | GATEWAY TIER: ApiDispatcher.dispatch(e)                |
    | 1. Parses HTTP event payload contents                  |
    | 2. Maps action token string to target registry category|
    +--------------------------------------------------------+
            |                        |                  |
    (Key: "admin_*")         (Key: "sheet_*")     (Standard Keys)
            |                        |                  |
            v                        v                  v
+------------------------+ +-------------------+ +-------------------------+
| Admin Registry         | | Advanced Registry | | Standard Action Registry|
| (Metadata, Cache, etc.)| | (Sheet Batch Read)| | (Core Business Domains) |
+------------------------+ +-------------------+ +-------------------------+
            |                        |                  |
            +------------------------+------------------+
                                |
                                v
    +--------------------------------------------------------+
    | SECURITY FAÇADE: AuthBridge.resolveContext(token)      |
    | Reconstructs explicit user session context boundaries  |
    +--------------------------------------------------------+
                                |
                                v
    +--------------------------------------------------------+
    | CORE EXECUTION LOOP: BaseAction.run() (Template Method)|
    | -> Execs this._validate() (Payload Shape Check)        |
    | -> Execs this._authorize() (Declarative RBAC Check)     |
    +--------------------------------------------------------+
                                |
                                v
    +--------------------------------------------------------+
    | DOMAIN SERVICE BUSINESS LAYER: ConcreteAction.handle() |
    | Coordinated inside DBServices (e.g. StudentService)    |
    | Runs multi-table adjustments inside TransactionTracker |
    +--------------------------------------------------------+
                                |
                                v
    +--------------------------------------------------------+
    | DATA PERSISTENCE LAYER: TableGateway / SheetDataSource |
    | High-performance locked in-memory RAM array caching    |
    | Single-pass multi-row clear and bulk-overwrite writes  |
    +--------------------------------------------------------+
                                |
                                v
    +--------------------------------------------------------+
    | PHYSICAL BASE: Google Sheets Distributed Worksheets   |
    +--------------------------------------------------------+

```

---

## 3. Unified Action Registry & Domain Service Inventory

Below is the text-based inventory of all functional actions extracted directly from the system registries.

### A. Authentication & Identity Control Sub-Domain

* **`user_login`**: Authenticates credentials against stored password hashes and returns a signed cryptographic session `token`.
* **`user_register`**: Safely provisions new system user profiles with specific organizational roles, ensuring string normalization rules are satisfied.
* **`user_logout`**: Destroys the active session context wrapper and invalidates the passed session token instantly.
* **`auth_delete_many_users`**: Performs a bulk delete on user profiles, blocking self-deletion or administrative eviction while cascading down to clean out related sessions.
* **`auth_delete_many_sessions`**: Purges multiple session rows from the auth sheet data stores in a single-pass execution frame.

### B. Student Lifecycle Management Sub-Domain

* **`student_register`**: Atomically orchestrates the creation of a unified student graph across the student profile, address, and contact worksheets in one transaction.
* **`student_delete`**: Permanently evicts a student record, enforcing an implicit `RESTRICT` rule if financial records remain active, while cascading deletions to auxiliary tables.
* **`student_add_lead`**: Injects unverified student lead opportunities into the pre-admission staging system fields for marketing tracking.
* **`student_delete_many_students`**: Runs bulk deletions across a set of student records, performing cross-table data integrity checks to filter out and block deletions of active accounts.

### C. Academic & Curriculum Control Sub-Domain

* **`academic_create_course_type`**: Appends unique academic classifications (e.g., Vocational, Academy) to the Master Course type registries.
* **`academic_create_course`**: Registers standalone subjects or high-level program modules, defining base fee structures.
* **`academic_create_batch`**: Instantiates a classroom cohort assigned to a course, configuring capacity constraints and structured JSON schedules.
* **`academic_create_package`**: Supports bundled selections with automated course normalization and automatic perk assignment rules matching the target class tier.
* **`academic_update_package`**: Triggers full synchronization of multi-course item groupings and metadata parameters within a transaction boundary.
* **`academic_delete_package`**: Evaluates active client bindings via `RESTRICT` constraint checks before executing a cascade deletion of perks and grouped course items.
* **`academic_enroll_student`**: Establishes a formal academic enrollment link by injecting records into the student administrative contracts ledger.
* **`student_withdraw_subject`**: Modifies ongoing contract variables, releasing an allocated class seat safely without invalidating base financial histories.
* **`student_upgrade_package`**: Migrates standalone program agreements to complex bundle models, executing live credit-balance conversions across active ledgers.
* **`student_verify_access`**: Evaluates real-time compliance matrices, executing sister-suspensions on classroom seats if payment defaults exceed authorized thresholds.
* **`academic_delete_many_enrollments`**: Executes bulk deletions on structural agreements, preventing drops if fee collections have initialized.
* **`academic_delete_many_packages`**: Performs single-pass in-memory purging across multiple bundled configs, shielding active contract parameters from corruption risks.
* **`academic_delete_many_courses`**: Removes unreferenced core subject records from the persistence tiers while catching active batch dependency locks.
* **`academic_delete_many_course_types`**: Mass purges root structural categories, failing gracefully via runtime check validation if linked courses exist.

### D. Staff, Payroll, & HR Sub-Domain

* **`staff_onboard_teacher`**: Registers active faculty member profiles inside the staff registry directory structures.
* **`staff_update_teacher`**: Applies differential structural modifications onto an active teacher row while checking configuration validations.
* **`staff_assign_subjects`**: Links explicit course registry identifiers onto faculty records using relational joint tracking sheets.
* **`staff_set_salary_config`**: Maps fixed, hourly, or variable payroll structure matrices directly onto target staff profiles.
* **`staff_record_payment`**: Generates a physical cash flow entry tracking administrative salary payouts and ledger disbursements.
* **`staff_add_document`**: Binds digital asset URLs or verification identifiers onto internal employee records.
* **`staff_delete_many_teachers`**: Processes mass terminations inside a locked transaction frame, blocking drops if active schedules or unpaid balance sheets are found.

### E. Financial Ledger & Cash Flow Registers Sub-Domain

* **`finance_delete_many_fee_accounts`**: Deletes student financial tracking sheets, applying strict validation blocks if any historical payments are present.
* **`finance_delete_many_installments`**: Mass-purges payment steps, automatically calling parent adjustments to recalculate residual dues across sub-ledgers.
* **`finance_delete_many_payments`**: Drops transaction records, auto-reverting historical cash distributions from installment sheets and master accounts.
* **`finance_delete_many_adjustments`**: Reverts localized ledger balance modifications, dynamically realigning system account summaries.

### F. Attendance Logging Framework Sub-Domain

* **`staff_mark_attendance`**: Injects or updates standard individual attendance profiles for faculty targets on a particular calendar date.
* **`staff_mark_attendance_bulk`**: Executes high-performance array operations to log multi-teacher time records across shared date criteria.
* **`staff_query_attendance`**: Fetches faculty log rows, calculating real-time shift metrics using cross-realm safe processing methods.
* **`student_mark_attendance`**: Upserts custom day logs for a student profile, checking composite unique identifiers to prevent duplicate cell entries.
* **`student_mark_attendance_bulk`**: Commits mass student presence logs inside localized buffers, avoiding $N+1$ single-row update loops.
* **`student_query_attendance`**: Hydrates student attendance arrays with student names, batch data, and dynamic calculated duration metrics.

### G. Class Test Performance System Sub-Domain

* **`test_create`**: Establishes assessment blueprints tied to specific batches, validating passing ranges and score boundaries.
* **`test_save_marks_bulk`**: Performs single-pass upserts of scores, bounds-checking results and mapping absences onto normalized values.
* **`test_query_report`**: Generates dynamic metrics, sorting student ranks via Standard Competition Ranking alongside group metrics.

### H. Generic CRUD Gateway Systems Sub-Domain

* **`data_query`**: Processes flexible structural queries utilizing the JSON-based Domain-Specific Language (DSL) compilation engine.
* **`data_create`**: Bypasses specialized business hooks to insert verified row schemas directly into whitelist-approved spreadsheets.
* **`data_update`**: Modifies existing tracking properties surgically, requiring an explicit root parameter `id` and differential `data` blocks.
* **`data_delete`**: Drops physical sheet records instantly, relying on manual upstream validations to avoid leaving broken dependencies.
* **`data_delete_many`**: Runs rapid, bulk row extractions for whitelisted entities, analyzing downstream tables for active references before modifying records.

### I. Administrative Control & Self-Healing Utilities Sub-Domain

* **`admin_system_status`**: Polls connection runtimes, returning current container indicators and infrastructure health diagnostics.
* **`admin_bootstrap`**: One-time generation routine that formats required worksheets and builds base data schemas from scratch.
* **`admin_get_schema`**: Outputs compiled master definitions, exposing JSON rules to the client.
* **`admin_analyze_table`**: Runs a structural linter across rows, identifying corrupted formatting discrepancies or header misalignment issues.
* **`admin_repair_table`**: Self-healing utility that rebuilds missing column definitions and formats sheet layouts without data loss.
* **`admin_peek_data`**: Pulls historical tail sequences from a designated table workspace, streamlining administration verification testing.
* **`admin_cache_analyze`**: Computes memory storage allocations, mapping out active index performance indicators inside the `PrimaryKeyCache`.
* **`admin_purge_cache`**: Explicitly flushes internal caching registers to clean out stale tracking coordinates across sheet shifts.
* **`admin_purge_database`**: Erases records across administrative tables while maintaining row 1 column structural headers intact.

### J. Advanced Spreadsheet Tier Sub-Domain

* **`sheet_batch_read`**: Minimizes API request counts by fetching multi-sheet cell contexts in a single operation.
* **`sheet_get_accounting_data`**: Compiles financial transaction data streams to drive complex dashboard calculations.

---

## 4. Technical Debt & Relational Structuring Gaps Baseline

Before we initiate targeted development discussions on the `ApiDispatcher` and `DBServices` layers, note these structural nuances currently embedded in the codebase:

```text
    +-------------------------------------------------------------------------+
    |                         ARCHITECTURAL WATCH-ITEMS                       |
    +-------------------------------------------------------------------------+
    | 1. CRITICAL: "data_delete_many" executes generic validations but is     |
    |    restricted to a whitelisted subset of tables. Attempting to use it   |
    |    on core operational models (e.g., User, Student) will reject with    |
    |    a clear ActionValidationError.                                       |
    |                                                                         |
    | 2. PAYLOAD BOUNDARY ENFORCEMENT: ApiDispatcher expects all incoming     |
    |    parameters to be nested inside the "payload" block. Any parameter    |
    |    leaked to the root JSON block will trigger an immediate execution    |
    |    halt via the Gateway interceptor.                                    |
    +-------------------------------------------------------------------------+

```

The system is properly configured to support custom workflows. Let me know which specific service domain logic or endpoint coordination behavior we should analyze or refactor first.