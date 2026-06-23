/**
 * @file api_client.js
 * Common API client utility to interact with the DazzlingDB Google Apps Script API.
 * Uses native fetch (Node.js v18+) to avoid external dependencies.
 */

const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '..', '..', 'config', 'settings.json');
const TOKEN_FILE = path.join(__dirname, '..', '..', 'data', 'session_token.json');

/**
 * Loads API configurations.
 * @returns {Object} { api_url, deployment_id }
 */
function loadSettings() {
  if (!fs.existsSync(SETTINGS_FILE)) {
    throw new Error(`Settings file not found at ${SETTINGS_FILE}. Please configure the API URL.`);
  }
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse settings file: ${error.message}`);
  }
}

/**
 * Saves the session token locally.
 * @param {string} token 
 */
function saveToken(token) {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify({ token }, null, 2), 'utf8');
  } catch (error) {
    console.error(`Failed to save token to file: ${error.message}`);
  }
}

/**
 * Loads the stored session token if it exists.
 * @returns {string|null}
 */
function loadToken() {
  if (!fs.existsSync(TOKEN_FILE)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(TOKEN_FILE, 'utf8');
    const data = JSON.parse(raw);
    return data.token || null;
  } catch (error) {
    return null;
  }
}

/**
 * Dispatches an action request to the DazzlingDB API.
 * @param {string} action - Registered action name (e.g., "user_login")
 * @param {Object} payload - Parameter arguments for the action
 * @param {string} [tokenOverride=null] - Optional auth token override
 * @param {Object} [options=null] - Optional strategy/action execution options
 * @returns {Promise<Object>} The response data object
 */
async function callApi(action, payload = {}, tokenOverride = null, options = null) {
  const settings = loadSettings();
  const url = settings.api_url;
  
  if (!url) {
    throw new Error('API URL is not defined in settings.');
  }

  // Normalize limit and offset to pagination object for backend DSL compliance
  if (action === 'data_query' && payload && typeof payload === 'object') {
    if (payload.limit !== undefined || payload.offset !== undefined) {
      payload.pagination = payload.pagination || {};
      if (payload.limit !== undefined && payload.pagination.limit === undefined) {
        payload.pagination.limit = payload.limit;
      }
      if (payload.offset !== undefined && payload.pagination.offset === undefined) {
        payload.pagination.offset = payload.offset;
      }
      delete payload.limit;
      delete payload.offset;
    }
  }

  // Resolve authorization token
  const token = tokenOverride || loadToken();

  const requestBody = {
    action,
    payload
  };
  
  if (options) {
    requestBody.options = options;
  }
  
  if (token) {
    requestBody.token = token;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`HTTP Error: Status ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  if (!result.success) {
    const errMsg = result.error ? `${result.error.type}: ${result.error.message}` : 'Unknown API error';
    throw new Error(errMsg);
  }

  return result.data;
}

module.exports = {
  loadSettings,
  saveToken,
  loadToken,
  callApi
};
