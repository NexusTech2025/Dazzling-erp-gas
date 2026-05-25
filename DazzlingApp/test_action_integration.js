/**
 * ==============================================================
 * test_action_integration.gs
 * ==============================================================
 * 
 * Purpose:
 * Verify the end-to-end integration of dedicated entity management 
 * actions (AddStudent, AddTeacher) and their atomic registration logic.
 * 
 * Testing:
 * - Admin authorization guard
 * - Atomic User + Profile creation
 * - Cross-entity linking (user_id)
 * - Serialization via Action envelope
 * ==============================================================
 */

function runActionIntegrationTests() {
  const orm = bootstrapORM();
  const userRepo = orm.getRepository("User");
  const studentRepo = orm.getRepository("Student");
  const teacherRepo = orm.getRepository("Teacher");

  Logger.log("🚀 Starting Action Integration Tests...");

  // 1. Setup / Identify Admin Requester
  let adminData = userRepo.find({ role: "admin" })[0];
  if (!adminData) {
    Logger.log("⚠️ No admin found. Creating temporary admin for test...");
    const rawAdmin = userRepo.create({
      id: "4a16cbab-d4ca-4472-8ae0-145a020f4ced",
      username: "manish kumar",
      password_hash: "manishkumar@9782",
      role: "admin",
      status: "active"
    });
  }
  
  // CRITICAL: Must be wrapped in a Model for Action authorization
  const adminUser = orm._wrap("User", adminData);

  // 2. Test AddStudentAction
  Logger.log("--- [TEST] AddStudentAction ---");
  const studentPayload = {
    action: "addstudent",
    userData: {
      username: "test_s_" + Date.now(),
      password: "password123",
      email: "student@test.com"
    },
    profileData: {
      name: "Auto Test Student",
      enrollment_no: "ENR-" + Date.now(),
      grade: "10-Test"
    }
  };

  const addStudentAction = new AddStudentAction({
    orm,
    params: studentPayload,
    user: adminUser // Injecting admin identity
  });

  const studentResult = addStudentAction.run();
  SpreadsheetApp.flush()
  if (studentResult.success) {
    const data = studentResult.data;
    Logger.log("✅ Action Success Envelope Received");
    Logger.log(`Created User: ${data.user._data.username} (${data.user._data.id})`);
    Logger.log(`Created Student: ${data.profile._data.name} (${data.profile._data.id})`);

    Logger.log(data.user._data.id)
    Logger.log(data.profile._data.user_id)

    // Verify DB linkage
    if (data.user._data.id === data.profile._data.user_id) {
      Logger.log("✅ Integrity: User ID linked correctly in Profile.");
    } else {
      Logger.log("❌ Integrity: User ID MISMATCH!");
    }
  } else {
    Logger.log("❌ AddStudentAction Failed: " + JSON.stringify(studentResult.error));
  }



  // 3. Test AddTeacherAction
  Logger.log("--- [TEST] AddTeacherAction ---");
  const teacherPayload = {
    action: "addteacher",
    userData: {
      username: "test_t_" + Date.now(),
      password: "password123",
      email: "teacher@test.com"
    },
    profileData: {
      name: "Auto Test Teacher",
      subject_code: "SUB-TEST",
      designation: "Quality Assurance"
    }
  };

  const addTeacherAction = new AddTeacherAction({
    orm,
    params: teacherPayload,
    user: adminUser
  });

  const teacherResult = addTeacherAction.run();

  if (teacherResult.success) {
    const data = teacherResult.data;
    Logger.log("✅ AddTeacherAction Succeeded");
    Logger.log(`Created User: ${data.user.username}`);
    Logger.log(`Created Teacher ID: ${data.profile.id}`);
  } else {
    Logger.log("❌ AddTeacherAction Failed: " + JSON.stringify(teacherResult.error));
  }

  // 4. Cleanup
  Logger.log("--- Cleaning Up Test Data ---");
  try {
    if (studentResult.success) {
      studentRepo.delete(studentResult.data.profile.id);
      userRepo.delete(studentResult.data.user.id);
      Logger.log("🗑 Deleted Test Student and User.");
    }
    if (teacherResult.success) {
      teacherRepo.delete(teacherResult.data.profile.id);
      userRepo.delete(teacherResult.data.user.id);
      Logger.log("🗑 Deleted Test Teacher and User.");
    }
    SpreadsheetApp.flush();
    Logger.log("✅ Cleanup complete.");
  } catch (e) {
    Logger.log("⚠️ Cleanup partially failed (already deleted?): " + e.message);
  }

  Logger.log("🏁 Action Integration Testing Finished.");
}
