import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic loading: read and evaluate DateCmp.js in the global scope
const dateCmpPath = path.resolve(__dirname, '../utils/DateCmp.js');
const dateCmpCode = fs.readFileSync(dateCmpPath, 'utf8') + `
globalThis.DateComparisonPolicy = DateComparisonPolicy;
globalThis.DateComparator = DateComparator;
globalThis.isDate = isDate;
`;
vm.runInThisContext(dateCmpCode);

// 1. Define the object containing the findOne method
const studentRepository = {
    // Mocking the all() method as specified
    all() {
        return [
            {
                student_id: "S001",
                batch_id: "B101",
                datetime: new Date("2026-03-15 00:00:00") // Local midnight: 2026-03-15 00:00:00 IST
            },
            {
                student_id: "S002",
                batch_id: "B101",
                datetime: new Date("2026-03-16 00:00:00") // Local midnight: 2026-03-16 00:00:00 IST
            },
            {
                student_id: "S003",
                batch_id: "B102",
                datetime: new Date("2026-03-15 00:00:00") // Local midnight: 2026-03-15 00:00:00 IST
            }
        ];
    },

    // Refactored findOne method using DateComparator
    findOne(filters = {}) {
        const all = this.all();
        return all.find(row => {
            return Object.entries(filters).every(([key, value]) => {
                const rowVal = row[key];
                if (isDate(rowVal) || (typeof value === 'string' && value.match(/^(\d{4})[-/]/))) {
                    const hasDateType = isDate(rowVal) || (typeof rowVal === 'string' && rowVal.match(/^(\d{4})[-/]/));
                    if (hasDateType) {
                        return DateComparator.compare(rowVal, value, DateComparisonPolicy.DATE_ONLY);
                    }
                }
                return rowVal === value;
            });
        }) || null;
    }
};

// 2. Test Suite
test('studentRepository.findOne() tests', async (t) => {

    await t.test('should return null if no records match the criteria', () => {
        const result = studentRepository.findOne({ student_id: 'NON_EXISTENT' });
        assert.strictEqual(result, null);
    });

    await t.test('should match by standard string fields (student_id)', () => {
        const result = studentRepository.findOne({ student_id: 'S002' });
        assert.notStrictEqual(result, null);
        assert.strictEqual(result.student_id, 'S002');
        assert.strictEqual(result.batch_id, 'B101');
    });

    await t.test('timezone-safe date matching: should successfully find S002 using local midnight date', () => {
        const result = studentRepository.findOne({ datetime: '2026-03-16' });

        console.log(`\n--- TIMEZONE-SAFE DATE MATCHING ---`);
        const rowDate = studentRepository.all()[1].datetime;
        console.log(`Original Local Midnight Date: ${rowDate.toString()}`);
        console.log(`ISO UTC String:               ${rowDate.toISOString()}`);
        console.log(`Filter Query Date String:     2026-03-16`);
        console.log(`Result of lookup:             ${result === null ? '❌ null (FAILED TO FIND)' : `✅ ${result.student_id} (FOUND)`}`);
        console.log(`---------------------------------\n`);

        assert.notStrictEqual(result, null);
        assert.strictEqual(result.student_id, 'S002');
    });

    await t.test('should return the first record if empty filters are passed', () => {
        const result = studentRepository.findOne({});
        assert.notStrictEqual(result, null);
        assert.strictEqual(result.student_id, 'S001'); // First item in array
    });
});

test('DateComparator strategy checks', async (t) => {

    await t.test('DATE_ONLY matches varying input string formats timezone-safely', () => {
        const dtObj = new Date("2026-03-16 00:00:00");

        // Padded, unpadded, slash formats, and date-times
        assert.strictEqual(DateComparator.compare(dtObj, "2026-03-16", DateComparisonPolicy.DATE_ONLY), true);
        assert.strictEqual(DateComparator.compare(dtObj, "2026-3-16", DateComparisonPolicy.DATE_ONLY), true);
        assert.strictEqual(DateComparator.compare(dtObj, "2026/03/16", DateComparisonPolicy.DATE_ONLY), true);
        assert.strictEqual(DateComparator.compare(dtObj, "2026-03-16T15:30:00.000Z", DateComparisonPolicy.DATE_ONLY), true);
        assert.strictEqual(DateComparator.compare(dtObj, "2026-03-17", DateComparisonPolicy.DATE_ONLY), false);
    });

    await t.test('TIME_ONLY matches wall-clock times locally', () => {
        const time1 = new Date("2026-03-16 08:30:00");
        const time2 = new Date("2026-03-16 08:30:00");
        const time3 = new Date("2026-03-16 09:15:00");

        assert.strictEqual(DateComparator.compare(time1, time2, DateComparisonPolicy.TIME_ONLY), true);
        assert.strictEqual(DateComparator.compare(time1, "2026-03-16 08:30:00", DateComparisonPolicy.TIME_ONLY), true);
        assert.strictEqual(DateComparator.compare(time1, "08:30", DateComparisonPolicy.TIME_ONLY), true); // matches HH:mm alone
        assert.strictEqual(DateComparator.compare(time1, time3, DateComparisonPolicy.TIME_ONLY), false);
    });

    await t.test('FULL_DATETIME matches complete timestamps', () => {
        const t1 = new Date("2026-03-16 10:30:00");
        const t2 = new Date("2026-03-16 10:30:00");

        assert.strictEqual(DateComparator.compare(t1, t2, DateComparisonPolicy.FULL_DATETIME), true);
        assert.strictEqual(DateComparator.compare(t1, t2.getTime(), DateComparisonPolicy.FULL_DATETIME), true); // Date-to-Timestamp
        assert.strictEqual(DateComparator.compare(t1, "2026-03-16 10:30:01", DateComparisonPolicy.FULL_DATETIME), false);
    });

    await t.test('Type Validation handles unparseable date strings safely', () => {
        const dtObj = new Date("2026-03-16 00:00:00");

        // Returns false instead of throwing a runtime error
        assert.strictEqual(DateComparator.compare(dtObj, "invalid-date-string", DateComparisonPolicy.DATE_ONLY), false);
        assert.strictEqual(DateComparator.compare("invalid-date-1", "invalid-date-2", DateComparisonPolicy.DATE_ONLY), false);
        assert.strictEqual(DateComparator.compare(dtObj, null, DateComparisonPolicy.DATE_ONLY), false);
    });
});
