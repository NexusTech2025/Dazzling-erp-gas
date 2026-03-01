/**
 * ==============================================================
 * test_crud_entities.gs
 * ==============================================================
 * 
 * Purpose:
 * Integration test for CRUD operations on Students and Teachers.
 * 
 * Execution:
 * 1. Run 'testStudentCRUD' to verify student lifecycle.
 * 2. Run 'testTeacherCRUD' to verify teacher lifecycle.
 * ==============================================================
 */

/**
 * Test Student Lifecycle: Create -> Update -> Delete
 */
function testStudentCRUD() {
  Logger.log("🧪 Starting Student CRUD Test...");
  const orm = bootstrapORM();
  const studentRepo = orm.getRepository("Student");
  
  const testId = "TEST-STU-" + new Date().getTime();
  
  try {
    // 1. CREATE
    Logger.log("📝 Step 1: Creating Student...");
    const studentData = {
      id: testId,
      name: "Test Student " + testId,
      class: "10-A",
      stream: "Science",
      rollNo: 999,
      feeStatus: "Pending"
    };
    
    studentRepo.create(studentData);
    SpreadsheetApp.flush();
    
    // Verify creation
    const created = studentRepo.findById(testId);
    if (!created || created.name !== studentData.name) {
      throw new Error("❌ Create failed: Student not found or data mismatch.");
    }
    Logger.log("✅ Student Created successfully.");

    // 2. UPDATE
    Logger.log("✏️ Step 2: Updating Student...");
    const updateData = { name: "Updated Name", feeStatus: "Paid" };
    studentRepo.update(testId, updateData);
    SpreadsheetApp.flush();
    
    // Verify update
    const updated = studentRepo.findById(testId);
    if (updated.name !== "Updated Name" || updated.feeStatus !== "Paid") {
      throw new Error("❌ Update failed: Data not updated correctly.");
    }
    Logger.log("✅ Student Updated successfully.");

    // 3. DELETE
    Logger.log("🗑️ Step 3: Deleting Student...");
    studentRepo.delete(testId);
    SpreadsheetApp.flush();
    
    // Verify deletion
    const deleted = studentRepo.findById(testId);
    if (deleted) {
      throw new Error("❌ Delete failed: Student still exists.");
    }
    Logger.log("✅ Student Deleted successfully.");
    
    Logger.log("🎊 FULL STUDENT CRUD TEST PASSED!");

  } catch (error) {
    Logger.log("❌ TEST FAILED: " + error.message);
    if (error.meta) Logger.log("Details: " + JSON.stringify(error.meta));
  }
}

/**
 * Test Teacher Lifecycle: Create -> Update -> Delete
 */
function testTeacherCRUD() {
  Logger.log("🧪 Starting Teacher CRUD Test...");
  const orm = bootstrapORM();
  const teacherRepo = orm.getRepository("Teacher");
  
  const testId = "TEST-TEA-" + new Date().getTime();
  
  try {
    // 1. CREATE
    Logger.log("📝 Step 1: Creating Teacher...");
    const teacherData = {
      id: testId,
      name: "Professor Test " + testId,
      subject_code: "MATH-101",
      designation: "Senior Lecturer"
    };
    
    teacherRepo.create(teacherData);
    SpreadsheetApp.flush();
    
    // Verify creation
    const created = teacherRepo.findById(testId);
    if (!created || created.name !== teacherData.name) {
      throw new Error("❌ Create failed: Teacher not found.");
    }
    Logger.log("✅ Teacher Created successfully.");

    // 2. UPDATE
    Logger.log("✏️ Step 2: Updating Teacher...");
    teacherRepo.update(testId, { designation: "Department Head" });
    SpreadsheetApp.flush();
    
    // Verify update
    const updated = teacherRepo.findById(testId);
    if (updated.designation !== "Department Head") {
      throw new Error("❌ Update failed.");
    }
    Logger.log("✅ Teacher Updated successfully.");

    // 3. DELETE
    Logger.log("🗑️ Step 3: Deleting Teacher...");
    teacherRepo.delete(testId);
    SpreadsheetApp.flush();
    
    // Verify deletion
    const deleted = teacherRepo.findById(testId);
    if (deleted) {
      throw new Error("❌ Delete failed.");
    }
    Logger.log("✅ Teacher Deleted successfully.");
    
    Logger.log("🎊 FULL TEACHER CRUD TEST PASSED!");

  } catch (error) {
    Logger.log("❌ TEST FAILED: " + error.message);
    if (error.meta) Logger.log("Details: " + JSON.stringify(error.meta));
  }
}
