/**
 * @file PredicateBuilder.js
 * Component: Query Engine - Filtering Logic
 * 
 * Responsibility:
 * - Converts JSON 'where' clauses into JavaScript filter functions.
 * - Supports complex operators (eq, gt, contains, in, etc).
 */

const PredicateBuilder = (function () {

  /**
   * Main entry point for building a predicate function.
   * @param {Object} where - The sanitized where clause.
   * @returns {Function} A predicate function (row) => boolean.
   */
  function build(where) {
    if (!where || Object.keys(where).length === 0) {
      return () => true; // No filter
    }

    return function (row) {
      // Evaluate all conditions (Defaulting to AND logic)
      return Object.entries(where).every(([field, condition]) => {
        const rowValue = row[field];

        // 1. Simple Equality check
        if (typeof condition !== 'object' || condition === null) {
          if (SheetDB.isDate(rowValue) && typeof condition === 'string') {
            return rowValue.toISOString().split('T')[0] === condition.split('T')[0];
          }
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
    let rVal = rowValue;
    let tVal = targetValue;

    if (SheetDB.isDate(rowValue) && typeof targetValue === 'string') {
      rVal = rowValue.toISOString().split('T')[0];
      tVal = targetValue.split('T')[0];
    }

    switch (op.toLowerCase()) {
      case "eq": return rVal === tVal;
      case "neq": return rVal !== tVal;
      case "gt": return rVal > tVal;
      case "gte": return rVal >= tVal;
      case "lt": return rVal < tVal;
      case "lte": return rVal <= tVal;
      case "contains": return String(rVal).toLowerCase().includes(String(tVal).toLowerCase());
      case "in": return Array.isArray(tVal) && tVal.includes(rVal);
      case "between": return Array.isArray(tVal) && rVal >= tVal[0] && rVal <= tVal[1];
      default: return false;
    }
  }

  return {
    build: build
  };

})();
