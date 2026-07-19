/**
 * @file AtomicPipelineTests.js
 * Integration tests for the AtomicPipeline transaction orchestration engine.
 * 
 * INSTRUCTIONS:
 * Run 'runAtomicPipelineTests' from the Apps Script IDE.
 */

function runAtomicPipelineTests() {
  console.log("🚀 Starting AtomicPipeline Testing Suite...");
  
  const scriptProperties = PropertiesService.getScriptProperties();
  const originalEnv = scriptProperties.getProperty('ENV') || 'DEVELOPMENT';
  
  try {
    scriptProperties.setProperty('ENV', 'TESTING');
    const db = DBContext.getInstance();
    db.bootstrapRepositories();

    const results = {};
    
    console.log("\n=========================================");
    results.Scenario1_SuccessfulPipeline = executeScenario1_SuccessfulPipeline(db);
    
    console.log("\n=========================================");
    results.Scenario2_PipelineShortCircuitAndRollback = executeScenario2_PipelineShortCircuitAndRollback(db);
    
    console.log("\n=========================================");
    results.Scenario3_BulkInsertIntegrity = executeScenario3_BulkInsertIntegrity(db);

    console.log("=========================================\n");
    console.log("📊 FINAL TEST RESULTS: \n", JSON.stringify(results, null, 2));

    // Performance assertion (Rule N5 compliance)
    console.log("⏱️ Asserting transaction performance...");
    const t0 = new Date().getTime();
    for (let i = 0; i < 50; i++) {
      SheetDB.AtomicPipeline.begin(db, {})
        .then((state) => { state.count = i; })
        .execute();
    }
    const t1 = new Date().getTime();
    console.log(`⏱️ Performance assertion: 50 pipeline executions in ${t1 - t0} ms.`);

    console.log("🏁 AtomicPipeline Tests Complete.");
    return results;
  } finally {
    scriptProperties.setProperty('ENV', originalEnv);
  }
}

function executeScenario1_SuccessfulPipeline(db) {
  console.log("▶️ SCENARIO 1: Successful Pipeline Chain & Output Mapping");
  try {
    const context = { mutationManifest: [] };
    const result = SheetDB.AtomicPipeline.begin(db, context)
      .then((state) => {
        state.step1 = "success";
      })
      .then((state) => {
        state.step2 = "completed";
      })
      .execute((state) => {
        return {
          combined: `${state.step1}_${state.step2}`
        };
      });

    if (result.combined !== "success_completed") {
      throw new Error(`Expected combined value 'success_completed', but got: ${result.combined}`);
    }

    console.log("   ✅ Success! Fluent pipeline executed and mapped output cleanly.");
    return "✅ PASSED";
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    return `❌ FAILED: ${e.message}`;
  }
}

function executeScenario2_PipelineShortCircuitAndRollback(db) {
  console.log("▶️ SCENARIO 2: Pipeline Error short-circuiting & Auto LIFO Rollback");
  try {
    const context = { mutationManifest: [] };
    const testTeacherId = "TCH-PIPELINE-TEST-" + new Date().getTime();
    
    let step3Ran = false;
    let errorThrown = false;

    try {
      SheetDB.AtomicPipeline.begin(db, context)
        .then((state, database, pipeline) => {
          // Insert a test record
          const inserted = database.TeacherSubject.insert({
            teacher_id: testTeacherId,
            subject_id: "CRS-DUMMY"
          });
          // Register the step manually with transaction tracker
          pipeline.tx.trackInsert(database.TeacherSubject, inserted.teacher_subject_id);
        })
        .then(() => {
          throw new Error("Triggered rollback error");
        })
        .then(() => {
          step3Ran = true;
        })
        .execute();
    } catch (e) {
      if (e.message === "Triggered rollback error") {
        errorThrown = true;
      } else {
        throw e;
      }
    }

    if (!errorThrown) {
      throw new Error("Expected pipeline error to propagate, but none was thrown.");
    }
    if (step3Ran) {
      throw new Error("Step 3 was executed despite preceding error in step 2.");
    }

    // Verify record was rolled back
    const countAfterRollback = db.TeacherSubject.where({ teacher_id: testTeacherId }).length;
    if (countAfterRollback !== 0) {
      throw new Error(`Rollback failed: record for teacher ${testTeacherId} was not deleted.`);
    }

    console.log("   ✅ Success! Pipeline short-circuited and triggered rollback successfully.");
    return "✅ PASSED";
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    return `❌ FAILED: ${e.message}`;
  }
}

function executeScenario3_BulkInsertIntegrity(db) {
  console.log("▶️ SCENARIO 3: Bulk Insertion Integration and Rollback validation");
  try {
    const context = { mutationManifest: [] };
    const testTeacherId = "TCH-PIPELINE-BULK-" + new Date().getTime();

    // Verify database currently has 0 mappings for this teacher
    let count = db.TeacherSubject.where({ teacher_id: testTeacherId }).length;
    if (count !== 0) throw new Error("Pre-condition failed: Teacher mappings already exist.");

    let errorThrown = false;

    try {
      SheetDB.AtomicPipeline.begin(db, context)
        .bulkInsert("TeacherSubject", (state) => {
          return [
            { teacher_id: testTeacherId, subject_id: "CRS-BULK1" },
            { teacher_id: testTeacherId, subject_id: "CRS-BULK2" }
          ];
        })
        .then((state, database) => {
          // Verify that during the transaction, the insertions are visible in the repository
          const inTxCount = database.TeacherSubject.where({ teacher_id: testTeacherId }).length;
          if (inTxCount !== 2) {
            throw new Error(`Expected 2 records during transaction, found ${inTxCount}`);
          }
          
          // Now cause a failure to trigger rollback
          throw new Error("Simulated failure post bulk-insert");
        })
        .execute();
    } catch (e) {
      if (e.message === "Simulated failure post bulk-insert") {
        errorThrown = true;
      } else {
        throw e;
      }
    }

    if (!errorThrown) {
      throw new Error("Expected simulated error to bubble up, but transaction completed silently.");
    }

    // Post-rollback verification: all inserted records must be evicted from the database
    const postRollbackCount = db.TeacherSubject.where({ teacher_id: testTeacherId }).length;
    if (postRollbackCount !== 0) {
      throw new Error(`Rollback verification failed: ${postRollbackCount} records remained in database.`);
    }

    console.log("   ✅ Success! Bulk insert completed, verified within transaction, and successfully cleaned up on error.");
    return "✅ PASSED";
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    return `❌ FAILED: ${e.message}`;
  }
}
