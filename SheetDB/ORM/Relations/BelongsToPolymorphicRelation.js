/**
 * @file BelongsToPolymorphicRelation.js
 * Layer: ORM - Dynamic Polymorphic Association
 * 
 * Responsibility:
 * - Handle belongsToPolymorphic relationship traversal resolved at runtime.
 * - Validate dynamic foreign key constraint against resolved parent sheets using cache.
 */

class BelongsToPolymorphicRelation extends BaseRelation {
  /** @override */
  resolve(sourceModel) {
    const { typeField, idField } = this.definition;
    const entity = sourceModel.getEntityType();
    const typeValue = sourceModel[typeField];
    const idValue = sourceModel[idField];

    console.log(`[Relation:belongsToPolymorphic] Resolving polymorphic '${this.name}' for '${entity}'. Type Field: '${typeField}' ('${typeValue}'), ID Field: '${idField}' ('${idValue}')`);
    if (!typeValue || !idValue) {
      console.log(`[Relation:belongsToPolymorphic] Traversal skipped: Type '${typeValue}' or ID '${idValue}' is missing.`);
      return null;
    }

    let targetTable;
    try {
      if (typeof PolymorphicRegistry === 'undefined') {
        throw new Error("PolymorphicRegistry is not globally available.");
      }
      targetTable = PolymorphicRegistry.resolve(typeValue);
    } catch (err) {
      throw new RelationResolutionError(
        this.name, 
        entity, 
        `Polymorphic registry resolution failed for type code '${typeValue}': ${err.message}`, 
        { typeValue }
      );
    }

    const targetRepo = this.db[targetTable];
    if (!targetRepo) {
      throw new RelationResolutionError(
        this.name, 
        entity, 
        `Polymorphic target repository for resolved table '${targetTable}' not found.`, 
        { targetTable }
      );
    }
    
    const coercedId = this.normalizeKey(idValue);
    console.log(`[Relation:belongsToPolymorphic] Fetching record from resolved target sheet '${targetTable}' using ID '${coercedId}'`);
    return targetRepo.findById(idValue);
  }

  /** @override */
  validate(sourceModel, pkCache) {
    const { typeField, idField } = this.definition;
    const entity = sourceModel.getEntityType();
    const typeValue = sourceModel[typeField];
    const fkValue = sourceModel[idField];

    // Optional early exit
    if (!typeValue && (fkValue === null || fkValue === undefined || fkValue === '')) {
      return [];
    }

    // Ensure state integrity: both or neither must be set
    if (!typeValue && fkValue) {
      console.error(`[Relation:belongsToPolymorphic] Validation failure: type field '${typeField}' is empty but dynamic ID '${fkValue}' is set.`);
      return [new FieldError(typeField, "Polymorphic type must be provided when a dynamic ID is set.", typeValue)];
    }
    if (typeValue && !fkValue) {
      console.error(`[Relation:belongsToPolymorphic] Validation failure: type field '${typeField}' is set to '${typeValue}' but dynamic ID is empty.`);
      return [new FieldError(idField, "Polymorphic ID must be provided when a type is set.", fkValue)];
    }

    try {
      if (typeof PolymorphicRegistry === 'undefined') {
        throw new Error("PolymorphicRegistry is not globally available.");
      }
      const targetTable = PolymorphicRegistry.resolve(typeValue);
      const validPks = pkCache.get(targetTable);
      const coercedFk = this.normalizeKey(fkValue);

      if (!validPks.has(coercedFk)) {
        console.error(`[Relation:belongsToPolymorphic] Validation failure: dynamic ID '${fkValue}' not found in resolved parent table '${targetTable}' for type '${typeValue}'.`);
        return [new FieldError(
          idField,
          `Polymorphic ID Mismatch: ID '${fkValue}' not found in dynamically resolved table '${targetTable}' for type '${typeValue}'.`,
          fkValue
        )];
      }
      
      console.log(`[Relation:belongsToPolymorphic] Relational check PASSED for '${idField}' -> '${targetTable}' (ID: '${coercedFk}')`);
    } catch (err) {
      console.error(`[Relation:belongsToPolymorphic] Mapping resolution exception: ${err.message}`);
      return [new FieldError(
        typeField,
        `Polymorphic mapping resolution failed: ${err.message}`,
        typeValue
      )];
    }
    return [];
  }
}

// Bind to Global Scope
globalThis.BelongsToPolymorphicRelation = BelongsToPolymorphicRelation;
