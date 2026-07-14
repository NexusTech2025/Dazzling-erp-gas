/**
 * Specific validation rules for registration/onboarding requests against the Teacher domain model.
 * Path: DazzlingDB/Validate/TeacherRegistrationValidationPipeline.js
 */
const TeacherRegistrationRules = [
  {
    name: "teacher_profile_required",
    validator: (ctx) => {
      const requiredFields = ["full_name", "mobile_number", "experience_years", "teacher_type", "joining_date"];
      for (const field of requiredFields) {
        if (ctx.payload[field] === undefined || ctx.payload[field] === null || ctx.payload[field] === "") {
          ctx.state.missingField = field;
          return false;
        }
      }
      return true;
    },
    onError: (ctx) => {
      ctx.addError(ctx.state.missingField, `Teacher profile field '${ctx.state.missingField}' is strictly required.`);
    }
  },
  {
    name: "user_data_required",
    validator: (ctx) => {
      const { userData } = ctx.payload;
      if (!userData) return true;
      const requiredFields = ["username", "password"];
      for (const field of requiredFields) {
        if (userData[field] === undefined || userData[field] === null || userData[field] === "") {
          ctx.state.missingUserField = field;
          return false;
        }
      }
      return true;
    },
    onError: (ctx) => {
      ctx.addError(`userData.${ctx.state.missingUserField}`, `User account field 'userData.${ctx.state.missingUserField}' is strictly required when userData is provided.`);
    }
  },
  {
    name: "salary_config_required",
    validator: (ctx) => {
      const { salary_config } = ctx.payload;
      if (!salary_config) return true;
      const requiredFields = ["salary_config_type", "effective_from", "rate_type", "base_value", "scope_type"];
      for (const field of requiredFields) {
        if (salary_config[field] === undefined || salary_config[field] === null || salary_config[field] === "") {
          ctx.state.missingSalaryField = field;
          return false;
        }
      }
      return true;
    },
    onError: (ctx) => {
      ctx.addError(`salary_config.${ctx.state.missingSalaryField}`, `Salary configuration field 'salary_config.${ctx.state.missingSalaryField}' is strictly required when salary_config is provided.`);
    }
  },
  {
    name: "teacher_subject_required",
    validator: (ctx) => {
      const { subjects } = ctx.payload;
      if (!subjects) return true;
      if (!Array.isArray(subjects)) {
        ctx.state.subjectFormatIssue = "Subjects must be an array of course/subject IDs.";
        return false;
      }
      for (let i = 0; i < subjects.length; i++) {
        if (subjects[i] === undefined || subjects[i] === null || subjects[i] === "") {
          ctx.state.subjectFormatIssue = `Subject at index ${i} is invalid.`;
          return false;
        }
      }
      return true;
    },
    onError: (ctx) => {
      ctx.addError("subjects", ctx.state.subjectFormatIssue || "Subjects structure is invalid.");
    }
  },
  {
    name: "teacher_document_required",
    validator: (ctx) => {
      const { documents } = ctx.payload;
      if (!documents) return true;
      if (!Array.isArray(documents)) {
        ctx.state.documentFormatIssue = "Documents must be an array.";
        return false;
      }
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        if (!doc || !doc.file_url) {
          ctx.state.documentFormatIssue = `Document at index ${i} is missing the required 'file_url' field.`;
          return false;
        }
      }
      return true;
    },
    onError: (ctx) => {
      ctx.addError("documents", ctx.state.documentFormatIssue || "Documents structure is invalid.");
    }
  },
  {
    name: "unique_mobile",
    validator: (ctx) => {
      const { mobile_number } = ctx.payload;
      if (!mobile_number) return true;
      const duplicate = ctx.db.Teacher.findOne({ mobile_number });
      return !duplicate;
    },
    onError: (ctx) => {
      ctx.addError("mobile_number", `A teacher with mobile number '${ctx.payload.mobile_number}' already exists.`);
    }
  },
  {
    name: "unique_email",
    validator: (ctx) => {
      const { email } = ctx.payload;
      if (!email) return true;
      const duplicate = ctx.db.Teacher.findOne({ email });
      return !duplicate;
    },
    onError: (ctx) => {
      ctx.addError("email", `A teacher with email '${ctx.payload.email}' already exists.`);
    }
  },
  {
    name: "unique_username",
    validator: (ctx) => {
      const { userData } = ctx.payload;
      if (!userData || !userData.username) return true;
      const duplicate = ctx.db.User.findOne({ username: userData.username });
      return !duplicate;
    },
    onError: (ctx) => {
      ctx.addError("userData.username", `Username '${ctx.payload.userData.username}' is already taken.`);
    }
  },
  {
    name: "subjects_exist",
    validator: (ctx) => {
      const { subjects } = ctx.payload;
      if (!subjects || !Array.isArray(subjects)) return true;
      for (const subId of subjects) {
        if (!ctx.db.Course.findById(subId)) {
          ctx.state.missingSubjectId = subId;
          return false;
        }
      }
      return true;
    },
    onError: (ctx) => {
      ctx.addError("subjects", `Course/Subject with ID '${ctx.state.missingSubjectId}' was not found in Academic.`);
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
      ctx.addError("branch_id", `Branch with ID '${ctx.payload.branch_id}' does not exist.`);
    }
  }
];

// Global export for Google Apps Script context
globalThis.TeacherRegistrationRules = TeacherRegistrationRules;
