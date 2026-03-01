/**
 * ==============================================================
 * SchemaRegistry.gs
 * ==============================================================
 *
 * Layer: Structural Metadata Provider
 *
 * Responsibility:
 * - Provide structural schema information to TableGateway
 * - Validate entity and column definitions
 * - Validate filtering rules
 *
 * MUST NOT:
 * - Access SpreadsheetApp
 * - Know about ORM
 * - Resolve relations
 * - Contain business rules
 *
 * This layer is purely structural.
 * ==============================================================
 */

class SchemaRegistryError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = "SchemaRegistryError";
    this.meta = meta;
  }
}

class SchemaRegistry {
  /**
   * @param {Object} schemaObject - DATABASE_SCHEMA
   */
  constructor(schemaObject) {
    if (!schemaObject || typeof schemaObject !== "object") {
      throw new SchemaRegistryError("Valid schema object is required.");
    }

    this._schema = schemaObject;
    this._validateSchema();
  }

  hasEntity(entityName) {
    return !!this._schema[entityName];
  }

  getEntity(entityName) {
    const entity = this._schema[entityName];
    if (!entity) {
      throw new SchemaRegistryError(`Entity '${entityName}' not found.`);
    }
    return entity;
  }

  getTableName(entityName) {
    const entity = this.getEntity(entityName);
    if (!entity.tableName) {
      throw new SchemaRegistryError(`Entity '${entityName}' missing tableName.`);
    }
    return entity.tableName;
  }

  getPrimaryKey(entityName) {
    const entity = this.getEntity(entityName);
    if (!entity.primaryKey) {
      throw new SchemaRegistryError(`Entity '${entityName}' missing primaryKey.`);
    }
    return entity.primaryKey;
  }

  getColumns(entityName) {
    const entity = this.getEntity(entityName);
    if (!entity.columns || typeof entity.columns !== "object") {
      throw new SchemaRegistryError(`Entity '${entityName}' missing columns definition.`);
    }
    return entity.columns;
  }

  getColumn(entityName, columnName) {
    const columns = this.getColumns(entityName);
    const column = columns[columnName];
    if (!column) {
      throw new SchemaRegistryError(`Column '${columnName}' not defined for entity '${entityName}'.`);
    }
    return column;
  }

  /**
   * Validate filters against schema
   */
  validateFilter(entityName, filters) {
    const columns = this.getColumns(entityName);

    Object.keys(filters).forEach(key => {
      const column = columns[key];
      if (!column) {
        throw new SchemaRegistryError(`Invalid filter column '${key}' for entity '${entityName}'.`);
      }

      if (column.filter && Array.isArray(column.filter)) {
        if (!column.filter.includes("eq")) {
          throw new SchemaRegistryError(
            `Filtering not allowed on column '${key}' for entity '${entityName}'.`
          );
        }
      }
    });
  }

  /**
   * Internal structural validation on initialization
   */
  _validateSchema() {
    Object.keys(this._schema).forEach(entityName => {
      const entity = this._schema[entityName];

      if (!entity.tableName) {
        throw new SchemaRegistryError(`Entity '${entityName}' missing tableName.`);
      }

      if (!entity.primaryKey) {
        throw new SchemaRegistryError(`Entity '${entityName}' missing primaryKey.`);
      }

      if (!entity.columns) {
        throw new SchemaRegistryError(`Entity '${entityName}' missing columns.`);
      }

      if (!entity.columns[entity.primaryKey]) {
        throw new SchemaRegistryError(
          `Primary key '${entity.primaryKey}' not defined in columns for entity '${entityName}'.`
        );
      }
    });
  }
}



// ========================= RepositoryRegistry.gs =========================== //

/**
 * ==============================================================
 * RepositoryRegistry.gs
 * ==============================================================
 *
 * Responsibility:
 * - Register and resolve repository instances by entity name
 * - Provide safe access for ORM layer
 *
 * MUST NOT:
 * - Access SpreadsheetApp
 * - Resolve relations
 * - Contain business logic
 * ==============================================================
 */

class RepositoryRegistryError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = "RepositoryRegistryError";
    this.meta = meta;
  }
}

class RepositoryRegistry {

  constructor() {
    this._repositories = new Map();
  }

  /**
   * Register repository for an entity
   * @param {string} entityName
   * @param {BaseRepository} repositoryInstance
   */
  register(entityName, repositoryInstance) {
    if (!entityName || !repositoryInstance) {
      throw new RepositoryRegistryError(
        "entityName and repositoryInstance are required."
      );
    }

    if (this._repositories.has(entityName)) {
      throw new RepositoryRegistryError(
        `Repository already registered for '${entityName}'.`
      );
    }

    this._repositories.set(entityName, repositoryInstance);
  }

  /**
   * Retrieve repository by entity name
   * @param {string} entityName
   * @returns {BaseRepository}
   */
  get(entityName) {
    if (!this._repositories.has(entityName)) {
      throw new RepositoryRegistryError(
        `Repository not found for '${entityName}'.`
      );
    }

    return this._repositories.get(entityName);
  }

  /**
   * Check if repository exists
   */
  has(entityName) {
    return this._repositories.has(entityName);
  }

  /**
   * List registered entities
   */
  list() {
    return Array.from(this._repositories.keys());
  }
}



/**
 * Architectural Responsibilities:
 * --------------------------------------------------------------
 * Controller (doGet):
 *   - Parse HTTP parameters
 *   - Bootstrap ORM
 *   - Resolve Action
 *   - Execute Action
 *   - Ensure ORM lifecycle cleanup
 *
 * ActionRegistry:
 *   - Map action string → Action class
 *   - Enforce registration boundary
 *   - Prevent switch-case sprawl
 *
 * MUST NOT:
 *   - Contain business logic
 *   - Contain filtering logic
 *   - Access Repository directly
 *   - Access TableGateway
 *
 * ==============================================================
 */

/**
 * --------------------------------------------------------------
 * ActionRegistry
 * --------------------------------------------------------------
 *
 * Purpose:
 * Centralized registry mapping action string names
 * to concrete Action classes.
 *
 * Why This Exists:
 * - Avoids large switch-case blocks
 * - Enables Open/Closed Principle
 * - Supports future versioning
 * - Supports middleware injection
 */
class ActionRegistry {

  /**
   * Static action map
   *
   * Key: action string
   * Value: Action class
   */
  static get registry() {
    return {
      query: QueryAction,
      retrieve: RetrieveAction,
      relatedquery: RelatedQueryAction,
      register: RegisterAction,
      login: LoginAction,
      logout: LogoutAction,
      bootstrap_admin: BootstrapAdminAction
    };
  }

  /**
   * Resolve action string into Action class
   *
   * @param {string} actionName
   * @returns {Function} Action class
   * @throws {ValidationError} If action is unknown
   */
  static resolve(actionName) {
    if (!actionName) {
      throw new ValidationError("action parameter is required.");
    }

    const normalized = String(actionName).toLowerCase();
    const ActionClass = this.registry[normalized];

    if (!ActionClass) {
      throw new ValidationError(`Unknown action: ${actionName}`);
    }

    return ActionClass;
  }
}
