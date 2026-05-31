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
    _config: {
      allowAutoOverride: config.allowAutoOverride === true,
      ...config
    },

    // Setup Engine Access (Now wired to dataSource for cache sync)
    setup: new SchemaSetupEngine(fs, schema, registry, dataSource, config),

    // Relation Resolver
    _resolver: null, // Will be wired below
    _pkCache: null  // Will be wired below
  };

  /**
   * Manually purge the spreadsheet cache.
   */
  db.purge = () => {
    dataSource.purgeCache();
    if (db._pkCache) db._pkCache.clear();
  };

  // 3. Prepare the Relation Resolver & PrimaryKeyCache
  db._pkCache = new PrimaryKeyCache(db);
  db._resolver = new RelationResolver(db, registry);

  // 4. Initialize Dynamic Model Registry
  ModelRegistry.initialize(schema);

  // 5. Dynamic Repository Generation
  // Loop through all tables and attach repositories to the 'db' object
  const tableNames = registry.listAllTables();
  
  tableNames.forEach(tableName => {
    // Create a dedicated gateway for this table, passing db context
    const gateway = new TableGateway(tableName, registry, dataSource, db);
    
    // Create and attach the repository
    // Example: db.Student = new DynamicRepository(...)
    db[tableName] = new DynamicRepository(tableName, gateway, registry, db._resolver);
  });

  // 6. Utility Methods on the Facade
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
  BaseModel: globalThis.BaseModel,
  ModelRegistry: globalThis.ModelRegistry,
  FieldMapper: globalThis.FieldMapper,
  ValidationRegistry: globalThis.ValidationRegistry,
  PolymorphicRegistry: globalThis.PolymorphicRegistry,
  PrimaryKeyCache: globalThis.PrimaryKeyCache,
  isDate: globalThis.isDate,
  
  // Relations OOP Classes
  BaseRelation: globalThis.BaseRelation,
  BelongsToRelation: globalThis.BelongsToRelation,
  HasManyRelation: globalThis.HasManyRelation,
  HasOneRelation: globalThis.HasOneRelation,
  BelongsToPolymorphicRelation: globalThis.BelongsToPolymorphicRelation,
  RelationResolver: globalThis.RelationResolver,
  
  diagnoseTable: globalThis.diagnoseTable,
  SheetDBError: globalThis.SheetDBError,
  SpreadsheetNotFoundError: globalThis.SpreadsheetNotFoundError,
  TableNotFoundError: globalThis.TableNotFoundError,
  EntityNotFoundError: globalThis.EntityNotFoundError,
  ValidationError: globalThis.ValidationError,
  FieldError: globalThis.FieldError,
  ConflictError: globalThis.ConflictError,
  IntegrityError: globalThis.IntegrityError,
  ForbiddenError: globalThis.ForbiddenError,
  
  // Custom Validation & Relational Errors
  ValidationRegistryError: globalThis.ValidationRegistryError,
  ValidationRegistryLockedError: globalThis.ValidationRegistryLockedError,
  ValidatorRegistrationError: globalThis.ValidatorRegistrationError,
  ValidatorNotFoundError: globalThis.ValidatorNotFoundError,
  ValidatorExecutionError: globalThis.ValidatorExecutionError,
  RelationError: globalThis.RelationError,
  RelationResolutionError: globalThis.RelationResolutionError,
  RelationValidationError: globalThis.RelationValidationError
});

