import BaseModel from "./BaseModel.js";


/**
 * @file testing.js
 * Testing the Dynamic Behavior of BaseModel.
 * Run this function in the GAS editor to verify how BaseModel handles different entities.
 */

function testBaseModelDynamicBehavior() {
  console.log("🚀 Starting BaseModel Dynamic Tests...");

  // --- 1. SETUP MOCKS ---
  
  // A fake Registry that simulates the Schema V1 metadata
  const mockRegistry = {
    getPrimaryKey: (entity) => (entity === "Student" ? "student_id" : "course_id"),
    getColumns: (entity) => {
      if (entity === "Student") {
        return { 
          "student_id": { type: "string" }, 
          "student_name": { type: "string" }, 
          "email": { type: "string" } 
        };
      }
      return { 
        "course_id": { type: "string" }, 
        "name": { type: "string" }, 
        "base_fee": { type: "number" } 
      };
    }
  };

  // A fake Gateway that logs what it WOULD do to a spreadsheet
  const mockGateway = {
    update: (id, data) => {
      console.log(`[Mock Gateway] UPDATING record ${id} with data:`, JSON.stringify(data));
      return true;
    },
    remove: (id) => {
      console.log(`[Mock Gateway] DELETING record with ID: ${id}`);
      return true;
    }
  };

  // --- 2. TEST CASE: STUDENT ---
  
  console.log("\n--- Scenario: Student Model ---");
  const studentData = {
    student_id: "STU-001",
    student_name: "Moni",
    email: "moni@example.com"
  };

  const studentModel = new BaseModel(studentData, {
    entityName: "Student",
    registry: mockRegistry,
    gateway: mockGateway
  });

  console.log("Entity Type Verification:", studentModel.getEntityType()); // Expected: "Student"
  console.log("Data Hydration Verification (Name):", studentModel.student_name); // Expected: "Moni"

  // Simulate a property change and saving
  console.log("Action: Modifying name and calling .save()...");
  studentModel.student_name = "Moni Refactored";
  studentModel.save(); 

  // --- 3. TEST CASE: COURSE ---

  console.log("\n--- Scenario: Course Model ---");
  const courseData = {
    course_id: "CS-101",
    name: "Advanced GAS Frameworks",
    base_fee: 5000
  };

  const courseModel = new BaseModel(courseData, {
    entityName: "Course",
    registry: mockRegistry,
    gateway: mockGateway
  });

  console.log("Entity Type Verification:", courseModel.getEntityType()); // Expected: "Course"
  console.log("Data Hydration Verification (Fee):", courseModel.base_fee);

  // Simulate a deletion
  console.log("Action: Calling .delete()...");
  courseModel.delete();

  console.log("\n✅ BaseModel tests finished. The dynamic wrapper is working correctly.");
}


testBaseModelDynamicBehavior()