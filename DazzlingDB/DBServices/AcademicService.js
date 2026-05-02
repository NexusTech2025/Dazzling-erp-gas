/**
 * @file AcademicService.js
 * Domain Service for Curriculum and Batch Management.
 */

/**
 * 🏛️ ACADEMIC ERROR HIERARCHY
 */
class AcademicBaseError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }
}

class AcademicValidationError extends AcademicBaseError {}
class AcademicIntegrityError extends AcademicBaseError {}

class MissingSegmentIdError extends AcademicValidationError {}
class CourseTypeNotFoundError extends AcademicIntegrityError {}
class TeacherNotFoundError extends AcademicIntegrityError {}
class BranchNotFoundError extends AcademicIntegrityError {}
class CourseNotFoundError extends AcademicIntegrityError {
    constructor(message, context) {
        super(message || "The specified Course ID does not exist.", context);
    }
}
class PackageOrchestrationError extends AcademicBaseError {}

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
      throw new MissingSegmentIdError("Course creation failed: 'segment_id' is required.");
    }

    // Health Check: Ensure CourseType exists
    const segment = db.CourseType.findById(payload.segment_id);
    if (!segment) {
      throw new CourseTypeNotFoundError(`Invalid segment_id: ${payload.segment_id}. No such CourseType exists.`);
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
    if (!db.Course.findById(payload.item_id)) {
      throw new CourseNotFoundError(null, { item_id: payload.item_id });
    }

    // 2. Verify Teacher (Cross-Category Check: Staff)
    if (payload.teacher_id && !db.Teacher.findById(payload.teacher_id)) {
      throw new TeacherNotFoundError(`Assigned Teacher ID '${payload.teacher_id}' was not found in the Staff registry.`, { teacher_id: payload.teacher_id });
    }

    // 3. Verify Branch (Cross-Category Check: Staff)
    if (payload.branch_id && !db.Branch.findById(payload.branch_id)) {
      throw new BranchNotFoundError(`Branch ID '${payload.branch_id}' is invalid.`, { branch_id: payload.branch_id });
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
   * Leverages SheetDB's insertOne() for bulk persistence.
   */
  createPackage(payload) {
    const db = DBContext.getInstance();
    console.log(`[AcademicService] Orchestrating Bulk Package: ${payload.name}`);

    try {
      return db.Package.insertOne(payload);
    } catch (error) {
      throw new PackageOrchestrationError(`Bulk Package creation failed: ${error.message}`, { originalError: error });
    }
  },

  /**
   * Enrolls a student into a specific batch or course.
   */
  enrollStudent(payload) {
    const db = DBContext.getInstance();
    
    // Existence checks
    if (!db.Student.findById(payload.student_id)) throw new Error("Student not found.");
    
    console.log(`[AcademicService] Enrolling Student ${payload.student_id} into Batch/Item ${payload.item_id}`);
    return db.Enrollment.insert({
      ...payload,
      enrollment_date: payload.enrollment_date || new Date(),
      status: payload.status || "active"
    });
  }
};
