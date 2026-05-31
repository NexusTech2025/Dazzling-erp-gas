/**
 * @file Exports.js
 * Public API Surface for the SchemaDriver Library.
 * 
 * This file defines the High-Level and Advanced APIs for the schema lifecycle:
 * INSPECT (Snapshot) -> PREVIEW (Plan) -> PROVISION (Execute)
 */

// ==========================================
// 🟢 HIGH-LEVEL PUBLIC API (Lifecycle)
// ==========================================

/**
 * Stage 1: INSPECT
 * Captures the current physical state of the spreadsheets and tables.
 * @param {string} rootFolderId - Google Drive Folder ID
 * @param {Object} schema - Canonical Database Schema
 * @returns {Object} Physical State Snapshot
 */
function inspectSchema(rootFolderId, schema) {
  const fs = createFileSystem(rootFolderId);
  const inspector = createInspector(fs);
  return inspector.getPhysicalSnapshot(schema.categories);
}

/**
 * Stage 2: PREVIEW
 * Generates an execution plan (Dry Run) without making any changes.
 * @param {string} rootFolderId - Google Drive Folder ID
 * @param {Object} schema - Canonical Database Schema
 * @returns {Object} Execution Plan (Operations + Summary)
 */
function previewSchema(rootFolderId, schema) {
  const fs = createFileSystem(rootFolderId);
  const engine = createSetupEngine({ fileSystem: fs, schema, config: { dryRun: true } });
  return engine.provision(); // Returns the plan due to dryRun: true
}

/**
 * Stage 3: PROVISION
 * Orchestrates the full lifecycle: Plan -> Execute.
 * @param {string} rootFolderId - Google Drive Folder ID
 * @param {Object} schema - Canonical Database Schema
 * @param {Object} config - Execution config (mode: 'safe'|'force', continueOnError, etc.)
 * @returns {Object} Execution Result
 */
function provisionSchema(rootFolderId, schema, config = {}) {
  const fs = createFileSystem(rootFolderId);
  const engine = createSetupEngine({ fileSystem: fs, schema, config });
  return engine.provision();
}

/**
 * Stage 4: DIAGNOSE
 * Executes a targeted dry-run diagnostic on a specific table.
 * @param {string} rootFolderId - Google Drive Folder ID
 * @param {Object} schema - Canonical Database Schema
 * @param {string} tableName - Name of the table to check
 * @returns {Object} Structured dry-run validation and provisioning plan
 */
function diagnoseTable(rootFolderId, schema, tableName) {
  const fs = createFileSystem(rootFolderId);
  const engine = new SchemaSetupEngine(fs, schema, null, null, {
    dryRun: true,
    targetTables: [tableName],
    verbose: false
  });
  return engine.provision();
}

// ==========================================
// 🟡 SEMANTIC VARIANTS
// ==========================================

/**
 * Provisioning in Safe mode (Appends only, protects data).
 */
function provisionSchemaSafe(rootFolderId, schema) {
  return provisionSchema(rootFolderId, schema, { mode: 'safe' });
}

/**
 * Provisioning in Force mode (Recreates sheets, use with caution).
 */
function provisionSchemaForce(rootFolderId, schema) {
  return provisionSchema(rootFolderId, schema, { mode: 'force' });
}

// ==========================================
// 🔴 ADVANCED API (Composability)
// ==========================================

/**
 * Factory for the Spreadsheet File System abstraction.
 */
function createFileSystem(rootFolderId) {
  return new SpreadsheetFileSystem(rootFolderId);
}

/**
 * Factory for the Schema Inspector (Read Adapter).
 */
function createInspector(fileSystem) {
  return new SchemaInspector(fileSystem);
}

/**
 * Factory for the Setup Engine (Orchestrator).
 * @param {Object} deps - { fileSystem, schema, config }
 */
function createSetupEngine({ fileSystem, schema, config }) {
  return new SchemaSetupEngine(fileSystem, schema, config);
}
