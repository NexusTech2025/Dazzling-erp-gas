/**
 * @file sheet_query.js
 * CLI script to query database tables using dynamic sheet batch actions.
 * Usage:
 *   node sheet_query.js <payload_file_or_raw_json> [--output [override_path]]
 */

const fs = require('fs');
const path = require('path');
const { callApi } = require('../api_client');

/**
 * Returns a colorized JSON string representation of an object using ANSI escape codes.
 * @param {*} obj - Object or primitive value to colorize
 * @param {number} [indentLevel=0] - Initial indentation level
 * @returns {string} Colored string
 */
function colorizeJson(obj, indentLevel = 0) {
  const spacing = ' '.repeat(indentLevel);
  const nextSpacing = ' '.repeat(indentLevel + 2);
  
  if (obj === null) {
    return '\x1b[35mnull\x1b[0m'; // Magenta
  }
  if (typeof obj === 'string') {
    return `\x1b[32m"${obj}"\x1b[0m`; // Green
  }
  if (typeof obj === 'number') {
    return `\x1b[33m${obj}\x1b[0m`; // Yellow
  }
  if (typeof obj === 'boolean') {
    return `\x1b[35m${obj}\x1b[0m`; // Magenta
  }
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return '\x1b[90m[]\x1b[0m'; // Gray
    }
    const items = obj.map(item => colorizeJson(item, indentLevel + 2)).join(',\n' + nextSpacing);
    return `\x1b[90m[\x1b[0m\n${nextSpacing}${items}\n${spacing}\x1b[90m]\x1b[0m`;
  }
  
  if (typeof obj === 'object') {
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      return '\x1b[90m{}\x1b[0m'; // Gray
    }
    const entries = keys.map(key => {
      const fKey = `\x1b[36m"${key}"\x1b[0m`; // Cyan
      const fVal = colorizeJson(obj[key], indentLevel + 2);
      return `${fKey}: ${fVal}`;
    }).join(',\n' + nextSpacing);
    return `\x1b[90m{\x1b[0m\n${nextSpacing}${entries}\n${spacing}\x1b[90m}\x1b[0m`;
  }
  
  return String(obj);
}

/**
 * Parses dynamic CLI values as raw JSON or resolves them as local/payload files.
 * @param {string} val 
 * @returns {Object} Parsed JSON payload
 */
function parseJsonOrFile(val) {
  const trimmed = val.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch (err) {
      console.error(`\n❌ Error: Provided parameter value is not valid JSON string: ${err.message}\n`);
      process.exit(1);
    }
  }

  // Treat as file path
  let filePath = path.resolve(trimmed);
  if (!fs.existsSync(filePath)) {
    // Fallback to payloads directory
    const fallbackPath = path.join(__dirname, '..', '..', '..', 'payloads', trimmed);
    if (fs.existsSync(fallbackPath)) {
      filePath = fallbackPath;
    } else {
      console.error(`\n❌ Error: File not found: "${trimmed}"`);
      console.error(`Also checked payloads folder: "${fallbackPath}"\n`);
      process.exit(1);
    }
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`\n❌ Error: Failed to read/parse file "${trimmed}": ${err.message}\n`);
    process.exit(1);
  }
}

async function main() {
  const rawArgs = process.argv.slice(2);
  
  // Find which elements are flags versus positional args
  const args = [];
  let isNextArgVal = false;
  for (let i = 0; i < rawArgs.length; i++) {
    if (rawArgs[i] === '--output') {
      if (i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith('--')) {
        // Skip the next arg as it's the value of --output
        i++;
      }
      continue;
    }
    args.push(rawArgs[i]);
  }

  const hasOutputFlag = rawArgs.includes('--output');
  let outputOverridePath = null;
  const outputIndex = rawArgs.indexOf('--output');
  if (outputIndex !== -1 && outputIndex + 1 < rawArgs.length) {
    const nextArg = rawArgs[outputIndex + 1];
    if (!nextArg.startsWith('--')) {
      outputOverridePath = nextArg;
    }
  }

  if (args.length < 1) {
    console.error('\n❌ Error: Missing payload target.');
    console.error('Usage:');
    console.error('  npm run api-sheet-query <payload_file_or_raw_json> [--output [override_path]]\n');
    process.exit(1);
  }

  const payloadSource = args[0];
  const queryManifest = parseJsonOrFile(payloadSource);

  if (!queryManifest.request || !queryManifest.request.action) {
    console.error('\n❌ Error: Invalid query manifest. Must contain "request" with "action".\n');
    process.exit(1);
  }

  const { action, payload, options } = queryManifest.request;
  const config = queryManifest.config || {};

  console.log(`🔍 Dispatching sheet query action "${action}"...`);
  
  try {
    const startTime = Date.now();
    const result = await callApi(action, payload, null, options);
    const elapsed = Date.now() - startTime;
    
    console.log('\n✅ Sheet query completed successfully!');

    // Compute sheet records count
    const sheetRecords = [];
    if (result && typeof result === 'object') {
      for (const [spreadsheetId, sheets] of Object.entries(result)) {
        if (sheets && typeof sheets === 'object') {
          for (const [sheetName, rows] of Object.entries(sheets)) {
            if (Array.isArray(rows)) {
              sheetRecords.push({ spreadsheetId, sheetName, count: rows.length });
            }
          }
        }
      }
    }

    // Display wall time and per-sheet count stats at the top of output
    console.log('==================================================');
    console.log(`⏱️  Wall Time Elapsed : ${elapsed}ms`);
    console.log('📊 Records Fetched Per Sheet:');
    if (sheetRecords.length === 0) {
      console.log('   - No sheets/records retrieved.');
    } else {
      sheetRecords.forEach(item => {
        console.log(`   - [Spreadsheet: ${item.spreadsheetId}] Sheet "${item.sheetName}": ${item.count} records`);
      });
    }
    console.log('==================================================\n');

    if (hasOutputFlag) {
      // Resolve path
      let finalPath;
      if (outputOverridePath) {
        finalPath = path.resolve(outputOverridePath);
      } else {
        const outDir = config.outputPath || 'responses/';
        const outFilename = config.outputFilename || 'sheet_query_output.json';
        
        // Ensure path resolves from dazzlingdb-tools root directory
        const resolvedOutDir = path.isAbsolute(outDir) 
          ? outDir 
          : path.join(__dirname, '..', '..', '..', outDir);

        if (!fs.existsSync(resolvedOutDir)) {
          fs.mkdirSync(resolvedOutDir, { recursive: true });
        }
        finalPath = path.join(resolvedOutDir, outFilename);
      }

      const outputFormat = (config.outputFormat || config.ouptutFormat || 'json').toLowerCase();
      let fileContent = '';
      if (outputFormat === 'json') {
        fileContent = JSON.stringify(result, null, 2);
      } else {
        fileContent = String(result);
      }

      // Ensure target directory exists for output override path if folders are included
      const targetFileDir = path.dirname(finalPath);
      if (!fs.existsSync(targetFileDir)) {
        fs.mkdirSync(targetFileDir, { recursive: true });
      }

      fs.writeFileSync(finalPath, fileContent, 'utf8');
      console.log(`💾 Output successfully saved to: ${finalPath}\n`);
    } else {
      console.log('📦 Query Result:');
      console.log(colorizeJson(result));
      console.log();
    }
  } catch (error) {
    console.error(`\n❌ Sheet query failed: ${error.message}\n`);
    process.exit(1);
  }
}

main();
