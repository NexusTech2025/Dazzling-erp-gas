/**
 * Specific validation rules for update requests against the Teacher domain model.
 */
const TeacherUpdateRules = [
  {
    name: "teacher_existence",
    critical: true,
    validator: (ctx) => {
      ctx.state.existingRecord = ctx.db.Teacher.findById(ctx.entityId);
      return !!ctx.state.existingRecord;
    },
    onError: (ctx) => {
      ctx.addError("teacher_id", `Teacher with ID ${ctx.entityId} was not found.`);
    }
  },
  {
    name: "sanitize_immutable_fields",
    validator: (ctx) => {
      const immutables = ["teacher_id", "__tx_id", "__tx_status", "__created_at"];
      immutables.forEach(field => delete ctx.payload[field]);
      return true;
    }
  },
  {
    name: "unique_mobile",
    validator: (ctx) => {
      const { mobile_number } = ctx.payload;
      if (!mobile_number) return true;
      const duplicate = ctx.db.Teacher.findOne({ mobile_number });
      return !duplicate || duplicate.teacher_id === ctx.entityId;
    },
    onError: (ctx) => {
      ctx.addError("mobile_number", `Mobile number ${ctx.payload.mobile_number} is already in use by another teacher.`);
    }
  },
  {
    name: "unique_email",
    validator: (ctx) => {
      const { email } = ctx.payload;
      if (!email) return true;
      const duplicate = ctx.db.Teacher.findOne({ email });
      return !duplicate || duplicate.teacher_id === ctx.entityId;
    },
    onError: (ctx) => {
      ctx.addError("email", `Email address ${ctx.payload.email} is already in use by another teacher.`);
    }
  },
  {
    name: "branch_fk_check",
    validator: (ctx) => {
      const { branch_id } = ctx.payload;
      if (!branch_id) return true;
      const branch = ctx.db.Branch.findById(branch_id);
      return !!branch;
    },
    onError: (ctx) => {
      ctx.addError("branch_id", `Branch with ID ${ctx.payload.branch_id} does not exist.`);
    }
  }
];

// Global export for Google Apps Script context
globalThis.TeacherUpdateRules = TeacherUpdateRules;
