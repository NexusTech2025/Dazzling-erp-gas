/**
 * ==============================================================
 * ORM Repository Delegation Tests (GAS-Compatible)
 * ==============================================================
 *
 * Purpose:
 * Validate architectural delegation boundaries:
 *
 * - ORM delegates to Repository (NOT TableGateway)
 * - Repository returns raw objects (NOT BaseModel)
 * - ORM performs wrapping via _wrap()
 * - findById delegation path is correct
 *
 * These tests validate architectural purity — NOT identity behavior.
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
 * Repository Delegation Tests
 * -------------------------------------------------------------- */

function runRepositoryDelegationTests() {

  Logger.log("==============================================");
  Logger.log("Running Repository Delegation Tests...");
  Logger.log("==============================================");

  /** ----------------------------------------------------------
   * REAL BOOTSTRAP (Match production wiring)
   * ---------------------------------------------------------- */

  const schemaRegistry = new SchemaRegistry(DATABASE_SCHEMA);
  const repositoryRegistry = new RepositoryRegistry();
  const orm = new ORM(schemaRegistry, repositoryRegistry);

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

  /** ----------------------------------------------------------
   * Spy Repository Wrapper
   * ---------------------------------------------------------- */

  class SpyStudentRepository extends StudentRepository {

    constructor(gateway) {
      super(gateway);
      this.findCalled = false;
      this.findByIdCalled = false;
    }

    find(filters) {
      this.findCalled = true;
      return super.find(filters);
    }

    findById(id) {
      this.findByIdCalled = true;
      return super.findById(id);
    }
  }

  const spyStudentRepo = new SpyStudentRepository(studentGateway);
  const attendanceRepo = new AttendanceRepository(attendanceGateway);

  repositoryRegistry.register("Student", spyStudentRepo);
  repositoryRegistry.register("Attendance", attendanceRepo);


  /** ----------------------------------------------------------
   * RD-01: ORM delegates fetch() to Repository.find()
   * ---------------------------------------------------------- */

  const wrappedStudents = orm.fetch("Student", {});

  assert(spyStudentRepo.findCalled === true,
    "RD-01 Failed: ORM.fetch() did not delegate to Repository.find()");

  Logger.log("✔ RD-01 Passed: ORM delegates to Repository.find()");


  /** ----------------------------------------------------------
   * RD-02: Repository returns RAW objects (NOT BaseModel)
   * ---------------------------------------------------------- */

  const rawStudents = spyStudentRepo.find({});

  if (rawStudents.length > 0) {
    assert(rawStudents[0].constructor.name === "Object",
      "RD-02 Failed: Repository returned wrapped model instead of raw object");

    Logger.log("✔ RD-02 Passed: Repository returns raw objects");
  } else {
    Logger.log("ℹ RD-02 Skipped: No student data available");
  }


  /** ----------------------------------------------------------
   * RD-03: ORM wraps results into BaseModel
   * ---------------------------------------------------------- */

  if (wrappedStudents.length > 0) {
    assert(wrappedStudents[0].constructor.name === "BaseModel",
      "RD-03 Failed: ORM did not wrap raw rows into BaseModel");

    Logger.log("✔ RD-03 Passed: ORM wraps raw rows into BaseModel");
  } else {
    Logger.log("ℹ RD-03 Skipped: No student data available");
  }


  /** ----------------------------------------------------------
   * RD-04: ORM delegates findById() correctly
   * ---------------------------------------------------------- */

  const all = wrappedStudents;

  if (all.length > 0) {
    const id = all[0].get("id");
    const model = orm.findById("Student", id);

    assert(spyStudentRepo.findByIdCalled === true,
      "RD-04 Failed: ORM.findById() did not delegate to Repository.findById()");

    assert(model.constructor.name === "BaseModel",
      "RD-04 Failed: ORM.findById() did not wrap result into BaseModel");

    Logger.log("✔ RD-04 Passed: findById delegation and wrapping correct");
  } else {
    Logger.log("ℹ RD-04 Skipped: No student data available");
  }


  Logger.log("==============================================");
  Logger.log("✅ All Repository Delegation Tests Completed");
  Logger.log("==============================================");
}
