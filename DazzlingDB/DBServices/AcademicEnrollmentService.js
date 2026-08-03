/**
 * @file AcademicEnrollmentService.js
 * Path: DazzlingDB/DBServices/AcademicEnrollmentService.js
 * 
 * Domain Service handling Academic Enrollment & Financial Schedule Management operations.
 * Implements installment rescheduling, schedule restructuring, payment overflow cascading,
 * and deletion protection rules.
 */

/**
 * Standalone decoupled utility functions for financial allocation, math precision, and schedule sequencing.
 */
const FinanceAllocationUtil = {
  /**
   * Sorts installments chronologically by due_date and re-sequences installment_number integers (1, 2, ... N).
   * 
   * @param {Array<Object>} installments - Array of installment records.
   * @returns {Array<Object>} Chronologically sorted and re-sequenced array of installments.
   */
  sortAndResequenceInstallments: function(installments) {
    if (!Array.isArray(installments)) return [];
    
    const sorted = [...installments].sort((a, b) => {
      const dateA = typeof DazzlingDateTime !== 'undefined' && DazzlingDateTime.safeParseStringToDate
        ? DazzlingDateTime.safeParseStringToDate(String(a.due_date))
        : new Date(a.due_date);
      const dateB = typeof DazzlingDateTime !== 'undefined' && DazzlingDateTime.safeParseStringToDate
        ? DazzlingDateTime.safeParseStringToDate(String(b.due_date))
        : new Date(b.due_date);
      
      const timeA = dateA && !isNaN(dateA.getTime()) ? dateA.getTime() : 0;
      const timeB = dateB && !isNaN(dateB.getTime()) ? dateB.getTime() : 0;
      return timeA - timeB;
    });

    sorted.forEach((inst, idx) => {
      inst.installment_number = idx + 1;
    });

    return sorted;
  },

  /**
   * Enforces 2-decimal rounded precision total fee equality math.
   * Asserts that Math.abs(sum(due_amount) - finalFee) < 0.01.
   * 
   * @param {Array<Object>} installments - Array of installment objects.
   * @param {number} finalFee - Master fee account final_fee.
   * @returns {boolean} True if valid; throws SheetDB.ValidationError if mismatched.
   */
  assertTotalFeeEquality: function(installments, finalFee) {
    const totalDue = installments.reduce((acc, inst) => acc + Number(inst.due_amount || 0), 0);
    const roundedDue = Math.round(totalDue * 100) / 100;
    const roundedFinalFee = Math.round(Number(finalFee || 0) * 100) / 100;

    if (Math.abs(roundedDue - roundedFinalFee) >= 0.01) {
      const errorMsg = `Total fee invariant mismatch: Sum of installment due amounts (₹${roundedDue}) must equal final fee (₹${roundedFinalFee}).`;
      console.warn(`[FinanceAllocationUtil] ${errorMsg}`);
      throw new SheetDB.ValidationError(errorMsg);
    }
    return true;
  },

  /**
   * Checks linked Payment receipts tied to a target installment_id.
   * Enforces that proposed due_amount cannot be reduced below the direct sum of linked Payment rows.
   * 
   * @param {string} installmentId - Target installment ID (INS-xxx).
   * @param {number} proposedDueAmount - New proposed due amount.
   * @param {Object} db - Active database context instance.
   * @returns {boolean} True if valid; throws SheetDB.ValidationError if broken.
   */
  validateDirectPaymentReceiptSum: function(installmentId, proposedDueAmount, db) {
    if (!installmentId || !db || !db.Payment) return true;

    let linkedPayments = [];
    if (typeof db.Payment.where === 'function') {
      linkedPayments = db.Payment.where({ installment_id: installmentId });
    } else if (typeof db.Payment.findAll === 'function') {
      linkedPayments = db.Payment.findAll().filter(p => p.installment_id === installmentId);
    } else if (typeof db.Payment.all === 'function') {
      linkedPayments = db.Payment.all().filter(p => p.installment_id === installmentId);
    }

    // Filter active (non-voided) payments
    const activePayments = linkedPayments.filter(p => p.status !== "voided");
    const directReceiptSum = activePayments.reduce((sum, p) => sum + Number(p.amount_paid || p.amount || 0), 0);

    if (Number(proposedDueAmount) < directReceiptSum) {
      const errorMsg = `Payment receipt alignment protection: Installment ${installmentId} due amount (₹${proposedDueAmount}) cannot be set below total direct payment receipts (₹${directReceiptSum}).`;
      console.warn(`[FinanceAllocationUtil] ${errorMsg}`);
      throw new SheetDB.ValidationError(errorMsg);
    }
    return true;
  },

  /**
   * Allocates paid amounts sequentially across sorted installments.
   * Reused from RecordPaymentAction Step 2 algorithm.
   * 
   * @param {Array<Object>} installments - Sorted array of installment objects.
   * @param {number} totalPaidAmount - Total accumulated payments collected for the account.
   * @param {Date|string} [referenceDate] - Current reference date for overdue evaluation.
   * @returns {Array<Object>} Copy of installments with updated paid_amount and status fields.
   */
  allocatePaymentCascade: function(installments, totalPaidAmount, referenceDate) {
    const refDate = referenceDate
      ? (typeof DazzlingDateTime !== 'undefined' && DazzlingDateTime.safeParseStringToDate ? DazzlingDateTime.safeParseStringToDate(String(referenceDate)) : new Date(referenceDate))
      : new Date();
    
    let remainingPaid = Number(totalPaidAmount || 0);

    return installments.map(inst => {
      const due = Number(inst.due_amount || 0);
      let allocatedPaid = 0;

      if (remainingPaid > 0) {
        allocatedPaid = Math.min(remainingPaid, due);
        remainingPaid -= allocatedPaid;
      }

      let status = "pending";
      if (allocatedPaid >= due && due > 0) {
        status = "paid";
      } else if (allocatedPaid > 0) {
        status = "partially_paid";
      } else {
        const instDueDate = typeof DazzlingDateTime !== 'undefined' && DazzlingDateTime.safeParseStringToDate
          ? DazzlingDateTime.safeParseStringToDate(String(inst.due_date))
          : new Date(inst.due_date);
        if (instDueDate && !isNaN(instDueDate.getTime()) && instDueDate < refDate) {
          status = "overdue";
        }
      }

      return {
        ...inst,
        paid_amount: allocatedPaid,
        status: status
      };
    });
  },

  /**
   * Calculates the next due date for a StudentFeeAccount based on unpaid installments.
   * 
   * @param {Array<Object>} installments - Array of installment records.
   * @returns {string|null} ISO date string of earliest pending/overdue installment due_date, or null.
   */
  recalculateAccountNextDueDate: function(installments) {
    const unpaid = installments.filter(inst => inst.status === "pending" || inst.status === "partially_paid" || inst.status === "overdue");
    if (unpaid.length === 0) return null;

    const sortedUnpaid = FinanceAllocationUtil.sortAndResequenceInstallments(unpaid);
    const earliest = sortedUnpaid[0];
    
    if (!earliest || !earliest.due_date) return null;

    const parsedDate = typeof DazzlingDateTime !== 'undefined' && DazzlingDateTime.safeParseStringToDate
      ? DazzlingDateTime.safeParseStringToDate(String(earliest.due_date))
      : new Date(earliest.due_date);

    return (parsedDate && typeof DazzlingDateTime !== 'undefined' && DazzlingDateTime.toSheetSafeValue)
      ? DazzlingDateTime.toSheetSafeValue(parsedDate)
      : String(earliest.due_date);
  },

  /**
   * Rebalances unpaid/pending installments when a fee account's final_fee is adjusted.
   * Protects fully paid installments and enforces cash floor guards and direct receipt alignment.
   * 
   * @param {Array<Object>} installments - Existing installment records for the account.
   * @param {number} newFinalFee - Proposed updated final_fee for the StudentFeeAccount.
   * @param {Object} [db] - Active database context instance for receipt checks.
   * @returns {Array<Object>} Rebalanced copy of installments matching newFinalFee.
   * @throws {AcademicEnrollmentError} If cash floor protection or receipt alignment fails.
   */
  allocateFeeAdjustmentRebalance: function(installments, newFinalFee, db, feeAccountAmountPaid = 0) {
    if (!Array.isArray(installments)) return [];

    console.log("[AcademicEnrollmentService:CALCULATION] Rebalancing unpaid installments for proposed final fee ₹" + newFinalFee);
    const sorted = FinanceAllocationUtil.sortAndResequenceInstallments(installments);
    const installmentsPaid = sorted.reduce((acc, inst) => acc + Number(inst.paid_amount || 0), 0);
    const totalCollected = Math.max(Number(feeAccountAmountPaid || 0), installmentsPaid);
    const roundedNewFinalFee = Math.round(Number(newFinalFee || 0) * 100) / 100;

    if (roundedNewFinalFee < totalCollected) {
      const errMsg = `Collected cash floor protection: Proposed final fee (₹${roundedNewFinalFee}) cannot be lower than collected payments (₹${totalCollected}).`;
      console.warn("[AcademicEnrollmentService:WARN] " + errMsg);
      throw new AcademicEnrollmentError(errMsg, "CASH_FLOOR_VIOLATION", {
        proposed_final_fee: roundedNewFinalFee,
        collected_amount_paid: totalCollected
      });
    }

    const targetUnpaidBalance = Math.round((roundedNewFinalFee - totalCollected) * 100) / 100;
    const unpaidInstallments = sorted.filter(inst => inst.status !== 'paid' && Number(inst.due_amount || 0) > Number(inst.paid_amount || 0));

    if (unpaidInstallments.length > 0) {
      const perInstallmentShare = Math.floor((targetUnpaidBalance / unpaidInstallments.length) * 100) / 100;
      let remainder = Math.round((targetUnpaidBalance - (perInstallmentShare * unpaidInstallments.length)) * 100) / 100;

      sorted.forEach(inst => {
        if (inst.status !== 'paid' && Number(inst.due_amount || 0) > Number(inst.paid_amount || 0)) {
          const paidPortion = Number(inst.paid_amount || 0);
          let newUnpaidPortion = perInstallmentShare;
          if (remainder > 0) {
            newUnpaidPortion = Math.round((newUnpaidPortion + 0.01) * 100) / 100;
            remainder = Math.round((remainder - 0.01) * 100) / 100;
          }

          const proposedDue = Math.round((paidPortion + newUnpaidPortion) * 100) / 100;

          if (inst.installment_id && db) {
            try {
              FinanceAllocationUtil.validateDirectPaymentReceiptSum(inst.installment_id, proposedDue, db);
            } catch (err) {
              throw new AcademicEnrollmentError(err.message, "DIRECT_RECEIPT_ALIGNMENT_FAILURE", {
                installment_id: inst.installment_id,
                proposed_due: proposedDue
              });
            }
          }

          inst.due_amount = proposedDue;
        }
      });
    }

    try {
      FinanceAllocationUtil.assertTotalFeeEquality(sorted, roundedNewFinalFee);
    } catch (err) {
      throw new AcademicEnrollmentError(err.message, "FEE_LEDGER_INVARIANT_MISMATCH", {
        sum_installment_due: sorted.reduce((acc, inst) => acc + Number(inst.due_amount || 0), 0),
        final_fee: roundedNewFinalFee
      });
    }

    return FinanceAllocationUtil.allocatePaymentCascade(sorted, totalCollected);
  }
};

/**
 * Custom Domain Exception Class for Academic & Finance Enrollment operations.
 */
class AcademicEnrollmentError extends Error {
  constructor(message, errorCode, details = {}) {
    super(message);
    this.name = "AcademicEnrollmentError";
    this.errorCode = errorCode;
    this.details = details;
  }
}
globalThis.AcademicEnrollmentError = AcademicEnrollmentError;

/**
 * Singleton Domain Service class for Academic Enrollment and Financial Schedule management.
 */
class AcademicEnrollmentService {
  constructor() {}

  /**
   * Singleton accessor.
   * @returns {AcademicEnrollmentService} Global service instance.
   */
  static getInstance() {
    if (!AcademicEnrollmentService._instance) {
      AcademicEnrollmentService._instance = new AcademicEnrollmentService();
    }
    return AcademicEnrollmentService._instance;
  }

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
  adjustFee(payload, context) {
    console.log("[AcademicEnrollmentService:START] Executing adjustFee", payload);
    console.time("ApplyFeeAdjustmentAction Execution");
    const db = context.db || DBContext.getInstance();
    const { student_fee_id, adjustment_type, amount, reason, created_by } = payload;

    const feeAccount = db.StudentFeeAccount.findById(student_fee_id);
    if (!feeAccount) {
      console.warn("[AcademicEnrollmentService:WARN] StudentFeeAccount not found: " + student_fee_id);
      throw new AcademicEnrollmentError(`StudentFeeAccount with ID '${student_fee_id}' not found.`, "FEE_ACCOUNT_NOT_FOUND", { student_fee_id });
    }

    const adjAmount = Math.round(Number(amount) * 100) / 100;
    if (isNaN(adjAmount) || adjAmount <= 0) {
      console.warn("[AcademicEnrollmentService:WARN] Invalid adjustment amount: " + amount);
      throw new AcademicEnrollmentError("Fee adjustment 'amount' must be a positive number.", "INVALID_ADJUSTMENT_AMOUNT", { amount });
    }

    const allowedTypes = ["scholarship", "coupon", "referral", "manual"];
    if (adjustment_type && !allowedTypes.includes(adjustment_type)) {
      console.warn("[AcademicEnrollmentService:WARN] Invalid adjustment type: " + adjustment_type);
      throw new AcademicEnrollmentError(`Invalid adjustment type '${adjustment_type}'. Allowed choices: ${allowedTypes.join(', ')}`, "INVALID_ADJUSTMENT_TYPE", { adjustment_type, allowed_choices: allowedTypes });
    }

    const sfaAdjType = adjustment_type === "manual" ? "manual_override" : adjustment_type;

    const currentDiscount = Number(feeAccount.discount || 0);
    const newDiscount = Math.round((currentDiscount + adjAmount) * 100) / 100;
    const newTotalFee = Number(feeAccount.total_fee || 0);
    const newFinalFee = Math.max(0, Math.round((newTotalFee - newDiscount) * 100) / 100);

    console.log(`[AcademicEnrollmentService:CALCULATION] Fee Account ${student_fee_id}: Total Fee=₹${newTotalFee}, New Discount=₹${newDiscount}, New Final Fee=₹${newFinalFee}`);

    let existingInstallments = [];
    if (typeof db.Installment.where === 'function') {
      existingInstallments = db.Installment.where({ student_fee_id: student_fee_id });
    } else if (typeof db.Installment.all === 'function') {
      existingInstallments = db.Installment.all().filter(i => i.student_fee_id === student_fee_id);
    }

    const totalAccountPaid = Number(feeAccount.amount_paid || 0);
    const rebalancedSchedule = FinanceAllocationUtil.allocateFeeAdjustmentRebalance(existingInstallments, newFinalFee, db, totalAccountPaid);
    const newBalance = Math.max(0, Math.round((newFinalFee - totalAccountPaid) * 100) / 100);
    const newAccountStatus = newBalance <= 0 ? "completed" : "active";
    const nextDueDate = FinanceAllocationUtil.recalculateAccountNextDueDate(rebalancedSchedule);

    let createdAdjustmentRecord = null;
    console.log("[AcademicEnrollmentService:PIPELINE] Beginning AtomicPipeline multi-table transaction execution");
    const pipeCtx = (context && typeof context.trackMutation === 'function')
      ? context
      : (typeof PipelineContext !== 'undefined' ? new PipelineContext(context) : new SheetDB.PipelineContext(context));

    const pipeline = (typeof AtomicPipeline !== 'undefined' ? AtomicPipeline : SheetDB.AtomicPipeline)
      .begin(db, pipeCtx)
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
    console.log(`[AcademicEnrollmentService:SUCCESS] Fee adjustment ₹${adjAmount} applied successfully to ${student_fee_id}`);

    if (context && context.mutationManifest) {
      if (typeof context.mutationManifest.push === 'function') {
        context.mutationManifest.push("FeeAdjustment", "StudentFeeAccount", "Installment");
      }
    }

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
  }

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
  updateFeeAccount(payload, context) {
    console.log("[AcademicEnrollmentService:START] Executing updateFeeAccount", payload);

    if (payload.adjustment && typeof payload.adjustment === 'object') {
      console.log("[AcademicEnrollmentService:DELEGATE] Delegating fee adjustment sub-routine to adjustFee()");
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
      console.warn("[AcademicEnrollmentService:WARN] StudentFeeAccount not found: " + student_fee_id);
      throw new AcademicEnrollmentError(`StudentFeeAccount with ID '${student_fee_id}' not found.`, "FEE_ACCOUNT_NOT_FOUND", { student_fee_id });
    }

    const newTotalFee = total_fee !== undefined ? Math.round(Number(total_fee) * 100) / 100 : Number(feeAccount.total_fee || 0);
    const newDiscount = discount !== undefined ? Math.round(Number(discount) * 100) / 100 : Number(feeAccount.discount || 0);
    const newFinalFee = Math.max(0, Math.round((newTotalFee - newDiscount) * 100) / 100);

    console.log(`[AcademicEnrollmentService:CALCULATION] Account ${student_fee_id}: Base Total=₹${newTotalFee}, Base Discount=₹${newDiscount}, Calculated Final Fee=₹${newFinalFee}`);

    let existingInstallments = [];
    if (typeof db.Installment.where === 'function') {
      existingInstallments = db.Installment.where({ student_fee_id: student_fee_id });
    } else if (typeof db.Installment.all === 'function') {
      existingInstallments = db.Installment.all().filter(i => i.student_fee_id === student_fee_id);
    }

    const totalAccountPaid = Number(feeAccount.amount_paid || 0);
    const rebalancedSchedule = FinanceAllocationUtil.allocateFeeAdjustmentRebalance(existingInstallments, newFinalFee, db, totalAccountPaid);
    const newBalance = Math.max(0, Math.round((newFinalFee - totalAccountPaid) * 100) / 100);
    const newAccountStatus = newBalance <= 0 ? "completed" : "active";
    const nextDueDate = FinanceAllocationUtil.recalculateAccountNextDueDate(rebalancedSchedule);

    const sfaAdjType = adjustment_type === "manual" ? "manual_override" : (adjustment_type || feeAccount.adjustment_type);

    console.log("[AcademicEnrollmentService:PIPELINE] Beginning AtomicPipeline transaction execution");
    const pipeCtx = (context && typeof context.trackMutation === 'function')
      ? context
      : (typeof PipelineContext !== 'undefined' ? new PipelineContext(context) : new SheetDB.PipelineContext(context));

    const pipeline = (typeof AtomicPipeline !== 'undefined' ? AtomicPipeline : SheetDB.AtomicPipeline)
      .begin(db, pipeCtx)
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
    console.log(`[AcademicEnrollmentService:SUCCESS] Fee account ${student_fee_id} updated successfully`);

    if (context && context.mutationManifest) {
      if (typeof context.mutationManifest.push === 'function') {
        context.mutationManifest.push("StudentFeeAccount", "Installment");
      }
    }

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
  }

  /**
   * Executes administrative installment rescheduling, restructuring, and payment re-allocation.
   * 
   * @param {Object} payload - Reschedule payload.
   * @param {string} payload.student_fee_id - Target fee account ID (SFA-xxx).
   * @param {Array<Object>} [payload.update_installments] - [{installment_id, due_date, due_amount}].
   * @param {Array<string>} [payload.delete_installment_ids] - [INS-xxx].
   * @param {Array<Object>} [payload.add_installments] - [{due_date, due_amount}].
   * @param {string} [payload.remarks] - Administrative remarks.
   * @param {Object} context - Execution request context.
   * @returns {Object} Compiled presentation response envelope.
   */
  rescheduleInstallments(payload, context) {
    const startTime = Date.now();
    console.time("RescheduleInstallmentsAction Execution");

    const db = context.db || DBContext.getInstance();
    const { student_fee_id, update_installments = [], delete_installment_ids = [], add_installments = [], remarks } = payload;

    // 1. Fetch StudentFeeAccount
    const feeAccount = db.StudentFeeAccount.findById(student_fee_id);
    if (!feeAccount) {
      throw new SheetDB.EntityNotFoundError("StudentFeeAccount", student_fee_id, "Finance");
    }

    // 2. Fetch existing Installments for this account
    let existingInstallments = [];
    if (typeof db.Installment.where === 'function') {
      existingInstallments = db.Installment.where({ student_fee_id: student_fee_id });
    } else if (typeof db.Installment.findAll === 'function') {
      existingInstallments = db.Installment.findAll().filter(i => i.student_fee_id === student_fee_id);
    } else if (typeof db.Installment.all === 'function') {
      existingInstallments = db.Installment.all().filter(i => i.student_fee_id === student_fee_id);
    }

    // Map existing installments by installment_id for fast lookup
    const existingMap = new Map();
    existingInstallments.forEach(inst => existingMap.set(inst.installment_id, { ...inst }));

    // 3. Deletion Protection Check
    if (Array.isArray(delete_installment_ids) && delete_installment_ids.length > 0) {
      for (const delId of delete_installment_ids) {
        const targetInst = existingMap.get(delId);
        if (!targetInst) {
          throw new SheetDB.EntityNotFoundError("Installment", delId, "Finance");
        }
        
        // Block deletion if paid_amount > 0
        if (Number(targetInst.paid_amount || 0) > 0) {
          throw new AcademicEnrollmentError(`Payment protection: Cannot delete installment ${delId} because payments (₹${targetInst.paid_amount}) have already been collected on it.`, "PAID_INSTALLMENT_MUTATION_PROTECTED", { installment_id: delId, paid_amount: targetInst.paid_amount });
        }

        // Block deletion if linked payments exist
        let linkedPayments = [];
        if (db.Payment) {
          if (typeof db.Payment.where === 'function') {
            linkedPayments = db.Payment.where({ installment_id: delId });
          } else if (typeof db.Payment.all === 'function') {
            linkedPayments = db.Payment.all().filter(p => p.installment_id === delId);
          }
        }
        const activePayments = linkedPayments.filter(p => p.status !== "voided");
        if (activePayments.length > 0) {
          throw new AcademicEnrollmentError(`Payment protection: Cannot delete installment ${delId} because active payment transactions are linked to it.`, "PAID_INSTALLMENT_MUTATION_PROTECTED", { installment_id: delId });
        }

        // Remove from working map
        existingMap.delete(delId);
      }
    }

    // 4. Apply Updates to Existing Installments
    if (Array.isArray(update_installments) && update_installments.length > 0) {
      for (const up of update_installments) {
        const targetInst = existingMap.get(up.installment_id);
        if (!targetInst) {
          throw new SheetDB.EntityNotFoundError("Installment", up.installment_id, "Finance");
        }

        const newDueDate = up.due_date ? String(up.due_date) : targetInst.due_date;
        const newDueAmount = up.due_amount !== undefined ? Number(up.due_amount) : Number(targetInst.due_amount);

        // Validate direct payment receipt alignment
        try {
          FinanceAllocationUtil.validateDirectPaymentReceiptSum(up.installment_id, newDueAmount, db);
        } catch (err) {
          throw new AcademicEnrollmentError(err.message, "DIRECT_RECEIPT_ALIGNMENT_FAILURE", { installment_id: up.installment_id, proposed_due: newDueAmount });
        }

        existingMap.set(up.installment_id, {
          ...targetInst,
          due_date: newDueDate,
          due_amount: newDueAmount
        });
      }
    }

    // 5. Append New Installments
    const newInstallmentsToCreate = [];
    if (Array.isArray(add_installments) && add_installments.length > 0) {
      for (const add of add_installments) {
        if (!add.due_date || add.due_amount === undefined) {
          throw new SheetDB.ValidationError("Each new installment in add_installments requires 'due_date' and 'due_amount'.");
        }
        newInstallmentsToCreate.push({
          student_fee_id: student_fee_id,
          due_amount: Number(add.due_amount),
          paid_amount: 0,
          late_fee_amount: 0,
          due_date: String(add.due_date),
          status: "pending"
        });
      }
    }

    // Combine current working working array of existing and new installments
    let workingSchedule = [...Array.from(existingMap.values()), ...newInstallmentsToCreate];

    // 6. Chronological Sorting & Sequence Update
    workingSchedule = FinanceAllocationUtil.sortAndResequenceInstallments(workingSchedule);

    // 7. Total Fee Equality Invariant Assertion
    try {
      FinanceAllocationUtil.assertTotalFeeEquality(workingSchedule, feeAccount.final_fee);
    } catch (err) {
      throw new AcademicEnrollmentError(err.message, "FEE_LEDGER_INVARIANT_MISMATCH", { sum_installment_due: workingSchedule.reduce((a, c) => a + Number(c.due_amount || 0), 0), final_fee: feeAccount.final_fee });
    }

    // 8. Cascading Payment Re-Allocation & Status Evaluation
    const totalAccountPaid = Number(feeAccount.amount_paid || 0);
    workingSchedule = FinanceAllocationUtil.allocatePaymentCascade(workingSchedule, totalAccountPaid);

    // 9. Account Balance & Status Recalculation
    const newBalance = Math.max(0, Number(feeAccount.final_fee || 0) - totalAccountPaid);
    const newAccountStatus = newBalance <= 0 ? "completed" : "active";
    const nextDueDate = FinanceAllocationUtil.recalculateAccountNextDueDate(workingSchedule);

    // 10. Execute Transactional Mutations via TransactionTracker
    const tx = (typeof TransactionTracker !== 'undefined')
      ? new TransactionTracker()
      : (typeof SheetDB !== 'undefined' && SheetDB.TransactionTracker ? new SheetDB.TransactionTracker() : null);

    // Track and delete removed installments (with full snapshot backup for LIFO rollback)
    delete_installment_ids.forEach(delId => {
      const originalRecord = existingInstallments.find(i => i.installment_id === delId);
      if (originalRecord) {
        if (tx) tx.trackDelete(db.Installment, delId, { ...originalRecord });
        db.Installment.remove(delId);
      }
    });

    // Track and update modified existing installments
    workingSchedule.forEach(inst => {
      if (inst.installment_id) {
        const originalRecord = existingInstallments.find(i => i.installment_id === inst.installment_id);
        if (originalRecord) {
          if (tx) tx.trackUpdate(db.Installment, inst.installment_id, { ...originalRecord });
          db.Installment.update(inst.installment_id, {
            installment_number: inst.installment_number,
            due_amount: inst.due_amount,
            paid_amount: inst.paid_amount,
            due_date: inst.due_date,
            status: inst.status
          });
        }
      }
    });

    // Track and insert new installments
    const insertedNewInstallments = [];
    newInstallmentsToCreate.forEach(newInst => {
      // Find updated state from workingSchedule
      const resolvedState = workingSchedule.find(w => !w.installment_id && w.due_date === newInst.due_date && w.due_amount === newInst.due_amount) || newInst;
      
      const createdRecord = db.Installment.insert({
        student_fee_id: student_fee_id,
        installment_number: resolvedState.installment_number,
        due_amount: resolvedState.due_amount,
        paid_amount: resolvedState.paid_amount || 0,
        late_fee_amount: 0,
        due_date: resolvedState.due_date,
        status: resolvedState.status || "pending"
      });

      if (createdRecord && createdRecord.installment_id) {
        if (tx) tx.trackInsert(db.Installment, createdRecord.installment_id);
        insertedNewInstallments.push(createdRecord);
      }
    });

    // Track and update master StudentFeeAccount
    const originalFeeAccount = { ...feeAccount };
    if (tx) tx.trackUpdate(db.StudentFeeAccount, student_fee_id, originalFeeAccount);
    db.StudentFeeAccount.update(student_fee_id, {
      balance_due: newBalance,
      next_due_date: nextDueDate,
      status: newAccountStatus,
      remarks: remarks ? String(remarks) : feeAccount.remarks
    });

    // 11. Populate Mutation Manifest
    if (context && context.mutationManifest) {
      if (typeof context.mutationManifest.push === 'function') {
        context.mutationManifest.push("Installment", "StudentFeeAccount");
      }
    }

    console.timeEnd("RescheduleInstallmentsAction Execution");

    return {
      success: true,
      message: `Installments rescheduled successfully for fee account ${student_fee_id}.`,
      data: {
        student_fee_id: student_fee_id,
        final_fee: feeAccount.final_fee,
        amount_paid: totalAccountPaid,
        balance_due: newBalance,
        next_due_date: nextDueDate,
        account_status: newAccountStatus,
        rescheduled_installments_count: workingSchedule.length,
        deleted_count: delete_installment_ids.length,
        added_count: add_installments.length
      }
    };
  }

  /**
   * Updates an existing Enrollment record and its associated BatchAllocation records atomically using AtomicPipeline.
   * Delegates pre-flight rules execution to ValidationEngine and EnrollmentUpdateRules.
   * 
   * @param {Object} payload - Input parameters.
   * @param {Object} requestContext - System execution context containing db and mutationManifest.
   * @returns {Object} Presentation envelope object with updated Enrollment and BatchAllocation rows.
   * @throws {AcademicEnrollmentError} Structured domain exception for invalid state/not found scenarios.
   */
  updateEnrollment(payload, requestContext) {
    const db = DBContext.getInstance();
    const pipelineContext = new SheetDB.PipelineContext(requestContext || { mutationManifest: [] });

    // Step 1: Execute Pre-Flight Validation Engine Pipeline
    const vCtx = new ValidationContext(db, payload ? payload.enrollment_id : null, payload);
    if (typeof EnrollmentUpdateRules !== "undefined") {
      ValidationEngine.run(vCtx, EnrollmentUpdateRules);
    }

    if (!vCtx.isValid()) {
      const firstErr = vCtx.errors[0];
      let errCode = "VALIDATION_FAILURE";
      if (firstErr.field === "enrollment_id") errCode = "ENROLLMENT_NOT_FOUND";
      if (firstErr.field === "allocations") errCode = "INVALID_BATCH_ALLOCATION";

      throw new AcademicEnrollmentError(
        firstErr.message,
        errCode,
        { errors: vCtx.errors }
      );
    }

    const targetEnrollment = vCtx.state.existingEnrollment || db.Enrollment.findById(payload.enrollment_id);
    if (!targetEnrollment) {
      throw new AcademicEnrollmentError(
        `Enrollment record not found for enrollment_id: ${payload.enrollment_id}`,
        "ENROLLMENT_NOT_FOUND",
        { enrollment_id: payload.enrollment_id }
      );
    }

    const existingAllocations = vCtx.state.existingAllocations || db.BatchAllocation.where({ enrollment_id: payload.enrollment_id });

    // Step 2: AtomicPipeline Fluent Execution Chain
    const pipelineResult = SheetDB.AtomicPipeline.begin(db, pipelineContext)
      .addStep("Enrollment", function(repo, state) {
        const updateData = {};
        if (payload.roll_number !== undefined) updateData.roll_number = payload.roll_number;
        if (payload.enrollment_date !== undefined) updateData.enrollment_date = payload.enrollment_date;
        if (payload.status !== undefined) updateData.status = payload.status;
        if (payload.academic_status !== undefined) updateData.academic_status = payload.academic_status;
        if (payload.metadata !== undefined) updateData.metadata = payload.metadata;

        if (Object.keys(updateData).length > 0) {
          state.updatedEnrollment = repo.update(payload.enrollment_id, updateData);
        } else {
          state.updatedEnrollment = targetEnrollment;
        }
      })
      .addStep("BatchAllocation", function(repo, state) {
        state.updatedAllocations = [];
        const explicitAllocations = Array.isArray(payload.allocations) ? payload.allocations : [];
        const updatedAllocationIds = new Set();

        // Apply explicit seating reassignments
        explicitAllocations.forEach(function (allocInput) {
          const matchingAlloc = existingAllocations.find(function (a) { return a.allocation_id === allocInput.allocation_id; });
          const allocPatch = {};
          if (allocInput.batch_id !== undefined) allocPatch.batch_id = allocInput.batch_id;
          if (allocInput.status !== undefined) allocPatch.status = allocInput.status;
          if (allocInput.remarks !== undefined) allocPatch.remarks = allocInput.remarks;
          if (allocInput.status === "dropped" && matchingAlloc && !matchingAlloc.dropped_at) {
            allocPatch.dropped_at = new Date().toISOString();
          }

          if (matchingAlloc) {
            const updatedAlloc = repo.update(allocInput.allocation_id, allocPatch);
            state.updatedAllocations.push(updatedAlloc);
            updatedAllocationIds.add(allocInput.allocation_id);
          }
        });

        // Calculate and apply seating status cascades using standalone internal helper
        const newStatus = payload.status || payload.academic_status;
        const cascadePatches = _calculateAllocationStatusCascade(
          newStatus,
          existingAllocations,
          updatedAllocationIds
        );

        cascadePatches.forEach(function (patch) {
          const allocId = patch.allocation_id;
          delete patch.allocation_id;
          const cascadedAlloc = repo.update(allocId, patch);
          state.updatedAllocations.push(cascadedAlloc);
        });
      })
      .execute();

    return {
      success: true,
      message: `Enrollment contract [${payload.enrollment_id}] updated successfully.`,
      data: {
        enrollment: pipelineResult.updatedEnrollment,
        allocations: pipelineResult.updatedAllocations
      }
    };
  }

  /**
   * Soft-deletes an enrollment contract with configurable financial settlement.
   * Supports two discard modes:
   *   - 'refund': Issues a refund Payment record, sets SFA status to 'refunded'.
   *   - 'no_refund': Cancels the fee account, waives unpaid balance, preserves payment history.
   *
   * @param {Object} payload - Discard parameters.
   * @param {string} payload.enrollment_id - Target enrollment ID (ENR-xxx).
   * @param {string} payload.discard_mode - 'refund' | 'no_refund'.
   * @param {string} [payload.remarks] - Optional reason for discard.
   * @param {Object} requestContext - Execution context from ApiDispatcher.
   * @returns {Object} Presentation envelope with discard summary.
   * @throws {AcademicEnrollmentError} ENROLLMENT_NOT_FOUND | ALREADY_DISCARDED
   */
  discardEnrollment(payload, requestContext) {
    const db = DBContext.getInstance();
    const pipelineContext = new SheetDB.PipelineContext(requestContext || { mutationManifest: [] });

    const targetEnrollment = db.Enrollment.findById(payload.enrollment_id);
    if (!targetEnrollment) {
      throw new AcademicEnrollmentError(
        `Enrollment record not found for enrollment_id: ${payload.enrollment_id}`,
        "ENROLLMENT_NOT_FOUND",
        { enrollment_id: payload.enrollment_id }
      );
    }

    if (targetEnrollment.status === "discarded") {
      throw new AcademicEnrollmentError(
        `Enrollment [${payload.enrollment_id}] is already discarded.`,
        "ALREADY_DISCARDED",
        { enrollment_id: payload.enrollment_id }
      );
    }

    const existingAllocations = db.BatchAllocation.where({ enrollment_id: payload.enrollment_id });
    const feeAccount = db.StudentFeeAccount.findOne({ enrollment_id: payload.enrollment_id });
    const installments = feeAccount ? db.Installment.where({ student_fee_id: feeAccount.student_fee_id }) : [];
    const totalPaid = feeAccount ? Number(feeAccount.amount_paid || 0) : 0;
    const nowIso = new Date().toISOString();
    const remarksStr = payload.remarks ? String(payload.remarks).trim() : "Enrollment discarded via administrative action";

    const pipelineResult = SheetDB.AtomicPipeline.begin(db, pipelineContext)
      .addStep("Enrollment", function(repo, state) {
        state.discardedEnrollment = repo.update(payload.enrollment_id, {
          status: "discarded",
          academic_status: "withdrawn"
        });
      })
      .addStep("BatchAllocation", function(repo, state) {
        state.droppedAllocations = [];
        existingAllocations.forEach(function(alloc) {
          const droppedAlloc = repo.update(alloc.allocation_id, {
            status: "dropped",
            dropped_at: nowIso,
            remarks: remarksStr
          });
          state.droppedAllocations.push(droppedAlloc);
        });
      })
      .addStep("StudentFeeAccount", function(repo, state) {
        if (!feeAccount) return;
        if (payload.discard_mode === "refund") {
          state.settledFeeAccount = repo.update(feeAccount.student_fee_id, {
            status: "refunded",
            amount_paid: 0,
            balance_due: 0,
            remarks: remarksStr
          });
        } else {
          state.settledFeeAccount = repo.update(feeAccount.student_fee_id, {
            status: "cancelled",
            balance_due: 0,
            remarks: remarksStr
          });
        }
      })
      .addStep("Installment", function(repo, state) {
        state.cancelledInstallments = [];
        installments.forEach(function(inst) {
          if (inst.status !== "paid") {
            const cancelledInst = repo.update(inst.installment_id, {
              status: "cancelled",
              due_amount: Number(inst.paid_amount || 0)
            });
            state.cancelledInstallments.push(cancelledInst);
          }
        });
      })
      .addStep("Payment", function(repo, state) {
        if (payload.discard_mode === "refund" && feeAccount && totalPaid > 0) {
          state.refundPayment = repo.insert({
            student_fee_id: feeAccount.student_fee_id,
            installment_id: null,
            amount_paid: -totalPaid,
            payment_date: nowIso,
            payment_method: "cash",
            status: "success",
            remarks: `Refund issued upon enrollment discard: ${remarksStr}`,
            created_by: (requestContext && requestContext.user) ? requestContext.user.username : "system"
          });
        }
      })
      .execute();

    return {
      success: true,
      message: `Enrollment [${payload.enrollment_id}] discarded successfully (${payload.discard_mode}).`,
      data: {
        enrollment_id: payload.enrollment_id,
        status: "discarded",
        discard_mode: payload.discard_mode,
        allocations_dropped: pipelineResult.droppedAllocations ? pipelineResult.droppedAllocations.length : 0,
        fee_account_status: pipelineResult.settledFeeAccount ? pipelineResult.settledFeeAccount.status : null,
        refund_amount: (payload.discard_mode === "refund") ? totalPaid : 0,
        refund_payment_id: pipelineResult.refundPayment ? pipelineResult.refundPayment.payment_id : null
      }
    };
  }

  /**
   * Migrates an active enrollment to a new Package or Course.
   * Closes the source enrollment contract, rolls over paid amounts (optional),
   * and creates a fresh academic contract with new BatchAllocation and fee account.
   *
   * @param {Object} payload - Migration parameters.
   * @param {string} payload.enrollment_id - Source enrollment ID (ENR-xxx).
   * @param {string} payload.target_type - Target entity type: 'course' | 'package'.
   * @param {string} payload.target_id - Target Course/Package ID.
   * @param {boolean} [payload.rollover_payments=false] - Roll over collected payments to new SFA.
   * @param {number} [payload.new_fee] - Override total fee for new contract (optional).
   * @param {Array<Object>} [payload.batch_assignments] - Per-course batch_id assignments [{course_id, batch_id}].
   * @param {Array<Object>} [payload.installment_plan] - Optional installment schedule [{due_date, due_amount}].
   * @param {string} [payload.remarks] - Administrative reason for migration.
   * @param {Object} requestContext - Execution context from ApiDispatcher.
   * @returns {Object} Presentation envelope with old and new enrollment summaries.
   * @throws {AcademicEnrollmentError} ENROLLMENT_NOT_FOUND | ALREADY_CLOSED | TARGET_NOT_FOUND | TARGET_SAME_AS_SOURCE
   */
  migrateEnrollment(payload, requestContext) {
    const db = DBContext.getInstance();
    const pipelineContext = new SheetDB.PipelineContext(requestContext || { mutationManifest: [] });

    // Step 1: Pre-flight Validations
    const oldEnrollment = db.Enrollment.findById(payload.enrollment_id);
    if (!oldEnrollment) {
      throw new AcademicEnrollmentError(
        `Source enrollment record not found for enrollment_id: ${payload.enrollment_id}`,
        "ENROLLMENT_NOT_FOUND",
        { enrollment_id: payload.enrollment_id }
      );
    }

    const closedStatuses = ["discarded", "withdrawn", "completed"];
    if (closedStatuses.includes(oldEnrollment.status)) {
      throw new AcademicEnrollmentError(
        `Cannot migrate non-active enrollment [${payload.enrollment_id}] (current status: ${oldEnrollment.status}).`,
        "ALREADY_CLOSED",
        { enrollment_id: payload.enrollment_id, status: oldEnrollment.status }
      );
    }

    if (oldEnrollment.enrollment_type === payload.target_type && oldEnrollment.item_id === payload.target_id) {
      throw new AcademicEnrollmentError(
        `Target [${payload.target_type}:${payload.target_id}] is identical to current enrollment.`,
        "TARGET_SAME_AS_SOURCE",
        { target_type: payload.target_type, target_id: payload.target_id }
      );
    }

    let targetEntity = null;
    let courseIds = [];
    let courseFeesMap = {};
    let defaultTotalFee = 0;

    if (payload.target_type === "package") {
      targetEntity = db.Package ? db.Package.findById(payload.target_id) : null;
      if (!targetEntity) {
        throw new AcademicEnrollmentError(
          `Target Package [${payload.target_id}] not found.`,
          "TARGET_NOT_FOUND",
          { target_id: payload.target_id }
        );
      }
      defaultTotalFee = Number(targetEntity.package_fee || 0);

      const packageItems = db.PackageItem ? db.PackageItem.where({ package_id: payload.target_id, entity_type: "course" }) : [];
      packageItems.forEach(function(pi) {
        courseIds.push(pi.entity_id);
        const courseObj = db.Course ? db.Course.findById(pi.entity_id) : null;
        courseFeesMap[pi.entity_id] = courseObj ? Number(courseObj.base_fee || 0) : 0;
      });
    } else {
      targetEntity = db.Course ? db.Course.findById(payload.target_id) : null;
      if (!targetEntity) {
        throw new AcademicEnrollmentError(
          `Target Course [${payload.target_id}] not found.`,
          "TARGET_NOT_FOUND",
          { target_id: payload.target_id }
        );
      }
      defaultTotalFee = Number(targetEntity.base_fee || 0);
      courseIds = [payload.target_id];
      courseFeesMap[payload.target_id] = defaultTotalFee;
    }

    const oldAllocations = db.BatchAllocation.where({ enrollment_id: payload.enrollment_id });
    const oldSfa = db.StudentFeeAccount.findOne({ enrollment_id: payload.enrollment_id });
    const oldInstallments = oldSfa ? db.Installment.where({ student_fee_id: oldSfa.student_fee_id }) : [];

    const rolloverAmount = payload.rollover_payments === true && oldSfa ? Number(oldSfa.amount_paid || 0) : 0;
    const finalTotalFee = payload.new_fee !== undefined ? Number(payload.new_fee) : defaultTotalFee;
    const balanceDue = Math.max(0, finalTotalFee - rolloverAmount);
    const nowIso = new Date().toISOString();
    const remarksStr = payload.remarks ? String(payload.remarks).trim() : `Migrated from ${oldEnrollment.enrollment_type}:${oldEnrollment.item_id}`;

    // Map batch assignments from payload if provided
    const batchAssignmentsMap = {};
    if (Array.isArray(payload.batch_assignments)) {
      payload.batch_assignments.forEach(function(ba) {
        if (ba.course_id && ba.batch_id) {
          batchAssignmentsMap[ba.course_id] = ba.batch_id;
        }
      });
    }

    // Step 2: Atomic Pipeline Execution
    const pipelineResult = SheetDB.AtomicPipeline.begin(db, pipelineContext)
      .addStep("Enrollment", function(repo, state) {
        state.closedOldEnrollment = repo.update(payload.enrollment_id, {
          status: "withdrawn",
          academic_status: "withdrawn"
        });
      })
      .addStep("BatchAllocation", function(repo, state) {
        state.droppedOldAllocations = [];
        oldAllocations.forEach(function(alloc) {
          const droppedAlloc = repo.update(alloc.allocation_id, {
            status: "dropped",
            dropped_at: nowIso,
            remarks: `Dropped via migration to ${payload.target_type}:${payload.target_id}`
          });
          state.droppedOldAllocations.push(droppedAlloc);
        });
      })
      .addStep("StudentFeeAccount", function(repo, state) {
        if (!oldSfa) return;
        state.closedOldSfa = repo.update(oldSfa.student_fee_id, {
          status: "completed",
          balance_due: 0,
          remarks: `Closed via migration to ${payload.target_type}:${payload.target_id}`
        });
      })
      .addStep("Installment", function(repo, state) {
        state.cancelledOldInstallments = [];
        oldInstallments.forEach(function(inst) {
          if (inst.status !== "paid") {
            const cancelledInst = repo.update(inst.installment_id, {
              status: "cancelled",
              due_amount: Number(inst.paid_amount || 0)
            });
            state.cancelledOldInstallments.push(cancelledInst);
          }
        });
      })
      .addStep("Enrollment", function(repo, state) {
        state.newEnrollment = repo.insert({
          student_id: oldEnrollment.student_id,
          enrollment_type: payload.target_type,
          item_id: payload.target_id,
          roll_number: oldEnrollment.roll_number || null,
          enrollment_date: nowIso,
          status: "active",
          academic_status: "active",
          metadata: { course_fees: courseFeesMap, migrated_from: payload.enrollment_id }
        });
        state.newEnrollmentId = state.newEnrollment.enrollment_id;
      })
      .addStep("BatchAllocation", function(repo, state) {
        state.newAllocations = [];
        courseIds.forEach(function(courseId) {
          const assignedBatchId = batchAssignmentsMap[courseId] || null;
          const newAlloc = repo.insert({
            student_id: oldEnrollment.student_id,
            enrollment_id: state.newEnrollmentId,
            course_id: courseId,
            batch_id: assignedBatchId,
            status: "active",
            remarks: `Allocated via migration from ${payload.enrollment_id}`
          });
          state.newAllocations.push(newAlloc);
        });
      })
      .addStep("StudentFeeAccount", function(repo, state) {
        let feePlanId = null;
        if (db.FeePlan) {
          const existingPlan = db.FeePlan.findOne({ entity_id: payload.target_id, entity_type: payload.target_type });
          feePlanId = existingPlan ? existingPlan.fee_plan_id : null;
        }

        state.newSfa = repo.insert({
          enrollment_id: state.newEnrollmentId,
          fee_plan_id: feePlanId,
          total_fee: finalTotalFee,
          discount: 0,
          final_fee: finalTotalFee,
          amount_paid: rolloverAmount,
          balance_due: balanceDue,
          is_overdue: false,
          status: balanceDue === 0 ? "completed" : "active",
          remarks: remarksStr,
          created_by: (requestContext && requestContext.user) ? requestContext.user.username : "system"
        });
        state.newSfaId = state.newSfa.student_fee_id;
      })
      .addStep("Installment", function(repo, state) {
        state.newInstallments = [];
        if (Array.isArray(payload.installment_plan) && payload.installment_plan.length > 0) {
          payload.installment_plan.forEach(function(instInput, idx) {
            const dueAmt = Number(instInput.due_amount || instInput.amount || 0);
            const newInst = repo.insert({
              student_fee_id: state.newSfaId,
              installment_number: idx + 1,
              due_amount: dueAmt,
              paid_amount: 0,
              due_date: instInput.due_date,
              status: "pending"
            });
            state.newInstallments.push(newInst);
          });
        }
      })
      .execute();

    return {
      success: true,
      message: `Enrollment migrated from [${payload.enrollment_id}] to new contract [${pipelineResult.newEnrollmentId}].`,
      data: {
        old_contract: {
          enrollment_id: payload.enrollment_id,
          status: "withdrawn",
          fee_account_status: oldSfa ? "completed" : null
        },
        new_contract: {
          enrollment_id: pipelineResult.newEnrollmentId,
          enrollment_type: payload.target_type,
          item_id: payload.target_id,
          status: "active",
          fee_account_id: pipelineResult.newSfaId,
          total_fee: finalTotalFee,
          amount_paid: rolloverAmount,
          balance_due: balanceDue,
          allocations_created: pipelineResult.newAllocations ? pipelineResult.newAllocations.length : 0,
          installments_created: pipelineResult.newInstallments ? pipelineResult.newInstallments.length : 0
        }
      }
    };
  }
}




/**
 * Internal helper to calculate seating allocation status cascades when an Enrollment status changes.
 * Standard function declaration pattern outside property assignments.
 * 
 * @param {string} enrollmentStatus - Updated status or academic_status.
 * @param {Array<Object>} existingAllocations - Current BatchAllocation rows.
 * @param {Set<string>} updatedAllocationIds - Set of allocation_ids already handled explicitly.
 * @returns {Array<Object>} List of allocation patch descriptors.
 */
function _calculateAllocationStatusCascade(enrollmentStatus, existingAllocations, updatedAllocationIds) {
  if (!enrollmentStatus || !["withdrawn", "completed", "suspended"].includes(enrollmentStatus)) {
    return [];
  }

  const cascadeStatus = enrollmentStatus === "withdrawn" ? "dropped" : enrollmentStatus;
  const patches = [];

  existingAllocations.forEach(function (alloc) {
    if (!updatedAllocationIds.has(alloc.allocation_id) && alloc.status !== cascadeStatus) {
      const patch = {
        allocation_id: alloc.allocation_id,
        status: cascadeStatus
      };
      if (cascadeStatus === "dropped") {
        patch.dropped_at = new Date().toISOString();
      }
      patches.push(patch);
    }
  });

  return patches;
}

// Global scope registration for Google Apps Script execution realm
globalThis.FinanceAllocationUtil = FinanceAllocationUtil;
globalThis.AcademicEnrollmentError = AcademicEnrollmentError;
globalThis.AcademicEnrollmentService = AcademicEnrollmentService;
globalThis._calculateAllocationStatusCascade = _calculateAllocationStatusCascade;


