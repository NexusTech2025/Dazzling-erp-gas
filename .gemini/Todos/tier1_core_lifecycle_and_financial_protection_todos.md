# Tier 1 TODO: Core Lifecycle & Financial Protection Features

**Target Domain**: Academic Enrollment, Student Fee Accounts, Installment Scheduling, Payment Transactions  
**Target Environment**: DazzlingDB ERP (Google Apps Script / SheetDB)  
**Priority**: CRITICAL / HIGH  

---

## Overview

This TODO document defines the detailed technical requirements and implementation steps for **Tier 1 Core Features**. These features address the most urgent production gaps in DazzlingDB: updating enrollment states with seat release, rescheduling installment dates/amounts safely, voiding erroneous payment entries, and applying post-enrollment fee adjustments.

All updates must adhere to **SOLID principles**, execute within **TransactionTracker** boundaries with LIFO rollback guarantees, and maintain absolute relational integrity across `Enrollment`, `BatchAllocation`, `StudentFeeAccount`, `Installment`, and `Payment` tables.

---

## 1. Feature TODO: Enrollment Status & Metadata Update (`academic_update_enrollment`)

### 1.1 Business & Technical Context
* **Problem**: Currently, modifying `Enrollment.status` (e.g. transitioning to `suspended`, `withdrawn`, or `completed`) via generic `data_update` does not update associated `BatchAllocation` records, leaving physical classroom seats reserved for inactive or withdrawn students.
* **Domain Decrees**: Enforces **Rule D1** (Contract-to-Seat Separation). `Enrollment` manages financial contract state, while `BatchAllocation` manages physical seating.

### 1.2 Proposed Action Key & Controller
* **Action Key**: `academic_update_enrollment`
* **Action Controller**: `UpdateEnrollmentAction` (`DazzlingDB/Actions/Academic/UpdateEnrollmentAction.js`)
* **Service Method**: `StudentService.updateEnrollment(payload, context)`

### 1.3 Detailed Implementation Steps
1. **Schema & Contract Verification**:
   - Ensure payload contains `enrollment_id` (`ENR-xxx`) and valid update fields (`status`, `roll_number`, `remarks`).
2. **Status Transition Logic**:
   - Retrieve target `Enrollment` record via `EnrollmentRepository`.
   - Validate allowed status transitions (`active` -> `suspended` | `withdrawn` | `completed`).
3. **Cascading Seat Allocation Release**:
   - If new status is `withdrawn` or `suspended`:
     - Query `BatchAllocation` for active seating matching `enrollment_id`.
     - Update matching `BatchAllocation.status` to `inactive` / `released` within the transaction context.
4. **Transaction Boundary & Manifest**:
   - Execute persistence inside `TransactionTracker`.
   - Populate `context.mutationManifest = ['Enrollment', 'BatchAllocation']`.

---

## 2. Feature TODO: Installment Rescheduling (`finance_reschedule_installments`)
Status Done :: ✅
### 2.1 Business & Technical Context
* **Problem**: Parents frequently request custom due dates or modified installment breakdown amounts. Generic updates risk causing ledger drift where the sum of installment amounts does not equal `StudentFeeAccount.final_fee`.
* **Domain Decrees**: Must enforce payment line protection (cannot modify or reduce paid amounts below existing `paid_amount`) and verify ledger total equality.

### 2.2 Proposed Action Key & Controller
* **Action Key**: `finance_reschedule_installments`
* **Action Controller**: `RescheduleInstallmentsAction` (`DazzlingDB/Actions/Finance/RescheduleInstallmentsAction.js`)
* **Service Method**: `FinanceService.rescheduleInstallments(payload, context)`

### 2.3 Detailed Implementation Steps
1. **Payload Contract**:
   - Accepts `fee_account_id` (`SFA-xxx`) and an array of `installments: [{ installment_id, due_date, due_amount }]`.
2. **Invariant Checks & Validation**:
   - Verify `StudentFeeAccount` exists and is active.
   - For each installment being rescheduled:
     - Ensure `due_amount >= paid_amount` (cannot reduce due amount below already collected payments).
   - **Math Invariant Assertion**: Assert that $\sum \text{Installment.due\_amount} == \text{StudentFeeAccount.final\_fee}$. If mismatched, throw `SheetDB.ValidationError`.
3. **Transactional Update**:
   - Execute in `TransactionTracker`. Update target `Installment` rows (`due_date`, `due_amount`, `status`).
   - Append `['Installment']` to `context.mutationManifest`.

---

## 3. Feature TODO: Payment Void / Reversal (`finance_void_payment`)

### 3.1 Business & Technical Context
* **Problem**: Cashiers make data entry errors (e.g. wrong amount, wrong payment mode) or cheques bounce. Currently, deleting a payment leaves `Installment.paid_amount` and `StudentFeeAccount.amount_paid` corrupted.
* **Domain Decrees**: **Rule D3** (LIFO Rollback) & **Rule D6** (Relational Cascade Protection). Must decrement payment amounts and restore installment statuses atomically.

### 3.2 Proposed Action Key & Controller
* **Action Key**: `finance_void_payment`
* **Action Controller**: `VoidPaymentAction` (`DazzlingDB/Actions/Finance/VoidPaymentAction.js`)
* **Service Method**: `FinanceService.voidPayment(payload, context)`

### 3.3 Detailed Implementation Steps
1. **Payload Contract**:
   - Accepts `payment_id` (`PAY-xxx`), `reason`, `staff_id`.
2. **Transaction Reversal Sequence**:
   - Retrieve `Payment` record. Ensure payment is not already voided.
   - Retrieve parent `Installment` (`INS-xxx`) and `StudentFeeAccount` (`SFA-xxx`).
3. **Ledger Adjustment Execution**:
   - Update `Payment.status = 'voided'` and record `void_reason`.
   - Decrement `Installment.paid_amount` by `Payment.amount`.
   - Update `Installment.status`: if `paid_amount == 0` set `pending`, if `0 < paid_amount < due_amount` set `partially_paid`.
   - Decrement `StudentFeeAccount.amount_paid` by `Payment.amount` and increment `StudentFeeAccount.balance_due` by `Payment.amount`.
   - Recalculate `StudentFeeAccount.status` (`active`, `overdue`, or `paid`).
4. **Transaction Boundary & Manifest**:
   - Perform all steps inside `TransactionTracker.run()`.
   - Set `context.mutationManifest = ['Payment', 'Installment', 'StudentFeeAccount']`.

---

## 4. Feature TODO: Post-Enrollment Fee Adjustment (`finance_apply_discount` / `finance_adjust_fee` / `finance_update_fee_account`)
Status Done :: ✅

### 4.1 Business & Technical Context
* **Problem**: Local coaching centers grant post-enrollment sibling discounts, scholarships, or fee additions. Direct `data_update` on `StudentFeeAccount` leaves pending installments out of alignment.
* **Domain Decrees**: Must rebalance pending/unpaid installments automatically to absorb the fee change.

### 4.2 Proposed Action Key & Controller
* **Action Key**: `finance_apply_discount` (alias `finance_adjust_fee`)
* **Action Controller**: `ApplyFeeAdjustmentAction` (`DazzlingDB/Actions/Finance/ApplyFeeAdjustmentAction.js`)
* **Service Method**: `FinanceService.applyFeeAdjustment(payload, context)`

### 4.3 Detailed Implementation Steps
1. **Payload Contract**:
   - Accepts `fee_account_id` (`SFA-xxx`), `adjustment_type` (`discount` | `scholarship` | `addition` | `waiver`), `amount`, `reason`.
2. **Ledger Calculation**:
   - Update `StudentFeeAccount.discount` or `total_fee`.
   - Recalculate `final_fee = total_fee - discount` and `balance_due = final_fee - amount_paid`.
3. **Child Installment Rebalancing**:
   - Retrieve all `pending` or `partially_paid` installments for this `StudentFeeAccount`.
   - Distribute the adjustment difference across unpaid installments proportionally or against the last pending installment.
   - Assert $\sum \text{Installment.due\_amount} == \text{StudentFeeAccount.final\_fee}$.
4. **Persistence & Manifest**:
   - Execute in `TransactionTracker`.
   - Set `context.mutationManifest = ['StudentFeeAccount', 'Installment', 'FeeAdjustment']`.

---

## 5. ApiDispatcher Registration Summary for Tier 1

The following mappings must be added to `_getStandardRegistry()` in `DazzlingDB/ApiDispatcher.js`:

```javascript
"academic_update_enrollment": UpdateEnrollmentAction,
"finance_reschedule_installments": RescheduleInstallmentsAction,
"finance_void_payment": VoidPaymentAction,
"finance_apply_discount": ApplyFeeAdjustmentAction,
"finance_adjust_fee": ApplyFeeAdjustmentAction,
```
