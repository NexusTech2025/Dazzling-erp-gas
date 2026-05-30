/**
 * @file BatchQuery_ApiTest.js
 * API Test for testing the Advanced Query Engine via 'data_query' for Batch table.
 * 
 * Instructions: Run `BatchQuery_ApiTest.run()` or `runBatchQueryTest()` from the Apps Script editor.
 */

const BatchQuery_ApiTest = (function() {

  function run() {
    const { logger, callApi } = ApiTestHelper;

    console.log("\n🧪 STARTING BATCH QUERY API TEST 🧪");
    
    try {
      logger.phase("1: Fetch Batches via Query Engine");

      const queryPayload = {
        target: "Batch",
        where: {},
        pagination: {
          limit: 10
        }
      };

      logger.action("Dispatching 'data_query' payload...");
      logger.detail("Payload: " + JSON.stringify(queryPayload));

      const result = callApi("data_query", queryPayload);
      
      logger.success(`Query executed successfully. Fetched ${result.count} batches.`);
      
      if (result.count === 0) {
        logger.detail("No batches found in the database. Ensure the seeder has been run or batches have been created.");
      } else {
        // Log the complete top 5 batch results to inspect the raw keys and values
        logger.data("Sample Batch Records (Top 5)", result.data.slice(0, 5));

        // Explicitly map and log the date fields to expose the current behavior
        const dateFieldsPreview = result.data.slice(0, 5).map(batch => ({
          batch_id: batch.batch_id,
          batch_name: batch.batch_name,
          start_date_type: typeof batch.start_date,
          start_date_value: JSON.stringify(batch.start_date),
          end_date_type: typeof batch.end_date,
          end_date_value: JSON.stringify(batch.end_date)
        }));

        logger.data("Date Fields Diagnosis Details (Top 5)", dateFieldsPreview);
      }

      console.log("\n🎉 BATCH QUERY API TEST RUN COMPLETE! 🎉\n");
    } catch (error) {
      ApiTestHelper.logger.error(`API Test Failed: ${error.message}`);
    }
  }

  return {
    run: run
  };

})();

function runBatchQueryTest() {
  BatchQuery_ApiTest.run();
}
