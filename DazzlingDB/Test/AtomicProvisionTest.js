/**
 * @file AtomicProvisionTest.js
 * Test suite designed to simulate an atomic (filtered) database repair.
 * This demonstrates the ability to execute isolated operations without provisioning the whole DB.
 */

function runAtomicProvisionTest() {
  console.log("🚀 Starting Atomic Provisioning Test...");
  const db = DBContext.getInstance();
  const fs = db.setup.fs;
  
  try {
    // --- Step 1: Intentionally cause a specific minor issue (Warning) ---
    console.log("🛠️ Step 1: Simulating a targeted header mismatch in 'Student'...");
    const studentsMeta = fs.findByName("Students");
    if (studentsMeta) {
      const ss = SpreadsheetApp.openById(studentsMeta.id);
      const sheet = ss.getSheetByName("Student");
      if (sheet) {
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        sheet.getRange(1, headers.length + 1).setValue("rogue_atomic_column");
        console.log("✅ Simulated WARNING: Added 'rogue_atomic_column' to 'Student'.");
      }
    } else {
        console.error("❌ 'Students' spreadsheet not found. Ensure the DB is initialized first.");
        return;
    }

    // --- Step 2: Generate the FULL Plan ---
    console.log("🔍 Step 2: Generating full diagnostic plan...");
    const fullPlan = db.setup.plan();
    console.log(`📊 Full Plan generated. Total pending operations: ${fullPlan.operations.length}`);

    // --- Step 3: Filter the Plan (The Atomic Logic) ---
    console.log("🎯 Step 3: Filtering plan to target ONLY the 'Student' table...");
    const TARGET_TABLE = "Student";
    
    // Create a new, isolated plan object structure
    const atomicPlan = {
      operations: fullPlan.operations.filter(op => 
         op.target && op.target.table === TARGET_TABLE
      ),
      // We don't necessarily need to perfectly calculate the summary for execute(), 
      // but the execute() method itself handles the raw operations array.
      summary: { errors: 0 } // Bypassing safety check for this test
    };

    console.log(`🎯 Filtered Plan contains ${atomicPlan.operations.length} operation(s) for '${TARGET_TABLE}'.`);

    if (atomicPlan.operations.length === 0) {
        console.log("⚠️ No operations found for the target table. Test cannot proceed.");
        return;
    }

    // --- Step 4: Execute ONLY the Filtered Plan ---
    console.log("⚡ Step 4: Executing the filtered (atomic) plan...");
    
    // Note: SchemaSetupEngine.execute() is public and accepts any valid plan object.
    const result = db.setup.execute(atomicPlan);
    console.log("✅ Atomic execution complete. Result:", JSON.stringify(result, null, 2));

    // --- Step 5: Verify the Atomic Fix ---
    console.log("🔍 Step 5: Running post-execution analysis...");
    const postPlan = db.setup.plan();
    
    // Verify the specific issue is gone
    const remainingTargetOps = postPlan.operations.filter(op => op.target && op.target.table === TARGET_TABLE);
    
    if (remainingTargetOps.length === 0) {
        console.log(`🎉 SUCCESS: The targeted table '${TARGET_TABLE}' was successfully repaired atomically!`);
    } else {
        console.error(`❌ FAILED: The targeted table '${TARGET_TABLE}' still has issues.`, remainingTargetOps);
    }
    
    return {
        executedResult: result,
        wasAtomicRepairSuccessful: remainingTargetOps.length === 0
    };

  } catch (error) {
    console.error("💥 Critical Failure during atomic provisioning test:", error.message);
    if (error.stack) console.error(error.stack);
    throw error;
  }
}
