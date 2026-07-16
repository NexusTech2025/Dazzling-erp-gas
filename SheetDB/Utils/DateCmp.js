/**
 * DazzlingDB Date & Time Comparison Engine
 * Decoupled Wall-Clock timezone-safe normalization layer.
 */



/**
 * DazzlingDB Date & Time Comparison Engine
 * Hardened Local Clock pattern with integrated custom exception pipelines.
 * Refactored into a highly decoupled, modular helper structure.
 */

const DateComparisonPolicy = {
    DATE_ONLY: 'DATE_ONLY',
    TIME_ONLY: 'TIME_ONLY',
    FULL_DATETIME: 'FULL_DATETIME'
};



const DateTimeErrorCodeBase = {
    ERR_UNPARSEABLE: 'ERR_UNPARSEABLE',
    ERR_TIME_OUT_OF_RANGE: 'ERR_TIME_OUT_OF_RANGE',
    ERR_DATETIME_OUT_OF_RANGE: 'ERR_DATETIME_OUT_OF_RANGE',
    ERR_EMPTY_STRING: 'ERR_EMPTY_STRING',
    ERR_NULL_VALUE: 'ERR_NULL_VALUE',
    ERR_UNSUPPORTED_TYPE: 'ERR_UNSUPPORTED_TYPE',
    ERR_INVALID_TIMESTAMP: 'ERR_INVALID_TIMESTAMP'
};

// Define a clean, non-enumerable helper function on the object layer
Object.defineProperty(DateTimeErrorCodeBase, 'getAllCodes', {
    value: function () {
        // Filter out functions if any other properties are added down the line
        return Object.values(this).filter(val => typeof val === 'string');
    },
    enumerable: false, // Prevents the method itself from leaking into loops
    writable: false,
    configurable: false
});

/**
 * Authoritative Frozen Enum Reference
 */
const DateTimeErrorCode = Object.freeze(DateTimeErrorCodeBase);


/**
 * Custom defensive Exception Class for DazzlingDB Date-Time execution boundaries.
 * Inherits directly from JavaScript's native Error object to preserve stack traces.
 */
class DateTimeError extends Error {
    /**
     * @param {string} message - Descriptive error message
     * @param {string} code - Structured error code for client/API parsing boundaries
     * @param {Object} [context={}] - Structural parameters/metadata contextualizing the crash
     */
    constructor(message, code, context = {}) {
        super(`[DateTimeError: ${code}] ${message}`);
        this.name = 'DateTimeError';
        this.code = code;
        this.context = {
            timestamp: new Date().toISOString(),
            ...context
        };
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

const DateComparator = {
    strategies: {
        [DateComparisonPolicy.DATE_ONLY]: (d1, d2) => {
            const y1 = d1.getFullYear();
            const m1 = String(d1.getMonth() + 1).padStart(2, '0');
            const day1 = String(d1.getDate()).padStart(2, '0');

            const y2 = d2.getFullYear();
            const m2 = String(d2.getMonth() + 1).padStart(2, '0');
            const day2 = String(d2.getDate()).padStart(2, '0');

            return `${y1}-${m1}-${day1}` === `${y2}-${m2}-${day2}`;
        },
        [DateComparisonPolicy.TIME_ONLY]: (d1, d2) => {
            const h1 = String(d1.getHours()).padStart(2, '0');
            const min1 = String(d1.getMinutes()).padStart(2, '0');

            const h2 = String(d2.getHours()).padStart(2, '0');
            const min2 = String(d2.getMinutes()).padStart(2, '0');

            return `${h1}:${min1}` === `${h2}:${min2}`;
        },
        [DateComparisonPolicy.FULL_DATETIME]: (d1, d2) => {
            return d1.getTime() === d2.getTime();
        }
    },

    /**
     * Reusable helper to check if a value is a native Date or a date-like string.
     * @param {*} val - Value to check.
     * @returns {boolean} True if date-like.
     */
    isDateLike(val) {
        return isDate(val) || (typeof val === 'string' && !!val.match(/^(\d{4})[-/]/));
    },

    /**
     * Formats a native Date object into a YYYY-MM-DD local timezone calendar date string.
     * getMonth() is 0-indexed in JS (0 = January), so +1 is required.
     * @param {Date} d - The Date object.
     * @returns {string} Mapped "YYYY-MM-DD" local calendar date string.
     */
    toLocaleDateString(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    },

    /**
     * Normalizes any date-like value timezone-safely into a YYYY-MM-DD format string.
     * @param {*} val - The date object or string.
     * @returns {string} Standardized date representation.
     */
    getLocalDateString(val) {
        const d = this._normalizeToDate(val);
        return this.toLocaleDateString(d);
    },

    /**
     * Maps 12-Hour AM/PM adjustments to local 24-hour military clock values.
     * @private
     * @param {number} hr - Parsed hour element
     * @param {string|null} ampm - Case-insensitive meridian indicator
     * @returns {number} Normalized hour
     */
    _adjustHourForMeridian(hr, ampm) {
        if (!ampm) return hr;
        const upperMeridian = ampm.toUpperCase();
        if (upperMeridian === 'PM' && hr < 12) return hr + 12;
        if (upperMeridian === 'AM' && hr === 12) return 0;
        return hr;
    },

    /**
     * Strategy A: Modular Standalone Time-Only string parser.
     * @private
     * @param {RegExpMatchArray} match - Regex match result array
     * @param {string} cleanVal - Cleaned raw input string
     * @param {string} operandName - Name of evaluated parameter
     * @returns {Date} Normalized 1970 baseline Date object
     * @throws {DateTimeError}
     */
    _parseStandaloneTime(match, cleanVal, operandName) {
        let hr = parseInt(match[1], 10);
        const min = parseInt(match[2], 10);
        const sec = match[3] ? parseInt(match[3], 10) : 0;
        const ampm = match[4] ? match[4].toUpperCase() : null;

        if (hr < 0 || hr > (ampm ? 12 : 23) || min < 0 || min > 59 || sec < 0 || sec > 59) {
            throw new DateTimeError(
                `Time component values are out of logical clock range in '${cleanVal}'`,
                DateTimeErrorCode.ERR_TIME_OUT_OF_RANGE,
                { rawValue: cleanVal, parsed: { hr, min, sec, ampm }, operandName }
            );
        }

        hr = this._adjustHourForMeridian(hr, ampm);
        return new Date(1970, 0, 1, hr, min, sec);
    },

    /**
     * Strategy B: Modular Full Date-Time with flexible splitters parser.
     * @private
     * @param {RegExpMatchArray} match - Regex match result array
     * @param {string} cleanVal - Cleaned raw input string
     * @param {string} operandName - Name of evaluated parameter
     * @returns {Date} Instantiated local Date object
     * @throws {DateTimeError}
     */
    _parseFullDateTime(match, cleanVal, operandName) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1;
        const day = parseInt(match[3], 10);

        let hr = match[4] ? parseInt(match[4], 10) : 0;
        const min = match[5] ? parseInt(match[5], 10) : 0;
        const sec = match[6] ? parseInt(match[6], 10) : 0;
        const ampm = match[7] ? match[7].toUpperCase() : null;

        if (month < 0 || month > 11 || day < 1 || day > 31 || hr < 0 || hr > (ampm ? 12 : 23) || min < 0 || min > 59 || sec < 0 || sec > 59) {
            throw new DateTimeError(
                `Date-Time parameter values are out of standard calendar ranges in '${cleanVal}'`,
                DateTimeErrorCode.ERR_DATETIME_OUT_OF_RANGE,
                { rawValue: cleanVal, parsed: { year, month: month + 1, day, hr, min, sec, ampm }, operandName }
            );
        }

        hr = this._adjustHourForMeridian(hr, ampm);
        return new Date(year, month, day, hr, min, sec);
    },

    /**
     * Converts raw string, number, or Date inputs timezone-safely into normalized local Dates.
     * Throws explicit DateTimeError instances if elements are unparseable or out of logical range.
     * @private
     * @param {*} val - Payload to normalize
     * @param {string} [operandName='value'] - Descriptive name of parameter undergoing parsing check
     * @returns {Date}
     * @throws {DateTimeError}
     */
    _normalizeToDate(val, operandName = 'value') {
        if (val === null || val === undefined) {
            throw new DateTimeError(
                `Operand '${operandName}' is null or undefined.`,
                DateTimeErrorCode.ERR_NULL_VALUE,
                { operandName }
            );
        }
        if (isDate(val)) return val;

        let dt = null;
        if (typeof val === 'string') {
            const cleanVal = val.trim();
            if (cleanVal === '') {
                throw new DateTimeError(
                    `Operand '${operandName}' is an empty string.`,
                    DateTimeErrorCode.ERR_EMPTY_STRING,
                    { operandName }
                );
            }

            // Strategy A: Standalone Time Only ("08:30 PM", "20:30", "4:20 pm")
            const standaloneTimeMatch = cleanVal.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([aApPmM]{2})?$/);
            if (standaloneTimeMatch) {
                return this._parseStandaloneTime(standaloneTimeMatch, cleanVal, operandName);
            }

            // Strategy B: Full Date-Time with flexible splitters (ISO, spaces, AM/PM markers)
            const fullMatch = cleanVal.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?\s*([aApPmM]{2})?)?/);
            if (fullMatch) {
                return this._parseFullDateTime(fullMatch, cleanVal, operandName);
            }

            // Strategy C: Native Fallback parsing
            dt = new Date(cleanVal);

        } else if (typeof val === 'number') {
            if (!isFinite(val)) {
                throw new DateTimeError(
                    `Numeric timestamp is infinite or unparseable: ${val}`,
                    DateTimeErrorCode.ERR_INVALID_TIMESTAMP,
                    { rawValue: val }
                );
            }
            dt = new Date(val);
        } else {
            throw new DateTimeError(
                `Unsupported parameter type passed for Date translation: ${typeof val}`,
                DateTimeErrorCode.ERR_UNSUPPORTED_TYPE,
                { rawValue: val, type: typeof val }
            );
        }

        if (!dt || !isDate(dt)) {
            throw new DateTimeError(
                `Failed to parse date operand '${operandName}': '${val}'`,
                DateTimeErrorCode.ERR_UNPARSEABLE,
                { rawValue: val }
            );
        }

        return dt;
    },

    /**
         * Compares two dates under the specified policy.
         * Safe for database filter engine loops—intercepts formatting errors gracefully.
         * @param {*} val1 - Original value
         * @param {*} val2 - Value to compare against
         * @param {string} policy - DATE_ONLY | TIME_ONLY | FULL_DATETIME
         * @returns {boolean} False if any operand is invalid or policy mismatches
         */
    compare(val1, val2, policy = DateComparisonPolicy.DATE_ONLY) {
        try {
            const d1 = this._normalizeToDate(val1, 'val1');
            const d2 = this._normalizeToDate(val2, 'val2');

            const strategy = this.strategies[policy];
            if (!strategy) {
                throw new DateTimeError(
                    `Unsupported comparison policy target execution requested: '${policy}'`,
                    'ERR_INVALID_POLICY',
                    { policy }
                );
            }
            return strategy(d1, d2);
        } catch (error) {
            // If it's an expected unparseable or out-of-range date error, fail the match safely
            if (error instanceof DateTimeError &&
                DateTimeErrorCodeBase.getAllCodes().includes(error.code)) {
                return false;
            }
            // Propagate critical system or policy errors upwards
            throw error;
        }
    }
};

// Export to Global Namespace for DazzlingDB / SheetDB ORM usage
globalThis.DateComparisonPolicy = DateComparisonPolicy;
globalThis.DateComparator = DateComparator;
