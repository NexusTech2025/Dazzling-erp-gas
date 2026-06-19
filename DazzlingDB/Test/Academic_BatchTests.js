/**
 * @file Academic_BatchTests.js
 * Automated testing module for Batch creation in the Academic Domain.
 */

function runBatchCreationTest() {
  console.log("🚀 Starting Academic Batch Creation Integration Test...");

  const db = DBContext.getInstance();
  const results = {};

  // Setup the valid IDs for the Happy Path test case
  const validIds = {
    branch_id: "BRN-3GVP91T",
    course_id: "CRS-D40D4661",
    teacher_id: "TCH-248AE945"
  };

  console.log("\n=========================================");
  results.Scenario1 = executeScenario1_HappyPath(db, validIds);

  console.log("\n=========================================");
  results.Scenario2 = executeScenario2_DefaultsAndFallbacks(db, validIds);

  console.log("\n=========================================");
  results.Scenario3 = executeScenario3_MissingCourseIntegrity(db, validIds);

  console.log("\n=========================================");
  results.Scenario4 = executeScenario4_MissingTeacherIntegrity(db, validIds);

  console.log("\n=========================================");
  results.Scenario5 = executeScenario5_MissingBranchIntegrity(db, validIds);

  console.log("\n=========================================");
  results.Scenario6 = executeScenario6_MissingRequiredFields(db);

  console.log("\n=========================================");
  results.Scenario7 = executeScenario7_InvalidEnumSelection(db, validIds);

  console.log("\n=========================================");
  results.Scenario8 = executeScenario8_MissingRelationalIdFields(db, validIds);

  console.log("=========================================\n");
  console.log("📊 FINAL TEST RESULTS: \n", JSON.stringify(results, null, 2));
  console.log("🏁 Academic Batch Creation Tests Complete.");

  return results;
}

/**
 * Helper to log detailed errors inside catch blocks
 */
function logDetailedError(error) {
  console.error("   ❌ Failed:");
  console.error("      Error Name:   ", error.name || "Error");
  console.error("      Error Message:", error.message);
  if (error.stack) {
    console.error("      Stack Trace:  ", error.stack);
  }
  if (error.context) {
    console.error("      Error Context:", JSON.stringify(error.context, null, 2));
  }
}

/**
 * Scenario 1: Successful Batch Creation (Happy Path)
 */
function executeScenario1_HappyPath(db, validIds) {
  console.log("▶️ SCENARIO 1: Successful Batch Creation (Happy Path)");
  try {
    const payload = {
      batch_name: "Math 10th",
      branch_id: validIds.branch_id,
      course_id: validIds.course_id,
      teacher_id: validIds.teacher_id,
      batch_type: "Academy",
      status: "active",
      capacity: 30,
      start_date: "2026-05-01",
      end_date: "2026-05-31",
      schedule: {
        days_of_week: ["Mon", "Wed", "Fri"],
        start_time: "09:00",
        end_time: "11:00"
      }
    };

    const mockContext = {
      actionType: "CREATE",
      mutationManifest: []
    };

    console.log("   ⚙️ Invoking AcademicService.createBatch with payload:", JSON.stringify(payload));
    const result = AcademicService.createBatch(payload, mockContext);

    if (!result.batch_id || !result.batch_id.startsWith("BAT-")) {
      throw new Error(`Batch creation succeeded but returned invalid ID prefix: ${result.batch_id}`);
    }

    if (!mockContext.mutationManifest.includes("Batch")) {
      throw new Error("Mutation tracking failed: Batch mutation not tracked in manifest.");
    }

    console.log(`   ✅ Success! Created Batch: ${result.batch_name} (ID: ${result.batch_id})`);
    console.log(`   ✅ Mutation tracking verified: ${JSON.stringify(mockContext.mutationManifest)}`);
    
    // Clean up created batch to avoid database pollution
    db.Batch.remove(result.batch_id);
    return "✅ PASSED";
  } catch (error) {
    logDetailedError(error);
    return `❌ FAILED: ${error.message}`;
  }
}

/**
 * Scenario 2: Verification of Fallbacks & Defaults
 */
function executeScenario2_DefaultsAndFallbacks(db, validIds) {
  console.log("▶️ SCENARIO 2: Verification of Fallbacks & Defaults (Omit status and capacity)");
  try {
    const payload = {
      batch_name: "Math 10th Default Test",
      branch_id: validIds.branch_id,
      course_id: validIds.course_id,
      teacher_id: validIds.teacher_id,
      batch_type: "Academy"
    };

    const mockContext = {
      actionType: "CREATE",
      mutationManifest: []
    };

    console.log("   ⚙️ Invoking AcademicService.createBatch without optional fields...");
    const result = AcademicService.createBatch(payload, mockContext);

    if (result.status !== "active") {
      throw new Error(`Expected status to default to 'active', but got: ${result.status}`);
    }
    if (result.capacity !== 30) {
      throw new Error(`Expected capacity to default to 30, but got: ${result.capacity}`);
    }

    if (!mockContext.mutationManifest.includes("Batch")) {
      throw new Error("Mutation tracking failed: Batch mutation not tracked in manifest.");
    }

    console.log(`   ✅ Success! Defaults applied correctly. Status: ${result.status}, Capacity: ${result.capacity}`);
    console.log(`   ✅ Mutation tracking verified: ${JSON.stringify(mockContext.mutationManifest)}`);
    db.Batch.remove(result.batch_id);
    return "✅ PASSED";
  } catch (error) {
    logDetailedError(error);
    return `❌ FAILED: ${error.message}`;
  }
}

/**
 * Scenario 3: Course Referential Integrity Failure
 */
function executeScenario3_MissingCourseIntegrity(db, validIds) {
  console.log("▶️ SCENARIO 3: Course Referential Integrity Failure");
  try {
    const payload = {
      batch_name: "Math 10th Ghost Course",
      branch_id: validIds.branch_id,
      course_id: "CRS-GHOST", // Invalid Course ID
      teacher_id: validIds.teacher_id,
      batch_type: "Academy"
    };

    const mockContext = {
      actionType: "CREATE",
      mutationManifest: []
    };

    console.log("   ⚙️ Invoking AcademicService.createBatch with missing course ID...");
    AcademicService.createBatch(payload, mockContext);
    
    return "❌ FAILED: Expected EntityNotFoundError for Course, but execution completed without error.";
  } catch (error) {
    if (error.name === "EntityNotFoundError" && error.context && error.context.entity === "Course") {
      console.log(`   ✅ Success! Correctly caught EntityNotFoundError for Course. Message: ${error.message}`);
      return "✅ PASSED";
    } else {
      logDetailedError(error);
      return `❌ FAILED: Caught unexpected error ${error.name}`;
    }
  }
}

/**
 * Scenario 4: Teacher Referential Integrity Failure
 */
function executeScenario4_MissingTeacherIntegrity(db, validIds) {
  console.log("▶️ SCENARIO 4: Teacher Referential Integrity Failure");
  try {
    const payload = {
      batch_name: "Math 10th Ghost Teacher",
      branch_id: validIds.branch_id,
      course_id: validIds.course_id,
      teacher_id: "TCH-GHOST", // Invalid Teacher ID
      batch_type: "Academy"
    };

    const mockContext = {
      actionType: "CREATE",
      mutationManifest: []
    };

    console.log("   ⚙️ Invoking AcademicService.createBatch with missing teacher ID...");
    AcademicService.createBatch(payload, mockContext);

    return "❌ FAILED: Expected EntityNotFoundError for Teacher, but execution completed without error.";
  } catch (error) {
    if (error.name === "EntityNotFoundError" && error.context && error.context.entity === "Teacher") {
      console.log(`   ✅ Success! Correctly caught EntityNotFoundError for Teacher. Message: ${error.message}`);
      return "✅ PASSED";
    } else {
      logDetailedError(error);
      return `❌ FAILED: Caught unexpected error ${error.name}`;
    }
  }
}

/**
 * Scenario 5: Branch Referential Integrity Failure
 */
function executeScenario5_MissingBranchIntegrity(db, validIds) {
  console.log("▶️ SCENARIO 5: Branch Referential Integrity Failure");
  try {
    const payload = {
      batch_name: "Math 10th Ghost Branch",
      branch_id: "BRN-GHOST", // Invalid Branch ID
      course_id: validIds.course_id,
      teacher_id: validIds.teacher_id,
      batch_type: "Academy"
    };

    const mockContext = {
      actionType: "CREATE",
      mutationManifest: []
    };

    console.log("   ⚙️ Invoking AcademicService.createBatch with missing branch ID...");
    AcademicService.createBatch(payload, mockContext);

    return "❌ FAILED: Expected EntityNotFoundError for Branch, but execution completed without error.";
  } catch (error) {
    if (error.name === "EntityNotFoundError" && error.context && error.context.entity === "Branch") {
      console.log(`   ✅ Success! Correctly caught EntityNotFoundError for Branch. Message: ${error.message}`);
      return "✅ PASSED";
    } else {
      logDetailedError(error);
      return `❌ FAILED: Caught unexpected error ${error.name}`;
    }
  }
}

/**
 * Scenario 6: Schema Constraint - Required Fields
 */
function executeScenario6_MissingRequiredFields(db) {
  console.log("▶️ SCENARIO 6: Schema Constraint - Required Fields");
  let passed = true;
  let messages = [];

  try {
    const payload = {
      // Omit batch_name and batch_type
      branch_id: "BRN-3GVP91T",
      course_id: "CRS-D40D4661",
      teacher_id: "TCH-248AE945"
    };

    const mockContext = {
      actionType: "CREATE",
      mutationManifest: []
    };

    console.log("   ⚙️ Invoking AcademicService.createBatch omitting required fields...");
    AcademicService.createBatch(payload, mockContext);

    passed = false;
    messages.push("Expected ValidationError for missing required fields, but it succeeded.");
  } catch (error) {
    if (error.name !== "ValidationError") {
      passed = false;
      messages.push(`Expected ValidationError, but caught ${error.name}: ${error.message}`);
    } else {
      console.log(`   ✅ Success! Correctly caught ValidationError for missing required fields. Message: ${error.message}`);
    }
  }

  return passed ? "✅ PASSED" : `❌ FAILED: ${messages.join(" | ")}`;
}

/**
 * Scenario 7: Schema Constraint - Invalid Enum Selection
 */
function executeScenario7_InvalidEnumSelection(db, validIds) {
  console.log("▶️ SCENARIO 7: Schema Constraint - Invalid Enum Selection");
  let passed = true;
  let messages = [];

  try {
    const payload = {
      batch_name: "Math 10th Invalid Enum",
      branch_id: validIds.branch_id,
      course_id: validIds.course_id,
      teacher_id: validIds.teacher_id,
      batch_type: "Online" // Invalid Enum Choice
    };

    const mockContext = {
      actionType: "CREATE",
      mutationManifest: []
    };

    console.log("   ⚙️ Invoking AcademicService.createBatch with invalid batch_type...");
    AcademicService.createBatch(payload, mockContext);

    passed = false;
    messages.push("Expected ValidationError due to enum violation, but it succeeded.");
  } catch (error) {
    if (error.name !== "ValidationError") {
      passed = false;
      messages.push(`Expected ValidationError, but caught ${error.name}: ${error.message}`);
    } else {
      console.log(`   ✅ Success! Correctly caught ValidationError for enum choice violation. Message: ${error.message}`);
    }
  }

  return passed ? "✅ PASSED" : `❌ FAILED: ${messages.join(" | ")}`;
}

/**
 * Scenario 8: Missing Relational ID Fields
 */
function executeScenario8_MissingRelationalIdFields(db, validIds) {
  console.log("▶️ SCENARIO 8: Missing Relational ID Fields");
  let passed = true;
  let messages = [];

  // Sub-case 8A: Missing course_id
  try {
    const payload = {
      batch_name: "Math 10th Missing Course",
      branch_id: validIds.branch_id,
      teacher_id: validIds.teacher_id,
      batch_type: "Academy"
    };

    const mockContext = {
      actionType: "CREATE",
      mutationManifest: []
    };

    console.log("   ⚙️ Sub-case 8A: Invoking with course_id omitted...");
    AcademicService.createBatch(payload, mockContext);

    passed = false;
    messages.push("Expected EntityNotFoundError due to missing course_id, but it succeeded.");
  } catch (error) {
    if (error.name === "EntityNotFoundError" && error.context && error.context.entity === "Course" && error.message.includes("undefined")) {
      console.log("   ✅ Sub-case 8A Passed: Correctly caught EntityNotFoundError for undefined course_id.");
    } else {
      passed = false;
      messages.push(`Sub-case 8A Failed: Expected EntityNotFoundError for undefined course_id, but caught ${error.name}: ${error.message}`);
    }
  }

  // Sub-case 8B: Missing teacher_id and branch_id
  try {
    const payload = {
      batch_name: "Math 10th Optional IDs Omitted",
      course_id: validIds.course_id,
      batch_type: "Academy"
    };

    const mockContext = {
      actionType: "CREATE",
      mutationManifest: []
    };

    console.log("   ⚙️ Sub-case 8B: Invoking with teacher_id and branch_id omitted...");
    const result = AcademicService.createBatch(payload, mockContext);

    console.log(`   ✅ Sub-case 8B Passed: Successfully created batch (ID: ${result.batch_id}) omitting optional teacher_id and branch_id.`);
    if (!mockContext.mutationManifest.includes("Batch")) {
      throw new Error("Mutation tracking failed: Batch mutation not tracked in manifest.");
    }
    db.Batch.remove(result.batch_id);
  } catch (error) {
    passed = false;
    messages.push(`Sub-case 8B Failed: Expected success for optional fields omission, but caught error: ${error.message}`);
  }

  return passed ? "✅ PASSED" : `❌ FAILED: ${messages.join(" | ")}`;
}
