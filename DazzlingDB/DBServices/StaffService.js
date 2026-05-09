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
    console.log(`[StaffService] Onboarding teacher: ${payload.full_name}`);

    // 1. Uniqueness check for mobile number
    if (db.Teacher.exists({ mobile_number: payload.mobile_number })) {
      throw new SheetDB.ConflictError(`A teacher with mobile number ${payload.mobile_number} already exists.`);
    }

    try {
      // 2. Insert Teacher Record
      const teacher = db.Teacher.insert({
        ...payload,
        status: payload.status || "active",
        created_at: new Date()
      });

      // 3. Optional: Create Auth User
      if (payload.userData) {
        AuthBridge.registerUser({
          ...payload.userData,
          role: "teacher"
        });
      }

      return teacher;
    } catch (e) {
      console.error("[StaffService] Onboarding failed:", e.message);
      throw new SheetDB.IntegrityError("Failed to onboard teacher.", { originalError: e });
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
