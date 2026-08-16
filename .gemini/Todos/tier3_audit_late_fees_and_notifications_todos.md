# Tier 3 TODO: Audit Trails, Late Fees & Communication Features

**Target Domain**: Financial Audit Trail, Late Fee Penalties & Waivers, Payment Receipt & Reminder Tracking  
**Target Environment**: DazzlingDB ERP (Google Apps Script / SheetDB)  
**Priority**: MEDIUM  

---

## Overview

This TODO document defines the technical specifications for **Tier 3 Features**. These features enhance administrative security, financial compliance, penalty management, and automated communication tracking across local coaching center operations.

---

## 1. Feature TODO: Late Fee Application & Waiver (`finance_apply_late_fee` / `finance_waive_late_fee`)

### 1.1 Business & Technical Context
* **Problem**: Educational institutes charge late fee penalties on overdue installments, but cashiers/managers frequently request to waive these late fees based on parent hardship. Currently, there is no domain pipeline for late fees.
* **Domain Decrees**: Enforces clear distinction between base tuition fees and dynamic penalty fees.

### 1.2 Proposed Action Keys & Controllers
* **Action Keys**: `finance_apply_late_fee`, `finance_waive_late_fee`
* **Action Controllers**: `ApplyLateFeeAction` & `WaiveLateFeeAction` (`DazzlingDB/Actions/Finance/`)
* **Service Method**: `FinanceService.applyLateFee(payload, context)` / `FinanceService.waiveLateFee(payload, context)`

### 1.3 Detailed Implementation Steps
1. **Apply Late Fee Workflow**:
   - Accepts `installment_id` (`INS-xxx`), `late_fee_amount`, `reason`.
   - Update `Installment.late_fee_amount` and increment `Installment.due_amount`.
   - Update `StudentFeeAccount.total_fee` and `StudentFeeAccount.balance_due` accordingly.
2. **Waive Late Fee Workflow**:
   - Accepts `installment_id` (`INS-xxx`), `waive_amount`, `approved_by_staff_id`, `reason`.
   - Decrement `Installment.late_fee_amount` and `Installment.due_amount`.
   - Decrement `StudentFeeAccount.balance_due` accordingly.
3. **Transaction Boundary & Manifest**:
   - Execute in `TransactionTracker`.
   - Set `context.mutationManifest = ['Installment', 'StudentFeeAccount']`.

---

## 2. Feature TODO: Financial Audit Trail Logging (`FeeAuditLog` Schema & Infrastructure)

### 2.1 Business & Technical Context
* **Problem**: Staff or cashiers modifying fee account balances, granting discounts, or voiding payments presents a fraud risk. An immutable audit trail is required to record every financial override.
* **Domain Decrees**: **Zero-Hardcoding Schema Rule**. Define schema at `DazzlingDB/Config/Schema/Finance/FeeAuditLog.json` and compile via `npm run compile-graph:prod`.

### 2.2 Schema Blueprint (`FeeAuditLog.json`)
* **Primary Key**: `log_id` (`FAL-xxx`)
* **Fields**: `fee_account_id`, `action_type` (`DISCOUNT` | `VOID_PAYMENT` | `LATE_FEE_WAIVER` | `RESCHEDULE`), `previous_value`, `new_value`, `performed_by_staff_id`, `reason`, `timestamp`.

### 2.3 Implementation Steps
1. **Schema Creation & Compilation**:
   - Create `DazzlingDB/Config/Schema/Finance/FeeAuditLog.json`.
   - Compile schema graph using `npm run compile-graph:prod` in `dazzlingdb-tools/`.
2. **Service Hook Integration**:
   - Add automated `FeeAuditLogRepository.create()` triggers inside `FinanceService` whenever discounts, voids, or fee overrides execute.
3. **Audit Query Action**:
   - Register `finance_query_audit_logs` (`QueryFeeAuditLogsAction`) for admin audit reporting.

---

## 3. Feature TODO: Digital Receipt & Payment Reminder Tracking (`finance_send_receipt` / `finance_send_reminder`)

### 3.1 Business & Technical Context
* **Problem**: Coaching centers need digital receipt verification hashes and automated SMS/WhatsApp reminder tracking for upcoming/overdue installments.
* **Domain Decrees**: Lightweight metadata extensions on `Payment` and `Installment` entities without bloating core transaction logic.

### 3.2 Proposed Action Keys & Controllers
* **Action Keys**: `finance_send_receipt`, `finance_send_reminder`
* **Action Controllers**: `SendPaymentReceiptAction` & `SendPaymentReminderAction` (`DazzlingDB/Actions/Finance/`)

### 3.3 Implementation Steps
1. **Digital Receipt Hash Generator**:
   - Upon payment recording/receipt request, compute SHA-256 digital verification hash of payment parameters.
   - Return structured digital receipt payload.
2. **Reminder Log Tracking**:
   - Update `Installment.last_reminder_sent_at` and increment `Installment.reminder_count`.
3. **Manifest**:
   - Set `context.mutationManifest = ['Installment']` or `['Payment']`.

---

## 4. ApiDispatcher Registration Summary for Tier 3

The following mappings must be added to `_getStandardRegistry()` in `DazzlingDB/ApiDispatcher.js`:

```javascript
"finance_apply_late_fee": ApplyLateFeeAction,
"finance_waive_late_fee": WaiveLateFeeAction,
"finance_query_audit_logs": QueryFeeAuditLogsAction,
"finance_send_receipt": SendPaymentReceiptAction,
"finance_send_reminder": SendPaymentReminderAction,
```
