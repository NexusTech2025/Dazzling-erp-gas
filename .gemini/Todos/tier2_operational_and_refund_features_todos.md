# Tier 2 TODO: Operational & Refund Features

**Target Domain**: Academic Batch Allocation, Enrollment Cancellation, Refund Transactions, Installment Restructuring  
**Target Environment**: DazzlingDB ERP (Google Apps Script / SheetDB)  
**Priority**: HIGH  

---

## Overview

This TODO document defines the technical specifications for **Tier 2 Features**. These features handle mid-lifecycle operational changes in educational institutes: transferring batch schedules/subjects, processing formal enrollment cancellations, issuing monetary payment refunds, and restructuring installment plans.

---

## 1. Feature TODO: Batch & Subject Transfer (`academic_transfer_batch`)

### 1.1 Business & Technical Context
* **Problem**: Students frequently request transfer from one batch time slot to another (e.g. Morning to Evening batch) or switch optional subject modules. Currently, this requires manual row edits across multiple spreadsheets.
* **Domain Decrees**: Adheres to **Rule D1** (Contract-to-Seat Separation). Updates `BatchAllocation` without altering the primary `Enrollment` administrative contract unless fee package changes apply.

### 1.2 Proposed Action Key & Controller
* **Action Key**: `academic_transfer_batch`
* **Action Controller**: `TransferBatchAction` (`DazzlingDB/Actions/Academic/TransferBatchAction.js`)
* **Service Method**: `StudentService.transferBatch(payload, context)`

### 1.3 Detailed Implementation Steps
1. **Payload Contract**:
   - Accepts `enrollment_id` (`ENR-xxx`), `current_batch_id` (`BAT-xxx`), `target_batch_id` (`BAT-yyy`), `reason`.
2. **Capacity Check**:
   - Verify `target_batch_id` exists and active seating count does not exceed `max_capacity`.
3. **Seat Swap Execution**:
   - Deactivate or set status `transferred` on existing `BatchAllocation` for `current_batch_id`.
   - Create new `BatchAllocation` record (`BAL-zzz`) mapping `enrollment_id` to `target_batch_id` with `status = 'active'`.
4. **Transaction Boundary & Manifest**:
   - Execute in `TransactionTracker`.
   - Set `context.mutationManifest = ['BatchAllocation']`.

---

## 2. Feature TODO: Formal Enrollment Cancellation (`academic_cancel_enrollment`)

### 2.1 Business & Technical Context
* **Problem**: When a student leaves an institute, the enrollment contract must be formally cancelled. The system must release seats, update `StudentFeeAccount.status = 'cancelled'`, and evaluate potential refund balances.
* **Domain Decrees**: **Rule D6** (Relational Cascade Boundary). Prevents orphaned active seats and calculates non-refundable registration fees versus refundable tuition fees.

### 2.2 Proposed Action Key & Controller
* **Action Key**: `academic_cancel_enrollment`
* **Action Controller**: `CancelEnrollmentAction` (`DazzlingDB/Actions/Academic/CancelEnrollmentAction.js`)
* **Service Method**: `StudentService.cancelEnrollment(payload, context)`

### 2.3 Detailed Implementation Steps
1. **Payload Contract**:
   - Accepts `enrollment_id` (`ENR-xxx`), `cancellation_reason`, `effective_date`, `staff_id`.
2. **Cascading Lifecycle Operations**:
   - Update `Enrollment.status = 'cancelled'` and set `cancellation_date`.
   - Release all active `BatchAllocation` records for this enrollment.
   - Update `StudentFeeAccount.status = 'cancelled'`.
   - Cancel all remaining `pending` child `Installment` records (`status = 'cancelled'`).
3. **Refund Balance Computation**:
   - Calculate total paid amount ($P$) vs consumed tuition fee ($C$).
   - Return refundable balance summary in the response payload for potential follow-up refund processing.
4. **Transaction Boundary & Manifest**:
   - Execute in `TransactionTracker`.
   - Set `context.mutationManifest = ['Enrollment', 'BatchAllocation', 'StudentFeeAccount', 'Installment']`.

---

## 3. Feature TODO: Monetary Payment Refund (`finance_refund_payment`)

### 3.1 Business & Technical Context
* **Problem**: If a student cancels enrollment or overpays fees, the institute must issue a monetary refund. Deleting previous payments is illegal for accounting; a explicit refund record must be logged.
* **Domain Decrees**: Adheres to financial ledger integrity. Refunds must be tracked as negative/refund transaction entries associated with `StudentFeeAccount`.

### 3.2 Proposed Action Key & Controller
* **Action Key**: `finance_refund_payment`
* **Action Controller**: `RefundPaymentAction` (`DazzlingDB/Actions/Finance/RefundPaymentAction.js`)
* **Service Method**: `FinanceService.refundPayment(payload, context)`

### 3.3 Detailed Implementation Steps
1. **Payload Contract**:
   - Accepts `fee_account_id` (`SFA-xxx`), `refund_amount`, `payment_mode` (`cash` | `upi` | `bank_transfer`), `reference_number`, `reason`.
2. **Validation Rules**:
   - Ensure `refund_amount <= StudentFeeAccount.amount_paid` (cannot refund more than total collected cash).
3. **Ledger Execution**:
   - Create new `Payment` record with `type = 'refund'`, `amount = -refund_amount` (or positive refund entry with `transaction_type = 'refund'`).
   - Decrement `StudentFeeAccount.amount_paid` by `refund_amount` and adjust `balance_due`.
4. **Transaction Boundary & Manifest**:
   - Execute in `TransactionTracker`.
   - Set `context.mutationManifest = ['Payment', 'StudentFeeAccount']`.

---

## 4. Feature TODO: Installment Plan Restructuring (`finance_restructure_plan`)

### 4.1 Business & Technical Context
* **Problem**: Students facing financial hardship may request to restructure their remaining unpaid fee balance into a different number of installments (e.g. split 1 large remaining installment into 3 smaller monthly payments).
* **Domain Decrees**: Preserves historic paid installments while regenerating future pending installment lines under invariant $\sum \text{INS} == \text{SFA.final\_fee}$.

### 4.2 Proposed Action Key & Controller
* **Action Key**: `finance_restructure_plan`
* **Action Controller**: `RestructureInstallmentPlanAction` (`DazzlingDB/Actions/Finance/RestructureInstallmentPlanAction.js`)
* **Service Method**: `FinanceService.restructureInstallmentPlan(payload, context)`

### 4.3 Detailed Implementation Steps
1. **Payload Contract**:
   - Accepts `fee_account_id` (`SFA-xxx`), `new_plan_config: { count, frequency_days, first_due_date }`.
2. **Restructure Workflow**:
   - Query all existing `pending` installments for `fee_account_id`.
   - Calculate total remaining unpaid balance ($B = \text{SFA.balance\_due}$).
   - Soft-delete or cancel existing `pending` installments.
   - Generate $N$ new `Installment` records dividing balance $B$, setting due dates according to `frequency_days` and `first_due_date`.
3. **Validation & Assertions**:
   - Assert $\sum \text{Paid Installments} + \sum \text{New Installments} == \text{SFA.final\_fee}$.
4. **Transaction Boundary & Manifest**:
   - Execute in `TransactionTracker`.
   - Set `context.mutationManifest = ['Installment', 'StudentFeeAccount']`.

---

## 5. ApiDispatcher Registration Summary for Tier 2

The following mappings must be added to `_getStandardRegistry()` in `DazzlingDB/ApiDispatcher.js`:

```javascript
"academic_transfer_batch": TransferBatchAction,
"academic_cancel_enrollment": CancelEnrollmentAction,
"finance_refund_payment": RefundPaymentAction,
"finance_restructure_plan": RestructureInstallmentPlanAction,
```
