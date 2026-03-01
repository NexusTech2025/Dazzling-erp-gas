/**
 * ==============================================================
 * LazyRelationResolver.gs (V2 - Production Ready)
 * ==============================================================
 *
 * Layer: ORM Core (Internal Component)
 *
 * Responsibility:
 * - Resolve lazy-loaded relations based on SchemaV1 metadata
 * - Translate relation definitions into ORM fetch operations
 * - Remain fully infrastructure-agnostic
 *
 * MUST NOT:
 * - Access SpreadsheetApp
 * - Access TableGateway
 * - Access repositories directly
 * - Manage IdentityMap (delegated to ORM)
 * - Contain business rules
 *
 * Depends on:
 * - SchemaRegistry
 * - ORM (for fetch + identity-aware wrapping)
 * ==============================================================
 */

class LazyRelationResolverError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = "LazyRelationResolverError";
    this.meta = meta;
  }
}

class LazyRelationResolver {

  /**
   * @param {SchemaRegistry} schemaRegistry
   * @param {ORM} orm
   */
  constructor(schemaRegistry, orm) {
    if (!schemaRegistry || !orm) {
      throw new LazyRelationResolverError(
        "schemaRegistry and orm are required for LazyRelationResolver."
      );
    }

    this._schemaRegistry = schemaRegistry;
    this._orm = orm;
  }

  /**
   * Public relation resolver
   *
   * @param {BaseModel} sourceModel
   * @param {string} relationName
   * @returns {BaseModel|Array<BaseModel>|null}
   */
  resolve(sourceModel, relationName) {
    if (!sourceModel || !relationName) {
      throw new LazyRelationResolverError(
        "sourceModel and relationName are required."
      );
    }

    const entityName = sourceModel._entity;

    const entitySchema = this._schemaRegistry.getEntity(entityName);

    if (!entitySchema.relations || !entitySchema.relations[relationName]) {
      throw new LazyRelationResolverError(
        `Relation '${relationName}' not defined for entity '${entityName}'.`,
        { entityName, relationName }
      );
    }

    const relationMeta = entitySchema.relations[relationName];

    switch (relationMeta.type) {
      case "hasMany":
        return this._resolveHasMany(sourceModel, relationMeta);

      case "belongsTo":
        return this._resolveBelongsTo(sourceModel, relationMeta);

      case "hasOne":
        return this._resolveHasOne(sourceModel, relationMeta);

      default:
        throw new LazyRelationResolverError(
          `Unsupported relation type '${relationMeta.type}'.`,
          { relationMeta }
        );
    }
  }

  /**
   * --------------------------------------------------------------
   * hasMany
   * target.foreignKey = source.primaryKey
   * --------------------------------------------------------------
   */
  _resolveHasMany(sourceModel, relationMeta) {
    const sourcePrimaryKey = this._schemaRegistry.getPrimaryKey(sourceModel._entity);
    const sourceId = sourceModel.get(sourcePrimaryKey);

    if (!sourceId) {
      return [];
    }

    const filter = {
      [relationMeta.foreignKey]: sourceId
    };

    return this._orm.fetch(relationMeta.targetEntity, filter);
  }

  /**
   * --------------------------------------------------------------
   * belongsTo
   * target.primaryKey = source.foreignKey
   * --------------------------------------------------------------
   */
  _resolveBelongsTo(sourceModel, relationMeta) {
    const foreignKeyValue = sourceModel.get(relationMeta.foreignKey);

    if (!foreignKeyValue) {
      return null;
    }

    return this._orm.findById(
      relationMeta.targetEntity,
      foreignKeyValue
    );
  }

  /**
   * --------------------------------------------------------------
   * hasOne
   * target.foreignKey = source.localKey
   * --------------------------------------------------------------
   */
  _resolveHasOne(sourceModel, relationMeta) {
    const localKey = relationMeta.localKey;

    if (!localKey) {
      throw new LazyRelationResolverError(
        "localKey is required for hasOne relation.",
        { relationMeta }
      );
    }

    const localValue = sourceModel.get(localKey);

    if (!localValue) {
      return null;
    }

    const filter = {
      [relationMeta.foreignKey]: localValue
    };

    const results = this._orm.fetch(
      relationMeta.targetEntity,
      filter
    );

    return results.length > 0 ? results[0] : null;
  }
}

/**
 * ==============================================================
 * V2 Enhancements
 * ==============================================================
 *
 * ✔ Strict schema-based primary key resolution
 * ✔ Strong validation for relation definitions
 * ✔ Explicit localKey validation for hasOne
 * ✔ Clear separation of concerns
 * ✔ IdentityMap handled via ORM
 *
 * Next Step:
 * - Inject dynamic relation methods into BaseModel
 * - Optional: Add relation-level caching
 * ==============================================================
 */