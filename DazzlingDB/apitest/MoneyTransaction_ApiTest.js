/**
 * @file MoneyTransaction_ApiTest.js
 * API E2E Integration Test Suite for creating, updating, and deleting MoneyTransaction records.
 *
 * Instructions: Run the specific global wrapper functions from the Apps Script editor.
 */

const MoneyTransaction_ApiTest = (function () {

  /**
   * Helper to load the super session token.
   * @private
   */
  function _getSuperToken() {
    return typeof PropertiesService !== "undefined"
      ? PropertiesService.getScriptProperties().getProperty("DEV_SUPER_TOKEN")
      : null;
  }

  /**
   * Scenario 1: Create MoneyTransaction
   */
  function run() {
    const { logger, callApi } = ApiTestHelper;
    console.log("\n🧪 STARTING MONEY TRANSACTION CREATE API TEST 🧪");

    const initialEnv = typeof PropertiesService !== "undefined"
      ? PropertiesService.getScriptProperties().getProperty("ENV")
      : "DEVELOPMENT";

    try {
      // Set to TESTING environment
      if (typeof PropertiesService !== "undefined") {
        PropertiesService.getScriptProperties().setProperty("ENV", "TESTING");
      }
      DBContext.getInstance().bootstrapRepositories();
      const db = DBContext.getInstance();
      db.setup.provision();

      const superToken = _getSuperToken();
      if (!superToken) {
        throw new Error("Bootstrap Token Missing: Please run DevBootstrap_ApiTest first to cache DEV_SUPER_TOKEN.");
      }

      logger.phase("1: Setup - Create a temporary ExpenseCategory via data_create");
      const categoryPayload = TestMockHelper.createExpenseCategoryPayload({
        name: "Temporary API Test Category",
        type: "both"
      });
      logger.action("Dispatching 'data_create' for ExpenseCategory...");
      const categoryResult = callApi("data_create", {
        table: "ExpenseCategory",
        data: categoryPayload
      }, superToken);

      const categoryId = categoryResult.payload.id;
      logger.success(`ExpenseCategory created with ID: ${categoryId}`);

      logger.phase("2: Dispatch data_create for MoneyTransaction");
      const transactionPayload = TestMockHelper.createMoneyTransactionPayload(
        1500.50,          // amount
        "out",            // type
        categoryId,       // category_id
        "external",       // party_type
        {
          party_name: "Vendor Alpha",
          notes: "E2E API Test payment entry",
          payment_method: "cash"
        }
      );

      logger.action("Dispatching 'data_create' for MoneyTransaction...");
      const transactionResult = callApi("data_create", {
        table: "MoneyTransaction",
        data: transactionPayload
      }, superToken);

      const transactionId = transactionResult.payload.id;
      logger.success(`MoneyTransaction created with ID: ${transactionId}`);
      logger.data("Created Transaction Details", transactionResult.payload.record);

      // Assertions
      if (!transactionId || !transactionId.startsWith("MTX-")) {
        throw new Error(`Expected generated transaction ID prefix 'MTX-', got: '${transactionId}'`);
      }

      const record = transactionResult.payload.record;
      if (record.amount !== 1500.50 || record.party_name !== "Vendor Alpha" || record.category_id !== categoryId) {
        throw new Error("Created transaction properties mismatch.");
      }

      logger.success("Create assertions passed.");
      console.log("\n🎉 MONEY TRANSACTION CREATE API TEST COMPLETED SUCCESSFULLY! 🎉\n");

      return { transactionId, categoryId };
    } catch (error) {
      logger.error(`API Test Failed: ${error.message}`);
      throw error;
    } finally {
      if (typeof PropertiesService !== "undefined") {
        PropertiesService.getScriptProperties().setProperty("ENV", initialEnv);
      }
      DBContext.getInstance().bootstrapRepositories();
    }
  }

  /**
   * Scenario 2: Update MoneyTransaction
   */
  function runUpdate() {
    const { logger, callApi } = ApiTestHelper;
    console.log("\n🧪 STARTING MONEY TRANSACTION UPDATE API TEST 🧪");

    const initialEnv = typeof PropertiesService !== "undefined"
      ? PropertiesService.getScriptProperties().getProperty("ENV")
      : "DEVELOPMENT";

    try {
      if (typeof PropertiesService !== "undefined") {
        PropertiesService.getScriptProperties().setProperty("ENV", "TESTING");
      }
      DBContext.getInstance().bootstrapRepositories();
      const db = DBContext.getInstance();
      db.setup.provision();

      const superToken = _getSuperToken();

      logger.phase("1: Setup - Create Temporary Category & Transaction");
      const categoryPayload = TestMockHelper.createExpenseCategoryPayload({ name: "API Update Category" });
      const categoryResult = callApi("data_create", {
        table: "ExpenseCategory",
        data: categoryPayload
      }, superToken);
      const categoryId = categoryResult.payload.id;

      const transactionPayload = TestMockHelper.createMoneyTransactionPayload(
        100.00,
        "in",
        categoryId,
        "external",
        { party_name: "Original Client", notes: "Original Note" }
      );
      const transactionResult = callApi("data_create", {
        table: "MoneyTransaction",
        data: transactionPayload
      }, superToken);
      const transactionId = transactionResult.payload.id;
      logger.success(`Transaction setup complete. ID: ${transactionId}`);

      logger.phase("2: Dispatch data_update for MoneyTransaction");
      const updatedData = {
        amount: 250.75,
        notes: "Updated Note via API Test"
      };

      logger.action(`Dispatching 'data_update' for MoneyTransaction ID: ${transactionId}...`);
      const updateResult = callApi("data_update", {
        table: "MoneyTransaction",
        id: transactionId,
        data: updatedData
      }, superToken);

      logger.success("API executed successfully.");
      logger.data("Update Transaction Response", updateResult);

      const record = updateResult.payload.record;
      if (record.amount !== 250.75 || record.notes !== "Updated Note via API Test") {
        throw new Error("Update transaction properties mismatch.");
      }

      logger.success("Update assertions passed.");
      console.log("\n🎉 MONEY TRANSACTION UPDATE API TEST COMPLETED SUCCESSFULLY! 🎉\n");
    } catch (error) {
      logger.error(`API Test Failed: ${error.message}`);
      throw error;
    } finally {
      if (typeof PropertiesService !== "undefined") {
        PropertiesService.getScriptProperties().setProperty("ENV", initialEnv);
      }
      DBContext.getInstance().bootstrapRepositories();
    }
  }

  /**
   * Scenario 3: Delete MoneyTransaction
   */
  function runDelete() {
    const { logger, callApi } = ApiTestHelper;
    console.log("\n🧪 STARTING MONEY TRANSACTION DELETE API TEST 🧪");

    const initialEnv = typeof PropertiesService !== "undefined"
      ? PropertiesService.getScriptProperties().getProperty("ENV")
      : "DEVELOPMENT";

    try {
      if (typeof PropertiesService !== "undefined") {
        PropertiesService.getScriptProperties().setProperty("ENV", "TESTING");
      }
      DBContext.getInstance().bootstrapRepositories();
      const db = DBContext.getInstance();
      db.setup.provision();

      const superToken = _getSuperToken();

      logger.phase("1: Setup - Create Temporary Category & Transaction");
      const categoryPayload = TestMockHelper.createExpenseCategoryPayload({ name: "API Delete Category" });
      const categoryResult = callApi("data_create", {
        table: "ExpenseCategory",
        data: categoryPayload
      }, superToken);
      const categoryId = categoryResult.payload.id;

      const transactionPayload = TestMockHelper.createMoneyTransactionPayload(
        500.00,
        "out",
        categoryId,
        "external",
        { party_name: "Teardown Vendor" }
      );
      const transactionResult = callApi("data_create", {
        table: "MoneyTransaction",
        data: transactionPayload
      }, superToken);
      const transactionId = transactionResult.payload.id;
      logger.success(`Transaction setup complete. ID: ${transactionId}`);

      logger.phase("2: Dispatch data_delete for MoneyTransaction");
      logger.action(`Dispatching 'data_delete' for MoneyTransaction ID: ${transactionId}...`);
      const deleteTxResult = callApi("data_delete", {
        table: "MoneyTransaction",
        id: transactionId
      }, superToken);

      if (!deleteTxResult.payload.id) {
        throw new Error("Delete response payload ID missing.");
      }
      logger.success("MoneyTransaction deleted successfully.");

      logger.phase("3: Verify Eviction of Transaction");
      const record = db.MoneyTransaction.findById(transactionId);
      if (record) {
        throw new Error("Database integrity violated: MoneyTransaction record still exists after deletion.");
      }
      logger.success("Eviction of MoneyTransaction verified successfully.");

      logger.phase("4: Teardown - Delete the temporary ExpenseCategory");
      logger.action(`Dispatching 'data_delete' for ExpenseCategory ID: ${categoryId}...`);
      const deleteCatResult = callApi("data_delete", {
        table: "ExpenseCategory",
        id: categoryId
      }, superToken);

      if (!deleteCatResult.payload.id) {
        throw new Error("Delete ExpenseCategory response payload ID missing.");
      }
      logger.success("ExpenseCategory deleted successfully.");

      const catRecord = db.ExpenseCategory.findById(categoryId);
      if (catRecord) {
        throw new Error("Database integrity violated: ExpenseCategory record still exists after deletion.");
      }
      logger.success("Eviction of ExpenseCategory verified successfully.");

      console.log("\n🎉 MONEY TRANSACTION DELETE API TEST COMPLETED SUCCESSFULLY! 🎉\n");
    } catch (error) {
      logger.error(`API Test Failed: ${error.message}`);
      throw error;
    } finally {
      if (typeof PropertiesService !== "undefined") {
        PropertiesService.getScriptProperties().setProperty("ENV", initialEnv);
      }
      DBContext.getInstance().bootstrapRepositories();
    }
  }

  return {
    run: run,
    runUpdate: runUpdate,
    runDelete: runDelete
  };
})();

// Global execution wrappers
function runMoneyTransactionCreateApiTest() {
  MoneyTransaction_ApiTest.run();
}

function runMoneyTransactionUpdateApiTest() {
  MoneyTransaction_ApiTest.runUpdate();
}

function runMoneyTransactionDeleteApiTest() {
  MoneyTransaction_ApiTest.runDelete();
}
