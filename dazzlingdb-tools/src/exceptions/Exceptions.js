/**
 * @file Exceptions.js
 * Custom exception hierarchy definitions for compile-time failures.
 */

class SchemaCompilerError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
  }
}

class LinterException extends SchemaCompilerError {}
class RelationalIntegrityException extends SchemaCompilerError {}
class NullabilityConstraintException extends SchemaCompilerError {}

module.exports = {
  SchemaCompilerError,
  LinterException,
  RelationalIntegrityException,
  NullabilityConstraintException
};
