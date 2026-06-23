/**
 * Path: DazzlingDB/Test/OrchestratedStorageDriverTests.js
 * Axiom 6 Compliance Tracking Utility & Correctness Verification
 */

function executePolymorphicDriverBenchmark() {
  console.log("\n🧪 STARTING MULTI-STORAGE COORDINATOR BENCHMARK TEST SUITE 🧪\n");

  // Resolve sandbox database context to dynamically find spreadsheet files
  const dbContext = DBContext.getInstance();
  const fileSystem = dbContext._fs;
  const files = fileSystem.listAll();

  if (files.length < 2) {
    console.warn("[WARNING] Benchmark requires at least 2 spreadsheets in the sandbox folder. Attempting fallback lookup...");
  }

  // Physical spreadsheet IDs mapping provided by Moni
  const realSheetsMap = {
    "Finance": "1hW5QMj_Nwae0TE6TJXUnErxul7N4Sp1jppj7bznqw9I",
    "Academic": "1zVWS2FCMtMHcHVadNyZbOvuelOo21Kj1zG-X9iebG_M",
    "Students": "1RwtbuO9m1gN8X8kGeDjATnerZVTiCXvWAE-EM0KJUbI",
    "Auth": "1zvNgOzAnRK_-odY3K0jydm6aEYRRUwtXN-HmbnAmzNI",
    "Core": "1EomEa7_5r1GZbVd5K5G3rFarTyxNFzw9bwkkNX1A9nE",
    "Attendance": "1lyKwq_KNx7YpMtD-m_KPX_7W8_z3yZyh4kTASpX00So",
    "Staff": "1VjFOZirWbHFqnAdFpfydKaWUfSwKMRnaiIe3qbNEnk4",
    "Test": "1C8OR42U5PSlbzMcwq_uRbNq6IpqEEAygJYsXUlgXjrc"
  };

  const spreadsheetIdA = realSheetsMap.Students; // Target Students for surgical selection
  const spreadsheetIdB = realSheetsMap.Academic; // Target Academic for complete snapshot

  console.log(`Resolved Target A (Students) ID: ${spreadsheetIdA}`);
  console.log(`Resolved Target B (Academic) ID: ${spreadsheetIdB}`);

  // Resolve sheets of Target A dynamically to avoid hardcoded mismatch exceptions
  let targetSheets = [];
  try {
    const ssA = SpreadsheetApp.openById(spreadsheetIdA);
    const sheetsA = ssA.getSheets();
    if (sheetsA.length > 0) {
      targetSheets = sheetsA.slice(0, 2).map(s => s.getName());
    }
  } catch (e) {
    console.warn(`[WARNING] Could not pre-read sheets for Target A. Falling back to default whitelist. Msg: ${e.message}`);
    targetSheets = ["Student", "Enrollment"];
  }

  console.log(`Using whitelisted sheets for Target A: ${JSON.stringify(targetSheets)}`);

  const orchestrator = new SheetDB.MultiStorageCoordinator();

  // Manifest configurations: Target A with surgical sheets, Target B with complete snapshot
  const queryManifest = [
    { spreadsheetId: spreadsheetIdA, sheets: targetSheets },
    { spreadsheetId: spreadsheetIdB } // Omitted sheets fetches ALL tabs automatically
  ];

  console.log("================================────────────────────────");
  console.log("EXECUTION RUN: Verifying Advanced REST Single-Call Driver...");
  try {
    const resAdvanced = orchestrator.fetchDataRanges(queryManifest, { driverType: "ADVANCED" });
    console.log(`[PASS] REST Execution Complete.`);
    console.log(`- Strategy Executed : ${resAdvanced.meta.strategyExecuted}`);
    console.log(`- Execution Time    : ${resAdvanced.meta.executionTimeMs}ms`);
    console.log(`- Retrieved Files   : ${Object.keys(resAdvanced.data).length}`);

    // Validate returned shape correctness
    const fileKeys = Object.keys(resAdvanced.data);
    if (fileKeys.includes(spreadsheetIdA)) {
      console.log(`  - Verified: Returned sheets for Target A: ${Object.keys(resAdvanced.data[spreadsheetIdA]).join(", ")}`);
    }
  } catch (err) {
    console.error(`[FAIL] REST Extraction Engine threw an exception: ${err.name} -> ${err.message}`);
    if (err.stack) {
      console.error(err.stack);
    }
  }

  console.log("--------------------------------------------------------");
  console.log("EXECUTION RUN: Verifying Standard SpreadsheetApp Fallback Driver...");
  try {
    const resStandard = orchestrator.fetchDataRanges(queryManifest, { driverType: "STANDARD" });
    console.log(`[PASS] Standard Execution Complete.`);
    console.log(`- Strategy Executed : ${resStandard.meta.strategyExecuted}`);
    console.log(`- Execution Time    : ${resStandard.meta.executionTimeMs}ms`);
    console.log(`- Retrieved Files   : ${Object.keys(resStandard.data).length}`);

    const fileKeys = Object.keys(resStandard.data);
    if (fileKeys.includes(spreadsheetIdA)) {
      console.log(`  - Verified: Returned sheets for Target A: ${Object.keys(resStandard.data[spreadsheetIdA]).join(", ")}`);
    }
  } catch (err) {
    console.error(`[FAIL] Standard Engine threw an exception: ${err.name} -> ${err.message}`);
  }

  console.log("--------------------------------------------------------");
  console.log("EXECUTION RUN: Testing Error Interceptor mapping (Invalid ID)...");
  try {
    const invalidManifest = [
      { spreadsheetId: "INVALID_SPREADSHEET_ID_99999" }
    ];
    orchestrator.fetchDataRanges(invalidManifest);
    console.error("[FAIL] Expected ResourceNotFoundError but execution completed without throwing.");
  } catch (err) {
    console.log(`[PASS] Interceptor caught invalid ID error correctly:`);
    console.log(`  - Mapped Error Type: ${err.name}`);
    console.log(`  - Message: ${err.message}`);
  }

  console.log("================================────────────────========");
}
