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

/**
 * Safely checks if a value is a thenable (an object or function with a .then method).
 * 
 * @param {*} val - The value to inspect.
 * @return {boolean} True if the value is thenable.
 */
function isThenable(val) {
  return !!(val && (typeof val === 'object' || typeof val === 'function') && typeof val.then === 'function');
}

// Export to Global Namespace
globalThis.isThenable = isThenable;

/**
 * Aligned with the Declarative Strategy Pattern:
 * Maps format layout templates to parsing functions for custom date segment extraction.
 */
const DateParsingStrategies = {
  'YYYY-MM-DD': (segments) => ({
    year: parseInt(segments[0], 10),
    month: parseInt(segments[1], 10),
    day: parseInt(segments[2], 10)
  }),
  'DD-MM-YYYY': (segments) => ({
    day: parseInt(segments[0], 10),
    month: parseInt(segments[1], 10),
    year: parseInt(segments[2], 10)
  })
};

/**
 * Aligned with the Declarative Strategy Pattern:
 * Maps input types to discrete parsing strategies.
 */
const DateInputStrategies = {
  'object': (input) => {
    const year = parseInt(input.year || input.YYYY, 10);
    const month = parseInt(input.month || input.MM, 10);
    const day = parseInt(input.day || input.DD, 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    return { year, month, day };
  },
  'string': (input, options) => {
    const delimiter = options.delimiter || '-';
    const formatLayout = options.format || 'YYYY-MM-DD';
    const cleanStr = input.trim().split('T')[0].trim();
    const escapedDelimiter = delimiter.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const segments = cleanStr.split(new RegExp(escapedDelimiter));
    if (segments.length !== 3) return null;
    const parseStrategy = DateParsingStrategies[formatLayout];
    if (!parseStrategy) return null;
    return parseStrategy(segments);
  }
};

/**
 * Low-level core utility to process dates at the string boundary,
 * completely bypassing native Apps Script host container timezone shifts.
 */
class SheetDBDateTime {
  /**
   * Safe cross-realm Type Discriminator to check for valid Date instances.
   * Prevents prototype loss across GAS library boundaries.
   * @param {*} val - Target payload value.
   * @returns {boolean} True if val is a valid Date instance.
   */
  static _isDate(val) {
    return Object.prototype.toString.call(val) === '[object Date]' && !isNaN(val.getTime());
  }

  /**
   * Generates the dynamic ISO timezone offset string of the script container.
   * @returns {string} Offset string (e.g. "+05:30").
   */
  static getSystemIsoOffset() {
    const offsetMinutes = -new Date().getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absMinutes = Math.abs(offsetMinutes);
    const hours = String(Math.floor(absMinutes / 60)).padStart(2, '0');
    const mins = String(absMinutes % 60).padStart(2, '0');
    return `${sign}${hours}:${mins}`;
  }

  /**
   * Helper utility to safely parse components locally without native ISO shifting triggers.
   * Forces parsing into the invariant UTC plane to guarantee container runtime immunity.
   * @param {string} str - Alphanumeric string.
   * @returns {Date|null} Date instance or null.
   */
  static safeParseStringToDate(str) {
    if (!str || typeof str !== 'string') return null;
    const cleanStr = str.trim();

    const isoMatch = cleanStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (isoMatch) {
      const year = isoMatch[1];
      const month = isoMatch[2].padStart(2, '0');
      const day = isoMatch[3].padStart(2, '0');
      const hour = isoMatch[4] ? isoMatch[4].padStart(2, '0') : '00';
      const min = isoMatch[5] ? isoMatch[5].padStart(2, '0') : '00';
      const sec = isoMatch[6] ? isoMatch[6].padStart(2, '0') : '00';
      
      // Force absolute isolation by attaching the UTC trailing zulu marker
      const utcIsoString = `${year}-${month}-${day}T${hour}:${min}:${sec}.000Z`;
      const dt = new Date(utcIsoString);
      
      return this._isDate(dt) ? dt : null;
    }
    return null;
  }

  /**
   * Hardened Cell Value Text Generator.
   * Utilizes exclusive UTC accessors to format wall-clock text representations without shifting.
   * @param {Date|string} dateVal - Target temporal value.
   * @returns {string} String in format "YYYY-MM-DD HH:mm:ss"
   */
  static toSheetSafeValue(dateVal) {
    let dt = dateVal;
    if (typeof dateVal === 'string') dt = this.safeParseStringToDate(dateVal);
    if (!this._isDate(dt)) return '';

    // Enforce exclusive UTC evaluation to ignore local container clock offsets
    const yyyy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    const hh = String(dt.getUTCHours()).padStart(2, '0');
    const min = String(dt.getUTCMinutes()).padStart(2, '0');
    const ss = String(dt.getUTCSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  }

  /**
   * Parses dates based on custom positional mapping templates and explicit delimiters.
   * Uses Declarative Strategy Pattern for extensible layout parsing.
   * @param {string|Object} input - Target data to extract ("2026/06/18", "18-06-2026", or {year, month, day})
   * @param {Object} [options] - Configuration block
   * @param {string} [options.delimiter="-"] - Target split token character
   * @param {string} [options.format="YYYY-MM-DD"] - Positional sequence layout ("YYYY-MM-DD" or "DD-MM-YYYY")
   * @returns {Object|null} Internal data hash containing {year, month, day} integers
   */
  static parseConfigurableDate(input, options = {}) {
    if (!input) return null;
    
    const type = typeof input;
    const strategy = DateInputStrategies[type];
    if (!strategy) return null;

    const parsed = strategy(input, options);
    if (!parsed) return null;

    const { year, month, day } = parsed;

    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    return { year, month, day };
  }

  /**
   * Processes custom time strings by parsing arbitrary delimiters and extracting explicit meridian states.
   * @param {string|Object} input - Target time segment ("08:15 AM", "20:15:00", or {hour, minute, period})
   * @param {Object} [options] - Configuration block
   * @param {string} [options.delimiter=":"] - Target split token character
   * @param {boolean} [options.requireMeridian=false] - Enforces AM/PM trailing markers
   * @returns {Object|null} Internal data hash containing {hour24, minute, second} integers
   */
  static parseConfigurableTime(input, options = {}) {
    if (!input) return null;

    const delimiter = options.delimiter || ':';
    const requireMeridian = options.requireMeridian || false;

    if (typeof input === 'object') {
      let hour = parseInt(input.hour || input.HH, 10);
      const minute = parseInt(input.minute || input.mm, 10);
      const second = parseInt(input.second || input.ss, 10) || 0;
      const period = String(input.period || input.ampm || '').toUpperCase();

      if (isNaN(hour) || isNaN(minute)) return null;

      if (period === 'PM' && hour < 12) hour += 12;
      if (period === 'AM' && hour === 12) hour = 0;

      return { hour24: hour, minute, second };
    }

    if (typeof input !== 'string') return null;
    const cleanStr = input.trim();

    const meridianMatch = cleanStr.match(/\s*(AM|PM)$/i);
    const period = meridianMatch ? meridianMatch[1].toUpperCase() : null;
    
    if (requireMeridian && !period) return null;

    const numericTimeSequence = cleanStr.replace(/\s*(AM|PM)$/i, '');
    const escapedDelimiter = delimiter.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const segments = numericTimeSequence.split(new RegExp(escapedDelimiter));

    if (segments.length < 2) return null;

    let hour = parseInt(segments[0], 10);
    const minute = parseInt(segments[1], 10);
    const second = segments[2] ? parseInt(segments[2], 10) : 0;

    if (isNaN(hour) || isNaN(minute) || isNaN(second)) return null;

    if (period) {
      if (hour < 1 || hour > 12) return null;
      if (period === 'PM' && hour < 12) hour += 12;
      if (period === 'AM' && hour === 12) hour = 0;
    } else {
      if (hour < 0 || hour > 23) return null;
    }

    if (minute < 0 || minute > 59 || second < 0 || second > 59) return null;

    return { hour24: hour, minute, second };
  }
}

globalThis.SheetDBDateTime = SheetDBDateTime;

/**
 * Resolves relational schema metadata config structures dynamically from active database context.
 */
class SchemaResolver {
  /**
   * Discovers and retrieves the column definition mapping block for a specific sheet.
   * @param {Object} db - The active SheetDB database instance.
   * @param {string} tableName - Collection name to search.
   * @returns {Object|null} Structuring configuration attributes or null if not found.
   */
  static getTableSchema(db, tableName) {
    if (!db || !db._schema || !db._schema.categories) {
      return null;
    }
    for (const catName in db._schema.categories) {
      const tables = db._schema.categories[catName].tables;
      if (tables[tableName]) {
        return tables[tableName];
      }
    }
    return null;
  }
}
globalThis.SchemaResolver = SchemaResolver;


