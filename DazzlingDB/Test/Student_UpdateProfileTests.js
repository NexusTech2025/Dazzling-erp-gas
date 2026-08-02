/**
 * @file Student_UpdateProfileTests.js
 * Path: DazzlingDB/Test/Student_UpdateProfileTests.js
 * 
 * Google Apps Script Integration & Diagnostic Test Suite for:
 * Student Profile Update (`student_update_profile`) & StudentService.updateStudentProfile.
 * 
 * Leverages ApiTestSeedHook / FixedMockData predefined seeding mechanism:
 * - STU-001001 (John Doe, ADR-001001, CON-001001, EDU-001001, john.doe@example.com)
 * - STU-002002 (Jane Smith, ADR-002002, CON-002002, EDU-002002, jane.smith@example.com)
 */

function runStudentUpdateProfileTests() {
  console.log("===============================================================");
  console.log("🧪 STARTING INTEGRATION SUITE: Student Profile Update (student_update_profile)");
  console.log("===============================================================");

  const originalEnv = (typeof PropertiesService !== 'undefined' && PropertiesService.getScriptProperties())
    ? (PropertiesService.getScriptProperties().getProperty('ENV') || 'DEVELOPMENT')
    : 'DEVELOPMENT';

  if (typeof PropertiesService !== 'undefined' && PropertiesService.getScriptProperties()) {
    PropertiesService.getScriptProperties().setProperty('ENV', 'TESTING');
  }

  let passedCount = 0;
  let failedCount = 0;

  try {
    // 1. Seed predefined mock dataset via ApiTestSeedHook if available
    if (typeof ApiTestSeedHook !== 'undefined') {
      console.log("🌱 Seeding database via ApiTestSeedHook...");
      ApiTestSeedHook.seed({ env: "TESTING" });
    } else if (typeof FixedMockData !== 'undefined') {
      console.log("🌱 Seeding database via FixedMockData...");
      FixedMockData.seedLiveDatabase();
    }

    const db = DBContext.getInstance();

    // Execute Test Scenarios
    _executeScenario("Scenario 1: Partial Profile Update (student_name only on STU-001001)", () => {
      return _testScenario1_PartialProfileUpdate(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 2: Profile + Address Update on Predefined Record (STU-001001)", () => {
      return _testScenario2_ProfileAndAddressUpdate(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 3: Profile + ContactInfo Update on Predefined Record (STU-001001)", () => {
      return _testScenario3_ProfileAndContactUpdate(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 4: Targeted Education Update via education_id (EDU-001001)", () => {
      return _testScenario4_TargetedEducationUpdate(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 5: Education Upsert — Insert New Record without education_id", () => {
      return _testScenario5_EducationUpsertInsert(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 6: Address Upsert — Create Address for Student without Address", () => {
      return _testScenario6_AddressUpsertInsert(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 7: Duplicate Email Guard Enforcement (DUPLICATE_EMAIL)", () => {
      return _testScenario7_DuplicateEmailGuard(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 8: Inactive Student Guard Enforcement (INACTIVE_STUDENT_PROFILE)", () => {
      return _testScenario8_InactiveStudentGuard(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 9: Nonexistent Student Guard Enforcement (STUDENT_NOT_FOUND)", () => {
      return _testScenario9_StudentNotFoundGuard(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 10: Nonexistent Education ID Guard Enforcement (EDUCATION_RECORD_NOT_FOUND)", () => {
      return _testScenario10_EducationNotFoundGuard(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 11: Education Ownership Mismatch Guard Enforcement (EDUCATION_OWNERSHIP_MISMATCH)", () => {
      return _testScenario11_EducationOwnershipMismatchGuard(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 12: Address Missing Required Fields Guard Enforcement (ADDRESS_REQUIRED_FIELDS_MISSING)", () => {
      return _testScenario12_AddressRequiredFieldsGuard(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 13: Full Composite Update (Student, Address, ContactInfo, Education)", () => {
      return _testScenario13_FullCompositeUpdate(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 14: ApiDispatcher Controller Routing Verification (student_update_profile)", () => {
      return _testScenario14_ApiDispatcherRouting(db);
    }, () => passedCount++, () => failedCount++);

    _executeScenario("Scenario 15: Invalid Education Meta Property Guard Enforcement (validateEducationMeta)", () => {
      return _testScenario15_InvalidEducationMetaGuard(db);
    }, () => passedCount++, () => failedCount++);

  } finally {
    // Purge seeded test data
    if (typeof ApiTestSeedHook !== 'undefined') {
      ApiTestSeedHook.purge({ restoreEnv: originalEnv });
    } else if (typeof FixedMockData !== 'undefined') {
      FixedMockData.purgeFromLiveDatabase();
    }

    if (typeof PropertiesService !== 'undefined' && PropertiesService.getScriptProperties()) {
      PropertiesService.getScriptProperties().setProperty('ENV', originalEnv);
    }

    console.log("===============================================================");
    console.log(`📊 TEST SUITE SUMMARY: ${passedCount} PASSED | ${failedCount} FAILED`);
    console.log("===============================================================\n");
  }
}

// -----------------------------------------------------------------------------
// Test Scenario Implementations
// -----------------------------------------------------------------------------

function _executeScenario(title, fn, onSuccess, onFailure) {
  console.log(`\n▶ ${title}`);
  try {
    fn();
    console.log(`  ✅ PASSED`);
    onSuccess();
  } catch (err) {
    console.error(`  ❌ FAILED: ${err.message}`);
    if (err.errorCode) console.error(`     ErrorCode: ${err.errorCode}`);
    onFailure();
  }
}

function _testScenario1_PartialProfileUpdate(db) {
  const targetId = "STU-001001";
  const originalStudent = db.Student.findById(targetId);
  if (!originalStudent) throw new Error(`Predefined student ${targetId} not found`);

  const updated = StudentService.updateStudentProfile({
    student_id: targetId,
    profile: { student_name: "John Doe Updated" }
  }, {});

  if (updated.student_name !== "John Doe Updated") {
    throw new Error(`Expected student_name 'John Doe Updated', got '${updated.student_name}'`);
  }
  if (updated.email !== "john.doe@example.com") {
    throw new Error(`Expected email to remain unchanged, got '${updated.email}'`);
  }
}

function _testScenario2_ProfileAndAddressUpdate(db) {
  const targetId = "STU-001001";

  const updated = StudentService.updateStudentProfile({
    student_id: targetId,
    address: { city: "New Jaipur City" }
  }, {});

  if (!updated.address) throw new Error("Expected address object in response");
  if (updated.address.city !== "New Jaipur City") {
    throw new Error(`Expected city 'New Jaipur City', got '${updated.address.city}'`);
  }
  if (updated.address.address_id !== "ADR-001001") {
    throw new Error(`Expected address_id 'ADR-001001', got '${updated.address.address_id}'`);
  }
}

function _testScenario3_ProfileAndContactUpdate(db) {
  const targetId = "STU-001001";

  const updated = StudentService.updateStudentProfile({
    student_id: targetId,
    contact: { mobile_number: "9998887776" }
  }, {});

  if (!updated.contact) throw new Error("Expected contact object in response");
  if (updated.contact.mobile_number !== "9998887776") {
    throw new Error(`Expected mobile_number '9998887776', got '${updated.contact.mobile_number}'`);
  }
  if (updated.contact.contact_id !== "CON-001001") {
    throw new Error(`Expected contact_id 'CON-001001', got '${updated.contact.contact_id}'`);
  }
}

function _assertScoreEqual(actualVal, expectedInput, metaObj) {
  const meta = (typeof metaObj === 'string') ? JSON.parse(metaObj) : metaObj;
  const scoreType = (meta && meta.score_type) ? String(meta.score_type).toLowerCase() : 'pct';

  if (scoreType === 'pct') {
    // Expected percentage input e.g. "95.5%" -> expected decimal fraction 0.955
    const expectedDecimal = String(expectedInput).endsWith('%')
      ? Number(String(expectedInput).slice(0, -1)) / 100
      : (Number(expectedInput) > 1 ? Number(expectedInput) / 100 : Number(expectedInput));

    // Actual value read back from response/sheet (could be 0.955, "0.955", "95.5%", etc.)
    let actualDecimal = Number(actualVal);
    if (typeof actualVal === 'string' && actualVal.endsWith('%')) {
      actualDecimal = Number(actualVal.slice(0, -1)) / 100;
    } else if (!isNaN(actualDecimal) && actualDecimal > 1) {
      actualDecimal = actualDecimal / 100;
    }

    if (isNaN(actualDecimal) || Math.abs(actualDecimal - expectedDecimal) > 0.0001) {
      throw new Error(`Percentage mismatch: expected decimal fraction '${expectedDecimal.toFixed(3)}' (for '${expectedInput}'), got actual '${actualVal}' (${actualDecimal})`);
    }
  } else {
    // CGPA comparison
    const expectedCgpa = Number(expectedInput);
    const actualCgpa = Number(actualVal);
    if (isNaN(actualCgpa) || Math.abs(actualCgpa - expectedCgpa) > 0.01) {
      throw new Error(`CGPA mismatch: expected '${expectedCgpa}', got '${actualVal}'`);
    }
  }
}

function _testScenario4_TargetedEducationUpdate(db) {
  const targetId = "STU-001001";
  const eduId = "EDU-001001";

  const updated = StudentService.updateStudentProfile({
    student_id: targetId,
    education: [
      {
        education_id: eduId,
        percentage_or_cgpa: "95.5%",
        meta: { score_type: "pct" }
      }
    ]
  }, {});

  if (!Array.isArray(updated.education) || updated.education.length === 0) {
    throw new Error("Expected non-empty education array");
  }
  const targetEdu = updated.education.find(e => e.education_id === eduId);
  if (!targetEdu) throw new Error(`Education record ${eduId} not found in response`);
  const metaObj = typeof targetEdu.meta === 'string' ? JSON.parse(targetEdu.meta) : targetEdu.meta;
  _assertScoreEqual(targetEdu.percentage_or_cgpa, "95.5%", metaObj);
  if (!metaObj || metaObj.score_type !== "pct") {
    throw new Error(`Expected meta.score_type 'pct', got '${metaObj && metaObj.score_type}'`);
  }
}

function _testScenario5_EducationUpsertInsert(db) {
  const targetId = "STU-001001";

  const updated = StudentService.updateStudentProfile({
    student_id: targetId,
    education: [
      {
        highest_qualification: "Class 12",
        institution_name: "St. Xavier Senior Sec",
        year_of_passing: 2026,
        percentage_or_cgpa: "92.0%",
        meta: { score_type: "pct", board: "CBSE" }
      }
    ]
  }, {});

  const newEdu = updated.education.find(e => e.highest_qualification === "Class 12");
  if (!newEdu) throw new Error("Expected new Class 12 education record");
  if (!newEdu.education_id || !newEdu.education_id.startsWith("EDU-")) {
    throw new Error(`Expected new generated education_id with EDU- prefix, got '${newEdu && newEdu.education_id}'`);
  }
  const metaObj = typeof newEdu.meta === 'string' ? JSON.parse(newEdu.meta) : newEdu.meta;
  _assertScoreEqual(newEdu.percentage_or_cgpa, "92.0%", metaObj);
  if (!metaObj || metaObj.board !== "CBSE") {
    throw new Error(`Expected meta.board 'CBSE', got '${metaObj && metaObj.board}'`);
  }
}

function _testScenario6_AddressUpsertInsert(db) {
  // Create a temporary student record without an Address
  const tempStudent = db.Student.insert({
    student_name: "No Address Student",
    email: "noaddress@example.com",
    status: "active"
  });

  try {
    const updated = StudentService.updateStudentProfile({
      student_id: tempStudent.student_id,
      address: {
        line1: "100 New Colony",
        city: "Udaipur",
        state: "Rajasthan",
        pin_code: "313001"
      }
    }, {});

    if (!updated.address) throw new Error("Expected address object created for student");
    if (updated.address.city !== "Udaipur") {
      throw new Error(`Expected city 'Udaipur', got '${updated.address.city}'`);
    }
  } finally {
    // Cleanup temporary student
    if (db.Address) {
      const addrs = db.Address.where({ student_id: tempStudent.student_id });
      addrs.forEach(a => db.Address.remove(a.address_id));
    }
    db.Student.remove(tempStudent.student_id);
  }
}

function _testScenario7_DuplicateEmailGuard(db) {
  let caught = false;
  try {
    // Attempting to update STU-002002's email to STU-001001's email (john.doe@example.com)
    StudentService.updateStudentProfile({
      student_id: "STU-002002",
      profile: { email: "john.doe@example.com" }
    }, {});
  } catch (err) {
    caught = true;
    if (err.errorCode !== "DUPLICATE_EMAIL" && err.name !== "StudentProfileError") {
      throw new Error(`Expected DUPLICATE_EMAIL error code, got '${err.errorCode || err.name}'`);
    }
  }
  if (!caught) throw new Error("Expected duplicate email error to be thrown");
}

function _testScenario8_InactiveStudentGuard(db) {
  // Mark STU-002002 as inactive temporarily
  const backup = db.Student.findById("STU-002002");
  db.Student.update("STU-002002", { status: "inactive" });

  try {
    let caught = false;
    try {
      StudentService.updateStudentProfile({
        student_id: "STU-002002",
        profile: { student_name: "Attempt Name Change" }
      }, {});
    } catch (err) {
      caught = true;
      if (err.errorCode !== "INACTIVE_STUDENT_PROFILE") {
        throw new Error(`Expected INACTIVE_STUDENT_PROFILE error code, got '${err.errorCode}'`);
      }
    }
    if (!caught) throw new Error("Expected inactive student update error to be thrown");
  } finally {
    // Restore active status
    db.Student.update("STU-002002", { status: backup.status || "active" });
  }
}

function _testScenario9_StudentNotFoundGuard(db) {
  let caught = false;
  try {
    StudentService.updateStudentProfile({
      student_id: "STU-NONEXISTENT-99999",
      profile: { student_name: "Test" }
    }, {});
  } catch (err) {
    caught = true;
    if (err.errorCode !== "STUDENT_NOT_FOUND") {
      throw new Error(`Expected STUDENT_NOT_FOUND error code, got '${err.errorCode}'`);
    }
  }
  if (!caught) throw new Error("Expected STUDENT_NOT_FOUND error to be thrown");
}

function _testScenario10_EducationNotFoundGuard(db) {
  let caught = false;
  try {
    StudentService.updateStudentProfile({
      student_id: "STU-001001",
      education: [
        { education_id: "EDU-FAKE-9999", highest_qualification: "PhD" }
      ]
    }, {});
  } catch (err) {
    caught = true;
    if (err.errorCode !== "EDUCATION_RECORD_NOT_FOUND") {
      throw new Error(`Expected EDUCATION_RECORD_NOT_FOUND error code, got '${err.errorCode}'`);
    }
  }
  if (!caught) throw new Error("Expected EDUCATION_RECORD_NOT_FOUND error to be thrown");
}

function _testScenario11_EducationOwnershipMismatchGuard(db) {
  let caught = false;
  try {
    // EDU-001001 belongs to STU-001001, but we pass student_id = STU-002002
    StudentService.updateStudentProfile({
      student_id: "STU-002002",
      education: [
        { education_id: "EDU-001001", highest_qualification: "PhD" }
      ]
    }, {});
  } catch (err) {
    caught = true;
    if (err.errorCode !== "EDUCATION_OWNERSHIP_MISMATCH") {
      throw new Error(`Expected EDUCATION_OWNERSHIP_MISMATCH error code, got '${err.errorCode}'`);
    }
  }
  if (!caught) throw new Error("Expected EDUCATION_OWNERSHIP_MISMATCH error to be thrown");
}

function _testScenario12_AddressRequiredFieldsGuard(db) {
  const tempStudent = db.Student.insert({
    student_name: "No Addr Student 2",
    email: "noaddr2@example.com",
    status: "active"
  });

  try {
    let caught = false;
    try {
      StudentService.updateStudentProfile({
        student_id: tempStudent.student_id,
        address: { city: "Incomplete City" }
      }, {});
    } catch (err) {
      caught = true;
      if (err.errorCode !== "ADDRESS_REQUIRED_FIELDS_MISSING") {
        throw new Error(`Expected ADDRESS_REQUIRED_FIELDS_MISSING error code, got '${err.errorCode}'`);
      }
    }
    if (!caught) throw new Error("Expected ADDRESS_REQUIRED_FIELDS_MISSING error to be thrown");
  } finally {
    db.Student.remove(tempStudent.student_id);
  }
}

function _testScenario13_FullCompositeUpdate(db) {
  const targetId = "STU-001001";

  const updated = StudentService.updateStudentProfile({
    student_id: targetId,
    profile: { student_name: "John Composite Doe", mother_name: "Sarah M. Doe" },
    address: { line1: "99 Innovation Blvd", city: "Jaipur Central" },
    contact: { emergency_name: "Robert Senior Doe" },
    education: [
      { education_id: "EDU-001001", percentage_or_cgpa: "96.0%", meta: { score_type: "pct" } }
    ]
  }, {});

  if (updated.student_name !== "John Composite Doe") throw new Error("Profile name not updated");
  if (updated.mother_name !== "Sarah M. Doe") throw new Error("Mother name not updated");
  if (updated.address.city !== "Jaipur Central") throw new Error("Address city not updated");
  if (updated.contact.emergency_name !== "Robert Senior Doe") throw new Error("Contact emergency_name not updated");
  const edu = updated.education.find(e => e.education_id === "EDU-001001");
  const eduMeta = typeof edu.meta === 'string' ? JSON.parse(edu.meta) : edu.meta;
  _assertScoreEqual(edu.percentage_or_cgpa, "96.0%", eduMeta);
}

function _testScenario14_ApiDispatcherRouting(db) {
  const targetId = "STU-001001";
  const actionInstance = new UpdateStudentProfileAction();

  const mockRequestContext = {
    db: db,
    params: {
      action: "student_update_profile",
      payload: {
        student_id: targetId,
        profile: { student_name: "John Dispatch Verified" }
      }
    },
    user: { role: "admin" }
  };

  const response = actionInstance.run(mockRequestContext);

  if (!response.success) {
    throw new Error(`Action execution failed: ${JSON.stringify(response.error)}`);
  }
  if (response.data.student_name !== "John Dispatch Verified") {
    throw new Error(`Expected student_name 'John Dispatch Verified', got '${response.data.student_name}'`);
  }
  if (!response.context.mutated_records.includes("Student")) {
    throw new Error("Expected 'Student' in mutated_records context list");
  }
}

function _testScenario15_InvalidEducationMetaGuard(db) {
  let caught = false;
  try {
    StudentService.updateStudentProfile({
      student_id: "STU-001001",
      education: [
        {
          education_id: "EDU-001001",
          meta: { invalid_property: "unauthorized_val" }
        }
      ]
    }, {});
  } catch (err) {
    caught = true;
    if (!err.message || !err.message.includes("Invalid Education meta property")) {
      throw new Error(`Expected 'Invalid Education meta property' error message, got '${err.message}'`);
    }
  }
  if (!caught) throw new Error("Expected invalid Education meta property error to be thrown");
}

// Bind top-level entry point to global namespace for Apps Script execution
globalThis.runStudentUpdateProfileTests = runStudentUpdateProfileTests;
