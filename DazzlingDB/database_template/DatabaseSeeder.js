/**
 * @file DatabaseSeeder.js
 * Automatically generated file to seed DazzlingDB.
 * 
 * Instructions:
 * 1. Ensure this file, academic_course_template.js, and computer_course_template.js are in your Apps Script project.
 * 2. Run the 'executeSeed()' function from the Apps Script editor.
 */

function executeSeed() {
  console.log("🚀 Starting Database Seeder...");
  const db = DBContext.getInstance();
  
  // 1. Insert Course Types (From Academic Template)
  console.log("▶️ Seeding Course Types...");
  const courseTypesData = ACADEMIC_COURSE_TEMPLATE.courseTypes;
  
  const createdTypes = db.CourseType.insertMany(courseTypesData);
  console.log(`✅ Created ${createdTypes.length} Course Types.`);
  
  // Find generated IDs
  const academicSegment = createdTypes.find(t => t.segment_name === "Academic");
  const computerSegment = createdTypes.find(t => t.segment_name === "Computer");
  
  if (!academicSegment || !computerSegment) {
    throw new Error("❌ Critical segments failed to generate.");
  }

  // 2. Prepare Courses with dynamic segment_ids
  const academicCourses = ACADEMIC_COURSE_TEMPLATE.academicCourses;
  academicCourses.forEach(c => c.segment_id = academicSegment.segment_id);

  const computerCourses = COMPUTER_COURSE_TEMPLATE.computerCourses;
  computerCourses.forEach(c => c.segment_id = computerSegment.segment_id);

  // 3. Bulk Insert Courses
  console.log(`▶️ Seeding ${academicCourses.length} Academic Courses...`);
  db.Course.insertMany(academicCourses);
  
  console.log(`▶️ Seeding ${computerCourses.length} Computer Courses...`);
  db.Course.insertMany(computerCourses);

  console.log("🎉 Database Seeding Completed Successfully!");
}
