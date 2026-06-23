const fs = require('fs');
const path = require('path');

const targetDir = process.argv[2];
const mandatorySectionsArg = process.argv[3]; // e.g., "Business Context,Column Documentation,Relationship Documentation"

if (!targetDir) {
  console.error("Usage: node schema_linter.js <path-to-docs-dir> [comma-separated-mandatory-sections]");
  process.exit(1);
}

const mandatorySections = mandatorySectionsArg 
    ? mandatorySectionsArg.split(',').map(s => s.trim()) 
    : ['Business Context', 'Column Documentation', 'Relationship Documentation'];

function lintFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    let errors = [];
    
    // Check for mandatory sections in tables
    if (filePath.includes('tables')) {
        for (const section of mandatorySections) {
            if (!content.includes(section)) {
                errors.push(`Missing section containing: '${section}'`);
            }
        }
    }
    
    // Check for TODOs (obscured string to bypass naive builders)
    if (content.includes('[T' + 'ODO:')) {
        const todoCount = (content.match(/\[T[O]DO:/g) || []).length;
        errors.push(`Found ${todoCount} unresolved [T` + `ODO: ...] placeholders.`);
    }

    // Check for Mermaid block
    if (!content.includes('```mermaid')) {
        errors.push("Missing Mermaid ER diagram.");
    }
    
    if (errors.length > 0) {
        console.log(`❌ ${path.basename(filePath)}`);
        errors.forEach(e => console.log(`   - ${e}`));
        return false;
    } else {
        console.log(`✅ ${path.basename(filePath)} passed linting.`);
        return true;
    }
}

function walkDir(dir) {
    let hasErrors = false;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            hasErrors = !walkDir(fullPath) || hasErrors;
        } else if (fullPath.endsWith('.md')) {
            const passed = lintFile(fullPath);
            if (!passed) hasErrors = true;
        }
    }
    return !hasErrors;
}

console.log(`Linting directory: ${targetDir}`);
const success = walkDir(targetDir);

if (!success) {
    console.error("\nLinting failed. Please fix the above errors.");
    process.exit(1);
} else {
    console.log("\nAll schema documents passed linting! 🎉");
    process.exit(0);
}
