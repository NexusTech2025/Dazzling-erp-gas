/**
 * @file BaseRelation.js
 * Layer: ORM (Object-Relational Mapping) - Base Relationship
 * 
 * Responsibility:
 * - Serves as the abstract base class for all relationship handlers.
 * - Provides foreign/primary key normalization to prevent type mismatches.
 */

class BaseRelation {
  /**
   * @param {string} name - Relation field name in schema (e.g., "student")
   * @param {Object} definition - JSON schema relation declaration block
   * @param {Object} dbContext - Main SheetDB facade containing repositories
   * @param {Object} registry - Schema Registry instance
   */
  constructor(name, definition, dbContext, registry) {
    this.name = name;
    this.definition = definition;
    this.db = dbContext;
    this.registry = registry;
  }

  /**
   * Coerces key inputs to a standardized trimmed string.
   * Prevents mismatch bugs between strings ("101") and numbers (101).
   * @param {any} key
   * @returns {string}
   */
  normalizeKey(key) {
    if (key === null || key === undefined) return '';
    return String(key).trim();
  }

  /**
   * Primary traversal method. Resolves relation from source model.
   * @abstract
   * @param {BaseModel} sourceModel
   * @returns {BaseModel|Array<BaseModel>|null}
   */
  resolve(sourceModel) {
    throw new Error(`resolve() must be implemented in relation subclass ${this.constructor.name}`);
  }

  /**
   * Performs relational constraint checks using fast memory cache.
   * @abstract
   * @param {BaseModel} sourceModel
   * @param {PrimaryKeyCache} pkCache
   * @returns {FieldError[]} Unified error collection
   */
  validate(sourceModel, pkCache) {
    throw new Error(`validate() must be implemented in relation subclass ${this.constructor.name}`);
  }
}

// Bind to Global Scope
globalThis.BaseRelation = BaseRelation;
