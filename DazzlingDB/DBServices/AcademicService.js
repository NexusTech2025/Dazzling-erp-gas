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
    const pipeCtx = new SheetDB.PipelineContext(context);

    const result = SheetDB.AtomicPipeline.begin(db, pipeCtx)
      .addStep("Package", (repo, state) => {
        console.log(`[AcademicService] [createPackage] Step: Package | Started.`);
        const coreFields = ["name", "description", "target_class", "board", "month", "package_fee", "discount_percent", "status"];
        const packageData = {};
        coreFields.forEach(f => {
          if (payload[f] !== undefined) packageData[f] = payload[f];
        });

        state.newPackage = repo.insert(packageData);
        state.packageId = state.newPackage.package_id;
        console.log(`[AcademicService] [createPackage] Step: Package | Inserted Package ID: ${state.packageId}`);
        if (db._pkCache) {
          console.log(`[AcademicService] [createPackage] Step: Package | PKCache contains packageId?`, db._pkCache.get("Package").has(state.packageId));
        }
      })
      .addStep("PackagePerk", (repo, state) => {
        console.log(`[AcademicService] [createPackage] Step: PackagePerk | Started.`);
        const perksToInsert = payload.perks || [];
        const perksData = perksToInsert.map((perk, index) => ({
          package_id: state.packageId,
          perk_title: perk.perk_title,
          perk_description: perk.perk_description || "",
          icon: perk.icon || "star",
          display_order: perk.display_order || (index + 1)
        }));

        console.log(`[AcademicService] [createPackage] Step: PackagePerk | Perks to insert count: ${perksData.length}`);
        if (perksData.length > 0) {
          repo.insertMany(perksData);
        }
      })
      .addStep("Course", (repo, state) => {
        console.log(`[AcademicService] [createPackage] Step: Course | Started.`);
        state.onDemandPayloads = [];
        state.packageItemPrep = [];

        if (payload.courses && Array.isArray(payload.courses)) {
          payload.courses.forEach((item, index) => {
            const normalizedType = typeof item.entity_type === "string"
              ? item.entity_type.toLowerCase().trim()
              : item.entity_type;

            if (item.on_demand === true) {
              state.onDemandPayloads.push({
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
              state.packageItemPrep.push({
                package_id: state.packageId,
                entity_type: normalizedType,
                entity_id: item.entity_id
              });
            }
          });

          console.log(`[AcademicService] [createPackage] Step: Course | On-Demand courses to insert count: ${state.onDemandPayloads.length}`);
          if (state.onDemandPayloads.length > 0) {
            const coursesToInsert = state.onDemandPayloads.map(op => op.data);
            const insertedCourses = repo.insertMany(coursesToInsert);

            // Map inserted on-demand course IDs back into PackageItem records
            state.onDemandPayloads.forEach((op, idx) => {
              const newCourse = insertedCourses[idx];
              state.packageItemPrep.push({
                package_id: state.packageId,
                entity_type: op.normalizedType,
                entity_id: newCourse.course_id
              });
            });
          }
        }
        console.log(`[AcademicService] [createPackage] Step: Course | packageItemPrep count: ${state.packageItemPrep.length}`);
      })
      .addStep("PackageItem", (repo, state) => {
        console.log(`[AcademicService] [createPackage] Step: PackageItem | Started.`);
        console.log(`[AcademicService] [createPackage] Step: PackageItem | packageItemPrep:`, JSON.stringify(state.packageItemPrep));
        if (db._pkCache) {
          console.log(`[AcademicService] [createPackage] Step: PackageItem | PKCache contains packageId?`, db._pkCache.get("Package").has(state.packageId));
        }
        if (state.packageItemPrep && state.packageItemPrep.length > 0) {
          repo.insertMany(state.packageItemPrep);
        }
      })
      .execute(state => state.newPackage.toJSON());

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
    return result;
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

    const pipeCtx = new SheetDB.PipelineContext(context);

    SheetDB.AtomicPipeline.begin(db, pipeCtx)
      .addStep("Package", (repo, state) => {
        const coreFields = ["name", "description", "target_class", "board", "month", "package_fee", "discount_percent", "status"];
        const updateData = {};
        coreFields.forEach(f => {
          if (payload[f] !== undefined) updateData[f] = payload[f];
        });

        repo.update(packageId, updateData);
      })
      .addStep("PackageItem", (repo, state) => {
        if (payload.courses !== undefined) {
          const existingItems = repo.where({ package_id: packageId });
          if (existingItems.length > 0) {
            repo.deleteMany(existingItems.map(item => item.item_id));
          }

          const itemsToInsert = payload.courses.map(item => {
            const normalizedType = typeof item.entity_type === "string"
              ? item.entity_type.toLowerCase().trim()
              : item.entity_type;
            return {
              package_id: packageId,
              entity_type: normalizedType,
              entity_id: item.entity_id
            };
          });

          if (itemsToInsert.length > 0) {
            repo.insertMany(itemsToInsert);
          }
        }
      })
      .addStep("PackagePerk", (repo, state) => {
        if (payload.perks !== undefined) {
          const existingPerks = repo.where({ package_id: packageId });
          if (existingPerks.length > 0) {
            repo.deleteMany(existingPerks.map(perk => perk.perk_id));
          }

          const perksToInsert = payload.perks.map((perk, index) => ({
            package_id: packageId,
            perk_title: perk.perk_title,
            perk_description: perk.perk_description || "",
            icon: perk.icon || "star",
            display_order: perk.display_order || (index + 1)
          }));

          if (perksToInsert.length > 0) {
            repo.insertMany(perksToInsert);
          }
        }
      })
      .execute();

    return { success: true, message: `Package '${packageId}' successfully updated.` };
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

    const itemIds = db.PackageItem.where({ package_id: packageId }).map(i => i.item_id);
    const perkIds = db.PackagePerk.where({ package_id: packageId }).map(p => p.perk_id);

    const pipeCtx = new SheetDB.PipelineContext(context);

    SheetDB.AtomicPipeline.begin(db, pipeCtx)
      .addStep("PackageItem", (repo, state) => {
        if (itemIds.length > 0) {
          repo.deleteMany(itemIds);
        }
      })
      .addStep("PackagePerk", (repo, state) => {
        if (perkIds.length > 0) {
          repo.deleteMany(perkIds);
        }
      })
      .addStep("Package", (repo, state) => {
        repo.remove(packageId);
      })
      .execute();

    console.log(`[AcademicService] Package '${packageId}' and all related perks/items deleted successfully.`);
    return { success: true, message: `Package '${packageId}' successfully deleted.` };
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
