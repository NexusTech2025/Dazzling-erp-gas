/**
 * @file TestService.js
 * Domain Service for Test and Marks Management.
 * 
 * Responsibility:
 * - Coordinates single and bulk exam logs.
 * - Enforces batch allocations, absent normalizations, and grade bounds.
 * - Computes dynamic rankings and performance metrics.
 */

const TestService = {
  _trackMutation(context, tableName) {
    if (context && context.mutationManifest && Array.isArray(context.mutationManifest)) {
      if (!context.mutationManifest.includes(tableName)) {
        context.mutationManifest.push(tableName);
      }
    }
  },

  /**
   * Schedules a new class test for a specific batch.
   * 
   * @param {Object} payload - Test definition data.
   * @param {Object} context - Unified request execution lifecycle context
   * @returns {Object} Created Test record.
   */
  createTest(payload, context) {
    const db = DBContext.getInstance();

    if (!payload.batch_id) throw new ActionValidationError("batch_id is required.");
    if (!payload.title) throw new ActionValidationError("title is required.");
    if (!payload.test_date) throw new ActionValidationError("test_date is required.");
    if (payload.total_marks === undefined || payload.total_marks === null) {
      throw new ActionValidationError("total_marks is required.");
    }

    // Verify parent Batch existence
    if (!db.Batch.findById(payload.batch_id)) {
      throw new SheetDB.EntityNotFoundError("Batch", payload.batch_id, "Academic");
    }

    const totalMarks = Number(payload.total_marks);
    const passingMarks = payload.passing_marks !== undefined && payload.passing_marks !== null ? Number(payload.passing_marks) : 0;

    const testData = {
      title: String(payload.title).trim(),
      batch_id: String(payload.batch_id).trim(),
      test_date: payload.test_date,
      total_marks: totalMarks,
      passing_marks: passingMarks,
      status: payload.status || "Draft",
      remarks: payload.remarks || null
    };

    console.log(`[TestService] Creating new Class Test: ${testData.title}`);
    const record = db.Test.insert(testData);
    this._trackMutation(context, "Test");
    return record;
  },

  /**
   * Saves student exam marks in bulk using a high-performance transaction boundary.
   * 
   * @param {Object} payload - Bulk marks dataset.
   * @param {Object} context - Unified request execution lifecycle context
   * @returns {Object} Bulk processing result.
   */
  saveTestMarksBulk(payload, context) {
    const db = DBContext.getInstance();

    if (!payload.test_id) {
      throw new ActionValidationError("test_id is required.");
    }
    if (!payload.records || !Array.isArray(payload.records)) {
      throw new ActionValidationError("records array is required.");
    }

    const testId = String(payload.test_id).trim();

    // Verify parent Test existence
    const testRecord = db.Test.findById(testId);
    if (!testRecord) {
      throw new SheetDB.EntityNotFoundError("Test", testId, "Test");
    }

    const totalMarks = testRecord.total_marks;

    // --- O(1) Optimization: Pre-load datasets ---
    // 1. Bulk load all students
    const allStudents = db.Student.all();
    const studentMap = new Map(allStudents.map(s => [s.student_id, s]));

    // 2. Bulk load active batch allocations
    const activeAllocations = db.BatchAllocation.where({
      batch_id: testRecord.batch_id,
      status: "active"
    });
    const allowedStudents = new Set(activeAllocations.map(a => a.student_id));

    // 3. Bulk load existing test marks
    const existingMarks = db.TestMarks.where({ test_id: testId });
    const existingMarksMap = new Map(existingMarks.map(m => [m.student_id, m]));

    const tx = new TransactionTracker();
    const results = [];
    const self = this;

    try {
      payload.records.forEach(rec => {
        if (!rec.student_id) {
          throw new ActionValidationError("student_id is required for each marks record.");
        }

        const studentId = String(rec.student_id).trim();
        
        // O(1) check: Student existence
        const student = studentMap.get(studentId);
        if (!student) {
          throw new SheetDB.EntityNotFoundError("Student", studentId, "Student");
        }

        // isAbsent normalization
        const isAbsent = rec.is_absent === true || rec.is_absent === "true";
        let obtainedMarks = null;
        if (!isAbsent) {
          obtainedMarks = (rec.obtained_marks !== undefined && rec.obtained_marks !== null && rec.obtained_marks !== "") ? Number(rec.obtained_marks) : null;
        }

        const markData = {
          test_id: testId,
          student_id: studentId,
          obtained_marks: obtainedMarks,
          is_absent: isAbsent,
          remarks: rec.remarks || null,
          // Cache structures for custom schema validators to use in O(1)
          __allowedStudents: allowedStudents,
          __totalMarks: totalMarks
        };

        // O(1) check: Composite unique index (test_id + student_id)
        const existing = existingMarksMap.get(studentId);
        let savedRecord;

        if (existing) {
          console.log(`[TestService] Updating marks for student: ${studentId}`);
          const backupState = { ...existing };
          savedRecord = db.TestMarks.update(existing.id, markData);
          tx.trackUpdate(db.TestMarks, existing.id, backupState);
        } else {
          console.log(`[TestService] Inserting marks for student: ${studentId}`);
          savedRecord = db.TestMarks.insert(markData);
          tx.trackInsert(db.TestMarks, savedRecord.id);
        }
        results.push(savedRecord);
        self._trackMutation(context, "TestMarks");
      });

      return {
        success: true,
        processedCount: results.length,
        records: results
      };
    } catch (err) {
      tx.rollback();
      throw err;
    }
  },

  /**
   * Compiles dynamic statistical reports for a test schedule on-the-fly.
   * 
   * @param {Object} payload - Request filters.
   * @returns {Object} Calculated test performance report.
   */
  queryTestReport(payload) {
    const db = DBContext.getInstance();

    if (!payload.test_id) {
      throw new ActionValidationError("test_id is required.");
    }

    const testId = String(payload.test_id).trim();

    const testRecord = db.Test.findById(testId);
    if (!testRecord) {
      throw new SheetDB.EntityNotFoundError("Test", testId, "Test");
    }

    const batch = db.Batch.findById(testRecord.batch_id);
    const batchName = batch ? batch.batch_name : "Unknown Batch";
    let courseName = "Unknown Course";
    if (batch && batch.course_id) {
      const course = db.Course.findById(batch.course_id);
      if (course) {
        courseName = course.name;
      }
    }

    // Load marks logs
    const marksRecords = db.TestMarks.where({ test_id: testId });

    // --- O(1) Optimization: Pre-load all students in one query ---
    const allStudents = db.Student.all();
    const studentMap = new Map(allStudents.map(s => [s.student_id, s]));

    // Dynamic hydration of relational fields & grades
    const hydratedRecords = marksRecords.map(m => {
      const student = studentMap.get(m.student_id);
      const studentName = student ? student.student_name : "Unknown Student";

      let percentage = null;
      let grade = null;

      if (!m.is_absent && m.obtained_marks !== null) {
        percentage = parseFloat(((m.obtained_marks / testRecord.total_marks) * 100).toFixed(2));
        if (percentage >= 90) grade = "A";
        else if (percentage >= 80) grade = "B";
        else if (percentage >= 70) grade = "C";
        else if (percentage >= 60) grade = "D";
        else grade = "F";
      } else {
        grade = "Absent";
      }

      return {
        id: m.id,
        test_id: m.test_id,
        student_id: m.student_id,
        student_name: studentName,
        obtained_marks: m.obtained_marks,
        is_absent: m.is_absent,
        remarks: m.remarks,
        percentage: percentage,
        grade: grade,
        rank: null // Injected below
      };
    });

    // Dynamic ranks sorted by performance (Standard Competition Ranking)
    const presentRecords = hydratedRecords
      .filter(r => !r.is_absent)
      .sort((a, b) => b.obtained_marks - a.obtained_marks);

    let currentRank = 1;
    let skipped = 0;

    for (let i = 0; i < presentRecords.length; i++) {
      const current = presentRecords[i];
      if (i > 0 && current.obtained_marks < presentRecords[i - 1].obtained_marks) {
        currentRank += skipped + 1;
        skipped = 0;
      } else if (i > 0 && current.obtained_marks === presentRecords[i - 1].obtained_marks) {
        skipped++;
      }
      current.rank = currentRank;
    }

    const rankMap = {};
    presentRecords.forEach(r => {
      rankMap[r.student_id] = r.rank;
    });

    hydratedRecords.forEach(r => {
      if (r.is_absent) {
        r.rank = "Absent";
      } else {
        r.rank = rankMap[r.student_id] || null;
      }
    });

    // Aggregate statistics
    const totalCount = hydratedRecords.length;
    const presentCount = presentRecords.length;
    const absentCount = totalCount - presentCount;

    let highestMarks = null;
    let lowestMarks = null;
    let averageMarks = null;
    let passPercentage = 0;
    let failPercentage = 0;
    let absentPercentage = 0;
    let toppers = [];

    if (totalCount > 0) {
      absentPercentage = parseFloat(((absentCount / totalCount) * 100).toFixed(2));
    }

    if (presentCount > 0) {
      highestMarks = Math.max(...presentRecords.map(r => r.obtained_marks));
      lowestMarks = Math.min(...presentRecords.map(r => r.obtained_marks));
      
      const sumMarks = presentRecords.reduce((sum, r) => sum + r.obtained_marks, 0);
      averageMarks = parseFloat((sumMarks / presentCount).toFixed(2));

      const passCount = presentRecords.filter(r => r.obtained_marks >= testRecord.passing_marks).length;
      const failCount = presentCount - passCount;

      passPercentage = parseFloat(((passCount / totalCount) * 100).toFixed(2));
      failPercentage = parseFloat(((failCount / totalCount) * 100).toFixed(2));
      
      toppers = presentRecords
        .filter(r => r.obtained_marks === highestMarks)
        .map(r => ({
          student_id: r.student_id,
          student_name: r.student_name,
          obtained_marks: r.obtained_marks
        }));
    }

    return {
      test: {
        id: testRecord.id,
        title: testRecord.title,
        batch_id: testRecord.batch_id,
        batch_name: batchName,
        course_name: courseName,
        test_date: testRecord.test_date,
        total_marks: testRecord.total_marks,
        passing_marks: testRecord.passing_marks,
        status: testRecord.status,
        remarks: testRecord.remarks
      },
      stats: {
        total_students: totalCount,
        present_students: presentCount,
        absent_students: absentCount,
        highest_marks: highestMarks,
        lowest_marks: lowestMarks,
        average_marks: averageMarks,
        pass_percentage: passPercentage,
        fail_percentage: failPercentage,
        absent_percentage: absentPercentage,
        toppers: toppers
      },
      records: hydratedRecords
    };
  }
};

// Bind to global scope for Google Apps Script execution context
globalThis.TestService = TestService;
