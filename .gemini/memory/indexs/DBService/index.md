# DBServices Symbol Index

This index lists all classes, objects, methods, and functions within the `DazzlingDB/DBServices/` directory to enable rapid symbol lookup and precise file chunk loading.

---

## 1. AcademicService ([AcademicService.js](file:///e:/NAST/Dazzling/GAS/DazzlingDB/DBServices/AcademicService.js))
*Domain Service for curriculum, courses, batches, and package management.*

### Symbol Index
* **`createCourseType(payload, context)`**
  * **Goal:** Registers a new curriculum segment/category (e.g., `'Academic'`, `'Vocational'`).
  * **When to use:** When onboarding a new program stream.
* **`createCourse(payload, context)`**
  * **Goal:** Creates a Course or Subject entry.
  * **When to use:** When adding a new class subject under a program segment.
* **`createBatch(payload, context)`**
  * **Goal:** Provisions a new Batch and checks Course, Teacher, and Branch referential integrity.
  * **When to use:** When scheduling a new batch/class cohort.
* **`createPackage(payload, context)`**
  * **Goal:** Transactionally creates a bundled package with nested courses and perks.
  * **When to use:** During package creation flow to ensure atomic, all-or-nothing mutations.
* **`updatePackage(payload, context)`**
  * **Goal:** Updates package details and syncs/overwrites nested courses and perks.
  * **When to use:** Mutating package price, details, or bundled curriculum.
* **`deletePackage(packageId, context)`**
  * **Goal:** Transactionally deletes a package, cascading deletion to perks/items, restricted by active enrollments.
  * **When to use:** Removing a package from the system.
* **`enrollStudent(payload, context)`**
  * **Goal:** Registers student enrollment in a course or batch.
  * **When to use:** Enrolling students during onboarding or package expansions.

---

## 2. StudentService ([StudentService.js](file:///e:/NAST/Dazzling/GAS/DazzlingDB/DBServices/StudentService.js))
*Domain Service for students, leads, billing/payment accounts, and attendance tracking.*

### Symbol Index
* **`registerStudent(payload, context)`**
  * **Goal:** Orchestrates multi-table student onboarding within a transaction block.
  * **When to use:** Registering a new student profile and initializing financial accounts.
* **`getProfile(studentId)`**
  * **Goal:** Returns a consolidated, hydrated student profile including address, contact, and billing details.
  * **When to use:** Retrieving complete student profiles for display or invoicing.
* **`addStudentLead(leadData, context)`**
  * **Goal:** Registers a new student lead profile.
  * **When to use:** Recording initial customer/student inquiries.
* **`processSubjectWithdrawal(studentId, courseId, context)`**
  * **Goal:** Withdraws a student from a course and cleans up seating/enrollment records.
  * **When to use:** Processing a student's request to drop a course.
* **`upgradeToPackage(payload, context)`**
  * **Goal:** Upgrades existing individual course enrollments into a combined Package.
  * **When to use:** Upgrading student curriculum bundles.
* **`checkAccessStatus(studentId, courseId)`**
  * **Goal:** Validates student class access permissions.
  * **When to use:** Attendance logging or class seat verification.
* **`suspendOverdueAccess(studentId, courseId, context)`**
  * **Goal:** Suspends access if payments are overdue.
  * **When to use:** Automating payment-based access restrictions.
* **`markAttendance(payload, context)`**
  * **Goal:** Registers daily attendance for a single student.
  * **When to use:** Attendance logging workflows.
* **`markAttendanceBulk(payload, context)`**
  * **Goal:** Bulk logs attendance for a cohort.
  * **When to use:** Teacher classroom portals logging daily attendance.
* **`queryAttendance(payload)`**
  * **Goal:** Queries attendance records based on filters.
  * **When to use:** Compiling attendance reports.

---

## 3. StaffService ([StaffService.js](file:///e:/NAST/Dazzling/GAS/DazzlingDB/DBServices/StaffService.js))
*Domain Service for staff onboarding, subject mappings, salary configuration, and payroll registers.*

### Symbol Index
* **`onboardTeacher(payload, context)`**
  * **Goal:** Registers a new teacher profile.
  * **When to use:** Onboarding new teaching staff.
* **`assignSubjects(teacherId, subjectIds, context)`**
  * **Goal:** Maps subjects/courses to a teacher.
  * **When to use:** Setting or updating a teacher's assigned subjects.
* **`setSalaryConfig(payload, context)`**
  * **Goal:** Sets recurring/temporal salary configurations and prevents overlapping active configurations.
  * **When to use:** Assigning salary rules to teachers or staff.
* **`getSalaryConfigs(entityId, entityType, context)`**
  * **Goal:** Retrieves salary rules for a staff/teacher profile.
  * **When to use:** Payroll calculation or configurations checking.
* **`getSalaryConfig(entityId, entityType, salaryConfigId, context)`**
  * **Goal:** Fetches a specific salary rule.
  * **When to use:** Inspecting a specific salary item.
* **`updateSalaryConfig(entityId, entityType, salaryConfigId, updateData, context)`**
  * **Goal:** Updates salary rules.
  * **When to use:** Modifying contract terms.
* **`deleteSalaryConfig(entityId, entityType, salaryConfigId, context)`**
  * **Goal:** Evicts a salary rule.
  * **When to use:** Removing configuration from ledger.
* **`markAttendance(payload, context)`**
  * **Goal:** Records teacher/staff daily attendance.
  * **When to use:** HR attendance workflows.
* **`markAttendanceBulk(payload, context)`**
  * **Goal:** Bulk logs staff daily attendance.
  * **When to use:** Mass staff check-in procedures.
* **`queryAttendance(payload)`**
  * **Goal:** Filters staff attendance.
  * **When to use:** Compiling staff payroll/hours logs.
* **`recordPayment(payload, context)`**
  * **Goal:** Logs salary payment transactions to the General Ledger (`MoneyTransaction`).
  * **When to use:** Paying monthly salaries.
* **`addDocument(teacherId, documentPayload, context)`**
  * **Goal:** Associates drive document references with a teacher.
  * **When to use:** Storing contracts or ID proofs.
* **`updateTeacher(payload, context)`**
  * **Goal:** Modifies teacher details.
  * **When to use:** Teacher updates form submission.

---

## 4. TeacherSalaryCalculationEngine ([StaffService_TeacherSalaryCalculationEngine.js](file:///e:/NAST/Dazzling/GAS/DazzlingDB/DBServices/StaffService_TeacherSalaryCalculationEngine.js))
*Computational logic for staff/teacher payroll processing.*

### Symbol Index
* **`calculateSalary(teacherId, billingMonth, context)`**
  * **Goal:** Resolves prorated temporal base salaries, session counts, and dynamic revenue shares for a month.
  * **When to use:** Monthly payroll run calculations.

---

## 5. CoreService ([CoreService.js](file:///e:/NAST/Dazzling/GAS/DazzlingDB/DBServices/CoreService.js))
*Core configuration management services.*

### Symbol Index
* **`createBranch(payload)`**
  * **Goal:** Registers a physical branch.
  * **When to use:** Setting up a new franchise or office.
* **`updateBranch(branchId, payload)`**
  * **Goal:** Updates branch metadata.
  * **When to use:** Modifying branch details.
* **`createPromoCode(payload)`**
  * **Goal:** Registers a promotion code.
  * **When to use:** Setting up discounts.
* **`validatePromoCode(code, entityType, entityId)`**
  * **Goal:** Validates a promo code.
  * **When to use:** Applying discounts on checkout.

---

## 6. TestService ([TestService.js](file:///e:/NAST/Dazzling/GAS/DazzlingDB/DBServices/TestService.js))
*Academic assessment and gradebook service.*

### Symbol Index
* **`createTest(payload, context)`**
  * **Goal:** Registers an academic exam/test.
  * **When to use:** Scheduling classroom tests.
* **`saveTestMarksBulk(payload, context)`**
  * **Goal:** Bulk updates student test marks.
  * **When to use:** Submitting exam marks sheet.
* **`queryTestReport(payload)`**
  * **Goal:** Resolves assessment scores reports.
  * **When to use:** Printing progress reports.

---

## 7. DBContext ([DBContext.js](file:///e:/NAST/Dazzling/GAS/DazzlingDB/DBServices/DBContext.js))
*Database connection lifecycle manager.*

### Symbol Index
* **`DBContext.getInstance()`**
  * **Goal:** Singleton access to active database repositories.
  * **When to use:** Performing direct ORM operations.

---

## 8. DazzlingDateTime ([DazzlingDateTime.js](file:///e:/NAST/Dazzling/GAS/DazzlingDB/DBServices/DazzlingDateTime.js))
*Helper class managing timezone conversions for Google Sheets.*
