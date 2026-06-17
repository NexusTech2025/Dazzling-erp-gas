/**
 * @file StaffService.js
 * Domain Service for Human Resources and Payroll (Teachers/Staff).
 */

const StaffService = {

  /**
   * HR ONBOARDING
   */

  /**
   * Registers a new teacher profile.
   * Optionally creates an Auth User if userData is provided.
   */
  onboardTeacher(payload) {
    const db = DBContext.getInstance();
    console.log(`[StaffService] Initiating onboarding transaction for teacher: ${payload.full_name}`);

    // Track successfully inserted records for rollback
    const insertedRecords = [];

    // 1. PRE-FLIGHT VALIDATION (Rich Multi-Field Collection)
    const validationErrors = [];

    // a. Mobile uniqueness
    if (db.Teacher.exists({ mobile_number: payload.mobile_number })) {
      validationErrors.push({
        field: "mobile_number",
        value: payload.mobile_number,
        issue: "duplicate",
        message: `A teacher with mobile number '${payload.mobile_number}' already exists.`
      });
    }

    // b. Email uniqueness
    if (payload.email && db.Teacher.exists({ email: payload.email })) {
      validationErrors.push({
        field: "email",
        value: payload.email,
        issue: "duplicate",
        message: `A teacher with email '${payload.email}' already exists.`
      });
    }

    // c. User account validation
    if (payload.userData) {
      if (db.User.exists({ username: payload.userData.username })) {
        validationErrors.push({
          field: "userData.username",
          value: payload.userData.username,
          issue: "duplicate",
          message: `Username '${payload.userData.username}' is already taken.`
        });
      }
    }

    // d. Academic Subject validation
    if (payload.subjects && Array.isArray(payload.subjects)) {
      for (const subId of payload.subjects) {
        if (!db.Course.findById(subId)) {
          validationErrors.push({
            field: "subjects",
            value: subId,
            issue: "not_found",
            message: `Course/Subject with ID '${subId}' was not found in Academic.`
          });
        }
      }
    }

    // Throw consolidated validation errors if any failures exist
    if (validationErrors.length > 0) {
      throw new SheetDB.ValidationError("Pre-flight validation failed for teacher onboarding.", {
        fields: validationErrors
      });
    }

    try {
      // 2. CORE: INSERT TEACHER RECORD
      // Strip out relation fields to keep clean columns in the Teacher sheet
      const teacherInsertData = { ...payload };
      delete teacherInsertData.userData;
      delete teacherInsertData.salary_config;
      delete teacherInsertData.subjects;
      delete teacherInsertData.documents;

      const teacher = db.Teacher.insert({
        ...teacherInsertData,
        status: payload.status || "active",
        created_at: new Date()
      });

      // Log insertion for potential rollback
      insertedRecords.push({ table: "Teacher", id: teacher.teacher_id });

      // 3. RELATION: CREATE AUTH USER PROFILE
      if (payload.userData) {
        const registeredUser = AuthBridge.registerUser({
          ...payload.userData,
          user_id: teacher.teacher_id, // 1:1 Domain Key Sync
          role: "teacher"
        });
        insertedRecords.push({ table: "User", id: registeredUser.user_id });
      }

      // 4. RELATION: INITIAL COMPENSATION RATE
      if (payload.salary_config) {
        const salaryConfig = db.TeacherSalaryConfig.insert({
          ...payload.salary_config,
          teacher_id: teacher.teacher_id,
          effective_from: payload.salary_config.effective_from || new Date()
        });
        insertedRecords.push({ table: "TeacherSalaryConfig", id: salaryConfig.salary_config_id });
      }

      // 5. RELATION: ASSIGN TEACHING SUBJECTS
      if (payload.subjects && Array.isArray(payload.subjects)) {
        for (const subId of payload.subjects) {
          const teacherSubject = db.TeacherSubject.insert({
            teacher_id: teacher.teacher_id,
            subject_id: subId
          });
          insertedRecords.push({ table: "TeacherSubject", id: teacherSubject.teacher_subject_id });
        }
      }

      // 6. RELATION: UPLOAD VERIFIED ONBOARDING DOCUMENTS
      if (payload.documents && Array.isArray(payload.documents)) {
        for (const doc of payload.documents) {
          const teacherDoc = db.TeacherDocument.insert({
            ...doc,
            teacher_id: teacher.teacher_id,
            uploaded_at: new Date()
          });
          insertedRecords.push({ table: "TeacherDocument", id: teacherDoc.document_id });
        }
      }

      console.log(`[StaffService] Onboarding transaction complete for: ${teacher.teacher_id}`);
      return teacher;

    } catch (e) {
      console.error("[StaffService] Onboarding transaction failed! Starting rollback sequence...", e.message);

      // Perform transaction rollback in reverse order of insertions
      for (let i = insertedRecords.length - 1; i >= 0; i--) {
        const record = insertedRecords[i];
        try {
          console.log(`[Rollback] Deleting record from ${record.table} ID: ${record.id}`);
          db[record.table].remove(record.id);
        } catch (rollbackErr) {
          console.error(`[Rollback Error] Failed to delete from ${record.table} ID: ${record.id}:`, rollbackErr.message);
        }
      }

      // Re-throw the original business error for meaningful API dispatch notifications
      throw e;
    }
  },

  /**
   * Links a teacher to multiple subjects/courses.
   */
  assignSubjects(teacherId, subjectIds = []) {
    const db = DBContext.getInstance();
    console.log(`[StaffService] Assigning ${subjectIds.length} subjects to teacher ${teacherId}`);

    if (!db.Teacher.findById(teacherId)) {
      throw new SheetDB.EntityNotFoundError("Teacher", teacherId, "Staff");
    }

    const results = [];
    subjectIds.forEach(subId => {
      // Relational Check: Does course exist?
      if (!db.Course.findById(subId)) {
        console.warn(`[StaffService] Skipping invalid Course ID: ${subId}`);
        return;
      }

      results.push(db.TeacherSubject.insert({
        teacher_id: teacherId,
        subject_id: subId
      }));
    });

    return results;
  },

  /**
   * PAYROLL & ATTENDANCE
   */

  /**
   * Configures the payroll rules for a teacher.
   */
  setSalaryConfig(payload) {
    const db = DBContext.getInstance();
    console.log(`[StaffService] Setting salary config for teacher: ${payload.teacher_id}`);

    if (!db.Teacher.findById(payload.teacher_id)) {
      throw new SheetDB.EntityNotFoundError("Teacher", payload.teacher_id, "Staff");
    }

    return db.TeacherSalaryConfig.insert({
      ...payload,
      effective_from: payload.effective_from || new Date()
    });
  },

  /**
   * Marks daily attendance.
   */
  /**
   * Marks daily attendance for a teacher (Upsert pattern).
   */
  markAttendance(payload) {
    const db = DBContext.getInstance();
    
    // 1. Validation and Casing Normalization
    if (!payload.teacher_id) throw new Error("teacher_id is required.");
    if (!payload.batch_id) throw new Error("batch_id is required.");
    if (!payload.attendance_date) throw new Error("attendance_date is required.");
    if (!payload.status) throw new Error("status is required.");

    // Normalize inputs
    const teacherId = String(payload.teacher_id).trim();
    const batchId = String(payload.batch_id).trim();
    const dateStr = String(payload.attendance_date).trim();
    const status = String(payload.status).trim().toUpperCase();
    
    let mode = payload.attendance_mode || "Manual";
    const cleanMode = String(mode).trim().toUpperCase();
    if (cleanMode === "QR") mode = "QR";
    else if (cleanMode === "BIOMETRIC") mode = "Biometric";
    else mode = "Manual";

    // Verify existence of teacher and batch
    if (!db.Teacher.findById(teacherId)) {
      throw new SheetDB.EntityNotFoundError("Teacher", teacherId, "Staff");
    }
    if (!db.Batch.findById(batchId)) {
      throw new SheetDB.EntityNotFoundError("Batch", batchId, "Academic");
    }

    let entryDate = null;
    let exitDate = null;

    if (payload.entry_time) {
      entryDate = AttendanceUtil.convertJsonToDate(payload.entry_time, dateStr);
    }
    if (payload.exit_time) {
      exitDate = AttendanceUtil.convertJsonToDate(payload.exit_time, dateStr);
      if (entryDate && exitDate && exitDate < entryDate) {
        exitDate.setDate(exitDate.getDate() + 1);
      }
    }

    const attendanceData = {
      teacher_id: teacherId,
      batch_id: batchId,
      attendance_date: dateStr,
      status: status,
      entry_time: entryDate,
      exit_time: exitDate,
      attendance_mode: mode,
      remarks: payload.remarks || null,
      marked_by: payload.marked_by || null
    };

    // Check if attendance already exists for this teacher, batch, and date
    const existing = db.TeacherAttendance.findOne({
      teacher_id: teacherId,
      batch_id: batchId,
      attendance_date: dateStr
    });

    if (existing) {
      console.log(`[StaffService] Updating existing teacher attendance ID: ${existing.attendance_id} for Batch: ${batchId}`);
      return db.TeacherAttendance.update(existing.attendance_id, attendanceData);
    } else {
      console.log(`[StaffService] Inserting new teacher attendance for Teacher: ${teacherId} Batch: ${batchId}`);
      return db.TeacherAttendance.insert(attendanceData);
    }
  },

  /**
   * Marks bulk teacher attendance for a specific date (Upsert pattern).
   */
  markAttendanceBulk(payload) {
    const db = DBContext.getInstance();

    if (!payload.attendance_date) throw new Error("attendance_date is required.");
    if (!payload.records || !Array.isArray(payload.records)) throw new Error("records array is required.");

    const dateStr = String(payload.attendance_date).trim();
    
    let defaultMode = payload.attendance_mode || "Manual";
    const cleanDefaultMode = String(defaultMode).trim().toUpperCase();
    if (cleanDefaultMode === "QR") defaultMode = "QR";
    else if (cleanDefaultMode === "BIOMETRIC") defaultMode = "Biometric";
    else defaultMode = "Manual";

    console.log(`[StaffService] Processing bulk attendance for teachers on ${dateStr}`);

    // Pre-load all existing attendance records for this date to minimize read queries
    const existingRecords = db.TeacherAttendance.where({
      attendance_date: dateStr
    });
    
    // Map existing records by teacher_id + batch_id for O(1) lookups
    const existingMap = {};
    existingRecords.forEach(rec => {
      existingMap[`${rec.teacher_id}_${rec.batch_id}`] = rec;
    });

    const results = [];
    payload.records.forEach(rec => {
      if (!rec.teacher_id) throw new Error("Each record in bulk array must contain teacher_id.");
      if (!rec.batch_id) throw new Error("Each record in bulk array must contain batch_id.");
      if (!rec.status) throw new Error("Each record in bulk array must contain status.");

      const teacherId = String(rec.teacher_id).trim();
      const batchId = String(rec.batch_id).trim();
      const status = String(rec.status).trim().toUpperCase();
      let mode = rec.attendance_mode || defaultMode;
      const cleanMode = String(mode).trim().toUpperCase();
      if (cleanMode === "QR") mode = "QR";
      else if (cleanMode === "BIOMETRIC") mode = "Biometric";
      else mode = "Manual";

      // Check teacher and batch existence
      if (!db.Teacher.findById(teacherId)) {
        throw new SheetDB.EntityNotFoundError("Teacher", teacherId, "Staff");
      }
      if (!db.Batch.findById(batchId)) {
        throw new SheetDB.EntityNotFoundError("Batch", batchId, "Academic");
      }

      let entryDate = null;
      let exitDate = null;

      if (rec.entry_time) {
        entryDate = AttendanceUtil.convertJsonToDate(rec.entry_time, dateStr);
      }
      if (rec.exit_time) {
        exitDate = AttendanceUtil.convertJsonToDate(rec.exit_time, dateStr);
        if (entryDate && exitDate && exitDate < entryDate) {
          exitDate.setDate(exitDate.getDate() + 1);
        }
      }

      const attendanceData = {
        teacher_id: teacherId,
        batch_id: batchId,
        attendance_date: dateStr,
        status: status,
        entry_time: entryDate,
        exit_time: exitDate,
        attendance_mode: mode,
        remarks: rec.remarks || null,
        marked_by: payload.marked_by || rec.marked_by || null
      };

      const existing = existingMap[`${teacherId}_${batchId}`];
      if (existing) {
        results.push(db.TeacherAttendance.update(existing.attendance_id, attendanceData));
      } else {
        results.push(db.TeacherAttendance.insert(attendanceData));
      }
    });

    return {
      success: true,
      processedCount: results.length,
      records: results
    };
  },

  /**
   * Queries teacher attendance records and appends calculated durations and master details.
   */
  queryAttendance(payload) {
    const db = DBContext.getInstance();
    
    const targetQuery = {
      target: "TeacherAttendance",
      ...payload
    };

    const results = QueryEngine.execute(targetQuery, db);
    const records = results.data || [];

    // Hydrate each attendance log with dynamic durations and display names
    const hydrated = records.map(row => {
      const record = (typeof row.toJSON === 'function') ? row.toJSON() : row;
      
      const rawEntry = record.entry_time;
      const rawExit = record.exit_time;

      // Calculate dynamic duration
      record.duration = AttendanceUtil.calculateDuration(rawEntry, rawExit);

      // Convert datetime back to JSON object for API output format
      record.entry_time = AttendanceUtil.convertDateToJson(rawEntry);
      record.exit_time = AttendanceUtil.convertDateToJson(rawExit);

      // Resolve teacher master details
      const teacher = db.Teacher.findById(record.teacher_id);
      record.teacher_name = teacher ? teacher.full_name : "Unknown Teacher";

      // Resolve batch/course details
      const batch = db.Batch.findById(record.batch_id);
      if (batch) {
        record.batch_name = batch.batch_name;
        record.course_id = batch.course_id;
        
        const course = db.Course.findById(batch.course_id);
        record.course_name = course ? course.name : "Unknown Course";
      } else {
        record.batch_name = "Unknown Batch";
        record.course_id = null;
        record.course_name = "Unknown Course";
      }

      return record;
    });

    results.data = hydrated;
    return results;
  },

  /**
   * Records a salary or advance payment.
   */
  recordPayment(payload) {
    const db = DBContext.getInstance();
    console.log(`[StaffService] Recording ${payload.payment_type} for teacher ${payload.teacher_id}`);

    if (!db.Teacher.findById(payload.teacher_id)) {
      throw new SheetDB.EntityNotFoundError("Teacher", payload.teacher_id, "Staff");
    }

    return db.TeacherPaymentTransaction.insert({
      ...payload,
      transaction_date: payload.transaction_date || new Date(),
      created_at: new Date()
    });
  },

  /**
   * DOCUMENTATION
   */

  /**
   * Attaches a document link to a teacher profile.
   */
  addDocument(teacherId, documentPayload) {
    const db = DBContext.getInstance();
    console.log(`[StaffService] Adding document for teacher ${teacherId}`);

    if (!db.Teacher.findById(teacherId)) {
      throw new SheetDB.EntityNotFoundError("Teacher", teacherId, "Staff");
    }

    return db.TeacherDocument.insert({
      ...documentPayload,
      teacher_id: teacherId,
      uploaded_at: new Date()
    });
  },

  /**
   * Updates an existing teacher profile with validation checks, including subject maps and salary config.
   */
  updateTeacher(payload) {
    const db = DBContext.getInstance();
    console.log(`[StaffService] Initiating validation for teacher update: ${payload.teacher_id}`);

    // Extract relational fields if present
    const subjects = payload.data ? payload.data.subjects : undefined;
    const salaryConfig = payload.data ? payload.data.salary_config : undefined;

    const ctx = new ValidationContext(db, payload.teacher_id, payload.data);
    ValidationEngine.run(ctx, TeacherUpdateRules);

    if (!ctx.isValid()) {
      throw new SheetDB.ValidationError("Validation failed for teacher update.", { fields: ctx.errors });
    }

    // Clean relations from payload so they don't merge into Teacher model fields
    delete ctx.payload.subjects;
    delete ctx.payload.salary_config;

    // 1. Update Core Profile
    const updatedTeacher = db.Teacher.update(ctx.entityId, ctx.payload);

    // 2. Synchronize Subjects (if provided)
    if (subjects !== undefined) {
      this.updateTeacherSubjects(db, ctx.entityId, subjects);
    }

    // 3. Synchronize Salary Configuration (if provided)
    if (salaryConfig) {
      this.setSalaryConfig({
        teacher_id: ctx.entityId,
        ...salaryConfig
      });
    }

    console.log(`[StaffService] Update successful for teacher: ${ctx.entityId}`);
    return updatedTeacher;
  },

  /**
   * Synchronizes a teacher's subject assignments using fast bulk database operations.
   */
  updateTeacherSubjects(db, teacherId, subjectIds) {
    if (!teacherId) {
      throw new Error("teacher_id is required for updating subjects.");
    }

    // 1. Bulk delete currently assigned subjects
    const currentSubjects = db.TeacherSubject.where({ teacher_id: teacherId });
    currentSubjects.forEach(sub => {
      try {
        db.TeacherSubject.remove(sub.teacher_subject_id);
      } catch (err) {
        console.warn(`[StaffService] Failed to remove subject mapping ${sub.teacher_subject_id}:`, err.message);
      }
    });

    // 2. Bulk insert new assignments if any subjects are provided
    if (Array.isArray(subjectIds) && subjectIds.length > 0) {
      const recordsToInsert = [];
      subjectIds.forEach(subId => {
        // Relational Check: Does course exist?
        if (!db.Course.findById(subId)) {
          console.warn(`[StaffService] Skipping invalid Course ID in batch update: ${subId}`);
          return;
        }
        recordsToInsert.push({
          teacher_id: teacherId,
          subject_id: subId
        });
      });

      if (recordsToInsert.length > 0) {
        db.TeacherSubject.insertMany(recordsToInsert);
      }
    }
  }
};
