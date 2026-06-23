'use strict';

/**
 * schema_diff.js
 *
 * Pre-flight analyzer that compares two DazzlingDB schema JSON files and
 * produces a structured, human-readable change report.
 *
 * Usage:
 *   node scripts/analyzers/schema_diff.js <oldSchemaPath> <newSchemaPath>
 *
 * Strategy:
 *   Primary  — git diff --no-index (fast, reliable for version-controlled files)
 *   Fallback — pure Node.js deep JSON comparison (works anywhere)
 *
 * Output:
 *   ➕ NEW TABLES      — present in new, absent in old  → need full AI documentation
 *   🗑️  REMOVED TABLES  — present in old, absent in new  → docs should be deprecated
 *   📝 MODIFIED TABLES — same key, but columns or relations changed
 *   ✅ UNCHANGED TABLES — identical in both schemas
 */

const fs            = require('fs');
const path          = require('path');
const childProcess  = require('child_process');

// ─── CLI Arguments ──────────────────────────────────────────────────────────────
const [,, oldSchemaPath, newSchemaPath] = process.argv;

if (!oldSchemaPath || !newSchemaPath) {
    console.error('Usage: node schema_diff.js <oldSchemaPath> <newSchemaPath>');
    process.exit(1);
}

if (!fs.existsSync(oldSchemaPath)) {
    console.error(`❌ Old schema not found: ${oldSchemaPath}`);
    process.exit(1);
}

if (!fs.existsSync(newSchemaPath)) {
    console.error(`❌ New schema not found: ${newSchemaPath}`);
    process.exit(1);
}

// ─── Load Schemas ───────────────────────────────────────────────────────────────
const oldSchema = JSON.parse(fs.readFileSync(oldSchemaPath, 'utf8'));
const newSchema = JSON.parse(fs.readFileSync(newSchemaPath, 'utf8'));

// ─── Extract flat table maps {tableName → tableDef} ─────────────────────────────
function extractTables(schema) {
    const tables = {};
    for (const [, catDef] of Object.entries(schema.categories || {})) {
        for (const [tableName, tableDef] of Object.entries(catDef.tables || {})) {
            tables[tableName] = tableDef;
        }
    }
    return tables;
}

const oldTables = extractTables(oldSchema);
const newTables = extractTables(newSchema);

const oldNames = new Set(Object.keys(oldTables));
const newNames = new Set(Object.keys(newTables));

// ─── Categorize Tables ───────────────────────────────────────────────────────────
const added     = [...newNames].filter(n => !oldNames.has(n));
const removed   = [...oldNames].filter(n => !newNames.has(n));
const common    = [...newNames].filter(n => oldNames.has(n));

// ─── Deep Column/Relation Diff for Modified Tables ──────────────────────────────
function diffColumns(oldCols, newCols) {
    oldCols = oldCols || {};
    newCols = newCols || {};
    const oldKeys = new Set(Object.keys(oldCols));
    const newKeys = new Set(Object.keys(newCols));

    const addedCols   = [...newKeys].filter(k => !oldKeys.has(k));
    const removedCols = [...oldKeys].filter(k => !newKeys.has(k));
    const changedCols = [...newKeys].filter(k => oldKeys.has(k) && JSON.stringify(oldCols[k]) !== JSON.stringify(newCols[k]));

    return { addedCols, removedCols, changedCols };
}

function diffRelations(oldRels, newRels) {
    oldRels = oldRels || {};
    newRels = newRels || {};
    const oldKeys = new Set(Object.keys(oldRels));
    const newKeys = new Set(Object.keys(newRels));

    const addedRels   = [...newKeys].filter(k => !oldKeys.has(k));
    const removedRels = [...oldKeys].filter(k => !newKeys.has(k));
    const changedRels = [...newKeys].filter(k => oldKeys.has(k) && JSON.stringify(oldRels[k]) !== JSON.stringify(newRels[k]));

    return { addedRels, removedRels, changedRels };
}

const modifiedTables   = [];
const unchangedTables  = [];

for (const tableName of common) {
    const oldDef = oldTables[tableName];
    const newDef = newTables[tableName];

    const colDiff = diffColumns(oldDef.columns, newDef.columns);
    const relDiff = diffRelations(oldDef.relations, newDef.relations);

    const hasChanges =
        colDiff.addedCols.length   > 0 ||
        colDiff.removedCols.length > 0 ||
        colDiff.changedCols.length > 0 ||
        relDiff.addedRels.length   > 0 ||
        relDiff.removedRels.length > 0 ||
        relDiff.changedRels.length > 0;

    if (hasChanges) {
        modifiedTables.push({ tableName, colDiff, relDiff });
    } else {
        unchangedTables.push(tableName);
    }
}

// ─── Try git diff for raw output (informational only) ───────────────────────────
let gitDiffAvailable = false;
let gitRawSummary    = '';
try {
    childProcess.execSync('git --version', { stdio: 'ignore' });
    const rawDiff = childProcess.execSync(
        `git diff --no-index --stat "${oldSchemaPath}" "${newSchemaPath}"`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    );
    gitDiffAvailable = true;
    gitRawSummary    = rawDiff.trim();
} catch (_) {
    // git diff exits non-zero when differences exist — that's expected
    // Check if the error has output (means git ran but files differ)
    try {
        const result = childProcess.spawnSync(
            'git', ['diff', '--no-index', '--stat', oldSchemaPath, newSchemaPath],
            { encoding: 'utf8' }
        );
        if (result.stdout) {
            gitDiffAvailable = true;
            gitRawSummary    = result.stdout.trim();
        }
    } catch (_2) {
        gitDiffAvailable = false;
    }
}

// ─── Report ──────────────────────────────────────────────────────────────────────
const oldLabel = path.basename(oldSchemaPath);
const newLabel = path.basename(newSchemaPath);

console.log('\n══════════════════════════════════════════════════════════════');
console.log(`   Schema Diff Report`);
console.log(`   ${oldLabel}  →  ${newLabel}`);
console.log('══════════════════════════════════════════════════════════════\n');

if (gitDiffAvailable && gitRawSummary) {
    console.log('📂 Git Diff Summary:');
    console.log('   ' + gitRawSummary.replace(/\n/g, '\n   '));
    console.log('');
}

// NEW tables
if (added.length > 0) {
    console.log(`➕ NEW TABLES (${added.length}) — Need full AI documentation:`);
    added.forEach(t => console.log(`   + ${t}`));
} else {
    console.log('➕ NEW TABLES: none');
}

console.log('');

// REMOVED tables
if (removed.length > 0) {
    console.log(`🗑️  REMOVED TABLES (${removed.length}) — Docs should be deprecated:`);
    removed.forEach(t => console.log(`   - ${t}`));
} else {
    console.log('🗑️  REMOVED TABLES: none');
}

console.log('');

// MODIFIED tables
if (modifiedTables.length > 0) {
    console.log(`📝 MODIFIED TABLES (${modifiedTables.length}) — Column or relation changes:`);
    for (const { tableName, colDiff, relDiff } of modifiedTables) {
        console.log(`\n   ${tableName}`);
        colDiff.addedCols.forEach(c   => console.log(`     + column: ${c}`));
        colDiff.removedCols.forEach(c => console.log(`     - column: ${c}`));
        colDiff.changedCols.forEach(c => console.log(`     ~ column changed: ${c}`));
        relDiff.addedRels.forEach(r   => console.log(`     + relation: ${r}`));
        relDiff.removedRels.forEach(r => console.log(`     - relation: ${r}`));
        relDiff.changedRels.forEach(r => console.log(`     ~ relation changed: ${r}`));
    }
} else {
    console.log('📝 MODIFIED TABLES: none');
}

console.log('');

// UNCHANGED tables
console.log(`✅ UNCHANGED TABLES (${unchangedTables.length}) — No documentation update needed.`);

// ─── Final Summary ───────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════');
console.log('   Action Summary');
console.log('══════════════════════════════════════════════════════════════');

const noChanges = added.length === 0 && removed.length === 0 && modifiedTables.length === 0;

if (noChanges) {
    console.log('   ✅ Schemas are identical. No documentation changes required.\n');
} else {
    if (added.length > 0)          console.log(`   ➕ Write full documentation for ${added.length} new table(s).`);
    if (removed.length > 0)        console.log(`   🗑️  Deprecate documentation for ${removed.length} removed table(s).`);
    if (modifiedTables.length > 0) console.log(`   📝 Update column/relation sections for ${modifiedTables.length} modified table(s).`);
    console.log('\n   Run merge_schema_docs.js to regenerate, then run_verification.js to confirm.\n');
}

process.exit(0);
