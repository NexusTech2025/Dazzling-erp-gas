/**
 * @file StudentDeleteUntouchedValidationPipeline.js
 * Path: DazzlingDB/Validate/StudentDeleteUntouchedValidationPipeline.js
 *
 * Declarative validation rules map for purging untouched student accounts.
 * Validates payload parameters, verifies student entity existence, traverses
 * foreign key child graphs, and enforces zero-payment financial safety guards.
 */

const StudentDeleteUntouchedRulesMap = {
  /**
   * Critical Guard: Verifies student_id input parameter presence and student existence in database.
   * Stashes existing Student record in ctx.state.student.
   */
  student_existence: {
    name: "student_existence",
    critical: true,
    validator: function(ctx) {
      const studentId = ctx.payload ? ctx.payload.student_id : null;
      if (!studentId || typeof studentId !== "string" || !studentId.trim()) {
        ctx.state.missingField = "student_id";
        return false;
      }
      ctx.state.student = ctx.db.Student.findById(studentId);
      return !!ctx.state.student;
    },
    onError: function(ctx) {
      if (ctx.state.missingField) {
        ctx.addError("student_id", "student_id is required and must be a non-empty string.");
      } else {
        ctx.addError("student_id", `Student record not found for student_id: ${ctx.payload ? ctx.payload.student_id : null}`);
      }
    }
  },

  /**
   * Critical Guard: Traverses relational graph and asserts zero payments or collected funds exist.
   * Discovers all child primary keys and stashes them in ctx.state for AtomicPipeline execution.
   */
  zero_payment_financial_guard: {
    name: "zero_payment_financial_guard",
    critical: true,
    validator: function(ctx) {
      const studentId = ctx.payload.student_id;
      const db = ctx.db;

      // 1. Discover Enrollment contracts
      const enrollments = db.Enrollment.where({ student_id: studentId });
      const enrollmentIds = enrollments.map(e => e.enrollment_id);

      // 2. Discover StudentFeeAccounts
      const feeAccounts = enrollmentIds.length > 0
        ? db.StudentFeeAccount.all().filter(sfa => enrollmentIds.includes(sfa.enrollment_id))
        : [];
      const feeAccountIds = feeAccounts.map(sfa => sfa.student_fee_id);

      // 3. Discover Payments & calculate total amount paid
      const payments = feeAccountIds.length > 0
        ? db.Payment.all().filter(p => feeAccountIds.includes(p.student_fee_id))
        : [];
      const totalAmountPaid = feeAccounts.reduce((acc, sfa) => acc + Number(sfa.amount_paid || 0), 0);

      if (payments.length > 0 || totalAmountPaid > 0) {
        ctx.state.financialError = `Financial Integrity Breach: Cannot delete student profile [${studentId}]. Account has ${payments.length} payment receipts totaling ₹${totalAmountPaid}. Use enrollment discard/refund instead.`;
        return false;
      }

      // 4. Stash all pre-discovered graph IDs into validation context state
      const installments = feeAccountIds.length > 0
        ? db.Installment.all().filter(ins => feeAccountIds.includes(ins.student_fee_id))
        : [];
      const allocations = db.BatchAllocation.where({ student_id: studentId });
      const educations = db.Education ? db.Education.where({ student_id: studentId }) : [];
      const contacts = db.ContactInfo ? db.ContactInfo.where({ student_id: studentId }) : [];
      const addresses = db.Address ? db.Address.where({ student_id: studentId }) : [];

      ctx.state.enrollmentIds = enrollmentIds;
      ctx.state.feeAccountIds = feeAccountIds;
      ctx.state.installmentIds = installments.map(ins => ins.installment_id);
      ctx.state.allocationIds = allocations.map(bal => bal.allocation_id);
      ctx.state.educationIds = educations.map(edu => edu.education_id);
      ctx.state.contactIds = contacts.map(c => c.contact_id);
      ctx.state.addressIds = addresses.map(a => a.address_id);

      return true;
    },
    onError: function(ctx) {
      ctx.addError("financials", ctx.state.financialError || "Financial zero-payment validation failed.");
    }
  }
};

const StudentDeleteUntouchedRules = [
  StudentDeleteUntouchedRulesMap.student_existence,
  StudentDeleteUntouchedRulesMap.zero_payment_financial_guard
];

// Global scope registration for Google Apps Script execution realm
globalThis.StudentDeleteUntouchedRulesMap = StudentDeleteUntouchedRulesMap;
globalThis.StudentDeleteUntouchedRules = StudentDeleteUntouchedRules;
