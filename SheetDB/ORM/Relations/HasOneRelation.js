/**
 * @file HasOneRelation.js
 * Layer: ORM - 1:1 Static Association
 * 
 * Responsibility:
 * - Handle hasOne relationship traversal.
 * - Retrieve single child entity where target FK matches parent PK.
 */

class HasOneRelation extends BaseRelation {
  /** @override */
  resolve(sourceModel) {
    const { target, foreignKey } = this.definition;
    const entity = sourceModel.getEntityType();
    const sourcePkName = this.registry.getPrimaryKey(entity);
    const sourcePkValue = sourceModel[sourcePkName];
    
    console.log(`[Relation:hasOne] Resolving child '${this.name}' for parent '${entity}'. Source PK Field: '${sourcePkName}', ID Value: '${sourcePkValue}'`);
    if (!sourcePkValue) {
      console.log(`[Relation:hasOne] Traversal skipped: Source PK is empty.`);
      return null;
    }

    const targetRepo = this.db[target];
    if (!targetRepo) {
      throw new RelationResolutionError(
        this.name, 
        entity, 
        `Repository for target entity '${target}' not found.`
      );
    }
    
    const coercedPk = this.normalizeKey(sourcePkValue);
    console.log(`[Relation:hasOne] Querying target sheet '${target}' for single child where target FK '${foreignKey}' equals parent ID '${coercedPk}'`);
    const results = targetRepo.where({ [foreignKey]: sourcePkValue });
    return results.length > 0 ? results[0] : null;
  }

  /** @override */
  validate(sourceModel, pkCache) {
    return []; // Child validates itself
  }
}

// Bind to Global Scope
globalThis.HasOneRelation = HasOneRelation;
