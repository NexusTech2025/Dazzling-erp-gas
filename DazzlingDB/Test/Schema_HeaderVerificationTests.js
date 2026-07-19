/**
 * @file Schema_HeaderVerificationTests.js
 * Automated integration test suite verifying that the schema definitions of each table
 * exactly match the physical header columns present in the corresponding Google Sheets.
 * 
 * Instructions: Run `runSchemaHeaderVerificationTests()` from the Apps Script editor.
 */

function runSchemaHeaderVerificationTests() {
  console.log("🚀 Starting Schema Header Verification Integration Tests...");

  if (typeof PropertiesService === 'undefined') {
    throw new Error("PropertiesService is not defined. This test must be run in the Google Apps Script environment.");
  }

  const scriptProperties = PropertiesService.getScriptProperties();
  const originalEnv = scriptProperties.getProperty('ENV') || 'DEVELOPMENT';

  const results = {};
  let failures = 0;
  let totalChecked = 0;

  try {
    // 1. Force environment to TESTING and bootstrap repositories
    scriptProperties.setProperty('ENV', 'TESTING');
    const db = DBContext.getInstance().bootstrapRepositories();

    // 2. Fetch all table names defined in the schema
    if (typeof DATABASE_SCHEMA === 'undefined') {
      throw new Error("DATABASE_SCHEMA is not defined in global scope. Cannot verify schemas.");
    }

    const categories = DATABASE_SCHEMA.categories;
    if (!categories) {
      throw new Error("DATABASE_SCHEMA has no categories defined.");
    }

    const tableNames = [];
    for (const categoryName in categories) {
      const tables = categories[categoryName].tables;
      for (const tableName in tables) {
        tableNames.push(tableName);
      }
    }

    console.log(`📊 Found ${tableNames.length} tables in DATABASE_SCHEMA. Starting verification...\n`);

    tableNames.forEach(tableName => {
      totalChecked++;
      console.log(`-----------------------------------------`);
      console.log(`📋 Checking Table: '${tableName}'`);

      const repo = db[tableName];
      if (!repo) {
        results[tableName] = {
          status: "❌ FAILED",
          error: "Repository was not initialized/bound to DBContext."
        };
        failures++;
        console.error(`❌ Repository for '${tableName}' not found in DBContext!`);
        return;
      }

      try {
        const gateway = repo.gateway;
        const schemaColumns = Object.keys(gateway.columns);

        // Retrieve physical headers from the sheet
        const physicalHeaders = gateway.dataSource.getHeaders(gateway.category, gateway.tableName);

        const schemaSet = new Set(schemaColumns);
        const physicalSet = new Set(physicalHeaders);

        // Find missing columns (defined in schema but missing in sheet)
        const missingInSheet = schemaColumns.filter(col => !physicalSet.has(col));

        // Find extra columns (exist in sheet but missing in schema)
        const extraInSheet = physicalHeaders.filter(col => !schemaSet.has(col));

        // Check order discrepancies
        let orderMatches = true;
        const minLength = Math.min(schemaColumns.length, physicalHeaders.length);
        const orderDiscrepancies = [];
        for (let i = 0; i < minLength; i++) {
          if (schemaColumns[i] !== physicalHeaders[i]) {
            orderMatches = false;
            orderDiscrepancies.push({
              index: i,
              schema: schemaColumns[i],
              physical: physicalHeaders[i]
            });
          }
        }

        const isSuccess = (missingInSheet.length === 0);

        results[tableName] = {
          status: isSuccess ? "✅ PASSED" : "❌ FAILED",
          schemaColumnsCount: schemaColumns.length,
          physicalColumnsCount: physicalHeaders.length,
          missingInSheet: missingInSheet,
          extraInSheet: extraInSheet,
          orderMatches: orderMatches,
          orderDiscrepancies: orderDiscrepancies
        };

        if (isSuccess) {
          console.log(`✅ Table '${tableName}' verified successfully.`);
          const systemColumns = new Set(['__tx_id', '__tx_status', '__created_at']);
          const extraNonSystem = extraInSheet.filter(col => !systemColumns.has(col));
          if (extraNonSystem.length > 0) {
            console.warn(`   ⚠️ Extra columns in Sheet (Non-Schema): ${JSON.stringify(extraNonSystem)}`);
          }
          if (!orderMatches) {
            console.warn(`   ⚠️ Order mismatch (Schema != Physical). Discrepancies count: ${orderDiscrepancies.length}`);
          }
        } else {
          failures++;
          console.error(`❌ Mismatch detected for table '${tableName}':`);
          if (missingInSheet.length > 0) {
            console.error(`   - Missing in Sheet (Defined in Schema): ${JSON.stringify(missingInSheet)}`);
          }
        }
      } catch (tableError) {
        failures++;
        results[tableName] = {
          status: "❌ CRASHED",
          error: tableError.message
        };
        console.error(`❌ Error verifying table '${tableName}': ${tableError.message}`);
      }
    });

    console.log(`\n=========================================`);
    console.log(`📊 FINAL RESULTS: ${totalChecked - failures}/${totalChecked} Passed.`);
    console.log(`=========================================\n`);

    if (failures > 0) {
      throw new Error(`Schema Header Verification failed with ${failures} table mismatches.`);
    }

  } finally {
    // 3. Restore original environment
    scriptProperties.setProperty('ENV', originalEnv);
    DBContext.getInstance().bootstrapRepositories();
    console.log(`🏁 Restored environment context to [${originalEnv}].`);
  }

  return results;
}
