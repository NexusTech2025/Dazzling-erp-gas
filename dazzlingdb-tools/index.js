/**
 * @file index.js
 * Main entrypoint for dazzlingdb-tools.
 * Orchestrates schema linting, compilation of database_schema.js, and dependency_graph.js compilation.
 */

const fs = require('fs');
const path = require('path');
const Logger = require('./src/logger/Logger');
const SchemaLinter = require('./src/compiler/SchemaLinter');
const GraphBuilder = require('./src/compiler/GraphBuilder');

// Parse CLI arguments globally for environment switching
const cliArgs = process.argv.slice(2);
const envIndex = cliArgs.indexOf('--env');
const envFlag = (envIndex !== -1 && cliArgs[envIndex + 1]) ? cliArgs[envIndex + 1].toLowerCase() : 'production';
const selectedEnv = (envFlag === 'dev' || envFlag === 'development') ? 'development' : 'production';

// Path Configuration Loading
const CONFIG_PATH = path.resolve(__dirname, 'config', 'tool_config.json');
let toolConfig = {
  schemaDir: "../DazzlingDB/Config/Schema",
  targetSchemaJs: "../DazzlingDB/Config/database_schema.js",
  targetGraphJs: "../DazzlingDB/Config/dependency_graph.js"
};

let configLoadError = null;
if (fs.existsSync(CONFIG_PATH)) {
  try {
    const fullConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const envConfig = fullConfig[selectedEnv];
    if (envConfig) {
      toolConfig = { ...toolConfig, ...envConfig };
    } else {
      configLoadError = `Environment [${selectedEnv}] block not found in tool_config.json`;
    }
  } catch (err) {
    configLoadError = err.message;
  }
}

const SCHEMA_DIR = path.resolve(__dirname, toolConfig.schemaDir);
const TARGET_SCHEMA_JS = path.resolve(__dirname, toolConfig.targetSchemaJs);
const TARGET_GRAPH_JS = path.resolve(__dirname, toolConfig.targetGraphJs);

const SYSTEM_COLUMNS = {
  "__tx_id": {
    "type": "string",
    "system": true,
    "required": false,
    "editable": false,
    "description": "Unique Transaction ID"
  },
  "__tx_status": {
    "type": "string",
    "choices": ["PENDING", "COMMITTED", "FAILED"],
    "default": "PENDING",
    "system": true,
    "required": false,
    "editable": false
  },
  "__created_at": {
    "type": "datetime",
    "autoNowAdd": true,
    "system": true,
    "required": false,
    "editable": false
  }
};

/**
 * Loads all schemas from SCHEMA_DIR recursively.
 * Returns both a flat schemas map (by table name) and a categorization map.
 */
function loadSchemas() {
  if (!fs.existsSync(SCHEMA_DIR)) {
    Logger.logEvent({ level: 'error', category: 'loader', message: `Schema directory not found at ${SCHEMA_DIR}` });
    process.exit(1);
  }

  const flatSchemas = {};
  const categoryStructure = {};

  const categories = fs.readdirSync(SCHEMA_DIR);

  for (const cat of categories) {
    const catPath = path.join(SCHEMA_DIR, cat);
    if (!fs.statSync(catPath).isDirectory()) continue;

    categoryStructure[cat] = { tables: {} };

    const files = fs.readdirSync(catPath).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const tableName = path.basename(file, '.json');
      const filePath = path.join(catPath, file);
      
      try {
        const rawContent = fs.readFileSync(filePath, 'utf8');
        const schema = JSON.parse(rawContent);
        
        flatSchemas[tableName] = schema;
        categoryStructure[cat].tables[tableName] = schema;
        
        Logger.logEvent({
          level: 'verbose',
          category: 'loader',
          message: `Loaded schema for table [${tableName}] from category [${cat}]`
        });
        
        Logger.logEvent({
          level: 'debug',
          category: 'loader',
          message: `Parsed schema definition details for [${tableName}]`,
          metadata: { columns: Object.keys(schema.columns || {}), relations: Object.keys(schema.relations || {}) }
        });
      } catch (err) {
        Logger.logEvent({
          level: 'error',
          category: 'loader',
          message: `Failed to parse schema file ${filePath}: ${err.message}`
        });
        process.exit(1);
      }
    }
  }

  return { flatSchemas, categoryStructure };
}

/**
 * Compiles database_schema.js with system columns and defaults injected.
 */
function compileRuntimeSchema(categoryStructure) {
  const compiled = {
    "version": "2.1.1",
    "database": "DazzlingDB",
    "categories": {}
  };

  for (const [catName, catData] of Object.entries(categoryStructure)) {
    compiled.categories[catName] = { tables: {} };
    Logger.logEvent({
      level: 'verbose',
      category: 'compiler',
      message: `Compiling category [${catName}] into runtime schema`
    });

    for (const [tableName, tableData] of Object.entries(catData.tables)) {
      Logger.logEvent({
        level: 'verbose',
        category: 'compiler',
        message: `  Injected columns and compiled [${tableName}]`
      });

      const originalColumns = tableData.columns || {};
      const mergedColumns = {};

      for (const [colName, colConfig] of Object.entries(originalColumns)) {
        mergedColumns[colName] = { ...colConfig };
        
        if (mergedColumns[colName].type === 'string' && !mergedColumns[colName].maxLength) {
          mergedColumns[colName].maxLength = 255;
        }
      }

      for (const [sysColName, sysColConfig] of Object.entries(SYSTEM_COLUMNS)) {
        mergedColumns[sysColName] = { ...sysColConfig };
      }

      compiled.categories[catName].tables[tableName] = {
        "primaryKey": tableData.primaryKey || "id",
        "columns": mergedColumns,
        "relations": tableData.relations || {}
      };
    }
  }

  const jsContent = `const DATABASE_SCHEMA = ${JSON.stringify(compiled, null, 2)};\n`;
  fs.writeFileSync(TARGET_SCHEMA_JS, jsContent, 'utf8');
  Logger.logEvent({
    level: 'success',
    category: 'compiler',
    message: `Wrote runtime schema to ${TARGET_SCHEMA_JS}`
  });
}

function main() {
  const args = process.argv.slice(2);
  const lintOnly = args.includes('--lint-only');
  const build = args.includes('--build');

  // Parse verbosity levels
  let verbosityLevel = 1;
  const verbosityIndex = args.indexOf('--verbosity');
  if (verbosityIndex !== -1 && args[verbosityIndex + 1]) {
    verbosityLevel = parseInt(args[verbosityIndex + 1], 10);
  } else if (args.includes('-vvv')) {
    verbosityLevel = 3;
  } else if (args.includes('-vv')) {
    verbosityLevel = 2;
  }

  // Initialize Logger Strategy
  Logger.init(verbosityLevel);

  if (configLoadError) {
    Logger.logEvent({
      level: 'warning',
      category: 'loader',
      message: `Failed to parse tool_config.json: ${configLoadError}. Using default paths.`
    });
  }

  if (!lintOnly && !build) {
    Logger.logEvent({
      level: 'action',
      category: 'general',
      message: "Usage: node index.js [--lint-only | --build] [--verbosity <1|2|3> | -vv | -vvv]"
    });
    process.exit(0);
  }

  Logger.logEvent({ level: 'action', category: 'general', message: "Starting DazzlingDB Compilation & Validation..." });
  Logger.logEvent({ level: 'info', category: 'general', message: `Active Environment: ${selectedEnv}` });
  Logger.logEvent({ level: 'verbose', category: 'loader', message: "Loading schema definitions from disk..." });
  
  const { flatSchemas, categoryStructure } = loadSchemas();
  
  Logger.logEvent({
    level: 'info',
    category: 'general',
    message: `Loaded ${Object.keys(flatSchemas).length} table schemas successfully.`
  });

  Logger.logEvent({ level: 'action', category: 'linter', message: "Running validation rules..." });
  const linter = new SchemaLinter(flatSchemas);
  const lintResult = linter.lint();

  // Print Warnings
  if (lintResult.warnings.length > 0) {
    lintResult.warnings.forEach(warn => {
      Logger.logEvent({ level: 'warning', category: 'linter', message: warn });
    });
  }

  // Print Errors
  if (lintResult.errors.length > 0) {
    lintResult.errors.forEach(err => {
      Logger.logEvent({ level: 'error', category: 'linter', message: err });
    });
    Logger.logEvent({
      level: 'error',
      category: 'general',
      message: "Linter failed: Relational anomalies or contract violations detected."
    });
    process.exit(1);
  }

  Logger.logEvent({
    level: 'success',
    category: 'general',
    message: "All schema linter checks passed successfully."
  });

  if (build) {
    Logger.logEvent({ level: 'action', category: 'compiler', message: "Compiling runtime schemas..." });
    compileRuntimeSchema(categoryStructure);

    Logger.logEvent({ level: 'action', category: 'compiler', message: "Compiling relationship dependency graph..." });
    const builder = new GraphBuilder(flatSchemas);
    builder.write(TARGET_GRAPH_JS);

    Logger.logEvent({
      level: 'success',
      category: 'general',
      message: "DazzlingDB compilation pipeline complete."
    });
  }
}

main();
