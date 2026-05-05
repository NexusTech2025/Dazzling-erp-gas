/**
 * @file index.js
 * The Primary Facade for the SheetDB Library.
 * 
 * Responsibility:
 * - Bootstraps the entire database ecosystem.
 * - Dynamically generates repositories for every table in the schema.
 * - Provides the high-level API for application-wide consumption.
 */

/**
 * @file index.js
 * The Primary Facade for the SheetDB Library.
 * 
 * Responsibility:
 * - Bootstraps the entire database ecosystem.
 * - Dynamically generates repositories for every table in the schema.
 * - Provides the high-level API for application-wide consumption.
 */

/**
 * Initializes the Database Engine.
 * 
 * @param {string} rootFolderId - Google Drive Folder ID for spreadsheets.
 * @param {Object} schema - Canonical Database Schema V1 JSON.
 * @param {Object} config - Execution configuration (optional).
 * @returns {Object} An active database instance with dynamic repositories.
 */
function init(rootFolderId, schema, config = {}) {
  console.log(`[SheetDB] Initializing Database: ${schema.database} (v${schema.version})`);

  // 1. Core Infrastructure
  const fs = new SpreadsheetFileSystem(rootFolderId);
  const registry = new SchemaRegistry(schema);
  const dataSource = new SheetDataSource(fs);
  
  // 2. The Database Facade (The 'db' object)
  const db = {
    _fs: fs,
    _registry: registry,
    _dataSource: dataSource,
    _schema: schema,

    // Setup Engine Access
    setup: new SchemaSetupEngine(fs, schema, registry, config),

    // Relation Resolver
    _resolver: null // Will be wired below
  };
  // 3. Prepare the Relation Resolver
  db._resolver = new RelationResolver(db, registry);

  // 4. Dynamic Repository Generation
  // Loop through all tables and attach repositories to the 'db' object
  const tableNames = registry.listAllTables();
  
  tableNames.forEach(tableName => {
    // Create a dedicated gateway for this table
    const gateway = new TableGateway(tableName, registry, dataSource);
    
    // Create and attach the repository
    // Example: db.Student = new DynamicRepository(...)
    db[tableName] = new DynamicRepository(tableName, gateway, registry, db._resolver);
  });

  // 5. Utility Methods on the Facade
  db.resolve = (model, relation) => db._resolver.resolve(model, relation);

  console.log(`[SheetDB] Success: ${tableNames.length} repositories generated.`);
  return db;
}

// ==========================================
// 🔵 PUBLIC API MANIFEST
// ==========================================
Object.assign(globalThis, {
  /**
   * Primary entry point for the SheetDB ecosystem.
   */
  init,

  // --- Core Classes (Injected for Library Visibility) ---
  SheetDBError,
  SpreadsheetNotFoundError,
  TableNotFoundError,
  EntityNotFoundError,
  ValidationError,
  ConflictError,
  IntegrityError,
  ForbiddenError
});

