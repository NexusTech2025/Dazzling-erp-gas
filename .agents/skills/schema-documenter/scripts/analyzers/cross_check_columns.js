'use strict';

/**
 * cross_check_columns.js
 *
 * Authoritative field-level cross-check between a schema JSON and its
 * generated Markdown documentation.
 *
 * For every table in the schema:
 *   1. Extracts the canonical column list from the JSON
 *   2. Parses the column table rows from the generated .md file
 *   3. Compares them exactly — reports missing, extra, and mismatched names
 *
 * Usage:
 *   node scripts/analyzers/cross_check_columns.js <schemaPath> <docsTablesDir>
 */

const fs   = require('fs');
const path = require('path');

const [,, schemaPath, docsTablesDir] = process.argv;

if (!schemaPath || !docsTablesDir) {
    console.error('Usage: node cross_check_columns.js <schemaPath> <docsTablesDir>');
    process.exit(1);
}

const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

// ─── Extract canonical columns from schema ───────────────────────────────────
// Returns { tableName → string[] of column names in schema order }
function extractSchemaColumns(schema) {
    const map = {};
    const systemCols = Object.keys(schema.systemColumns || {});

    for (const [, catDef] of Object.entries(schema.categories || {})) {
        for (const [tableName, tableDef] of Object.entries(catDef.tables || {})) {
            const userCols  = Object.keys(tableDef.columns || {});
            // System columns are appended by the generator after user columns
            map[tableName]  = [...userCols, ...systemCols];
        }
    }
    return map;
}

// ─── Parse column names from generated Markdown column table ─────────────────
// Looks for lines like: | `col_name` | `type` | ...
function parseMarkdownColumns(mdContent) {
    const cols = [];
    const lines = mdContent.split('\n');
    let inTable = false;

    for (const line of lines) {
        const trimmed = line.trim();

        // Detect column table header
        if (trimmed.startsWith('| Column Name') || trimmed.startsWith('|Column Name')) {
            inTable = true;
            continue;
        }
        if (inTable) {
            // Skip separator line
            if (trimmed.startsWith('|---') || trimmed.startsWith('| ---')) continue;
            // Stop at blank line or next section header
            if (!trimmed.startsWith('|') || trimmed === '') {
                break;
            }
            // Extract the first cell value: | `col_name` | ...
            const match = trimmed.match(/^\|\s*`([^`]+)`/);
            if (match) {
                cols.push(match[1]);
            }
        }
    }
    return cols;
}

// ─── Run cross-check ──────────────────────────────────────────────────────────
const schemaColumns = extractSchemaColumns(schema);

let tablesChecked  = 0;
let tablesPassed   = 0;
let tablesFailed   = 0;
const failures     = [];

console.log('\n══════════════════════════════════════════════════════════════');
console.log('   Field-Level Cross-Check: Schema JSON ↔ Markdown Docs');
console.log('══════════════════════════════════════════════════════════════\n');

for (const [tableName, schemaColNames] of Object.entries(schemaColumns)) {
    const mdPath = path.join(docsTablesDir, `${tableName}.md`);

    if (!fs.existsSync(mdPath)) {
        failures.push({ tableName, issue: 'NO_MD_FILE', detail: 'Markdown file not found in docs directory.' });
        tablesFailed++;
        tablesChecked++;
        continue;
    }

    const mdContent  = fs.readFileSync(mdPath, 'utf8');
    const mdColNames = parseMarkdownColumns(mdContent);

    const schemaSet  = new Set(schemaColNames);
    const mdSet      = new Set(mdColNames);

    const missing    = schemaColNames.filter(c => !mdSet.has(c));   // in schema, not in doc
    const extra      = mdColNames.filter(c => !schemaSet.has(c));   // in doc, not in schema

    tablesChecked++;

    if (missing.length === 0 && extra.length === 0) {
        tablesPassed++;
        console.log(`   ✅ ${tableName} (${schemaColNames.length} columns)`);
    } else {
        tablesFailed++;
        console.log(`   ❌ ${tableName}`);
        if (missing.length > 0) {
            missing.forEach(c => console.log(`         MISSING in doc   : ${c}`));
        }
        if (extra.length > 0) {
            extra.forEach(c => console.log(`         EXTRA in doc     : ${c}`));
        }
        failures.push({ tableName, missing, extra });
    }
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════');
console.log('   Summary');
console.log('══════════════════════════════════════════════════════════════');
console.log(`   Tables checked : ${tablesChecked}`);
console.log(`   Passed         : ${tablesPassed}`);
console.log(`   Failed         : ${tablesFailed}`);

if (tablesFailed === 0) {
    console.log('\n   🎉 ALL TABLES: Field names match perfectly between schema and docs.\n');
    process.exit(0);
} else {
    console.log(`\n   ⚠️  ${tablesFailed} table(s) have field discrepancies. Fix docs before packaging.\n`);
    process.exit(1);
}
