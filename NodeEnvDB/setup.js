/**
 * @file setup.js
 * Primary compiler and initialization entry point for NodeEnvDB.
 * Orchestrates Mock GAS and Mock database context initialization,
 * and provides global file-loading helpers.
 */
const fs = require('fs');
const path = require('path');
const { mockGAS } = require('./MockGAS');
const { setupMockDBContext } = require('./MockDBContext');

const workspaceRoot = path.resolve(__dirname, '..');

/**
 * Loads a JavaScript source file from the workspace into Node's global execution context.
 * @param {string} relativePath - Path relative to the workspace root.
 */
function loadSourceFile(relativePath) {
  const filePath = path.join(workspaceRoot, relativePath);
  let code = fs.readFileSync(filePath, 'utf8');
  if (relativePath === 'DazzlingDB/Code.js') {
    code += `
      globalThis.registerDatabaseValidators = registerDatabaseValidators;
      globalThis.registerPolymorphicMappings = registerPolymorphicMappings;
    `;
  }
  global.eval(code);
}

/**
 * Bootstraps the entire virtual Google Apps Script & SheetDB environment inside Node.js.
 */
function bootstrapVirtualEnv() {
  // 1. Initialize Mock Google Apps Script API services
  mockGAS();

  // 2. Read and concatenate all primary SheetDB source files in sequence to share lexical scope
  const filesToLoad = [
    // 1. Utils
    'SheetDB/Utils/Utils.js',
    'SheetDB/Utils/SyncPromise.js',
    'SheetDB/Utils/DateCmp.js',
    
    // 2. Errors
    'SheetDB/Errors.js',
    
    // 3. Validation
    'SheetDB/Validation/ValidationRules.js',
    'SheetDB/Validation/ValidationPipeline.js',
    
    // 4. Registries
    'SheetDB/Registries/Registries.js',
    'SheetDB/Registries/ValidationRegistry.js',
    'SheetDB/Registries/PolymorphicRegistry.js',
    'SheetDB/Registries/PrimaryKeyCache.js',
    
    // 5. ORM Core & Fields
    'SheetDB/ORM/Fields.js',
    'SheetDB/SchemaDriver/FieldMapper.js',
    'SheetDB/ORM/BaseModel.js',
    'SheetDB/Registries/ModelRegistry.js',
    
    // 6. ORM Relations
    'SheetDB/ORM/Relations/BaseRelation.js',
    'SheetDB/ORM/Relations/BelongsToRelation.js',
    'SheetDB/ORM/Relations/BelongsToPolymorphicRelation.js',
    'SheetDB/ORM/Relations/HasOneRelation.js',
    'SheetDB/ORM/Relations/HasManyRelation.js',
    'SheetDB/ORM/RelationResolver.js',
    
    // 7. Repositories
    'SheetDB/Repositories/BatchBucket.js',
    'SheetDB/Repositories/DynamicRepository.js',
    
    // 8. Graph & Constraints Validation
    'SheetDB/Graph/StaticNode.js',
    'SheetDB/Graph/StaticEdge.js',
    'SheetDB/Graph/StaticGraph.js',
    'SheetDB/Graph/GraphNode.js',
    'SheetDB/Graph/GraphEdge.js',
    'SheetDB/Graph/DynamicGraph.js',
    'SheetDB/Graph/DynamicGraphBuilder.js',
    'SheetDB/Graph/DeletionValidationRegistry.js',
    
    // 9. Transactions
    'SheetDB/Transactions/PipelineContext.js',
    'SheetDB/Transactions/TransactionTracker.js',
    'SheetDB/Transactions/AtomicPipeline.js',
    
    // 10. SchemaDriver
    'SheetDB/SchemaDriver/SchemaValidator.js',
    'SheetDB/SchemaDriver/SchemaInspector.js',
    'SheetDB/SchemaDriver/Validate.js',
    'SheetDB/SchemaDriver/MultiStorageCoordinator.js',
    'SheetDB/SchemaDriver/SchemaSetupEngine.js',
    
    // 11. Api
    'SheetDB/Api/GenericActions.js',
    
    // 12. Primary Engine Facade
    'SheetDB/index.js'
  ];

  let concatenatedCode = '';
  filesToLoad.forEach(relPath => {
    const filePath = path.join(workspaceRoot, relPath);
    concatenatedCode += fs.readFileSync(filePath, 'utf8') + '\n';
  });

  // Append explicit exports to global namespace for CJS compatibility
  concatenatedCode += `
    globalThis.SchemaRegistry = SchemaRegistry;
    globalThis.BaseModel = BaseModel;
    globalThis.BatchBucket = BatchBucket;
    globalThis.DynamicRepository = DynamicRepository;
    globalThis.FieldMapper = FieldMapper;
    globalThis.ModelRegistry = ModelRegistry;
    globalThis.ValidationRegistry = ValidationRegistry;
    globalThis.PolymorphicRegistry = PolymorphicRegistry;
    globalThis.PrimaryKeyCache = PrimaryKeyCache;
    globalThis.RelationResolver = RelationResolver;
    globalThis.ValidationPipeline = ValidationPipeline;
    globalThis.ValidationRule = ValidationRule;
    globalThis.SyncPromise = SyncPromise;
    globalThis.PipelineContext = PipelineContext;
    globalThis.AtomicPipeline = AtomicPipeline;
    globalThis.TransactionTracker = TransactionTracker;
    globalThis.Graph = {
      StaticGraphBuilder: typeof StaticGraphBuilder !== 'undefined' ? StaticGraphBuilder : null,
      DynamicGraphBuilder: typeof DynamicGraphBuilder !== 'undefined' ? DynamicGraphBuilder : null,
      DeletionValidationRegistry: typeof DeletionValidationRegistry !== 'undefined' ? DeletionValidationRegistry : null
    };
  `;

  // Evaluate entire engine code in a single compile frame
  global.eval(concatenatedCode);

  // Assemble full global SheetDB namespace to mirror Apps Script library mapping
  global.SheetDB = {
    init: globalThis.init,
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
    SyncPromise: globalThis.SyncPromise,
    TransactionTracker: globalThis.TransactionTracker,
    AtomicPipeline: globalThis.AtomicPipeline,
    PipelineContext: globalThis.PipelineContext,
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
    CircularReferenceError: globalThis.CircularReferenceError,
    TypeError: globalThis.CircularReferenceError,
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
    Graph: globalThis.Graph
  };

  // Load DazzlingDB main Code.js to register custom validators and polymorphic mappings
  loadSourceFile('DazzlingDB/Code.js');

  // 3. Initialize Mock DBContext Facade with Mock Table Gateways
  setupMockDBContext();

  // 4. Expose global loading helper for test scripts
  global.loadSourceFile = loadSourceFile;
}

module.exports = { bootstrapVirtualEnv, loadSourceFile };
