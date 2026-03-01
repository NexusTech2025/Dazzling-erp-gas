/**
 * ==============================================================
 * Repository.gs
 * ==============================================================
 *
 * Layer: Domain Access Layer
 *
 * This module defines the BaseRepository class.
 * Concrete repositories (e.g., StudentRepository,
 * AttendanceRepository) will extend this class.
 *
 * Architectural Responsibility:
 * - Provide generic read-only data access methods
 * - Delegate execution to TableGateway
 * - Remain ORM-agnostic
 * - Remain infrastructure-agnostic
 *
 * MUST NOT:
 * - Access SpreadsheetApp
 * - Wrap domain models
 * - Resolve relations
 * - Call other repositories
 * - Contain business rules
 *
 * This layer sits between ORM (above) and TableGateway (below).
 * ==============================================================
 */

/**
 * BaseRepositoryError
 * --------------------------------------------------------------
 * Dedicated error type for repository-level failures.
 * Prevents leaking lower-layer exceptions directly upward.
 */
class BaseRepositoryError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = "BaseRepositoryError";
    this.meta = meta;
  }
}

/**
 * BaseRepository
 * --------------------------------------------------------------
 * Generic repository abstraction.
 *
 * Designed to be extended by concrete repositories.
 *
 * @example
 * class StudentRepository extends BaseRepository {}
 */
class BaseRepository {

  /**
   * @param {TableGateway} tableGateway - Gateway bound to a specific entity
   */
  constructor(tableGateway) {
    if (!tableGateway) {
      throw new BaseRepositoryError("TableGateway instance is required.");
    }

    this._gateway = tableGateway;
  }

  /**
 * Human-readable structural representation
 *
 * @returns {string}
 */
toString() {
  const repoClass = this.constructor.name;

  const gatewayClass = this._gateway
    ? this._gateway.constructor.name
    : "undefined";

  // Optional: if your TableGateway exposes entityName
  const entityName =
    this._gateway && this._gateway._entityName
      ? this._gateway._entityName
      : "unknown";

  return `[${repoClass}]
  ├─ Entity: ${entityName}
  └─ Dependencies:
       • TableGateway → ${gatewayClass}`;
}

  /**
   * Retrieve all records for the entity.
   *
   * @returns {Array<Object>} Plain row objects
   */
  all() {
    try {
      return this._gateway.getAll();
    } catch (error) {
      throw new BaseRepositoryError("Failed to retrieve all records.", {
        cause: error.message
      });
    }
  }

  /**
   * Find a single record by primary key.
   *
   * @param {any} id
   * @returns {Object|null}
   */
  findById(id) {
    if (id === undefined || id === null) {
      throw new BaseRepositoryError("Primary key value is required.");
    }

    try {
      return this._gateway.findById(id);
    } catch (error) {
      throw new BaseRepositoryError("Failed to find record by ID.", {
        id,
        cause: error.message
      });
    }
  }

  /**
   * Find records using equality filters (MVP).
   *
   * @param {Object} filters
   * @returns {Array<Object>}
   */
  find(filters = {}) {
    if (typeof filters !== "object") {
      throw new BaseRepositoryError("Filters must be an object.");
    }

    try {
      Logger.log(`Current Repository: ${this.toString()}`)
      Logger.log("table gateway: ", this._gateway)
      return this._gateway.filter(filters);
      
    } catch (error) {
      throw new BaseRepositoryError("Filtering failed.", {
        filters,
        cause: error.message
      });
    }
  }

  /**
   * Exists check (convenience method)
   *
   * @param {Object} filters
   * @returns {boolean}
   */
  exists(filters = {}) {
    const results = this.find(filters);
    return results.length > 0;
  }

  /**
   * Count records matching filters
   *
   * @param {Object} filters
   * @returns {number}
   */
  count(filters = {}) {
    return this.find(filters).length;
  }

  /**
   * Create a new record
   *
   * @param {Object} data
   * @returns {Object} The created raw record
   */
  create(data) {
    try {
      return this._gateway.insert(data);
    } catch (error) {
      throw new BaseRepositoryError("Failed to create record.", {
        cause: error.message
      });
    }
  }

  /**
   * Update an existing record
   *
   * @param {any} id
   * @param {Object} updates
   * @returns {Object} The updated raw record
   */
  update(id, updates) {
    try {
      return this._gateway.update(id, updates);
    } catch (error) {
      throw new BaseRepositoryError("Failed to update record.", {
        id,
        cause: error.message
      });
    }
  }
}

/**
 * ==============================================================
 * Future Enhancements (Post-MVP Roadmap)
 * ==============================================================
 *
 * 1. Caching Integration
 *    - Repository-level in-memory caching
 *    - Optional TTL-based cache strategy
 *
 * 2. Identity Map Support
 *    - Prevent duplicate object representations
 *    - Centralized per-request instance registry
 *
 * 3. Pagination Support
 *    - limit(offset, size)
 *    - page(pageNumber, pageSize)
 *
 * 4. Sorting Support
 *    - orderBy(field, direction)
 *
 * 5. Write Operations (Future Phase)
 *    - create(data)
 *    - update(id, data)
 *    - delete(id)
 *
 * 6. Transaction Abstraction (If Write Layer Introduced)
 *    - beginTransaction()
 *    - commit()
 *    - rollback()
 *
 * 7. Auditing Hooks
 *    - beforeQuery
 *    - afterQuery
 *    - performance logging
 *
 * 8. Query Builder Integration
 *    - Accept structured filter expressions
 *    - Support advanced operators (gt, lt, in)
 *
 * 9. Soft-Delete Pattern
 *    - Transparent filtering of deleted records
 *
 * 10. Multi-Entity Registry
 *     - Central RepositoryRegistry for ORM binding
 *
 * ==============================================================
 */

/**
 * ==============================================================
 * Concrete Repositories (SchemaV1)
 * ==============================================================
 *
 * These repositories are built based on SchemaV1.
 * They extend BaseRepository and provide domain-readable
 * query methods only.
 *
 * They MUST NOT:
 * - Access TableGateway directly
 * - Access SchemaRegistry
 * - Resolve relations
 * - Contain business rules
 * ==============================================================
 */

class StudentRepository extends BaseRepository {

  /**
   * Retrieve students belonging to a specific class.
   *
   * @param {string} className
   * @returns {Array<Object>} List of student records
   */
  findByClass(className) {
    return this.find({ class: className });
  }

  /**
   * Retrieve students belonging to a specific stream.
   *
   * @param {string} stream
   * @returns {Array<Object>} List of student records
   */
  findByStream(stream) {
    return this.find({ stream });
  }

  /**
   * Retrieve a student by roll number.
   *
   * @param {number} rollNo
   * @returns {Array<Object>} Matching student records
   */
  findByRollNumber(rollNo) {
    return this.find({ rollNo });
  }

  /**
   * Retrieve students ranked first in their class.
   *
   * @returns {Array<Object>} Top-ranked student records
   */
  findTopRankers() {
    return this.find({ rank: 1 });
  }

  /**
   * Retrieve students with pending fee status.
   *
   * @returns {Array<Object>} Students with pending fees
   */
  findPendingFees() {
    return this.find({ feeStatus: "Pending" });
  }
}

class AttendanceRepository extends BaseRepository {

  /**
   * Retrieve attendance logs for a specific student.
   *
   * @param {string} studentId
   * @returns {Array<Object>} Attendance records
   */
  findByStudentId(studentId) {
    return this.find({ student_id: studentId });
  }

  /**
   * Retrieve attendance logs for a specific date.
   *
   * @param {Date|string} date
   * @returns {Array<Object>} Attendance records
   */
  findByDate(date) {
    return this.find({ date });
  }

  /**
   * Retrieve attendance logs filtered by status.
   *
   * @param {string} status
   * @returns {Array<Object>} Attendance records
   */
  findByStatus(status) {
    return this.find({ status });
  }
}

class SubjectRepository extends BaseRepository {

  /**
   * Retrieve subject performance records for a student.
   *
   * @param {string} studentId
   * @returns {Array<Object>} Subject records
   */
  findByStudentId(studentId) {
    return this.find({ student_id: studentId });
  }

  /**
   * Retrieve subject performance by subject code.
   *
   * @param {string} subjectCode
   * @returns {Array<Object>} Subject records
   */
  findBySubjectCode(subjectCode) {
    return this.find({ subject_code: subjectCode });
  }

  /**
   * Retrieve subject performance by trend type.
   *
   * @param {string} trend
   * @returns {Array<Object>} Subject records
   */
  findByTrend(trend) {
    return this.find({ trend });
  }
}

class TeacherRepository extends BaseRepository {

  /**
   * Retrieve teachers assigned to a specific subject code.
   *
   * @param {string} subjectCode
   * @returns {Array<Object>} Teacher records
   */
  findBySubjectCode(subjectCode) {
    return this.find({ subject_code: subjectCode });
  }

  /**
   * Retrieve teachers by designation.
   *
   * @param {string} designation
   * @returns {Array<Object>} Teacher records
   */
  findByDesignation(designation) {
    return this.find({ designation });
  }
}

class ExamRepository extends BaseRepository {

  /**
   * Retrieve exams for a specific student.
   *
   * @param {string} studentId
   * @returns {Array<Object>} Exam records
   */
  findByStudentId(studentId) {
    return this.find({ student_id: studentId });
  }

  /**
   * Retrieve exams filtered by type (e.g., Mock, Unit).
   *
   * @param {string} type
   * @returns {Array<Object>} Exam records
   */
  findByType(type) {
    return this.find({ type });
  }

  /**
   * Retrieve exams filtered by status.
   *
   * @param {string} status
   * @returns {Array<Object>} Exam records
   */
  findByStatus(status) {
    return this.find({ status });
  }
}

class TimeSeriesRepository extends BaseRepository {

  /**
   * Retrieve time series performance data for a student.
   *
   * @param {string} studentId
   * @returns {Array<Object>} Time series records
   */
  findByStudentId(studentId) {
    return this.find({ student_id: studentId });
  }

  /**
   * Retrieve time series data for a specific period.
   *
   * @param {string} period
   * @returns {Array<Object>} Time series records
   */
  findByPeriod(period) {
    return this.find({ period });
  }
}

class UserRepository extends BaseRepository {
  /**
   * Find user by username.
   * @param {string} username
   * @returns {Object|null}
   */
  findByUsername(username) {
    const results = this.find({ username });
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Find users by role.
   * @param {string} role
   * @returns {Array<Object>}
   */
  findByRole(role) {
    return this.find({ role });
  }
}

class AdminRepository extends BaseRepository {
  /**
   * Find admin by user id.
   * @param {string} userId
   * @returns {Object|null}
   */
  findByUserId(userId) {
    const results = this.find({ user_id: userId });
    return results.length > 0 ? results[0] : null;
  }
}

/**
 * ==============================================================
 * Future Enhancements (Post-MVP Roadmap)
 * ==============================================================
 *
 * 1. Caching Integration
 *    - Repository-level in-memory caching
 *    - Optional TTL-based cache strategy
 *
 * 2. Identity Map Support
 *    - Prevent duplicate object representations
 *    - Centralized per-request instance registry
 *
 * 3. Pagination Support
 *    - limit(offset, size)
 *    - page(pageNumber, pageSize)
 *
 * 4. Sorting Support
 *    - orderBy(field, direction)
 *
 * 5. Write Operations (Future Phase)
 *    - create(data)
 *    - update(id, data)
 *    - delete(id)
 *
 * 6. Transaction Abstraction (If Write Layer Introduced)
 *    - beginTransaction()
 *    - commit()
 *    - rollback()
 *
 * 7. Auditing Hooks
 *    - beforeQuery
 *    - afterQuery
 *    - performance logging
 *
 * 8. Query Builder Integration
 *    - Accept structured filter expressions
 *    - Support advanced operators (gt, lt, in)
 *
 * 9. Soft-Delete Pattern
 *    - Transparent filtering of deleted records
 *
 * 10. Multi-Entity Registry
 *     - Central RepositoryRegistry for ORM binding
 *
 * ==============================================================
 */