# Implementation Directive — Fee Account Update & Fee Adjustment Engine

This document provides explicit, binding instructions for implementing `UpdateFeeAccountAction` (`finance_update_fee_account`), `ApplyFeeAdjustmentAction` (`finance_adjust_fee`), and their underlying domain service operations in `AcademicEnrollmentService.js`.

---

## 1. Executive Summary & Mandatory Rules

### Key Architectural Directives
1. **Atomic Transaction Pipeline (`AtomicPipeline`)**:
   - You **MUST** use `AtomicPipeline` (`SheetDB.AtomicPipeline.begin(db, context)`) to execute multi-table mutations (`FeeAdjustment`, `StudentFeeAccount`, `Installment`).
   - `AtomicPipeline` automatically tracks inserts and updates via `TrackingRepository` facades and executes an automatic LIFO rollback via `TransactionTracker` if an error occurs at any pipeline boundary.

2. **Protection of Fully Paid Installments**:
   - Installments with `status === 'paid'` (or `due_amount === paid_amount` and `paid_amount > 0`) **MUST NOT BE MUTATED OR TOUCHED** in any way during fee account updates or fee adjustments.
   - Rebalancing must operate exclusively on pending, partially paid, or overdue installments (`status !== 'paid'`).

3. **Collected Cash Floor Protection Guard**:
   - A proposed `final_fee` **CANNOT** be reduced below total cash collected (`totalCollected = sum(installment.paid_amount)` or `feeAccount.amount_paid`).
   - If `newFinalFee < totalCollected`, you must throw `SheetDB.ValidationError`.

4. **Cross-Realm Date Validation & Comparison Engine**:
   - **Date Type Check**: Always use `SheetDB.isDate(val)` (or global `isDate(val)`) instead of `instanceof Date` to bypass Google Apps Script cross-realm prototype scoping boundaries.
   - **Date Comparisons**: Always use `SheetDB.DateComparator` / `DateComparisonPolicy` or `DazzlingDateTime.safeParseStringToDate()` for date parsing, ordering, and comparison routines.

5. **Schema Choice & Enum Normalization**:
   - Map `"manual"` to `"manual_override"` when updating `StudentFeeAccount.adjustment_type` to comply with choices in `StudentFeeAccount.json`.

6. **Cumulative Discount Logic**:
   - For `adjustFee()`, compute cumulative discount:
     $$\text{new\_discount} = \text{current\_discount} + \text{payload.amount}$$
     $$\text{new\_final\_fee} = \text{total\_fee} - \text{new\_discount}$$

7. **Direct Receipt Sum Validation**:
   - Every unpaid installment modified during rebalancing must satisfy `inst.due_amount >= inst.paid_amount` and pass `FinanceAllocationUtil.validateDirectPaymentReceiptSum(inst.installment_id, proposedDueAmount, db)`.

---

## 2. Mandatory Code Blueprints

### Component 1: `FinanceAllocationUtil.allocateFeeAdjustmentRebalance`
**Location**: `DazzlingDB/DBServices/AcademicEnrollmentService.js`

```javascript
/**
 * Rebalances unpaid/pending installments when a fee account's final_fee is adjusted.
 * Protects fully paid installments and enforces cash floor guards.
 * 
 * @param {Array<Object>} installments - Existing installment records for the account.
 * @param {number} newFinalFee - Proposed updated final_fee for the StudentFeeAccount.
 * @param {Object} [db] - Active database context instance for receipt checks.
 * @returns {Array<Object>} Rebalanced array of installments.
 * @throws {SheetDB.ValidationError} If cash floor protection or receipt alignment fails.
 */
FinanceAllocationUtil.allocateFeeAdjustmentRebalance = function(installments, newFinalFee, db) {
  if (!Array.isArray(installments)) return [];

  // 1. Sort installments chronologically using Date Comparison Engine
  const sorted = FinanceAllocationUtil.sortAndResequenceInstallments(installments);
  
  // 2. Compute total cash already collected across all installments
  const totalCollected = sorted.reduce((acc, inst) => acc + Number(inst.paid_amount || 0), 0);
  const roundedNewFinalFee = Math.round(Number(newFinalFee || 0) * 100) / 100;
  
  // 3. Collected Cash Floor Protection Guard
  if (roundedNewFinalFee < totalCollected) {
    throw new SheetDB.ValidationError(
      `Collected cash floor protection: Proposed final fee (₹${roundedNewFinalFee}) cannot be lower than collected payments (₹${totalCollected}).`
    );
  }

  // 4. Compute target unpaid balance required across remaining unpaid installments
  const targetUnpaidBalance = Math.round((roundedNewFinalFee - totalCollected) * 100) / 100;

  // 5. Filter UNPAID installments (FULLY PAID INSTALLMENTS MUST NOT BE TOUCHED)
  const unpaidInstallments = sorted.filter(inst => inst.status !== 'paid' && Number(inst.due_amount || 0) > Number(inst.paid_amount || 0));

  if (unpaidInstallments.length > 0) {
    const perInstallmentShare = Math.floor((targetUnpaidBalance / unpaidInstallments.length) * 100) / 100;
    let remainder = Math.round((targetUnpaidBalance - (perInstallmentShare * unpaidInstallments.length)) * 100) / 100;

    sorted.forEach(inst => {
      // MANDATORY RULE: NEVER TOUCH FULLY PAID INSTALLMENTS
      if (inst.status !== 'paid' && Number(inst.due_amount || 0) > Number(inst.paid_amount || 0)) {
        const paidPortion = Number(inst.paid_amount || 0);
        let newUnpaidPortion = perInstallmentShare;
        if (remainder > 0) {
          newUnpaidPortion = Math.round((newUnpaidPortion + 0.01) * 100) / 100;
          remainder = Math.round((remainder - 0.01) * 100) / 100;
        }

        const proposedDue = Math.round((paidPortion + newUnpaidPortion) * 100) / 100;

        // Direct Payment Receipt Protection Guard
        if (inst.installment_id && db) {
          FinanceAllocationUtil.validateDirectPaymentReceiptSum(inst.installment_id, proposedDue, db);
        }

        inst.due_amount = proposedDue;
      }
    });
  }

  // 6. Assert Total Fee Equality Invariant
  FinanceAllocationUtil.assertTotalFeeEquality(sorted, roundedNewFinalFee);

  // 7. Recalculate status and paid amounts cascade
  return FinanceAllocationUtil.allocatePaymentCascade(sorted, totalCollected);
};
```

---

### Component 2: `AcademicEnrollmentService.prototype.adjustFee`
**Location**: `DazzlingDB/DBServices/AcademicEnrollmentService.js`

```javascript
/**
 * Applies a post-enrollment fee adjustment using AtomicPipeline for transactional LIFO rollback safety.
 * 
 * @param {Object} payload - Adjustment parameters.
 * @param {string} payload.student_fee_id - Target fee account ID (SFA-xxx).
 * @param {string} payload.adjustment_type - Choice: 'scholarship'|'coupon'|'referral'|'manual'.
 * @param {number} payload.amount - Positive adjustment amount.
 * @param {string} [payload.reason] - Administrative reason.
 * @param {string} [payload.created_by] - Staff ID.
 * @param {Object} context - Execution request context.
 * @returns {Object} Presentation envelope.
 */
AcademicEnrollmentService.prototype.adjustFee = function(payload, context) {
  console.time("ApplyFeeAdjustmentAction Execution");
  const db = context.db || DBContext.getInstance();
  const { student_fee_id, adjustment_type, amount, reason, created_by } = payload;

  // 1. Fetch StudentFeeAccount
  const feeAccount = db.StudentFeeAccount.findById(student_fee_id);
  if (!feeAccount) {
    throw new SheetDB.EntityNotFoundError("StudentFeeAccount", student_fee_id, "Finance");
  }

  // 2. Validate payload amount & adjustment type
  const adjAmount = Math.round(Number(amount) * 100) / 100;
  if (isNaN(adjAmount) || adjAmount <= 0) {
    throw new SheetDB.ValidationError("Fee adjustment 'amount' must be a positive number.");
  }

  // Normalize adjustment type for StudentFeeAccount choice enum ('manual' -> 'manual_override')
  const sfaAdjType = adjustment_type === "manual" ? "manual_override" : adjustment_type;

  // 3. Compute updated cumulative discount & final fee
  const currentDiscount = Number(feeAccount.discount || 0);
  const newDiscount = Math.round((currentDiscount + adjAmount) * 100) / 100;
  const newTotalFee = Number(feeAccount.total_fee || 0);
  const newFinalFee = Math.max(0, Math.round((newTotalFee - newDiscount) * 100) / 100);

  // 4. Fetch existing installments and perform rebalancing
  const existingInstallments = db.Installment.where({ student_fee_id: student_fee_id });
  const rebalancedSchedule = FinanceAllocationUtil.allocateFeeAdjustmentRebalance(existingInstallments, newFinalFee, db);

  const totalAccountPaid = Number(feeAccount.amount_paid || 0);
  const newBalance = Math.max(0, Math.round((newFinalFee - totalAccountPaid) * 100) / 100);
  const newAccountStatus = newBalance <= 0 ? "completed" : "active";
  const nextDueDate = FinanceAllocationUtil.recalculateAccountNextDueDate(rebalancedSchedule);

  // 5. Execute Mutations via AtomicPipeline
  let createdAdjustmentRecord = null;
  const pipeline = (typeof AtomicPipeline !== 'undefined' ? AtomicPipeline : SheetDB.AtomicPipeline)
    .begin(db, context)
    .addStep("FeeAdjustment", (repo) => {
      createdAdjustmentRecord = repo.insert({
        student_fee_id: student_fee_id,
        adjustment_type: adjustment_type,
        amount: adjAmount,
        reason: reason ? String(reason) : "",
        created_by: created_by ? String(created_by) : ""
      });
    })
    .addStep("StudentFeeAccount", (repo) => {
      repo.update(student_fee_id, {
        discount: newDiscount,
        adjustment_type: sfaAdjType,
        final_fee: newFinalFee,
        balance_due: newBalance,
        next_due_date: nextDueDate,
        status: newAccountStatus
      });
    })
    .addStep("Installment", (repo) => {
      rebalancedSchedule.forEach(inst => {
        // Update modified unpaid installments only
        if (inst.installment_id && inst.status !== 'paid') {
          repo.update(inst.installment_id, {
            installment_number: inst.installment_number,
            due_amount: inst.due_amount,
            paid_amount: inst.paid_amount,
            due_date: inst.due_date,
            status: inst.status
          });
        }
      });
    });

  pipeline.execute();
  console.timeEnd("ApplyFeeAdjustmentAction Execution");

  return {
    success: true,
    message: `Fee adjustment of ₹${adjAmount} applied successfully to account ${student_fee_id}.`,
    data: {
      adjustment: createdAdjustmentRecord,
      student_fee_id: student_fee_id,
      total_fee: newTotalFee,
      discount: newDiscount,
      final_fee: newFinalFee,
      amount_paid: totalAccountPaid,
      balance_due: newBalance,
      next_due_date: nextDueDate,
      status: newAccountStatus
    }
  };
};
```

---

### Component 3: `AcademicEnrollmentService.prototype.updateFeeAccount`
**Location**: `DazzlingDB/DBServices/AcademicEnrollmentService.js`

```javascript
/**
 * Updates baseline fee account parameters (total_fee, discount, remarks) and delegates to adjustFee if payload.adjustment is provided.
 * 
 * @param {Object} payload - Update parameters.
 * @param {string} payload.student_fee_id - Target fee account ID (SFA-xxx).
 * @param {number} [payload.total_fee] - Updated base total fee.
 * @param {number} [payload.discount] - Updated base discount.
 * @param {string} [payload.adjustment_type] - Choice enum.
 * @param {string} [payload.coupon_code] - Coupon code.
 * @param {string} [payload.remarks] - Remarks.
 * @param {Object} [payload.adjustment] - Nested adjustment payload block to delegate.
 * @param {Object} context - Request context.
 * @returns {Object} Presentation envelope.
 */
AcademicEnrollmentService.prototype.updateFeeAccount = function(payload, context) {
  // If an adjustment block is present, delegate directly to adjustFee
  if (payload.adjustment && typeof payload.adjustment === 'object') {
    const adjPayload = {
      ...payload.adjustment,
      student_fee_id: payload.student_fee_id
    };
    return this.adjustFee(adjPayload, context);
  }

  console.time("UpdateFeeAccountAction Execution");
  const db = context.db || DBContext.getInstance();
  const { student_fee_id, total_fee, discount, adjustment_type, coupon_code, remarks } = payload;

  const feeAccount = db.StudentFeeAccount.findById(student_fee_id);
  if (!feeAccount) {
    throw new SheetDB.EntityNotFoundError("StudentFeeAccount", student_fee_id, "Finance");
  }

  const newTotalFee = total_fee !== undefined ? Math.round(Number(total_fee) * 100) / 100 : Number(feeAccount.total_fee || 0);
  const newDiscount = discount !== undefined ? Math.round(Number(discount) * 100) / 100 : Number(feeAccount.discount || 0);
  const newFinalFee = Math.max(0, Math.round((newTotalFee - newDiscount) * 100) / 100);

  const existingInstallments = db.Installment.where({ student_fee_id: student_fee_id });
  const rebalancedSchedule = FinanceAllocationUtil.allocateFeeAdjustmentRebalance(existingInstallments, newFinalFee, db);

  const totalAccountPaid = Number(feeAccount.amount_paid || 0);
  const newBalance = Math.max(0, Math.round((newFinalFee - totalAccountPaid) * 100) / 100);
  const newAccountStatus = newBalance <= 0 ? "completed" : "active";
  const nextDueDate = FinanceAllocationUtil.recalculateAccountNextDueDate(rebalancedSchedule);

  const sfaAdjType = adjustment_type === "manual" ? "manual_override" : (adjustment_type || feeAccount.adjustment_type);

  const pipeline = (typeof AtomicPipeline !== 'undefined' ? AtomicPipeline : SheetDB.AtomicPipeline)
    .begin(db, context)
    .addStep("StudentFeeAccount", (repo) => {
      repo.update(student_fee_id, {
        total_fee: newTotalFee,
        discount: newDiscount,
        adjustment_type: sfaAdjType,
        coupon_code: coupon_code !== undefined ? String(coupon_code) : feeAccount.coupon_code,
        final_fee: newFinalFee,
        balance_due: newBalance,
        next_due_date: nextDueDate,
        status: newAccountStatus,
        remarks: remarks !== undefined ? String(remarks) : feeAccount.remarks
      });
    })
    .addStep("Installment", (repo) => {
      rebalancedSchedule.forEach(inst => {
        if (inst.installment_id && inst.status !== 'paid') {
          repo.update(inst.installment_id, {
            installment_number: inst.installment_number,
            due_amount: inst.due_amount,
            paid_amount: inst.paid_amount,
            due_date: inst.due_date,
            status: inst.status
          });
        }
      });
    });

  pipeline.execute();
  console.timeEnd("UpdateFeeAccountAction Execution");

  return {
    success: true,
    message: `Fee account ${student_fee_id} updated successfully.`,
    data: {
      student_fee_id: student_fee_id,
      total_fee: newTotalFee,
      discount: newDiscount,
      final_fee: newFinalFee,
      amount_paid: totalAccountPaid,
      balance_due: newBalance,
      next_due_date: nextDueDate,
      status: newAccountStatus
    }
  };
};
```

---

### Component 4: Action Controllers (`ConcreteActions.js`) & Router (`ApiDispatcher.js`)

**Add to `DazzlingDB/DBServices/ConcreteActions.js`**:
```javascript
class UpdateFeeAccountAction extends BaseAction {
  constructor() {
    super(ActionType.UPDATE);
  }

  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.student_fee_id || !String(p.student_fee_id).startsWith("SFA-")) {
      throw new ActionValidationError("Valid 'student_fee_id' (SFA-xxx) is required in payload.");
    }
  }

  handle(requestContext) {
    const service = (typeof AcademicEnrollmentService !== 'undefined' && AcademicEnrollmentService.getInstance)
      ? AcademicEnrollmentService.getInstance()
      : globalThis.AcademicEnrollmentService.getInstance();
    return service.updateFeeAccount(requestContext.params.payload, requestContext);
  }
}

class ApplyFeeAdjustmentAction extends BaseAction {
  constructor() {
    super(ActionType.CREATE);
  }

  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.student_fee_id || !String(p.student_fee_id).startsWith("SFA-")) {
      throw new ActionValidationError("Valid 'student_fee_id' (SFA-xxx) is required in payload.");
    }
    if (!p.amount || isNaN(Number(p.amount)) || Number(p.amount) <= 0) {
      throw new ActionValidationError("Positive numeric 'amount' is required for fee adjustment.");
    }
  }

  handle(requestContext) {
    const service = (typeof AcademicEnrollmentService !== 'undefined' && AcademicEnrollmentService.getInstance)
      ? AcademicEnrollmentService.getInstance()
      : globalThis.AcademicEnrollmentService.getInstance();
    return service.adjustFee(requestContext.params.payload, requestContext);
  }
}

globalThis.UpdateFeeAccountAction = UpdateFeeAccountAction;
globalThis.ApplyFeeAdjustmentAction = ApplyFeeAdjustmentAction;
```

**Add to `DazzlingDB/ApiDispatcher.js` (`_getStandardRegistry`)**:
```javascript
"finance_update_fee_account": UpdateFeeAccountAction,
"finance_adjust_fee": ApplyFeeAdjustmentAction,
"finance_apply_discount": ApplyFeeAdjustmentAction,
```

---

## 3. Plan Phase 2 (Testing & Verification Directives)

*Do not create test files in Phase 1. Complete Phase 1 code implementations first, then create the unit test suite in Phase 2 at `DazzlingDB/Test/Finance_UpdateFeeAccountTests.js` covering:*
1. Direct account fee update (`finance_update_fee_account`).
2. Post-enrollment fee adjustment with `FeeAdjustment` audit record (`finance_adjust_fee`).
3. Verification that `status === 'paid'` installments remain untouched.
4. Validation assertion that `newFinalFee < totalCollected` throws `SheetDB.ValidationError`.
5. Total fee equality invariant assertion ($\sum \text{due\_amount} == \text{final\_fee}$).
