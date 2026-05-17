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
  markAttendance(payload) {
    const db = DBContext.getInstance();
    console.log(`[StaffService] Marking attendance for ${payload.teacher_id} on ${payload.attendance_date}`);

    if (!db.Teacher.findById(payload.teacher_id)) {
      throw new SheetDB.EntityNotFoundError("Teacher", payload.teacher_id, "Staff");
    }

    return db.TeacherAttendance.insert({
      ...payload,
      attendance_source: payload.attendance_source || "manual",
      created_at: new Date()
    });
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
  }
};
