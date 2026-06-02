
```log
8:10:22 PM	Notice	Execution started
8:10:24 PM	Info	[DBContext] RESOLVED ENVIRONMENT: 'DEVELOPMENT'
8:10:24 PM	Info	[DBContext] TARGET ROOT FOLDER ID: '1eyTm-n2AUvcVS_Ipus7ApC4b0sCl8Q8I'
8:10:24 PM	Info	[App] Registering database custom validators...
8:10:24 PM	Info	[ValidationRegistry] Successfully registered handler: validateEmail
8:10:24 PM	Info	[App] Registering polymorphic mappings...
8:10:24 PM	Info	[PolymorphicRegistry] Registered mapping: 'course' -> 'Course'
8:10:24 PM	Info	[PolymorphicRegistry] Registered mapping: 'package' -> 'Package'
8:10:24 PM	Info	[PolymorphicRegistry] Registered mapping: 'subject' -> 'Course'
8:10:24 PM	Info	[DBContext] Bootstrapping SheetDB for DazzlingDB...
8:10:24 PM	Info	[SheetDB] Initializing Database: DazzlingDB (v2.1.1)
8:10:24 PM	Info	[ModelRegistry] Initializing Dynamic Models...
8:10:24 PM	Info	[ModelRegistry] Successfully generated 28 Models.
8:10:24 PM	Info	[SheetDB] Success: 28 repositories generated.
8:10:24 PM	Info	[ValidationRegistry] Registry locked. Mutations are now blocked.
8:10:24 PM	Info	=== STARTING PHASE 1: STUDENT REGISTRATION INTEGRATION TESTS ===
8:10:24 PM	Info	[TestMockData] Bootstrapping Curriculum Mock data...
8:10:44 PM	Info	
--- [P1-TC-1] Testing Strict Package Batch Verification ---
8:10:44 PM	Info	[StudentService] Registering new student: Alice Missing Batch
8:10:44 PM	Info	✅ Validation successfully caught missing batch: Package registration incomplete. Missing batch selections for: Test Chemistry
8:10:44 PM	Info	
--- [P1-TC-2] Testing Multi-Enrollment Registration & Proportional Splits ---
8:10:44 PM	Info	[StudentService] Registering new student: Bob Successful Registration
8:10:44 PM	Info	[BaseModel:Student] Starting relational checks across 5 relationship declarations...
8:10:44 PM	Info	[BaseModel:Student] Relational checking finished. Total relationship errors: 0
8:10:44 PM	Info	[BaseModel] Attempting insert for new Student...
8:10:46 PM	Info	[BaseModel] Successfully inserted new Student (ID: STU-RD4GW23).
8:10:46 PM	Info	[BaseModel:Address] Starting relational checks across 1 relationship declarations...
8:10:46 PM	Info	[BaseModel:Address] Relational checking finished. Total relationship errors: 0
8:10:46 PM	Info	[BaseModel] Attempting insert for new Address...
8:10:47 PM	Info	[BaseModel] Successfully inserted new Address (ID: ADR-U5VC19A).
8:10:47 PM	Info	[BaseModel:ContactInfo] Starting relational checks across 2 relationship declarations...
8:10:47 PM	Info	[BaseModel:ContactInfo] Relational checking finished. Total relationship errors: 0
8:10:47 PM	Info	[BaseModel] Attempting insert for new ContactInfo...
8:10:47 PM	Info	[BaseModel] Successfully inserted new ContactInfo (ID: CON-MDVDVGT).
8:10:47 PM	Info	[BaseModel:Education] Starting relational checks across 1 relationship declarations...
8:10:47 PM	Info	[PrimaryKeyCache] Cache Miss: Compiling active keys for table 'Student'...
8:10:48 PM	Info	[PrimaryKeyCache] Cached 9 keys for table 'Student'.
8:10:48 PM	Info	[Relation:belongsTo] Relational check PASSED for 'student_id' -> 'Student' (ID: 'STU-RD4GW23')
8:10:48 PM	Info	[BaseModel:Education] Relational checking finished. Total relationship errors: 0
8:10:48 PM	Info	[BaseModel] Attempting insert for new Education...
8:10:48 PM	Info	[BaseModel] Successfully inserted new Education (ID: EDU-BNX4WKK).
8:10:49 PM	Info	[BaseModel:Enrollment] Starting relational checks across 3 relationship declarations...
8:10:49 PM	Info	[Relation:belongsTo] Relational check PASSED for 'student_id' -> 'Student' (ID: 'STU-RD4GW23')
8:10:49 PM	Info	[PrimaryKeyCache] Cache Miss: Compiling active keys for table 'Package'...
8:10:49 PM	Info	[PrimaryKeyCache] Cached 20 keys for table 'Package'.
8:10:49 PM	Info	[Relation:belongsToPolymorphic] Relational check PASSED for 'item_id' -> 'Package' (ID: 'PKG-TEST-SCI')
8:10:49 PM	Info	[BaseModel:Enrollment] Relational checking finished. Total relationship errors: 0
8:10:49 PM	Info	[BaseModel] Attempting insert for new Enrollment...
8:10:49 PM	Info	[BaseModel] Successfully inserted new Enrollment (ID: ENR-NDDZO3O).
8:10:51 PM	Info	[BaseModel:BatchAllocation] Starting relational checks across 4 relationship declarations...
8:10:51 PM	Info	[Relation:belongsTo] Relational check PASSED for 'student_id' -> 'Student' (ID: 'STU-RD4GW23')
8:10:51 PM	Info	[PrimaryKeyCache] Cache Miss: Compiling active keys for table 'Enrollment'...
8:10:51 PM	Info	[PrimaryKeyCache] Cached 17 keys for table 'Enrollment'.
8:10:51 PM	Info	[Relation:belongsTo] Relational check PASSED for 'enrollment_id' -> 'Enrollment' (ID: 'ENR-NDDZO3O')
8:10:51 PM	Info	[PrimaryKeyCache] Cache Miss: Compiling active keys for table 'Course'...
8:10:52 PM	Info	[PrimaryKeyCache] Cached 171 keys for table 'Course'.
8:10:52 PM	Info	[Relation:belongsTo] Relational check PASSED for 'course_id' -> 'Course' (ID: 'CRS-TEST-PHY')
8:10:52 PM	Info	[PrimaryKeyCache] Cache Miss: Compiling active keys for table 'Batch'...
8:10:52 PM	Info	[PrimaryKeyCache] Cached 10 keys for table 'Batch'.
8:10:52 PM	Info	[Relation:belongsTo] Relational check PASSED for 'batch_id' -> 'Batch' (ID: 'BAT-TEST-PHY')
8:10:52 PM	Info	[BaseModel:BatchAllocation] Relational checking finished. Total relationship errors: 0
8:10:52 PM	Info	[BaseModel] Attempting insert for new BatchAllocation...
8:10:53 PM	Info	[BaseModel] Successfully inserted new BatchAllocation (ID: BAL-59GVAGT).
8:10:53 PM	Info	[BaseModel:BatchAllocation] Starting relational checks across 4 relationship declarations...
8:10:53 PM	Info	[Relation:belongsTo] Relational check PASSED for 'student_id' -> 'Student' (ID: 'STU-RD4GW23')
8:10:53 PM	Info	[Relation:belongsTo] Relational check PASSED for 'enrollment_id' -> 'Enrollment' (ID: 'ENR-NDDZO3O')
8:10:53 PM	Info	[Relation:belongsTo] Relational check PASSED for 'course_id' -> 'Course' (ID: 'CRS-TEST-CHE')
8:10:53 PM	Info	[Relation:belongsTo] Relational check PASSED for 'batch_id' -> 'Batch' (ID: 'BAT-TEST-CHE')
8:10:53 PM	Info	[BaseModel:BatchAllocation] Relational checking finished. Total relationship errors: 0
8:10:53 PM	Info	[BaseModel] Attempting insert for new BatchAllocation...
8:10:53 PM	Info	[BaseModel] Successfully inserted new BatchAllocation (ID: BAL-8INZDHK).
8:10:53 PM	Info	[BaseModel:StudentFeeAccount] Starting relational checks across 2 relationship declarations...
8:10:53 PM	Info	[PrimaryKeyCache] Cache Miss: Compiling active keys for table 'FeePlan'...
8:10:53 PM	Info	[PrimaryKeyCache] Cached 2 keys for table 'FeePlan'.
8:10:53 PM	Info	[Relation:belongsTo] Relational check PASSED for 'fee_plan_id' -> 'FeePlan' (ID: 'FPL-PKG-TEST-SCI-DEFAULT')
8:10:53 PM	Info	[BaseModel:StudentFeeAccount] Relational checking finished. Total relationship errors: 0
8:10:53 PM	Info	[BaseModel] Attempting insert for new StudentFeeAccount...
8:10:54 PM	Info	[BaseModel] Successfully inserted new StudentFeeAccount (ID: SFA-GI91WOI).
8:10:54 PM	Info	[BaseModel:Installment] Starting relational checks across 1 relationship declarations...
8:10:54 PM	Info	[PrimaryKeyCache] Cache Miss: Compiling active keys for table 'StudentFeeAccount'...
8:10:54 PM	Info	[PrimaryKeyCache] Cached 5 keys for table 'StudentFeeAccount'.
8:10:54 PM	Info	[Relation:belongsTo] Relational check PASSED for 'student_fee_id' -> 'StudentFeeAccount' (ID: 'SFA-GI91WOI')
8:10:54 PM	Info	[BaseModel:Installment] Relational checking finished. Total relationship errors: 0
8:10:54 PM	Info	[BaseModel] Attempting insert for new Installment...
8:10:54 PM	Info	[BaseModel] Successfully inserted new Installment (ID: INS-WBCJX7K).
8:10:54 PM	Info	[BaseModel:Installment] Starting relational checks across 1 relationship declarations...
8:10:54 PM	Info	[Relation:belongsTo] Relational check PASSED for 'student_fee_id' -> 'StudentFeeAccount' (ID: 'SFA-GI91WOI')
8:10:54 PM	Info	[BaseModel:Installment] Relational checking finished. Total relationship errors: 0
8:10:54 PM	Info	[BaseModel] Attempting insert for new Installment...
8:10:55 PM	Info	[BaseModel] Successfully inserted new Installment (ID: INS-TOHLPUB).
8:10:55 PM	Info	[BaseModel:Payment] Starting relational checks across 2 relationship declarations...
8:10:55 PM	Info	[PrimaryKeyCache] Cache Miss: Compiling active keys for table 'Installment'...
8:10:56 PM	Info	[PrimaryKeyCache] Cached 19 keys for table 'Installment'.
8:10:56 PM	Info	[Relation:belongsTo] Relational check PASSED for 'installment_id' -> 'Installment' (ID: 'INS-WBCJX7K')
8:10:56 PM	Info	[Relation:belongsTo] Relational check PASSED for 'student_fee_id' -> 'StudentFeeAccount' (ID: 'SFA-GI91WOI')
8:10:56 PM	Info	[BaseModel:Payment] Relational checking finished. Total relationship errors: 0
8:10:56 PM	Info	[BaseModel] Attempting insert for new Payment...
8:10:56 PM	Info	[BaseModel] Successfully inserted new Payment (ID: PAY-A5TY8AT).
8:10:56 PM	Info	[BaseModel:Enrollment] Starting relational checks across 3 relationship declarations...
8:10:56 PM	Info	[Relation:belongsTo] Relational check PASSED for 'student_id' -> 'Student' (ID: 'STU-RD4GW23')
8:10:56 PM	Info	[Relation:belongsToPolymorphic] Relational check PASSED for 'item_id' -> 'Course' (ID: 'CRS-TEST-WD')
8:10:56 PM	Info	[BaseModel:Enrollment] Relational checking finished. Total relationship errors: 0
8:10:56 PM	Info	[BaseModel] Attempting insert for new Enrollment...
8:10:57 PM	Info	[BaseModel] Successfully inserted new Enrollment (ID: ENR-DQM5S0S).
8:10:57 PM	Info	[BaseModel:BatchAllocation] Starting relational checks across 4 relationship declarations...
8:10:57 PM	Info	[Relation:belongsTo] Relational check PASSED for 'student_id' -> 'Student' (ID: 'STU-RD4GW23')
8:10:57 PM	Info	[Relation:belongsTo] Relational check PASSED for 'enrollment_id' -> 'Enrollment' (ID: 'ENR-DQM5S0S')
8:10:57 PM	Info	[Relation:belongsTo] Relational check PASSED for 'course_id' -> 'Course' (ID: 'CRS-TEST-WD')
8:10:57 PM	Info	[Relation:belongsTo] Relational check PASSED for 'batch_id' -> 'Batch' (ID: 'BAT-TEST-WD')
8:10:57 PM	Info	[BaseModel:BatchAllocation] Relational checking finished. Total relationship errors: 0
8:10:57 PM	Info	[BaseModel] Attempting insert for new BatchAllocation...
8:10:58 PM	Info	[BaseModel] Successfully inserted new BatchAllocation (ID: BAL-R97FBTX).
8:10:58 PM	Info	[BaseModel:StudentFeeAccount] Starting relational checks across 2 relationship declarations...
8:10:58 PM	Info	[Relation:belongsTo] Relational check PASSED for 'fee_plan_id' -> 'FeePlan' (ID: 'FPL-CRS-TEST-WD-DEFAULT')
8:10:58 PM	Info	[BaseModel:StudentFeeAccount] Relational checking finished. Total relationship errors: 0
8:10:58 PM	Info	[BaseModel] Attempting insert for new StudentFeeAccount...
8:10:58 PM	Info	[BaseModel] Successfully inserted new StudentFeeAccount (ID: SFA-97IYFFS).
8:10:58 PM	Info	[BaseModel:Installment] Starting relational checks across 1 relationship declarations...
8:10:58 PM	Info	[Relation:belongsTo] Relational check PASSED for 'student_fee_id' -> 'StudentFeeAccount' (ID: 'SFA-97IYFFS')
8:10:58 PM	Info	[BaseModel:Installment] Relational checking finished. Total relationship errors: 0
8:10:58 PM	Info	[BaseModel] Attempting insert for new Installment...
8:11:00 PM	Info	[BaseModel] Successfully inserted new Installment (ID: INS-AVPNBA0).
8:11:00 PM	Info	[BaseModel:Installment] Starting relational checks across 1 relationship declarations...
8:11:00 PM	Info	[Relation:belongsTo] Relational check PASSED for 'student_fee_id' -> 'StudentFeeAccount' (ID: 'SFA-97IYFFS')
8:11:00 PM	Info	[BaseModel:Installment] Relational checking finished. Total relationship errors: 0
8:11:00 PM	Info	[BaseModel] Attempting insert for new Installment...
8:11:00 PM	Info	[BaseModel] Successfully inserted new Installment (ID: INS-VG3GQ5O).
8:11:00 PM	Info	[BaseModel:Payment] Starting relational checks across 2 relationship declarations...
8:11:00 PM	Info	[Relation:belongsTo] Relational check PASSED for 'installment_id' -> 'Installment' (ID: 'INS-AVPNBA0')
8:11:00 PM	Info	[Relation:belongsTo] Relational check PASSED for 'student_fee_id' -> 'StudentFeeAccount' (ID: 'SFA-97IYFFS')
8:11:00 PM	Info	[BaseModel:Payment] Relational checking finished. Total relationship errors: 0
8:11:00 PM	Info	[BaseModel] Attempting insert for new Payment...
8:11:00 PM	Info	[BaseModel] Successfully inserted new Payment (ID: PAY-GPYYAF7).
8:11:00 PM	Info	[StudentService] Registration successful for ID: STU-RD4GW23
8:11:00 PM	Info	✅ Student registered with ID: STU-RD4GW23
8:11:01 PM	Info	Active enrollments created: 2 (Expected: 2 - Package and WebDev)
8:11:01 PM	Info	✅ Package Enrollment metadata snapshot: {"course_fees":{"CRS-TEST-PHY":5000,"CRS-TEST-CHE":5000}}
8:11:01 PM	Info	Active batch allocations created: 3 (Expected: 3 - Physics, Chemistry, and WebDev)
8:11:01 PM	Info	Physics allocation links to Package Enrollment: true
8:11:01 PM	Info	Chemistry allocation links to Package Enrollment: true
8:11:02 PM	Info	Fee Accounts created: 2 (Expected: 2 - Package and Standalone Course)
8:11:02 PM	Info	
--- Validating Proportional ledger math splits ---
8:11:02 PM	Info	Package SFA - Total: 12000 (Exp: 12000), Discount: 1200 (Exp: 1200), Final: 10800 (Exp: 10800), Paid: 4800 (Exp: 4800), Balance: 6000 (Exp: 6000)
8:11:02 PM	Info	✅ Proportional ledger splits for Package SFA are 100% correct.
8:11:02 PM	Info	WebDev SFA - Total: 5000 (Exp: 5000), Discount: 500 (Exp: 500), Final: 4500 (Exp: 4500), Paid: 2000 (Exp: 2000), Balance: 2500 (Exp: 2500)
8:11:02 PM	Info	✅ Proportional ledger splits for Standalone SFA are 100% correct.
8:11:02 PM	Info	Package Installments count: 2 (Expected: 2)
8:11:02 PM	Info	Package Installment 1 - Due: 6000 (Exp: 6000), Paid: 4800 (Exp: 4800)
8:11:02 PM	Info	Package Installment 2 - Due: 6000 (Exp: 6000), Paid: 0 (Exp: 0)
8:11:02 PM	Info	✅ Proportional splits for Package installments are correct.
8:11:02 PM	Info	Package Payments count: 1 (Expected: 1)
8:11:02 PM	Info	✅ Proportional split for Package payment row matches.
8:11:03 PM	Info	Standalone Payments count: 1 (Expected: 1)
8:11:03 PM	Info	✅ Proportional split for Standalone payment row matches.
8:11:03 PM	Info	
=== PHASE 1: STUDENT REGISTRATION TESTS COMPLETED SUCCESSFULLY ===
8:11:04 PM	Notice	Execution completed
```
===========================================================================================================

## Test logs of Acadmic_PackageTests

```log
4:15:40 PM	Notice	Execution started
4:15:43 PM	Info	🚀 Starting Academic Package Integration Tests...
4:15:43 PM	Info	[DBContext] RESOLVED ENVIRONMENT: 'DEVELOPMENT'
4:15:43 PM	Info	[DBContext] TARGET ROOT FOLDER ID: '1eyTm-n2AUvcVS_Ipus7ApC4b0sCl8Q8I'
4:15:43 PM	Info	[App] Registering database custom validators...
4:15:43 PM	Info	[ValidationRegistry] Successfully registered handler: validateEmail
4:15:43 PM	Info	[App] Registering polymorphic mappings...
4:15:43 PM	Info	[PolymorphicRegistry] Registered mapping: 'course' -> 'Course'
4:15:43 PM	Info	[PolymorphicRegistry] Registered mapping: 'package' -> 'Package'
4:15:43 PM	Info	[PolymorphicRegistry] Registered mapping: 'subject' -> 'Course'
4:15:43 PM	Info	[DBContext] Bootstrapping SheetDB for DazzlingDB...
4:15:43 PM	Info	[SheetDB] Initializing Database: DazzlingDB (v2.1.1)
4:15:43 PM	Info	[ModelRegistry] Initializing Dynamic Models...
4:15:43 PM	Info	[ModelRegistry] Successfully generated 28 Models.
4:15:43 PM	Info	[SheetDB] Success: 28 repositories generated.
4:15:43 PM	Info	[ValidationRegistry] Registry locked. Mutations are now blocked.
4:15:49 PM	Info	
=========================================
4:15:49 PM	Info	▶️ SCENARIO 1: Relational Creation with Polymorphic Casing Normalization
4:15:49 PM	Info	[BaseModel:CourseType] Starting relational checks across 0 relationship declarations...
4:15:49 PM	Info	[BaseModel:CourseType] Relational checking finished. Total relationship errors: 0
4:15:49 PM	Info	[BaseModel] Attempting insert for new CourseType...
4:15:50 PM	Info	[BaseModel] Successfully inserted new CourseType (ID: SEG-62B7562A).
4:15:50 PM	Info	[BaseModel:Course] Starting relational checks across 1 relationship declarations...
4:15:50 PM	Info	[PrimaryKeyCache] Cache Miss: Compiling active keys for table 'CourseType'...
4:15:51 PM	Info	[PrimaryKeyCache] Cached 6 keys for table 'CourseType'.
4:15:51 PM	Info	[Relation:belongsTo] Relational check PASSED for 'segment_id' -> 'CourseType' (ID: 'SEG-62B7562A')
4:15:51 PM	Info	[BaseModel:Course] Relational checking finished. Total relationship errors: 0
4:15:51 PM	Info	[BaseModel] Attempting insert for new Course...
4:15:51 PM	Info	[BaseModel] Successfully inserted new Course (ID: CRS-F7ED8C30).
4:15:51 PM	Info	[BaseModel:Course] Starting relational checks across 1 relationship declarations...
4:15:51 PM	Info	[Relation:belongsTo] Relational check PASSED for 'segment_id' -> 'CourseType' (ID: 'SEG-62B7562A')
4:15:51 PM	Info	[BaseModel:Course] Relational checking finished. Total relationship errors: 0
4:15:51 PM	Info	[BaseModel] Attempting insert for new Course...
4:15:52 PM	Info	[BaseModel] Successfully inserted new Course (ID: CRS-E458921B).
4:15:52 PM	Info	   ⚙️ Invoking AcademicService.createPackage with payload...
4:15:52 PM	Info	[AcademicService] Orchestrating Bulk Package: Polymorphic Test Combo
4:15:52 PM	Info	[BaseModel:Package] Starting relational checks across 1 relationship declarations...
4:15:52 PM	Info	[BaseModel:Package] Relational checking finished. Total relationship errors: 0
4:15:52 PM	Info	[BaseModel] Attempting insert for new Package...
4:15:52 PM	Info	[BaseModel] Successfully inserted new Package (ID: PKG-B287E6D8).
4:15:52 PM	Info	[BaseModel:PackagePerk] Starting relational checks across 1 relationship declarations...
4:15:52 PM	Info	[PrimaryKeyCache] Cache Miss: Compiling active keys for table 'Package'...
4:15:52 PM	Info	[PrimaryKeyCache] Cached 21 keys for table 'Package'.
4:15:52 PM	Info	[Relation:belongsTo] Relational check PASSED for 'package_id' -> 'Package' (ID: 'PKG-B287E6D8')
4:15:52 PM	Info	[BaseModel:PackagePerk] Relational checking finished. Total relationship errors: 0
4:15:52 PM	Info	[BaseModel] Attempting insert for new PackagePerk...
4:15:53 PM	Info	[BaseModel] Successfully inserted new PackagePerk (ID: PRK-46C759E0).
4:15:53 PM	Info	[BaseModel:PackageItem] Starting relational checks across 2 relationship declarations...
4:15:53 PM	Info	[Relation:belongsTo] Relational check PASSED for 'package_id' -> 'Package' (ID: 'PKG-B287E6D8')
4:15:53 PM	Info	[PrimaryKeyCache] Cache Miss: Compiling active keys for table 'Course'...
4:15:53 PM	Info	[PrimaryKeyCache] Cached 173 keys for table 'Course'.
4:15:53 PM	Info	[Relation:belongsToPolymorphic] Relational check PASSED for 'entity_id' -> 'Course' (ID: 'CRS-F7ED8C30')
4:15:53 PM	Info	[BaseModel:PackageItem] Relational checking finished. Total relationship errors: 0
4:15:53 PM	Info	[BaseModel] Attempting insert for new PackageItem...
4:15:53 PM	Info	[BaseModel] Successfully inserted new PackageItem (ID: PKI-07E93B46).
4:15:53 PM	Info	[BaseModel:PackageItem] Starting relational checks across 2 relationship declarations...
4:15:53 PM	Info	[Relation:belongsTo] Relational check PASSED for 'package_id' -> 'Package' (ID: 'PKG-B287E6D8')
4:15:53 PM	Info	[Relation:belongsToPolymorphic] Relational check PASSED for 'entity_id' -> 'Course' (ID: 'CRS-E458921B')
4:15:53 PM	Info	[BaseModel:PackageItem] Relational checking finished. Total relationship errors: 0
4:15:53 PM	Info	[BaseModel] Attempting insert for new PackageItem...
4:15:53 PM	Info	[BaseModel] Successfully inserted new PackageItem (ID: PKI-669941A9).
4:15:53 PM	Info	   ✅ Success! Created Package record with ID: PKG-B287E6D8
4:15:54 PM	Info	   ✅ Success! Polymorphic PackageItems correctly normalized and stored.
4:15:54 PM	Info	   ✅ Success! Created PackagePerk: Free Digital Handbooks
4:15:54 PM	Info	
=========================================
4:15:54 PM	Info	▶️ SCENARIO 2: Relational Update and Sync Sync Rewrite
4:15:55 PM	Info	   ⚙️ Invoking AcademicService.updatePackage with sync updates...
4:15:55 PM	Info	[AcademicService] Updating Package: PKG-B287E6D8
4:15:55 PM	Info	[BaseModel:Package] Starting relational checks across 1 relationship declarations...
4:15:55 PM	Info	[BaseModel:Package] Relational checking finished. Total relationship errors: 0
4:15:55 PM	Info	[BaseModel] Attempting update for Package (ID: PKG-B287E6D8)...
4:15:55 PM	Info	[BaseModel] Successfully updated Package (ID: PKG-B287E6D8).
4:15:57 PM	Info	[BaseModel:PackageItem] Starting relational checks across 2 relationship declarations...
4:15:57 PM	Info	[Relation:belongsTo] Relational check PASSED for 'package_id' -> 'Package' (ID: 'PKG-B287E6D8')
4:15:57 PM	Error	[Relation:belongsToPolymorphic] Validation failure: dynamic ID 'CRS-UPDATED-1' not found in resolved parent table 'Course' for type 'course'.
4:15:57 PM	Info	[BaseModel:PackageItem] Relational checking finished. Total relationship errors: 1
4:15:57 PM	Error	[BaseModel] Error during save() for PackageItem: Relational validation failed for PackageItem: Field 'entity_id' failed validation: Polymorphic ID Mismatch: ID 'CRS-UPDATED-1' not found in dynamically resolved table 'Course' for type 'course'. { [ValidationError: Relational validation failed for PackageItem: Field 'entity_id' failed validation: Polymorphic ID Mismatch: ID 'CRS-UPDATED-1' not found in dynamically resolved table 'Course' for type 'course'.]
  name: 'ValidationError',
  context: { errors: [ [Object] ] },
  timestamp: '2026-06-02T10:45:57.456Z' }
4:15:57 PM	Info	[BaseModel:Package] Starting relational checks across 1 relationship declarations...
4:15:57 PM	Info	[BaseModel:Package] Relational checking finished. Total relationship errors: 0
4:15:57 PM	Info	[BaseModel] Attempting update for Package (ID: PKG-B287E6D8)...
4:15:57 PM	Info	[BaseModel] Successfully updated Package (ID: PKG-B287E6D8).
4:15:58 PM	Info	[BaseModel:PackageItem] Starting relational checks across 2 relationship declarations...
4:15:58 PM	Info	[Relation:belongsTo] Relational check PASSED for 'package_id' -> 'Package' (ID: 'PKG-B287E6D8')
4:15:58 PM	Info	[Relation:belongsToPolymorphic] Relational check PASSED for 'entity_id' -> 'Course' (ID: 'CRS-F7ED8C30')
4:15:58 PM	Info	[BaseModel:PackageItem] Relational checking finished. Total relationship errors: 0
4:15:58 PM	Info	[BaseModel] Attempting update for PackageItem (ID: PKI-07E93B46)...
4:15:58 PM	Error	[BaseModel] Update failed for PackageItem (ID: PKI-07E93B46): Update failed: Record 'PKI-07E93B46' not found. [Error: Update failed: Record 'PKI-07E93B46' not found.]
4:15:58 PM	Error	[BaseModel] Error during save() for PackageItem: Failed to update PackageItem (ID: PKI-07E93B46): Update failed: Record 'PKI-07E93B46' not found. [Error: Failed to update PackageItem (ID: PKI-07E93B46): Update failed: Record 'PKI-07E93B46' not found.]
4:15:58 PM	Error	   ❌ Failed:
4:15:58 PM	Error	      Error Message: Failed to update PackageItem (ID: PKI-07E93B46): Update failed: Record 'PKI-07E93B46' not found.
4:15:58 PM	Info	
=========================================
4:15:58 PM	Info	▶️ SCENARIO 3: Dynamic Transaction Rollback and Recovery
4:15:58 PM	Error	   ❌ Failed:
4:15:58 PM	Error	      Error Message: Target test package not found for rollback test.
4:15:58 PM	Info	=========================================
4:15:58 PM	Info	📊 FINAL TEST RESULTS: 
 {
  "Scenario1": "✅ PASSED",
  "Scenario2": "❌ FAILED: Failed to update PackageItem (ID: PKI-07E93B46): Update failed: Record 'PKI-07E93B46' not found.",
  "Scenario3": "❌ FAILED: Target test package not found for rollback test."
}
4:15:58 PM	Info	🏁 Academic Package Tests Complete.
4:15:59 PM	Notice	Execution completed
```
