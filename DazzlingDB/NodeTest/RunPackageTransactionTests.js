/**
 * @file RunPackageTransactionTests.js
 * Integration test verifying atomic Package transaction pipelines and LIFO rollbacks inside Node.js.
 * Utilizes try-catch-finally blocks and console.table formatting to visualize virtual database states.
 */
const path = require('path');
const { bootstrapVirtualEnv } = require(path.resolve(__dirname, '../../NodeEnvDB/setup'));
const { getTableData, resetDatabase } = require('../../NodeEnvDB/database');

console.log("🚀 BOOTSTRAPPING VIRTUAL TEST CONTEXT...");
bootstrapVirtualEnv();



/**
 * Utility to print virtual spreadsheet 2D arrays in clear ASCII table format.
 * @param {string} category - Spreadsheet workbook name.
 * @param {string} tableName - Sheet table name.
 */
function displayVirtualTable(category, tableName) {
  const sheet = getTableData(category, tableName);
  if (sheet.length === 0) {
    console.log(`\n📊 Table '${tableName}' is completely empty (no headers).`);
    return;
  }

  const headers = sheet[0];
  if (sheet.length === 1) {
    console.log(`\n📊 Table '${tableName}' (Headers only, 0 data rows):`);
    const emptyRowObj = {};
    headers.forEach(h => { emptyRowObj[h] = "(empty)"; });
    console.table([emptyRowObj]);
    return;
  }

  const dataRows = sheet.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, colIdx) => {
      obj[h] = row[colIdx] !== undefined ? row[colIdx] : null;
    });
    return obj;
  });

  console.log(`\n📊 Table '${tableName}' (${dataRows.length} data rows):`);
  console.table(dataRows);
}

function runPackageTransactionTests() {
  console.log("▶️ STARTING PACKAGE TRANSACTION TESTING SUITE...");

  try {
    console.log("\n=========================================");
    console.log("🔍 INITIAL COURSE & COURSE TYPE DATA BASELINE:");
    displayVirtualTable("Academic", "CourseType");
    displayVirtualTable("Academic", "Course");

    console.log("\n=========================================");
    executeScenario1_Success();
    
    console.log("\n🔍 INSPECTING DATABASE STATE AFTER SCENARIO 1 (SUCCESS):");
    displayVirtualTable("Academic", "Package");
    displayVirtualTable("Academic", "PackageItem");
    displayVirtualTable("Academic", "PackagePerk");

    console.log("\n=========================================");
    executeScenario2_Rollback();

  } catch (err) {
    console.error("\n❌ RUNNER FAULT INTERCEPTED:", err);
    process.exit(1);
  } finally {
    console.log("\n🔍 FINAL DATABASE STATE INSPECTION (POST-RUN CLEANUP):");
    displayVirtualTable("Academic", "CourseType");
    displayVirtualTable("Academic", "Course");
    displayVirtualTable("Academic", "Package");
    displayVirtualTable("Academic", "PackageItem");
    displayVirtualTable("Academic", "PackagePerk");
    console.log("\n🏁 Package Transaction Tests Complete.");
  }
}

function executeScenario1_Success() {
  console.log("▶️ SCENARIO 1: Atomic Package Creation (Success Flow)");
  resetDatabase();

  const db = DBContext.getInstance();
  const context = new SheetDB.PipelineContext({ mutationManifest: [] });

  const payload = {
    name: "Grade 10 premium science package",
    package_fee: 1500,
    description: "Contains Course and Math perks",
    items: [
      { entity_type: "course", entity_id: "CRS-3550D968" }
    ],
    perks: [
      { perk_title: "Free Textbook Delivery", perk_description: "Shipped straight to home" },
      { perk_title: "24/7 Slack Portal", perk_description: "Connect with teachers" }
    ]
  };

  // Run pipeline
  const result = SheetDB.AtomicPipeline.begin(db, context)
    .addStep("Package", (repo, state) => {
      const pkg = repo.insert({
        name: payload.name,
        package_fee: payload.package_fee,
        description: payload.description
      });
      state.package_id = pkg.package_id;
      state.pkg = pkg;
    })
    .addStep("PackageItem", (repo, state) => {
      const items = payload.items.map(item => ({
        package_id: state.package_id,
        entity_type: item.entity_type,
        entity_id: item.entity_id
      }));
      state.items = repo.insertMany(items);
    })
    .addStep("PackagePerk", (repo, state) => {
      const perks = payload.perks.map(perk => ({
        package_id: state.package_id,
        perk_title: perk.perk_title,
        perk_description: perk.perk_description
      }));
      state.perks = repo.insertMany(perks);
    })
    .execute((state) => {
      return {
        package_id: state.package_id,
        pkg: state.pkg,
        items: state.items,
        perks: state.perks
      };
    });

  // Assertions
  if (!result.package_id || !result.package_id.startsWith("PKG-")) {
    throw new Error(`Expected generated package_id to start with 'PKG-', got: ${result.package_id}`);
  }

  if (result.items.length !== 1 || result.items[0].package_id !== result.package_id) {
    throw new Error("PackageItem relation key linkage mismatch.");
  }

  if (result.perks.length !== 2 || result.perks[0].package_id !== result.package_id) {
    throw new Error("PackagePerk relation key linkage mismatch.");
  }

  // Verify manifest
  const manifest = context.mutationManifest;
  if (!manifest.includes("Package") || !manifest.includes("PackageItem") || !manifest.includes("PackagePerk")) {
    throw new Error(`Context mutation manifest does not contain all modified tables: ${JSON.stringify(manifest)}`);
  }

  console.log("   ✅ Success! Atomic package insertion completed with correct links.");
}

function executeScenario2_Rollback() {
  console.log("▶️ SCENARIO 2: Transaction Fracture & LIFO Rollback Eviction");
  
  // Make sure we have a clean slate at start of scenario 2
  resetDatabase();

  const db = DBContext.getInstance();
  const context = new SheetDB.PipelineContext({ mutationManifest: [] });

  const payload = {
    name: "Rollback package",
    package_fee: 1000,
    description: "This should not exist in database",
    items: [
      { entity_type: "course", entity_id: "CRS-3550D968" }
    ],
    perks: [
      { perk_title: "Faulty Perk" }
    ]
  };

  let transactionThrew = false;
  try {
    SheetDB.AtomicPipeline.begin(db, context)
      .addStep("Package", (repo, state) => {
        const pkg = repo.insert({
          name: payload.name,
          package_fee: payload.package_fee,
          description: payload.description
        });
        state.package_id = pkg.package_id;
      })
      .addStep("PackageItem", (repo, state) => {
        const items = payload.items.map(item => ({
          package_id: state.package_id,
          entity_type: item.entity_type,
          entity_id: item.entity_id
        }));
        repo.insertMany(items);
      })
      .addStep("PackagePerk", (repo, state) => {
        console.log("   [Forced failure point] Simulating runtime exception...");
        throw new Error("Forced perk step validation failure");
      })
      .execute();
  } catch (err) {
    if (err.message === "Forced perk step validation failure") {
      transactionThrew = true;
      console.log(`   [Expected Catch] Intercepted exception: "${err.message}"`);
    } else {
      throw err;
    }
  } finally {
    console.log("\n🔍 INSPECTING IMMEDIATE DATABASE STATE INSIDE FINALLY BLOCK (SCENARIO 2):");
    displayVirtualTable("Academic", "Package");
    displayVirtualTable("Academic", "PackageItem");
    displayVirtualTable("Academic", "PackagePerk");
  }

  // Assertions
  if (!transactionThrew) {
    throw new Error("Expected transaction execution block to throw, but it succeeded.");
  }

  const packageSheet = getTableData("Academic", "Package");
  const itemSheet = getTableData("Academic", "PackageItem");
  const perkSheet = getTableData("Academic", "PackagePerk");

  if (packageSheet.length !== 2 || itemSheet.length !== 4 || perkSheet.length !== 4) {
    throw new Error("Rollback failed: One or more written rows were not evicted.");
  }

  console.log("   ✅ Success! Rollback evicted all preceding database insertions cleanly.");
}

// Run the tests
runPackageTransactionTests();
