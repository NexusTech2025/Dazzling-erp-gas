/**
 * @file StudentSoftDeleteValidationPipeline.js
 * Path: DazzlingDB/Validate/StudentSoftDeleteValidationPipeline.js
 *
 * Declarative validation rules map for soft-deleting student accounts.
 * Validates payload parameters, student existence, idempotent status checks,
 * and optional financial settlement configurations.
 */

const StudentSoftDeleteRulesMap = {
  /**
   * Critical Guard: Verifies student_id presence, entity existence, and prevents re-deleting deleted accounts.
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
      const student = ctx.db.Student.findById(studentId);
      if (!student) {
        ctx.state.notFound = true;
        return false;
      }
      if (student.status === "deleted") {
        ctx.state.alreadyDeleted = true;
        return false;
      }
      ctx.state.student = student;
      return true;
    },
    onError: function (ctx) {
      if (ctx.state.missingField) {
        ctx.addError("student_id", "student_id is required and must be a non-empty string.");
      } else if (ctx.state.alreadyDeleted) {
        ctx.addError("student_id", `Student account [${ctx.payload.student_id}] is already soft-deleted.`);
      } else {
        ctx.addError("student_id", `Student record not found for student_id: ${ctx.payload ? ctx.payload.student_id : null}`);
      }
    }
  },

  /**
   * Guard: Validates optional financial settlement parameters on soft delete.
   */
  financial_settlement_integrity: {
    name: "financial_settlement_integrity",
    validator: function (ctx) {
      const settlement = ctx.payload ? ctx.payload.financial_settlement : null;
      if (!settlement) return true;

      if (typeof settlement !== "object" || Array.isArray(settlement)) {
        ctx.state.settlementError = "financial_settlement must be a valid JSON object.";
        return false;
      }

      const allowedPolicies = ["waive_unpaid", "settle_liability", "refund", "prorated_refund", "retain_ledger"];
      if (settlement.policy && !allowedPolicies.includes(settlement.policy)) {
        ctx.state.settlementError = `Invalid financial_settlement.policy [${settlement.policy}]. Allowed: ${allowedPolicies.join(", ")}`;
        return false;
      }

      if (settlement.policy === "settle_liability") {
        const reqAmt = settlement.required_amount !== undefined ? settlement.required_amount : settlement.liability_amount;
        if (reqAmt === undefined || isNaN(Number(reqAmt)) || Number(reqAmt) < 0) {
          ctx.state.settlementError = "settle_liability policy requires a non-negative numeric 'required_amount'.";
          return false;
        }
      }

      return true;
    },
    onError: function (ctx) {
      ctx.addError("financial_settlement", ctx.state.settlementError || "Invalid financial settlement configuration.");
    }
  }
};

const StudentSoftDeleteRules = [
  StudentSoftDeleteRulesMap.student_existence,
  StudentSoftDeleteRulesMap.financial_settlement_integrity
];

// Global scope registration for Google Apps Script execution realm
globalThis.StudentSoftDeleteRulesMap = StudentSoftDeleteRulesMap;
globalThis.StudentSoftDeleteRules = StudentSoftDeleteRules;
