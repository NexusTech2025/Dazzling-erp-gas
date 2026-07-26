/**
 * @file SeedMockData.js
 * Standardized, relationally aligned fixed mock dataset for API tests and sandbox hydration.
 *
 * Enforces strict DazzlingDB Architectural Axioms:
 * 1. Zero-Hardcoding Mandate: Standardized table dynamic prefixes (BRN, SEG, CRS, PKG, PKI, TCH, BAT, STU, ADR, CON, EDU, ENR, BAL, SFA, INS, PAY).
 * 2. Polymorphic Discriminators: PackageItems use explicit entity_type ("course") + entity_id.
 * 3. Complete Graph Hydration: Student entities include nested Address, ContactInfo, and Education graphs.
 * 4. Schema Compliance: All column names, data types, and enum choices strictly match DazzlingDB JSON schemas.
 */

const FixedMockData = (function () {

  // ---------------------------------------------------------------------------
  // 1. Raw Fixed Database Entities Matrix (Fully Aligned to JSON Schemas)
  // ---------------------------------------------------------------------------
  const RAW_DATA = {

    // --- 1. BRANCHES (2) ---
    branches: [
      {
        branch_id: "BRN-MAIN001",
        branch_name: "Main Campus Central",
        location: "123 Education Hub, Central Avenue, Jaipur",
        status: "active"
      },
      {
        branch_id: "BRN-NORTH02",
        branch_name: "North Extension Campus",
        location: "45 Academic Square, North Road, Jaipur",
        status: "active"
      }
    ],

    // --- 2. COURSE TYPES / SEGMENTS (2) ---
    courseTypes: [
      {
        segment_id: "SEG-ACAD001",
        segment_name: "Academic Segment",
        entity_label: "Academic Course",
        description: "Standard Senior Secondary Curriculum (CBSE/State)",
        status: "active"
      },
      {
        segment_id: "SEG-COMP002",
        segment_name: "Competitive Segment",
        entity_label: "Competitive Course",
        description: "Entrance Exam Preparation (JEE/NEET)",
        status: "active"
      }
    ],

    // --- 3. COURSES (3) ---
    courses: [
      {
        course_id: "CRS-PHY001",
        segment_id: "SEG-ACAD001",
        entity_type: "course",
        name: "Physics Grade 12",
        short_code: "PHY12",
        language_medium: "English",
        duration_value: 12,
        duration_unit: "months",
        base_fee: 15000,
        default_installment_count: 2,
        status: "active"
      },
      {
        course_id: "CRS-CHE002",
        segment_id: "SEG-ACAD001",
        entity_type: "course",
        name: "Chemistry Grade 12",
        short_code: "CHE12",
        language_medium: "English",
        duration_value: 12,
        duration_unit: "months",
        base_fee: 15000,
        default_installment_count: 2,
        status: "active"
      },
      {
        course_id: "CRS-MAT003",
        segment_id: "SEG-COMP002",
        entity_type: "course",
        name: "Mathematics Advanced Grade 12",
        short_code: "MAT12",
        language_medium: "English",
        duration_value: 12,
        duration_unit: "months",
        base_fee: 18000,
        default_installment_count: 2,
        status: "active"
      }
    ],

    // --- 4. PACKAGES (1) & PACKAGE ITEMS (3) ---
    packages: [
      {
        package_id: "PKG-PCM1201",
        name: "Grade 12 PCM Complete Bundle",
        description: "Integrated Physics, Chemistry, and Mathematics Bundle",
        target_class: "12",
        board: "CBSE",
        month: 12,
        package_fee: 40000,
        discount_percent: 10,
        status: "active"
      }
    ],
    packageItems: [
      {
        item_id: "PKI-001001",
        package_id: "PKG-PCM1201",
        entity_type: "course",
        entity_id: "CRS-PHY001"
      },
      {
        item_id: "PKI-001002",
        package_id: "PKG-PCM1201",
        entity_type: "course",
        entity_id: "CRS-CHE002"
      },
      {
        item_id: "PKI-001003",
        package_id: "PKG-PCM1201",
        entity_type: "course",
        entity_id: "CRS-MAT003"
      }
    ],

    // --- 5. TEACHERS / FACULTY (3) ---
    teachers: [
      {
        teacher_id: "TCH-PHYS001",
        branch_id: "BRN-MAIN001",
        full_name: "Dr. Alan Physics",
        gender: "male",
        mobile_number: "9111111101",
        email: "alan.physics@dazzlingdb.org",
        teacher_type: "full_time",
        experience_years: 8,
        qualification: "Ph.D. in Applied Physics",
        specialization: "Quantum Mechanics & Physics",
        joining_date: "2024-01-15",
        status: "active"
      },
      {
        teacher_id: "TCH-CHEM002",
        branch_id: "BRN-MAIN001",
        full_name: "Prof. Marie Curie",
        gender: "female",
        mobile_number: "9111111102",
        email: "marie.curie@dazzlingdb.org",
        teacher_type: "full_time",
        experience_years: 12,
        qualification: "M.Sc. Organic Chemistry",
        specialization: "Physical & Organic Chemistry",
        joining_date: "2023-08-01",
        status: "active"
      },
      {
        teacher_id: "TCH-MATH003",
        branch_id: "BRN-NORTH02",
        full_name: "Dr. Srinivasa Ramanujan",
        gender: "male",
        mobile_number: "9111111103",
        email: "ramanujan.math@dazzlingdb.org",
        teacher_type: "part_time",
        experience_years: 15,
        qualification: "M.Sc. Pure Mathematics",
        specialization: "Calculus & Algebra",
        joining_date: "2022-05-10",
        status: "active"
      }
    ],

    // --- 6. BATCHES (3) ---
    batches: [
      {
        batch_id: "BAT-PHY12A01",
        course_id: "CRS-PHY001",
        teacher_id: "TCH-PHYS001",
        branch_id: "BRN-MAIN001",
        batch_name: "Physics 12 Morning Batch A",
        batch_type: "Academy",
        capacity: 30,
        start_date: "2026-06-01",
        end_date: "2027-05-31",
        status: "active"
      },
      {
        batch_id: "BAT-CHE12A01",
        course_id: "CRS-CHE002",
        teacher_id: "TCH-CHEM002",
        branch_id: "BRN-MAIN001",
        batch_name: "Chemistry 12 Morning Batch A",
        batch_type: "Academy",
        capacity: 30,
        start_date: "2026-06-01",
        end_date: "2027-05-31",
        status: "active"
      },
      {
        batch_id: "BAT-MAT12A02",
        course_id: "CRS-MAT003",
        teacher_id: "TCH-MATH003",
        branch_id: "BRN-NORTH02",
        batch_name: "Maths 12 Evening Batch B",
        batch_type: "Competitive",
        capacity: 25,
        start_date: "2026-06-01",
        end_date: "2027-05-31",
        status: "active"
      }
    ],

    // --- 7. STUDENTS (2) & AUXILIARY GRAPHS ---
    students: [
      {
        student_id: "STU-001001",
        student_name: "John Doe",
        email: "john.doe@example.com",
        phone: "9829012345",
        gender: "Male",
        dob: "2006-05-15",
        father_name: "Robert Doe",
        mother_name: "Sarah Doe",
        status: "active"
      },
      {
        student_id: "STU-002002",
        student_name: "Jane Smith",
        email: "jane.smith@example.com",
        phone: "9829067890",
        gender: "Female",
        dob: "2006-08-22",
        father_name: "James Smith",
        mother_name: "Sarah Smith",
        status: "active"
      }
    ],
    addresses: [
      {
        address_id: "ADR-001001",
        student_id: "STU-001001",
        line1: "12 Park Street, Civil Lines",
        city: "Jaipur",
        state: "Rajasthan",
        pin_code: "302001",
        country: "India"
      },
      {
        address_id: "ADR-002002",
        student_id: "STU-002002",
        line1: "45 Lakeview Road, Vaishali",
        city: "Jaipur",
        state: "Rajasthan",
        pin_code: "302002",
        country: "India"
      }
    ],
    contactInfos: [
      {
        contact_id: "CON-001001",
        student_id: "STU-001001",
        address_id: "ADR-001001",
        email: "john.doe@example.com",
        mobile_number: "9829012345",
        emergency_name: "Robert Doe",
        emergency_phone: "9829054321",
        emergency_relationship: "Father"
      },
      {
        contact_id: "CON-002002",
        student_id: "STU-002002",
        address_id: "ADR-002002",
        email: "jane.smith@example.com",
        mobile_number: "9829067890",
        emergency_name: "Sarah Smith",
        emergency_phone: "9829009876",
        emergency_relationship: "Mother"
      }
    ],
    educations: [
      {
        education_id: "EDU-001001",
        student_id: "STU-001001",
        highest_qualification: "Class 10",
        institution_name: "St. Xavier Senior Secondary School",
        year_of_passing: 2024,
        percentage_or_cgpa: "92.5%"
      },
      {
        education_id: "EDU-002002",
        student_id: "STU-002002",
        highest_qualification: "Class 10",
        institution_name: "Modern High School",
        year_of_passing: 2024,
        percentage_or_cgpa: "95.0%"
      }
    ],

    // --- 8. ENROLLMENTS (2) & BATCH ALLOCATIONS (2) ---
    enrollments: [
      {
        enrollment_id: "ENR-001001",
        student_id: "STU-001001",
        enrollment_type: "course",
        item_id: "CRS-PHY001",
        enrollment_date: "2026-06-01",
        status: "active",
        academic_status: "active"
      },
      {
        enrollment_id: "ENR-002002",
        student_id: "STU-002002",
        enrollment_type: "package",
        item_id: "PKG-PCM1201",
        enrollment_date: "2026-06-01",
        status: "active",
        academic_status: "active"
      }
    ],
    batchAllocations: [
      {
        allocation_id: "BAL-001001",
        student_id: "STU-001001",
        enrollment_id: "ENR-001001",
        course_id: "CRS-PHY001",
        batch_id: "BAT-PHY12A01",
        status: "active"
      },
      {
        allocation_id: "BAL-002002",
        student_id: "STU-002002",
        enrollment_id: "ENR-002002",
        course_id: "CRS-MAT003",
        batch_id: "BAT-MAT12A02",
        status: "active"
      }
    ],

    // --- 9. STUDENT FEE ACCOUNTS (2) & INSTALLMENTS (4) ---
    studentFeeAccounts: [
      {
        student_fee_id: "SFA-001001",
        enrollment_id: "ENR-001001",
        total_fee: 15000,
        discount: 0,
        final_fee: 15000,
        amount_paid: 2000,
        balance_due: 13000,
        is_overdue: false,
        status: "active"
      },
      {
        student_fee_id: "SFA-002002",
        enrollment_id: "ENR-002002",
        total_fee: 40000,
        discount: 5000,
        final_fee: 35000,
        amount_paid: 0,
        balance_due: 35000,
        is_overdue: false,
        status: "active"
      }
    ],
    installments: [
      {
        installment_id: "INS-001001",
        student_fee_id: "SFA-001001",
        installment_number: 1,
        due_amount: 7500,
        paid_amount: 2000,
        due_date: "2026-07-01",
        status: "partially_paid"
      },
      {
        installment_id: "INS-001002",
        student_fee_id: "SFA-001001",
        installment_number: 2,
        due_amount: 7500,
        paid_amount: 0,
        due_date: "2026-08-01",
        status: "pending"
      },
      {
        installment_id: "INS-002001",
        student_fee_id: "SFA-002002",
        installment_number: 1,
        due_amount: 17500,
        paid_amount: 0,
        due_date: "2026-07-01",
        status: "pending"
      },
      {
        installment_id: "INS-002002",
        student_fee_id: "SFA-002002",
        installment_number: 2,
        due_amount: 17500,
        paid_amount: 0,
        due_date: "2026-08-01",
        status: "pending"
      }
    ],

    // --- 10. PAYMENTS (1) ---
    payments: [
      {
        payment_id: "PAY-001001",
        student_fee_id: "SFA-001001",
        installment_id: "INS-001001",
        amount_paid: 2000,
        payment_date: "2026-07-10T10:00:00.000Z",
        payment_method: "upi",
        transaction_reference: "UPI-9988776655",
        status: "success"
      }
    ]
  };

  // ---------------------------------------------------------------------------
  // 2. Public API Utility Functions
  // ---------------------------------------------------------------------------

  /**
   * Returns a deep clone of the complete raw mock dataset.
   * @returns {Object} Deep-copied mock entities.
   */
  function getRawData() {
    return JSON.parse(JSON.stringify(RAW_DATA));
  }

  /**
   * Generates a hydrated Student Registration API payload compatible with `student_register`.
   * @param {number} [studentIndex=0] Index of the student in RAW_DATA (0 or 1).
   * @returns {Object} Hydrated registration request payload.
   */
  function getStudentRegistrationPayload(studentIndex = 0) {
    const student = RAW_DATA.students[studentIndex] || RAW_DATA.students[0];
    const address = RAW_DATA.addresses.find(a => a.student_id === student.student_id);
    const contact = RAW_DATA.contactInfos.find(c => c.student_id === student.student_id);
    const education = RAW_DATA.educations.find(e => e.student_id === student.student_id);

    return {
      profile: {
        student_name: student.student_name,
        gender: student.gender,
        dob: student.dob,
        father_name: student.father_name,
        mother_name: student.mother_name,
        status: student.status
      },
      address: {
        line1: address.line1,
        city: address.city,
        state: address.state,
        pin_code: address.pin_code,
        country: address.country
      },
      contact: {
        mobile_number: contact.mobile_number,
        email: contact.email,
        emergency_name: contact.emergency_name,
        emergency_phone: contact.emergency_phone,
        emergency_relationship: contact.emergency_relationship
      },
      education: [
        {
          highest_qualification: education.highest_qualification,
          institution_name: education.institution_name,
          year_of_passing: education.year_of_passing,
          percentage_or_cgpa: education.percentage_or_cgpa
        }
      ]
    };
  }

  /**
   * Seeds the live database singleton (DBContext.getInstance()) with all fixed mock records.
   * Ensures high-performance bulk insertions across tables in top-down dependency order.
   */
  function seedLiveDatabase() {
    const db = DBContext.getInstance();
    const data = getRawData();

    // Top-Down Dependency Order Seeding
    if (db.Branch) db.Branch.insertMany(data.branches);
    if (db.CourseType) db.CourseType.insertMany(data.courseTypes);
    if (db.Course) db.Course.insertMany(data.courses);
    if (db.Package) db.Package.insertMany(data.packages);
    if (db.PackageItem) db.PackageItem.insertMany(data.packageItems);

    if (db.Teacher) db.Teacher.insertMany(data.teachers);
    if (db.Batch) db.Batch.insertMany(data.batches);

    if (db.Student) db.Student.insertMany(data.students);
    if (db.Address) db.Address.insertMany(data.addresses);
    if (db.ContactInfo) db.ContactInfo.insertMany(data.contactInfos);
    if (db.Education) db.Education.insertMany(data.educations);

    if (db.Enrollment) db.Enrollment.insertMany(data.enrollments);
    if (db.BatchAllocation) db.BatchAllocation.insertMany(data.batchAllocations);
    if (db.StudentFeeAccount) db.StudentFeeAccount.insertMany(data.studentFeeAccounts);
    if (db.Installment) db.Installment.insertMany(data.installments);
    if (db.Payment) db.Payment.insertMany(data.payments);

    console.log("✅ Live Database successfully seeded with Fixed Mock Data.");
  }

  /**
   * Purges all fixed mock records from the live database singleton in strict reverse-topological order.
   */
  function purgeFromLiveDatabase() {
    const db = DBContext.getInstance();
    const data = RAW_DATA;

    // Strict Reverse-Topological LIFO Teardown
    try {
      data.payments.forEach(p => db.Payment && db.Payment.remove(p.payment_id));
      data.installments.forEach(i => db.Installment && db.Installment.remove(i.installment_id));
      data.studentFeeAccounts.forEach(sfa => db.StudentFeeAccount && db.StudentFeeAccount.remove(sfa.student_fee_id));
      data.batchAllocations.forEach(ba => db.BatchAllocation && db.BatchAllocation.remove(ba.allocation_id));
      data.enrollments.forEach(e => db.Enrollment && db.Enrollment.remove(e.enrollment_id));

      data.educations.forEach(ed => db.Education && db.Education.remove(ed.education_id));
      data.contactInfos.forEach(c => db.ContactInfo && db.ContactInfo.remove(c.contact_id));
      data.addresses.forEach(a => db.Address && db.Address.remove(a.address_id));
      data.students.forEach(s => db.Student && db.Student.remove(s.student_id));

      data.batches.forEach(b => db.Batch && db.Batch.remove(b.batch_id));
      data.teachers.forEach(t => db.Teacher && db.Teacher.remove(t.teacher_id));

      data.packageItems.forEach(pi => db.PackageItem && db.PackageItem.remove(pi.item_id));
      data.packages.forEach(p => db.Package && db.Package.remove(p.package_id));
      data.courses.forEach(c => db.Course && db.Course.remove(c.course_id));
      data.courseTypes.forEach(ct => db.CourseType && db.CourseType.remove(ct.segment_id));
      data.branches.forEach(b => db.Branch && db.Branch.remove(b.branch_id));

      console.log("🧹 Fixed Mock Data purged successfully from Live Database.");
    } catch (err) {
      console.warn("⚠️ Partial warning during mock data purge: " + err.message);
    }
  }

  return {
    getRawData,
    getStudentRegistrationPayload,
    seedLiveDatabase,
    purgeFromLiveDatabase
  };

})();