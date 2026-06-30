/**
 * @file TeacherSalaryConfigSecureCrudTests.js
 * Secure CRUD Integration Test Suite for Teacher Salary Config Management System.
 * Path: DazzlingDB/Test/TeacherSalaryConfigSecureCrudTests.js
 */

function runTeacherSalaryConfigSecureCrudTests() {
  console.log("🚀 Starting Secure Teacher Salary Config CRUD Integration Tests...");

  // 1. Initialize testing environment sandboxing
  const scriptProperties = PropertiesService.getScriptProperties();
  const originalEnv = scriptProperties.getProperty('ENV') || 'DEVELOPMENT';
  
  scriptProperties.setProperty('ENV', 'TESTING');
  
  try {
    const db = DBContext.getInstance();
    db.bootstrapRepositories();
    console.log("✅ Testing environment sandboxed and bootstrapped successfully.");

    // Generate unique credentials/mobile numbers to prevent duplicate errors
    const suffix = Math.random().toString(36).substring(7).toUpperCase();
    const mobileNumA = "96" + Math.floor(10000000 + Math.random() * 90000000);
    const mobileNumB = "97" + Math.floor(10000000 + Math.random() * 90000000);

    // 2. Onboard Teacher A and Teacher B
    console.log("\n--- Onboarding Test Teachers ---");
    const teacherA = db.Teacher.insert({
      full_name: `Secure Test Faculty A ${suffix}`,
      mobile_number: mobileNumA,
      email: `teacher_a_${suffix.toLowerCase()}@example.com`,
      experience_years: 5,
      teacher_type: "part_time",
      joining_date: new Date(),
      status: "active"
    });

    const teacherB = db.Teacher.insert({
      full_name: `Secure Test Faculty B ${suffix}`,
      mobile_number: mobileNumB,
      email: `teacher_b_${suffix.toLowerCase()}@example.com`,
      experience_years: 3,
      teacher_type: "full_time",
      joining_date: new Date(),
      status: "active"
    });

    const teacherIdA = teacherA.teacher_id;
    const teacherIdB = teacherB.teacher_id;

    console.log(`  Teacher A: ${teacherIdA}`);
    console.log(`  Teacher B: ${teacherIdB}`);

    // Create context for tracking mutations
    const context = {
      actionType: "CREATE",
      mutationManifest: []
    };

    // 3. Set Salary Config for Teacher A (using setSalaryConfig service directly)
    console.log("\n--- Creating Config for Teacher A ---");
    const configA = StaffService.setSalaryConfig({
      teacher_id: teacherIdA,
      salary_config_type: "recurring_monthly",
      rate_type: "monthly",
      base_value: 40000,
      scope_type: "global"
    }, context);

    const configIdA = configA.salary_config_id;
    console.log(`  Config A Created: ${configIdA}`);

    // Set Salary Config for Teacher B
    const configB = StaffService.setSalaryConfig({
      teacher_id: teacherIdB,
      salary_config_type: "recurring_monthly",
      rate_type: "monthly",
      base_value: 50000,
      scope_type: "global"
    }, context);

    const configIdB = configB.salary_config_id;
    console.log(`  Config B Created: ${configIdB}`);

    // 4. Test: Retrieve all configs for Teacher A
    console.log("\n--- Verification: staff_get_salary_configs ---");
    const getConfigsResult = StaffService.getSalaryConfigs(teacherIdA, context);
    if (!Array.isArray(getConfigsResult) || getConfigsResult.length !== 1) {
      throw new Error(`getSalaryConfigs failed to return exactly 1 config. Got: ${JSON.stringify(getConfigsResult)}`);
    }
    console.log("  ✅ Get configs successfully retrieved 1 record.");

    // 5. Test: Retrieve specific config for Teacher A (with ownership validation)
    console.log("\n--- Verification: staff_get_salary_config (Same Entity) ---");
    const getConfigResult = StaffService.getSalaryConfig(teacherIdA, configIdA, context);
    if (getConfigResult.salary_config_id !== configIdA || getConfigResult.base_value !== 40000) {
      throw new Error(`getSalaryConfig returned incorrect record data.`);
    }
    console.log("  ✅ Get specific config retrieved successfully with matched parameters.");

    // 6. Test: Retrieve Teacher B's config using Teacher A's ID (Cross-Entity Block Check)
    console.log("\n--- Verification: staff_get_salary_config (Cross-Entity Block) ---");
    try {
      StaffService.getSalaryConfig(teacherIdA, configIdB, context);
      throw new Error("❌ FAIL: Cross-entity query was not blocked!");
    } catch (e) {
      if (e.message.indexOf("Cross-entity query blocked") !== -1) {
        console.log(`  ✅ Successfully blocked cross-entity query: "${e.message}"`);
      } else {
        throw e;
      }
    }

    // 7. Test: Update specific config for Teacher A (Same Entity)
    console.log("\n--- Verification: staff_update_salary_config (Same Entity) ---");
    const updatedConfigA = StaffService.updateSalaryConfig(teacherIdA, configIdA, { base_value: 42000, remark: "Inflation Adjustment" }, context);
    if (updatedConfigA.base_value !== 42000 || updatedConfigA.remark !== "Inflation Adjustment") {
      throw new Error(`updateSalaryConfig did not update correctly. Config state: ${JSON.stringify(updatedConfigA)}`);
    }
    console.log("  ✅ Config updated successfully on matching owner entity.");

    // 8. Test: Update Teacher B's config using Teacher A's ID (Cross-Entity Block Check)
    console.log("\n--- Verification: staff_update_salary_config (Cross-Entity Block) ---");
    try {
      StaffService.updateSalaryConfig(teacherIdA, configIdB, { base_value: 99999 }, context);
      throw new Error("❌ FAIL: Cross-entity update was not blocked!");
    } catch (e) {
      if (e.message.indexOf("Cross-entity mutation blocked") !== -1) {
        console.log(`  ✅ Successfully blocked cross-entity update: "${e.message}"`);
      } else {
        throw e;
      }
    }

    // 9. Test: Security Whitelist Check (Reject Generic CRUD)
    console.log("\n--- Verification: Generic CRUD Blocking ---");
    // Simulate generic data_create action validation
    const createAction = new CreateRecordAction();
    createAction.init({
      payload: {
        table: "TeacherSalaryConfig",
        data: {
          teacher_id: teacherIdA,
          base_value: 30000
        }
      }
    }, context);

    try {
      createAction._validate();
      throw new Error("❌ FAIL: Generic CRUD validation did not block TeacherSalaryConfig!");
    } catch (e) {
      if (e.message.indexOf("is not eligible for generic CRUD operations") !== -1) {
        console.log(`  ✅ Successfully blocked generic CRUD creation: "${e.message}"`);
      } else {
        throw e;
      }
    }

    // 10. Test: Delete Teacher B's config using Teacher A's ID (Cross-Entity Block Check)
    console.log("\n--- Verification: staff_delete_salary_config (Cross-Entity Block) ---");
    try {
      StaffService.deleteSalaryConfig(teacherIdA, configIdB, context);
      throw new Error("❌ FAIL: Cross-entity deletion was not blocked!");
    } catch (e) {
      if (e.message.indexOf("Cross-entity deletion blocked") !== -1) {
        console.log(`  ✅ Successfully blocked cross-entity deletion: "${e.message}"`);
      } else {
        throw e;
      }
    }

    // 11. Test: Delete specific config for Teacher A (Same Entity)
    console.log("\n--- Verification: staff_delete_salary_config (Same Entity) ---");
    const deleteSuccess = StaffService.deleteSalaryConfig(teacherIdA, configIdA, context);
    if (!deleteSuccess) {
      throw new Error("deleteSalaryConfig returned false on successful deletion.");
    }
    
    // Confirm gone
    const afterDeleteConfigs = db.TeacherSalaryConfig.where({ teacher_id: teacherIdA });
    if (afterDeleteConfigs.length !== 0) {
      throw new Error("Config record still exists in database after successful delete operation.");
    }
    console.log("  ✅ Config deleted successfully and verified removed from database.");

    // Clean up Teacher B config
    db.TeacherSalaryConfig.remove(configIdB);

    // Clean up Teachers
    db.Teacher.remove(teacherIdA);
    db.Teacher.remove(teacherIdB);
    console.log("  ✅ Test generated data cleaned up successfully.");

    console.log("\n🎉 ALL SECURE CRUD INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉\n");

  } finally {
    // 12. Restore environment settings
    scriptProperties.setProperty('ENV', originalEnv);
    console.log(`🔄 Restored environment back to: ${originalEnv}`);
  }
}

// Bind to global namespace for execution from GAS runner
globalThis.runTeacherSalaryConfigSecureCrudTests = runTeacherSalaryConfigSecureCrudTests;
