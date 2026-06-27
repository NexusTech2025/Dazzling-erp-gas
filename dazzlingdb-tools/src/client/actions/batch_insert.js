/**
 * @file batch_insert.js
 * Component: Client Service Layer (Homogeneous Batch Engine Block)
 * Processes an array of payloads for a single entity scope with error aggregation and schema-based primary key lookup.
 */

const fs = require('fs');
const path = require('path');
const { callApi } = require('../api_client'); // Inherit native secure token wrapping
const Logger = require('../../logger/Logger');

class HomogeneousBatchEngine {
  /**
   * Orchestrates sequential single-row inserts over a homogeneous data array.
   * Bypasses fast-fail triggers to maximize partial processing throughput.
   * @param {string} actionName Target Apps Script action key (e.g., "academic_create_course").
   * @param {string} tableName Target schema model table mapping name (e.g., "Course").
   * @param {Array<Object>} records Roster matrix containing raw input data columns.
   * @returns {Promise<Object>} Consolidated telemetry execution manifest.
   */
  async processBatchStream(actionName, tableName, records) {
    const startTime = Date.now();
    Logger.logEvent({
      level: 'action',
      category: 'client',
      message: `Booting Homogeneous Import. Table: [${tableName}] | Action: [${actionName}] | Depth: ${records.length} items.`
    });

    const successManifest = [];
    const failureManifest = {};

    const primaryKeyField = this._resolvePrimaryKeyField(tableName);
    Logger.logEvent({
      level: 'verbose',
      category: 'client',
      message: `Resolved primary key field for [${tableName}] from schema registry: [${primaryKeyField}]`
    });

    for (let index = 0; index < records.length; index++) {
      const currentItem = records[index];
      
      try {
        // Determine payload format based on generic vs specific action
        let apiPayload;
        if (actionName === 'data_create') {
          apiPayload = {
            table: tableName,
            data: currentItem
          };
        } else {
          apiPayload = currentItem;
        }

        // Dispatch over the native HTTP wrapper (Auto-injects cached credentials & session keys)
        const response = await callApi(actionName, apiPayload);

        // Resolve returned committed record based on response envelope style
        let committedRecord;
        if (actionName === 'data_create') {
          committedRecord = response?.record || response || {};
        } else {
          committedRecord = response || {};
        }
        
        // Isolate primary key value dynamically (Axiom 5 - Zero Hardcoding)
        const primaryKeyValue = committedRecord[primaryKeyField];

        Logger.logEvent({
          level: 'success',
          category: 'client',
          message: `   Item ${index + 1}/${records.length} Committed. Resolved Key -> [${primaryKeyValue || 'N/A'}]`
        });

        successManifest.push({
          inputPayloadIndex: index,
          resolvedId: primaryKeyValue,
          recordSnapshot: committedRecord
        });

      } catch (exception) {
        Logger.logEvent({
          level: 'error',
          category: 'client',
          message: `   Item ${index + 1}/${records.length} Rejected -> Error: ${exception.message}`
        });

        // Collect rows that failed verification checks without breaking the parent loop
        failureManifest[index] = {
          message: exception.message,
          attemptedData: currentItem
        };
      }
    }

    const elapsed = Date.now() - startTime;
    const avgLatency = records.length > 0 ? (elapsed / records.length).toFixed(1) : 0;

    // Compile and organize final progress report metrics
    const telemetryReport = {
      executionMetadata: {
        tableContext: tableName,
        actionContext: actionName,
        timestamp: new Date().toISOString(),
        totalProcessed: records.length,
        successCount: successManifest.length,
        failureCount: Object.keys(failureManifest).length,
        wallTimeMs: elapsed,
        averageLatencyMs: parseFloat(avgLatency)
      },
      successManifest,
      failureManifest
    };

    // Print benchmark metrics (Rule N5)
    console.log('\n==================================================');
    console.log(`⏱️  Batch Execution Wall Time : ${elapsed}ms`);
    console.log(`⚡ Average Latency Per Row   : ${avgLatency}ms`);
    console.log(`📊 Success Rate              : ${successManifest.length}/${records.length} (${((successManifest.length / (records.length || 1)) * 100).toFixed(1)}%)`);
    console.log('==================================================\n');

    this._persistTelemetryOutput(tableName, telemetryReport);
    return telemetryReport;
  }

  /**
   * Resolves the primary key field name dynamically by parsing the compiled database schema registry.
   * Resolves the appropriate environment (--env) to load the correct schema file.
   * @private
   * @param {string} tableName - Target schema table mapping name.
   * @returns {string} Resolved primary key column name (defaults to `${tableName.toLowerCase()}_id` on failure).
   */
  _resolvePrimaryKeyField(tableName) {
    try {
      // 1. Resolve environment (--env development/production)
      const envIndex = process.argv.indexOf('--env');
      const envFlag = (envIndex !== -1 && process.argv[envIndex + 1]) ? process.argv[envIndex + 1].toLowerCase() : 'production';
      const selectedEnv = (envFlag === 'dev' || envFlag === 'development') ? 'development' : 'production';

      // 2. Load tool_config.json path
      const configPath = path.resolve(__dirname, '..', '..', '..', 'config', 'tool_config.json');
      let schemaJsRelativePath = '../DazzlingDB/Config/database_schema.js';
      
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config[selectedEnv]?.targetSchemaJs) {
          schemaJsRelativePath = config[selectedEnv].targetSchemaJs;
        }
      }

      const schemaJsPath = path.resolve(__dirname, '..', '..', '..', schemaJsRelativePath);
      if (!fs.existsSync(schemaJsPath)) {
        throw new Error(`Schema file not found at: ${schemaJsPath}. Please compile the schema first.`);
      }

      const content = fs.readFileSync(schemaJsPath, 'utf8');
      
      // Extract the JSON object from the JS file
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('Malformed database_schema.js structure.');
      }
      
      const schemaText = content.substring(jsonStart, jsonEnd + 1);
      const schema = JSON.parse(schemaText);

      // Find the primary key from categories
      if (schema.categories) {
        for (const [catName, catData] of Object.entries(schema.categories)) {
          if (catData.tables && catData.tables[tableName]) {
            return catData.tables[tableName].primaryKey || 'id';
          }
        }
      }
    } catch (err) {
      Logger.logEvent({
        level: 'warning',
        category: 'client',
        message: `Dynamic primary key lookup failed: ${err.message}. Falling back to default heuristics.`
      });
    }
    
    // Fallback heuristics if schema lookup fails
    return `${tableName.toLowerCase()}_id`;
  }

  /**
   * Saves execution metrics out to the standard workspace response folder.
   * @private
   */
  _persistTelemetryOutput(table, report) {
    const outputDir = path.resolve(__dirname, '..', '..', '..', 'responses');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const filename = `batch_${table.toLowerCase()}_manifest.json`;
    const fullOutputPath = path.join(outputDir, filename);
    
    fs.writeFileSync(fullOutputPath, JSON.stringify(report, null, 2), 'utf8');
    Logger.logEvent({
      level: 'success',
      category: 'general',
      message: `Telemetry report saved safely to location: ${fullOutputPath}`
    });
  }
}

// Support CLI Mode execution
if (require.main === module) {
  async function runCli() {
    const args = process.argv.slice(2);
    // Filter out --env argument and its value for argument parsing
    const cleanArgs = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--env') {
        i++; // skip value
        continue;
      }
      cleanArgs.push(args[i]);
    }

    if (cleanArgs.length < 3) {
      console.error('\n❌ Error: Missing arguments.');
      console.error('Usage: node batch_insert.js <action_key> <table_name> <payloads_json_file_or_raw_json> [--env <env>]\n');
      process.exit(1);
    }

    const actionKey = cleanArgs[0];
    const tableName = cleanArgs[1];
    const payloadArg = cleanArgs[2];
    let records = [];

    // Parse records payload
    if (payloadArg.trim().startsWith('[')) {
      try {
        records = JSON.parse(payloadArg);
      } catch (err) {
        console.error(`\n❌ Error parsing JSON array from CLI argument: ${err.message}\n`);
        process.exit(1);
      }
    } else {
      const filePath = path.resolve(payloadArg);
      if (!fs.existsSync(filePath)) {
        console.error(`\n❌ Error: Payloads file not found: ${filePath}\n`);
        process.exit(1);
      }
      try {
        const rawContent = fs.readFileSync(filePath, 'utf8');
        records = JSON.parse(rawContent);
        if (!Array.isArray(records)) {
          throw new Error('Payload JSON file must contain an Array of records.');
        }
      } catch (err) {
        console.error(`\n❌ Error reading/parsing payloads file: ${err.message}\n`);
        process.exit(1);
      }
    }

    try {
      const engine = new HomogeneousBatchEngine();
      const report = await engine.processBatchStream(actionKey, tableName, records);
      if (report.executionMetadata.failureCount > 0) {
        process.exit(2); // partial failure status code
      }
    } catch (err) {
      console.error(`\n❌ Batch execution aborted due to critical error: ${err.message}\n`);
      process.exit(1);
    }
  }

  runCli();
}

module.exports = { HomogeneousBatchEngine };
