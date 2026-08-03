/**
 * Declarative validation rules map for Academic Enrollment updates.
 * Path: DazzlingDB/Validate/EnrollmentUpdateValidationPipeline.js
 */
const EnrollmentUpdateRulesMap = {
  enrollment_existence: {
    name: "enrollment_existence",
    critical: true,
    validator: function (ctx) {
      const enrollmentId = ctx.payload.enrollment_id;
      if (!enrollmentId || typeof enrollmentId !== "string" || !enrollmentId.trim()) {
        ctx.state.missingField = "enrollment_id";
        return false;
      }
      ctx.state.existingEnrollment = ctx.db.Enrollment.findById(enrollmentId);
      return !!ctx.state.existingEnrollment;
    },
    onError: function (ctx) {
      if (ctx.state.missingField) {
        ctx.addError("enrollment_id", "enrollment_id is required and must be a non-empty string.");
      } else {
        ctx.addError("enrollment_id", `Enrollment record not found for enrollment_id: ${ctx.payload.enrollment_id}`);
      }
    }
  },

  enrollment_status_choices: {
    name: "enrollment_status_choices",
    validator: function (ctx) {
      if (ctx.payload.status !== undefined) {
        const allowed = ["active", "completed", "withdrawn"];
        if (!allowed.includes(ctx.payload.status)) {
          ctx.state.statusError = `Invalid enrollment status [${ctx.payload.status}]. Allowed: ${allowed.join(", ")}`;
          return false;
        }
      }
      return true;
    },
    onError: function (ctx) {
      ctx.addError("status", ctx.state.statusError);
    }
  },

  academic_status_choices: {
    name: "academic_status_choices",
    validator: function (ctx) {
      if (ctx.payload.academic_status !== undefined) {
        const allowed = ["active", "suspended", "completed", "withdrawn"];
        if (!allowed.includes(ctx.payload.academic_status)) {
          ctx.state.academicStatusError = `Invalid academic_status [${ctx.payload.academic_status}]. Allowed: ${allowed.join(", ")}`;
          return false;
        }
      }
      return true;
    },
    onError: function (ctx) {
      ctx.addError("academic_status", ctx.state.academicStatusError);
    }
  },

  allocations_integrity: {
    name: "allocations_integrity",
    validator: function (ctx) {
      const allocations = ctx.payload.allocations;
      if (!Array.isArray(allocations) || allocations.length === 0) return true;

      const existingAllocations = ctx.db.BatchAllocation.where({ enrollment_id: ctx.payload.enrollment_id });
      ctx.state.existingAllocations = existingAllocations;

      for (let i = 0; i < allocations.length; i++) {
        const allocInput = allocations[i];
        if (!allocInput || !allocInput.allocation_id) {
          ctx.state.allocError = `Allocation item at index ${i} is missing required allocation_id.`;
          return false;
        }

        const matchingAlloc = existingAllocations.find(function (a) { return a.allocation_id === allocInput.allocation_id; });
        if (!matchingAlloc) {
          ctx.state.allocError = `BatchAllocation [${allocInput.allocation_id}] does not belong to Enrollment [${ctx.payload.enrollment_id}].`;
          return false;
        }

        if (allocInput.batch_id) {
          const targetBatch = ctx.db.Batch.findById(allocInput.batch_id);
          if (!targetBatch) {
            ctx.state.allocError = `Target Batch [${allocInput.batch_id}] not found.`;
            return false;
          }
          if (targetBatch.course_id !== matchingAlloc.course_id) {
            ctx.state.allocError = `Target Batch [${allocInput.batch_id}] course_id [${targetBatch.course_id}] does not match Allocation course_id [${matchingAlloc.course_id}].`;
            return false;
          }
        }
      }
      return true;
    },
    onError: function (ctx) {
      ctx.addError("allocations", ctx.state.allocError || "Batch allocation validation failed.");
    }
  }
};

const EnrollmentUpdateRules = [
  EnrollmentUpdateRulesMap.enrollment_existence,
  EnrollmentUpdateRulesMap.enrollment_status_choices,
  EnrollmentUpdateRulesMap.academic_status_choices,
  EnrollmentUpdateRulesMap.allocations_integrity
];

// Global exports for Google Apps Script execution context
globalThis.EnrollmentUpdateRulesMap = EnrollmentUpdateRulesMap;
globalThis.EnrollmentUpdateRules = EnrollmentUpdateRules;
