/**
 * @file FieldSystemTestSuite.js
 * Test Suite: Direct validation of the Django-inspired ORM Field System.
 * 
 * Run via Google Apps Script IDE or a test runner to ensure the schema rules
 * (auto-generation, type-casting, constraints) are strictly enforced by BaseModel.
 */

const FieldSystemTestSuite = (function() {

  function runAll() {
    console.log("=== STARTING FIELD SYSTEM ORM TESTS ===");
    let passed = 0;
    let failed = 0;

    const tests = [
      testDynamicModelGeneration,
      testHydrationAndTypeCasting,
      testValidationSuccess,
      testValidationFailureRequired,
      testValidationFailureEnum,
      testAutoGenerationAndSerialization
    ];

    tests.forEach(test => {
      try {
        test();
        console.log(`✅ PASS: ${test.name}`);
        passed++;
      } catch (e) {
        console.error(`❌ FAIL: ${test.name} -> ${e.message}`);
        failed++;
      }
    });

    console.log(`=== TESTS COMPLETE: ${passed} Passed, ${failed} Failed ===`);
  }

  function testDynamicModelGeneration() {
    const StudentModel = ModelRegistry.getModel("Student");
    if (!StudentModel) throw new Error("ModelRegistry failed to generate Student model.");
    if (StudentModel.tableName !== "Student") throw new Error("Generated model missing static tableName.");
    if (!StudentModel.schema.student_name) throw new Error("Generated schema missing 'student_name' field.");
  }

  function testHydrationAndTypeCasting() {
    const StudentModel = ModelRegistry.getModel("Student");
    
    // Simulate raw data from Google Sheets (e.g., date as string, number as string)
    const rawData = {
      student_name: "Rahul Sharma",
      dob: "2010-05-15", // String date
      __rowNumber: 5     // Internal metadata
    };

    const student = new StudentModel(rawData);

    if (student.student_name !== "Rahul Sharma") throw new Error("Hydration failed for string field.");
    if (!(student.dob instanceof Date)) throw new Error("DateField failed to cast string to Date object.");
    if (student.__rowNumber !== 5) throw new Error("Metadata preservation failed during hydration.");
  }

  function testValidationSuccess() {
    const StudentModel = ModelRegistry.getModel("Student");
    const student = new StudentModel({
      student_name: "Anita Desai",
      gender: "Female", // Valid Enum
      status: "active"  // Valid Enum
    });

    // Should pass without throwing
    student.validate(); 
  }

  function testValidationFailureRequired() {
    const StudentModel = ModelRegistry.getModel("Student");
    const student = new StudentModel({
      gender: "Male"
      // Missing 'student_name' which is required: true
    });

    try {
      student.validate();
      throw new Error("Validation SHOULD HAVE FAILED for missing required field, but it passed.");
    } catch (e) {
      if (!(e instanceof ValidationError)) {
        throw new Error(`Expected ValidationError, got: ${e.name}`);
      }
      if (!e.message.includes("student_name")) {
        throw new Error("Validation error did not flag the correct field.");
      }
    }
  }

  function testValidationFailureEnum() {
    const StudentModel = ModelRegistry.getModel("Student");
    const student = new StudentModel({
      student_name: "John Doe",
      gender: "Alien" // Invalid Enum choice
    });

    try {
      student.validate();
      throw new Error("Validation SHOULD HAVE FAILED for invalid enum, but it passed.");
    } catch (e) {
      if (!e.message.includes("gender") || !e.message.includes("Alien")) {
        throw new Error(`Validation error incorrect: ${e.message}`);
      }
    }
  }

  function testAutoGenerationAndSerialization() {
    const StudentModel = ModelRegistry.getModel("Student");
    const student = new StudentModel({
      student_name: "New Student",
      dob: new Date("2005-01-01")
    });

    // Serialize to row
    const row = student.toDatabaseRow();

    // 1. Auto ID Generation
    if (!row.student_id || !row.student_id.startsWith("STU-")) {
      throw new Error(`AutoField failed. Generated ID: ${row.student_id}`);
    }

    // 2. Timestamp Generation
    if (!row.__created_at) {
      throw new Error("DateTimeField autoNowAdd failed to generate timestamp.");
    }

    // 3. ISO Date Formatting
    if (typeof row.dob !== "string" || !row.dob.includes("T00:00:00.000Z")) {
      throw new Error(`DateField serialization failed. Expected ISO string, got: ${row.dob}`);
    }

    // 4. Default Value Injection
    if (row.status !== "active") {
      throw new Error(`Default value injection failed. Status: ${row.status}`);
    }
  }

  return {
    runAll: runAll
  };

})();
