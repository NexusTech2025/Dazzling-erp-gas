/**
 * ==============================================================
 * ORM IdentityMap Behavioral Tests (GAS-Compatible)
 * ==============================================================
 *
 * Purpose:
 * Validate IdentityMap correctness using REAL SchemaRegistry
 * and REAL Repositories.
 *
 * This version fixes improper repository bootstrapping.
 * BaseRepository requires a REAL TableGateway (not SchemaRegistry).
 * ==============================================================
 */


/** --------------------------------------------------------------
 * Assertion Utility
 * -------------------------------------------------------------- */

function assert(condition, message) {
  if (!condition) {
    throw new Error("Assertion Failed: " + message);
  }
}


/** --------------------------------------------------------------
 * IdentityMap Behavioral Tests (REAL SYSTEM)
 * -------------------------------------------------------------- */

function runIdentityMapBehavioralTests() {
  Logger.log("==============================================");
  Logger.log("Running IdentityMap Behavioral Tests (REAL)...");
  Logger.log("==============================================");

  /** ----------------------------------------------------------
   * REAL BOOTSTRAP (MATCH PRODUCTION EXACTLY)
   * ---------------------------------------------------------- */

  const schemaRegistry = new SchemaRegistry(DATABASE_SCHEMA);
  const repositoryRegistry = new RepositoryRegistry();

  // ORM must be created BEFORE repositories if repositories
  // require ORM injection inside BaseRepository
  const orm = new ORM(schemaRegistry, repositoryRegistry);

  // -----------------------------------------------------------
  // REAL INFRASTRUCTURE (Adjust if constructor differs)
  // -----------------------------------------------------------

  const dataSource = SheetDataSource.fromActiveSpreadsheet();

  const studentGateway = new TableGateway(
    "Student",
    schemaRegistry,
    dataSource
  );

  const attendanceGateway = new TableGateway(
    "Attendance",
    schemaRegistry,
    dataSource
  );

  // IMPORTANT:
  // BaseRepository signature is typically:
  // constructor(tableGateway, entityName, orm)

  const studentRepo = new StudentRepository(
    studentGateway,
    "Student",
    orm
  );

  const attendanceRepo = new AttendanceRepository(
    attendanceGateway,
    "Attendance",
    orm
  );

  repositoryRegistry.register("Student", studentRepo);
  repositoryRegistry.register("Attendance", attendanceRepo);


  /** ----------------------------------------------------------
   * PRECONDITION: Ensure at least one Student exists
   * ---------------------------------------------------------- */

  const allStudents = orm.fetch("Student", {});

  assert(allStudents.length > 0,
    "Precondition failed: No students found in sheet");

  Logger.log(`✔ Number of ${allStudents.length} found`);

  const studentId = allStudents[0].get("id");


  /** ----------------------------------------------------------
   * TEST 1: No duplicate model instances
   * ---------------------------------------------------------- */

  const s1 = orm.findById("Student", studentId);
  const s2 = orm.findById("Student", studentId);

  assert(s1 === s2,
    "IdentityMap failure: Duplicate Student instances detected");

  Logger.log("✔ No duplicate model instances test passed");


  /** ----------------------------------------------------------
   * TEST 2: Graph consistency through real lazy relations
   * ---------------------------------------------------------- */

  const attendanceRecords = orm.resolveRelation(s1, "attendance");

  Logger.log("Attendance Records: ", attendanceRecords.toString())
  Logger.log(attendanceRecords)

  if (attendanceRecords && attendanceRecords.length > 0) {

    const backReference = orm.resolveRelation(
      attendanceRecords[0],
      "student"
    );

    assert(backReference === s1,
      "Graph consistency failure: attendance.student did not return same Student instance");

    Logger.log("✔ Graph consistency test passed");
  } else {
    Logger.log("ℹ No attendance records found — graph consistency skipped");
  }


  /** ----------------------------------------------------------
   * TEST 3: Lifecycle reset (clear())
   * ---------------------------------------------------------- */

  orm.clear();

  const s3 = orm.findById("Student", studentId);

  assert(s3 !== s1,
    "Lifecycle reset failure: Instance reused after clear()");

  Logger.log("✔ Lifecycle reset test passed");


  Logger.log("==============================================");
  Logger.log("✅ All IdentityMap Behavioral Tests Passed");
  Logger.log("==============================================");
}
