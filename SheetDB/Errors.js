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

// Export to Global Namespace for Library usage
globalThis.SheetDBError = SheetDBError;
globalThis.SpreadsheetNotFoundError = SpreadsheetNotFoundError;
globalThis.TableNotFoundError = TableNotFoundError;
globalThis.EntityNotFoundError = EntityNotFoundError;
globalThis.ValidationError = ValidationError;
globalThis.ConflictError = ConflictError;
globalThis.IntegrityError = IntegrityError;
globalThis.ForbiddenError = ForbiddenError;
