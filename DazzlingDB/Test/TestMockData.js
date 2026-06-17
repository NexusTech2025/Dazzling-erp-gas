/**
 * @file TestMockData.js
 * Centralized Testing Mock Data Registry for DazzlingDB.
 * 
 * Purpose:
 * - Provides baseline mock object templates for each database table.
 * - Exposes helper functions to generate fresh templates with overrides.
 * - Centralizes curriculum and domain setup routines to keep test files clean.
 */

const TestMockData = {
  // =========================================================================
  // 1. Core Domain Mocks
  // =========================================================================
  Branch: {
    branch_id: "BRN-MOCK-1",
    branch_name: "Mock Main Branch",
    location: "Jaipur, India",
    status: "active"
  },
  PromoCode: {
    promo_id: "PRM-MOCK-1",
    code: "MOCKDISCOUNT10",
    entity_type: "course",
    entity_id: "CRS-MOCK-PHY",
    discount_type: "percentage",
    discount_value: 10,
    max_usage: 100,
    status: "active"
  },

  // =========================================================================
  // 2. Auth Domain Mocks
  // =========================================================================
  User: {
    user_id: "USR-MOCK-1",
    username: "mockadmin",
    password_hash: "d41d8cd98f00b204e9800998ecf8427e", // Mock MD5
    password_salt: "random_salt_value",
    role: "admin",
    status: "active",
    failed_attempts: 0
  },
  Session: {
    token: "SES-MOCK-TOKEN-12345",
    user_id: "USR-MOCK-1",
    expires_at: new Date(Date.now() + 3600000).toISOString(), // +1 hour
    client_info: '{"browser":"Chrome","os":"Windows"}'
  },

  // =========================================================================
  // 3. Academic Domain Mocks
  // =========================================================================
  CourseType: {
    segment_id: "SEG-MOCK-1",
    segment_name: "Mock Academic Segment",
    entity_label: "Course",
    description: "Standard Academic Curriculum courses",
    status: "active"
  },
  Course: {
    course_id: "CRS-MOCK-PHY",
    segment_id: "SEG-MOCK-1",
    entity_type: "subject",
    name: "Mock Physics",
    short_code: "M-PHY",
    language_medium: "English",
    duration_value: 12,
    duration_unit: "months",
    base_fee: 5000,
    default_installment_count: 2,
    status: "active"
  },
  Package: {
    package_id: "PKG-MOCK-SCI",
    name: "Mock Science Bundle",
    description: "Physics, Chemistry, and Mathematics bundle package",
    target_class: "Grade 12",
    board: "CBSE",
    month: 12,
    package_fee: 12000,
    discount_percent: 20,
    status: "active"
  },

  PackageItem: {
    item_id: "PKI-MOCK-1",
    package_id: "PKG-MOCK-SCI",
    entity_type: "course",
    entity_id: "CRS-MOCK-PHY"
  },
  PackagePerk: {
    perk_id: "PRK-MOCK-1",
    package_id: "PKG-MOCK-SCI",
    perk_title: "Mock Free Lab Manuals",
    perk_description: "Access to online worksheets and mock assessment logs",
    display_order: 1
  },
  Batch: {
    batch_id: "BAT-MOCK-PHY",
    course_id: "CRS-MOCK-PHY",
    teacher_id: "TCH-MOCK-1",
    branch_id: "BRN-MOCK-1",
    batch_name: "Physics Morning Alpha",
    capacity: 30,
    batch_type: "Academy",
    status: "active"
  },
  Enrollment: {
    enrollment_id: "ENR-MOCK-1",
    student_id: "STU-MOCK-1",
    enrollment_type: "course",
    item_id: "CRS-MOCK-PHY",
    roll_number: 1,
    status: "active",
    academic_status: "active"
  },
  BatchAllocation: {
    allocation_id: "BAL-MOCK-1",
    student_id: "STU-MOCK-1",
    enrollment_id: "ENR-MOCK-1",
    course_id: "CRS-MOCK-PHY",
    batch_id: "BAT-MOCK-PHY",
    status: "active"
  },

  // =========================================================================
  // 4. Students Domain Mocks
  // =========================================================================
  Student: {
    student_id: "STU-MOCK-1",
    student_name: "Mock Student Doe",
    email: "mockstudent@test.com",
    phone: "9876543210",
    gender: "Male",
    dob: "2006-01-01",
    mother_name: "Jane Doe",
    father_name: "John Doe",
    status: "active"
  },
  Address: {
    address_id: "ADR-MOCK-1",
    student_id: "STU-MOCK-1",
    line1: "123 Mock Test Street",
    city: "Jaipur",
    state: "Rajasthan",
    pin_code: "302017",
    country: "India"
  },
  ContactInfo: {
    contact_id: "CON-MOCK-1",
    student_id: "STU-MOCK-1",
    address_id: "ADR-MOCK-1",
    email: "mockstudent@test.com",
    mobile_number: "9876543210",
    emergency_name: "Emergency Parent",
    emergency_phone: "9999999999",
    emergency_relationship: "Father"
  },
  Education: {
    education_id: "EDU-MOCK-1",
    student_id: "STU-MOCK-1",
    highest_qualification: "Class 10",
    institution_name: "Mock High School",
    year_of_passing: 2024,
    percentage_or_cgpa: "85%"
  },
  StudentLead: {
    lead_id: "SLD-MOCK-1",
    student_name: "Mock Lead Candidate",
    phone: "9111111111",
    email: "lead@mocktest.com",
    batch_id: "BAT-MOCK-PHY",
    lead_source: "walk-in",
    priority: "warm",
    status: "prospect",
    is_registered: false
  },

  // =========================================================================
  // 5. Staff Domain Mocks
  // =========================================================================
  Teacher: {
    teacher_id: "TCH-MOCK-1",
    full_name: "Mock Instructor Prof",
    mobile_number: "9222222222",
    email: "teacher@mocktest.com",
    gender: "male",
    date_of_birth: "1985-05-15",
    experience_years: 10,
    qualification: "Ph.D. in Science",
    teacher_type: "full_time",
    joining_date: "2020-01-01",
    status: "active",
    branch_id: "BRN-MOCK-1",
    prefered_time_slot: "Morning"
  },
  TeacherSubject: {
    teacher_subject_id: "TSB-MOCK-1",
    teacher_id: "TCH-MOCK-1",
    subject_id: "CRS-MOCK-PHY"
  },
  StudentAttendance: {
    attendance_id: "ATT-MOCK-1",
    student_id: "STU-MOCK-1",
    batch_id: "BAT-MOCK-PHY",
    attendance_date: "2026-06-10",
    status: "P",
    entry_time: "08:00 AM",
    exit_time: "01:00 PM",
    attendance_mode: "Manual",
    remarks: "Mock student present",
    marked_by: "TCH-MOCK-1"
  },
  TeacherAttendance: {
    attendance_id: "TAT-MOCK-1",
    teacher_id: "TCH-MOCK-1",
    attendance_date: "2026-06-10",
    status: "P",
    entry_time: "07:45 AM",
    exit_time: "02:30 PM",
    attendance_mode: "Manual",
    remarks: "Mock teacher present",
    marked_by: "USR-MOCK-1"
  },
  TeacherDocument: {
    document_id: "TDO-MOCK-1",
    teacher_id: "TCH-MOCK-1",
    document_type: "id_proof",
    file_url: "https://drive.google.com/mock_file_id"
  },
  TeacherSalaryConfig: {
    salary_config_id: "TSC-MOCK-1",
    teacher_id: "TCH-MOCK-1",
    salary_type: "monthly",
    base_amount: 50000,
    effective_from: "2026-01-01"
  },
  TeacherPaymentTransaction: {
    transaction_id: "TPT-MOCK-1",
    teacher_id: "TCH-MOCK-1",
    salary_config_id: "TSC-MOCK-1",
    payment_type: "salary",
    amount: 50000,
    payment_mode: "bank_transfer",
    transaction_date: "2026-05-25",
    reference_number: "REF-12345"
  },

  // =========================================================================
  // 6. Finance Domain Mocks
  // =========================================================================
  FeePlan: {
    fee_plan_id: "FPL-MOCK-1",
    entity_id: "CRS-MOCK-PHY",
    entity_type: "course",
    plan_name: "Mock Standard Fee Plan",
    total_fee: 5000,
    discount_allowed: true,
    installment_allowed: true
  },
  StudentFeeAccount: {
    student_fee_id: "SFA-MOCK-1",
    enrollment_id: "ENR-MOCK-1",
    fee_plan_id: "FPL-MOCK-1",
    total_fee: 5000,
    discount: 500,
    final_fee: 4500,
    amount_paid: 2000,
    balance_due: 2500,
    status: "active"
  },
  Installment: {
    installment_id: "INS-MOCK-1",
    student_fee_id: "SFA-MOCK-1",
    installment_number: 1,
    due_amount: 4500,
    paid_amount: 2000,
    late_fee_amount: 0,
    due_date: "2026-06-15",
    status: "partially_paid"
  },
  Payment: {
    payment_id: "PAY-MOCK-1",
    student_fee_id: "SFA-MOCK-1",
    installment_id: "INS-MOCK-1",
    amount_paid: 2000,
    payment_date: "2026-05-29T12:00:00Z",
    payment_method: "upi",
    transaction_reference: "TXN-MOCK-PAYMENT-1",
    status: "success"
  },
  FeeAdjustment: {
    adjustment_id: "FAD-MOCK-1",
    student_fee_id: "SFA-MOCK-1",
    adjustment_type: "manual",
    amount: 500,
    reason: "Admin approved discount override",
    created_by: "USR-MOCK-1"
  },

  ExpenseCategory: {
    category_id: "EXC-MOCK-1",
    name: "Mock Utilities",
    type: "both",
    description: "Mock utility bills like water and electricity"
  },
  StaffMember: {
    staff_id: "STF-MOCK-1",
    name: "Mock Security Guard",
    role: "security",
    status: "active",
    phone: "9111122222",
    email: "security@mocktest.com"
  },
  MoneyTransaction: {
    transaction_id: "MTX-MOCK-1",
    amount: 1000,
    type: "out",
    category_id: "EXC-MOCK-1",
    payment_method: "cash",
    payment_reference: "REF-CASH-100",
    party_type: "staff",
    party_id: "STF-MOCK-1",
    party_name: "Mock Security Guard",
    transaction_date: "2026-06-09",
    notes: "Monthly stipend payment for night shift duties",
    remarks: "Pending approval",
    created_by: "mockadmin"
  },

  // =========================================================================
  // Helper Generator Functions (Deep Copy with overrides)
  // =========================================================================
  createMock(domainKey, overrides = {}) {
    if (!this[domainKey]) {
      throw new Error(`[TestMockData] Key "${domainKey}" does not exist in mock registry.`);
    }
    // Deep copy baseline mock
    const copy = JSON.parse(JSON.stringify(this[domainKey]));
    return Object.assign(copy, overrides);
  },

  // =========================================================================
  // High-Level curriculum bootstrapper
  // =========================================================================
  setupCurriculum(db) {
    console.log("[TestMockData] Bootstrapping Curriculum Mock data...");

    // 1. Branch
    const branchId = "BRN-TEST-1";
    if (!db.Branch.findById(branchId)) {
      db.Branch.insert({ branch_id: branchId, branch_name: "Test Branch", status: "active" });
    }

    // 2. CourseType
    const courseTypeId = "SEG-TEST-1";
    if (!db.CourseType.findById(courseTypeId)) {
      db.CourseType.insert({ segment_id: courseTypeId, segment_name: "Test Academy", status: "active" });
    }

    // 3. Courses (Physics, Chemistry, Math, WebDev)
    const physicsId = "CRS-TEST-PHY";
    if (!db.Course.findById(physicsId)) {
      db.Course.insert({ course_id: physicsId, name: "Test Physics", base_fee: 5000, segment_id: courseTypeId, language_medium: "English", status: "active" });
    }
    
    const chemistryId = "CRS-TEST-CHE";
    if (!db.Course.findById(chemistryId)) {
      db.Course.insert({ course_id: chemistryId, name: "Test Chemistry", base_fee: 5000, segment_id: courseTypeId, language_medium: "English", status: "active" });
    }

    const mathId = "CRS-TEST-MAT";
    if (!db.Course.findById(mathId)) {
      db.Course.insert({ course_id: mathId, name: "Test Math", base_fee: 5000, segment_id: courseTypeId, language_medium: "English", status: "active" });
    }

    const webDevId = "CRS-TEST-WD";
    if (!db.Course.findById(webDevId)) {
      db.Course.insert({ course_id: webDevId, name: "Web Development", base_fee: 5000, segment_id: courseTypeId, language_medium: "English", status: "active" });
    }

    // 4. Batches
    const batchPhyId = "BAT-TEST-PHY";
    if (!db.Batch.findById(batchPhyId)) {
      db.Batch.insert({ batch_id: batchPhyId, batch_name: "Phy morning", course_id: physicsId, capacity: 30, batch_type: "Academy", status: "active" });
    }

    const batchCheId = "BAT-TEST-CHE";
    if (!db.Batch.findById(batchCheId)) {
      db.Batch.insert({ batch_id: batchCheId, batch_name: "Che morning", course_id: chemistryId, capacity: 30, batch_type: "Academy", status: "active" });
    }

    const batchWdId = "BAT-TEST-WD";
    if (!db.Batch.findById(batchWdId)) {
      db.Batch.insert({ batch_id: batchWdId, batch_name: "WD evening", course_id: webDevId, capacity: 30, batch_type: "Academy", status: "active" });
    }

    // 5. Package & PackageItems
    const packageId = "PKG-TEST-SCI";
    if (!db.Package.findById(packageId)) {
      db.Package.insert({ package_id: packageId, name: "Test Science Package", package_fee: 12000, status: "active" });
    }

    const piPhyId = "PKI-TEST-PHY";
    if (!db.PackageItem.findOne({ package_id: packageId, entity_type: "course", entity_id: physicsId })) {
      db.PackageItem.insert({ item_id: piPhyId, package_id: packageId, entity_type: "course", entity_id: physicsId });
    }
    const piCheId = "PKI-TEST-CHE";
    if (!db.PackageItem.findOne({ package_id: packageId, entity_type: "course", entity_id: chemistryId })) {
      db.PackageItem.insert({ item_id: piCheId, package_id: packageId, entity_type: "course", entity_id: chemistryId });
    }

    return {
      branchId,
      courseTypeId,
      physicsId,
      chemistryId,
      mathId,
      webDevId,
      batchPhyId,
      batchCheId,
      batchWdId,
      packageId
    };
  }
};
