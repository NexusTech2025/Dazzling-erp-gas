/**
 * @file ValidationRules.js
 * Layer: ORM - Stateless Validation Rules
 * 
 * Responsibility:
 * - Define standard atomic validation rules.
 * - Provide clear, decoupled validation checks for each field attribute.
 */

class ValidationRule {
  /**
   * @param {any} value - Value to validate
   * @param {string} fieldName - Name of the field being validated
   * @returns {string|null} Error message if invalid, or null if valid
   */
  validate(value, fieldName) {
    throw new Error("validate method must be implemented in subclasses.");
  }
}

class RequiredRule extends ValidationRule {
  validate(value, fieldName) {
    if (value === null || value === undefined || value === "") {
      return `Field '${fieldName}' is required.`;
    }
    return null;
  }
}

class MaxLengthRule extends ValidationRule {
  constructor(max) {
    super();
    this.max = max;
  }

  validate(value, fieldName) {
    if (value === null || value === undefined || value === "") return null;
    const strVal = String(value);
    if (strVal.length > this.max) {
      return `Field '${fieldName}' length ${strVal.length} exceeds maximum of ${this.max}.`;
    }
    return null;
  }
}

class MinLengthRule extends ValidationRule {
  constructor(min) {
    super();
    this.min = min;
  }

  validate(value, fieldName) {
    if (value === null || value === undefined || value === "") return null;
    const strVal = String(value);
    if (strVal.length < this.min) {
      return `Field '${fieldName}' length ${strVal.length} is below minimum of ${this.min}.`;
    }
    return null;
  }
}

class MinRule extends ValidationRule {
  constructor(min) {
    super();
    this.min = min;
  }

  validate(value, fieldName) {
    if (value === null || value === undefined || value === "") return null;
    const num = Number(value);
    if (isNaN(num) || num < this.min) {
      return `Field '${fieldName}' value ${value} is below minimum of ${this.min}.`;
    }
    return null;
  }
}

class MaxRule extends ValidationRule {
  constructor(max) {
    super();
    this.max = max;
  }

  validate(value, fieldName) {
    if (value === null || value === undefined || value === "") return null;
    const num = Number(value);
    if (isNaN(num) || num > this.max) {
      return `Field '${fieldName}' value ${value} exceeds maximum of ${this.max}.`;
    }
    return null;
  }
}

class ChoiceRule extends ValidationRule {
  constructor(choices) {
    super();
    this.choices = choices;
  }

  validate(value, fieldName) {
    if (value === null || value === undefined || value === "") return null;
    if (!this.choices.includes(value)) {
      return `Field '${fieldName}' value '${value}' is not a valid choice. Allowed: [${this.choices.join(", ")}]`;
    }
    return null;
  }
}

class RegexRule extends ValidationRule {
  constructor(pattern) {
    super();
    this.pattern = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
  }

  validate(value, fieldName) {
    if (value === null || value === undefined || value === "") return null;
    if (!this.pattern.test(String(value))) {
      return `Field '${fieldName}' value '${value}' does not match required pattern.`;
    }
    return null;
  }
}

class CustomCallbackRule extends ValidationRule {
  constructor(handlerName) {
    super();
    this.handlerName = handlerName;
  }

  validate(value, fieldName, context = {}) {
    if (typeof ValidationRegistry === 'undefined') {
      throw new Error("ValidationRegistry is not globally available.");
    }
    
    // validation registry will throw custom error if missing or execution fails
    const result = ValidationRegistry.execute(this.handlerName, value, context);
    
    if (result !== true && result !== null && result !== undefined) {
      return typeof result === 'string' ? result : `Custom validation handler '${this.handlerName}' failed.`;
    }
    return null;
  }
}

class FunctionalCallbackRule extends ValidationRule {
  constructor(fn) {
    super();
    if (typeof fn !== 'function') {
      throw new Error("FunctionalCallbackRule expects a function.");
    }
    this.fn = fn;
  }

  validate(value, fieldName) {
    try {
      const result = this.fn(value);
      if (result !== true && result !== null && result !== undefined) {
        return typeof result === 'string' ? result : `Functional validation failed.`;
      }
      return null;
    } catch (e) {
      return `Functional validation threw exception: ${e.message}`;
    }
  }
}

// Bind to Global Scope
globalThis.ValidationRule = ValidationRule;
globalThis.RequiredRule = RequiredRule;
globalThis.MaxLengthRule = MaxLengthRule;
globalThis.MinLengthRule = MinLengthRule;
globalThis.MinRule = MinRule;
globalThis.MaxRule = MaxRule;
globalThis.ChoiceRule = ChoiceRule;
globalThis.RegexRule = RegexRule;
globalThis.CustomCallbackRule = CustomCallbackRule;
globalThis.FunctionalCallbackRule = FunctionalCallbackRule;
