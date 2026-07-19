/**
 * @file PackageCreate_ApiTest.js
 * API Test for testing academic_create_package with dummy package payload.
 * 
 * Instructions: Run `PackageCreate_ApiTest.run()` from the Apps Script editor.
 */

const PackageCreate_ApiTest = (function() {

  function run() {
    const { logger, callApi } = ApiTestHelper;

    console.log("\n🧪 STARTING PACKAGE CREATE API TEST 🧪");
    
    try {
      logger.phase("1: Invoke academic_create_package with Dummy Payload");

      const payload = {
        "name": "Dummay Package",
        "description": "",
        "target_class": "11",
        "board": "RBSE",
        "month": 12,
        "package_fee": 19997,
        "discount_percent": 74,
        "status": "active",
        "segment_id": "SEG-ACA",
        "recurring_billing": false,
        "courses": [
          {
            "entity_type": "course",
            "entity_id": "CRS-FB15A55B"
          },
          {
            "entity_type": "course",
            "entity_id": "CRS-8FD279B7"
          },
          {
            "entity_type": "course",
            "entity_id": "CRS-79E92F19"
          }
        ],
        "perks": []
      };

      logger.action("Dispatching 'academic_create_package' payload...");
      logger.detail("Payload: " + JSON.stringify(payload, null, 2));

      const result = callApi("academic_create_package", payload);
      
      logger.success("API executed successfully.");
      logger.data("Created Package Response", result);

      console.log("\n🎉 PACKAGE CREATE API TEST COMPLETED SUCCESSFULLY! 🎉\n");
    } catch (error) {
      ApiTestHelper.logger.error(`API Test Failed: ${error.message}`);
    }
  }

  return {
    run: run
  };

})();

function runPackageCreateTest() {
  PackageCreate_ApiTest.run();
}
