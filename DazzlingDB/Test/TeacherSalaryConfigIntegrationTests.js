/**
 * @file TeacherSalaryConfigIntegrationTests.js
 * Integration test suite for the Teacher Salary Config Subsystem.
 * Path: DazzlingDB/Test/TeacherSalaryConfigIntegrationTests.js
 */

/**
 * Runs the integration test suite for the Teacher Salary Config Subsystem.
 * Sets up a sandboxed testing environment, provisions branches, courses, and batches,
 * configures stacked and scoped salary configurations for a teacher, triggers calculations,
 * and asserts status invariants and coexistence across overlapping scopes.
 *
 * @returns {void}
 */
function runTeacherSalaryConfigIntegrationTests() {
  console.log("🚀 Starting Teacher Salary Config Subsystem Integration Tests...");

  // 1. Initialize testing environment sandboxing
  const scriptProperties = PropertiesService.getScriptProperties();
  const originalEnv = scriptProperties.getProperty('ENV') || 'DEVELOPMENT';
  
  scriptProperties.setProperty('ENV', 'TESTING');
  
  // Trackers for teardown cleanup (Rule 2.F)
  const createdBranchIds = [];
  const createdCourseTypeIds = [];
  const createdCourseIds = [];
  const createdBatchIds = [];
  const createdConfigIds = [];
  const createdTransactionIds = [];

  // Timing metrics (Rule 2.G)
  const timings = {};
  const suiteStart = Date.now();

  try {
    const db = DBContext.getInstance();
    db.bootstrapRepositories();
    console.log("✅ Testing environment sandboxed and bootstrapped successfully.");

    const suffix = Math.random().toString(36).substring(7).toUpperCase();
    const context = { actionType: "CREATE", mutationManifest: [] };

    // =========================================================================
    // PHASE 0: Dependency Registration (Branches, CourseTypes, Courses, Batches)
    // =========================================================================
    console.log("\n--- [PHASE 0] Registering Dependencies (CourseTypes, Courses, Batches, Branch) ---");
    let startTime = Date.now();

    // 1. Provision a mock Branch
    const branch = db.Branch.insert({
      branch_name: "Integration Test Branch " + suffix,
      status: "active"
    });
    createdBranchIds.push(branch.branch_id);
    console.log(`✅ Provisioned Branch: ${branch.branch_id}`);

    // 2. Provision CourseType segment
    const segmentPayload = TestMockHelper.createCourseTypePayload({
      segment_name: "Int Segment " + suffix
    });
    const courseType = db.CourseType.insert(segmentPayload);
    createdCourseTypeIds.push(courseType.segment_id);
    console.log(`✅ Provisioned CourseType Segment: ${courseType.segment_id}`);

    // 3. Provision 5 Courses
    const courses = [];
    for (let i = 1; i <= 5; i++) {
      const coursePayload = TestMockHelper.createCoursePayload(courseType.segment_id, {
        name: `Int Course ${i} ${suffix}`,
        short_code: `CRS-${suffix}-${i}`,
        base_fee: 10000 * i
      });
      const course = db.Course.insert(coursePayload);
      courses.push(course);
      createdCourseIds.push(course.course_id);
    }
    console.log(`✅ Provisioned 5 Courses: ${courses.map(c => c.course_id).join(", ")}`);
    timings["Phase 0: Dependency Registration"] = Date.now() - startTime;

    // =========================================================================
    // PHASE 1: Onboard 3 Teachers (Skipped - Using existing teacher ID)
    // =========================================================================
    console.log("\n--- [PHASE 1] Using existing teacher ID TCH-7739290D ---");
    startTime = Date.now();
    const teacher1 = { teacher_id: "TCH-7739290D" };
    const teacher2 = { teacher_id: "TCH-7739290D" };
    const teacher3 = { teacher_id: "TCH-7739290D" };

    // 4. Provision 5 Batches linked to the Teacher
    const batches = [];
    for (let i = 1; i <= 5; i++) {
      const assignedTeacher = i === 2 ? teacher2 : (i === 3 ? teacher3 : teacher1);
      const batchPayload = TestMockHelper.createBatchPayload(courses[i-1].course_id, assignedTeacher.teacher_id, branch.branch_id, {
        batch_name: `Int Batch ${i} ${suffix}`,
        start_date: "2026-06-01"
      });
      const batch = db.Batch.insert(batchPayload);
      batches.push(batch);
      createdBatchIds.push(batch.batch_id);
    }
    console.log(`✅ Provisioned 5 Batches: ${batches.map(b => b.batch_id).join(", ")}`);
    timings["Phase 1: Batch Setup"] = Date.now() - startTime;

    // =========================================================================
    // PHASE 2: Configure Teacher Salary Configurations
    // =========================================================================
    console.log("\n--- [PHASE 2] Setting up Configurations via StaffService ---");
    startTime = Date.now();

    // Teacher 1: Flat monthly rate scoped to single batch (BTC-TEST-1)
    const cfg1 = StaffService.setSalaryConfig(TestMockHelper.createTeacherSalaryConfigPayload(teacher1.teacher_id, {
      salary_config_type: "recurring_monthly",
      rate_type: "monthly",
      base_value: 30000.00,
      scope_type: "single_batch",
      scope_id: batches[0].batch_id,
      effective_from: "2026-06-01"
    }), context);
    createdConfigIds.push(cfg1.salary_config_id);

    // Teacher 2: Triple stacked hybrid configuration
    // Config A: Flat global monthly of ₹40,000 (expired when Config B is set)
    const cfgA = StaffService.setSalaryConfig(TestMockHelper.createTeacherSalaryConfigPayload(teacher2.teacher_id, {
      salary_config_type: "recurring_monthly",
      rate_type: "monthly",
      base_value: 40000.00,
      scope_type: "global",
      effective_from: "2026-06-01"
    }), context);
    createdConfigIds.push(cfgA.salary_config_id);

    // Config B: Annualized global of ₹120,000 (monthly ₹10,000 draw)
    const cfgB = StaffService.setSalaryConfig(TestMockHelper.createTeacherSalaryConfigPayload(teacher2.teacher_id, {
      salary_config_type: "fixed_duration_pool",
      rate_type: "yearly",
      base_value: 120000.00,
      total_contract_value: 120000.00,
      scope_type: "global",
      effective_from: "2026-06-01"
    }), context);
    createdConfigIds.push(cfgB.salary_config_id);

    // Config C: 20% revenue share scoped to batch 2 (BTC-TEST-2)
    const cfgC = StaffService.setSalaryConfig(TestMockHelper.createTeacherSalaryConfigPayload(teacher2.teacher_id, {
      salary_config_type: "recurring_monthly",
      rate_type: "revenue_percentage",
      base_value: 20.0,
      scope_type: "single_batch",
      scope_id: batches[1].batch_id,
      effective_from: "2026-06-01"
    }), context);
    createdConfigIds.push(cfgC.salary_config_id);

    // Teacher 3: 15% revenue share scoped to batch 3 (BTC-TEST-3)
    const cfg3 = StaffService.setSalaryConfig(TestMockHelper.createTeacherSalaryConfigPayload(teacher3.teacher_id, {
      salary_config_type: "recurring_monthly",
      rate_type: "revenue_percentage",
      base_value: 15.0,
      scope_type: "single_batch",
      scope_id: batches[2].batch_id,
      effective_from: "2026-06-01"
    }), context);
    createdConfigIds.push(cfg3.salary_config_id);

    console.log("✅ All salary configurations set up successfully.");
    timings["Phase 2: Salary Config Setup"] = Date.now() - startTime;

    // =========================================================================
    // PHASE 3: Seed Student Fee Payments (Skipped - MoneyTransaction Decoupled)
    // =========================================================================
    console.log("\n--- [PHASE 3] Skipping student fee payments (MoneyTransaction is decoupled) ---");
    startTime = Date.now();
    timings["Phase 3: Seeding cleared payments"] = Date.now() - startTime;

    // =========================================================================
    // PHASE 4: Execute Engine Calculations & Verify Results
    // =========================================================================
    console.log("\n--- [PHASE 4] Executing Payroll Calculation Assertions ---");
    startTime = Date.now();
    const engine = new TeacherSalaryCalculationEngine(db);

    // Assert Stacked Payroll for TCH-7739290D:
    // Config 1 (Batch 1 flat monthly): ₹30,000
    // Config A (Global flat monthly): ₹40,000 (expired by Config B)
    // Config B (Global annualized): ₹10,000
    // Config C (Batch 2 rev share 20%): ₹0 (no transactions seeded)
    // Config D (Batch 3 rev share 15%): ₹0 (no transactions seeded)
    // Total expected: ₹30,000 + ₹10,000 = ₹40,000 across 4 active line items.
    const txs = engine.calculateTeacherPayroll("TCH-7739290D", "2026-06");
    if (txs.length !== 4) {
      throw new Error(`[Assertion Error] Expected 4 active line items for teacher payroll, got: ${txs.length}`);
    }
    const totalPayroll = txs.reduce((acc, row) => acc + row.amount, 0);
    if (totalPayroll !== 40000.00) {
      throw new Error(`[Assertion Error] Expected total stacked payroll of ₹40000.00, got: ₹${totalPayroll}`);
    }
    console.log(`✅ Teacher Stacked Payroll verified: ₹${totalPayroll} across 4 active configurations.`);
    timings["Phase 4: Payroll Calculation Assertions"] = Date.now() - startTime;

    // =========================================================================
    // PHASE 5: Execute Negative Validation Checks
    // =========================================================================
    console.log("\n--- [PHASE 5] Executing Negative Validation Path Checks ---");
    startTime = Date.now();
    
    // Test Case: Non-existent teacher ID lookup failure
    let validationPassed = false;
    try {
      StaffService.setSalaryConfig(TestMockHelper.createTeacherSalaryConfigPayload("TCH-INVALID", {
        salary_config_type: "recurring_monthly",
        rate_type: "monthly",
        base_value: 30000.00
      }), context);
    } catch (err) {
      if (err.name === "EntityNotFoundError") {
        validationPassed = true;
        console.log("✅ EntityNotFoundError thrown correctly for invalid teacher ID lookup.");
      } else {
        console.warn("⚠️ Intercepted unexpected error name:", err.name, err.message);
      }
    }
    if (!validationPassed) {
      throw new Error("[Assertion Error] EntityNotFoundError was not raised for invalid teacher ID.");
    }
    timings["Phase 5: Negative Validation Path Checks"] = Date.now() - startTime;

    // =========================================================================
    // PHASE 6: Scoped Active Status Coexistence Checks
    // =========================================================================
    console.log("\n--- [PHASE 6] Executing Scoped Active Config Coexistence Checks ---");
    startTime = Date.now();

    // 1. Create a global active configuration
    const configGlobal = StaffService.setSalaryConfig({
      teacher_id: "TCH-7739290D",
      salary_config_type: "recurring_monthly",
      rate_type: "monthly",
      base_value: 30000.00,
      scope_type: "global",
      scope_id: null,
      contract_status: "active",
      effective_from: "2026-06-01"
    }, context);
    createdConfigIds.push(configGlobal.salary_config_id);

    // 2. Create a batch-specific active configuration
    const configBatch1 = StaffService.setSalaryConfig({
      teacher_id: "TCH-7739290D",
      salary_config_type: "recurring_monthly",
      rate_type: "monthly",
      base_value: 10000.00,
      scope_type: "single_batch",
      scope_id: "BTC-TEST-1",
      contract_status: "active",
      effective_from: "2026-06-01"
    }, context);
    createdConfigIds.push(configBatch1.salary_config_id);

    // Verify both are currently active (coexistence check)
    const freshGlobal = db.TeacherSalaryConfig.findById(configGlobal.salary_config_id);
    const freshBatch1 = db.TeacherSalaryConfig.findById(configBatch1.salary_config_id);
    if (freshGlobal.contract_status !== "active" || freshBatch1.contract_status !== "active") {
      throw new Error(`[Assertion Error] Coexistence failed: global is '${freshGlobal.contract_status}', batch1 is '${freshBatch1.contract_status}'`);
    }
    console.log("✅ Verified coexistence of active configs with different scopes.");

    // 3. Create another active configuration targeting BTC-TEST-1 (should expire configBatch1)
    const configBatch2 = StaffService.setSalaryConfig({
      teacher_id: "TCH-7739290D",
      salary_config_type: "recurring_monthly",
      rate_type: "monthly",
      base_value: 12000.00,
      scope_type: "single_batch",
      scope_id: "BTC-TEST-1",
      contract_status: "active",
      effective_from: "2026-06-01"
    }, context);
    createdConfigIds.push(configBatch2.salary_config_id);

    // Verify configBatch1 is expired, configBatch2 is active, and global remains active
    const postGlobal = db.TeacherSalaryConfig.findById(configGlobal.salary_config_id);
    const postBatch1 = db.TeacherSalaryConfig.findById(configBatch1.salary_config_id);
    const postBatch2 = db.TeacherSalaryConfig.findById(configBatch2.salary_config_id);
    if (postBatch1.contract_status !== "expired") {
      throw new Error(`[Assertion Error] Expected old batch config to expire, status is: '${postBatch1.contract_status}'`);
    }
    if (postBatch2.contract_status !== "active") {
      throw new Error(`[Assertion Error] Expected new batch config to be active, status is: '${postBatch2.contract_status}'`);
    }
    if (postGlobal.contract_status !== "active") {
      throw new Error(`[Assertion Error] Expected global active config to remain active, status is: '${postGlobal.contract_status}'`);
    }
    console.log("✅ Verified duplicate scope activation auto-expires older config while preserving other scopes.");

    // 4. Update the global configuration and check that configBatch2 remains active
    StaffService.updateSalaryConfig("TCH-7739290D", "Teacher", configGlobal.salary_config_id, {
      base_value: 35000.00,
      contract_status: "active"
    }, context);

    const postUpdateGlobal = db.TeacherSalaryConfig.findById(configGlobal.salary_config_id);
    const postUpdateBatch2 = db.TeacherSalaryConfig.findById(configBatch2.salary_config_id);
    if (postUpdateGlobal.contract_status !== "active") {
      throw new Error(`[Assertion Error] Updated global config should remain active, status is: '${postUpdateGlobal.contract_status}'`);
    }
    if (postUpdateBatch2.contract_status !== "active") {
      throw new Error(`[Assertion Error] Batch config should remain active after global config update, status is: '${postUpdateBatch2.contract_status}'`);
    }
    console.log("✅ Verified updating active config does not expire active configs of other scopes.");

    // 5. Create a batch-group active configuration
    const configGroup1 = StaffService.setSalaryConfig({
      teacher_id: "TCH-7739290D",
      salary_config_type: "recurring_monthly",
      rate_type: "monthly",
      base_value: 15000.00,
      scope_type: "batch_group",
      scope_id: '{"BAT-6EDC8213":60,"BAT-E9793465":40}',
      contract_status: "active",
      effective_from: "2026-06-01"
    }, context);
    createdConfigIds.push(configGroup1.salary_config_id);

    // 6. Create another active configuration targeting same batch_group but with different spacing and key order (should expire configGroup1)
    const configGroup2 = StaffService.setSalaryConfig({
      teacher_id: "TCH-7739290D",
      salary_config_type: "recurring_monthly",
      rate_type: "monthly",
      base_value: 18000.00,
      scope_type: "batch_group",
      scope_id: ' { "BAT-E9793465": 40, "BAT-6EDC8213": 60 } ', // shuffled keys, spacing, and trailing space
      contract_status: "active",
      effective_from: "2026-06-01"
    }, context);
    createdConfigIds.push(configGroup2.salary_config_id);

    // Verify configGroup1 is expired and configGroup2 is active
    const postGroup1 = db.TeacherSalaryConfig.findById(configGroup1.salary_config_id);
    const postGroup2 = db.TeacherSalaryConfig.findById(configGroup2.salary_config_id);
    if (postGroup1.contract_status !== "expired") {
      throw new Error(`[Assertion Error] Expected old batch group config to expire, status is: '${postGroup1.contract_status}'`);
    }
    if (postGroup2.contract_status !== "active") {
      throw new Error(`[Assertion Error] Expected new batch group config to be active, status is: '${postGroup2.contract_status}'`);
    }
    console.log("✅ Verified batch group scope equivalence logic auto-expires duplicate active groups.");
    timings["Phase 6: Scoped Active Config Coexistence Checks"] = Date.now() - startTime;

    // Print timing summary table (Rule 2.G)
    const totalDuration = Date.now() - suiteStart;
    console.log("\n========================================================");
    console.log("⏱️  SALARY CONFIG INTEGRATION TEST PERFORMANCE TIMINGS  ⏱️");
    console.log("========================================================");
    for (const [phase, ms] of Object.entries(timings)) {
      console.log(`- ${phase.padEnd(45)}: ${String(ms).padStart(6)} ms`);
    }
    console.log("--------------------------------------------------------");
    console.log(`- ${"Total Execution Time".padEnd(45)}: ${String(totalDuration).padStart(6)} ms`);
    console.log("========================================================\n");

  } catch (error) {
    console.error("❌ Integration Test Failed with error:", error.stack || error.message);
    throw error;
  } finally {
    // Teardown Cleanup (Rule 2.F)
    console.log("\n🧹 Initiating Teardown Cleanup...");
    try {
      const db = DBContext.getInstance();
      if (createdConfigIds.length > 0) {
        const deleted = db.TeacherSalaryConfig.deleteMany(createdConfigIds);
        console.log(`✅ Cleaned up ${deleted} TeacherSalaryConfig records.`);
      }
      if (createdTransactionIds.length > 0) {
        const deleted = db.MoneyTransaction.deleteMany(createdTransactionIds);
        console.log(`✅ Cleaned up ${deleted} MoneyTransaction records.`);
      }
      if (createdBatchIds.length > 0) {
        const deleted = db.Batch.deleteMany(createdBatchIds);
        console.log(`✅ Cleaned up ${deleted} Batch records.`);
      }
      if (createdCourseIds.length > 0) {
        const deleted = db.Course.deleteMany(createdCourseIds);
        console.log(`✅ Cleaned up ${deleted} Course records.`);
      }
      if (createdCourseTypeIds.length > 0) {
        const deleted = db.CourseType.deleteMany(createdCourseTypeIds);
        console.log(`✅ Cleaned up ${deleted} CourseType records.`);
      }
      if (createdBranchIds.length > 0) {
        const deleted = db.Branch.deleteMany(createdBranchIds);
        console.log(`✅ Cleaned up ${deleted} Branch records.`);
      }
    } catch (cleanupError) {
      console.warn("⚠️ Warning during teardown cleanup:", cleanupError.message);
    }

    // Restore original environment properties (Rule 2.H)
    scriptProperties.setProperty('ENV', originalEnv);
    console.log(`✅ Restored environment back to: ${originalEnv}`);
    console.log("🏁 Teacher Salary Config Subsystem Integration Tests Complete.");
  }
}
