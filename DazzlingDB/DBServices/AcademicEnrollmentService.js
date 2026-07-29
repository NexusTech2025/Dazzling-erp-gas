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
  }
};

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
          throw new SheetDB.ValidationError(`Payment protection: Cannot delete installment ${delId} because payments (₹${targetInst.paid_amount}) have already been collected on it.`);
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
          throw new SheetDB.ValidationError(`Payment protection: Cannot delete installment ${delId} because active payment transactions are linked to it.`);
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
        FinanceAllocationUtil.validateDirectPaymentReceiptSum(up.installment_id, newDueAmount, db);

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
    FinanceAllocationUtil.assertTotalFeeEquality(workingSchedule, feeAccount.final_fee);

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
}

// Global scope registration for Google Apps Script execution realm
globalThis.FinanceAllocationUtil = FinanceAllocationUtil;
globalThis.AcademicEnrollmentService = AcademicEnrollmentService;
