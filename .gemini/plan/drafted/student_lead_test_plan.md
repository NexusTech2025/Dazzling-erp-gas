# StudentLead Registration & Retrieval Test Plan

This document outlines the test cases and execution plan for the Student Lead Management API, aligned with the [DazzlingDB API Test Pattern Rulebook](e:/NAST/Dazzling/GAS/.gemini/memory/dazzlingDB/apitest_pattern_rulebook.md).

---

## 1. Test Objectives
Assert and verify the capability of registering a student lead through the public API dispatcher and subsequently retrieving that lead via the query engine, ensuring relational integrity and transaction safety.

## 2. Test Cases

### TC-Lead-01: Happy Path Registration
* **Action**: Register a student lead with dynamic/unique credentials and an active batch link.
* **Assertions**:
  * Response contains a generated `lead_id` starting with `"SLD-"`.
  * Returned properties (`student_name`, `batch_id`) match the registration payload.
  * Default flags (e.g., `is_registered: false`) are correctly initialized.

### TC-Lead-02: Query Engine Lead Retrieval
* **Action**: Retrieve the registered lead using the `data_query` endpoint filtered by `lead_id`.
* **Assertions**:
  * Query response contains the target record in the `data` array.
  * Recovered fields match the initial registration state.

### TC-Lead-03: Mandatory Parameter Sanity Check (Negative Flow)
* **Action**: Dispatches registration calls omitting mandatory fields (`leadData`, `student_name`, `phone`, `batch_id`).
* **Assertions**:
  * Calls throw expected exception messages.
  * Server responds with the standard error response envelope.

### TC-Lead-04: API Response Envelope Format Verification
* **Action**: Invokes the raw gateway dispatcher directly via a mock event to inspect the outer JSON response envelope structure.
* **Assertions**:
  * **Success Envelope**: Verifies `success: true`, presence of core payload fields inside `data` (including `_presentation.toast_message`), numeric `context.execution_time_ms`, mutation metrics (`context.mutated_records`), and standard `meta` block (version, environment, timestamp).
  * **Failure Envelope**: Verifies `success: false`, structured error properties inside `error` (`code`, `message`, optional `details`), transaction metrics, and correlated logging ID (`meta.correlation_id`).

---

## 3. Test Alignment & Implementation Update

The existing test file [StudentLead_ApiTest.js](e:/NAST/Dazzling/GAS/DazzlingDB/apitest/StudentLead_ApiTest.js) has been updated to cover all the cases above, resolving the following previous violations of the [API Test Pattern Rulebook](e:/NAST/Dazzling/GAS/.gemini/memory/dazzlingDB/apitest_pattern_rulebook.md):
1. **Rule AT-13 (Dynamic Unique Credentials Violation)**: Added dynamic suffixes to names and random numbers to email/phone values to guarantee unique runs.
2. **Rule AT-17 (Mandatory finally Block Violation)**: Encapsulated the execution in a `finally` block to guarantee physical deletion of all generated leads via direct ORM calls.
3. **Envelope Check Integration**: Added `Phase 5` invoking a local `_dispatch` method (Mode B) to assert structural adherence to success/failure envelopes.

