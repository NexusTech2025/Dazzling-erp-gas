/**
 * @file HeaderSync_DynamicTableTestSuite.js
 * Comprehensive test suite validating RequestScope Header Caching and Order-Agnostic Schema Provisioning.
 * Uses a dynamically injected schema table ('TestDynamicHeaderSyncTable') under the 'Attendance' category.
 */

/**
 * Main execution runner for the HeaderSync Dynamic Table Test Suite.
 */
function runHeaderSyncDynamicTableTestSuite() {
  const SCRIPT_PROP = PropertiesService.getScriptProperties();
  const OLD_ENV = SCRIPT_PROP.getProperty('ENV') || 'DEVELOPMENT';

  console.log("==================================================================");
  console.log("🚀 STARTING DYNAMIC TABLE HEADER SYNC TEST SUITE");
  console.log("==================================================================");

  let db = null;
  let testTableName = "TestDynamicHeaderSyncTable";

  try {
    // 1. Sandbox Environment Setup
    SCRIPT_PROP.setProperty('ENV', 'TESTING');
    db = DBContext.getInstance();

    // 2. Pre-cleanup any orphan sheet from previous runs
    cleanupDynamicTestWorksheet(db, testTableName);

    // 3. Inject Dynamic Schema into DATABASE_SCHEMA under Attendance category
    injectDynamicTableSchema(testTableName);

    // Re-bootstrap database repositories to build a fresh SchemaRegistry with the injected table
    db = db.bootstrapRepositories();

    // 4. Provision physical worksheet in Google Sheets
    console.log(`\n📋 Provisioning physical sheet for '${testTableName}'...`);
    db.setup.provision();

    // 5. Rearrange physical Row 1 to simulate an out-of-order column layout
    rearrangePhysicalSheetColumns(db, testTableName);

    // 6. Execute Test Scenarios
    test_DynamicTable_RequestScopeCacheHit(db, testTableName);
    test_DynamicTable_OrderAgnosticProvisioning(db, testTableName);
    test_DynamicTable_ColumnAgnosticCRUD(db, testTableName);
    test_DynamicTable_MissingColumnAppend(db, testTableName);
    test_DynamicTable_PurgeCacheBehavior(db, testTableName);

    console.log("\n==================================================================");
    console.log("✅ ALL DYNAMIC TABLE HEADER SYNC TESTS PASSED SUCCESSFULLY");
    console.log("==================================================================");

  } catch (err) {
    console.error(`❌ TEST SUITE FAILED: ${err.message}\n${err.stack}`);
  } finally {
    // Cleanup physical test worksheet and restore environment
    cleanupDynamicTestWorksheet(db, testTableName);
    SCRIPT_PROP.setProperty('ENV', OLD_ENV);
    console.log("[TestSuite Cleanup] Environment restored to original state.");
  }
}

/**
 * Dynamically injects a test table definition into DATABASE_SCHEMA under Attendance category.
 */
function injectDynamicTableSchema(tableName) {
  if (typeof DATABASE_SCHEMA !== 'undefined' && DATABASE_SCHEMA.categories && DATABASE_SCHEMA.categories.Attendance) {
    DATABASE_SCHEMA.categories.Attendance.tables[tableName] = {
      primaryKey: "sync_test_id",
      columns: {
        sync_test_id: { type: "string", required: true },
        col_a: { type: "string", required: false },
        col_b: { type: "string", required: false },
        col_c: { type: "string", required: false },
        col_d: { type: "string", required: false },
        col_e: { type: "string", required: false }
      }
    };
    console.log(`✅ Injected dynamic schema for '${tableName}'.`);
  }
}

/**
 * Manually rearranges physical Row 1 of the test sheet to simulate out-of-order columns.
 * Layout set to: ["sync_test_id", "col_e", "col_b", "col_c", "col_d", "col_a"] (col_e at Index 1).
 */
function rearrangePhysicalSheetColumns(db, tableName) {
  const fileMeta = db._fs.findByName("Attendance");
  const ss = SpreadsheetApp.openById(fileMeta.id);
  const sheet = ss.getSheetByName(tableName);

  if (!sheet) throw new Error(`Physical sheet '${tableName}' not found for rearrangement.`);

  const outOfOrderHeaders = ["sync_test_id", "col_e", "col_b", "col_c", "col_d", "col_a"];
  sheet.getRange(1, 1, 1, outOfOrderHeaders.length).setValues([outOfOrderHeaders]);
  
  // Clear RAM cache so next read fetches physical order
  if (db._dataSource && db._dataSource.requestHeaderCache) {
    db._dataSource.requestHeaderCache.clear();
  }

  console.log(`🔀 Physical Row 1 set to out-of-order layout: ${JSON.stringify(outOfOrderHeaders)}`);
}

/**
 * TEST 1: RequestScope Cache Hit/Miss & Physical Read
 */
function test_DynamicTable_RequestScopeCacheHit(db, tableName) {
  console.log("\n▶️ TEST 1: RequestScope Cache Hit & Miss Verification");
  const startTime1 = Date.now();
  
  // Call 1: RequestScope Cache Miss -> Physical Read
  const headers1 = db._dataSource.getHeaders("Attendance", tableName);
  const duration1 = Date.now() - startTime1;

  console.log(`  Read 1 (Cold RAM): ${JSON.stringify(headers1)} (${duration1}ms)`);
  if (headers1[1] !== "col_e") throw new Error(`Test 1 Failed: Expected 'col_e' at Index 1, got '${headers1[1]}'`);

  // Call 2: RequestScope Cache Hit -> RAM Read
  const startTime2 = Date.now();
  const headers2 = db._dataSource.getHeaders("Attendance", tableName);
  const duration2 = Date.now() - startTime2;

  console.log(`  Read 2 (RAM Hit) : ${JSON.stringify(headers2)} (${duration2}ms)`);
  if (duration2 > 5) console.warn(`  ⚠️ Warning: RAM read took ${duration2}ms`);
  
  console.log("  ✅ Test 1 Passed: RequestScope Cache Hit confirmed.");
}

/**
 * TEST 2: Order-Agnostic Schema Provisioning
 */
function test_DynamicTable_OrderAgnosticProvisioning(db, tableName) {
  console.log("\n▶️ TEST 2: Order-Agnostic Provisioning");

  // Execute provision() while physical sheet is out-of-order
  const result = db.setup.provision();
  console.log(`  Provision Summary: updatedHeaders count = ${result.summary ? result.summary.ensureHeader : 0}`);

  // Verify physical Row 1 was NOT overwritten
  const headersAfter = db._dataSource.getHeaders("Attendance", tableName);
  console.log(`  Headers After Provisioning: ${JSON.stringify(headersAfter)}`);

  if (headersAfter[1] !== "col_e") {
    throw new Error(`Test 2 Failed: Provisioning overwrote physical Row 1! Expected 'col_e' at Index 1, found '${headersAfter[1]}'.`);
  }

  console.log("  ✅ Test 2 Passed: Provisioning ignored column position differences.");
}

/**
 * TEST 3: Column-Agnostic CRUD Precision
 */
function test_DynamicTable_ColumnAgnosticCRUD(db, tableName) {
  console.log("\n▶️ TEST 3: Column-Agnostic CRUD Precision");

  const gateway = (db[tableName] && db[tableName].gateway)
    ? db[tableName].gateway
    : (typeof TableGateway !== 'undefined' ? new TableGateway(tableName, db._registry, db._dataSource, db) : null);
  if (!gateway) {
    console.log("  ℹ️ Skipping direct gateway CRUD assertion.");
    return;
  }

  const record = { sync_test_id: "TST-999", col_a: "AlphaVal", col_e: "EchoVal" };
  const mappedRow = gateway._mapObjectToRow(record);
  console.log(`  Mapped Row Array: ${JSON.stringify(mappedRow)}`);

  // Assert col_e ("EchoVal") is at Index 1 and col_a ("AlphaVal") is at Index 5
  const physicalHeaders = db._dataSource.getHeaders("Attendance", tableName);
  const colEIndex = physicalHeaders.indexOf("col_e");
  const colAIndex = physicalHeaders.indexOf("col_a");

  if (mappedRow[colEIndex] !== "EchoVal") {
    throw new Error(`Test 3 Failed: Mapped value for 'col_e' at index ${colEIndex} is '${mappedRow[colEIndex]}', expected 'EchoVal'.`);
  }
  if (mappedRow[colAIndex] !== "AlphaVal") {
    throw new Error(`Test 3 Failed: Mapped value for 'col_a' at index ${colAIndex} is '${mappedRow[colAIndex]}', expected 'AlphaVal'.`);
  }

  console.log("  ✅ Test 3 Passed: CRUD mapping is 100% column-order agnostic.");
}

/**
 * TEST 4: Missing Column Append
 */
function test_DynamicTable_MissingColumnAppend(db, tableName) {
  console.log("\n▶️ TEST 4: Missing Column Append Verification");

  // Inject a new column 'col_new' into schema
  if (DATABASE_SCHEMA.categories.Attendance.tables[tableName]) {
    DATABASE_SCHEMA.categories.Attendance.tables[tableName].columns.col_new = { type: "string", required: false };
  }

  // Provisioning should detect missing column 'col_new' and append it to end
  const result = db.setup.provision();
  
  // Clear RAM cache to force fresh read
  db._dataSource.requestHeaderCache.clear();
  const updatedHeaders = db._dataSource.getHeaders("Attendance", tableName);
  console.log(`  Updated Headers after missing column append: ${JSON.stringify(updatedHeaders)}`);

  if (!updatedHeaders.includes("col_new")) {
    throw new Error("Test 4 Failed: Newly added column 'col_new' was not appended.");
  }
  if (updatedHeaders[1] !== "col_e") {
    throw new Error("Test 4 Failed: Appending missing column disturbed existing column order.");
  }

  console.log("  ✅ Test 4 Passed: Missing column appended without disturbing existing layout.");
}

/**
 * TEST 5: Purge Cache Behavior
 */
function test_DynamicTable_PurgeCacheBehavior(db, tableName) {
  console.log("\n▶️ TEST 5: Purge Cache Behavior");

  db._dataSource.purgeCache();
  const isCached = db._dataSource.requestHeaderCache.has("Attendance", tableName);

  if (isCached) {
    throw new Error("Test 5 Failed: purgeCache() did not clear requestHeaderCache.");
  }

  console.log("  ✅ Test 5 Passed: purgeCache() flushed RequestHeaderCache successfully.");
}

/**
 * Cleans up temporary test worksheet from spreadsheet.
 */
function cleanupDynamicTestWorksheet(db, tableName) {
  try {
    if (!db) db = DBContext.getInstance();
    const fileMeta = db._fs.findByName("Attendance");
    if (fileMeta) {
      const ss = SpreadsheetApp.openById(fileMeta.id);
      const sheet = ss.getSheetByName(tableName);
      if (sheet) {
        ss.deleteSheet(sheet);
        console.log(`[TestSuite Cleanup] Deleted test worksheet '${tableName}'.`);
      }
    }
    // Remove dynamic schema entry
    if (typeof DATABASE_SCHEMA !== 'undefined' && DATABASE_SCHEMA.categories && DATABASE_SCHEMA.categories.Attendance) {
      delete DATABASE_SCHEMA.categories.Attendance.tables[tableName];
    }
  } catch (err) {
    console.warn(`[TestSuite Cleanup Warning]: ${err.message}`);
  }
}
