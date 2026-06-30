#!/usr/bin/env node

/**
 * sort-files.js
 *
 * Recursively lists all files in deterministic lexicographical order,
 * similar to how Google Apps Script organizes project files.
 *
 * Usage:
 *   node sort-files.js <directory>
 *
 * Example:
 *   node sort-files.js ./src
 */

const fs = require("fs/promises");
const path = require("path");

async function walk(dir, root, files = []) {
    const entries = await fs.readdir(dir, {
        withFileTypes: true,
    });

    for (const entry of entries) {
        const absolute = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            await walk(absolute, root, files);
        } else if (entry.isFile()) {
            files.push({
                absolute,
                relative: path
                    .relative(root, absolute)
                    .replace(/\\/g, "/"),
            });
        }
    }

    return files;
}

async function main() {
    const targetDir = process.argv[2];

    if (!targetDir) {
        console.error("Usage: node sort-files.js <directory>");
        process.exit(1);
    }

    const root = path.resolve(targetDir);

    const files = await walk(root, root);

    files.sort((a, b) => a.relative.localeCompare(b.relative));

    for (const file of files) {
        console.log(file.relative);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});