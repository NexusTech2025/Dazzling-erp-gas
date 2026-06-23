'use strict';

/**
 * run_verification.js
 *
 * Comprehensive post-generation verification for the schema-documenter skill.
 *
 * Usage:
 *   node scripts/analyzers/run_verification.js <sourceDocsDir> <targetDocsDir> [--list-new-tables]
 *
 * Flags:
 *   --list-new-tables   Print only the list of tables that have no source doc
 *                       (i.e. need AI synthesis) and exit 0. Skips all other checks.
 *
 * What it checks:
 *   1. Inventory  — counts source vs. target files, detects new tables
 *   2. Fidelity   — section-level prose diff for all tables present in both source & target
 *   3. Placeholders — flags any remaining [TODO: ...] in the entire target output
 *   4. Summary    — overall pass/fail report with clear action items
 */

const fs   = require('fs');
const path = require('path');

// ─── CLI Arguments ──────────────────────────────────────────────────────────────
const args           = process.argv.slice(2);
const sourceDocsDir  = args.find(a => !a.startsWith('--'));
const targetDocsDir  = args.filter(a => !a.startsWith('--'))[1];
const listNewTables  = args.includes('--list-new-tables');

if (!sourceDocsDir || !targetDocsDir) {
    console.error('Usage: node run_verification.js <sourceDocsDir> <targetDocsDir> [--list-new-tables]');
    process.exit(1);
}

// ─── Constants ──────────────────────────────────────────────────────────────────
const PROSE_SECTIONS = [
    'Overview',
    'Business Context',
    'Lifecycle Narrative',
    'Real-World Use Cases',
    'Query Examples',
    'Performance Considerations',
    'Security & Privacy',
    'Future Evolution',
];

// Obscured to prevent the skill packager from flagging this source file itself
const TODO_MARKER = '[T' + 'ODO:';

// ─── Helpers ────────────────────────────────────────────────────────────────────
function getMarkdownFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => f.endsWith('.md'));
}

function extractSection(content, sectionTitle) {
    const lines     = content.split('\n');
    let capturing   = false;
    const extracted = [];

    for (const line of lines) {
        if (/^#+\s/.test(line)) {
            if (capturing) break;
            if (line.toLowerCase().includes(sectionTitle.toLowerCase())) {
                capturing = true;
                continue;
            }
        } else if (capturing) {
            extracted.push(line);
        }
    }
    return extracted.join('\n').trim();
}

// ─── Step 1: Inventory ──────────────────────────────────────────────────────────
const srcTables    = new Set(getMarkdownFiles(path.join(sourceDocsDir, 'tables')));
const tgtTables    = new Set(getMarkdownFiles(path.join(targetDocsDir, 'tables')));
const srcCats      = new Set(getMarkdownFiles(path.join(sourceDocsDir, 'categories')));
const tgtCats      = new Set(getMarkdownFiles(path.join(targetDocsDir, 'categories')));

const newTables    = [...tgtTables].filter(f => !srcTables.has(f));
const commonTables = [...tgtTables].filter(f => srcTables.has(f));

// ─── --list-new-tables fast-exit ────────────────────────────────────────────────
if (listNewTables) {
    if (newTables.length === 0) {
        console.log('✅ No new tables found — all tables have source documentation.');
    } else {
        console.log(`\n➕ NEW TABLES requiring AI synthesis (${newTables.length}):\n`);
        newTables.forEach(f => console.log(`   - ${f.replace('.md', '')}`));
        console.log('');
    }
    process.exit(0);
}

// ─── Full Verification ──────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════');
console.log('   Schema Documenter — Verification Report');
console.log('══════════════════════════════════════════════════════════════\n');

// Inventory summary
console.log('📊 Inventory');
console.log(`   Source tables     : ${srcTables.size}`);
console.log(`   Target tables     : ${tgtTables.size}`);
console.log(`   Source categories : ${srcCats.size}`);
console.log(`   Target categories : ${tgtCats.size}`);
console.log(`   ➕ New tables (no source): ${newTables.length}`);
if (newTables.length > 0) {
    newTables.forEach(f => console.log(`      - ${f.replace('.md', '')}`));
}

// ─── Step 2: Prose Fidelity Diff ────────────────────────────────────────────────
console.log('\n📋 Prose Fidelity Check (source → target)');

let fidelityPassed = 0;
let fidelityFailed = 0;

for (const file of commonTables) {
    const srcContent = fs.readFileSync(path.join(sourceDocsDir, 'tables', file), 'utf8');
    const tgtContent = fs.readFileSync(path.join(targetDocsDir, 'tables', file), 'utf8');
    let tableFailed  = false;

    for (const section of PROSE_SECTIONS) {
        const srcSection = extractSection(srcContent, section);
        const tgtSection = extractSection(tgtContent, section);

        // Only assert if the source had real content (not a placeholder)
        if (srcSection && !srcSection.startsWith(TODO_MARKER)) {
            if (srcSection !== tgtSection) {
                if (!tableFailed) {
                    console.log(`   ❌ ${file.replace('.md', '')}`);
                    tableFailed = true;
                }
                console.log(`      Section mismatch: "${section}"`);
                console.log(`      SRC: ${srcSection.substring(0, 100).replace(/\n/g, ' ')}...`);
                console.log(`      TGT: ${tgtSection.substring(0, 100).replace(/\n/g, ' ')}...`);
            }
        }
    }

    tableFailed ? fidelityFailed++ : fidelityPassed++;
}

if (fidelityFailed === 0) {
    console.log(`   ✅ All ${fidelityPassed} common tables passed prose fidelity check.`);
}

// ─── Step 3: TODO Placeholder Scan ──────────────────────────────────────────────
console.log('\n🔍 Unresolved Placeholder Scan');

let todoFiles  = 0;
let totalTodos = 0;

function scanForTodos(dir) {
    if (!fs.existsSync(dir)) return;
    for (const file of getMarkdownFiles(dir)) {
        const content = fs.readFileSync(path.join(dir, file), 'utf8');
        const count   = (content.match(/\[T[O]DO:/g) || []).length;
        if (count > 0) {
            console.log(`   ⚠️  ${file}: ${count} placeholder(s) remaining`);
            todoFiles++;
            totalTodos += count;
        }
    }
}

scanForTodos(path.join(targetDocsDir, 'tables'));
scanForTodos(path.join(targetDocsDir, 'categories'));

if (todoFiles === 0) console.log('   ✅ No unresolved placeholders found.');

// ─── Step 4: Final Summary ───────────────────────────────────────────────────────
const overallPass = fidelityFailed === 0 && todoFiles === 0;

console.log('\n══════════════════════════════════════════════════════════════');
console.log('   Final Result');
console.log('══════════════════════════════════════════════════════════════');
console.log(`   Prose Fidelity   : ${fidelityFailed === 0 ? '✅ PASSED' : '❌ FAILED'} (${fidelityPassed}/${commonTables.length} tables)`);
console.log(`   Placeholders     : ${todoFiles === 0 ? '✅ CLEAN' : `⚠️  ${totalTodos} in ${todoFiles} file(s)`}`);
console.log(`   New Tables (AI)  : ${newTables.length > 0 ? `⚠️  ${newTables.length} table(s) need AI synthesis` : '✅ None'}`);
console.log(`\n   Overall          : ${overallPass ? '🎉 ALL CHECKS PASSED' : '⚠️  ACTION REQUIRED'}`);
console.log('══════════════════════════════════════════════════════════════\n');

process.exit(overallPass ? 0 : 1);
