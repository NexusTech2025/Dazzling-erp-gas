/**
 * @file admin_action.js
 * Generic CLI script to execute administrative actions prefixed with "admin_".
 * Usage: node admin_action.js <admin_action_key> [payload_file_or_raw_json] [--env <env>]
 */

const fs = require('fs');
const path = require('path');
const { callApi } = require('../api_client');
const Logger = require('../../logger/Logger');

async function main() {
  // Parse arguments globally, excluding environment flags
  const rawArgs = process.argv.slice(2);
  const args = [];
  for (let i = 0; i < rawArgs.length; i++) {
    if (rawArgs[i] === '--env') {
      i++; // skip environment value
      continue;
    }
    args.push(rawArgs[i]);
  }

  if (args.length < 1) {
    console.error('\n❌ Error: Missing administrative action key.');
    console.error('Usage: npm run api-admin-action -- <admin_action_key> [payload_file_or_raw_json] [--env <env>]\n');
    process.exit(1);
  }

  const action = args[0];
  const payloadArg = args[1];

  // 1. Enforce admin prefix validation
  if (!action.startsWith('admin_')) {
    Logger.error(`Action validation failed: Action key "${action}" must be prefixed with "admin_" to use this utility.`);
    process.exit(1);
  }

  let payload = {};

  // 2. Resolve payload if provided
  if (payloadArg) {
    const trimmed = payloadArg.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        payload = JSON.parse(trimmed);
      } catch (err) {
        Logger.error(`Provided payload is not a valid JSON string: ${err.message}`);
        process.exit(1);
      }
    } else {
      // Treat as file path
      let filePath = path.resolve(trimmed);
      if (!fs.existsSync(filePath)) {
        // Fallback to payloads/ folder
        const fallbackPath = path.join(__dirname, '..', '..', '..', 'payloads', trimmed);
        const fallbackDbPath = path.join(__dirname, '..', '..', '..', 'payloads', 'db_payloads', trimmed);
        
        if (fs.existsSync(fallbackPath)) {
          filePath = fallbackPath;
        } else if (fs.existsSync(fallbackDbPath)) {
          filePath = fallbackDbPath;
        } else {
          Logger.error(`Payload file not found: "${trimmed}"`);
          console.error(`  Checked: ${filePath}`);
          console.error(`  Checked: ${fallbackPath}`);
          console.error(`  Checked: ${fallbackDbPath}\n`);
          process.exit(1);
        }
      }

      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        payload = JSON.parse(raw);
        Logger.info(`Loaded payload file successfully from: ${filePath}`);
      } catch (err) {
        Logger.error(`Failed to read/parse payload file: ${err.message}`);
        process.exit(1);
      }
    }
  }

  Logger.action(`Dispatching administrative action: "${action}"`);
  if (Object.keys(payload).length > 0) {
    console.log(Logger.colorize('gray', JSON.stringify(payload, null, 2)));
  }

  const startTime = Date.now();

  try {
    const response = await callApi(action, payload);
    const elapsed = Date.now() - startTime;

    Logger.success(`Administrative action completed successfully in ${elapsed}ms!`);
    console.log('\n================ RESPONSE DATA ================');
    console.log(JSON.stringify(response, null, 2));
    console.log('===============================================\n');

  } catch (error) {
    Logger.error(`Administrative action failed: ${error.message}\n`);
    process.exit(1);
  }
}

main();
