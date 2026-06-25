/**
 * @file ConcreteActionsX.js
 * Layer: Application Service Layer (Bulk Deletion Subclasses)
 */

/**
 * Auth Domain: Delete many users
 */
class DeleteManyUsersAction extends DeleteManyRecordsAction {
  _validate() {
    this._params.payload.table = "User";
    super._validate();

    const { ids } = this._params.payload;
    const selfId = this._user ? this._user.user_id : null;

    ids.forEach(id => {
      const usr = this._db.User.findById(id);
      if (usr && usr.role === "admin") {
        throw new ActionValidationError(`User '${id}' is an administrator and cannot be deleted.`);
      }
      if (selfId && id === selfId) {
        throw new ActionValidationError("Self-deletion is prohibited.");
      }
    });
  }

  _execute() {
    const { ids } = this._params.payload;
    const dryRun = this._params.payload.dryRun !== false;

    if (!dryRun) {
      // CASCADE delete active sessions for these users
      const allSessions = this._db.Session.all();
      allSessions.forEach(sess => {
        if (ids.includes(sess.user_id)) {
          this._db.Session.remove(sess.session_id);
        }
      });
    }

    return super._execute();
  }
}

/**
 * Auth Domain: Delete many sessions
 */
class DeleteManySessionsAction extends DeleteManyRecordsAction {
  _validate() {
    this._params.payload.table = "Session";
    super._validate();
  }
}

/**
 * Academic Domain: Delete many enrollments
 */
class DeleteManyEnrollmentsAction extends DeleteManyRecordsAction {
  _validate() {
    this._params.payload.table = "Enrollment";
    super._validate();

    const { ids } = this._params.payload;
    ids.forEach(id => {
      // RESTRICT: Check if StudentFeeAccount has payment history
      const feeAccount = this._db.StudentFeeAccount.all().find(acc => acc.enrollment_id === id);
      if (feeAccount && feeAccount.amount_paid > 0) {
        throw new ActionValidationError(`Enrollment '${id}' cannot be deleted because payments exist on its fee account.`);
      }
    });
  }

  _execute() {
    const { ids } = this._params.payload;
    const dryRun = this._params.payload.dryRun !== false;

    if (!dryRun) {
      ids.forEach(enrollmentId => {
        // CASCADE delete BatchAllocation records
        const allocations = this._db.BatchAllocation.all().filter(a => a.enrollment_id === enrollmentId);
        allocations.forEach(a => {
          this._db.BatchAllocation.remove(a.allocation_id);
        });

        // CASCADE delete StudentFeeAccount and its Installments/Adjustments
        const feeAccount = this._db.StudentFeeAccount.all().find(acc => acc.enrollment_id === enrollmentId);
        if (feeAccount) {
          const installments = this._db.Installment.all().filter(ins => ins.student_fee_id === feeAccount.student_fee_id);
          installments.forEach(ins => {
            this._db.Installment.remove(ins.installment_id);
          });

          const adjustments = this._db.FeeAdjustment.all().filter(adj => adj.student_fee_id === feeAccount.student_fee_id);
          adjustments.forEach(adj => {
            this._db.FeeAdjustment.remove(adj.adjustment_id);
          });

          this._db.StudentFeeAccount.remove(feeAccount.student_fee_id);
        }
      });
    }

    return super._execute();
  }
}


/**
 * Students Domain: Delete many students
 */
class DeleteManyStudentsAction extends DeleteManyRecordsAction {
  _validate() {
    this._params.payload.table = "Student";
    super._validate();
  }

  _execute() {
    const { ids } = this._params.payload;
    const dryRun = this._params.payload.dryRun !== false;

    let deletedCount = 0;
    const failed = {};
    const safeToQuery = [];

    if (!dryRun) {
      try {
        deletedCount = this._db.Student.deleteMany(ids);
      } catch (e) {
        if (e instanceof SheetDB.IntegrityError || e.name === "IntegrityError") {
          throw new ActionValidationError(e.message);
        }
        throw e;
      }
    } else {
      ids.forEach(id => {
        try {
          this._db.Student.enforceDeleteConstraints(id);
          safeToQuery.push(id);
        } catch (e) {
          if (e instanceof SheetDB.IntegrityError || e.name === "IntegrityError") {
            failed[id] = e.message;
          } else {
            throw e;
          }
        }
      });
    }

    return {
      success: true,
      dryRun: dryRun,
      deletedCount: dryRun ? 0 : ids.length,
      manifest: {
        deleted: dryRun ? safeToQuery : ids,
        skipped: [],
        failed: failed
      }
    };
  }
}


/**
 * Finance Domain: Delete many student fee accounts
 */
class DeleteManyStudentFeeAccountsAction extends DeleteManyRecordsAction {
  _validate() {
    this._params.payload.table = "StudentFeeAccount";
    super._validate();

    const { ids } = this._params.payload;
    ids.forEach(id => {
      // RESTRICT: Block if payments are recorded
      const acc = this._db.StudentFeeAccount.findById(id);
      if (acc && acc.amount_paid > 0) {
        throw new ActionValidationError(`Fee account '${id}' cannot be deleted because payments are recorded.`);
      }
    });
  }

  _execute() {
    const { ids } = this._params.payload;
    const dryRun = this._params.payload.dryRun !== false;

    if (!dryRun) {
      ids.forEach(feeId => {
        // CASCADE delete Installments and Adjustments
        const installments = this._db.Installment.all().filter(ins => ins.student_fee_id === feeId);
        installments.forEach(ins => this._db.Installment.remove(ins.installment_id));

        const adjustments = this._db.FeeAdjustment.all().filter(adj => adj.student_fee_id === feeId);
        adjustments.forEach(adj => this._db.FeeAdjustment.remove(adj.adjustment_id));
      });
    }

    return super._execute();
  }
}

/**
 * Finance Domain: Delete many installments
 */
class DeleteManyInstallmentsAction extends DeleteManyRecordsAction {
  _validate() {
    this._params.payload.table = "Installment";
    super._validate();

    const { ids } = this._params.payload;
    ids.forEach(id => {
      // RESTRICT: Block if paid or partially paid
      const ins = this._db.Installment.findById(id);
      if (ins && ins.paid_amount > 0) {
        throw new ActionValidationError(`Installment '${id}' cannot be deleted because it is paid or partially paid.`);
      }
    });
  }

  _execute() {
    const { ids } = this._params.payload;
    const dryRun = this._params.payload.dryRun !== false;

    if (!dryRun) {
      ids.forEach(installmentId => {
        const ins = this._db.Installment.findById(installmentId);
        if (ins) {
          // Parent balance recalculation
          const acc = this._db.StudentFeeAccount.findById(ins.student_fee_id);
          if (acc) {
            const newTotal = Math.max(0, (acc.total_fee || 0) - (ins.due_amount || 0));
            const newFinal = Math.max(0, (acc.final_fee || 0) - (ins.due_amount || 0));
            const newBalance = Math.max(0, (acc.balance_due || 0) - (ins.due_amount || 0));
            this._db.StudentFeeAccount.update(acc.student_fee_id, {
              total_fee: newTotal,
              final_fee: newFinal,
              balance_due: newBalance
            });
          }
        }
      });
    }

    return super._execute();
  }
}

/**
 * Finance Domain: Delete many payments
 */
class DeleteManyPaymentsAction extends DeleteManyRecordsAction {
  _validate() {
    this._params.payload.table = "Payment";
    super._validate();
  }

  _execute() {
    const { ids } = this._params.payload;
    const dryRun = this._params.payload.dryRun !== false;

    if (!dryRun) {
      ids.forEach(paymentId => {
        const pay = this._db.Payment.findById(paymentId);
        if (pay) {
          // Revert installment paid amount
          const ins = this._db.Installment.findById(pay.installment_id);
          if (ins) {
            const newPaid = Math.max(0, (ins.paid_amount || 0) - (pay.amount_paid || 0));
            let status = "pending";
            if (newPaid > 0 && newPaid < ins.due_amount) status = "partially_paid";
            else if (newPaid >= ins.due_amount) status = "paid";
            this._db.Installment.update(ins.installment_id, {
              paid_amount: newPaid,
              status: status
            });
          }

          // Revert fee account balances
          const acc = this._db.StudentFeeAccount.findById(pay.student_fee_id);
          if (acc) {
            const newPaidAcc = Math.max(0, (acc.amount_paid || 0) - (pay.amount_paid || 0));
            const newBalance = Math.max(0, (acc.balance_due || 0) + (pay.amount_paid || 0));
            this._db.StudentFeeAccount.update(acc.student_fee_id, {
              amount_paid: newPaidAcc,
              balance_due: newBalance
            });
          }
        }
      });
    }

    return super._execute();
  }
}

/**
 * Finance Domain: Delete many fee adjustments
 */
class DeleteManyFeeAdjustmentsAction extends DeleteManyRecordsAction {
  _validate() {
    this._params.payload.table = "FeeAdjustment";
    super._validate();
  }

  _execute() {
    const { ids } = this._params.payload;
    const dryRun = this._params.payload.dryRun !== false;

    if (!dryRun) {
      ids.forEach(adjId => {
        const adj = this._db.FeeAdjustment.findById(adjId);
        if (adj) {
          // Revert adjustment in fee account
          const acc = this._db.StudentFeeAccount.findById(adj.student_fee_id);
          if (acc) {
            const newFinal = Math.max(0, (acc.final_fee || 0) + (adj.amount || 0));
            const newBalance = Math.max(0, (acc.balance_due || 0) + (adj.amount || 0));
            this._db.StudentFeeAccount.update(acc.student_fee_id, {
              final_fee: newFinal,
              balance_due: newBalance
            });
          }
        }
      });
    }

    return super._execute();
  }
}

/**
 * Staff Domain: Delete many teachers
 */
class DeleteManyTeachersAction extends DeleteManyRecordsAction {
  _validate() {
    this._params.payload.table = "Teacher";
    super._validate();

    const { ids } = this._params.payload;
    ids.forEach(id => {
      // RESTRICT: Block if teacher is assigned to active Batch
      const activeBatchExists = this._db.Batch.all().some(b => b.teacher_id === id && b.status === "active");
      if (activeBatchExists) {
        throw new ActionValidationError(`Teacher '${id}' cannot be deleted because active class batches are assigned.`);
      }

      // RESTRICT: Block if has payment transactions
      const paymentExists = this._db.TeacherPaymentTransaction.all().some(t => t.teacher_id === id);
      if (paymentExists) {
        throw new ActionValidationError(`Teacher '${id}' cannot be deleted because payment history exists.`);
      }
    });
  }

  _execute() {
    const { ids } = this._params.payload;
    const dryRun = this._params.payload.dryRun !== false;

    if (!dryRun) {
      ids.forEach(teacherId => {
        // CASCADE delete TeacherSubject, TeacherDocument, and TeacherSalaryConfig
        const subjects = this._db.TeacherSubject.all().filter(s => s.teacher_id === teacherId);
        subjects.forEach(s => this._db.TeacherSubject.remove(s.teacher_subject_id));

        const docs = this._db.TeacherDocument.all().filter(d => d.teacher_id === teacherId);
        docs.forEach(d => this._db.TeacherDocument.remove(d.document_id));

        const configs = this._db.TeacherSalaryConfig.all().filter(c => c.teacher_id === teacherId);
        configs.forEach(c => this._db.TeacherSalaryConfig.remove(c.salary_config_id));
      });
    }

    return super._execute();
  }
}
