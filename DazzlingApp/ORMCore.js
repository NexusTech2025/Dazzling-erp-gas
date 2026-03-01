/**
 * ==============================================================
 * ORM.gs (V2.1)
 * ==============================================================
 *
 * Architectural Inflection Point:
 *
 * This version activates the architectural contract.
 *
 * Repository → returns raw rows only
 * ORM → sole wrapping authority
 * IdentityMap → guarantees uniqueness
 * BaseModel → activated through ORM
 *
 * Responsibility:
 * - Coordinate repositories
 * - Enforce wrapping boundary
 * - Control IdentityMap lifecycle
 * - Provide unified fetch API
 * - Delegate lazy relation resolution
 *
 * MUST NOT:
 * - Access SpreadsheetApp
 * - Access TableGateway directly
 * - Perform filtering
 * - Contain business logic
 *
 * Depends on:
 * - SchemaRegistry
 * - RepositoryRegistry
 * - IdentityMap
 * - BaseModel
 * - LazyRelationResolver
 * ==============================================================
 */

class ORMError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = "ORMError";
    this.meta = meta;
  }
}

class ORM {

  /**
   * @param {SchemaRegistry} schemaRegistry
   * @param {RepositoryRegistry} repositoryRegistry
   */
  constructor(schemaRegistry, repositoryRegistry) {
    if (!schemaRegistry || !repositoryRegistry) {
      throw new ORMError("SchemaRegistry and RepositoryRegistry are required.");
    }

    this._schemaRegistry = schemaRegistry;
    this._repositoryRegistry = repositoryRegistry;
    this._identityMap = new IdentityMap();
    this._authService = null;
    
    // LazyRelationResolver wired
    this._lazyResolver = new LazyRelationResolver(
      this._schemaRegistry,
      this
    );
  }

  /**
   * Inject AuthService
   */
  setAuthService(authService) {
    this._authService = authService;
  }

  /**
   * Get AuthService
   */
  getAuthService() {
    return this._authService;
  }

  /**
   * Retrieve repository for entity
   */
  getRepository(entityName) {
    try {
      return this._repositoryRegistry.get(entityName);
    } catch (error) {
      throw new ORMError("Repository resolution failed.", {
        entityName,
        cause: error.message
      });
    }
  }

  /**
   * --------------------------------------------------------------
   * V2.1 Enforcement Boundary
   * --------------------------------------------------------------
   * Repository returns RAW rows.
   * ORM wraps and activates IdentityMap.
   * --------------------------------------------------------------
   */
  fetch(entityName, filters = {}) {
    const repository = this.getRepository(entityName);

    // RAW rows from repository
    const rows = repository.find(filters);

    if (!Array.isArray(rows)) {
      throw new ORMError("Repository.find() must return array of raw rows.");
    }

    // Activate wrapping boundary
    return rows.map(row =>
      this._wrap(entityName, row)
    );
  }

  /**
   * Find single record by primary key
   */
  findById(entityName, id) {
    const repository = this.getRepository(entityName);

    const row = repository.findById(id);

    if (!row) return null;

    // Activate wrapping boundary
    return this._wrap(entityName, row);
  }

  /**
   * Identity-aware wrapping
   */
  _wrap(entityName, rawObject) {
    if (!rawObject) return null;

    const primaryKey = this._schemaRegistry.getPrimaryKey(entityName);
    const id = rawObject[primaryKey];

    if (!id) {
      throw new ORMError("Primary key missing in raw object.", {
        entityName,
        rawObject
      });
    }

    // IdentityMap check
    if (this._identityMap.has(entityName, id)) {
      return this._identityMap.get(entityName, id);
    }

    const model = new BaseModel(entityName, rawObject, this);

    this._identityMap.set(entityName, id, model);

    return model;
  }

  /**
   * Delegate relation resolution
   */
  resolveRelation(sourceModel, relationName) {
    return this._lazyResolver.resolve(sourceModel, relationName);
  }

  /**
   * Lifecycle reset
   */
  clear() {
    this._identityMap.clear();
  }

  identityStats() {
    return this._identityMap.stats();
  }
}

/**
 * ==============================================================
 * ORM V2.1 Architectural Activation
 * ==============================================================
 *
 * ✔ Repository is ORM-agnostic
 * ✔ Wrapping boundary enforced inside ORM
 * ✔ IdentityMap now active in runtime
 * ✔ BaseModel instances guaranteed
 * ✔ LazyRelationResolver meaningful
 * ✔ Graph consistency enforceable
 *
 * This version restores the architectural contract.
 * ==============================================================
 */
