/**
 * @file AcademicService.js
 * Domain Service for Curriculum and Batch Management.
 */

const AcademicService = {
  /**
   * Registers a new curriculum segment (e.g., 'Academic', 'Vocational').
   */
  createCourseType(payload) {
    const db = DBContext.getInstance();
    console.log(`[AcademicService] Creating CourseType: ${payload.segment_name}`);
    return db.CourseType.insert(payload);
  },

  /**
   * Creates a new Course/Subject.
   * Ensures the segment_id is valid and exists.
   */
  createCourse(payload) {
    const db = DBContext.getInstance();

    if (!payload.segment_id) {
      throw new SheetDB.ValidationError("Course creation failed: 'segment_id' is required.");
    }

    // Health Check: Ensure CourseType exists
    const segment = db.CourseType.findById(payload.segment_id);
    if (!segment) {
      throw new SheetDB.EntityNotFoundError("CourseType", payload.segment_id, "Academic");
    }

    console.log(`[AcademicService] Creating Course: ${payload.name}`);
    return db.Course.insert(payload);
  },

  /**
   * Creates a new Batch instance.
   * Performs multi-point health checks for Course, Teacher, and Branch.
   */
  createBatch(payload) {
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
    return db.Batch.insert({
      ...payload,
      status: payload.status || "active",
      capacity: payload.capacity || 30
    });
  },

  /**
   * Orchestrates the creation of a Package with nested courses and perks.
   * Leverages transactional loops and defensive polymorphic normalization.
   */
  createPackage(payload) {
    const db = DBContext.getInstance();
    console.log(`[AcademicService] Orchestrating Bulk Package: ${payload.name}`);

    // 1. Insert Core Package
    const coreFields = ["name", "description", "target_class", "board", "month", "package_fee", "discount_percent", "status"];
    const packageData = {};
    coreFields.forEach(f => {
      if (payload[f] !== undefined) packageData[f] = payload[f];
    });
    
    const newPackage = db.Package.insert(packageData);
    const packageId = newPackage.package_id;
    const insertedRecords = [{ table: "Package", id: packageId }];

    try {
      // 2. Insert Perks (Let SheetDB validate required/default columns)
      if (payload.perks && Array.isArray(payload.perks)) {
        payload.perks.forEach((perk, index) => {
          const newPerk = db.PackagePerk.insert({
            package_id: packageId,
            perk_title: perk.perk_title,
            perk_description: perk.perk_description || "",
            icon: perk.icon || "star",
            display_order: perk.display_order || (index + 1)
          });
          insertedRecords.push({ table: "PackagePerk", id: newPerk.perk_id });
        });
      }

      // 3. Insert Polymorphic Courses/Subjects (Trimming & Casing Normalization ONLY)
      if (payload.courses && Array.isArray(payload.courses)) {
        payload.courses.forEach(item => {
          const normalizedType = typeof item.entity_type === "string"
            ? item.entity_type.toLowerCase().trim()
            : item.entity_type;

          const newItem = db.PackageItem.insert({
            package_id: packageId,
            entity_type: normalizedType,
            entity_id: item.entity_id
          });
          insertedRecords.push({ table: "PackageItem", id: newItem.item_id });
        });
      }

      return newPackage;

    } catch (error) {
      // 🚨 Rollback transaction on creation failure
      console.error(`[AcademicService] Bulk creation failed, rolling back: ${error.message}`);
      for (let i = insertedRecords.length - 1; i >= 0; i--) {
        db[insertedRecords[i].table].remove(insertedRecords[i].id);
      }
      throw error;
    }
  },

  /**
   * Safe updates of Package records along with their nested courses and perks.
   * Leverages backups and dynamic rollback capabilities via TransactionTracker.
   */
  updatePackage(payload) {
    const db = DBContext.getInstance();
    const packageId = payload.package_id;
    console.log(`[AcademicService] Updating Package: ${packageId}`);

    const existingPackage = db.Package.findById(packageId);
    if (!existingPackage) throw new Error(`Package with ID '${packageId}' not found.`);

    const tx = new TransactionTracker();

    try {
      // A. Update Core Package Attributes (SheetDB automatically validates columns)
      const coreFields = ["name", "description", "target_class", "board", "month", "package_fee", "discount_percent", "status"];
      const updateData = {};
      coreFields.forEach(f => {
        if (payload[f] !== undefined) updateData[f] = payload[f];
      });
      
      const backupPackageState = { ...existingPackage };
      db.Package.update(packageId, updateData);
      tx.trackUpdate(db.Package, packageId, backupPackageState);

      // B. Update Polymorphic Courses (PackageItem Sync via clean rewrite & normalization)
      if (payload.courses !== undefined) {
        const backupItems = db.PackageItem.where({ package_id: packageId });
        tx.trackSync(db.PackageItem, { package_id: packageId }, backupItems);

        backupItems.forEach(item => db.PackageItem.remove(item.item_id));

        payload.courses.forEach(item => {
          // Normalize only: let SheetDB validate required/choices constraints
          const normalizedType = typeof item.entity_type === "string"
            ? item.entity_type.toLowerCase().trim()
            : item.entity_type;

          db.PackageItem.insert({
            package_id: packageId,
            entity_type: normalizedType,
            entity_id: item.entity_id
          });
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
  deletePackage(packageId) {
    const db = DBContext.getInstance();
    console.log(`[AcademicService] Attempting to delete Package: ${packageId}`);

    const existingPackage = db.Package.findById(packageId);
    if (!existingPackage) throw new Error(`Package with ID '${packageId}' not found.`);

    // 1. Referential Integrity Check (RESTRICT)
    const hasEnrollments = db.Enrollment.exists({ enrollment_type: "package", item_id: packageId });
    if (hasEnrollments) {
      throw new Error(`Cannot delete Package '${packageId}' because it has active student enrollments.`);
    }

    const tx = new TransactionTracker();

    try {
      // 2. Fetch all child elements to track for rollback
      const items = db.PackageItem.where({ package_id: packageId });
      const perks = db.PackagePerk.where({ package_id: packageId });

      // 3. Cascade delete PackageItems
      items.forEach(item => {
        db.PackageItem.remove(item.item_id);
        tx.trackDelete(db.PackageItem, item);
      });

      // 4. Cascade delete PackagePerks
      perks.forEach(perk => {
        db.PackagePerk.remove(perk.perk_id);
        tx.trackDelete(db.PackagePerk, perk);
      });

      // 5. Delete core Package record
      db.Package.remove(packageId);
      tx.trackDelete(db.Package, existingPackage);

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
  enrollStudent(payload) {
    const db = DBContext.getInstance();

    // Existence checks
    if (!db.Student.findById(payload.student_id)) throw new Error("Student not found.");

    console.log(`[AcademicService] Enrolling Student ${payload.student_id} into Batch/Item ${payload.course_id}`);
    return db.Enrollment.insert({
      ...payload,
      enrollment_date: payload.enrollment_date || new Date(),
      status: payload.status || "active"
    });
  }
};
