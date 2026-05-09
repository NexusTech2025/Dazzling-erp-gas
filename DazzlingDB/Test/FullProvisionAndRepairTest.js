/**
 * @file FullProvisionAndRepairTest.js
 * Test suite designed to simulate a full database provisioning cycle
 * from scratch, followed by a health analysis to verify total structural integrity.
 */

function runFullProvisionAndRepairTest() {
  console.log("🚀 Starting Full Database Provisioning Test...");
  
  try {
    const db = DBContext.getInstance();
    
    // Step 1: Force a full provision cycle.
    // This will create any missing files, sheets, headers, or metadata.
    console.log("🔄 Executing Global Provision (Repair All)...");
    const provisionResult = db.setup.provision();
    console.log("✅ Provisioning Complete. Changes made:", JSON.stringify(provisionResult, null, 2));

    // Step 2: Run a fresh analysis plan to verify the state.
    // If the provision was successful, the plan should have exactly 0 errors and 0 pending operations.
    console.log("🔍 Running Post-Provision Health Analysis...");
    const postPlan = db.setup.plan();
    
    const isHealthy = 
        postPlan.summary.errors === 0 && 
        postPlan.summary.createFile === 0 &&
        postPlan.summary.createSheet === 0 &&
        postPlan.summary.ensureHeader === 0 &&
        postPlan.summary.metaUpdates === 0;

    if (isHealthy) {
        console.log("🎉 SUCCESS: The database is 100% synchronized with the schema.");
        console.log("Health Summary:", JSON.stringify(postPlan.summary, null, 2));
    } else {
        console.error("❌ FAILED: The database still contains unresolved structural anomalies after provisioning.");
        console.error("Remaining Issues:", JSON.stringify(postPlan.operations, null, 2));
    }
    
    return {
        provisionResult: provisionResult,
        finalHealth: postPlan.summary,
        isHealthy: isHealthy
    };

  } catch (error) {
    console.error("💥 Critical Failure during provisioning test:", error.message);
    if (error.stack) console.error(error.stack);
    throw error;
  }
}
