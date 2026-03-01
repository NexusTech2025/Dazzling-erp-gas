/**
 * ==============================================================
 * RepositoryTest.gs
 * ==============================================================
 *
 * Manual test runner for concrete repositories.
 * Runs inside Google Apps Script runtime.
 *
 * This is NOT a unit test framework.
 * It is a structured execution test harness.
 *
 * To run:
 *   - Open Apps Script
 *   - Select runRepositoryTests()
 *   - Execute
 * ==============================================================
 */

function runRepositoryTests() {
  try {

    Logger.log("========== Repository Tests Started ==========");

    // -----------------------------
    // Setup Infrastructure
    // -----------------------------
    const dataSource = SheetDataSource.fromActiveSpreadsheet();
    const schemaRegistry = new SchemaRegistry(DATABASE_SCHEMA);

    // -----------------------------
    // Student Repository Test
    // -----------------------------
    const studentGateway = new TableGateway(
      "Student",
      schemaRegistry,
      dataSource
    );

    const studentRepo = new StudentRepository(studentGateway);

    Logger.log("---- StudentRepository Tests ----");

    testAll(studentRepo);
    testFindById(studentRepo);
    testFindPendingFees(studentRepo);
    testCount(studentRepo);

    // -----------------------------
    // Attendance Repository Test
    // -----------------------------
    const attendanceGateway = new TableGateway(
      "Attendance",
      schemaRegistry,
      dataSource
    );

    const attendanceRepo = new AttendanceRepository(attendanceGateway);

    Logger.log("---- AttendanceRepository Tests ----");

    testAll(attendanceRepo);
    testFind(attendanceRepo, { status: "present" });

    // -----------------------------
    // Subject Repository Test
    // -----------------------------
    const subjectGateway = new TableGateway(
      "Subject",
      schemaRegistry,
      dataSource
    );

    const subjectRepo = new SubjectRepository(subjectGateway);

    Logger.log("---- SubjectRepository Tests ----");

    testAll(subjectRepo);

    // -----------------------------
    // Teacher Repository Test
    // -----------------------------
    const teacherGateway = new TableGateway(
      "Teacher",
      schemaRegistry,
      dataSource
    );

    const teacherRepo = new TeacherRepository(teacherGateway);

    Logger.log("---- TeacherRepository Tests ----");

    testAll(teacherRepo);

    // -----------------------------
    // Exam Repository Test
    // -----------------------------
    const examGateway = new TableGateway(
      "Exam",
      schemaRegistry,
      dataSource
    );

    const examRepo = new ExamRepository(examGateway);

    Logger.log("---- ExamRepository Tests ----");

    testAll(examRepo);

    // -----------------------------
    // TimeSeries Repository Test
    // -----------------------------
    const timeSeriesGateway = new TableGateway(
      "TimeSeries",
      schemaRegistry,
      dataSource
    );

    const timeSeriesRepo = new TimeSeriesRepository(timeSeriesGateway);

    Logger.log("---- TimeSeriesRepository Tests ----");

    testAll(timeSeriesRepo);

    Logger.log("========== Repository Tests Completed ==========");

  } catch (error) {
    Logger.log("❌ TEST FAILED:");
    Logger.log(error.message);
    Logger.log(error.stack);
  }
}

function displayStudents(){

  // -----------------------------
    // Setup Infrastructure
    // -----------------------------
    const dataSource = SheetDataSource.fromActiveSpreadsheet();
    const schemaRegistry = new SchemaRegistry(DATABASE_SCHEMA);

    // -----------------------------
    // Student Repository Test
    // -----------------------------
    const studentGateway = new TableGateway(
      "Student",
      schemaRegistry,
      dataSource
    );

    const studentRepo = new StudentRepository(studentGateway);

    const logger = new TableLogger({
      maxRows: 100,
      flatten: true,
      output: 'logger'
    });


    records = studentRepo.findById("STU-104")
    records = [records]
    logger.log(records)

}


function testAll(repo) {
  const result = repo.all();
  Logger.log("✔ all(): " + result.length + " records returned");
}

function testFindById(repo) {
  const all = repo.all();
  if (all.length === 0) {
    Logger.log("⚠ No records found to test findById()");
    return;
  }

  const id = all[0].id;
  const record = repo.findById(id);

  if (record) {
    Logger.log("✔ findById(): Found record with id = " + id);
  } else {
    throw new Error("findById() failed for id = " + id);
  }
}

function testFind(repo, filters) {
  const result = repo.find(filters);
  Logger.log("✔ find(): " + result.length + " records found for filter " + JSON.stringify(filters));
}

function testFindPendingFees(repo) {
  if (typeof repo.findPendingFees !== "function") {
    Logger.log("⚠ findPendingFees not available");
    return;
  }

  const result = repo.findPendingFees();
  Logger.log("✔ findPendingFees(): " + result.length + " pending students");
}

function testCount(repo) {
  const count = repo.count();
  Logger.log("✔ count(): " + count + " records counted");
}