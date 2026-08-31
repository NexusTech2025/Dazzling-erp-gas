/**
 * @file CourseNoteValidationPipeline.js
 * Declarative Validation Pipeline for Course Note uploads and modifications.
 * Path: DazzlingDB/Validate/CourseNoteValidationPipeline.js
 */

const CourseNoteValidationRules = [
  {
    name: "course_note_required_fields",
    validator: (ctx) => {
      const p = ctx.payload;
      if (!p) {
        ctx.state.missingField = "payload";
        ctx.state.errorMessage = "Request payload is required.";
        return false;
      }
      if (!p.course_id || typeof p.course_id !== "string" || p.course_id.trim() === "") {
        ctx.state.missingField = "course_id";
        ctx.state.errorMessage = "Field 'course_id' is required and must be a non-empty string.";
        return false;
      }
      if (!p.title || typeof p.title !== "string" || p.title.trim() === "") {
        ctx.state.missingField = "title";
        ctx.state.errorMessage = "Field 'title' is required and must be a non-empty string.";
        return false;
      }
      if (!p.file || typeof p.file !== "object") {
        ctx.state.missingField = "file";
        ctx.state.errorMessage = "Field 'file' object is required.";
        return false;
      }
      return true;
    },
    onError: (ctx) => {
      ctx.addError(ctx.state.missingField || "payload", ctx.state.errorMessage || "Required fields missing.");
    }
  },
  {
    name: "course_note_file_contract",
    validator: (ctx) => {
      const file = ctx.payload.file;
      if (!file) return true;

      if (!file.file_name || typeof file.file_name !== "string" || file.file_name.trim() === "") {
        ctx.state.fileErrorField = "file.file_name";
        ctx.state.fileErrorMessage = "Field 'file.file_name' is required and must be a non-empty string.";
        return false;
      }
      if (!file.mime_type || typeof file.mime_type !== "string" || file.mime_type.trim() === "") {
        ctx.state.fileErrorField = "file.mime_type";
        ctx.state.fileErrorMessage = "Field 'file.mime_type' is required and must be a valid MIME type string.";
        return false;
      }
      if (!file.content_base64 || typeof file.content_base64 !== "string" || file.content_base64.trim() === "") {
        ctx.state.fileErrorField = "file.content_base64";
        ctx.state.fileErrorMessage = "Field 'file.content_base64' is required and must contain Base64 encoded data.";
        return false;
      }
      return true;
    },
    onError: (ctx) => {
      ctx.addError(ctx.state.fileErrorField || "file", ctx.state.fileErrorMessage || "File payload contract invalid.");
    }
  },
  {
    name: "course_note_mime_whitelist",
    validator: (ctx) => {
      const file = ctx.payload.file;
      if (!file || !file.mime_type) return true;

      const allowedMimes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/plain",
        "text/markdown",
        "text/csv",
        "image/png",
        "image/jpeg",
        "image/webp"
      ];

      const normalizedMime = file.mime_type.toLowerCase().trim();
      if (!allowedMimes.includes(normalizedMime)) {
        ctx.state.mimeError = `MIME type '${file.mime_type}' is not permitted. Allowed formats: PDF, Word, Excel, PPT, TXT, CSV, JPEG, PNG, WEBP.`;
        return false;
      }
      return true;
    },
    onError: (ctx) => {
      ctx.addError("file.mime_type", ctx.state.mimeError || "MIME type is not allowed.");
    }
  },
  {
    name: "course_note_file_size_limit",
    validator: (ctx) => {
      const file = ctx.payload.file;
      if (!file || !file.content_base64) return true;

      // Max binary size: 15 MB -> Base64 string length max approx 21,000,000 chars
      const MAX_BASE64_CHARS = 21 * 1024 * 1024;
      if (file.content_base64.length > MAX_BASE64_CHARS) {
        ctx.state.sizeError = `File exceeds the maximum allowable upload size of 15 MB (Base64 payload length: ${file.content_base64.length}).`;
        return false;
      }
      return true;
    },
    onError: (ctx) => {
      ctx.addError("file.content_base64", ctx.state.sizeError || "File size limit exceeded.");
    }
  },
  {
    name: "course_note_course_existence",
    validator: (ctx) => {
      const courseId = ctx.payload.course_id;
      if (!courseId) return true;

      const course = ctx.db.Course.findById(courseId);
      if (!course) {
        ctx.state.courseError = `Target Course '${courseId}' was not found in the database.`;
        return false;
      }
      ctx.state.courseEntity = course;
      return true;
    },
    onError: (ctx) => {
      ctx.addError("course_id", ctx.state.courseError || "Course does not exist.");
    }
  },
  {
    name: "course_note_batch_alignment",
    validator: (ctx) => {
      const batchId = ctx.payload.batch_id;
      if (!batchId) return true; // Batch is optional (Course-wide note)

      const batch = ctx.db.Batch.findById(batchId);
      if (!batch) {
        ctx.state.batchError = `Specified Batch '${batchId}' does not exist.`;
        return false;
      }

      if (batch.course_id !== ctx.payload.course_id) {
        ctx.state.batchError = `Relational Inconsistency: Batch '${batchId}' belongs to Course '${batch.course_id}', not '${ctx.payload.course_id}'.`;
        return false;
      }

      ctx.state.batchEntity = batch;
      return true;
    },
    onError: (ctx) => {
      ctx.addError("batch_id", ctx.state.batchError || "Batch is invalid or mismatched.");
    }
  },
  {
    name: "course_note_teacher_existence",
    validator: (ctx) => {
      const teacherId = ctx.payload.teacher_id;
      if (!teacherId) return true; // Teacher author is optional

      const teacher = ctx.db.Teacher.findById(teacherId);
      if (!teacher) {
        ctx.state.teacherError = `Specified Teacher author '${teacherId}' was not found.`;
        return false;
      }
      return true;
    },
    onError: (ctx) => {
      ctx.addError("teacher_id", ctx.state.teacherError || "Teacher does not exist.");
    }
  },
  {
    name: "course_note_type_choices",
    validator: (ctx) => {
      const noteType = ctx.payload.note_type;
      if (!noteType) return true; // Optional, schema has default

      const allowedChoices = [
        "chapter_notes",
        "short_notes",
        "cheat_sheet",
        "lecture_slides",
        "assignment",
        "question_bank",
        "syllabus",
        "reference",
        "daily_practice_paper"
      ];

      if (!allowedChoices.includes(noteType)) {
        ctx.state.noteTypeError = `Invalid 'note_type' value '${noteType}'. Allowed choices: ${allowedChoices.join(", ")}.`;
        return false;
      }
      return true;
    },
    onError: (ctx) => {
      ctx.addError("note_type", ctx.state.noteTypeError || "Invalid note_type.");
    }
  },
  {
    name: "course_note_file_type_choices",
    validator: (ctx) => {
      const fileType = ctx.payload.file_type;
      if (!fileType) return true; // Optional, can be auto-derived

      const allowedChoices = [
        "pdf",
        "image",
        "presentation",
        "document",
        "spreadsheet",
        "text",
        "archive",
        "other"
      ];

      if (!allowedChoices.includes(fileType)) {
        ctx.state.fileTypeError = `Invalid 'file_type' value '${fileType}'. Allowed choices: ${allowedChoices.join(", ")}.`;
        return false;
      }
      return true;
    },
    onError: (ctx) => {
      ctx.addError("file_type", ctx.state.fileTypeError || "Invalid file_type.");
    }
  }
];

// Export to Global Namespace
globalThis.CourseNoteValidationRules = CourseNoteValidationRules;
