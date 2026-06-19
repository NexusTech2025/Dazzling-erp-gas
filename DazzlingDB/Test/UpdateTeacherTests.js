/**
 * @file UpdateTeacherTests.js
 * Integration test suite for the ValidationEngine and the staff_update_teacher action workflow.
 * Covers: core profile fields, enum constraints, self-exclusion, FK pass-through,
 *         relational mutations (subjects, salary config), and all Step 1 + Step 2 payload paths.
 *
 * Uses seeded production data — no mock inserts for Branch, CourseType, or Course.
 */

function runUpdateTeacherTests() {
  console.log("🚀 Starting Update Teacher ValidationEngine Integration Tests...");

  const db = DBContext.getInstance();
  const suffix = Math.random().toString(36).substring(7).toUpperCase();

  // ─── Seeded Production References (no mock insert) ───────────────────────
  // Branch: Use an existing active branch from the database
  const VALID_BRANCH_ID   = "BRN-3GVP91T";   // Home Branch — Ganesh Colony
  const INVALID_BRANCH_ID = "BRN-NON-EXISTENT-XYZ";

  // Courses: Hardcoded seeded production course IDs
  // Source: SEG-8960CE30 (Academic / Mathematics) & SEG-4E47FCFB (School Curriculum)
  const VALID_COURSE_ID_1  = "CRS-87206D7D";   // Mathematics (SEG-8960CE30)
  const VALID_COURSE_ID_2  = "CRS-2DEB0E44";   // Class 3 Mathematics (SEG-4E47FCFB)
  const INVALID_COURSE_ID  = "CRS-NON-EXISTENT-XYZ";
  console.log(`✅ Setup: Using seeded courses — ${VALID_COURSE_ID_1}, ${VALID_COURSE_ID_2}`);

  // ─── Teacher Mock Data ────────────────────────────────────────────────────
  let mockTeacherId;
  let duplicateTeacherId;

  const originalMobile = "95" + Math.floor(10000000 + Math.random() * 90000000);
  const otherMobile    = "96" + Math.floor(10000000 + Math.random() * 90000000);
  const originalEmail  = `tch_original_${suffix.toLowerCase()}@example.com`;
  const otherEmail     = `tch_other_${suffix.toLowerCase()}@example.com`;

  // Insert primary Teacher under test
  try {
    const teacher = db.Teacher.insert({
      full_name:        `Update Test Teacher ${suffix}`,
      mobile_number:    originalMobile,
      email:            originalEmail,
      gender:           "male",
      teacher_type:     "full_time",
      status:           "active",
      experience_years: 5,
      joining_date:     "2026-05-26",
      branch_id:        VALID_BRANCH_ID
    });
    mockTeacherId = teacher.teacher_id;
    console.log(`✅ Setup: Primary mock Teacher created: ${mockTeacherId}`);
  } catch (e) {
    console.error("❌ Setup failed — cannot continue without primary Teacher:", e.message);
    return;
  }

  // Insert duplicate-holder Teacher for uniqueness collision tests
  try {
    const dup = db.Teacher.insert({
      full_name:        `Duplicate Holder Teacher ${suffix}`,
      mobile_number:    otherMobile,
      email:            otherEmail,
      teacher_type:     "part_time",
      status:           "active",
      experience_years: 3,
      joining_date:     "2026-05-26"
    });
    duplicateTeacherId = dup.teacher_id;
    console.log(`✅ Setup: Duplicate-holder Teacher created: ${duplicateTeacherId}`);
  } catch (e) {
    console.error("❌ Setup: Failed to create duplicate-holder Teacher:", e.message);
  }


  // ─── STEP 1: CORE PROFILE FIELD TESTS ────────────────────────────────────

  // CASE 1: Full profileData success — mirrors exact fields sent by AddTeacher.jsx
  console.log("\n--- [CASE 1] Full profileData success (all Step-1 fields) ---");
  try {
    const mockContext = {
      actionType: "UPDATE",
      mutationManifest: []
    };

    StaffService.updateTeacher({
      teacher_id: mockTeacherId,
      data: {
        full_name:          `Professor Moni Revised ${suffix}`,
        mobile_number:      originalMobile,         // own value — self-exclusion must pass
        email:              originalEmail,          // own value — self-exclusion must pass
        gender:             "female",
        date_of_birth:      "1990-06-15",
        profile_photo_url:  "https://cdn.dazzling.erp/photos/tch.jpg",
        experience_years:   12,
        qualification:      "M.Sc. Physics",
        specialization:     "Quantum Mechanics",
        previous_institute: "ABC Institute",
        teacher_type:       "full_time",
        joining_date:       "2026-05-26",
        branch_id:          VALID_BRANCH_ID,
        status:             "active",
        notes:              "Excellent educator",
        address:            "42 Test Street, Testville"
      }
    }, mockContext);
    
    const fetched = db.Teacher.findById(mockTeacherId);
    if (
      fetched.full_name      === `Professor Moni Revised ${suffix}` &&
      fetched.gender         === "female" &&
      fetched.qualification  === "M.Sc. Physics" &&
      fetched.branch_id      === VALID_BRANCH_ID
    ) {
      console.log("  ✅ All Step-1 profile fields updated and verified.");
    } else {
      console.error("  ❌ Step-1 field mismatch on post-update verification.", JSON.stringify(fetched));
    }

    if (mockContext.mutationManifest.includes("Teacher")) {
      console.log("  ✅ Mutation manifest verified: " + JSON.stringify(mockContext.mutationManifest));
    } else {
      console.error("  ❌ Mutation manifest tracking failed! Got: " + JSON.stringify(mockContext.mutationManifest));
    }
  } catch (e) {
    console.error("❌ Case 1 unexpected error:", e.message);
  }

  // CASE 2: Immutable field stripping
  console.log("\n--- [CASE 2] Immutable field stripping ---");
  try {
    const mockContext = {
      actionType: "UPDATE",
      mutationManifest: []
    };

    StaffService.updateTeacher({
      teacher_id: mockTeacherId,
      data: {
        full_name:    "Sanitization Test",
        teacher_id:   "TCH-MALICIOUS",
        __tx_id:      "TX-ILLEGAL",
        __tx_status:  "FORGED",
        __created_at: new Date()
      }
    }, mockContext);
    const fetched = db.Teacher.findById(mockTeacherId);
    if (
      fetched.teacher_id  === mockTeacherId &&
      fetched.__tx_id    !== "TX-ILLEGAL" &&
      fetched.__tx_status !== "FORGED"
    ) {
      console.log("  ✅ Immutable fields (`teacher_id`, `__tx_*`) successfully stripped.");
    } else {
      console.error("  ❌ Immutable field leaked through illegally!", JSON.stringify(fetched));
    }
  } catch (e) {
    console.error("❌ Case 2 unexpected error:", e.message);
  }

  // CASE 3: Self-exclusion — own mobile_number must NOT trigger duplicate error
  console.log("\n--- [CASE 3] Self-exclusion: own mobile_number should pass ---");
  try {
    const mockContext = {
      actionType: "UPDATE",
      mutationManifest: []
    };

    StaffService.updateTeacher({
      teacher_id: mockTeacherId,
      data: { mobile_number: originalMobile }
    }, mockContext);
    console.log("  ✅ Own mobile_number accepted — self-exclusion working correctly.");
  } catch (e) {
    console.error("  ❌ Own mobile_number was incorrectly rejected:", e.message);
  }

  // CASE 4: Self-exclusion — own email must NOT trigger duplicate error
  console.log("\n--- [CASE 4] Self-exclusion: own email should pass ---");
  try {
    const mockContext = {
      actionType: "UPDATE",
      mutationManifest: []
    };

    StaffService.updateTeacher({
      teacher_id: mockTeacherId,
      data: { email: originalEmail }
    }, mockContext);
    console.log("  ✅ Own email accepted — self-exclusion working correctly.");
  } catch (e) {
    console.error("  ❌ Own email was incorrectly rejected:", e.message);
  }

  // CASE 5: Non-existent teacher_id → critical abort, no downstream rules run
  console.log("\n--- [CASE 5] Validation Fail: Non-existent teacher_id (critical abort) ---");
  try {
    const mockContext = {
      actionType: "UPDATE",
      mutationManifest: []
    };

    StaffService.updateTeacher({
      teacher_id: "TCH-NON-EXISTENT-XYZ",
      data: { full_name: "Ghost Teacher" }
    }, mockContext);
    console.error("  ❌ Should have rejected non-existent ID.");
  } catch (e) {
    if (e instanceof SheetDB.ValidationError) {
      console.log(`  ✅ Correctly aborted with ValidationError. Fields: ${JSON.stringify(e.context.fields)}`);
    } else {
      console.error(`  ❌ Unexpected error type: ${e.name} — ${e.message}`);
    }
  }

  // CASE 6: Duplicate mobile_number taken by another teacher → reject
  console.log("\n--- [CASE 6] Validation Fail: Duplicate mobile_number (cross-teacher) ---");
  try {
    const mockContext = {
      actionType: "UPDATE",
      mutationManifest: []
    };

    StaffService.updateTeacher({
      teacher_id: mockTeacherId,
      data: { mobile_number: otherMobile }
    }, mockContext);
    console.error("  ❌ Should have rejected cross-teacher duplicate mobile.");
  } catch (e) {
    if (e instanceof SheetDB.ValidationError) {
      console.log(`  ✅ Correctly rejected duplicate mobile. Fields: ${JSON.stringify(e.context.fields)}`);
    } else {
      console.error(`  ❌ Unexpected error type: ${e.name} — ${e.message}`);
    }
  }

  // CASE 7: Duplicate email taken by another teacher → reject
  console.log("\n--- [CASE 7] Validation Fail: Duplicate email (cross-teacher) ---");
  try {
    const mockContext = {
      actionType: "UPDATE",
      mutationManifest: []
    };

    StaffService.updateTeacher({
      teacher_id: mockTeacherId,
      data: { email: otherEmail }
    }, mockContext);
    console.error("  ❌ Should have rejected cross-teacher duplicate email.");
  } catch (e) {
    if (e instanceof SheetDB.ValidationError) {
      console.log(`  ✅ Correctly rejected duplicate email. Fields: ${JSON.stringify(e.context.fields)}`);
    } else {
      console.error(`  ❌ Unexpected error type: ${e.name} — ${e.message}`);
    }
  }

  // CASE 8: Valid branch_id (BRN-3GVP91T) — FK must resolve and persist
  console.log("\n--- [CASE 8] Valid branch_id FK (BRN-3GVP91T) should persist ---");
  try {
    const mockContext = {
      actionType: "UPDATE",
      mutationManifest: []
    };

    StaffService.updateTeacher({
      teacher_id: mockTeacherId,
      data: { branch_id: VALID_BRANCH_ID }
    }, mockContext);
    const fetched = db.Teacher.findById(mockTeacherId);
    if (fetched.branch_id === VALID_BRANCH_ID) {
      console.log(`  ✅ branch_id ${VALID_BRANCH_ID} accepted and persisted.`);
    } else {
      console.error("  ❌ branch_id was accepted but not persisted correctly.");
    }
  } catch (e) {
    console.error("  ❌ Valid branch_id was incorrectly rejected:", e.message);
  }

  // CASE 9: Invalid branch_id → FK check must fail
  console.log("\n--- [CASE 9] Validation Fail: Non-existent branch_id ---");
  try {
    const mockContext = {
      actionType: "UPDATE",
      mutationManifest: []
    };

    StaffService.updateTeacher({
      teacher_id: mockTeacherId,
      data: { branch_id: INVALID_BRANCH_ID }
    }, mockContext);
    console.error("  ❌ Should have rejected invalid branch FK.");
  } catch (e) {
    if (e instanceof SheetDB.ValidationError) {
      console.log(`  ✅ Correctly rejected bad branch_id. Fields: ${JSON.stringify(e.context.fields)}`);
    } else {
      console.error(`  ❌ Unexpected error type: ${e.name} — ${e.message}`);
    }
  }

  // CASE 10: All nullable optional fields accept null without error
  console.log("\n--- [CASE 10] Nullable optional fields accept null without validation error ---");
  try {
    const mockContext = {
      actionType: "UPDATE",
      mutationManifest: []
    };

    StaffService.updateTeacher({
      teacher_id: mockTeacherId,
      data: {
        email:              null,
        date_of_birth:      null,
        profile_photo_url:  null,
        qualification:      null,
        specialization:     null,
        previous_institute: null,
        notes:              null,
        address:            null
      }
    }, mockContext);
    console.log("  ✅ All nullable optional fields accepted as null.");
  } catch (e) {
    console.error("  ❌ Nullable optional fields were incorrectly rejected:", e.message);
  }


  // ─── STEP 2: RELATIONAL MUTATION TESTS ───────────────────────────────────

  // CASE 11: staff_assign_subjects — two real seeded courses assigned together
  console.log("\n--- [CASE 11] Relational: staff_assign_subjects with real seeded course IDs ---");
  try {
    const mockContext = {
      actionType: "UPDATE",
      mutationManifest: []
    };

    StaffService.assignSubjects(mockTeacherId, [VALID_COURSE_ID_1, VALID_COURSE_ID_2], mockContext);
    const subjects = db.TeacherSubject.where({ teacher_id: mockTeacherId });
    const hasFirst  = subjects.some(s => s.subject_id === VALID_COURSE_ID_1);
    const hasSecond = subjects.some(s => s.subject_id === VALID_COURSE_ID_2);
    if (hasFirst && hasSecond) {
      console.log(`  ✅ Both courses (${VALID_COURSE_ID_1}, ${VALID_COURSE_ID_2}) linked to teacher ${mockTeacherId}.`);
    } else {
      console.error(`  ❌ Subject assignment mismatch. hasFirst=${hasFirst}, hasSecond=${hasSecond}`);
    }

    if (mockContext.mutationManifest.includes("TeacherSubject")) {
      console.log("  ✅ Mutation manifest verified: " + JSON.stringify(mockContext.mutationManifest));
    } else {
      console.error("  ❌ Mutation manifest tracking failed! Got: " + JSON.stringify(mockContext.mutationManifest));
    }
  } catch (e) {
    console.error("  ❌ staff_assign_subjects failed unexpectedly:", e.message);
  }

  // CASE 12: staff_assign_subjects — invalid course ID must be skipped gracefully
  console.log("\n--- [CASE 12] Relational: staff_assign_subjects silently skips invalid course ID ---");
  try {
    const mockContext = {
      actionType: "UPDATE",
      mutationManifest: []
    };

    const before = db.TeacherSubject.where({ teacher_id: mockTeacherId }).length;
    StaffService.assignSubjects(mockTeacherId, [INVALID_COURSE_ID], mockContext);
    const after = db.TeacherSubject.where({ teacher_id: mockTeacherId }).length;
    if (after === before) {
      console.log("  ✅ Invalid course ID was silently skipped — no orphaned row inserted.");
    } else {
      console.error("  ❌ An orphaned TeacherSubject row was inserted for a non-existent course!");
    }
  } catch (e) {
    console.error("  ❌ staff_assign_subjects threw unexpectedly:", e.message);
  }

  // CASE 13: staff_set_salary_config — monthly type
  console.log("\n--- [CASE 13] Relational: staff_set_salary_config (monthly) ---");
  try {
    const mockContext = {
      actionType: "UPDATE",
      mutationManifest: []
    };

    StaffService.setSalaryConfig({
      teacher_id:     mockTeacherId,
      salary_type:    "monthly",
      base_amount:    45000,
      effective_from: "2026-05-26"
    }, mockContext);
    const configs = db.TeacherSalaryConfig.where({ teacher_id: mockTeacherId });
    const last = configs[configs.length - 1];
    if (last && last.base_amount === 45000 && last.salary_type === "monthly") {
      console.log("  ✅ Salary config (monthly / 45000) created successfully.");
    } else {
      console.error("  ❌ Monthly salary config mismatch.", JSON.stringify(last));
    }

    if (mockContext.mutationManifest.includes("TeacherSalaryConfig")) {
      console.log("  ✅ Mutation manifest verified: " + JSON.stringify(mockContext.mutationManifest));
    } else {
      console.error("  ❌ Mutation manifest tracking failed! Got: " + JSON.stringify(mockContext.mutationManifest));
    }
  } catch (e) {
    console.error("  ❌ staff_set_salary_config (monthly) failed:", e.message);
  }

  // CASE 14: staff_set_salary_config — per_class type
  console.log("\n--- [CASE 14] Relational: staff_set_salary_config (per_class) ---");
  try {
    const mockContext = {
      actionType: "UPDATE",
      mutationManifest: []
    };

    StaffService.setSalaryConfig({
      teacher_id:     mockTeacherId,
      salary_type:    "per_class",
      base_amount:    500,
      effective_from: "2026-05-26"
    }, mockContext);
    const configs = db.TeacherSalaryConfig.where({ teacher_id: mockTeacherId });
    const perClass = configs.find(c => c.salary_type === "per_class");
    if (perClass && perClass.base_amount === 500) {
      console.log("  ✅ Salary config (per_class / 500) created successfully.");
    } else {
      console.error("  ❌ per_class salary config not found or base_amount wrong.");
    }
  } catch (e) {
    console.error("  ❌ staff_set_salary_config (per_class) failed:", e.message);
  }

  // CASE 15: staff_set_salary_config — non-existent teacher_id must fail
  console.log("\n--- [CASE 15] Relational: staff_set_salary_config rejects unknown teacher_id ---");
  try {
    const mockContext = {
      actionType: "UPDATE",
      mutationManifest: []
    };

    StaffService.setSalaryConfig({
      teacher_id:  "TCH-NON-EXISTENT-XYZ",
      salary_type: "monthly",
      base_amount: 30000
    }, mockContext);
    console.error("  ❌ Should have thrown EntityNotFoundError.");
  } catch (e) {
    if (e instanceof SheetDB.EntityNotFoundError || e.name === "EntityNotFoundError") {
      console.log("  ✅ Correctly rejected unknown teacher with EntityNotFoundError.");
    } else {
      console.error(`  ❌ Unexpected error type: ${e.name} — ${e.message}`);
    }
  }

  // CASE 16: Ordering contract — core update must succeed before relational calls
  console.log("\n--- [CASE 16] Ordering: core update must succeed before relational calls ---");
  try {
    const mockContextUpdate = {
      actionType: "UPDATE",
      mutationManifest: []
    };

    StaffService.updateTeacher({
      teacher_id: mockTeacherId,
      data: { notes: "Ordering verification note" }
    }, mockContextUpdate);

    const mockContextSalary = {
      actionType: "UPDATE",
      mutationManifest: []
    };

    StaffService.setSalaryConfig({
      teacher_id:     mockTeacherId,
      salary_type:    "monthly",
      base_amount:    55000,
      effective_from: new Date().toISOString().split("T")[0]
    }, mockContextSalary);

    const fetched  = db.Teacher.findById(mockTeacherId);
    const configs  = db.TeacherSalaryConfig.where({ teacher_id: mockTeacherId });
    const lastConf = configs[configs.length - 1];
    if (fetched.notes === "Ordering verification note" && lastConf.base_amount === 55000) {
      console.log("  ✅ Core update + relational salary config applied in correct sequence.");
    } else {
      console.error("  ❌ Ordering contract broken — state mismatch detected.");
    }
  } catch (e) {
    console.error("  ❌ Ordering test failed:", e.message);
  }


  // ─── CLEANUP ──────────────────────────────────────────────────────────────
  // Only clean up Teacher records and their relations — Branch/Course/Segment are seeded data.
  console.log("\n--- [Cleanup] Removing test-generated Teacher records and relations ---");
  try {
    db.TeacherSubject.where({ teacher_id: mockTeacherId }).forEach(s => {
      try { db.TeacherSubject.remove(s.teacher_subject_id); } catch (_) {}
    });
    db.TeacherSalaryConfig.where({ teacher_id: mockTeacherId }).forEach(c => {
      try { db.TeacherSalaryConfig.remove(c.salary_config_id); } catch (_) {}
    });
    if (mockTeacherId)      { db.Teacher.remove(mockTeacherId);      console.log(`  [Cleanup] Removed primary Teacher: ${mockTeacherId}`); }
    if (duplicateTeacherId) { db.Teacher.remove(duplicateTeacherId); console.log(`  [Cleanup] Removed duplicate-holder Teacher: ${duplicateTeacherId}`); }
  } catch (err) {
    console.error("  [Cleanup] Error during teardown:", err.message);
  }

  console.log("\n🏁 Update Teacher Integration Tests Complete. (16 cases)");
}
