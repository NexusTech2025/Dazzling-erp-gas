/**
 * @file TeacherSalaryConfigIntegrationTests.js
 * Integration test suite for the Teacher Salary Config Subsystem.
 * Path: DazzlingDB/Test/TeacherSalaryConfigIntegrationTests.js
 */

function runTeacherSalaryConfigIntegrationTests() {
  console.log("🚀 Starting Teacher Salary Config Subsystem Integration Tests...");

  // 1. Initialize testing environment sandboxing
  const scriptProperties = PropertiesService.getScriptProperties();
  const originalEnv = scriptProperties.getProperty('ENV') || 'DEVELOPMENT';
  
  scriptProperties.setProperty('ENV', 'TESTING');
  
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

    // 1. Provision a mock Branch
    const branch = db.Branch.insert({
      branch_name: "Integration Test Branch " + suffix,
      status: "active"
    });
    console.log(`✅ Provisioned Branch: ${branch.branch_id}`);

    // 2. Provision CourseType segment
    const segmentPayload = TestMockHelper.createCourseTypePayload({
      segment_name: "Int Segment " + suffix
    });
    const courseType = db.CourseType.insert(segmentPayload);
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
    }
    console.log(`✅ Provisioned 5 Courses: ${courses.map(c => c.course_id).join(", ")}`);

    // =========================================================================
    // PHASE 1: Onboard 3 Teachers
    // =========================================================================
    console.log("\n--- [PHASE 1] Onboarding 3 Teachers ---");

    // Teacher 1 Onboard Payload
    const t1Mobile = "91" + Math.floor(10000000 + Math.random() * 90000000);
    const teacher1 = StaffService.onboardTeacher({
      full_name: `T1 Monthly Single Batch ${suffix}`,
      mobile_number: t1Mobile,
      email: `t1_${suffix.toLowerCase()}@example.com`,
      experience_years: 3,
      joining_date: "2026-06-01",
      teacher_type: "full_time",
      userData: { username: `t1_user_${suffix.toLowerCase()}`, password: "Password123!" }
    }, context);
    console.log(`✅ Teacher 1 Onboarded: ${teacher1.teacher_id}`);

    // Teacher 2 Onboard Payload
    const t2Mobile = "92" + Math.floor(10000000 + Math.random() * 90000000);
    const teacher2 = StaffService.onboardTeacher({
      full_name: `T2 Triple Stacked ${suffix}`,
      mobile_number: t2Mobile,
      email: `t2_${suffix.toLowerCase()}@example.com`,
      experience_years: 8,
      joining_date: "2026-06-01",
      teacher_type: "full_time",
      userData: { username: `t2_user_${suffix.toLowerCase()}`, password: "Password123!" }
    }, context);
    console.log(`✅ Teacher 2 Onboarded: ${teacher2.teacher_id}`);

    // Teacher 3 Onboard Payload
    const t3Mobile = "93" + Math.floor(10000000 + Math.random() * 90000000);
    const teacher3 = StaffService.onboardTeacher({
      full_name: `T3 Rev Share Single ${suffix}`,
      mobile_number: t3Mobile,
      email: `t3_${suffix.toLowerCase()}@example.com`,
      experience_years: 2,
      joining_date: "2026-06-01",
      teacher_type: "part_time",
      userData: { username: `t3_user_${suffix.toLowerCase()}`, password: "Password123!" }
    }, context);
    console.log(`✅ Teacher 3 Onboarded: ${teacher3.teacher_id}`);

    // 4. Provision 5 Batches linked to the onboarded Teachers
    const batches = [];
    for (let i = 1; i <= 5; i++) {
      const assignedTeacher = i === 2 ? teacher2 : (i === 3 ? teacher3 : teacher1);
      const batchPayload = TestMockHelper.createBatchPayload(courses[i-1].course_id, assignedTeacher.teacher_id, branch.branch_id, {
        batch_name: `Int Batch ${i} ${suffix}`,
        start_date: "2026-06-01"
      });
      const batch = db.Batch.insert(batchPayload);
      batches.push(batch);
    }
    console.log(`✅ Provisioned 5 Batches: ${batches.map(b => b.batch_id).join(", ")}`);

    // =========================================================================
    // PHASE 2: Configure Teacher Salary Configurations
    // =========================================================================
    console.log("\n--- [PHASE 2] Setting up Configurations via StaffService ---");

    // Teacher 1: Flat monthly rate scoped to single batch (BTC-TEST-1)
    StaffService.setSalaryConfig(TestMockHelper.createTeacherSalaryConfigPayload(teacher1.teacher_id, {
      salary_config_type: "recurring_monthly",
      rate_type: "monthly",
      base_value: 30000.00,
      scope_type: "single_batch",
      scope_id: batches[0].batch_id,
      effective_from: "2026-06-01"
    }), context);

    // Teacher 2: Triple stacked hybrid configuration
    // Config A: Flat global monthly of ₹40,000
    StaffService.setSalaryConfig(TestMockHelper.createTeacherSalaryConfigPayload(teacher2.teacher_id, {
      salary_config_type: "recurring_monthly",
      rate_type: "monthly",
      base_value: 40000.00,
      scope_type: "global",
      effective_from: "2026-06-01"
    }), context);

    // Config B: Annualized global of ₹120,000 (monthly ₹10,000 draw)
    StaffService.setSalaryConfig(TestMockHelper.createTeacherSalaryConfigPayload(teacher2.teacher_id, {
      salary_config_type: "fixed_duration_pool",
      rate_type: "yearly",
      base_value: 120000.00,
      total_contract_value: 120000.00,
      scope_type: "global",
      effective_from: "2026-06-01"
    }), context);

    // Config C: 20% revenue share scoped to batch 2 (BTC-TEST-2)
    StaffService.setSalaryConfig(TestMockHelper.createTeacherSalaryConfigPayload(teacher2.teacher_id, {
      salary_config_type: "recurring_monthly",
      rate_type: "revenue_percentage",
      base_value: 20.0,
      scope_type: "single_batch",
      scope_id: batches[1].batch_id,
      effective_from: "2026-06-01"
    }), context);

    // Teacher 3: 15% revenue share scoped to batch 3 (BTC-TEST-3)
    StaffService.setSalaryConfig(TestMockHelper.createTeacherSalaryConfigPayload(teacher3.teacher_id, {
      salary_config_type: "recurring_monthly",
      rate_type: "revenue_percentage",
      base_value: 15.0,
      scope_type: "single_batch",
      scope_id: batches[2].batch_id,
      effective_from: "2026-06-01"
    }), context);

    console.log("✅ All salary configurations set up successfully.");

    // =========================================================================
    // PHASE 3: Seed Student Fee Payments (Cleared MoneyTransactions)
    // =========================================================================
    console.log("\n--- [PHASE 3] Seeding cleared payments in June 2026 ---");
    
    let category = db.ExpenseCategory.all()[0];
    if (!category) {
      category = db.ExpenseCategory.insert({ name: "Tuition Fees " + suffix, type: "both" });
    }

    // Seed payments for Batch 2 (Teacher 2, 20% share): total ₹50,000
    db.MoneyTransaction.insert(TestMockHelper.createMoneyTransactionPayload(30000.00, "in", category.category_id, "student", {
      status: "cleared",
      batch_id: batches[1].batch_id,
      transaction_date: "2026-06-10"
    }));
    db.MoneyTransaction.insert(TestMockHelper.createMoneyTransactionPayload(20000.00, "in", category.category_id, "student", {
      status: "cleared",
      batch_id: batches[1].batch_id,
      transaction_date: "2026-06-15"
    }));

    // Seed payment for Batch 3 (Teacher 3, 15% share): total ₹80,000
    db.MoneyTransaction.insert(TestMockHelper.createMoneyTransactionPayload(80000.00, "in", category.category_id, "student", {
      status: "cleared",
      batch_id: batches[2].batch_id,
      transaction_date: "2026-06-12"
    }));

    console.log("✅ Student fee transactions seeded successfully.");

    // =========================================================================
    // PHASE 4: Execute Engine Calculations & Verify Results
    // =========================================================================
    console.log("\n--- [PHASE 4] Executing Payroll Calculation Assertions ---");
    const engine = new TeacherSalaryCalculationEngine(db);

    // 1. Assert Teacher 1: Flat monthly ₹30,000 scoped to Batch 1
    const txs1 = engine.calculateTeacherPayroll(teacher1.teacher_id, "2026-06");
    if (txs1.length !== 1) {
      throw new Error(`[Assertion Error] Teacher 1 expected 1 line item, got: ${txs1.length}`);
    }
    if (txs1[0].amount !== 30000.00) {
      throw new Error(`[Assertion Error] Teacher 1 expected ₹30000.00, got: ₹${txs1[0].amount}`);
    }
    console.log(`✅ Teacher 1 Flat Monthly Payout verified: ₹${txs1[0].amount}`);

    // 2. Assert Teacher 2: Triple stacked hybrid draw: ₹40k + ₹10k + (20% of ₹50k = ₹10k) = ₹60,000
    const txs2 = engine.calculateTeacherPayroll(teacher2.teacher_id, "2026-06");
    if (txs2.length !== 3) {
      throw new Error(`[Assertion Error] Teacher 2 expected 3 line items, got: ${txs2.length}`);
    }
    const totalTxs2 = txs2.reduce((acc, row) => acc + row.amount, 0);
    if (totalTxs2 !== 60000.00) {
      throw new Error(`[Assertion Error] Teacher 2 expected ₹60000.00, got: ₹${totalTxs2}`);
    }
    console.log(`✅ Teacher 2 Triple Stacked Payout verified: ₹${totalTxs2}`);

    // 3. Assert Teacher 3: Single batch revenue percentage (15% of ₹80k = ₹12,000)
    const txs3 = engine.calculateTeacherPayroll(teacher3.teacher_id, "2026-06");
    if (txs3.length !== 1) {
      throw new Error(`[Assertion Error] Teacher 3 expected 1 line item, got: ${txs3.length}`);
    }
    if (txs3[0].amount !== 12000.00) {
      throw new Error(`[Assertion Error] Teacher 3 expected ₹12000.00, got: ₹${txs3[0].amount}`);
    }
    console.log(`✅ Teacher 3 Rev Share Payout verified: ₹${txs3[0].amount}`);

    // =========================================================================
    // PHASE 5: Execute Negative Validation Checks
    // =========================================================================
    console.log("\n--- [PHASE 5] Executing Negative Validation Path Checks ---");
    
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

  } catch (error) {
    console.error("❌ Integration Test Failed with error:", error.stack || error.message);
    throw error;
  } finally {
    // Restore original environment properties
    scriptProperties.setProperty('ENV', originalEnv);
    console.log(`\n✅ Restored environment back to: ${originalEnv}`);
    console.log("🏁 Teacher Salary Config Subsystem Integration Tests Complete.");
  }
}
