/**
 * @file RelationResolver.js
 * Layer: ORM (Object-Relational Mapping)
 * 
 * Responsibility:
 * - Traversal: Navigate links between tables (belongsTo, hasMany, hasOne).
 * - Metadata-Driven: Uses Schema V1 'relations' definitions to automate queries.
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
  }

  /**
   * Primary Entry Point: Resolves a named relation for a given model instance.
   * 
   * @param {BaseModel} sourceModel - The object we are starting from.
   * @param {string} relationName - The key in the 'relations' block of the schema.
   * @returns {BaseModel|Array<BaseModel>|null}
   */
  resolve(sourceModel, relationName) {
    const entity = sourceModel.getEntityType();
    const relations = this.registry.getRelations(entity);
    const definition = relations[relationName];

    if (!definition) {
      throw new Error(`Relation '${relationName}' is not defined for entity '${entity}'.`);
    }

    const { type, target, foreignKey } = definition;
    const targetRepo = this.db[target];

    if (!targetRepo) {
      throw new Error(`Resolution failed: Repository for '${target}' not found in database facade.`);
    }

    // --- Execution Logic based on Relation Type ---
    switch (type) {
      case 'belongsTo':
        // Source has the FK. Find ONE parent.
        // Example: Address.student_id -> Student.findById()
        const parentId = sourceModel[foreignKey];
        return parentId ? targetRepo.findById(parentId) : null;

      case 'hasMany':
        // Target has the FK. Find MANY children.
        // Example: Student.student_id -> Enrollment.where({ student_id: ... })
        const sourcePk = this.registry.getPrimaryKey(entity);
        const sourceId = sourceModel[sourcePk];
        return targetRepo.where({ [foreignKey]: sourceId });

      case 'hasOne':
        // Target has the FK. Find ONE child.
        // Example: Student.student_id -> FeeAccount.where({ student_id: ... })
        const pkName = this.registry.getPrimaryKey(entity);
        const sid = sourceModel[pkName];
        const results = targetRepo.where({ [foreignKey]: sid });
        return results.length > 0 ? results[0] : null;

      default:
        throw new Error(`Unknown relation type: ${type}`);
    }
  }
}
