/**
 * @file Utils.js
 * Core utility and helper functions for SheetDB.
 */

/**
 * Predicate function to safely check if a value is a valid Date object.
 * Secure against cross-realm/GAS library prototype scoping boundaries.
 * 
 * @param {*} val - The value to inspect.
 * @return {boolean} True if the value is a valid Date object, false otherwise.
 */
function isDate(val) {
  // 1. Guard against null or undefined before reading properties
  if (val === null || val === undefined) return false;
  
  // 2. Bypass local prototype overrides to extract native underlying type slot
  const isDateStructure = Object.prototype.toString.call(val) === '[object Date]';
  
  // 3. Ensure the underlying internal time value is numerical (filters out 'Invalid Date')
  return isDateStructure && !isNaN(val.getTime());
}

// Export to Global Namespace
globalThis.isDate = isDate;
