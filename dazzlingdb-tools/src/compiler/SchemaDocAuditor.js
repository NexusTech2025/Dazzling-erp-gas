const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const Logger = require('../logger/Logger');

/**
 * Audits JSON database schemas against Markdown documentation tables.
 * @param {string} [customSchemaDir] - Directory containing JSON schema categories
 * @param {string} [customTablesDocDir] - Directory containing Markdown table documentations
 * @returns {boolean} True if audit passed without discrepancies, false otherwise.
 */
function auditSchemaDocs(customSchemaDir, customTablesDocDir) {
    const SCHEMA_DIR = customSchemaDir || path.resolve(__dirname, '../../../DazzlingDB/Config/Schema');
    const TABLES_DOC_DIR = customTablesDocDir || path.resolve(__dirname, '../../../docs/schema/v2/tables');

    let auditPassed = true;

    // ─── STEP 1: PARSE SCHEMAS FROM DISK (THE GROUND TRUTH) ───────────────────────
    if (!fs.existsSync(SCHEMA_DIR)) {
        Logger.error(`Schema directory not found: ${SCHEMA_DIR}`);
        return false;
    }
    const categories = fs.readdirSync(SCHEMA_DIR);
    let jsonTables = {};

    categories.forEach(cat => {
        const catPath = path.join(SCHEMA_DIR, cat);
        if (!fs.statSync(catPath).isDirectory()) return; // Isolate modular category folders

        const files = fs.readdirSync(catPath).filter(f => f.endsWith('.json'));
        files.forEach(f => {
            const tableName = path.basename(f, '.json');
            jsonTables[tableName] = {
                category: cat,
                path: path.join(catPath, f)
            };
        });
    });

    // ─── STEP 2: PARSE REGENERATED TARGET SPECIFICATIONS ─────────────────────────
    if (!fs.existsSync(TABLES_DOC_DIR)) {
        Logger.error(`Documentation directory not found: ${TABLES_DOC_DIR}`);
        return false;
    }
    const docFiles = fs.readdirSync(TABLES_DOC_DIR).filter(f => f.endsWith('.md'));
    let docTables = {};
    docFiles.forEach(f => {
        const tableName = path.basename(f, '.md');
        docTables[tableName] = path.join(TABLES_DOC_DIR, f);
    });

    // ─── STEP 3: HIGH-LEVEL INVENTORY COMPARISON ─────────────────────────────────
    Logger.info('--- TABLES INVENTORY COMPARISON ---');
    Logger.detail(`JSON Tables count: ${Object.keys(jsonTables).length}`);
    Logger.detail(`Doc Tables count: ${Object.keys(docTables).length}`);

    // Audit: Missing documentation metrics
    let missingDocsFound = false;
    for (const table in jsonTables) {
        if (!docTables[table]) {
            if (!missingDocsFound) {
                Logger.warning('Missing Doc Files (Active in JSON but no Doc):');
                missingDocsFound = true;
            }
            Logger.detail(`- ${table} (Category: ${jsonTables[table].category})`);
            auditPassed = false;
        }
    }

    // Audit: Untracked or historically retired documents
    let untrackedDocsFound = false;
    for (const table in docTables) {
        if (!jsonTables[table]) {
            const content = fs.readFileSync(docTables[table], 'utf8');
            // Trace if the document was intentionally deprecated or represents file drift
            const isRetired = content.includes('Retired') || content.includes('RETIRED');
            if (!untrackedDocsFound) {
                Logger.info('Doc Files not in JSON (Retired/Extra):');
                untrackedDocsFound = true;
            }
            if (isRetired) {
                Logger.detail(`- ${table} (Retired: Yes)`);
            } else {
                Logger.warning(`- ${table} (Retired: No - Active Doc File with no JSON Schema!)`);
                auditPassed = false;
            }
        }
    }

    // ─── STEP 4: DEEP COLUMN-LEVEL MISMATCH AUDIT ─────────────────────────────────
    Logger.action('Running deep column-level mismatch audit...');
    let columnMismatchesFound = false;

    for (const table in jsonTables) {
        if (!docTables[table]) continue; // Skip if no matching markdown file exists

        const schema = JSON.parse(fs.readFileSync(jsonTables[table].path, 'utf8'));
        const docContent = fs.readFileSync(docTables[table], 'utf8');

        // Extract standard user columns defined inside JSON metadata
        const schemaCols = Object.keys(schema.columns || {});

        // Parse markdown via marked lexer
        const tokens = marked.lexer(docContent);

        // Find column documentation table token
        const tableToken = tokens.find(t => 
            t.type === 'table' && 
            t.header && 
            t.header[0] && 
            /column\s*name|field/i.test(t.header[0].text)
        );

        let docCols = [];
        if (tableToken) {
            tableToken.rows.forEach(row => {
                const cell = row[0];
                if (cell) {
                    const colName = extractPlainText(cell);
                    if (colName) {
                        docCols.push(colName);
                    }
                }
            });
        }

        // ─── STEP 5: DRIFT RESOLUTION & FILTERING ──────────────────────────────────
        // Compute elements that are defined in JSON schema but missing from Markdown docs
        let missingInDoc = schemaCols.filter(c => !docCols.includes(c));

        // System-level transactional columns injected automatically at compile time
        const systemInjected = ['__tx_id', '__tx_status', '__created_at'];

        // Safely exclude injected runtime attributes to prevent false positives
        missingInDoc = missingInDoc.filter(c => !systemInjected.includes(c));

        // Compute elements present in Markdown text but absent from schema declarations
        let extraInDoc = docCols.filter(c => !schemaCols.includes(c) && !systemInjected.includes(c));

        // Print detailed logs if discrepancies exist
        if (missingInDoc.length > 0 || extraInDoc.length > 0) {
            columnMismatchesFound = true;
            auditPassed = false;
            Logger.error(`Column mismatch in table [${table}]:`);
            if (missingInDoc.length > 0) {
                Logger.detail(`Missing in doc: ${missingInDoc.join(', ')}`);
            }
            if (extraInDoc.length > 0) {
                Logger.detail(`Extra in doc (not in schema): ${extraInDoc.join(', ')}`);
            }
        }
    }

    if (auditPassed) {
        Logger.success('All active database schemas and documentation files are fully in sync!');
    } else {
        Logger.error('Documentation audit completed with discrepancies.');
    }

    return auditPassed;
}

function extractPlainText(token) {
    if (!token) return '';
    if (token.tokens) {
        return extractPlainTextFromList(token.tokens);
    }
    return token.text || token.raw || '';
}

function extractPlainTextFromList(tokensList) {
    return tokensList.map(t => extractPlainText(t)).join('');
}

module.exports = { auditSchemaDocs };

if (require.main === module) {
    auditSchemaDocs();
}