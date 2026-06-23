# TODO: Implement Polymorphic Source Reference Linking for MoneyTransaction (Phase 2)

## Status: PENDING

## Problem
In Phase 1, `MoneyTransaction` functions as an isolated ledger table where users manually log incoming and outgoing payments. However, financial sub-ledgers (like `Payment` for student fees and `TeacherPaymentTransaction` for teacher salaries) exist independently. Without a direct database connection, there is no automatic reconciliation. The system cannot audit or trace general ledger entries back to the specific business events (payments or payroll actions) that triggered them.

## Goal
Establish a polymorphic source link inside the `MoneyTransaction` schema to allow automated tracing and reconciliation between the General Ledger (`MoneyTransaction`) and transactional sub-ledgers (`Payment`, `TeacherPaymentTransaction`).

## Changes Required

### 1. Schema Configuration (`e:/NAST/Dazzling/GAS/DazzlingDB/Config/Schema/Finance/MoneyTransaction.json`)
- [ ] Add `source_type` column to represent the source system entity:
  ```json
  "source_type": {
    "type": "string",
    "required": false,
    "choices": ["payment", "teacher_payout", "manual"],
    "maxLength": 50
  }
  ```
- [ ] Add `source_id` column representing the specific record identifier:
  ```json
  "source_id": {
    "type": "foreign_key",
    "required": false,
    "maxLength": 255
  }
  ```
- [ ] Declare the polymorphic relation in the `relations` block:
  ```json
  "source": {
    "type": "belongsToPolymorphic",
    "typeField": "source_type",
    "idField": "source_id",
    "mapping": {
      "payment": "Payment",
      "teacher_payout": "TeacherPaymentTransaction"
    }
  }
  ```

### 2. Parent Table Reverse Relations
To support bidirectional query traversals and relational graph compilation, add reverse relations in the parent schemas:
- [ ] **`Payment` Schema (`e:/NAST/Dazzling/GAS/DazzlingDB/Config/Schema/Finance/Payment.json`)**: Add a `hasOne` relation to `MoneyTransaction` where `foreignKey` is `source_id`.
- [ ] **`TeacherPaymentTransaction` Schema (`e:/NAST/Dazzling/GAS/DazzlingDB/Config/Schema/Staff/TeacherPaymentTransaction.json`)**: Add a `hasOne` relation to `MoneyTransaction` where `foreignKey` is `source_id`.

### 3. Service-Layer Automation
- [ ] Update fee collection workflows in `StudentService.js` to automatically create a corresponding `MoneyTransaction` ledger entry whenever a student `Payment` is successfully recorded.
- [ ] Update payroll workflows in `StaffService.js` to automatically create a corresponding `MoneyTransaction` ledger entry when a teacher payout transaction is committed.
- [ ] Ensure that failures in either sub-ledger or general ledger creation roll back both tables within the same transactional boundary using `BatchBucket`.

### 4. Compilation & Verification
- [ ] Run the schema compiler `node compile_schema.js` to build the updated unified schema.
- [ ] Run linter checks to verify backward reference symmetry and graph compilation.
- [ ] Write integration test cases in `DazzlingDB/Test/` to verify that saving a payment inserts a linked money transaction, and that deleting the student/payment enforces correct cascade/protect policies.
