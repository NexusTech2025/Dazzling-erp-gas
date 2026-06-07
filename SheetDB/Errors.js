/**
 * @file Errors.js
 * Core Error definitions for the SheetDB Library.
 * These are generic and independent of any specific domain.
 */

/**
 * Base error for all SheetDB failures.
 */
class SheetDBError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * 📂 INFRASTRUCTURE ERRORS
 */

class SpreadsheetNotFoundError extends SheetDBError {
  constructor(category) {
    super(`Physical spreadsheet for category '${category}' not found in Drive.`, { category });
  }
}

class TableNotFoundError extends SheetDBError {
  constructor(table, category) {
    super(`Table '${table}' not found in spreadsheet '${category}'.`, { table, category });
  }
}

/**
 * 🔎 GENERIC LOGICAL ERRORS (High Reuse)
 */

/**
 * Thrown when a record lookup fails.
 */
class EntityNotFoundError extends SheetDBError {
  constructor(entity, id, domain = "System") {
    super(`${entity} with ID '${id}' was not found in ${domain}.`, { entity, id, domain });
  }
}

/**
 * Thrown when data validation fails.
 */
class ValidationError extends SheetDBError {}

/**
 * Thrown when a specific field fails validation or transformation.
 */
class FieldError extends ValidationError {
  constructor(fieldName, message, value) {
    super(`Field '${fieldName}' failed validation: ${message}`, { fieldName, value });
    this.fieldName = fieldName;
  }
}

/**
 * Thrown when a unique constraint is violated.
 */
class ConflictError extends SheetDBError {}

/**
 * Thrown when business logic or referential integrity is violated.
 */
class IntegrityError extends SheetDBError {}

/**
 * Thrown when authorization fails.
 */
class ForbiddenError extends SheetDBError {}

/**
 * Thrown when a batch deletion operation fails due to invalid parameters or constraint violations.
 */
class BatchDeleteError extends SheetDBError {
  constructor(message, context = {}) {
    super(message, context);
  }
}

/**
 * 🔒 VALIDATION REGISTRY ERRORS
 */
class ValidationRegistryError extends SheetDBError {}

class ValidationRegistryLockedError extends ValidationRegistryError {
  constructor(action, handlerName) {
    super(`Security Error: Cannot perform '${action}' on '${handlerName}' because the ValidationRegistry is locked.`, { action, handlerName });
  }
}

class ValidatorRegistrationError extends ValidationRegistryError {
  constructor(name, reason) {
    super(`Registration Error for validator '${name}': ${reason}`, { name, reason });
  }
}

class ValidatorNotFoundError extends ValidationRegistryError {
  constructor(name) {
    super(`Lookup Error: Custom validator handler '${name}' is not registered in ValidationRegistry.`, { name });
  }
}

class ValidatorExecutionError extends ValidationRegistryError {
  constructor(name, value, originalError) {
    super(`Execution Exception in validator '${name}' for value '${value}': ${originalError.message}`, { name, value, originalError });
  }
}

/**
 * 🔗 RELATIONSHIP TRAVERSAL & CONSTRAINT ERRORS
 */
class RelationError extends SheetDBError {}

class RelationResolutionError extends RelationError {
  constructor(relationName, entity, reason, details = {}) {
    super(`[Relation:ResolutionError] Failed to resolve relation '${relationName}' on entity '${entity}': ${reason}`, {
      relationName,
      entity,
      reason,
      ...details
    });
  }
}

class RelationValidationError extends RelationError {
  constructor(relationName, entity, message, details = {}) {
    super(`[Relation:ValidationError] Constraint validation failed for relation '${relationName}' on entity '${entity}': ${message}`, {
      relationName,
      entity,
      message,
      ...details
    });
  }
}

/**
 * Thrown when a system level/critical database error occurs.
 */
class SystemError extends SheetDBError {}

/**
 * Thrown when the required dependency graph is missing or invalid.
 */
class DependencyGraphError extends SystemError {}

// Export to Global Namespace for Library usage
globalThis.SheetDBError = SheetDBError;
globalThis.SpreadsheetNotFoundError = SpreadsheetNotFoundError;
globalThis.TableNotFoundError = TableNotFoundError;
globalThis.EntityNotFoundError = EntityNotFoundError;
globalThis.ValidationError = ValidationError;
globalThis.FieldError = FieldError;
globalThis.ConflictError = ConflictError;
globalThis.IntegrityError = IntegrityError;
globalThis.ForbiddenError = ForbiddenError;
globalThis.ValidationRegistryError = ValidationRegistryError;
globalThis.ValidationRegistryLockedError = ValidationRegistryLockedError;
globalThis.ValidatorRegistrationError = ValidatorRegistrationError;
globalThis.ValidatorNotFoundError = ValidatorNotFoundError;
globalThis.ValidatorExecutionError = ValidatorExecutionError;
globalThis.RelationError = RelationError;
globalThis.RelationResolutionError = RelationResolutionError;
globalThis.RelationValidationError = RelationValidationError;
globalThis.BatchDeleteError = BatchDeleteError;
globalThis.SystemError = SystemError;
globalThis.DependencyGraphError = DependencyGraphError;
