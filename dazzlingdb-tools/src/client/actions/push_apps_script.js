/**
 * @file push_apps_script.js
 * CLI tool to push local changes to Google Apps Script using clasp.
 * Runs 'clasp push' from the respective subdirectories to satisfy path constraints.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const { loadSettings } = require('../api_client');

let settings = {};
try {
  settings = loadSettings();
} catch (err) {
  // Fallback if settings cannot be loaded
}

const rootDir = path.resolve(__dirname, '..', '..', '..', '..');
const appsConfig = settings.apps || {};

const projects = {
  sheetdb: {
    name: 'SheetDB',
    dir: appsConfig.sheetdb ? path.resolve(appsConfig.sheetdb) : path.join(rootDir, 'SheetDB')
  },
  dazzlingdb: {
    name: 'DazzlingDB',
    dir: appsConfig.dazzlingdb ? path.resolve(appsConfig.dazzlingdb) : path.join(rootDir, 'DazzlingDB')
  }
};

function printHelp() {
  console.log(`
Push Local Changes to Google Apps Script

Usage:
  node push_apps_script.js [options]

Options:
  -s, --sheetdb       Push only SheetDB
  -d, --dazzlingdb    Push only DazzlingDB
  -h, --help          Show this help message

Default (no options):
  Pushes both SheetDB and DazzlingDB.
`);
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes('-h') || args.includes('--help')) {
    printHelp();
    process.exit(0);
  }

  const pushSheetDB = args.includes('-s') || args.includes('--sheetdb');
  const pushDazzlingDB = args.includes('-d') || args.includes('--dazzlingdb');

  const targets = [];

  if (pushSheetDB || pushDazzlingDB) {
    if (pushSheetDB) targets.push(projects.sheetdb);
    if (pushDazzlingDB) targets.push(projects.dazzlingdb);
  } else {
    // Default to both SheetDB and DazzlingDB
    targets.push(projects.sheetdb, projects.dazzlingdb);
  }

  console.log(`\n🚀 Starting Google Apps Script Push Pipeline...`);
  console.log(`Target Projects: ${targets.map(t => t.name).join(', ')}\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const target of targets) {
    console.log(`--------------------------------------------------------`);
    console.log(`📦 Pushing changes for [${target.name}]...`);
    console.log(`📂 Directory: ${target.dir}`);

    if (!fs.existsSync(target.dir)) {
      console.error(`❌ Error: Directory does not exist.`);
      errorCount++;
      continue;
    }

    if (!fs.existsSync(path.join(target.dir, '.clasp.json'))) {
      console.error(`❌ Error: .clasp.json config file not found.`);
      errorCount++;
      continue;
    }

    try {
      // Execute clasp push from the project directory
      execSync('clasp push', {
        cwd: target.dir,
        stdio: 'inherit',
        shell: true
      });
      console.log(`\n✅ Successfully pushed [${target.name}]`);
      successCount++;
    } catch (err) {
      console.error(`\n❌ Failed to push [${target.name}]: ${err.message}`);
      errorCount++;
    }
  }

  console.log(`========================================================`);
  console.log(`📊 PUSH PIPELINE SUMMARY`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed:  ${errorCount}`);
  console.log(`========================================================\n`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

main();
