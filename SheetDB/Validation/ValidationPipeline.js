/**
 * @file ValidationPipeline.js
 * Layer: ORM - Field Validation Pipeline
 * 
 * Responsibility:
 * - Aggregate multiple ValidationRules for a single field.
 * - Execute rules sequentially and collect all failures.
 */

class ValidationPipeline {
  /**
   * @param {string} fieldName - Name of the field.
   */
  constructor(fieldName) {
    this.fieldName = fieldName;
    this.rules = [];
  }

  /**
   * Add a validation rule to the pipeline.
   * @param {ValidationRule} rule
   * @returns {ValidationPipeline} This instance for chaining.
   */
  addRule(rule) {
    if (!(rule instanceof ValidationRule)) {
      throw new Error(`[ValidationPipeline] Invalid rule added to '${this.fieldName}'. Must be a ValidationRule subclass instance.`);
    }
    this.rules.push(rule);
    return this;
  }

  /**
   * Run all rules in the pipeline and aggregate errors.
   * @param {any} value - Value of the field to check.
   * @returns {FieldError[]} List of FieldError objects, empty if valid.
   */
  validate(value, context = {}) {
    const failures = [];
    
    for (const rule of this.rules) {
      try {
        const errorMsg = rule.validate(value, this.fieldName, context);
        if (errorMsg) {
          failures.push(new FieldError(this.fieldName, errorMsg, value));
        }
      } catch (err) {
        // Capture any unexpected exception (e.g. ValidationRegistry error) and wrap it
        failures.push(new FieldError(this.fieldName, `Validation failed due to exception: ${err.message}`, value));
      }
    }
    
    return failures;
  }
}

// Bind to Global Scope
globalThis.ValidationPipeline = ValidationPipeline;
