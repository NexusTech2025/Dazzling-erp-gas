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

  /**
   * Complete structural sweep to purge an entire physical spreadsheet file's data payload.
   * Keeps row 1 headers pristine and synchronizes memory state globally.
   * @param {string} categoryName - The logical category/spreadsheet file to clear.
   */
  db.purgeSpreadSheet = (categoryName) => {
    if (!categoryName) {
      throw new InvalidArgumentError("[Purge] Category name is required to execute spreadsheet purge.");
    }
    console.log(`[SheetDB] Initiating atomic workbook purge sequence for: ${categoryName}`);

    // 1. Execute advanced low-level REST clear sweep 
    dataSource.purgeWorkbookBatch(categoryName);

    // 2. Clear request-level O(1) PrimaryKeyCache for affected tables
    console.log(`[SheetDB] Post-purge cleaning of relational index maps...`);
    const tableNames = registry.listAllTables();
    tableNames.forEach(tableName => {
      const tableCategory = registry.getCategoryForTable(tableName);
      if (tableCategory === categoryName) {
        // Evict cached memory indexes to avoid state tracking synchronization issues
        db._pkCache.invalidate(tableName);
      }
    });

    // 3. Flush mutations down to physical sheets & invalidate global metadata cache layers
    SpreadsheetApp.flush();
    db.purge(); // Invalidates low-level RAM row snapshots
    console.log(`[SheetDB] Workbook '${categoryName}' successfully purged and cache records synchronized.`);
  };

  /**
   * Advanced precision purge controller. Orchestrates high-performance data clears
   * across selected workbooks while ensuring table-level exclusion isolation.
   * @param {Object} options - Configuration arguments.
   * @returns {Object} Telemetry execution trace log mapping mutated categories, skipped tables, and errors.
   */
  db.purgeDatabaseAdvanced = function(options = {}) {
    const purgeAll = options.purgeAll === true;
    const selectPurge = Array.isArray(options.selectPurge) ? options.selectPurge : [];
    
    // Normalize excludeTables payload type boundaries (Mitigates Edge Case 3)
    const rawExclusions = options.excludeTables && typeof options.excludeTables === 'object' && !Array.isArray(options.excludeTables) 
      ? options.excludeTables 
      : {};

    console.log("[SheetDB] Initializing advanced purge sequencing parameters...");

    // 1. Resolve Target Category Workbook Boundaries (Precedence Processing)
    let targetCategories = [];
    if (selectPurge.length > 0) {
      targetCategories = selectPurge;
      console.log(`[SheetDB] Priority Route: Targeted execution locked onto workbooks:`, targetCategories);
    } else if (purgeAll) {
      const allTables = registry.listAllTables();
      const uniqueCategories = new Set();
      allTables.forEach(t => uniqueCategories.add(registry.getCategoryForTable(t)));
      targetCategories = Array.from(uniqueCategories);
      console.log(`[SheetDB] Fallback Route: Global database flush authorized across categories:`, targetCategories);
    } else {
      console.warn("[SheetDB] Operational Intercept: purgeAll is false and selectPurge is empty. Zero-mutation escape triggered.");
      return { mutated_categories: [], skipped_tables: [], execution_errors: [] };
    }

    const telemetryTrace = { mutated_categories: [], skipped_tables: [], execution_errors: [] };

    // 2. Iterate across verified workbook scopes safely using localized catch perimeters
    targetCategories.forEach(categoryName => {
      try {
        const allTables = registry.listAllTables();
        const tablesInWorkbook = allTables.filter(t => registry.getCategoryForTable(t) === categoryName);
        
        if (tablesInWorkbook.length === 0) return;

        const exclusionList = Array.isArray(rawExclusions[categoryName]) ? rawExclusions[categoryName] : [];
        const purgeManifest = [];

        tablesInWorkbook.forEach(tableName => {
          if (exclusionList.includes(tableName)) {
            console.log(`[Purge Isolation] Bypassing target table data write: '${categoryName}.${tableName}'`);
            telemetryTrace.skipped_tables.push(`${categoryName}.${tableName}`);
            return;
          }
          purgeManifest.push(tableName);
        });

        // 3. Isolated Delegation Loop execution (Mitigates Edge Case 1)
        if (purgeManifest.length > 0) {
          console.log(`[SheetDB] Sending REST API batchClear range for category '${categoryName}' tables:`, purgeManifest);
          dataSource.purgeTablesBatch(categoryName, purgeManifest);

          // 4. Invalidate structural O(1) row memory indices immediately to prevent pointer mismatch drift
          purgeManifest.forEach(tableName => {
            db._pkCache.invalidate(tableName);
          });
          
          telemetryTrace.mutated_categories.push({
            category: categoryName,
            purged_tables: purgeManifest
          });
        }
      } catch (categoryError) {
        console.error(`[SheetDB] Catastrophic processing block encountered on Category '${categoryName}':`, categoryError.message);
        telemetryTrace.execution_errors.push({
          category: categoryName,
          error: categoryError.message
        });
      }
    });

    // 5. Force script flush down to cell endpoints and invalidate local model memory arrays
    SpreadsheetApp.flush();
    db.purge();

    return telemetryTrace;
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
  ForeignKeyField: globalThis.ForeignKeyField,
  isDate: globalThis.isDate,
  SheetDBDateTime: globalThis.SheetDBDateTime,
  DateComparator: globalThis.DateComparator,
  DateComparisonPolicy: globalThis.DateComparisonPolicy,
  
  // Relations OOP Classes
  BaseRelation: globalThis.BaseRelation,
  BelongsToRelation: globalThis.BelongsToRelation,
  HasManyRelation: globalThis.HasManyRelation,
  HasOneRelation: globalThis.HasOneRelation,
  BelongsToPolymorphicRelation: globalThis.BelongsToPolymorphicRelation,
  RelationResolver: globalThis.RelationResolver,
  
  diagnoseTable: globalThis.diagnoseTable,
  SheetDBError: globalThis.SheetDBError,
  SystemError: globalThis.SystemError,
  DependencyGraphError: globalThis.DependencyGraphError,
  SpreadsheetNotFoundError: globalThis.SpreadsheetNotFoundError,
  TableNotFoundError: globalThis.TableNotFoundError,
  EntityNotFoundError: globalThis.EntityNotFoundError,
  ValidationError: globalThis.ValidationError,
  FieldError: globalThis.FieldError,
  ConflictError: globalThis.ConflictError,
  IntegrityError: globalThis.IntegrityError,
  ForbiddenError: globalThis.ForbiddenError,
  SheetDBEngineError: globalThis.SheetDBEngineError,
  ResourceNotFoundError: globalThis.ResourceNotFoundError,
  PlatformQuotasExhaustedException: globalThis.PlatformQuotasExhaustedException,
  MultiStorageCoordinator: globalThis.MultiStorageCoordinator,
  AdvancedRestDriver: globalThis.AdvancedRestDriver,
  InvalidArgumentError: globalThis.InvalidArgumentError,
  StorageEngineError: globalThis.StorageEngineError,
  
  // Custom Validation & Relational Errors
  ValidationRegistryError: globalThis.ValidationRegistryError,
  ValidationRegistryLockedError: globalThis.ValidationRegistryLockedError,
  ValidatorRegistrationError: globalThis.ValidatorRegistrationError,
  ValidatorNotFoundError: globalThis.ValidatorNotFoundError,
  ValidatorExecutionError: globalThis.ValidatorExecutionError,
  RelationError: globalThis.RelationError,
  RelationResolutionError: globalThis.RelationResolutionError,
  RelationValidationError: globalThis.RelationValidationError,
  BatchDeleteError: globalThis.BatchDeleteError,
  DynamicRepository: globalThis.DynamicRepository,
  
  Graph: (globalThis.Graph = {
    StaticNode: globalThis.StaticNode,
    StaticEdge: globalThis.StaticEdge,
    StaticGraph: globalThis.StaticGraph,
    StaticGraphBuilder: globalThis.StaticGraphBuilder,
    GraphNode: globalThis.GraphNode,
    GraphEdge: globalThis.GraphEdge,
    DynamicGraph: globalThis.DynamicGraph,
    DynamicGraphBuilder: globalThis.DynamicGraphBuilder,
    DeletionValidationRegistry: globalThis.DeletionValidationRegistry
  })
});

