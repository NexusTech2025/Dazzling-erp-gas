/**
 * @file login.js
 * CLI script to log in a user and cache their authentication token.
 * Automatically loads username and password from dazzlingdb_api_settings.json,
 * falling back to CLI arguments if missing.
 */

const { callApi, saveToken, loadSettings } = require('../api_client');

async function main() {
  let username;
  let password;

  try {
    const settings = loadSettings();
    username = settings.username;
    password = settings.password;
  } catch (err) {
    // Ignore error here, we will check if variables are set
  }

  // Fallback to CLI arguments if settings don't specify credentials
  if (!username || !password) {
    const args = process.argv.slice(2);
    if (args.length >= 2) {
      username = args[0];
      password = args[1];
    }
  }

  if (!username || !password) {
    console.error('\n❌ Error: Missing credentials.');
    console.error('Configure "username" and "password" in dazzlingdb_api_settings.json or use:');
    console.error('Usage: node login.js <username> <password>\n');
    process.exit(1);
  }

  console.log(`\n🔐 Attempting login for user: "${username}"...`);

  try {
    const data = await callApi('user_login', { username, password });
    
    if (data && data.token) {
      saveToken(data.token);
      console.log('✅ Login successful!');
      console.log(`🔑 Token saved successfully to local session cache.`);
      console.log(`ℹ️  Role: ${data.role || 'N/A'}`);
      console.log(`ℹ️  Username: ${data.username || username}\n`);
    } else {
      console.error('❌ Error: The API succeeded but did not return a valid session token.\n');
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Login failed: ${error.message}\n`);
    process.exit(1);
  }
}

main();
