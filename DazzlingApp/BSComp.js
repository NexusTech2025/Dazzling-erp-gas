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
 * - Heavy structural components are created once (lazy global)
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
 * LAZY GLOBAL REGISTRIES
 * --------------------------------------------------------------
 * Using getters to prevent ReferenceErrors during initial load.
 * Google Apps Script file loading order can be unpredictable.
 */

let _GLOBAL_SCHEMA_REGISTRY = null;
function getGlobalSchemaRegistry() {
  if (!_GLOBAL_SCHEMA_REGISTRY) {
    _GLOBAL_SCHEMA_REGISTRY = buildSchemaRegistry();
  }
  return _GLOBAL_SCHEMA_REGISTRY;
}

let _GLOBAL_REPOSITORY_REGISTRY = null;
function getGlobalRepositoryRegistry() {
  if (!_GLOBAL_REPOSITORY_REGISTRY) {
    _GLOBAL_REPOSITORY_REGISTRY = buildRepositoryRegistry(getGlobalSchemaRegistry());
  }
  return _GLOBAL_REPOSITORY_REGISTRY;
}


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
  return new SchemaRegistry(DATABASE_SCHEMA);
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
  const dataSource = SheetDataSource.fromActiveSpreadsheet();

  const entities = [
    { name: "Student", repo: StudentRepository },
    { name: "Attendance", repo: AttendanceRepository },
    { name: "Subject", repo: SubjectRepository },
    { name: "Teacher", repo: TeacherRepository },
    { name: "Exam", repo: ExamRepository },
    { name: "TimeSeries", repo: TimeSeriesRepository },
    { name: "User", repo: UserRepository },
    { name: "Admin", repo: AdminRepository }
  ];

  entities.forEach(entity => {
    const gateway = new TableGateway(entity.name, schemaRegistry, dataSource);
    const repoInstance = new entity.repo(gateway);
    repositoryRegistry.register(entity.name, repoInstance);
  });

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
    getGlobalSchemaRegistry(),
    getGlobalRepositoryRegistry()
  );

  // Initialize AuthService
  const userRepo = getGlobalRepositoryRegistry().get("User");
  const authService = new AuthService(userRepo, orm);
  
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
