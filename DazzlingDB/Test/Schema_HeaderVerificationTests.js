/**
 * Standalone debug script to verify structure, intercept layout rules,
 * and assert header order integrity returned by the core database datasource layer.
 */
function runHeaderVerificationTest() {
  console.log("\n🔍 STARTING DATABASE SCHEMA HEADER VERIFICATION TEST 🔍");

  const initialEnv = typeof PropertiesService !== "undefined"
    ? PropertiesService.getScriptProperties().getProperty("ENV")
    : "DEVELOPMENT";

  try {
    if (typeof PropertiesService !== "undefined") {
      PropertiesService.getScriptProperties().setProperty("ENV", "DEVELOPMENT");
    }

    console.log("⚙️ Bootstrapping database repositories...");
    DBContext.getInstance().bootstrapRepositories();
    const db = DBContext.getInstance();

    if (!db._dataSource || typeof db._dataSource.getHeaders !== 'function') {
      throw new Error("Critical Failure: Underlying data source or getHeaders method is completely missing.");
    }

    // 1. Defined target matrices along with exact ordered column expectations
    const inspectionTargets = [
      {
        category: "Finance",
        table: "MoneyTransaction",
        expectedHeaders: [
          "transaction_id", "amount", "type", "category_id", "payment_method",
          "payment_reference", "party_type", "party_id", "party_name", "transaction_date",
          "notes", "remarks", "created_by", "__tx_id", "__tx_status",
          "__created_at", "by", "from_to", "attachment_drive_id", "reconciliation_status"
        ]
      },
      {
        category: "Finance",
        table: "ExpenseCategory",
        expectedHeaders: [
          "category_id", "name", "type", "description", "__tx_id", "__tx_status", "__created_at"
        ]
      }
    ];

    console.log(`📦 Initiating header extractions for ${inspectionTargets.length} schema tables...`);

    inspectionTargets.forEach(({ category, table, expectedHeaders }, index) => {
      console.log(`\n👉 Target [${index + 1}]: Fetching structural layout for "${table}"...`);

      const headers = db._dataSource.getHeaders(category, table);

      console.log(`📊 Resulting Payload Elements Count: ${headers ? headers.length : 0}`);
      console.log(`📝 Raw Array Map: ${JSON.stringify(headers)}`);

      // 2. Validate structural presence
      if (!headers || !Array.isArray(headers)) {
        throw new Error(`Assertion Failed: Header response for [${table}] is null or not an array.`);
      }

      // 3. Assert Array Length Bounds Match
      if (headers.length !== expectedHeaders.length) {
        throw new Error(
          `❌ Count Mismatch for [${table}]: Expected structural size ${expectedHeaders.length}, but physical layout returned ${headers.length}.`
        );
      }

      // 4. Run Strict Order Iteration Matching
      expectedHeaders.forEach((expectedColumn, colIndex) => {
        const actualColumn = headers[colIndex];
        if (actualColumn !== expectedColumn) {
          throw new Error(
            `❌ Order Mismatch in [${table}] at Index ${colIndex}: Expected column field "${expectedColumn}", but physical layout returned "${actualColumn}".`
          );
        }
      });

      console.log(`✅ Order Assertion Passed: [${table}] exactly matches structural order schema rules.`);
    });

    console.log("\n🎉 All header order processing validations successfully passed.");

  } catch (error) {
    console.error(`❌ Header Verification Pipeline Failed: ${error.message}`);
    throw error;
  } finally {
    if (typeof PropertiesService !== "undefined" && initialEnv) {
      PropertiesService.getScriptProperties().setProperty("ENV", initialEnv);
    }
    console.log("🏁 Header Verification Script Context Terminated.");
  }
}