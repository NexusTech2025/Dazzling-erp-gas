# ApiDispatcher Architecture & Domain Update Gap Analysis Report
**Target System**: DazzlingDB ERP (Google Apps Script / SheetDB)  
**Domain Scope**: Academic Enrollment, Student Fee Accounts, Installment Scheduling, and Payment Transactions  
**Target Business Profile**: Local Coaching Centers / Educational Institutes (Small-to-Medium Business)

---

## 1. Executive Summary

This report evaluates the current API endpoint routing architecture in `ApiDispatcher.js` with a focus on **mutation & update lifecycle capabilities** across the core financial and academic domains: `Enrollment`, `StudentFeeAccount`, `Installment`, and `Payment`.

While DazzlingDB possesses robust **creation** workflows (`student_register`, `academic_enroll_student`, `finance_record_payment`) and **bulk deletion** abstractions (`finance_delete_many_*`), it currently lacks **specialized domain update actions** for mid-lifecycle financial adjustments, installment rescheduling, enrollment status modifications, and payment reversals. Relying on generic CRUD (`data_update`) for these complex domains introduces severe risks of financial ledger drift, orphan row creation, and referential integrity violations.

---

## 2. Inventory of Current ApiDispatcher Actions

An audit of `ApiDispatcher.js` (`_getStandardRegistry()`) reveals the following domain coverage:

| Domain Area | Endpoint Action Keys Registered in `ApiDispatcher.js` | Action Controller Class | Execution Type |
| :--- | :--- | :--- | :--- |
| **Student Lifecycle** | `student_register`, `student_withdraw_subject`, `student_upgrade_package`, `student_verify_access`, `student_add_lead`, `student_delete`, `student_delete_many_students` | `RegisterStudentAction`, `WithdrawStudentSubjectAction`, `UpgradeStudentPackageAction`, etc. | Specialized Domain Controller |
| **Academic Enrollment** | `academic_create_course_type`, `academic_create_course`, `academic_create_batch`, `academic_create_package`, `academic_update_package`, `academic_delete_package`, `academic_enroll_student`, `academic_delete_many_*` | `EnrollStudentAction`, `UpdatePackageAction`, `DeletePackageAction`, etc. | Specialized Domain Controller |
| **Finance & Payments** | `finance_record_payment` (alias `recordpayment`), `staff_record_payment`, `finance_delete_many_fee_accounts`, `finance_delete_many_installments`, `finance_delete_many_payments`, `finance_delete_many_adjustments` | `RecordPaymentAction`, `StaffRecordPaymentAction`, `DeleteMany*Action` | Specialized Domain Controller |
| **Generic Data CRUD** | `data_query`, `data_create`, `data_update`, `data_delete`, `data_delete_many` | `QueryAction`, `CreateRecordAction`, `UpdateRecordAction`, `DeleteRecordAction` | Generic Abstract CRUD |

---

## 3. Deep-Dive Analysis of Update Features by Domain

### 3.1 Academic Enrollment Domain (`Enrollment` Table)

#### Current Capability
* `academic_enroll_student` creates the initial `Enrollment` row (`ENR-xxx`), creates the matching `StudentFeeAccount` (`SFA-xxx`), generates default `Installment` rows (`INS-xxx`), and creates `BatchAllocation` rows (`BAL-xxx`).
* Specialized updates exist only for `student_withdraw_subject` and `student_upgrade_package`.

#### Current Deficiencies & Risks
* **No `academic_update_enrollment` Domain Action**: There is no domain action to update an enrollment's academic status (e.g. transitioning from `active` to `suspended`, `completed`, or `withdrawn`), or to update roll numbers and metadata.
* **Risks of Generic `data_update`**: Updating `Enrollment.status` via generic `data_update` does **not** automatically update associated `BatchAllocation` rows or trigger fee account status adjustments, leading to active batch seating allocations for inactive/withdrawn students.

---

### 3.2 Student Fee Account Domain (`StudentFeeAccount` Table)

#### Current Capability
* `StudentFeeAccount` (`SFA-xxx`) holds financial summaries: `total_fee`, `discount`, `final_fee`, `amount_paid`, `balance_due`, `next_due_date`, `status`.
* Initial creation is automated during enrollment. Deletion is supported via `finance_delete_many_fee_accounts`.

#### Current Deficiencies & Risks
* **No `finance_update_fee_account` or `finance_apply_discount` Domain Action**: There is no dedicated endpoint to update fee account parameters (e.g., applying post-enrollment scholarships, sibling discounts, manual fee overrides, or penalty waivers).
* **Financial Ledger Drift Risk**: If an admin uses generic `data_update` to change `StudentFeeAccount.discount` or `total_fee`, the system updates the single row in `StudentFeeAccount`, **but DOES NOT re-calculate `final_fee`, `balance_due`, or rebalance child `Installment` rows**. Consequently:
  $$\sum \text{Installment.due\_amount} \neq \text{StudentFeeAccount.final\_fee}$$

---

### 3.3 Installment Management Domain (`Installment` Table)

#### Current Capability
* Installments are generated upon enrollment. `finance_delete_many_installments` allows bulk row deletion.

#### Current Deficiencies & Risks
* **No `finance_reschedule_installments` Domain Action**: There is no domain endpoint to:
  1. Change installment due dates (`due_date`) for a student requesting an extension.
  2. Modify individual installment due amounts (`due_amount`).
  3. Convert an installment plan (e.g., converting 2 installments to 4 installments or vice versa).
* **Payment Protection Violation**: Using generic `data_update` or `data_delete` on `Installment` can delete or alter an installment that already has linked payments in the `Payment` table (`PAY-xxx`), violating referential integrity (`onDelete: protect`) and corrupting payment transaction logs.

---

### 3.4 Payment Transactions Domain (`Payment` Table)

#### Current Capability
* `finance_record_payment` (`RecordPaymentAction`) accepts payments (`PAY-xxx`), updates `Installment.paid_amount` and status (`paid`/`partially_paid`), and updates `StudentFeeAccount.amount_paid` and `balance_due`.

#### Current Deficiencies & Risks
* **No `finance_void_payment` / `finance_reverse_payment` Domain Action**: Real-world cashiers often make data entry errors (e.g., entering ₹15,000 instead of ₹1,500, or selecting `cash` instead of `upi`), or payments bounce/fail.
* **No Refund Pipeline**: Currently, there is no domain action to void or refund a payment. If a payment is deleted via `data_delete`, the system does **not** subtract the amount from `Installment.paid_amount` or `StudentFeeAccount.amount_paid`, leaving the ledger in an over-counted state.

---

## 4. Production Gap Report for Local Coaching Centers

Local coaching centers (SMB educational institutes) operate under specific business realities. Below is the comprehensive matrix of **missing features required for a real-world production system**:

| Missing Feature / Endpoint | Real-Life Coaching Center Scenario | Technical & Business Impact | Priority |
| :--- | :--- | :--- | :--- |
| **`finance_reschedule_installments`** | Parent requests custom installment dates (e.g. "I will pay on 10th after monthly salary") or custom amounts. | Currently requires risky manual Google Sheet edits. High risk of calculation errors. | **CRITICAL** |
| **`finance_apply_discount` / `finance_adjust_fee`** | Local centers heavily use Sibling Discounts, Merit Scholarships, Early Bird waivers, or hardship discounts post-enrollment. | No domain pipeline exists. Generic updates leave `StudentFeeAccount` and `Installment` out of sync. | **HIGH** |
| **`finance_void_payment` / `finance_refund_payment`** | Cashier typo during collection, bounced cheque, failed UPI reference, or student fee refund on cancellation. | No reversal logic exists. Deleting a payment leaves `amount_paid` and `balance_due` corrupted. | **HIGH** |
| **`academic_transfer_batch` / `academic_change_subject`** | Student requests transfer from Morning Batch to Evening Batch, or switches optional subjects (e.g., Biology to Computer Science). | Currently requires manual seat allocation updates and manual fee adjustment across multiple tables. | **HIGH** |
| **Fee Receipt & Payment Reminders Metadata** | Parents expect automated SMS/WhatsApp payment receipt details, due date reminders, and overdue alerts. | No fields or action hooks for tracking reminder count, notification status, or digital receipt hashes. | **MEDIUM** |
| **Financial Audit Log Trail (`FeeAuditLog`)** | Admin needs to track *who* changed a student's fee, *when*, and *why* (to prevent fraud by staff/cashiers). | Direct updates leave no immutable audit trail of fee modifications or discount approvals. | **MEDIUM** |
| **Fine / Late Fee Waiver Pipeline** | Local coaching centers charge late fees for delayed payments but frequently waive them upon parent request. | No domain action to apply or waive `late_fee_amount` on `Installment` or `StudentFeeAccount`. | **MEDIUM** |

---

## 5. Architectural Recommendations & Roadmap

To evolve DazzlingDB into a production-grade ERP for local coaching centers without breaking SOLID principles:

1. **Implement Domain-Specific Update Services in `FinanceService`**:
   - `FinanceService.applyFeeAdjustment(payload, context)`: Updates `StudentFeeAccount` and automatically recalculates/rebalances child pending installments.
   - `FinanceService.rescheduleInstallments(payload, context)`: Safely updates due dates and amounts for unpaid installments while preserving paid lines and enforcing total fee equality.
   - `FinanceService.voidPayment(payload, context)`: Reverts payment transactions, decrements `paid_amount`, re-opens installment status to `pending`, and updates `balance_due`.

2. **Implement `academic_update_enrollment` in `StudentService`**:
   - Manages status changes (`active` $\rightarrow$ `withdrawn`/`completed`) and automatically updates associated `BatchAllocation` records to free up classroom seating.

3. **Register New Action Classes in `ApiDispatcher.js`**:
   - `finance_update_fee_account` $\rightarrow$ `UpdateStudentFeeAccountAction`
   - `finance_reschedule_installments` $\rightarrow$ `RescheduleInstallmentsAction`
   - `finance_void_payment` $\rightarrow$ `VoidPaymentAction`
   - `academic_update_enrollment` $\rightarrow$ `UpdateEnrollmentAction`
