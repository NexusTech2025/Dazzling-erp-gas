/**
 * @file BelongsToRelation.js
 * Layer: ORM - N:1 Static Association
 * 
 * Responsibility:
 * - Handle belongsTo relationship traversal.
 * - Validate foreign key constraint matching parent sheet records using cache.
 */

class BelongsToRelation extends BaseRelation {
  /** @override */
  resolve(sourceModel) {
    const { target, foreignKey } = this.definition;
    const parentId = sourceModel[foreignKey];
    
    console.log(`[Relation:belongsTo] Resolving '${this.name}' for entity '${sourceModel.getEntityType()}'. FK Field: '${foreignKey}', ID Value: '${parentId}'`);
    if (!parentId) {
      console.log(`[Relation:belongsTo] Traversal skipped: FK '${foreignKey}' is empty.`);
      return null;
    }

    const targetRepo = this.db[target];
    if (!targetRepo) {
      throw new RelationResolutionError(
        this.name, 
        sourceModel.getEntityType(), 
        `Repository for target entity '${target}' not found in database facade.`
      );
    }
    
    const coercedId = this.normalizeKey(parentId);
    console.log(`[Relation:belongsTo] Fetching record from target sheet '${target}' using coerced ID '${coercedId}'`);
    return targetRepo.findById(coercedId);
  }

  /** @override */
  validate(sourceModel, pkCache) {
    const { target, foreignKey } = this.definition;
    const fkValue = sourceModel[foreignKey];
    const entity = sourceModel.getEntityType();

    // Early exit if field is optional and blank
    if (fkValue === null || fkValue === undefined || fkValue === '') {
      return [];
    }

    const validPks = pkCache.get(target);
    const coercedFk = this.normalizeKey(fkValue);
    
    if (!validPks.has(coercedFk)) {
      console.error(`[Relation:belongsTo] Relational constraint failure: ID '${fkValue}' in field '${foreignKey}' not found in parent table '${target}'.`);
      return [new FieldError(
        foreignKey,
        `Foreign Key Mismatch: ID '${fkValue}' not found in parent table '${target}'.`,
        fkValue
      )];
    }
    
    console.log(`[Relation:belongsTo] Relational check PASSED for '${foreignKey}' -> '${target}' (ID: '${coercedFk}')`);
    return [];
  }
}

// Bind to Global Scope
globalThis.BelongsToRelation = BelongsToRelation;
