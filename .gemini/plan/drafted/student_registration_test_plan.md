# Student Registration API Test Plan

This document outlines the test cases and execution plan for the Student Registration API, aligned with the [DazzlingDB API Test Pattern Rulebook](e:/NAST/Dazzling/GAS/.gemini/memory/dazzlingDB/apitest_pattern_rulebook.md).

---

## 1. Test Objectives
Assert and verify the capability of registering a student and child records (address, contact info) through the public API, retrieving the hydrated record via QueryEngine, validating constraints, and confirming success/failure response envelope compliance.

## 2. Test Cases

### TC-Reg-01: Happy Path Student Registration
* **Action**: Register a student with a complete payload (profile, address, contact) using dynamic unique credentials.
* **Assertions**:
  * Response contains a generated `student_id` starting with `"STU"`.
  * Cascaded child records (Address, ContactInfo) are created in the database and linked to the student.

### TC-Reg-02: Hydrated Student Retrieval
* **Action**: Query the registered student via the `data_query` API using the `include` block to hydrate `address` and `contact`.
* **Assertions**:
  * Mapped relations exist, are correctly hydrated, and the fields match the registration payload.

### TC-Reg-03: Validation Error - Missing Profile Data
* **Action**: Dispatches registration call with `payload` containing address and contact but omitting the `profile` object.
* **Assertions**:
  * Call throws / returns `success: false`.
  * Error code and message are present in the response.

### TC-Reg-04: Validation Error - Missing Required Field
* **Action**: Dispatches registration call with `profile` object omitting `student_name`.
* **Assertions**:
  * Error code is `"ACTION_VALIDATION_FAILURE"` or similar validation constraint.
  * Validation details array points to the missing `student_name` field.

### TC-Reg-05: Validation Error - Choice Constraint Violation
* **Action**: Dispatches registration call with an invalid gender choice (e.g. `"Alien"` instead of `"Male"`, `"Female"`, or `"Other"`).
* **Assertions**:
  * Constraint error is returned indicating choice validation failure on `gender`.

### TC-Reg-06: Envelope Format Validation
* **Action**: Invokes the raw dispatcher directly with both valid and invalid events to check envelope properties on success and failure.
* **Assertions**:
  * Conformance to standard envelope keys (e.g. `success`, `data._presentation.toast_message`, `context.execution_time_ms`, `meta`).

---

## 3. Test Alignment & Implementation Update

We will update [StudentRegistration_ApiTest.js](e:/NAST/Dazzling/GAS/DazzlingDB/apitest/StudentRegistration_ApiTest.js) to:
- Generate dynamic suffixes for student email and phone to satisfy Rule AT-13.
- Capture all created database record IDs (`student_id`, `course_type_id`, `course_id`, `batch_id`) and clean them up in a LIFO manner inside the `finally` block (Rule AT-17).
- Verify happy-path, negative validation, and envelope formats.
