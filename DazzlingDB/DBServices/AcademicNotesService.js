/**
 * @file AcademicNotesService.js
 * Domain Service for Course Notes lifecycle management.
 * Coordinates pre-flight validation, Google Drive document storage,
 * and AtomicPipeline database mutations with LIFO compensation rollbacks.
 */

const AcademicNotesService = {
  
  /**
   * Internal helper to record mutated table names on the request execution context.
   * @param {Object} context - Request execution context.
   * @param {string} tableName - Target table name.
   * @private
   */
  _trackMutation(context, tableName) {
    if (context && context.mutationManifest && Array.isArray(context.mutationManifest)) {
      if (!context.mutationManifest.includes(tableName)) {
        context.mutationManifest.push(tableName);
      }
    }
  },

  /**
   * Ingests a new course note document, saves it to Google Drive, and persists
   * metadata into SheetDB via SheetDB.AtomicPipeline.
   * If database persistence fails, an automatic compensation transaction is triggered
   * to trash the uploaded Drive file, preventing orphaned storage assets.
   *
   * @param {Object} payload - Note upload parameters.
   * @param {string} payload.course_id - Target course ID.
   * @param {string} [payload.batch_id] - Optional target batch ID.
   * @param {string} [payload.teacher_id] - Optional authoring teacher ID.
   * @param {string} payload.title - Note title.
   * @param {string} [payload.description] - Contextual description.
   * @param {string} [payload.note_type="lecture_notes"] - Note taxonomy type.
   * @param {Object} payload.file - Binary document payload.
   * @param {string} payload.file.file_name - Filename with extension.
   * @param {string} payload.file.mime_type - MIME type.
   * @param {string} payload.file.content_base64 - Base64 encoded file data.
   * @param {Object} context - Request execution context.
   * @returns {Object} Persisted CourseNote record with _presentation envelope.
   * @throws {CourseNoteError|SheetDB.ValidationError}
   */
  uploadCourseNote(payload, context) {
    const db = DBContext.getInstance();
    console.log(`[AcademicNotesService.uploadCourseNote] Initiating upload for course '${payload?.course_id}' - title: '${payload?.title}'`);

    // 1. Pre-Flight Validation Engine (Rule D8)
    const vCtx = new ValidationContext(db, null, payload);
    const rules = globalThis.CourseNoteValidationRules || CourseNoteValidationRules;
    ValidationEngine.run(vCtx, rules);

    if (!vCtx.isValid()) {
      console.warn(`[AcademicNotesService.uploadCourseNote] Pre-flight validation failed:`, JSON.stringify(vCtx.errors));
      throw new SheetDB.ValidationError("Course note validation failed.", { fields: vCtx.errors });
    }

    const course = db.Course.findById(payload.course_id);
    let uploadedFile = null;

    try {
      // 2. Ingest Document to Google Drive (Partitioned by Course Name)
      uploadedFile = DriveStorageService.uploadDocument({
        courseName: course.name,
        fileName: payload.file.file_name,
        mimeType: payload.file.mime_type,
        base64Content: payload.file.content_base64,
        description: payload.description || `Notes for ${course.name}`
      });

      // 3. Persist Metadata Record via SheetDB.AtomicPipeline (Rule D7)
      const pipeCtx = new SheetDB.PipelineContext(context);
      const pipelineResult = SheetDB.AtomicPipeline.begin(db, pipeCtx)
        .addStep("CourseNote", (repo, state) => {
          console.log(`[AcademicNotesService.uploadCourseNote] [AtomicPipeline Step: CourseNote] Inserting record...`);
          const record = repo.insert({
            course_id: payload.course_id,
            batch_id: payload.batch_id || null,
            teacher_id: payload.teacher_id || null,
            title: payload.title.trim(),
            description: payload.description ? payload.description.trim() : null,
            note_type: payload.note_type || "chapter_notes",
            file_type: payload.file_type || uploadedFile.file_type || "other",
            file_id: uploadedFile.file_id,
            file_url: uploadedFile.file_url,
            download_url: uploadedFile.download_url || null,
            embed_url: uploadedFile.embed_url || null,
            file_name: uploadedFile.file_name,
            mime_type: uploadedFile.mime_type,
            file_size_bytes: uploadedFile.file_size_bytes,
            status: payload.status || "active",
            uploaded_at: new Date()
          });
          state.noteRecord = record;
        })
        .execute();

      this._trackMutation(context, "CourseNote");

      const recordInstance = (pipelineResult && pipelineResult.noteRecord)
        ? pipelineResult.noteRecord
        : (pipelineResult && pipelineResult.state ? pipelineResult.state.noteRecord : pipelineResult);

      const result = {};
      if (recordInstance) {
        if (typeof recordInstance.toJSON === "function") {
          Object.assign(result, recordInstance.toJSON());
        } else {
          for (const key of Object.keys(recordInstance)) {
            if (!key.startsWith("_")) {
              result[key] = recordInstance[key];
            }
          }
        }
      }

      result._presentation = {
        display_status: "Active",
        download_url: result.download_url || uploadedFile.download_url || null,
        embed_url: result.embed_url || uploadedFile.embed_url || null,
        toast_message: `Course note '${result.title}' uploaded successfully.`
      };

      console.log(`[AcademicNotesService.uploadCourseNote] Course note '${result.note_id}' committed successfully.`);
      return result;

    } catch (err) {
      // Compensation Rollback: Trash Drive file if DB pipeline or step execution failed
      if (uploadedFile && uploadedFile.file_id) {
        console.warn(`[AcademicNotesService.uploadCourseNote] Rolling back Drive file '${uploadedFile.file_id}' due to persistence failure: ${err.message}`);
        DriveStorageService.trashFile(uploadedFile.file_id);
      }
      throw err;
    }
  },

  /**
   * Deletes a CourseNote record via SheetDB.AtomicPipeline and moves its associated
   * Google Drive file to trash.
   *
   * @param {string} noteId - Primary key (CNT-XXXX) of the course note.
   * @param {Object} context - Request execution context.
   * @returns {Object} Deletion confirmation result with _presentation envelope.
   * @throws {CourseNoteError} If note record does not exist.
   */
  deleteCourseNote(noteId, context) {
    const db = DBContext.getInstance();
    console.log(`[AcademicNotesService.deleteCourseNote] Attempting to delete course note '${noteId}'`);

    const existing = db.CourseNote.findById(noteId);
    if (!existing) {
      throw new CourseNoteError(`Course note '${noteId}' not found.`, "NOTE_NOT_FOUND", { note_id: noteId });
    }

    // 1. Remove DB record via SheetDB.AtomicPipeline (Rule D7)
    const pipeCtx = new SheetDB.PipelineContext(context);
    SheetDB.AtomicPipeline.begin(db, pipeCtx)
      .addStep("CourseNote", (repo, state) => {
        console.log(`[AcademicNotesService.deleteCourseNote] [AtomicPipeline Step: CourseNote] Removing record '${noteId}'`);
        repo.remove(noteId);
      })
      .execute();

    this._trackMutation(context, "CourseNote");

    // 2. Trash Drive file
    if (existing.file_id) {
      DriveStorageService.trashFile(existing.file_id);
    }

    return {
      success: true,
      note_id: noteId,
      _presentation: {
        display_status: "Deleted",
        toast_message: `Course note '${existing.title}' deleted successfully.`
      }
    };
  }
};

// Bind to global namespace
globalThis.AcademicNotesService = AcademicNotesService;
