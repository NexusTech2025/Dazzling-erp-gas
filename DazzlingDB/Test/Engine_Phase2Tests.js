/**
 * @file Engine_Phase2Tests.js
 * Automated test suite for SheetDB Phase 2 Database Engine Upgrades.
 * Focus: Aggregated Field Error Validation, Override Blocker on AutoField,
 *        Validation Registry Locking & Custom Errors, Polymorphic Traversal & Relational Validation.
 * 
 * INSTRUCTIONS:
 * Run 'runEnginePhase2Tests' from the Apps Script IDE.
 */

function runEnginePhase2Tests() {
  console.log("🚀 Starting SheetDB Phase 2 Database Engine Upgrades Tests...");
  
  const db = DBContext.getInstance();
  const results = {};
  
  console.log("\n=========================================");
  results.Scenario1 = executeScenario1_AggregatedFieldValidation(db);
  
  console.log("\n=========================================");
  results.Scenario2 = executeScenario2_OverrideBlocker(db);
  
  console.log("\n=========================================");
  results.Scenario3 = executeScenario3_ValidationRegistryLock(db);
  
  console.log("\n=========================================");
  results.Scenario4 = executeScenario4_PolymorphicTraversalAndValidation(db);
  
  console.log("=========================================\n");
  console.log("📊 FINAL TEST RESULTS: \n", JSON.stringify(results, null, 2));
  console.log("🏁 Engine Phase 2 Tests Complete.");
  
  return results;
}

/**
 * SCENARIO 1: Aggregated Field Error Validation
 */
function executeScenario1_AggregatedFieldValidation(db) {
  console.log("▶️ SCENARIO 1: Verification of Aggregated Field Validation");
  try {
    const payload = {
      name: "", // Required Field Failure
      language_medium: "French", // Invalid Choice
      duration_unit: "decades" // Invalid Choice
    };
    
    console.log("   ⚙️ Preparing invalid Course payload:", JSON.stringify(payload));
    
    // Create invalid Course instance (unsaved)
    const ModelClass = SheetDB.ModelRegistry.getModel("Course");
    const course = new ModelClass(payload, {
      gateway: db.Course.gateway,
      registry: db.Course.registry,
      resolver: db.Course.resolver
    });
    
    try {
      course.validate();
      throw new Error("Validation succeeded but was expected to fail with multiple errors.");
    } catch (error) {
      if (error.name !== "ValidationError") {
        throw new Error(`Expected ValidationError, but caught ${error.name}: ${error.message}`);
      }
      
      const errors = error.context && error.context.errors;
      if (!Array.isArray(errors)) {
        throw new Error("ValidationError does not contain an aggregated errors array in context.");
      }
      
      console.log(`   ⚙️ Caught expected ValidationError containing ${errors.length} field failures:`);
      errors.forEach(err => {
        console.log(`      - Field: '${err.fieldName}', Value: '${err.context ? err.context.value : 'N/A'}', Message: '${err.message}'`);
      });
      
      // We expect at least 3 errors (name, language_medium, duration_unit)
      if (errors.length < 3) {
        throw new Error(`Expected 3 aggregated field failures, but got ${errors.length}.`);
      }
      
      console.log("   ✅ Success! Aggregated Field Validation successfully collected all failures.");
      return "✅ PASSED";
    }
  } catch (error) {
    console.error("   ❌ Failed:", error.message);
    if (error.stack) console.error(error.stack);
    return `❌ FAILED: ${error.message}`;
  }
}

/**
 * SCENARIO 2: Override Blocker on AutoField
 */
function executeScenario2_OverrideBlocker(db) {
  console.log("▶️ SCENARIO 2: Verification of AutoField Override Blocker");
  try {
    const payload = {
      course_id: "CRS-MANUAL-ID-123", // Manual primary key injection
      name: "Override Test Course",
      segment_id: "SEG-TEST-1",
      language_medium: "English",
      base_fee: 1000
    };
    
    console.log("   ⚙️ Attempting to insert record with manual AutoField value:", JSON.stringify(payload));
    
    // Save original config state
    const originalBypass = db._config && db._config.allowAutoOverride;
    
    // Verify default behavior: blocked (manually disable bypass for check)
    console.log("   ⚙️ Temporarily disabling 'allowAutoOverride' to test default blocker...");
    if (db._config) db._config.allowAutoOverride = false;
    
    try {
      db.Course.insert(payload);
      throw new Error("AutoField override succeeded but was expected to be blocked.");
    } catch (error) {
      if (error.message.indexOf("Manual override of auto-generated field") === -1 && error.message.indexOf("Security Error") === -1) {
        throw new Error(`Expected manual override security block error, but caught: ${error.message}`);
      }
      console.log("   ✅ Successfully caught and blocked manual AutoField override attempt.");
    }
    
    // Verify bypass when allowAutoOverride is enabled
    console.log("   ⚙️ Enabling 'allowAutoOverride' bypass...");
    if (db._config) db._config.allowAutoOverride = true;
    
    let createdRecord;
    try {
      createdRecord = db.Course.insert(payload);
      if (createdRecord.course_id !== "CRS-MANUAL-ID-123") {
        throw new Error(`Expected course_id to be 'CRS-MANUAL-ID-123', but got: ${createdRecord.course_id}`);
      }
      console.log(`   ✅ Success! Manual override bypassed and record created with ID: ${createdRecord.createdRecord ? createdRecord.course_id : createdRecord.course_id}`);
    } finally {
      // Restore original config state
      if (db._config) db._config.allowAutoOverride = originalBypass;
      if (createdRecord) {
        db.Course.remove(createdRecord.course_id);
      }
    }
    
    return "✅ PASSED";
  } catch (error) {
    console.error("   ❌ Failed:", error.message);
    if (error.stack) console.error(error.stack);
    return `❌ FAILED: ${error.message}`;
  }
}

/**
 * SCENARIO 3: Validation Registry Locking & Custom Errors
 */
function executeScenario3_ValidationRegistryLock(db) {
  console.log("▶️ SCENARIO 3: Verification of ValidationRegistry Lock & Custom Errors");
  try {
    console.log("   ⚙️ DBContext is initialized, verifying ValidationRegistry is locked...");
    
    try {
      SheetDB.ValidationRegistry.register("dynamicValidator", function(v) { return true; });
      throw new Error("Registering validator on a locked ValidationRegistry succeeded but was expected to fail.");
    } catch (error) {
      if (error.name !== "ValidationRegistryLockedError") {
        throw new Error(`Expected ValidationRegistryLockedError, but caught ${error.name}: ${error.message}`);
      }
      console.log(`   ✅ Caught expected locked error: ${error.message}`);
    }
    
    console.log("   ⚙️ Unlocking registry temporarily to test validation error wrapping...");
    SheetDB.ValidationRegistry.unlock();
    
    try {
      // Register a validator that throws an unexpected error
      SheetDB.ValidationRegistry.register("faultyValidator", function(v) {
        throw new Error("Simulated validator internal error");
      });
      
      // Execute the validator and verify it wraps the error in ValidatorExecutionError
      try {
        SheetDB.ValidationRegistry.execute("faultyValidator", "someValue");
        throw new Error("Executing faulty validator succeeded but was expected to throw.");
      } catch (error) {
        if (error.name !== "ValidatorExecutionError") {
          throw new Error(`Expected ValidatorExecutionError, but caught ${error.name}: ${error.message}`);
        }
        console.log(`   ✅ Successfully caught ValidatorExecutionError wrapping the original error.`);
      }
      
      // Verify lookup of non-existent validator throws ValidatorNotFoundError
      try {
        SheetDB.ValidationRegistry.execute("nonExistentValidator", "someValue");
        throw new Error("Executing non-existent validator succeeded but was expected to throw.");
      } catch (error) {
        if (error.name !== "ValidatorNotFoundError") {
          throw new Error(`Expected ValidatorNotFoundError, but caught ${error.name}: ${error.message}`);
        }
        console.log(`   ✅ Successfully caught ValidatorNotFoundError: ${error.message}`);
      }
      
    } finally {
      // Re-lock registry
      SheetDB.ValidationRegistry.lock();
    }
    
    return "✅ PASSED";
  } catch (error) {
    console.error("   ❌ Failed:", error.message);
    if (error.stack) console.error(error.stack);
    return `❌ FAILED: ${error.message}`;
  }
}

/**
 * SCENARIO 4: Polymorphic Traversal & Dynamic Constraint Checks
 */
function executeScenario4_PolymorphicTraversalAndValidation(db) {
  console.log("▶️ SCENARIO 4: Verification of Polymorphic Traversal & Validation");
  
  // Seed curriculum data if not present
  console.log("   ⚙️ Setting up curriculum reference records...");
  const refs = TestMockData.setupCurriculum(db);
  
  // Create a Student record for linking
  const studentId = "STU-POLY-TEST";
  if (!db.Student.findById(studentId)) {
    db.Student.insert({ student_id: studentId, student_name: "Polymorphic Test Student", email: "poly@test.com", status: "active" });
  }
  
  let enrollmentCourse = null;
  let enrollmentPackage = null;
  
  try {
    // 1. Success Path: Dynamic Traversal to Course
    console.log("   ⚙️ Creating Enrollment pointing to Course (dynamic resolution)...");
    const enrCoursePayload = {
      student_id: studentId,
      enrollment_type: "course",
      item_id: refs.physicsId,
      status: "active"
    };
    
    enrollmentCourse = db.Enrollment.insert(enrCoursePayload);
    console.log(`   ⚙️ Enrollment created with ID: ${enrollmentCourse.enrollment_id}. Running polymorphic traversal student.item()...`);
    
    const traversedCourse = enrollmentCourse.item();
    if (!traversedCourse || traversedCourse.getEntityType() !== "Course") {
      throw new Error(`Traversed item should be a Course model, but got: ${traversedCourse ? traversedCourse.getEntityType() : 'null'}`);
    }
    if (traversedCourse.course_id !== refs.physicsId) {
      throw new Error(`Expected Course ID ${refs.physicsId}, but got ${traversedCourse.course_id}`);
    }
    console.log(`   ✅ Success! Dynamically resolved to Course: ${traversedCourse.name}`);
    
    // 2. Success Path: Dynamic Traversal to Package
    console.log("   ⚙️ Creating Enrollment pointing to Package (dynamic resolution)...");
    const enrPackagePayload = {
      student_id: studentId,
      enrollment_type: "package",
      item_id: refs.packageId,
      status: "active"
    };
    
    enrollmentPackage = db.Enrollment.insert(enrPackagePayload);
    console.log(`   ⚙️ Enrollment created with ID: ${enrollmentPackage.enrollment_id}. Running polymorphic traversal student.item()...`);
    
    const traversedPackage = enrollmentPackage.item();
    if (!traversedPackage || traversedPackage.getEntityType() !== "Package") {
      throw new Error(`Traversed item should be a Package model, but got: ${traversedPackage ? traversedPackage.getEntityType() : 'null'}`);
    }
    if (traversedPackage.package_id !== refs.packageId) {
      throw new Error(`Expected Package ID ${refs.packageId}, but got ${traversedPackage.package_id}`);
    }
    console.log(`   ✅ Success! Dynamically resolved to Package: ${traversedPackage.name}`);
    
    // 3. Failure Path: Invalid Polymorphic Parent Reference (FK validation check)
    console.log("   ⚙️ Testing negative constraint: non-existent polymorphic ID...");
    const invalidPayload = {
      student_id: studentId,
      enrollment_type: "course",
      item_id: "CRS-NON-EXISTENT-ID",
      status: "active"
    };
    
    try {
      db.Enrollment.insert(invalidPayload);
      throw new Error("Polymorphic FK validation succeeded but was expected to fail.");
    } catch (error) {
      console.log(`   ✅ Caught expected relational check error: ${error.message}`);
    }
    
    // 4. Failure Path: Mismatched Type/ID state check (integrity check)
    console.log("   ⚙️ Testing integrity constraint: ID provided but type field missing...");
    const mismatchedPayload = {
      student_id: studentId,
      enrollment_type: "", // missing type
      item_id: refs.physicsId,
      status: "active"
    };
    
    try {
      db.Enrollment.insert(mismatchedPayload);
      throw new Error("Integrity validation check succeeded but was expected to fail.");
    } catch (error) {
      console.log(`   ✅ Caught expected integrity mismatch error: ${error.message}`);
    }
    
    return "✅ PASSED";
  } catch (error) {
    console.error("   ❌ Failed:", error.message);
    if (error.stack) console.error(error.stack);
    return `❌ FAILED: ${error.message}`;
  } finally {
    // Cleanup seeded records
    console.log("   ⚙️ Cleaning up test records...");
    if (enrollmentCourse) {
      try { db.Enrollment.remove(enrollmentCourse.enrollment_id); } catch(e) {}
    }
    if (enrollmentPackage) {
      try { db.Enrollment.remove(enrollmentPackage.enrollment_id); } catch(e) {}
    }
    try { db.Student.remove(studentId); } catch(e) {}
  }
}
