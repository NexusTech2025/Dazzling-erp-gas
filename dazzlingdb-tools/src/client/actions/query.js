/**
 * @file query.js
 * CLI script to query database tables using data_query action.
 * Supports legacy positional parameters, flag-based parameters, or a universal --args parameter.
 * Renders nested relations in prettified, ANSI-colorized JSON.
 * Usage:
 *   Universal: node query.js <table_name> --args <json_file_or_string>
 *   Legacy:    node query.js <table_name> [query_file_or_raw_json] [limit] [offset]
 *   Flags:     node query.js <table_name> [--where <where_val>] [--include <include_val>] [--limit <limit>] [--offset <offset>]
 */

const fs = require('fs');
const path = require('path');
const { callApi } = require('../api_client');
const displayController = require('../display_controller');

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
 * Dynamically resolves the primary key column name for a target table row.
 * @param {string} tableName 
 * @param {Object} row 
 * @returns {string} PK name
 */
function getPrimaryKey(tableName, row) {
  if (!row) return 'id';
  const standardPk = `${tableName.toLowerCase()}_id`;
  if (row[standardPk] !== undefined) return standardPk;
  if (row.id !== undefined) return 'id';
  const idKey = Object.keys(row).find(k => k.endsWith('_id'));
  return idKey || Object.keys(row)[0];
}

/**
 * Parses dynamic CLI values as raw JSON or resolves them as local/payload files.
 * @param {string} val 
 * @returns {Object|Array} Parsed JSON payload
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
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('\n❌ Error: Missing table target.');
    console.error('Usage:');
    console.error('  node query.js <table_name> --args <json_file_or_string>');
    console.error('  node query.js <table_name> [query_file_or_raw_json] [limit] [offset]');
    console.error('  node query.js <table_name> [--where <where_val>] [--include <include_val>] [--limit <limit>] [--offset <offset>]\n');
    process.exit(1);
  }

  const table = args[0];
  let where = {};
  let include = null;
  let limit;
  let offset;
  let universalArgs = {};

  const hasFlags = args.some(arg => arg.startsWith('--'));

  if (!hasFlags) {
    // --------------------------------------------------
    // Legacy Positional Argument Parsing
    // --------------------------------------------------
    const queryArg = args[1];
    let limitArg = args[2];
    let offsetArg = args[3];

    if (queryArg) {
      const trimmed = queryArg.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          where = JSON.parse(trimmed);
        } catch (err) {
          console.error(`\n❌ Error: Query filter is not a valid JSON string: ${err.message}\n`);
          process.exit(1);
        }
      } else if (isNaN(trimmed)) {
        const parsed = parseJsonOrFile(queryArg);
        if (parsed.where || parsed.include || parsed.select || parsed.limit || parsed.pagination || parsed.display) {
          universalArgs = parsed;
          console.log(`📖 Loaded full query specification from: ${queryArg}`);
        } else {
          where = parsed;
          console.log(`📖 Loaded positional filter from: ${queryArg}`);
        }
      } else {
        limitArg = args[1];
        offsetArg = args[2];
      }
    }
    if (limitArg !== undefined && !isNaN(limitArg)) limit = parseInt(limitArg, 10);
    if (offsetArg !== undefined && !isNaN(offsetArg)) offset = parseInt(offsetArg, 10);
  } else {
    // --------------------------------------------------
    // Flag-Based Parsing
    // --------------------------------------------------
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--args') {
        const val = args[++i];
        if (!val) {
          console.error('❌ Error: Missing value for --args parameter.');
          process.exit(1);
        }
        universalArgs = parseJsonOrFile(val);
      } else if (arg === '--where') {
        const val = args[++i];
        where = parseJsonOrFile(val);
      } else if (arg === '--include') {
        const val = args[++i];
        include = parseJsonOrFile(val);
      } else if (arg === '--limit') {
        const val = args[++i];
        limit = parseInt(val, 10);
      } else if (arg === '--offset') {
        const val = args[++i];
        offset = parseInt(val, 10);
      }
    }
  }

  // Construct payload with fallback target
  let payload = {
    target: table,
    where: where
  };

  // Merge universalArgs first (so explicit flags can override them if needed)
  if (universalArgs && typeof universalArgs === 'object' && !Array.isArray(universalArgs)) {
    Object.assign(payload, universalArgs);
  }

  // Apply explicit overrides
  if (include) {
    payload.include = include;
  }
  if (limit !== undefined && !isNaN(limit)) {
    payload.limit = limit;
  }
  if (offset !== undefined && !isNaN(offset)) {
    payload.offset = offset;
  }

  console.log(`🔍 Querying table "${table}" with params:`, JSON.stringify(payload, null, 2));

  try {
    const result = await callApi('data_query', payload);
    const rows = result.data || [];
    
    // Attach total count metadata to the array for display controller
    rows.__totalCount = result.total_count !== undefined ? result.total_count : rows.length;

    // Resolve metadata properties for printing
    const totalCount = rows.__totalCount;
    const limitVal = (payload.pagination && payload.pagination.limit) || rows.length;
    const offsetVal = (payload.pagination && payload.pagination.offset) || 0;

    console.log('\n✅ Query completed successfully!');
    console.log(`📊 Metadata: Total: ${totalCount}, Limit: ${limitVal}, Offset: ${offsetVal}`);

    // Normalize include to list of string keys for relation printing
    const includeKeys = Array.isArray(payload.include)
      ? payload.include
      : (payload.include && typeof payload.include === 'object' ? Object.keys(payload.include) : []);

    displayController.render(
      rows,
      payload.display,
      table,
      includeKeys,
      colorizeJson,
      getPrimaryKey
    );
  } catch (error) {
    console.error(`\n❌ Query failed: ${error.message}\n`);
    process.exit(1);
  }
}

main();
