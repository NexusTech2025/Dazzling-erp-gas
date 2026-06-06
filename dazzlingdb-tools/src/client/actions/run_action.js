/**
 * @file run_action.js
 * Generic CLI script to execute any registered DazzlingDB API action.
 * Usage: node run_action.js <action_key> [payload_file_or_raw_json]
 */

const fs = require('fs');
const path = require('path');
const { callApi } = require('../api_client');

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('\n❌ Error: Missing action key.');
    console.error('Usage: node run_action.js <action_key> [payload_file_or_raw_json]\n');
    process.exit(1);
  }

  const action = args[0];
  const payloadArg = args[1];
  let payload = {};

  if (payloadArg) {
    const trimmed = payloadArg.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      // Treat as raw JSON string
      try {
        payload = JSON.parse(trimmed);
      } catch (err) {
        console.error(`\n❌ Error: Provided payload is not valid JSON string: ${err.message}\n`);
        process.exit(1);
      }
    } else {
      // Treat as file path
      let filePath = path.resolve(trimmed);
      
      if (!fs.existsSync(filePath)) {
        // Fallback to payloads directory
        const fallbackPath = path.join(__dirname, '..', '..', '..', 'payloads', trimmed);
        if (fs.existsSync(fallbackPath)) {
          filePath = fallbackPath;
        } else {
          console.error(`\n❌ Error: Payload file not found: "${trimmed}"`);
          console.error(`Also checked payloads folder: "${fallbackPath}"\n`);
          process.exit(1);
        }
      }

      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        payload = JSON.parse(raw);
        console.log(`📖 Loaded payload from: ${filePath}`);
      } catch (err) {
        console.error(`\n❌ Error: Failed to read/parse payload file: ${err.message}\n`);
        process.exit(1);
      }
    }
  }

  console.log(`🚀 Dispatching action: "${action}" with payload:`);
  console.log(JSON.stringify(payload, null, 2));

  try {
    const data = await callApi(action, payload);
    console.log('\n✅ Action completed successfully!');
    console.log('📦 Response Data:');
    console.log(JSON.stringify(data, null, 2));
    console.log();
  } catch (error) {
    console.error(`\n❌ Action failed: ${error.message}\n`);
    process.exit(1);
  }
}

main();
