/**
 * @file Validate.js
 * Utility class containing discrete, pure validation functions.
 * These methods are stateless and handle single-value constraint checks.
 */

class Validate {
  /**
   * Checks basic type adherence.
   * @returns {string|null} Error message or null.
   */
  static type(value, expectedType) {
    if (value === undefined || value === null || value === '') return null;
    
    if (expectedType === 'number') {
      if (typeof value !== 'number' && isNaN(Number(value))) {
        return `Expected a number, got '${typeof value}'.`;
      }
    } else if (expectedType === 'string') {
      if (typeof value !== 'string') {
         return `Expected a string, got '${typeof value}'.`;
      }
    } else if (expectedType === 'boolean') {
      if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
        return `Expected a boolean, got '${typeof value}'.`;
      }
    }
    return null;
  }

  /**
   * Enforces numeric boundaries.
   * @returns {string|null} Error message or null.
   */
  static minMax(value, min, max) {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    if (isNaN(num)) return null; // Let type check handle non-numbers

    if (min !== undefined && num < min) {
      return `Value ${num} is less than minimum allowed (${min}).`;
    }
    if (max !== undefined && num > max) {
      return `Value ${num} is greater than maximum allowed (${max}).`;
    }
    return null;
  }

  /**
   * Enforces string length constraints.
   * @returns {string|null} Error message or null.
   */
  static length(value, minLength, maxLength) {
    if (value === undefined || value === null || value === '') return null;
    const str = String(value);
    
    if (minLength !== undefined && str.length < minLength) {
      return `String length (${str.length}) is less than minimum (${minLength}).`;
    }
    if (maxLength !== undefined && str.length > maxLength) {
      return `String length (${str.length}) exceeds maximum (${maxLength}).`;
    }
    return null;
  }

  /**
   * Evaluates value against a regular expression pattern.
   * @returns {string|null} Error message or null.
   */
  static pattern(value, patternStr) {
    if (value === undefined || value === null || value === '') return null;
    if (!patternStr) return null;
    
    const regex = new RegExp(patternStr);
    if (!regex.test(String(value))) {
      return `Value does not match required pattern.`;
    }
    return null;
  }

  /**
   * Evaluates value against common standard formats.
   * @returns {string|null} Error message or null.
   */
  static format(value, formatType) {
    if (value === undefined || value === null || value === '') return null;
    
    if (formatType === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(String(value))) {
        return `Invalid email format.`;
      }
    }
    // We can add "url", "phone", "uuid" here over time.
    return null;
  }

  /**
   * Enforces value is within an allowed enumeration list.
   * @returns {string|null} Error message or null.
   */
  static choices(value, choicesList) {
    if (value === undefined || value === null || value === '') return null;
    if (!choicesList || !Array.isArray(choicesList)) return null;
    
    if (!choicesList.includes(value)) {
      return `Value '${value}' is not a valid choice. Allowed: ${choicesList.join(', ')}.`;
    }
    return null;
  }
}
