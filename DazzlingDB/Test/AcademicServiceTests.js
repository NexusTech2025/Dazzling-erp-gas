/**
 * @file AcademicServiceTests.js
 * Integration Tests for the Academic Domain.
 */

function runAcademicServiceTests() {
  console.log("🚀 Starting Academic Service Integration Tests...");

  // 1. Setup Data: Segment
  let segmentId = "SEG-TEST-" + Math.random().toString(36).substring(7).toUpperCase();
  try {
    AcademicService.createCourseType({
      segment_id: segmentId,
      segment_name: "Test Segment",
      status: "active"
    });
    console.log("✅ CourseType created.");
  } catch (e) {
    console.error("❌ CourseType creation failed:", e.message);
  }

  // 2. Test Course Creation (Success)
  let courseId = "CRS-TEST-" + Math.random().toString(36).substring(7).toUpperCase();
  try {
    AcademicService.createCourse({
      course_id: courseId,
      segment_id: segmentId,
      name: "Relational Mapping 101",
      language_medium: "English",
      base_fee: 5000
    });
    console.log("✅ Course creation success.");
  } catch (e) {
    console.error("❌ Course creation failed:", e.message);
  }

  // 3. Test Course Creation (Failure - Invalid Segment)
  try {
    AcademicService.createCourse({
      course_id: "FAIL-CRS",
      segment_id: "NON-EXISTENT",
      name: "Ghost Course",
      language_medium: "Hindi",
      base_fee: 100
    });
    console.error("❌ Error: Course creation should have failed for invalid segment.");
  } catch (e) {
    if (e instanceof CourseTypeNotFoundError) {
      console.log("✅ Validation check passed: Correctly caught CourseTypeNotFoundError.");
    } else {
      console.error("❌ Validation check failed: Caught unexpected error:", e.name);
    }
  }

  // 4. Test Batch Creation (Failure - Missing Course)
  try {
    AcademicService.createBatch({
      batch_id: "B-FAIL",
      item_id: "CRS-GHOST",
      batch_name: "Ghost Batch"
    });
  } catch (e) {
     if (e instanceof CourseNotFoundError) {
      console.log("✅ Validation check passed: Correctly caught CourseNotFoundError.");
    } else {
      console.error("❌ Validation check failed: Caught unexpected error:", e.name);
    }
  }

  console.log("🏁 Academic Service Tests Complete.");
}
