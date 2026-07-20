/**
 * @file PackageCreate_ApiTest.js
 * API E2E Test Suite for testing package creation, updates, and deletion.
 * 
 * Instructions: Run the specific global wrapper functions from the Apps Script editor.
 */

const PackageCreate_ApiTest = (function () {

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
   * Executes E2E test for creating a package.
   */
  function run() {
    const { logger, callApi } = ApiTestHelper;
    console.log("\n🧪 STARTING PACKAGE CREATE API TEST 🧪");

    try {
      const superToken = _getSuperToken();
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

      const result = callApi("academic_create_package", payload, superToken);

      logger.success("API executed successfully.");
      logger.data("Created Package Response", result);

      console.log("\n🎉 PACKAGE CREATE API TEST COMPLETED SUCCESSFULLY! 🎉\n");
    } catch (error) {
      ApiTestHelper.logger.error(`API Test Failed: ${error.message}`);
    }
  }

  /**
   * Executes E2E test for updating a package.
   */
  function runUpdate() {
    const { logger, callApi } = ApiTestHelper;
    console.log("\n🧪 STARTING PACKAGE UPDATE API TEST 🧪");

    try {
      const superToken = _getSuperToken();
      logger.phase("1: Setup - Create Package for Update");

      const createPayload = {
        "name": "Update Test Package Base",
        "description": "Original Description",
        "target_class": "11",
        "board": "RBSE",
        "month": 12,
        "package_fee": 15000,
        "discount_percent": 10,
        "status": "active",
        "segment_id": "SEG-ACA",
        "recurring_billing": false,
        "courses": [],
        "perks": []
      };

      const createResult = callApi("academic_create_package", createPayload, superToken);
      const packageId = createResult.package_id;
      logger.success(`Package created for update test. ID: ${packageId}`);

      logger.phase("2: Invoke academic_update_package");
      const updatePayload = {
        "package_id": packageId,
        "name": "Updated Package Name",
        "description": "Updated Description",
        "package_fee": 18000,
        "discount_percent": 15,
        "status": "inactive"
      };

      logger.action("Dispatching 'academic_update_package' payload...");
      const result = callApi("academic_update_package", updatePayload, superToken);

      logger.success("API executed successfully.");
      logger.data("Updated Package Response", result);

      if (result.name !== "Updated Package Name" || result.package_fee !== 18000) {
        throw new Error("Updated package values do not match expected payload.");
      }
      logger.success("Update assertions passed.");

      console.log("\n🎉 PACKAGE UPDATE API TEST COMPLETED SUCCESSFULLY! 🎉\n");
    } catch (error) {
      ApiTestHelper.logger.error(`API Test Failed: ${error.message}`);
    }
  }

  /**
   * Executes E2E test for deleting a package.
   */
  function runDelete() {
    const { logger, callApi } = ApiTestHelper;
    console.log("\n🧪 STARTING PACKAGE DELETE API TEST 🧪");

    try {
      const superToken = _getSuperToken();
      logger.phase("1: Setup - Create Package for Delete");

      const createPayload = {
        "name": "Delete Test Package Base",
        "description": "To be deleted",
        "target_class": "11",
        "board": "RBSE",
        "month": 12,
        "package_fee": 10000,
        "discount_percent": 0,
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
        "perks": [
          {
            "perk_title": "Free Notes",
            "perk_description": "Curated revision materials",
            "icon": "notes-icon",
            "display_order": 0
          },
          {
            "perk_title": "Mock Tests Access",
            "perk_description": "24/7 online tests portal access",
            "icon": "quiz-icon",
            "display_order": 1
          }
        ]
      };

      const createResult = callApi("academic_create_package", createPayload, superToken);
      const packageId = createResult.package_id;
      logger.success(`Package created for delete test. ID: ${packageId}`);

      logger.phase("2: Invoke academic_delete_package");
      const deletePayload = {
        "package_id": packageId
      };

      logger.action("Dispatching 'academic_delete_package' payload...");
      const result = callApi("academic_delete_package", deletePayload, superToken);

      logger.success("API executed successfully.");
      logger.data("Delete Package Response", result);

      if (!result.success) {
        throw new Error("Delete response indicated failure.");
      }
      logger.success("Delete assertions passed.");

      console.log("\n🎉 PACKAGE DELETE API TEST COMPLETED SUCCESSFULLY! 🎉\n");
    } catch (error) {
      ApiTestHelper.logger.error(`API Test Failed: ${error.message}`);
    }
  }

  return {
    run: run,
    runUpdate: runUpdate,
    runDelete: runDelete
  };

})();

function runPackageCreateTest() {
  PackageCreate_ApiTest.run();
}

function runPackageUpdateTest() {
  PackageCreate_ApiTest.runUpdate();
}

function runPackageDeleteTest() {
  PackageCreate_ApiTest.runDelete();
}
