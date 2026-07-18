/**
 * @file AcademicService.js
 * Domain Service for Curriculum and Batch Management.
 */

const AcademicService = {
  _trackMutation(context, tableName) {
    if (context && context.mutationManifest && Array.isArray(context.mutationManifest)) {
      if (!context.mutationManifest.includes(tableName)) {
        context.mutationManifest.push(tableName);
      }
    }
  },

  /**
   * Registers a new curriculum segment (e.g., 'Academic', 'Vocational').
   */
  createCourseType(payload, context) {
    const db = DBContext.getInstance();
    console.log(`[AcademicService] Creating CourseType: ${payload.segment_name}`);
    const record = db.CourseType.insert(payload);
    this._trackMutation(context, "CourseType");
    return record.toJSON();
  },

  /**
   * Creates a new Course/Subject.
   * Ensures the segment_id is valid and exists.
   */
  createCourse(payload, context) {
    const db = DBContext.getInstance();

    if (!payload.segment_id || typeof payload.segment_id !== "string") {
      throw new SheetDB.ValidationError("Course creation failed: 'segment_id' must be a non-empty string.");
    }

    // Health Check: Ensure CourseType exists
    const segment = db.CourseType.findById(payload.segment_id);
    if (!segment) {
      throw new SheetDB.EntityNotFoundError("CourseType", payload.segment_id, "Academic");
    }

    console.log(`[AcademicService] Creating Course: ${payload.name}`);
    const record = db.Course.insert(payload);
    this._trackMutation(context, "Course");
    return record.toJSON();
  },

  /**
   * Creates a new Batch instance.
   * Performs multi-point health checks for Course, Teacher, and Branch.
   */
  createBatch(payload, context) {
    const db = DBContext.getInstance();

    // 1. Verify Course
    if (!db.Course.findById(payload.course_id)) {
      throw new SheetDB.EntityNotFoundError("Course", payload.course_id, "Academic");
    }

    // 2. Verify Teacher (Cross-Category Check: Staff)
    if (payload.teacher_id && !db.Teacher.findById(payload.teacher_id)) {
      throw new SheetDB.EntityNotFoundError("Teacher", payload.teacher_id, "Academic");
    }

    // 3. Verify Branch (Cross-Category Check: Staff)
    if (payload.branch_id && !db.Branch.findById(payload.branch_id)) {
      throw new SheetDB.EntityNotFoundError("Branch", payload.branch_id, "Academic");
    }

    console.log(`[AcademicService] Creating Batch: ${payload.batch_name}`);
    const record = db.Batch.insert({
      ...payload,
      status: payload.status || "active",
      capacity: payload.capacity || 30
    });
    this._trackMutation(context, "Batch");
    return record.toJSON();
  },

  /**
   * Orchestrates the creation of a Package with nested courses and perks.
   * Leverages transactional loops and defensive polymorphic normalization.
   */
  /**
   * Orchestrate bulk creation of a Package along with its perks and courses/subjects.
   * Uses optimized batch inserts and ValidationEngine pipelines.
   * @param {Object} payload - The input data containing package metadata, perks, and courses.
   * @param {Object} context - Execution request context.
   * @returns {Object} The compiled presentation envelope of the newly created Package.
   * @throws {SheetDB.ValidationError} Form validation or schema compliance failure.
   */
  createPackage(payload, context) {
    const db = DBContext.getInstance();
    console.log(`[AcademicService] Orchestrating Bulk Package Creation: ${payload.name}`);

    // 1. DECOUPLED PRE-FLIGHT VALIDATION
    const validationStart = Date.now();
    const ctx = new ValidationContext(db, null, payload);
    ValidationEngine.run(ctx, globalThis.PackageRegistrationRules || PackageRegistrationRules);

    if (!ctx.isValid()) {
      throw new SheetDB.ValidationError("Pre-flight validation failed for Package creation.", {
        fields: ctx.errors
      });
    }
    const validationTime = Date.now() - validationStart;

    const serviceStart = Date.now();
    const tx = new TransactionTracker();

    try {
      // 2. CORE: INSERT CORE PACKAGE
      const coreFields = ["name", "description", "target_class", "board", "month", "package_fee", "discount_percent", "status"];
      const packageData = {};
      coreFields.forEach(f => {
        if (payload[f] !== undefined) packageData[f] = payload[f];
      });

      const newPackage = db.Package.insert(packageData);
      const packageId = newPackage.package_id;
      tx.trackInsert(db.Package, packageId);
      this._trackMutation(context, "Package");

      // 3. RESOLVE & BATCH INSERT PERKS
      const perksToInsert = payload.perks || [];

      const perksData = perksToInsert.map((perk, index) => ({
        package_id: packageId,
        perk_title: perk.perk_title,
        perk_description: perk.perk_description || "",
        icon: perk.icon || "star",
        display_order: perk.display_order || (index + 1)
      }));

      if (perksData.length > 0) {
        const insertedPerks = db.PackagePerk.insertMany(perksData);
        tx.trackInsertMany(db.PackagePerk, insertedPerks.map(p => p.perk_id));
        this._trackMutation(context, "PackagePerk");
      }

      // 4. RESOLVE & BATCH INSERT Polymorphic Courses/Subjects
      if (payload.courses && Array.isArray(payload.courses)) {
        const onDemandPayloads = [];
        const packageItemPrep = [];

        payload.courses.forEach((item, index) => {
          const normalizedType = typeof item.entity_type === "string"
            ? item.entity_type.toLowerCase().trim()
            : item.entity_type;

          if (item.on_demand === true) {
            onDemandPayloads.push({
              index,
              normalizedType,
              data: {
                segment_id: item._resolvedSegmentId,
                entity_type: normalizedType,
                name: item.name,
                short_code: item.short_code,
                language_medium: item.language_medium || "English",
                duration_value: item.duration_value,
                duration_unit: item.duration_unit || "months",
                base_fee: item.base_fee,
                status: item.status || "active"
              }
            });
          } else {
            packageItemPrep.push({
              package_id: packageId,
              entity_type: normalizedType,
              entity_id: item.entity_id
            });
          }
        });

        // 4a. Execute bulk inserts of on-demand courses if any
        if (onDemandPayloads.length > 0) {
          const coursesToInsert = onDemandPayloads.map(op => op.data);
          const insertedCourses = db.Course.insertMany(coursesToInsert);
          tx.trackInsertMany(db.Course, insertedCourses.map(c => c.course_id));
          this._trackMutation(context, "Course");

          // Map inserted on-demand course IDs back into PackageItem records
          onDemandPayloads.forEach((op, idx) => {
            const newCourse = insertedCourses[idx];
            packageItemPrep.push({
              package_id: packageId,
              entity_type: op.normalizedType,
              entity_id: newCourse.course_id
            });
          });
        }

        // 4b. Execute bulk inserts of PackageItems
        if (packageItemPrep.length > 0) {
          const insertedItems = db.PackageItem.insertMany(packageItemPrep);
          tx.trackInsertMany(db.PackageItem, insertedItems.map(item => item.item_id));
          this._trackMutation(context, "PackageItem");
        }
      }

      // Timing and Performance Logging Assertions (Rule N5)
      const serviceTime = Date.now() - serviceStart;
      const totalTime = Date.now() - validationStart;
      console.log(`
[AcademicService] createPackage execution complete:
| Stage               | Duration |
|---------------------|----------|
| Validation (RAM)    | ${validationTime}ms |
| Database Insertion  | ${serviceTime}ms |
| Total Execution     | ${totalTime}ms |
`);
      return newPackage.toJSON();

    } catch (error) {
      console.error(`[AcademicService] Bulk creation failed, rolling back transaction: ${error.message}`);
      tx.rollback();
      throw error;
    }
  },

  /**
   * Safe updates of Package records along with their nested courses and perks.
   * Leverages backups and dynamic rollback capabilities via TransactionTracker.
   */
  updatePackage(payload, context) {
    const db = DBContext.getInstance();
    const packageId = payload.package_id;
    console.log(`[AcademicService] Updating Package: ${packageId}`);

    const existingPackage = db.Package.findById(packageId);
    if (!existingPackage) throw new SheetDB.EntityNotFoundError("Package", packageId, "Academic");

    const tx = new TransactionTracker();
    const self = this;

    try {
      // A. Update Core Package Attributes
      const coreFields = ["name", "description", "target_class", "board", "month", "package_fee", "discount_percent", "status"];
      const updateData = {};
      coreFields.forEach(f => {
        if (payload[f] !== undefined) updateData[f] = payload[f];
      });

      const backupPackageState = { ...existingPackage };
      db.Package.update(packageId, updateData);
      tx.trackUpdate(db.Package, packageId, backupPackageState);
      this._trackMutation(context, "Package");

      // B. Update Polymorphic Courses (PackageItem Sync via clean rewrite & normalization)
      if (payload.courses !== undefined) {
        const backupItems = db.PackageItem.where({ package_id: packageId });
        tx.trackSync(db.PackageItem, { package_id: packageId }, backupItems);

        backupItems.forEach(item => db.PackageItem.remove(item.item_id));

        payload.courses.forEach(item => {
          const normalizedType = typeof item.entity_type === "string"
            ? item.entity_type.toLowerCase().trim()
            : item.entity_type;

          db.PackageItem.insert({
            package_id: packageId,
            entity_type: normalizedType,
            entity_id: item.entity_id
          });
          self._trackMutation(context, "PackageItem");
        });
      }

      // C. Update Package Perks (PackagePerk Sync via clean rewrite)
      if (payload.perks !== undefined) {
        const backupPerks = db.PackagePerk.where({ package_id: packageId });
        tx.trackSync(db.PackagePerk, { package_id: packageId }, backupPerks);

        backupPerks.forEach(perk => db.PackagePerk.remove(perk.perk_id));

        payload.perks.forEach((perk, index) => {
          db.PackagePerk.insert({
            package_id: packageId,
            perk_title: perk.perk_title,
            perk_description: perk.perk_description || "",
            icon: perk.icon || "star",
            display_order: perk.display_order || (index + 1)
          });
          self._trackMutation(context, "PackagePerk");
        });
      }

      return { success: true, message: `Package '${packageId}' successfully updated.` };

    } catch (error) {
      console.error(`[AcademicService] updatePackage failed for Package '${packageId}': ${error.message}`, error);
      console.warn(`[AcademicService] Initiating database transaction rollback...`);
      try {
        tx.rollback();
        console.log(`[AcademicService] Rollback completed successfully.`);
      } catch (rollbackError) {
        console.error(`[AcademicService] CRITICAL: Transaction rollback failed! Details: ${rollbackError.message}`, rollbackError);
      }
      throw error;
    }
  },

  /**
   * Safe package deletion logic enforcing referential integrity.
   * Cleans up child records (CASCADE) and rolls back on failure.
   */
  deletePackage(packageId, context) {
    const db = DBContext.getInstance();
    console.log(`[AcademicService] Attempting to delete Package: ${packageId}`);

    const existingPackage = db.Package.findById(packageId);
    if (!existingPackage) throw new SheetDB.EntityNotFoundError("Package", packageId, "Academic");

    // 1. Referential Integrity Check (RESTRICT)
    const enrollments = db.Enrollment.where({ enrollment_type: "package", item_id: packageId });
    if (enrollments.length > 0) {
      throw new SheetDB.IntegrityError(`Cannot delete Package '${packageId}' because it has active student enrollments.`, {
        parentTable: "Package",
        parentId: packageId,
        violations: [{
          table: "Enrollment",
          foreignKey: "item_id",
          ids: enrollments.map(e => e.enrollment_id),
          policy: "protect"
        }]
      });
    }

    const tx = new TransactionTracker();
    const self = this;

    try {
      // 2. Fetch all child elements to track for rollback
      const items = db.PackageItem.where({ package_id: packageId });
      const perks = db.PackagePerk.where({ package_id: packageId });

      // 3. Cascade delete PackageItems
      items.forEach(item => {
        db.PackageItem.remove(item.item_id);
        tx.trackDelete(db.PackageItem, item);
        self._trackMutation(context, "PackageItem");
      });

      // 4. Cascade delete PackagePerks
      perks.forEach(perk => {
        db.PackagePerk.remove(perk.perk_id);
        tx.trackDelete(db.PackagePerk, perk);
        self._trackMutation(context, "PackagePerk");
      });

      // 5. Delete core Package record
      db.Package.remove(packageId);
      tx.trackDelete(db.Package, existingPackage);
      this._trackMutation(context, "Package");

      console.log(`[AcademicService] Package '${packageId}' and all related perks/items deleted successfully.`);
      return { success: true, message: `Package '${packageId}' successfully deleted.` };

    } catch (error) {
      console.error(`[AcademicService] deletePackage failed for Package '${packageId}': ${error.message}`, error);
      console.warn(`[AcademicService] Initiating database transaction rollback...`);
      try {
        tx.rollback();
        console.log(`[AcademicService] Rollback completed successfully.`);
      } catch (rollbackError) {
        console.error(`[AcademicService] CRITICAL: Transaction rollback failed! Details: ${rollbackError.message}`, rollbackError);
      }
      throw error;
    }
  },

  /**
   * Enrolls a student into a specific batch or course.
   */
  enrollStudent(payload, context) {
    const db = DBContext.getInstance();

    // Existence checks
    if (!db.Student.findById(payload.student_id)) {
      throw new SheetDB.EntityNotFoundError("Student", payload.student_id, "Academic");
    }

    console.log(`[AcademicService] Enrolling Student ${payload.student_id} into Batch/Item ${payload.course_id}`);
    const record = db.Enrollment.insert({
      ...payload,
      enrollment_date: payload.enrollment_date || new Date(),
      status: payload.status || "active"
    });
    this._trackMutation(context, "Enrollment");
    return record.toJSON();
  }
};

// Bind to global namespace
globalThis.AcademicService = AcademicService;
