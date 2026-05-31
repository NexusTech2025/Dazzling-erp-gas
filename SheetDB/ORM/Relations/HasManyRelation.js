/**
 * @file HasManyRelation.js
 * Layer: ORM - 1:N Static Association
 * 
 * Responsibility:
 * - Handle hasMany relationship traversal.
 * - Retrieve children entities where target FK matches parent PK.
 */

class HasManyRelation extends BaseRelation {
  /** @override */
  resolve(sourceModel) {
    const { target, foreignKey } = this.definition;
    const entity = sourceModel.getEntityType();
    const sourcePkName = this.registry.getPrimaryKey(entity);
    const sourcePkValue = sourceModel[sourcePkName];
    
    console.log(`[Relation:hasMany] Resolving child entities '${this.name}' for parent '${entity}'. Source PK Field: '${sourcePkName}', ID Value: '${sourcePkValue}'`);
    if (!sourcePkValue) {
      console.log(`[Relation:hasMany] Traversal skipped: Source PK is empty.`);
      return [];
    }

    const targetRepo = this.db[target];
    if (!targetRepo) {
      throw new RelationResolutionError(
        this.name, 
        entity, 
        `Repository for target entity '${target}' not found in database facade.`
      );
    }
    
    const coercedPk = this.normalizeKey(sourcePkValue);
    console.log(`[Relation:hasMany] Querying target sheet '${target}' where target FK '${foreignKey}' equals parent ID '${coercedPk}'`);
    return targetRepo.where({ [foreignKey]: sourcePkValue });
  }

  /** @override */
  validate(sourceModel, pkCache) {
    return []; // Children validate themselves; no parent-side check needed
  }
}

// Bind to Global Scope
globalThis.HasManyRelation = HasManyRelation;
