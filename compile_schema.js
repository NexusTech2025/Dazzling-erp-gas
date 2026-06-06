const fs = require('fs');
const path = require('path');

const SCHEMA_DIR = path.join(__dirname, 'DazzlingDB', 'Config', 'Schema');
const TARGET_JS_PATH = path.join(__dirname, 'DazzlingDB', 'Config', 'database_schema.js');

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
    "choices": [
      "PENDING",
      "COMMITTED",
      "FAILED"
    ],
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

function compile() {
  console.log("[Compiler] Starting schema compilation...");

  if (!fs.existsSync(SCHEMA_DIR)) {
    console.error(`[Compiler] Error: Schema directory not found at ${SCHEMA_DIR}`);
    process.exit(1);
  }

  const compiled = {
    "version": "2.1.1",
    "database": "DazzlingDB",
    "categories": {}
  };

  const categories = fs.readdirSync(SCHEMA_DIR);

  categories.forEach(cat => {
    const catPath = path.join(SCHEMA_DIR, cat);
    if (!fs.statSync(catPath).isDirectory()) return;

    compiled.categories[cat] = {
      "tables": {}
    };

    const tableFiles = fs.readdirSync(catPath).filter(f => f.endsWith('.json'));

    tableFiles.forEach(file => {
      const tableName = path.basename(file, '.json');
      const tableData = JSON.parse(fs.readFileSync(path.join(catPath, file), 'utf8'));

      // Validate primaryKey exists
      if (!tableData.primaryKey) {
        console.warn(`[Compiler] Warning: Table '${tableName}' does not specify a primaryKey.`);
      }

      // Inject system columns into columns
      const originalColumns = tableData.columns || {};
      const mergedColumns = {};

      // Standardize types and copy original columns
      for (const [colName, colConfig] of Object.entries(originalColumns)) {
        mergedColumns[colName] = { ...colConfig };
        
        // If string and no maxLength, add default 255
        if (mergedColumns[colName].type === 'string' && !mergedColumns[colName].maxLength) {
          mergedColumns[colName].maxLength = 255;
        }
      }

      // Inject system columns
      for (const [sysColName, sysColConfig] of Object.entries(SYSTEM_COLUMNS)) {
        mergedColumns[sysColName] = { ...sysColConfig };
      }

      compiled.categories[cat].tables[tableName] = {
        "primaryKey": tableData.primaryKey || "id",
        "columns": mergedColumns,
        "relations": tableData.relations || {}
      };
    });
  });

  // Compile the schema directly into JavaScript
  const jsonContent = JSON.stringify(compiled, null, 2);
  const jsContent = `const DATABASE_SCHEMA = ${jsonContent};\n`;

  // Write ONLY the runtime database_schema.js
  fs.writeFileSync(TARGET_JS_PATH, jsContent, 'utf8');
  console.log(`[Compiler] Wrote compiled database_schema.js to ${TARGET_JS_PATH}`);

  console.log("[Compiler] Schema compilation completed successfully!");
}

compile();
