/**
 * @file Infrastructure_PurgeTests.js
 * Automated integration testing module for advanced REST database purge database functionality.
 * Validates data eviction, schema integrity, cache synchronization, precision exclusions,
 * action authorization, and input sanitization.
 * 
 * INSTRUCTIONS:
 * Run 'runInfrastructurePurgeTests' from the Google Apps Script IDE.
 */

function runInfrastructurePurgeTests() {
  const activeEnv = typeof SYSTEM_ENV !== 'undefined' ? SYSTEM_ENV : Environment.DEVELOPMENT;
  if (resolveEnvironmentType(activeEnv) === Environment.PRODUCTION) {
    throw new Error("❌ Safety Guard: Test suite cannot be executed in the PRODUCTION environment.");
  }

  const scriptProperties = PropertiesService.getScriptProperties();
  const originalEnv = scriptProperties.getProperty('ENV') || 'DEVELOPMENT';

  console.log("🚀 Starting Database Purge Integration & Regression Tests...");
  const results = {};
  const timings = {};
  const tSuiteStart = Date.now();

  try {
    // 1. Force TESTING sandbox environment isolation
    scriptProperties.setProperty('ENV', 'TESTING');
    const db = DBContext.getInstance().bootstrapRepositories();

    // 2. Ensure sandbox files are provisioned
    console.log("[PurgeTests] Provisioning testing sandbox sheets...");
    db.setup.provision();

    // --- Scenario 1: Seed Data & Verify Insertion ---
    console.log("\n=========================================");
    let tStart = Date.now();
    results.Scenario1 = executeScenario1_SeedData(db);
    timings["Scenario 1: Seed Data"] = Date.now() - tStart;

    // --- Scenario 2: Execute Purge SpreadSheet ---
    console.log("\n=========================================");
    tStart = Date.now();
    results.Scenario2 = executeScenario2_ExecutePurge(db);
    timings["Scenario 2: Execute Purge"] = Date.now() - tStart;

    // --- Scenario 3: Verify Data Eviction ---
    console.log("\n=========================================");
    tStart = Date.now();
    results.Scenario3 = executeScenario3_VerifyEviction(db);
    timings["Scenario 3: Verify Eviction"] = Date.now() - tStart;

    // --- Scenario 4: Verify Schema Protection & Re-insertion ---
    console.log("\n=========================================");
    tStart = Date.now();
    results.Scenario4 = executeScenario4_VerifySchemaProtection(db);
    timings["Scenario 4: Verify Schema Protection"] = Date.now() - tStart;

    // --- Scenario 5: Cache Drift Assertion ---
    console.log("\n=========================================");
    tStart = Date.now();
    results.Scenario5 = executeScenario5_VerifyCacheDrift(db);
    timings["Scenario 5: Verify Cache Drift"] = Date.now() - tStart;

    // --- Scenario 6: Precision Exclusions Purge ---
    console.log("\n=========================================");
    tStart = Date.now();
    results.Scenario6 = executeScenario6_PrecisionExclusionsPurge(db);
    timings["Scenario 6: Precision Exclusions Purge"] = Date.now() - tStart;

    // --- Scenario 7: Authorization Breach Checks ---
    console.log("\n=========================================");
    tStart = Date.now();
    results.Scenario7 = executeScenario7_AuthorizationBreachChecks(db);
    timings["Scenario 7: Authorization Breach Checks"] = Date.now() - tStart;

    // --- Scenario 8: Input Sanitization & Normalization ---
    console.log("\n=========================================");
    tStart = Date.now();
    results.Scenario8 = executeScenario8_InputSanitization(db);
    timings["Scenario 8: Input Sanitization"] = Date.now() - tStart;

  } catch (err) {
    console.error("❌ Test execution halted with unexpected error:", err.message);
    if (err.stack) console.error(err.stack);
  } finally {
    // Restore original system environment boundary
    scriptProperties.setProperty('ENV', originalEnv);
    DBContext.getInstance().bootstrapRepositories();
    console.log(`[PurgeTests] Restored environment context to: '${originalEnv}'`);

    // Output telemetry benchmarks table to logging console
    const totalTime = Date.now() - tSuiteStart;
    console.log("\n========================================================");
    console.log("⏱️      DATABASE PURGE PERFORMANCE TIMING SUMMARY      ⏱️");
    console.log("========================================================");
    for (const step in timings) {
      console.log(`- ${step.padEnd(45)}: ${String(timings[step]).padStart(5)} ms`);
    }
    console.log("--------------------------------------------------------");
    console.log(`- Total Execution Time                         : ${String(totalTime).padStart(5)} ms`);
    console.log("========================================================\n");
  }

  console.log("📊 FINAL TEST RESULTS: \n", JSON.stringify(results, null, 2));
  console.log("🏁 Database Purge Tests Complete.");
  return results;
}

function executeScenario1_SeedData(db) {
  console.log("▶️ SCENARIO 1: Seeding Test Data (Academic Category)...");
  try {
    // Clean any prior state in testing sandbox first
    db.purgeSpreadSheet("Academic");

    const payloadA = TestMockHelper.createCourseTypePayload({
      segment_name: "Test Primary School",
      entity_label: "Subject",
      description: "Purge Test Prep A"
    });
    const payloadB = TestMockHelper.createCourseTypePayload({
      segment_name: "Test High School",
      entity_label: "Subject",
      description: "Purge Test Prep B"
    });

    console.log("   ⚙️ Inserting test records...");
    const recA = db.CourseType.insert(payloadA);
    const recB = db.CourseType.insert(payloadB);

    if (!recA.segment_id || !recB.segment_id) {
      throw new Error("Failed to insert record: ID is empty.");
    }

    const count = db.CourseType.count();
    console.log(`   ` + `✅ Success! Seeded count: ${count}`);
    if (count < 2) {
      throw new Error(`Expected at least 2 seeded records, got ${count}`);
    }

    return "✅ PASSED";
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    return `❌ FAILED: ${e.message}`;
  }
}

function executeScenario2_ExecutePurge(db) {
  console.log("▶️ SCENARIO 2: Executing db.purgeSpreadSheet...");
  try {
    db.purgeSpreadSheet("Academic");
    console.log("   ✅ Purge command finished execution.");
    return "✅ PASSED";
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    return `❌ FAILED: ${e.message}`;
  }
}

function executeScenario3_VerifyEviction(db) {
  console.log("▶️ SCENARIO 3: Verifying data eviction...");
  try {
    const count = db.CourseType.count();
    console.log(`   📊 Post-purge record count in CourseType: ${count}`);
    if (count !== 0) {
      throw new Error(`Expected record count to be 0 post-purge, but got ${count}.`);
    }
    console.log("   ✅ Verification complete. All data rows evicted.");
    return "✅ PASSED";
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    return `❌ FAILED: ${e.message}`;
  }
}

function executeScenario4_VerifySchemaProtection(db) {
  console.log("▶️ SCENARIO 4: Verifying schema protection (Header rows intact)...");
  try {
    // Attempting insertion on purged sheet to ensure Row 1 config structure is fully operational
    const payload = TestMockHelper.createCourseTypePayload({
      segment_name: "Post-Purge High School",
      entity_label: "Subject",
      description: "Verifying that headers are intact"
    });
    const rec = db.CourseType.insert(payload);
    
    if (!rec.segment_id) {
      throw new Error("Insertion failed on purged table. Row 1 header might be corrupted.");
    }
    
    console.log(`   ✅ Success! Re-inserted record ID post-purge: ${rec.segment_id}`);
    return "✅ PASSED";
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    return `❌ FAILED: ${e.message}`;
  }
}

function executeScenario5_VerifyCacheDrift(db) {
  console.log("▶️ SCENARIO 5: Verifying Cache Invalidation & PK Cache Synchronization...");
  try {
    // Post-insertion cleanup sequence to reset size metrics down to 0 cleanly
    db.purgeSpreadSheet("Academic");

    const cacheKeys = db._pkCache.get("CourseType");
    const count = db.CourseType.count();
    
    console.log(`   📊 PrimaryKeyCache key count: ${cacheKeys.size}, Repositority count: ${count}`);
    if (cacheKeys.size !== 0 || count !== 0) {
      throw new Error(`Cache Drift Detected: Expected PK Cache size and repository count to be 0 post-purge. Got PK Cache size (${cacheKeys.size}) and repository count (${count}).`);
    }
    
    console.log("   ✅ Success! PrimaryKeyCache synchronized and verified.");
    return "✅ PASSED";
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    return `❌ FAILED: ${e.message}`;
  }
}

function executeScenario6_PrecisionExclusionsPurge(db) {
  console.log("▶️ SCENARIO 6: Verifying Precision Table Exclusions...");
  try {
    // Seed some students data (Students category contains Student and ContactInfo sheets)
    db.purgeSpreadSheet("Students");

    console.log("   ⚙️ Seeding Student and ContactInfo tables...");
    const student = db.Student.insert({
      student_name: "John Doe",
      first_name: "John",
      last_name: "Doe",
      gender: "Male",
      date_of_birth: "2010-01-01"
    });

    const contact = db.ContactInfo.insert({
      student_id: student.student_id,
      phone: "123456789",
      email: "john@example.com"
    });

    if (!student.student_id || !contact.contact_id) {
      throw new Error("Failed to insert mock students data.");
    }

    // Call database purge advanced, targeting "Students" category but excluding the "Student" table
    console.log("   ⚙️ Wiping 'Students' category with exclusion: ['Student']");
    db.purgeDatabaseAdvanced({
      selectPurge: ["Students"],
      excludeTables: {
        "Students": ["Student"]
      }
    });

    const studentCount = db.Student.count();
    const contactCount = db.ContactInfo.count();

    console.log(`   📊 Post-purge counts - Student (Excluded): ${studentCount}, ContactInfo (Purged): ${contactCount}`);
    
    if (studentCount !== 1) {
      throw new Error(`Expected Student table to remain untouched (count === 1), but got: ${studentCount}`);
    }
    if (contactCount !== 0) {
      throw new Error(`Expected ContactInfo table to be cleared (count === 0), but got: ${contactCount}`);
    }

    console.log("   ✅ Precision exclusion verified successfully.");
    return "✅ PASSED";
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    return `❌ FAILED: ${e.message}`;
  }
}

function executeScenario7_AuthorizationBreachChecks(db) {
  console.log("▶️ SCENARIO 7: Verifying Action Role Authorization Boundaries...");
  try {
    const action = new PurgeDatabaseAction();
    const mockContext = {
      params: {
        payload: {
          purgeAll: false,
          selectPurge: ["Students"]
        }
      },
      user: { user_id: "USR-GUEST", role: "guest" }, // Guest role!
      db: db,
      actionType: ActionType.DELETE,
      mutationManifest: [],
      headers: {}
    };

    console.log("   ⚙️ Executing PurgeDatabaseAction with Guest role context...");
    const response = action.run(mockContext);

    console.log("   📊 Action response envelope status:", response.success);
    if (response.success !== false) {
      throw new Error("Security breach: Guest user succeeded in running database purge action!");
    }
    if (!response.error || response.error.code !== "FORBIDDEN_ACCESS") {
      throw new Error(`Expected display code 'FORBIDDEN_ACCESS', but got: ${response.error ? response.error.code : 'null'}`);
    }

    console.log("   ✅ Action role restrictions verified successfully.");
    return "✅ PASSED";
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    return `❌ FAILED: ${e.message}`;
  }
}

function executeScenario8_InputSanitization(db) {
  console.log("▶️ SCENARIO 8: Verifying input array sanitization & string conversion...");
  try {
    const action = new PurgeDatabaseAction();
    
    // Send selectPurge as a malformed comma-separated string rather than array
    const mockContext = {
      params: {
        payload: {
          purgeAll: false,
          selectPurge: "Students, Academic" // Comma-separated string
        }
      },
      user: { user_id: "USR-ADMIN", role: "admin" }, // Authorized Admin
      db: db,
      actionType: ActionType.DELETE,
      mutationManifest: [],
      headers: {}
    };

    console.log("   ⚙️ Dispatching action with selectPurge as a comma-separated string...");
    const response = action.run(mockContext);

    if (response.success !== true) {
      throw new Error(`Action rejected: ${response.error ? response.error.message : 'Unknown error'}`);
    }

    const trace = response.data.trace;
    console.log("   📊 Trace execution categories:", JSON.stringify(trace.mutated_categories));
    
    // It should normalize "Students, Academic" string into ["Students", "Academic"]
    // and successfully process the categories
    const processed = trace.mutated_categories.map(c => c.category);
    if (!processed.includes("Students") || !processed.includes("Academic")) {
      throw new Error(`Expected Students and Academic categories to be parsed and targeted. Got: ${JSON.stringify(processed)}`);
    }

    console.log("   ✅ Input array sanitization and comma splitting verified successfully.");
    return "✅ PASSED";
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    return `❌ FAILED: ${e.message}`;
  }
}
