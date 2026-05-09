/**
 * @file PredicateBuilder.js
 * Component: Query Engine - Filtering Logic
 * 
 * Responsibility:
 * - Converts JSON 'where' clauses into JavaScript filter functions.
 * - Supports complex operators (eq, gt, contains, in, etc).
 */

const PredicateBuilder = (function() {

  /**
   * Main entry point for building a predicate function.
   * @param {Object} where - The sanitized where clause.
   * @returns {Function} A predicate function (row) => boolean.
   */
  function build(where) {
    if (!where || Object.keys(where).length === 0) {
      return () => true; // No filter
    }

    return function(row) {
      // Evaluate all conditions (Defaulting to AND logic)
      return Object.entries(where).every(([field, condition]) => {
        const rowValue = row[field];

        // 1. Simple Equality check
        if (typeof condition !== 'object' || condition === null) {
          return rowValue === condition;
        }

        // 2. Operator-based check
        const { operator, value } = condition;
        return _evaluateOperator(operator, rowValue, value);
      });
    };
  }

  /**
   * Internal: Evaluates a single operator logic.
   * @private
   */
  function _evaluateOperator(op, rowValue, targetValue) {
    switch (op.toLowerCase()) {
      case "eq":       return rowValue === targetValue;
      case "neq":      return rowValue !== targetValue;
      case "gt":       return rowValue > targetValue;
      case "gte":      return rowValue >= targetValue;
      case "lt":       return rowValue < targetValue;
      case "lte":      return rowValue <= targetValue;
      case "contains": return String(rowValue).toLowerCase().includes(String(targetValue).toLowerCase());
      case "in":       return Array.isArray(targetValue) && targetValue.includes(rowValue);
      case "between":  return Array.isArray(targetValue) && rowValue >= targetValue[0] && rowValue <= targetValue[1];
      default:         return false;
    }
  }

  return {
    build: build
  };

})();
