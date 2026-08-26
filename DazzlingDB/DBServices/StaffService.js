/**
 * @file StaffService.js
 * Domain Service for Human Resources and Payroll (Teachers/Staff).
 */

const StaffService = {
  _trackMutation(context, tableName) {
    if (context && context.mutationManifest && Array.isArray(context.mutationManifest)) {
      if (!context.mutationManifest.includes(tableName)) {
        context.mutationManifest.push(tableName);
      }
    }
  },



  /**
     * Automatically expires any active salary configurations that overlap with a new contract's scope parameters.
     * This ensures an entity cannot have duplicate active payroll rules for the exact same class or group.
     *
     * @param {string} entityId 
     * The unique ID of the target individual receiving the contract (e.g., 'TCH-001' or 'STF-102').
     * @param {string} entityType 
     * The polymorphic discriminator string identifying the profile table ('Teacher' or 'StaffMember').
     * @param {string} scopeType 
     * The assignment boundary style being evaluated, such as 'global', 'single_batch', or 'batch_group'.
     * @param {string|Object} scopeId 
     * The precise unique identifier token or serialized JSON mapping of the specific classes/batches being targeted.
     * @param {string|null} [excludeConfigId=null] 
     * Optional database record ID to protect from self-expiration during multi-field modification updates.
     */
  /**
   * Robust comparison helper that evaluates whether two scope identifiers are logically equivalent.
   * Handles string normalization, JSON object parsing, sorted-key comparison, and strict type verification.
   *
   * @param {string} scopeType - The scope type ('global' | 'single_batch' | 'batch_group').
   * @param {*} scopeIdA - First scope ID, can be string, object, null, or undefined.
   * @param {*} scopeIdB - Second scope ID, can be string, object, null, or undefined.
   * @returns {boolean} True if the scopes are equivalent, false otherwise.
   */
  _isScopeEquivalent(scopeType, scopeIdA, scopeIdB) {
    if (scopeIdA === scopeIdB) return true;

    const resolveInput = (val) => {
      if (val === null || val === undefined) {
        return { isObject: false, value: "" };
      }
      if (typeof val === "object") {
        return { isObject: true, value: val };
      }
      const strVal = String(val).trim();
      if (scopeType === "batch_group") {
        try {
          const parsed = JSON.parse(strVal);
          if (parsed && typeof parsed === "object") {
            return { isObject: true, value: parsed };
          }
        } catch (e) {
          console.warn(`[StaffService] Failed to parse scope JSON string: "${strVal}"`, e.message);
        }
      }
      return { isObject: false, value: strVal };
    };

    try {
      const resA = resolveInput(scopeIdA);
      const resB = resolveInput(scopeIdB);

      if (resA.isObject && resB.isObject) {
        const objA = resA.value;
        const objB = resB.value;

        const keysA = Object.keys(objA).sort();
        const keysB = Object.keys(objB).sort();

        if (keysA.length !== keysB.length) return false;

        for (let i = 0; i < keysA.length; i++) {
          const key = keysA[i];
          if (key !== keysB[i]) return false;
          if (String(objA[key]).trim() !== String(objB[key]).trim()) return false;
        }
        return true;
      }

      if (resA.isObject || resB.isObject) {
        return false;
      }

      return resA.value === resB.value;
    } catch (err) {
      console.error("[StaffService] Exception occurred during scope equivalence evaluation:", err.stack || err.message);
      return false;
    }
  },

  /**
     * Automatically expires any active salary configurations that overlap with a new contract's scope parameters.
     * This ensures an entity cannot have duplicate active payroll rules for the exact same class or group.
     *
     * @param {string} entityId 
     * The unique ID of the target individual receiving the contract (e.g., 'TCH-001' or 'STF-102').
     * @param {string} entityType 
     * The polymorphic discriminator string identifying the profile table ('Teacher' or 'StaffMember').
     * @param {string} scopeType 
     * The assignment boundary style being evaluated, such as 'global', 'single_batch', or 'batch_group'.
     * @param {string|Object} scopeId 
     * The precise unique identifier token or serialized JSON mapping of the specific classes/batches being targeted.
     * @param {string|null} [excludeConfigId=null] 
     * Optional database record ID to protect from self-expiration during multi-field modification updates.
     */
  _expireOverlappingActiveConfigs(entityId, entityType, scopeType, scopeId, excludeConfigId = null) {
    const db = DBContext.getInstance();

    const activeConfigs = db.TeacherSalaryConfig.where({
      entity_id: entityId,
      entity_type: entityType,
      contract_status: "active"
    });

    activeConfigs.forEach(conf => {
      if (conf.salary_config_id === excludeConfigId) return;

      if (conf.scope_type === scopeType && this._isScopeEquivalent(scopeType, conf.scope_id, scopeId)) {
        console.log(`[StaffService] Auto-expiring overlapping salary config '${conf.salary_config_id}' for entity '${entityId}'`);
        db.TeacherSalaryConfig.update(conf.salary_config_id, { contract_status: "expired" });
      }
    });
  },

  /**
   * Validates parameters for revenue_percentage salary configurations.
   * @param {Object} db - Database singleton context.
   * @param {string} scopeType - 'single_batch' or 'batch_group'.
   * @param {string|Object} scopeId - Target batch ID or JSON mapping of batch IDs to rates.
   * @param {number|string} baseValue - Flat percentage rate for single_batch.
   */
  _validateRevenuePercentageConfig(db, scopeType, scopeId, baseValue) {
    if (scopeType === "global") {
      throw new SheetDB.ValidationError("Percentage strategy requires explicit batch scopes ('single_batch' or 'batch_group'). Global scope is forbidden.");
    }
    if (scopeType === "single_batch") {
      if (!scopeId || typeof scopeId !== "string" || !scopeId.trim()) {
        throw new SheetDB.ValidationError("scope_id is required for single_batch revenue_percentage salary configuration.");
      }
      if (!db.Batch.findById(scopeId.trim())) {
        throw new SheetDB.EntityNotFoundError("Batch", scopeId.trim(), "Academic");
      }
      const val = Number(baseValue);
      if (isNaN(val) || val < 0 || val > 100) {
        throw new SheetDB.ValidationError(`Invalid base_value percentage '${baseValue}'. Must be a number between 0 and 100.`);
      }
    } else if (scopeType === "batch_group") {
      if (!scopeId) {
        throw new SheetDB.ValidationError("scope_id is required for batch_group revenue_percentage salary configuration.");
      }
      let batchMap;
      if (typeof scopeId === "object" && scopeId !== null) {
        batchMap = scopeId;
      } else {
        try {
          batchMap = JSON.parse(scopeId);
        } catch (e) {
          throw new SheetDB.ValidationError(`Malformed scope_id JSON mapping for batch_group: ${scopeId}`);
        }
      }
      const batchIds = Object.keys(batchMap);
      if (batchIds.length === 0) {
        throw new SheetDB.ValidationError("scope_id JSON mapping must contain at least one batch.");
      }
      batchIds.forEach(bId => {
        if (!db.Batch.findById(bId)) {
          throw new SheetDB.EntityNotFoundError("Batch", bId, "Academic");
        }
        const rate = Number(batchMap[bId]);
        if (isNaN(rate) || rate < 0 || rate > 100) {
          throw new SheetDB.ValidationError(`Invalid rate '${batchMap[bId]}' for batch '${bId}'. Must be a number between 0 and 100.`);
        }
      });
    }
  },

  /**
   * Provisions a user account for an existing Teacher and links it via UserAccount junction table.
   * 
   * @param {string} teacherId - Target teacher ID (e.g. 'TCH-1001').
   * @param {Object} userData - User credentials payload ({ username, password, role? }).
   * @param {Object} context - Request execution lifecycle context.
   * @returns {Object} Result envelope with user_id, account_link_id, username, entity_type, entity_id.
   * @throws {UserAccountLinkError} If teacher does not exist or already has an active linked user.
   * @throws {SheetDB.ConflictError} If username is already taken.
   * @throws {SheetDB.ValidationError} If password does not meet complexity requirements.
   */
  createTeacherUser(teacherId, userData, context) {
    return AuthBridge.createUserForEntity(userData, "Teacher", teacherId, context);
  },

  /**
   * Provisions a user account for an existing Staff Member and links it via UserAccount junction table.
   * 
   * @param {string} staffId - Target staff ID (e.g. 'STF-1001').
   * @param {Object} userData - User credentials payload ({ username, password, role? }).
   * @param {Object} context - Request execution lifecycle context.
   * @returns {Object} Result envelope with user_id, account_link_id, username, entity_type, entity_id.
   * @throws {UserAccountLinkError} If staff member does not exist or already has an active linked user.
   * @throws {SheetDB.ConflictError} If username is already taken.
   * @throws {SheetDB.ValidationError} If password does not meet complexity requirements.
   */
  createStaffMemberUser(staffId, userData, context) {
    return AuthBridge.createUserForEntity(userData, "StaffMember", staffId, context);
  },

  /**
   * HR ONBOARDING
   */

  /**
   * Registers a new teacher profile and child entities atomically via AtomicPipeline.
   * Creates an Auth User and UserAccount junction mapping if userData is provided.
   * 
   * @param {Object} payload - Comprehensive teacher onboarding payload.
   * @param {Object} context - Request execution lifecycle context.
   * @returns {Object} The created Teacher entity record.
   * @throws {SheetDB.ValidationError} If pre-flight validation fails or password is too weak.
   * @throws {SheetDB.ConflictError} If username or email or mobile already exists.
   */
  onboardTeacher(payload, context) {
    const db = DBContext.getInstance();
    console.log(`[StaffService.onboardTeacher] Initiating atomic onboarding transaction for teacher: ${payload.full_name}`);

    // 1. DECOUPLED PRE-FLIGHT VALIDATION
    const ctx = new ValidationContext(db, null, payload);
    ValidationEngine.run(ctx, TeacherRegistrationRules);

    if (!ctx.isValid()) {
      throw new SheetDB.ValidationError("Pre-flight validation failed for teacher onboarding.", {
        fields: ctx.errors
      });
    }

    // Defensive Guard: Validate password complexity if userData is provided
    if (payload.userData && payload.userData.password) {
      if (!AuthCore.isStrongPassword(payload.userData.password)) {
        throw new SheetDB.ValidationError("Password is too weak (minimum 8 characters, uppercase, lowercase, digit, and symbol required).");
      }
    }

    // 2. Prepare Clean Teacher Payload
    const teacherInsertData = { ...payload };
    delete teacherInsertData.userData;
    delete teacherInsertData.salary_config;
    delete teacherInsertData.subjects;
    delete teacherInsertData.documents;

    const pipeCtx = new SheetDB.PipelineContext(context);
    const pipeline = (typeof AtomicPipeline !== 'undefined' ? AtomicPipeline : SheetDB.AtomicPipeline);

    let pipe = pipeline.begin(db, pipeCtx)
      .addStep("Teacher", (repo, state) => {
        console.log(`[StaffService.onboardTeacher] [Step: Teacher] Inserting core profile...`);
        state.teacher = repo.insert({
          ...teacherInsertData,
          status: payload.status || "active",
          created_at: new Date()
        });
        state.teacherId = state.teacher.teacher_id;
      });

    // Step: Auth User & UserAccount Junction Mapping
    if (payload.userData) {
      pipe = pipe
        .addStep("User", (repo, state) => {
          console.log(`[StaffService.onboardTeacher] [Step: User] Creating auth credentials...`);
          const cleanUsername = String(payload.userData.username).trim();
          const salt = AuthCore.generateSalt();
          state.user = repo.insert({
            username: cleanUsername,
            password_salt: salt,
            password_hash: AuthCore.hashPassword(payload.userData.password, salt),
            role: "teacher",
            status: "active",
            failed_attempts: 0
          });
          state.userId = state.user.user_id;
        })
        .addStep("UserAccount", (repo, state) => {
          console.log(`[StaffService.onboardTeacher] [Step: UserAccount] Binding user ${state.userId} to Teacher:${state.teacherId}`);
          state.accountLink = repo.insert({
            user_id: state.userId,
            entity_type: "Teacher",
            entity_id: state.teacherId,
            status: "active",
            created_at: new Date()
          });
        });
    }

    // Step: Initial Compensation Rate
    if (payload.salary_config) {
      pipe = pipe.addStep("TeacherSalaryConfig", (repo, state) => {
        console.log(`[StaffService.onboardTeacher] [Step: SalaryConfig] Setting payroll...`);
        repo.insert({
          ...payload.salary_config,
          entity_type: "Teacher",
          entity_id: state.teacherId,
          effective_from: payload.salary_config.effective_from || new Date()
        });
      });
    }

    // Step: Assign Teaching Subjects
    if (payload.subjects && Array.isArray(payload.subjects) && payload.subjects.length > 0) {
      pipe = pipe.addStep("TeacherSubject", (repo, state) => {
        console.log(`[StaffService.onboardTeacher] [Step: Subjects] Assigning ${payload.subjects.length} subjects...`);
        const subjectsToInsert = payload.subjects.map(subId => ({
          teacher_id: state.teacherId,
          subject_id: subId
        }));
        repo.insertMany(subjectsToInsert);
      });
    }

    // Step: Upload Verified Documents
    if (payload.documents && Array.isArray(payload.documents) && payload.documents.length > 0) {
      pipe = pipe.addStep("TeacherDocument", (repo, state) => {
        console.log(`[StaffService.onboardTeacher] [Step: Documents] Storing ${payload.documents.length} documents...`);
        const docsToInsert = payload.documents.map(doc => ({
          ...doc,
          teacher_id: state.teacherId,
          uploaded_at: new Date()
        }));
        repo.insertMany(docsToInsert);
      });
    }

    return pipe.execute((state) => {
      console.log(`[StaffService.onboardTeacher] Onboarding atomic pipeline completed for: ${state.teacherId}`);
      return state.teacher;
    });
  },

  /**
   * Links a teacher to multiple subjects/courses.
   */
  assignSubjects(teacherId, subjectIds = [], context) {
    const db = DBContext.getInstance();
    console.log(`[StaffService] Assigning ${subjectIds.length} subjects to teacher ${teacherId}`);

    if (!db.Teacher.findById(teacherId)) {
      throw new SheetDB.EntityNotFoundError("Teacher", teacherId, "Staff");
    }

    const results = [];
    const self = this;
    subjectIds.forEach(subId => {
      // Relational Check: Does course exist?
      if (!db.Course.findById(subId)) {
        console.warn(`[StaffService] Skipping invalid Course ID: ${subId}`);
        return;
      }

      const rec = db.TeacherSubject.insert({
        teacher_id: teacherId,
        subject_id: subId
      });
      results.push(rec);
      self._trackMutation(context, "TeacherSubject");
    });

    return results;
  },

  /**
   * PAYROLL & ATTENDANCE
   */

  /**
   * Configures the payroll rules for a teacher or staff member.
   * Enforces the FSM invariant: Max 1 active contract configuration per entity.
   */
  setSalaryConfig(payload, context) {
    const db = DBContext.getInstance();
    const entityType = payload.entity_type || "Teacher";
    const entityId = payload.entity_id || payload.teacher_id;

    if (!entityId) {
      throw new SheetDB.ValidationError("entity_id or teacher_id is required.");
    }

    console.log(`[StaffService] Setting salary config for ${entityType}: ${entityId}`);

    // Verify parent entity existence
    if (entityType === "Teacher") {
      if (!db.Teacher.findById(entityId)) {
        throw new SheetDB.EntityNotFoundError("Teacher", entityId, "Staff");
      }
    } else if (entityType === "StaffMember") {
      if (!db.StaffMember.findById(entityId)) {
        throw new SheetDB.EntityNotFoundError("StaffMember", entityId, "Staff");
      }
    } else {
      throw new SheetDB.ValidationError(`Unsupported entity_type: ${entityType}`);
    }

    // Invariant Check: Max 1 active row per entity-scope pair.
    if (payload.contract_status === "active") {
      this._expireOverlappingActiveConfigs(entityId, entityType, payload.scope_type, payload.scope_id);
    }

    // Validation for revenue_percentage
    if (payload.rate_type === "revenue_percentage") {
      this._validateRevenuePercentageConfig(db, payload.scope_type, payload.scope_id, payload.base_value);
    }

    const insertPayload = {
      entity_type: entityType,
      entity_id: entityId,
      salary_config_type: payload.salary_config_type,
      effective_from: payload.effective_from || new Date(),
      effective_to: payload.effective_to || null,
      rate_type: payload.rate_type,
      base_value: Number(payload.base_value),
      total_contract_value: payload.total_contract_value || null,
      scope_type: payload.scope_type,
      scope_id: payload.scope_id || null,
      remark: payload.remark || null,
      notes: payload.notes || null,
      contract_status: payload.contract_status || "drafted",
      settlement_state: payload.settlement_state || "unsettled"
    };

    const record = db.TeacherSalaryConfig.insert(insertPayload);
    this._trackMutation(context, "TeacherSalaryConfig");
    return record;
  },

  /**
   * Retrieves all salary configurations for an entity.
   */
  getSalaryConfigs(entityId, entityType, context) {
    const db = DBContext.getInstance();
    // Default fallback to Teacher
    const resolvedType = entityType || "Teacher";
    if (resolvedType === "Teacher") {
      if (!db.Teacher.findById(entityId)) {
        throw new SheetDB.EntityNotFoundError("Teacher", entityId, "Staff");
      }
    } else if (resolvedType === "StaffMember") {
      if (!db.StaffMember.findById(entityId)) {
        throw new SheetDB.EntityNotFoundError("StaffMember", entityId, "Staff");
      }
    }
    return db.TeacherSalaryConfig.where({ entity_id: entityId, entity_type: resolvedType });
  },

  /**
   * Retrieves a specific salary configuration block, verifying ownership.
   */
  getSalaryConfig(entityId, entityType, salaryConfigId, context) {
    const db = DBContext.getInstance();
    const config = db.TeacherSalaryConfig.findById(salaryConfigId);
    if (!config) {
      throw new SheetDB.EntityNotFoundError("TeacherSalaryConfig", salaryConfigId, "Staff");
    }
    const resolvedType = entityType || "Teacher";
    if (config.entity_id !== entityId || config.entity_type !== resolvedType) {
      throw new SheetDB.ValidationError(`Cross-entity query blocked: config '${salaryConfigId}' does not belong to ${resolvedType} '${entityId}'.`);
    }
    return config;
  },

  /**
   * Updates an existing salary configuration block, enforcing the FSM active invariant.
   */
  updateSalaryConfig(entityId, entityType, salaryConfigId, updateData, context) {
    const db = DBContext.getInstance();
    const config = db.TeacherSalaryConfig.findById(salaryConfigId);
    if (!config) {
      throw new SheetDB.EntityNotFoundError("TeacherSalaryConfig", salaryConfigId, "Staff");
    }
    const resolvedType = entityType || "Teacher";
    if (config.entity_id !== entityId || config.entity_type !== resolvedType) {
      throw new SheetDB.ValidationError(`Cross-entity mutation blocked: config '${salaryConfigId}' does not belong to ${resolvedType} '${entityId}'.`);
    }

    // Enforce active invariant if changing status to "active"
    if (updateData.contract_status === "active") {
      const targetScopeType = updateData.scope_type !== undefined ? updateData.scope_type : config.scope_type;
      const targetScopeId = updateData.scope_id !== undefined ? updateData.scope_id : config.scope_id;
      this._expireOverlappingActiveConfigs(entityId, resolvedType, targetScopeType, targetScopeId, salaryConfigId);
    }

    // Validation for revenue_percentage if rate_type, scope_type, scope_id, or base_value are being updated
    const targetRateType = updateData.rate_type !== undefined ? updateData.rate_type : config.rate_type;
    if (targetRateType === "revenue_percentage") {
      const targetScopeType = updateData.scope_type !== undefined ? updateData.scope_type : config.scope_type;
      const targetScopeId = updateData.scope_id !== undefined ? updateData.scope_id : config.scope_id;
      const targetBaseValue = updateData.base_value !== undefined ? updateData.base_value : config.base_value;
      this._validateRevenuePercentageConfig(db, targetScopeType, targetScopeId, targetBaseValue);
    }

    const updatedRecord = db.TeacherSalaryConfig.update(salaryConfigId, updateData);
    this._trackMutation(context, "TeacherSalaryConfig");
    return updatedRecord;
  },

  /**
   * Removes an existing salary configuration block.
   */
  deleteSalaryConfig(entityId, entityType, salaryConfigId, context) {
    const db = DBContext.getInstance();
    const config = db.TeacherSalaryConfig.findById(salaryConfigId);
    if (!config) {
      throw new SheetDB.EntityNotFoundError("TeacherSalaryConfig", salaryConfigId, "Staff");
    }
    const resolvedType = entityType || "Teacher";
    if (config.entity_id !== entityId || config.entity_type !== resolvedType) {
      throw new SheetDB.ValidationError(`Cross-entity deletion blocked: config '${salaryConfigId}' does not belong to ${resolvedType} '${entityId}'.`);
    }

    db.TeacherSalaryConfig.remove(salaryConfigId);
    this._trackMutation(context, "TeacherSalaryConfig");
    return true;
  },

  /**
   * Marks daily attendance for a teacher (Upsert pattern).
   */
  markAttendance(payload, context) {
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
      if (entryDate && exitDate && exitDate.getTime() < entryDate.getTime()) {
        exitDate.setUTCDate(exitDate.getUTCDate() + 1);
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

    let resultRecord;
    if (existing) {
      console.log(`[StaffService] Updating existing teacher attendance ID: ${existing.attendance_id} for Batch: ${batchId}`);
      resultRecord = db.TeacherAttendance.update(existing.attendance_id, attendanceData);
    } else {
      console.log(`[StaffService] Inserting new teacher attendance for Teacher: ${teacherId} Batch: ${batchId}`);
      resultRecord = db.TeacherAttendance.insert(attendanceData);
    }
    this._trackMutation(context, "TeacherAttendance");
    return resultRecord;
  },

  /**
   * Marks bulk teacher attendance for a specific date (Upsert pattern).
   */
  markAttendanceBulk(payload, context) {
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
    const self = this;
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
        if (entryDate && exitDate && exitDate.getTime() < entryDate.getTime()) {
          exitDate.setUTCDate(exitDate.getUTCDate() + 1);
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
      self._trackMutation(context, "TeacherAttendance");
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
      const rawAttendanceDate = record.attendance_date;

      // Calculate dynamic duration
      record.duration = AttendanceUtil.calculateDuration(rawEntry, rawExit);

      // Convert datetime back to JSON object for API output format
      // record.attendance_date = SheetDB.DateComparator.toLocaleDateString(rawAttendanceDate)
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
   * Records a manual payroll, advance, bonus, or deduction payment transaction.
   * @param {Object} payload - Payout transaction input properties.
   * @param {string} payload.teacher_id - Target teacher ID.
   * @param {string} payload.payment_type - "salary", "advance", "bonus", or "deduction".
   * @param {number} payload.amount - Numeric value.
   * @param {string} payload.payment_method - Payment method (cash, Paytm, PhonePe, bank, other).
   * @param {string} payload.transaction_date - Date (YYYY-MM-DD).
   * @param {string} payload.salary_month - Month of service (YYYY-MM).
   * @param {string} [payload.reference_number] - Reference number.
   * @param {string} [payload.notes] - Comments.
   * @param {Object} context - Request transaction execution context tracking mutations.
   * @returns {Object} Newly committed TeacherPaymentTransaction record.
   * @throws {SheetDB.ValidationError} When inputs fail business validations.
   */
  recordPayment(payload, context) {
    const db = DBContext.getInstance();
    console.log(`[StaffService] Recording payment transaction for teacher ${payload.teacher_id}`);

    const ctx = new ValidationContext(db, null, payload);
    ValidationEngine.run(ctx, TeacherPaymentTransactionRules);

    if (!ctx.isValid()) {
      throw new SheetDB.ValidationError("Validation failed for recording teacher payment transaction.", { fields: ctx.errors });
    }

    const record = db.TeacherPaymentTransaction.insert({
      teacher_id: ctx.payload.teacher_id,
      payment_type: ctx.payload.payment_type,
      amount: ctx.payload.amount,
      payment_method: ctx.payload.payment_method,
      transaction_date: ctx.payload.transaction_date,
      reference_number: ctx.payload.reference_number || null,
      salary_month: ctx.payload.salary_month,
      notes: ctx.payload.notes || null,
      created_by: payload.created_by || (context && context.user ? context.user.username : "system")
    });

    this._trackMutation(context, "TeacherPaymentTransaction");
    return record;
  },

  /**
   * DOCUMENTATION
   */

  /**
   * Attaches a document link to a teacher profile.
   */
  addDocument(teacherId, documentPayload, context) {
    const db = DBContext.getInstance();
    console.log(`[StaffService] Adding document for teacher ${teacherId}`);

    if (!db.Teacher.findById(teacherId)) {
      throw new SheetDB.EntityNotFoundError("Teacher", teacherId, "Staff");
    }

    const record = db.TeacherDocument.insert({
      ...documentPayload,
      teacher_id: teacherId,
      uploaded_at: new Date()
    });
    this._trackMutation(context, "TeacherDocument");
    return record;
  },

  /**
   * Updates an existing teacher profile with validation checks, including subject maps and salary config.
   */
  updateTeacher(payload, context) {
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
    this._trackMutation(context, "Teacher");

    // 2. Synchronize Subjects (if provided)
    if (subjects !== undefined) {
      this.updateTeacherSubjects(db, ctx.entityId, subjects, context);
    }

    // 3. Synchronize Salary Configuration (if provided)
    if (salaryConfig) {
      this.setSalaryConfig({
        teacher_id: ctx.entityId,
        ...salaryConfig
      }, context);
    }

    console.log(`[StaffService] Update successful for teacher: ${ctx.entityId}`);
    return updatedTeacher;
  },

  /**
   * Synchronizes a teacher's subject assignments using fast bulk database operations.
   */
  updateTeacherSubjects(db, teacherId, subjectIds, context) {
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
    this._trackMutation(context, "TeacherSubject");

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
        this._trackMutation(context, "TeacherSubject");
      }
    }
  }
};

// Bind to global namespace
globalThis.StaffService = StaffService;
