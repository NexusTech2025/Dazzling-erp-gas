/**
 * @file StudentHardDeleteValidationPipeline.js
 * Path: DazzlingDB/Validate/StudentHardDeleteValidationPipeline.js
 *
 * Declarative validation rules map for permanently hard-deleting student profiles.
 * Validates payload parameters, student existence, traverses foreign key dependency graphs,
 * and enforces zero-payment safety guards unless administrative force override is active.
 */

const StudentHardDeleteRulesMap = {
  /**
   * Critical Guard: Verifies student_id presence and student entity existence.
   */
  student_existence: {
    name: "student_existence",
    critical: true,
    validator: function (ctx) {
      const studentId = ctx.payload ? ctx.payload.student_id : null;
      if (!studentId || typeof studentId !== "string" || !studentId.trim()) {
        ctx.state.missingField = "student_id";
        return false;
      }
      ctx.state.student = ctx.db.Student.findById(studentId);
      return !ctx.state.student ? false : true;
    },
    onError: function (ctx) {
      if (ctx.state.missingField) {
        ctx.addError("student_id", "student_id is required and must be a non-empty string.");
      } else {
        ctx.addError("student_id", `Student record not found for student_id: ${ctx.payload ? ctx.payload.student_id : null}`);
      }
    }
  },

  /**
   * Critical Guard: Traverses relational dependency tree across 10 tables,
   * stashes child primary keys into ctx.state, and asserts zero collected payments
   * unless payload.force === true.
   */
  hard_delete_financial_guard: {
    name: "hard_delete_financial_guard",
    critical: true,
    validator: function (ctx) {
      const studentId = ctx.payload.student_id;
      const isForce = ctx.payload.force === true;
      const db = ctx.db;

      // 1. Discover Enrollment contracts
      const enrollments = db.Enrollment ? db.Enrollment.where({ student_id: studentId }) : [];
      const enrollmentIds = enrollments.map(e => e.enrollment_id);

      // 2. Discover StudentFeeAccounts
      const feeAccounts = (enrollmentIds.length > 0 && db.StudentFeeAccount)
        ? db.StudentFeeAccount.all().filter(sfa => enrollmentIds.includes(sfa.enrollment_id))
        : [];
      const feeAccountIds = feeAccounts.map(sfa => sfa.student_fee_id);

      // 3. Discover Payments & calculate total collected funds
      const payments = (feeAccountIds.length > 0 && db.Payment)
        ? db.Payment.all().filter(p => feeAccountIds.includes(p.student_fee_id))
        : [];
      const totalAmountPaid = feeAccounts.reduce((acc, sfa) => acc + Number(sfa.amount_paid || 0), 0);

      // If money collected and force is NOT enabled, block hard deletion
      if (!isForce && (payments.length > 0 || totalAmountPaid > 0)) {
        ctx.state.financialError = `Financial Integrity Breach: Cannot permanently hard-delete student [${studentId}]. Account has ${payments.length} payment receipts totaling ₹${totalAmountPaid}. Use soft-delete (mode: 'soft') or provide superadmin override (force: true).`;
        return false;
      }

      // 4. Discover all remaining downstream relational children
      const installments = (feeAccountIds.length > 0 && db.Installment)
        ? db.Installment.all().filter(ins => feeAccountIds.includes(ins.student_fee_id))
        : [];
      const allocations = db.BatchAllocation ? db.BatchAllocation.where({ student_id: studentId }) : [];
      const attendance = db.StudentAttendance ? db.StudentAttendance.where({ student_id: studentId }) : [];
      const testMarks = db.TestMarks ? db.TestMarks.where({ student_id: studentId }) : [];
      const educations = db.Education ? db.Education.where({ student_id: studentId }) : [];
      const contacts = db.ContactInfo ? db.ContactInfo.where({ student_id: studentId }) : [];
      const addresses = db.Address ? db.Address.where({ student_id: studentId }) : [];

      // Stash pre-discovered primary keys into validation context state
      ctx.state.paymentIds = payments.map(p => p.payment_id);
      ctx.state.installmentIds = installments.map(ins => ins.installment_id);
      ctx.state.feeAccountIds = feeAccountIds;
      ctx.state.attendanceIds = attendance.map(a => a.attendance_id);
      ctx.state.testMarkIds = testMarks.map(m => m.mark_id || m.test_mark_id);
      ctx.state.allocationIds = allocations.map(bal => bal.allocation_id);
      ctx.state.enrollmentIds = enrollmentIds;
      ctx.state.educationIds = educations.map(edu => edu.education_id);
      ctx.state.contactIds = contacts.map(c => c.contact_id);
      ctx.state.addressIds = addresses.map(a => a.address_id);

      return true;
    },
    onError: function (ctx) {
      ctx.addError("financials", ctx.state.financialError || "Hard delete financial validation guard failed.");
    }
  },

  /**
   * Critical Guard: If force === true, enforces that the executing user has 'superadmin' privileges.
   */
  superadmin_force_guard: {
    name: "superadmin_force_guard",
    critical: true,
    validator: function (ctx) {
      if (ctx.payload && ctx.payload.force === true) {
        const user = ctx.user || (ctx.db && ctx.db._user);
        if (!user || user.role !== "superadmin") {
          ctx.state.authError = "Unauthorized: Force hard-deletion requires 'superadmin' role privileges.";
          return false;
        }
      }
      return true;
    },
    onError: function (ctx) {
      ctx.addError("authorization", ctx.state.authError || "Superadmin force authorization guard failed.");
    }
  }
};

const StudentHardDeleteRules = [
  StudentHardDeleteRulesMap.student_existence,
  StudentHardDeleteRulesMap.hard_delete_financial_guard,
  StudentHardDeleteRulesMap.superadmin_force_guard
];

// Global scope registration for Google Apps Script execution realm
globalThis.StudentHardDeleteRulesMap = StudentHardDeleteRulesMap;
globalThis.StudentHardDeleteRules = StudentHardDeleteRules;
