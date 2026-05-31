/**
 * @file RelationResolver.js
 * Layer: ORM (Object-Relational Mapping)
 * 
 * Responsibility:
 * - Traversal: Dispatch relation calls to first-class relation objects.
 * - Integration: Bridges a Model instance to the Repository layer.
 */

class RelationResolver {
  /**
   * @param {Object} dbContext - The main SheetDB Facade instance containing all repositories.
   * @param {Object} registry - Instance of SchemaRegistry.
   */
  constructor(dbContext, registry) {
    this.db = dbContext;
    this.registry = registry;
    this.relationFactory = {
      belongsTo: BelongsToRelation,
      hasMany: HasManyRelation,
      hasOne: HasOneRelation,
      belongsToPolymorphic: BelongsToPolymorphicRelation
    };
  }

  /**
   * Factory utility to compile and return a Relation instance.
   * @param {BaseModel} sourceModel
   * @param {string} relationName
   * @returns {BaseRelation}
   */
  getRelation(sourceModel, relationName) {
    const entity = sourceModel.getEntityType();
    const relations = this.registry.getRelations(entity);
    const definition = relations[relationName];

    if (!definition) {
      throw new Error(`Relation '${relationName}' is not defined for entity '${entity}'.`);
    }

    const RelationClass = this.relationFactory[definition.type];
    if (!RelationClass) {
      throw new Error(`Unsupported relation type: ${definition.type}`);
    }

    return new RelationClass(relationName, definition, this.db, this.registry);
  }

  /**
   * Primary Entry Point: Resolves a named relation for a given model instance.
   * 
   * @param {BaseModel} sourceModel - The object we are starting from.
   * @param {string} relationName - The key in the 'relations' block of the schema.
   * @returns {BaseModel|Array<BaseModel>|null}
   */
  resolve(sourceModel, relationName) {
    if (!sourceModel || typeof sourceModel.getEntityType !== 'function') {
      throw new Error("[RelationResolver] Source model must be a hydrated BaseModel instance.");
    }
    
    console.log(`[RelationResolver] Initiating traversal for relation '${relationName}' on entity '${sourceModel.getEntityType()}'`);
    const relation = this.getRelation(sourceModel, relationName);
    return relation.resolve(sourceModel);
  }
}

// Export to Global Namespace
globalThis.RelationResolver = RelationResolver;
