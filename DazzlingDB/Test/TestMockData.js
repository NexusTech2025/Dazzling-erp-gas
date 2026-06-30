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
    entity_type: "Teacher",
    entity_id: "TCH-MOCK-1",
    salary_config_type: "recurring_monthly",
    effective_from: "2026-01-01",
    effective_to: null,
    rate_type: "monthly",
    base_value: 50000.00,
    scope_type: "global",
    scope_id: null,
    contract_status: "active",
    settlement_state: "unsettled"
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
    let branch = db.Branch.findOne({ branch_name: "Test Branch" });
    if (!branch) {
      branch = db.Branch.insert({ branch_name: "Test Branch", status: "active" });
    }
    const branchId = branch.branch_id;

    // 2. CourseType
    let courseType = db.CourseType.findOne({ segment_name: "Test Academy" });
    if (!courseType) {
      courseType = db.CourseType.insert({ segment_name: "Test Academy", status: "active" });
    }
    const courseTypeId = courseType.segment_id;

    // 3. Courses (Physics, Chemistry, Math, WebDev)
    let physics = db.Course.findOne({ name: "Test Physics" });
    if (!physics) {
      physics = db.Course.insert({ name: "Test Physics", base_fee: 5000, segment_id: courseTypeId, language_medium: "English", status: "active" });
    }
    const physicsId = physics.course_id;
    
    let chemistry = db.Course.findOne({ name: "Test Chemistry" });
    if (!chemistry) {
      chemistry = db.Course.insert({ name: "Test Chemistry", base_fee: 5000, segment_id: courseTypeId, language_medium: "English", status: "active" });
    }
    const chemistryId = chemistry.course_id;

    let math = db.Course.findOne({ name: "Test Math" });
    if (!math) {
      math = db.Course.insert({ name: "Test Math", base_fee: 5000, segment_id: courseTypeId, language_medium: "English", status: "active" });
    }
    const mathId = math.course_id;

    let webDev = db.Course.findOne({ name: "Web Development" });
    if (!webDev) {
      webDev = db.Course.insert({ name: "Web Development", base_fee: 5000, segment_id: courseTypeId, language_medium: "English", status: "active" });
    }
    const webDevId = webDev.course_id;

    // 4. Batches
    let batchPhy = db.Batch.findOne({ batch_name: "Phy morning" });
    if (!batchPhy) {
      batchPhy = db.Batch.insert({ batch_name: "Phy morning", course_id: physicsId, capacity: 30, batch_type: "Academy", status: "active" });
    }
    const batchPhyId = batchPhy.batch_id;

    let batchChe = db.Batch.findOne({ batch_name: "Che morning" });
    if (!batchChe) {
      batchChe = db.Batch.insert({ batch_name: "Che morning", course_id: chemistryId, capacity: 30, batch_type: "Academy", status: "active" });
    }
    const batchCheId = batchChe.batch_id;

    let batchWd = db.Batch.findOne({ batch_name: "WD evening" });
    if (!batchWd) {
      batchWd = db.Batch.insert({ batch_name: "WD evening", course_id: webDevId, capacity: 30, batch_type: "Academy", status: "active" });
    }
    const batchWdId = batchWd.batch_id;

    // 5. Package & PackageItems
    let pkg = db.Package.findOne({ name: "Test Science Package" });
    if (!pkg) {
      pkg = db.Package.insert({ name: "Test Science Package", package_fee: 12000, status: "active" });
    }
    const packageId = pkg.package_id;

    let piPhy = db.PackageItem.findOne({ package_id: packageId, entity_type: "course", entity_id: physicsId });
    if (!piPhy) {
      piPhy = db.PackageItem.insert({ package_id: packageId, entity_type: "course", entity_id: physicsId });
    }

    let piChe = db.PackageItem.findOne({ package_id: packageId, entity_type: "course", entity_id: chemistryId });
    if (!piChe) {
      piChe = db.PackageItem.insert({ package_id: packageId, entity_type: "course", entity_id: chemistryId });
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
