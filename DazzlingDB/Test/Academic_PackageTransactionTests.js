/**
 * @file Academic_PackageTransactionTests.js
 * Automated integration test verifying atomic Package transaction pipelines and LIFO rollbacks inside Google Apps Script.
 * Follows the DazzlingDB & SheetDB Testing Governance Rules.
 */

function runAcademicPackageTransactionTests() {
  console.log("🚀 Starting Academic Package Transaction Integration Tests...");

  const scriptProperties = PropertiesService.getScriptProperties();
  const originalEnv = scriptProperties.getProperty('ENV') || 'DEVELOPMENT';

  if (originalEnv === 'PRODUCTION') {
    throw new Error("❌ Safety Guard: Test suite cannot be executed in the PRODUCTION environment.");
  }

  const timings = {};
  const results = {};

  try {
    // 1. Initialize Sandbox Environment
    const tSandboxStart = new Date().getTime();
    scriptProperties.setProperty('ENV', 'TESTING');

    // Bootstrap isolated testing repositories
    DBContext.getInstance().bootstrapRepositories();
    const db = DBContext.getInstance();

    // Provision empty sandboxed sheets
    // db.setup.provision();
    timings.sandbox_setup = new Date().getTime() - tSandboxStart;

    // 2. Bootstrap Curriculum Reference Data using TestMockHelper
    const tBootStart = new Date().getTime();

    let branch = db.Branch.findOne({ branch_name: "Test Branch" });
    if (!branch) {
      branch = db.Branch.insert({ branch_name: "Test Branch", status: "active" });
    }

    const ctPayload = TestMockHelper.createCourseTypePayload({ segment_name: "Test Academy" });
    const courseType = db.CourseType.insert(ctPayload);

    const cPayload = TestMockHelper.createCoursePayload(courseType.segment_id, { name: "Test Math" });
    const course = db.Course.insert(cPayload);
    const mathId = course.course_id;

    timings.curriculum_boot = new Date().getTime() - tBootStart;

    console.log("\n=========================================");
    const tScen1Start = new Date().getTime();
    results.Scenario1_SuccessPath = executeScenario1_SuccessPath(db, mathId);
    timings.scenario1_success = new Date().getTime() - tScen1Start;

    console.log("\n=========================================");
    const tScen2Start = new Date().getTime();
    results.Scenario2_RollbackEviction = executeScenario2_RollbackEviction(db, mathId);
    timings.scenario2_rollback = new Date().getTime() - tScen2Start;

    // 3. Print Performance Timings Table
    const totalExecutionTime = Object.values(timings).reduce((sum, val) => sum + val, 0);
    console.log("\n========================================================");
    console.log("⏱️  PACKAGE TRANSACTION BENCHMARK TIMING SUMMARY  ⏱️");
    console.log("========================================================");
    console.log(`- Step 1: Sandbox Provisioning Setup      :    ${timings.sandbox_setup} ms`);
    console.log(`- Step 2: Bootstrapping Mock Curriculum   :    ${timings.curriculum_boot} ms`);
    console.log(`- Scenario 1: Atomic Package Creation (Success): ${timings.scenario1_success} ms`);
    console.log(`- Scenario 2: Transaction Rollback (Eviction):   ${timings.scenario2_rollback} ms`);
    console.log("--------------------------------------------------------");
    console.log(`- Total Execution Time                    :    ${totalExecutionTime} ms`);
    console.log("========================================================\n");

    console.log("📊 FINAL TEST RESULTS: \n", JSON.stringify(results, null, 2));
    console.log("🏁 Academic Package Transaction Tests Complete.");

    return results;
  } finally {
    // 4. Restore Development Environment
    scriptProperties.setProperty('ENV', originalEnv);
    DBContext.getInstance().bootstrapRepositories();
  }
}

/**
 * SCENARIO 1: Verifies atomic creation of Package, PackageItem, and PackagePerks
 */
function executeScenario1_SuccessPath(db, mathId) {
  console.log("▶️ SCENARIO 1: Atomic Package Creation (Success Path)");
  try {
    const payload = {
      name: "Premium Math Bundle " + new Date().getTime(),
      package_fee: 15000,
      description: "Contains Advanced Mathematics Curriculum",
      items: [
        { entity_type: "course", entity_id: mathId }
      ],
      perks: [
        { perk_title: "Slack Portal Access", perk_description: "Connect 24/7 with classmates" },
        { perk_title: "Live Doubts support", perk_description: "1-on-1 calls with math mentors" }
      ]
    };

    const context = new SheetDB.PipelineContext({ mutationManifest: [] });

    // Run transaction pipeline
    console.log("   ⚙️ Starting AtomicPipeline chain execution...");
    const result = SheetDB.AtomicPipeline.begin(db, context)
      .addStep("Package", function (repo, state) {
        const pkg = repo.insert({
          name: payload.name,
          package_fee: payload.package_fee,
          description: payload.description
        });
        state.package_id = pkg.package_id;
        state.pkg = pkg;
      })
      .addStep("PackageItem", function (repo, state) {
        const items = payload.items.map(function (item) {
          return {
            package_id: state.package_id,
            entity_type: item.entity_type,
            entity_id: item.entity_id
          };
        });
        state.items = repo.insertMany(items);
      })
      .addStep("PackagePerk", function (repo, state) {
        const perks = payload.perks.map(function (perk) {
          return {
            package_id: state.package_id,
            perk_title: perk.perk_title,
            perk_description: perk.perk_description
          };
        });
        state.perks = repo.insertMany(perks);
      })
      .execute(function (state) {
        return {
          package_id: state.package_id,
          pkg: state.pkg,
          items: state.items,
          perks: state.perks
        };
      });

    // Assertions
    if (!result.package_id || !result.package_id.startsWith("PKG-")) {
      throw new Error("Expected generated package_id to start with 'PKG-', got: " + result.package_id);
    }

    if (result.items.length !== 1 || result.items[0].package_id !== result.package_id) {
      throw new Error("PackageItem relation linkage mismatch.");
    }

    if (result.perks.length !== 2 || result.perks[0].package_id !== result.package_id) {
      throw new Error("PackagePerk relation linkage mismatch.");
    }

    // Verify written values physically from sheets
    const pkgRecord = db.Package.findById(result.package_id);
    if (!pkgRecord || pkgRecord.name !== payload.name) {
      throw new Error("Package record was not persistently saved.");
    }

    console.log("   ✅ Success! Created Package transaction and verified sheets mapping.");
    return "✅ PASSED";
  } catch (error) {
    console.error("   ❌ Scenario 1 Failed:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    return "❌ FAILED: " + error.message;
  }
}

/**
 * SCENARIO 2: Verifies transaction rollback LIFO eviction on validation/execution fracture
 */
function executeScenario2_RollbackEviction(db, mathId) {
  console.log("▶️ SCENARIO 2: Transaction Fracture & LIFO Rollback Eviction");
  try {
    const payload = {
      name: "Faulty Package " + new Date().getTime(),
      package_fee: 10000,
      description: "This record must be rolled back",
      items: [
        { entity_type: "course", entity_id: mathId }
      ],
      perks: [
        { perk_title: "Faulty Perk" }
      ]
    };

    const context = new SheetDB.PipelineContext({ mutationManifest: [] });
    let transactionThrew = false;
    let generatedPackageId = null;

    try {
      SheetDB.AtomicPipeline.begin(db, context)
        .addStep("Package", function (repo, state) {
          const pkg = repo.insert({
            name: payload.name,
            package_fee: payload.package_fee,
            description: payload.description
          });
          state.package_id = pkg.package_id;
          generatedPackageId = pkg.package_id;
        })
        .addStep("PackageItem", function (repo, state) {
          const items = payload.items.map(function (item) {
            return {
              package_id: state.package_id,
              entity_type: item.entity_type,
              entity_id: item.entity_id
            };
          });
          repo.insertMany(items);
        })
        .addStep("PackagePerk", function (repo, state) {
          console.log("   [Forced failure point] Throwing execution exception...");
          throw new Error("Forced step exception");
        })
        .execute();
    } catch (e) {
      if (e.message === "Forced step exception") {
        transactionThrew = true;
        console.log("   [Expected Catch] Intercepted forced failure.");
      } else {
        throw e;
      }
    }

    if (!transactionThrew) {
      throw new Error("Expected transaction execution block to throw, but it ran successfully.");
    }

    // Verify eviction: package and child items should NOT exist in sheets
    if (!generatedPackageId) {
      throw new Error("Package step failed to register generatedPackageId.");
    }

    const pkgRecord = db.Package.findById(generatedPackageId);
    if (pkgRecord) {
      throw new Error("Rollback failed: Package record was not evicted from sheet.");
    }

    const items = db.PackageItem.where({ package_id: generatedPackageId });
    if (items.length > 0) {
      throw new Error("Rollback failed: Child PackageItems were not evicted from sheet.");
    }

    console.log("   ✅ Success! Rollback evicted all partial records from physical sheets cleanly.");
    return "✅ PASSED";
  } catch (error) {
    console.error("   ❌ Scenario 2 Failed:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    return "❌ FAILED: " + error.message;
  }
}
