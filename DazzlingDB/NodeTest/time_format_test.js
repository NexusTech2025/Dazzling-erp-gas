/**
 * DazzlingDB Date & Time Comparison Engine
 * Decoupled Wall-Clock timezone-safe normalization layer.
 */

import test from 'node:test';
import assert from 'node:assert';

/**
 * DazzlingDB Date & Time Comparison Engine
 * Hardened Local Clock pattern with integrated custom exception pipelines.
 * Refactored into a highly decoupled, modular helper structure.
 */

export const DateComparisonPolicy = {
    DATE_ONLY: 'DATE_ONLY',
    TIME_ONLY: 'TIME_ONLY',
    FULL_DATETIME: 'FULL_DATETIME'
};

/**
 * Custom defensive Exception Class for DazzlingDB Date-Time execution boundaries.
 * Inherits directly from JavaScript's native Error object to preserve stack traces.
 */
export class DateTimeError extends Error {
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

/**
 * Cross-realm safe reflection check for JS Date object integrity.
 * @param {*} val - Value to check
 * @returns {boolean}
 */
export function isDate(val) {
    return val instanceof Date && !isNaN(val.getTime());
}

export const DateComparator = {
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
                'ERR_TIME_OUT_OF_RANGE',
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
                'ERR_DATETIME_OUT_OF_RANGE',
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
                'ERR_NULL_VALUE',
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
                    'ERR_EMPTY_STRING',
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
                    'ERR_INVALID_TIMESTAMP',
                    { rawValue: val }
                );
            }
            dt = new Date(val);
        } else {
            throw new DateTimeError(
                `Unsupported parameter type passed for Date translation: ${typeof val}`,
                'ERR_UNSUPPORTED_TYPE',
                { rawValue: val, type: typeof val }
            );
        }

        if (!dt || !isDate(dt)) {
            throw new DateTimeError(
                `Failed to parse date operand '${operandName}': '${val}'`,
                'ERR_UNPARSEABLE',
                { rawValue: val }
            );
        }

        return dt;
    },

    /**
     * Compares two dates under the specified policy.
     * @param {*} val1 - Original value
     * @param {*} val2 - Value to compare against
     * @param {string} policy - DATE_ONLY | TIME_ONLY | FULL_DATETIME
     * @returns {boolean}
     * @throws {DateTimeError}
     */
    compare(val1, val2, policy = DateComparisonPolicy.DATE_ONLY) {
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
    }
};


// =============================



// import { DateComparator, DateComparisonPolicy, isDate } from './DateComparator.js';

// Mock repository container to test findOne method
const mockStudentRepository = {
    all() {
        return [
            { student_id: "S1", batch_id: "B101", datetime: new Date("2026-03-16T08:30:00") },
            { student_id: "S2", batch_id: "B101", datetime: new Date("2026-03-16T20:30:00") },
            { student_id: "S3", batch_id: "B102", datetime: new Date("2026-03-17T12:45:00") }
        ];
    },

    findOne(filters = {}) {
        const all = this.all();
        return all.find(row => {
            return Object.entries(filters).every(([key, value]) => {
                const rowVal = row[key];

                // If the database row holds a Date object, apply normalized comparison
                if (isDate(rowVal)) {
                    // Check standard formats gracefully using the updated DateComparator
                    return DateComparator.compare(rowVal, value, DateComparisonPolicy.DATE_ONLY);
                }
                return rowVal === value;
            });
        }) || null;
    }
};

test('DateComparator Core API Tests', async (t) => {

    await t.test('DATE_ONLY strategy matches timezone-safely', () => {
        const d1 = new Date("2026-03-16T10:30:00");
        const d2 = new Date("2026-03-16T22:15:00");
        assert.strictEqual(DateComparator.compare(d1, d2, DateComparisonPolicy.DATE_ONLY), true);
    });

    await t.test('TIME_ONLY strategy ignores dates and evaluates wall-clocks locally', () => {
        const d1 = new Date("2026-03-16T08:30:00");
        const d2 = new Date("1970-01-01T08:30:00");
        assert.strictEqual(DateComparator.compare(d1, d2, DateComparisonPolicy.TIME_ONLY), true);
    });

    await t.test('FULL_DATETIME strategy verifies point-in-time ticks precisely', () => {
        const d1 = new Date("2026-03-16T08:30:00");
        const d2 = new Date("2026-03-16T08:30:00");
        const d3 = new Date("2026-03-16T08:30:01");
        assert.strictEqual(DateComparator.compare(d1, d2, DateComparisonPolicy.FULL_DATETIME), true);
        assert.strictEqual(DateComparator.compare(d1, d3, DateComparisonPolicy.FULL_DATETIME), false);
    });
});

test('findOne() query routing and dynamic date parsing', async (t) => {

    await t.test('should match correct record using standard date string filters', () => {
        const result = mockStudentRepository.findOne({ datetime: '2026-03-16' });
        assert.notStrictEqual(result, null);
        assert.strictEqual(result.student_id, 'S1'); // S1 is first on March 16th
    });

    await t.test('should return null if no matching records found', () => {
        const result = mockStudentRepository.findOne({ datetime: '2026-04-01' });
        assert.strictEqual(result, null);
    });
});

test('Comprehensive Format Evaluation Matrix (Formats #1 through #11)', async (t) => {
    // Standardized reference moment: 2026-03-16 20:30:00 Local Wall-Clock
    const referenceDate = new Date(2026, 2, 16, 20, 30, 0);

    const matrix = [
        { id: 1, payload: "2026-03-16 08:30:00 AM", policy: DateComparisonPolicy.DATE_ONLY, expected: true, desc: "12-Hour format (Standard Morning)" },
        { id: 2, payload: "2026-03-16 08:30:00 PM", policy: DateComparisonPolicy.DATE_ONLY, expected: true, desc: "12-Hour format (Standard Evening)" },
        { id: 3, payload: "2026-03-16 12:45:00 PM", policy: DateComparisonPolicy.DATE_ONLY, expected: true, desc: "12-Hour format (Noon Edge Case - 12 PM)" },
        { id: 4, payload: "2026-03-16 12:15:00 AM", policy: DateComparisonPolicy.DATE_ONLY, expected: true, desc: "12-Hour format (Midnight Edge Case - 12 AM)" },
        { id: 5, payload: "2026/03/16 4:20 pm", policy: DateComparisonPolicy.DATE_ONLY, expected: true, desc: "12-Hour format (Lowercase am/pm with padding variances)" },
        { id: 6, payload: "08:30 PM", policy: DateComparisonPolicy.TIME_ONLY, expected: true, desc: "Standalone Time-Only 12-Hour String" },
        { id: 7, payload: "2026-03-16 08:30:00", policy: DateComparisonPolicy.DATE_ONLY, expected: true, desc: "24-Hour format (Standard Morning)" },
        { id: 8, payload: "2026-03-16 20:30:00", policy: DateComparisonPolicy.FULL_DATETIME, expected: true, desc: "24-Hour format (Afternoon/Military Time)" },
        { id: 9, payload: "2026-03-16 12:45:00", policy: DateComparisonPolicy.DATE_ONLY, expected: true, desc: "24-Hour format (Noon Hour equivalent)" },
        { id: 10, payload: "2026-03-16 00:15:00", policy: DateComparisonPolicy.DATE_ONLY, expected: true, desc: "24-Hour format (Midnight Hour equivalent)" },
        { id: 11, payload: "20:30", policy: DateComparisonPolicy.TIME_ONLY, expected: true, desc: "Standalone Time-Only 24-Hour String" }
    ];

    for (const testCase of matrix) {
        await t.test(`Verify Format #${testCase.id}: ${testCase.desc}`, () => {
            const actualResult = DateComparator.compare(referenceDate, testCase.payload, testCase.policy);
            assert.strictEqual(
                actualResult,
                testCase.expected,
                `Failed comparison rule checking Format #${testCase.id} [${testCase.payload}] with policy [${testCase.policy}]`
            );
        });
    }
});
