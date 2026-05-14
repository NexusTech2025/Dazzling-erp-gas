/**
 * @file Academic_CourseTests.js
 * Automated testing module for the Academic Domain (CourseType and Course).
 * Validates the new Django-inspired Field System, Fetch-then-Merge Updates, and Query Engine Hydration.
 * 
 * INSTRUCTIONS:
 * Run 'runAcademicCrudTests' from the Apps Script IDE.
 */

function runAcademicCrudTests() {
  console.log("🎓 Starting Academic Domain CRUD & ORM Validation Tests...");
  
  const db = DBContext.getInstance();
  const results = {};
  
  let segmentId = null;
  let courseId = null;

  console.log("\n=========================================");
  results.Scenario1 = executeScenario1_CourseTypeInsert(db, (id) => segmentId = id);

  console.log("\n=========================================");
  results.Scenario2 = executeScenario2_ValidationFailures(db);

  if (segmentId) {
    console.log("\n=========================================");
    results.Scenario3 = executeScenario3_CourseInsert(db, segmentId, (id) => courseId = id);

    if (courseId) {
      console.log("\n=========================================");
      results.Scenario4 = executeScenario4_PartialUpdate(db, courseId);

      console.log("\n=========================================");
      results.Scenario5 = executeScenario5_QueryHydration(db, courseId);

      console.log("\n=========================================");
      results.Scenario6 = executeScenario6_Deletion(db, segmentId, courseId);
    } else {
      console.warn("⚠️ Skipping Scenarios 4, 5, 6: Course insertion failed.");
    }
  } else {
    console.warn("⚠️ Skipping remaining scenarios: CourseType insertion failed.");
  }

  console.log("=========================================\n");
  console.log("📊 FINAL TEST RESULTS: \n", JSON.stringify(results, null, 2));
  return results;
}

function executeScenario1_CourseTypeInsert(db, setSegmentId) {
  console.log("▶️ SCENARIO 1: Insertion & Auto-Generation (CourseType)");
  try {
    const payload = {
      segment_name: "Test High School",
      entity_label: "Subject",
      description: "Automated test segment"
    };

    console.log("   ⚙️ Inserting payload:", JSON.stringify(payload));
    const result = db.CourseType.insert(payload);

    // Assertions
    if (!result.segment_id || !result.segment_id.startsWith("SEG-")) throw new Error(`AutoField failed: ID is ${result.segment_id}`);
    if (result.status !== "active") throw new Error(`Default value failed: Status is ${result.status}`);
    if (!result.__created_at) throw new Error("DateTimeField autoNowAdd failed: __created_at is missing");
    
    setSegmentId(result.segment_id);
    console.log(`   ✅ Success! Generated ID: ${result.segment_id}`);
    return "✅ PASSED";
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    return `❌ FAILED: ${e.message}`;
  }
}

function executeScenario2_ValidationFailures(db) {
  console.log("▶️ SCENARIO 2: Strict Field Validation (Failure Tests)");
  let passed = true;
  let messages = [];

  // Test A: Missing Required
  try {
    db.Course.insert({ description: "Missing segment and name" });
    passed = false;
    messages.push("Failed to catch missing required fields.");
  } catch (e) {
    if (e.name !== 'ValidationError') {
      passed = false;
      messages.push(`Expected ValidationError, got ${e.name} for missing fields.`);
    } else {
      console.log("   ✅ Caught missing required fields correctly.");
    }
  }

  // Test B: Invalid Enum
  try {
    db.Course.insert({
      segment_id: "SEG-DUMMY",
      name: "Dummy Course",
      duration_unit: "decades" // Invalid
    });
    passed = false;
    messages.push("Failed to catch invalid enum choice.");
  } catch (e) {
     if (e.name !== 'ValidationError') {
      passed = false;
      messages.push(`Expected ValidationError, got ${e.name} for invalid enum.`);
    } else {
       console.log("   ✅ Caught invalid enum ('decades') correctly.");
    }
  }

  // Test C: Type Mismatch (Trying to pass string to number)
  // Note: Depending on JS behavior, parseInt("five") returns NaN, which Field system turns to null. If it's required, it will fail validation.
  try {
    db.Course.insert({
      segment_id: "SEG-DUMMY",
      name: "Dummy Course",
      base_fee: "five hundred" 
    });
    passed = false;
    messages.push("Failed to catch type mismatch for base_fee.");
  } catch (e) {
     if (e.name !== 'ValidationError') {
      passed = false;
      messages.push(`Expected ValidationError, got ${e.name} for type mismatch.`);
    } else {
       console.log("   ✅ Caught type mismatch correctly.");
    }
  }

  return passed ? "✅ PASSED" : `❌ FAILED: ${messages.join(" | ")}`;
}

function executeScenario3_CourseInsert(db, segmentId, setCourseId) {
  console.log("▶️ SCENARIO 3: Relational Insertion (Course)");
  try {
    const payload = {
      segment_id: segmentId,
      name: "Test Physics 101",
      duration_value: 6,
      duration_unit: "months",
      base_fee: 1500,
      language_medium: "English"
    };

    const result = db.Course.insert(payload);

    if (!result.course_id || !result.course_id.startsWith("CRS-")) throw new Error("Course AutoField failed.");
    if (result.segment_id !== segmentId) throw new Error("Foreign Key mismatch.");

    setCourseId(result.course_id);
    console.log(`   ✅ Success! Created Course: ${result.name} (ID: ${result.course_id})`);
    return "✅ PASSED";
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    return `❌ FAILED: ${e.message}`;
  }
}

function executeScenario4_PartialUpdate(db, courseId) {
  console.log("▶️ SCENARIO 4: Partial Update & Fetch-then-Merge Logic");
  try {
    const updates = { base_fee: 9999 };
    console.log("   ⚙️ Updating with payload:", JSON.stringify(updates));
    
    // The robust 'fetch-then-merge' update
    const updatedCourse = db.Course.update(courseId, updates);

    if (updatedCourse.base_fee !== 9999) throw new Error("Fee was not updated.");
    if (!updatedCourse.name) throw new Error("Existing data (name) was lost during update.");
    
    console.log(`   ✅ Success! Course updated. New Fee: ${updatedCourse.base_fee}, Name intact: ${updatedCourse.name}`);
    return "✅ PASSED";
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    return `❌ FAILED: ${e.message}`;
  }
}

function executeScenario5_QueryHydration(db, courseId) {
  console.log("▶️ SCENARIO 5: Advanced Query Engine (Relation Hydration)");
  try {
    const queryPayload = {
      target: "Course",
      where: {
        course_id: courseId
      },
      include: {
        "coursetype": {} // Should hydrate the CourseType
      }
    };

    console.log("   ⚙️ Executing QueryEngine with Hydration...");
    const response = QueryEngine.execute(queryPayload, db);

    if (!response.success || response.data.length === 0) throw new Error("Query returned no results.");
    
    const fetchedCourse = response.data[0];
    
    if (!fetchedCourse.coursetype) throw new Error("Relation Hydrator failed to attach 'coursetype' object.");
    if (fetchedCourse.coursetype.segment_name !== "Test High School") throw new Error("Hydrated segment data is incorrect.");

    console.log(`   ✅ Success! Hydrated Segment Name: ${fetchedCourse.coursetype.segment_name}`);
    return "✅ PASSED";
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    return `❌ FAILED: ${e.message}`;
  }
}

function executeScenario6_Deletion(db, segmentId, courseId) {
  console.log("▶️ SCENARIO 6: Deletion");
  try {
    db.Course.remove(courseId);
    db.CourseType.remove(segmentId);

    const courseExists = db.Course.exists({ course_id: courseId });
    const segmentExists = db.CourseType.exists({ segment_id: segmentId });

    if (courseExists || segmentExists) throw new Error("Records still exist after deletion.");

    console.log("   ✅ Success! Test records cleanly deleted.");
    return "✅ PASSED";
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    return `❌ FAILED: ${e.message}`;
  }
}
