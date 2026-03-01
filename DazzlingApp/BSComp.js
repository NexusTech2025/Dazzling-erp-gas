/**
 * ==============================================================
 * Bootstrap_CompositionRoot.gs
 * ==============================================================
 *
 * Architecture Pattern:
 * --------------------------------------------------------------
 * Global Static Wiring + Per-Request ORM Instance
 *
 * This module acts as the Composition Root of the application.
 *
 * Design Goals:
 * --------------------------------------------------------------
 * - Heavy structural components are created once (global)
 * - ORM instance is created per request
 * - IdentityMap remains request-scoped
 * - No cross-request state leakage
 *
 * Structural (Safe to Share Globally):
 *   - SchemaRegistry (immutable metadata)
 *   - RepositoryRegistry (repository mapping)
 *   - TableGateway instances
 *   - Repository instances
 *
 * Runtime (Per Request):
 *   - ORM instance
 *   - IdentityMap (inside ORM)
 *   - LazyRelationResolver (inside ORM)
 *
 * ==============================================================
 */


/**
 * --------------------------------------------------------------
 * GLOBAL STRUCTURAL WIRING (Executed Once)
 * --------------------------------------------------------------
 *
 * These objects are immutable and safe to reuse.
 */

// 1️⃣ Schema Registry (Structural Metadata)
const GLOBAL_SCHEMA_REGISTRY = buildSchemaRegistry();

// 2️⃣ Repository Registry (Repository Mapping)
const GLOBAL_REPOSITORY_REGISTRY = buildRepositoryRegistry(GLOBAL_SCHEMA_REGISTRY);


/**
 * --------------------------------------------------------------
 * buildSchemaRegistry()
 * --------------------------------------------------------------
 *
 * Responsible for:
 * - Loading DATABASE_SCHEMA
 * - Creating SchemaRegistry instance
 * - Freezing metadata structure
 */
function buildSchemaRegistry() {
  const registry = new SchemaRegistry(DATABASE_SCHEMA);
  return registry;
}


/**
 * --------------------------------------------------------------
 * buildRepositoryRegistry(schemaRegistry)
 * --------------------------------------------------------------
 *
 * Responsible for:
 * - Creating TableGateway per entity
 * - Creating Repository per entity
 * - Registering repository inside RepositoryRegistry
 *
 * IMPORTANT:
 * Repositories must remain ORM-agnostic.
 */
function buildRepositoryRegistry(schemaRegistry) {
  const repositoryRegistry = new RepositoryRegistry();
  const dataSource = SheetDataSource.fromActiveSpreadsheet()

  // Student
  const studentGateway = new TableGateway("Student", schemaRegistry, dataSource);
  const studentRepo = new StudentRepository(studentGateway);
  repositoryRegistry.register("Student", studentRepo);

  // Attendance
  const attendanceGateway = new TableGateway("Attendance", schemaRegistry, dataSource);
  const attendanceRepo = new AttendanceRepository(attendanceGateway);
  repositoryRegistry.register("Attendance", attendanceRepo);

  // Subject
  const subjectGateway = new TableGateway("Subject", schemaRegistry, dataSource);
  const subjectRepo = new SubjectRepository(subjectGateway);
  repositoryRegistry.register("Subject", subjectRepo);

  // Teacher
  const teacherGateway = new TableGateway("Teacher", schemaRegistry, dataSource);
  const teacherRepo = new TeacherRepository(teacherGateway);
  repositoryRegistry.register("Teacher", teacherRepo);

  // Exam
  const examGateway = new TableGateway("Exam", schemaRegistry, dataSource);
  const examRepo = new ExamRepository(examGateway);
  repositoryRegistry.register("Exam", examRepo);

  // TimeSeries
  const timeSeriesGateway = new TableGateway("TimeSeries", schemaRegistry, dataSource);
  const timeSeriesRepo = new TimeSeriesRepository(timeSeriesGateway);
  repositoryRegistry.register("TimeSeries", timeSeriesRepo);

  // User
  const userGateway = new TableGateway("User", schemaRegistry, dataSource);
  const userRepo = new UserRepository(userGateway);
  repositoryRegistry.register("User", userRepo);

  // Admin
  const adminGateway = new TableGateway("Admin", schemaRegistry, dataSource);
  const adminRepo = new AdminRepository(adminGateway);
  repositoryRegistry.register("Admin", adminRepo);

  return repositoryRegistry;
}


/**
 * --------------------------------------------------------------
 * bootstrapORM()
 * --------------------------------------------------------------
 *
 * Per-request ORM factory.
 *
 * Responsibilities:
 * - Create fresh ORM instance
 * - Ensure IdentityMap is clean per request
 * - Attach global structural registries
 *
 * NEVER reuse ORM instance globally.
 */
function bootstrapORM() {
  const orm = new ORM(
    GLOBAL_SCHEMA_REGISTRY,
    GLOBAL_REPOSITORY_REGISTRY
  );

  // Initialize AuthService with UserRepository and the ORM instance
  const userRepo = GLOBAL_REPOSITORY_REGISTRY.get("User");
  const authService = new AuthService(userRepo, orm);
  
  // Attach authService to orm for access within Actions
  orm.setAuthService(authService);

  return orm;
}


/**
 * ==============================================================
 * Architectural Summary
 * ==============================================================
 *
 * Global:
 *   SchemaRegistry
 *   RepositoryRegistry
 *   TableGateway instances
 *   Repository instances
 *
 * Per Request:
 *   ORM
 *   IdentityMap
 *   LazyRelationResolver
 *
 * This guarantees:
 *   - Performance optimization
 *   - Memory stability
 *   - No cross-request contamination
 *   - Clean separation of structure vs runtime state
 *
 * ==============================================================
 */
