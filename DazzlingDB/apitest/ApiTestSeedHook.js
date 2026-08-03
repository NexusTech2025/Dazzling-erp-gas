/**
 * @file ApiTestSeedHook.js
 * Path: DazzlingDB/apitest/ApiTestSeedHook.js
 * Pre-flight Data Seed Hook Utility for API tests and sandbox environment initialization.
 * 
 * Configures DBContext allowAutoOverride = true, seeds fixed mock dataset (FixedMockData)
 * with predictable entity primary keys (BRN-, SEG-, CRS-, PKG-, TCH-, BAT-, STU-, SFA-, INS-),
 * provisions registered student accounts, verifies seeded database integrity,
 * and provides strict environment-locked bulk data eviction (purgeAllRecords).
 */

const ApiTestSeedHook = (function () {

  /**
   * Pre-flight hook to seed the live database with fixed mock records.
   * @param {Object} [options={}] - Seeding configuration options.
   * @param {boolean} [options.allowAutoOverride=true] - Set DBContext instance allowAutoOverride flag.
   * @param {string} [options.env="TESTING"] - Target environment context.
   * @returns {Object} Seeding status report and raw data handles.
   */
  function seed(options = {}) {
    const targetEnv = options.env || "TESTING";

    console.log(`\n🌱 [ApiTestSeedHook] Initializing Pre-Flight Data Seed (Env: ${targetEnv})...`);

    // 1. Lock Environment & Ensure Warm Bootstrapped Singleton
    const db = TestBootstrapController.ensureBootstrapped(options);

    // 2. Seed Fixed Mock Dataset
    FixedMockData.seedLiveDatabase();
    console.log("   ✅ [ApiTestSeedHook] Fixed Mock Dataset successfully seeded with explicit PK IDs.\n");

    return {
      success: true,
      env: targetEnv,
      data: FixedMockData.getRawData()
    };
  }

  /**
   * Post-test hook to purge fixed mock dataset in LIFO reverse order.
   * @param {Object} [options={}] - Purge configuration options.
   * @param {string} [options.restoreEnv=null] - Environment state to restore in PropertiesService.
   */
  function purge(options = {}) {
    console.log("\n🧹 [ApiTestSeedHook] Purging Fixed Mock Dataset...");
    FixedMockData.purgeFromLiveDatabase();
    TestBootstrapController.invalidate();

    if (options.restoreEnv) {
      TestBootstrapController.restoreEnvironment(options.restoreEnv);
      console.log(`   ✅ [ApiTestSeedHook] Restored original environment state: ${options.restoreEnv}`);
    }

    console.log("   ✅ [ApiTestSeedHook] Purge completed.\n");
  }

  /**
   * Safely purges ALL existing records across all 16 database repositories in reverse topological (LIFO) order.
   * 
   * STRICT SECURITY GUARD: Strictly prohibited in DEVELOPMENT or PRODUCTION environments.
   * Executable ONLY when ENV === "TESTING".
   * 
   * @param {Object} [options={}] - Purge options.
   * @returns {Object} Bulk eviction report containing total records purged per table.
   * @throws {Error} SecurityException if invoked outside the TESTING environment.
   */
  function purgeAll(options = {}) {
    const currentEnv = typeof PropertiesService !== "undefined"
      ? PropertiesService.getScriptProperties().getProperty("ENV")
      : null;

    if (currentEnv !== "TESTING") {
      const errorMsg = `[Security Breach Blocked] purgeAll operation is strictly prohibited outside the TESTING environment. Current ENV: '${currentEnv}'`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }

    console.log("\n⚠️ ========================================================");
    console.log("⚠️ EXECUTING PURGE-ALL BULK DATA EVICTION (ENV: TESTING)");
    console.log("========================================================\n");

    const db = DBContext.getInstance();

    // Reverse Topological LIFO Order (Leaf Children First)
    const lifoPurgeOrder = [
      { repo: "MoneyTransaction", pk: "transaction_id" },
      { repo: "FeeAdjustment", pk: "adjustment_id" },
      { repo: "Payment", pk: "payment_id" },
      { repo: "Installment", pk: "installment_id" },
      { repo: "StudentFeeAccount", pk: "student_fee_id" },
      { repo: "BatchAllocation", pk: "allocation_id" },
      { repo: "Enrollment", pk: "enrollment_id" },
      { repo: "Education", pk: "education_id" },
      { repo: "ContactInfo", pk: "contact_id" },
      { repo: "Address", pk: "address_id" },
      { repo: "Student", pk: "student_id" },
      { repo: "Batch", pk: "batch_id" },
      { repo: "Teacher", pk: "teacher_id" },
      { repo: "PackagePerk", pk: "perk_id" },
      { repo: "PackageItem", pk: "item_id" },
      { repo: "Package", pk: "package_id" },
      { repo: "FeePlan", pk: "fee_plan_id" },
      { repo: "Course", pk: "course_id" },
      { repo: "CourseType", pk: "segment_id" },
      { repo: "Branch", pk: "branch_id" }
    ];

    let totalEvicted = 0;
    const tableReports = [];

    lifoPurgeOrder.forEach(({ repo, pk }) => {
      const repository = db[repo];
      if (!repository || typeof repository.all !== "function") return;

      try {
        const records = repository.all() || [];
        const targetIds = records.map(row => row && row[pk]).filter(Boolean);

        let count = 0;
        if (targetIds.length > 0) {
          if (typeof repository.deleteMany === "function") {
            count = repository.deleteMany(targetIds, { cascade: false });
          } else if (repository.gateway && typeof repository.gateway.deleteMany === "function") {
            count = repository.gateway.deleteMany(targetIds);
          } else {
            targetIds.forEach(id => repository.remove(id));
            count = targetIds.length;
          }
        }
        totalEvicted += count;
        tableReports.push({ repository: repo, count: count });
        console.log(`   - Evicted ${String(count).padStart(3)} records from '${repo}'`);
      } catch (err) {
        console.warn(`   ⚠️ Warning purging '${repo}': ${err.message}`);
      }
    });

    console.log(`\n✅ Bulk Eviction Complete. Total Records Evicted Across 16 Tables: ${totalEvicted}\n`);

    return {
      success: true,
      totalEvicted: totalEvicted,
      tableReports: tableReports
    };
  }

  /**
   * Generates a standardized, fully compliant Student Registration API payload.
   * @param {Object} [overrides={}] - Custom parameter overrides.
   * @returns {Object} Student registration payload.
   */
  function createStudentRegistrationPayload(overrides = {}) {
    const suffix = overrides.suffix || Math.random().toString(36).substring(7).toUpperCase();
    const totalFee = overrides.total_fee || 20000;
    const installmentCount = overrides.installment_count || 4;
    const installmentAmount = Math.round(totalFee / installmentCount);

    const installments = [];
    for (let i = 1; i <= installmentCount; i++) {
      const monthNum = i + 7;
      const monthStr = monthNum < 10 ? `0${monthNum}` : `${monthNum}`;
      const instId = (overrides.installment_ids && overrides.installment_ids[i - 1])
        ? overrides.installment_ids[i - 1]
        : `INS-PREP00${i}`;

      installments.push({
        installment_id: instId,
        installment_number: i,
        due_amount: installmentAmount,
        paid_amount: 0,
        due_date: `2026-${monthStr}-01`
      });
    }

    return {
      profile: {
        student_id: overrides.student_id || `STU-PREP001`,
        student_name: overrides.student_name || `Preflight Seeded Student ${suffix}`,
        gender: overrides.gender || "Male",
        dob: overrides.dob || "2006-05-15",
        father_name: overrides.father_name || "Robert Doe",
        mother_name: overrides.mother_name || "Sarah Doe",
        status: overrides.status || "active"
      },
      address: {
        address_id: overrides.address_id || `ADR-PREP001`,
        line1: overrides.line1 || "123 Academic Way",
        city: overrides.city || "Jaipur",
        state: overrides.state || "Rajasthan",
        pin_code: overrides.pin_code || "302001",
        country: "India"
      },
      contact: {
        contact_id: overrides.contact_id || `CON-PREP001`,
        mobile_number: overrides.mobile_number || ("9" + Math.floor(100000000 + Math.random() * 900000000)),
        email: overrides.email || `student_${suffix.toLowerCase()}@example.com`
      },
      education: [
        {
          education_id: overrides.education_id || `EDU-PREP001`,
          highest_qualification: "Class 10",
          institution_name: "St. Xavier Secondary School",
          year_of_passing: 2024,
          percentage_or_cgpa: "90%"
        }
      ],
      enrollments: [
        {
          enrollment_id: overrides.enrollment_id || `ENR-PREP001`,
          allocation_id: overrides.allocation_id || `BAL-PREP001`,
          enrollment_type: overrides.enrollment_type || "course",
          item_id: overrides.item_id || "CRS-PHY001",
          batch_id: overrides.batch_id || "BAT-PHY12A01",
          fee: totalFee,
          status: "active"
        }
      ],
      feeAccount: {
        student_fee_id: overrides.student_fee_id || `SFA-PREP001`,
        total_fee: totalFee,
        discount: overrides.discount || 0,
        final_fee: totalFee - (overrides.discount || 0),
        amount_paid: 0,
        installments: installments
      }
    };
  }

  /**
   * Dispatches student registration via student_register Action.
   * @param {Object} [overrides={}] - Custom payload overrides.
   * @param {string} [token=null] - Auth token.
   * @returns {Object} Registered student response payload.
   */
  function registerStudent(overrides = {}, token = null) {
    const payload = createStudentRegistrationPayload(overrides);
    const authToken = token || (typeof PropertiesService !== "undefined"
      ? PropertiesService.getScriptProperties().getProperty("DEV_SUPER_TOKEN")
      : null);

    console.log("   ▶️ [ApiTestSeedHook] Dispatching student_register action...");
    const res = ApiTestHelper.callApi("student_register", payload, authToken);
    console.log(`   ✅ [ApiTestSeedHook] Student registered: ${res.student_id}`);
    return res;
  }

  /**
   * Prepares the database by seeding fixed master mock records AND verifying integrity.
   * Prints a full summary of predefined IDs ready for testing reuse.
   * @param {Object} [options={}] - Seeding and registration options.
   * @returns {Object} Hydrated database context status report with seeded handles.
   */
  function prepareDB(options = {}) {
    console.log("\n🚀 ========================================================");
    console.log("🚀 PREPARING DATABASE FOR API TESTING (PRE-FLIGHT SEED)");
    console.log("========================================================\n");

    // 1. Seed Fixed Master Dataset
    const seedResult = seed(options);

    // 2. Run Verification Routine Across 35 Predefined Entities
    verifySeededData();

    // 3. Print Summary Matrix of Predefined IDs
    console.log("========================================================");
    console.log("📋 CANONICAL PREDEFINED SEEDED ENTITIES MATRIX         📋");
    console.log("========================================================");
    console.log(`- Branch ID              : BRN-MAIN001, BRN-NORTH02`);
    console.log(`- Segment ID             : SEG-ACAD001, SEG-COMP002`);
    console.log(`- Course ID              : CRS-PHY001, CRS-CHE002, CRS-MAT003`);
    console.log(`- Package ID             : PKG-PCM1201 (Items: PKI-001001..PKI-001003)`);
    console.log(`- Teacher ID             : TCH-PHYS001, TCH-CHEM002, TCH-MATH003`);
    console.log(`- Batch ID               : BAT-PHY12A01, BAT-CHE12A01, BAT-MAT12A02`);
    console.log(`- Student Graph #1 (Fixed): STU-001001 (ENR-001001, SFA-001001, INS-001001, INS-001002)`);
    console.log(`- Student Graph #2 (Fixed): STU-002002 (ENR-002002, SFA-002002, INS-002001, INS-002002)`);
    console.log("========================================================\n");

    return {
      success: true,
      masterData: seedResult.data
    };
  }

  /**
   * Verifies that all mock entities with predefined IDs (from FixedMockData) exist in the active database context.
   * Performs model-level lookup checks across all 16 tables.
   * @returns {Object} Verification report containing status, totals, verified entities, and missing items.
   */
  function verifySeededData() {
    console.log("\n🔍 ========================================================");
    console.log("🔍 VERIFYING SEEDED MOCK DATA (PREDEFINED PRIMARY KEYS)");
    console.log("========================================================\n");

    const db = DBContext.getInstance();
    const rawData = FixedMockData.getRawData();

    const categoryMap = [
      { key: "branches", repo: "Branch", pk: "branch_id" },
      { key: "courseTypes", repo: "CourseType", pk: "segment_id" },
      { key: "courses", repo: "Course", pk: "course_id" },
      { key: "packages", repo: "Package", pk: "package_id" },
      { key: "packageItems", repo: "PackageItem", pk: "item_id" },
      { key: "teachers", repo: "Teacher", pk: "teacher_id" },
      { key: "batches", repo: "Batch", pk: "batch_id" },
      { key: "students", repo: "Student", pk: "student_id" },
      { key: "addresses", repo: "Address", pk: "address_id" },
      { key: "contactInfos", repo: "ContactInfo", pk: "contact_id" },
      { key: "educations", repo: "Education", pk: "education_id" },
      { key: "enrollments", repo: "Enrollment", pk: "enrollment_id" },
      { key: "batchAllocations", repo: "BatchAllocation", pk: "allocation_id" },
      { key: "studentFeeAccounts", repo: "StudentFeeAccount", pk: "student_fee_id" },
      { key: "installments", repo: "Installment", pk: "installment_id" },
      { key: "payments", repo: "Payment", pk: "payment_id" }
    ];

    let totalExpected = 0;
    let totalVerified = 0;
    const missingEntities = [];
    const categorySummary = [];

    categoryMap.forEach(({ key, repo, pk }) => {
      const items = rawData[key] || [];
      const repoObj = db[repo];
      let categoryVerified = 0;

      items.forEach(item => {
        totalExpected++;
        const targetId = item[pk];
        if (!targetId) return;

        let record = null;
        if (repoObj && typeof repoObj.findById === "function") {
          record = repoObj.findById(targetId);
        } else if (repoObj && typeof repoObj.findOne === "function") {
          const query = {};
          query[pk] = targetId;
          record = repoObj.findOne(query);
        }

        if (record) {
          totalVerified++;
          categoryVerified++;
        } else {
          missingEntities.push({ repository: repo, primaryKey: pk, id: targetId });
        }
      });

      categorySummary.push({
        repository: repo,
        expected: items.length,
        verified: categoryVerified,
        status: categoryVerified === items.length ? "✅ COMPLETE" : "❌ INCOMPLETE"
      });
    });

    console.log("========================================================");
    console.log("📊 SEEDED DATA VERIFICATION SUMMARY                    📊");
    console.log("========================================================");
    categorySummary.forEach(c => {
      console.log(`- ${c.repository.padEnd(20)}: ${c.verified}/${c.expected} verified [${c.status}]`);
    });
    console.log("--------------------------------------------------------");
    console.log(`Total Entities Verified: ${totalVerified} / ${totalExpected}`);
    console.log("========================================================\n");

    if (missingEntities.length > 0) {
      console.error("❌ VERIFICATION FAILURES (MISSING PREDEFINED ENTITIES):");
      missingEntities.forEach(m => {
        console.error(`   - Missing in repository '${m.repository}' -> PK [${m.primaryKey}]: '${m.id}'`);
      });
      throw new Error(`Seeded Data Verification Failed: ${missingEntities.length} predefined entities are missing from database.`);
    }

    console.log("✅ ALL PREDEFINED SEEDED MOCK ENTITIES VERIFIED SUCCESSFULLY IN DATABASE!\n");

    return {
      success: true,
      totalExpected: totalExpected,
      totalVerified: totalVerified,
      categorySummary: categorySummary,
      missingEntities: missingEntities
    };
  }

  /**
   * Executes a test runner callback wrapped inside a seed/purge pre-flight lifecycle.
   * @param {Function} runnerFn - Test callback function to execute.
   * @param {Object} [options={}] - Lifecycle options.
   * @param {boolean} [options.autoPurge=false] - Whether to purge data automatically after execution.
   */
  function withSeed(runnerFn, options = {}) {
    const autoPurge = options.autoPurge === true;
    const initialEnv = typeof PropertiesService !== "undefined"
      ? PropertiesService.getScriptProperties().getProperty("ENV")
      : "DEVELOPMENT";

    try {
      seed(options);
      return runnerFn();
    } finally {
      if (autoPurge) {
        purge({ restoreEnv: initialEnv });
      }
    }
  }

  return {
    seed: seed,
    purge: purge,
    purgeAll: purgeAll,
    createStudentRegistrationPayload: createStudentRegistrationPayload,
    registerStudent: registerStudent,
    prepareDB: prepareDB,
    verifySeededData: verifySeededData,
    withSeed: withSeed
  };

})();

// Standalone Apps Script IDE Entry Points
function runApiTestSeed() {
  ApiTestSeedHook.seed();
}

function runApiTestPurge() {
  ApiTestSeedHook.purge();
}

/**
 * Top-level Apps Script IDE Entry Point to prepare the testing database.
 * Seeds fixed master mock entities and runs full verification.
 */
function prepareDB() {
  ApiTestSeedHook.prepareDB();
}

/**
 * Top-level Apps Script IDE Entry Point to verify all predefined mock entities in the database.
 */
function verifySeededData() {
  ApiTestSeedHook.verifySeededData();
}

/**
 * Top-level Apps Script IDE Entry Point to purge ALL records across all 16 repositories.
 * SECURITY LOCK: Allowed ONLY when ENV === "TESTING".
 */
function purgeAllRecords() {
  ApiTestSeedHook.purgeAll();
}
