/**
 * @file HeaderSync_DiagnosticSuite.js
 * Comprehensive diagnostic suite to isolate header synchronization anomaly.
 * Target entity: Category 'Attendance', Table 'TeacherAttendance'
 */

/**
 * TEST CASE 1: Isolate Scenario A (Physical Sheet Auto-Alignment)
 * Direct low-level read of Row 1 in Google Sheets via SpreadsheetApp.
 */
function test_Diagnostic_PhysicalSheetRow1() {
  console.log("==================================================================");
  console.log("🔍 DIAGNOSTIC TEST 1: Direct Physical Sheet Row 1 Read");
  console.log("==================================================================");

  try {
    const db = DBContext.getInstance();
    
    // 1. Resolve spreadsheet file using SheetDB filesystem
    const fileMeta = db._fs.findByName("Attendance");
    if (!fileMeta) {
      console.error("❌ FAILED: Spreadsheet file 'Attendance' not found in Drive root.");
      return;
    }
    console.log(`📁 Found Spreadsheet: 'Attendance' (ID: ${fileMeta.id})`);

    // 2. Open physical spreadsheet directly via SpreadsheetApp (bypassing all caches)
    const ss = SpreadsheetApp.openById(fileMeta.id);
    const sheet = ss.getSheetByName("TeacherAttendance");
    if (!sheet) {
      console.error("❌ FAILED: Worksheet 'TeacherAttendance' not found in spreadsheet.");
      return;
    }

    const lastCol = sheet.getLastColumn();
    console.log(`📊 Worksheet Column Count: ${lastCol}`);

    if (lastCol === 0) {
      console.error("❌ FAILED: Sheet has 0 columns.");
      return;
    }

    // 3. Read raw cell values of Row 1
    const rawRow1 = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const cleanRow1 = rawRow1.map(h => String(h).trim());

    console.log("📋 RAW PHYSICAL ROW 1 FROM GOOGLE SHEETS:");
    console.log(JSON.stringify(cleanRow1, null, 2));

    // 4. Index checks
    const batchIdIndex = cleanRow1.indexOf("batch_id");
    console.log(`\n📌 'batch_id' Column Position in Sheet: Index ${batchIdIndex} (1-based Column: ${batchIdIndex + 1})`);

    if (batchIdIndex === 1) {
      console.warn("⚠️ SCENARIO A CONFIRMED: Row 1 in Google Sheets ALREADY has 'batch_id' at Column B (Index 1). The sheet itself was physically remapped by SchemaSetupEngine auto-alignment!");
    } else if (batchIdIndex === cleanRow1.length - 1) {
      console.log("✅ Sheet physical order is intact (batch_id is at the end). The anomaly is occurring in the caching/interception layer.");
    } else {
      console.log(`ℹ️ 'batch_id' is located at index ${batchIdIndex}.`);
    }

  } catch (e) {
    console.error(`❌ TEST 1 EXCEPTION: ${e.message}`, e.stack);
  }
}

/**
 * TEST CASE 2: Isolate Scenario B (Request-Scoped Cache Interception)
 * Monitors db._requestHeadersCache before and after DBContext initialization.
 */
function test_Diagnostic_RequestCacheState() {
  console.log("==================================================================");
  console.log("🔍 DIAGNOSTIC TEST 2: Request-Scoped Cache Interception Check");
  console.log("==================================================================");

  try {
    const db = DBContext.getInstance();
    const cacheKey = "Attendance_TeacherAttendance";

    // 1. Inspect request-scoped cache immediately after boot
    const preCallCached = db._requestHeadersCache ? db._requestHeadersCache[cacheKey] : undefined;
    console.log(`📌 db._requestHeadersCache['${cacheKey}'] BEFORE getHeaders() call:`);
    console.log(preCallCached ? JSON.stringify(preCallCached) : "undefined (NOT CACHED)");

    if (preCallCached) {
      console.warn("⚠️ SCENARIO B CONFIRMED: Request-scoped cache was PRE-POPULATED during DBContext bootstrapping before getHeaders() was called!");
    }

    // 2. Execute getHeaders
    console.log("\n▶️ Invoking db._dataSource.getHeaders('Attendance', 'TeacherAttendance')...");
    const resultHeaders = db._dataSource.getHeaders("Attendance", "TeacherAttendance");
    console.log("📋 Result Returned by getHeaders():");
    console.log(JSON.stringify(resultHeaders));

    // 3. Inspect request-scoped cache after call
    const postCallCached = db._requestHeadersCache ? db._requestHeadersCache[cacheKey] : undefined;
    console.log(`\n📌 db._requestHeadersCache['${cacheKey}'] AFTER getHeaders() call:`);
    console.log(JSON.stringify(postCallCached));

  } catch (e) {
    console.error(`❌ TEST 2 EXCEPTION: ${e.message}`, e.stack);
  }
}

/**
 * TEST CASE 3: Isolate Scenario C (CacheService Mutation Lifecycle)
 * Traces CacheService ("dazzling_db_headers_v2") state across 3 distinct checkpoints.
 */
function test_Diagnostic_CacheServiceLifecycle() {
  console.log("==================================================================");
  console.log("🔍 DIAGNOSTIC TEST 3: CacheService Lifecycle & Mutation Trace");
  console.log("==================================================================");

  const CACHE_KEY = "dazzling_db_headers_v2";
  const cache = CacheService.getScriptCache();

  try {
    // Checkpoint 1: Initial state
    const cp1 = cache.get(CACHE_KEY);
    console.log(`📌 Checkpoint 1 (Initial State): ${cp1 ? cp1 : "null (Empty Cache)"}`);

    // Checkpoint 2: Boot DBContext
    console.log("\n▶️ Initializing DBContext.getInstance()...");
    const db = DBContext.getInstance();

    const cp2 = cache.get(CACHE_KEY);
    console.log(`📌 Checkpoint 2 (Post-DBContext Boot): ${cp2 ? cp2 : "null (Empty Cache)"}`);

    if (cp1 === null && cp2 !== null) {
      console.warn("⚠️ SCENARIO C CONFIRMED: DBContext initialization sequence wrote to CacheService during boot!");
    }

    // Checkpoint 3: Execute getHeaders
    console.log("\n▶️ Invoking db._dataSource.getHeaders('Attendance', 'TeacherAttendance')...");
    const headers = db._dataSource.getHeaders("Attendance", "TeacherAttendance");
    console.log("📋 Returned Headers: " + JSON.stringify(headers));

    const cp3 = cache.get(CACHE_KEY);
    console.log(`📌 Checkpoint 3 (Post-getHeaders Call): ${cp3 ? cp3 : "null (Empty Cache)"}`);

  } catch (e) {
    console.error(`❌ TEST 3 EXCEPTION: ${e.message}`, e.stack);
  }
}

/**
 * MASTER RUNNER: Run all 3 diagnostic tests sequentially.
 */
function runHeaderSyncDiagnostics() {
  console.log("==================================================================");
  console.log("🚀 STARTING HEADER SYNC DIAGNOSTIC SUITE");
  console.log("==================================================================");

  test_Diagnostic_PhysicalSheetRow1();
  console.log("\n\n");
  test_Diagnostic_RequestCacheState();
  console.log("\n\n");
  test_Diagnostic_CacheServiceLifecycle();

  console.log("==================================================================");
  console.log("🏁 HEADER SYNC DIAGNOSTIC SUITE COMPLETE");
  console.log("==================================================================");
}
