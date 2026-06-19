/**
 * @file AcademicServiceTests.js
 * Integration Tests for the Academic Domain.
 */

function runAcademicServiceTests() {
  console.log("🚀 Starting Academic Service Integration Tests...");

  const mockContext = {
    actionType: "CREATE",
    mutationManifest: []
  };

  // 1. Setup Data: Segment
  let segmentId = "SEG-TEST-" + Math.random().toString(36).substring(7).toUpperCase();
  try {
    mockContext.mutationManifest = [];
    AcademicService.createCourseType({
      segment_id: segmentId,
      segment_name: "Test Segment",
      status: "active"
    }, mockContext);
    console.log("✅ CourseType created.");
    if (mockContext.mutationManifest.includes("CourseType")) {
      console.log("✅ Mutation tracking verified for CourseType.");
    } else {
      console.error("❌ Mutation tracking failed for CourseType!");
    }
  } catch (e) {
    console.error("❌ CourseType creation failed:", e.message);
  }

  // 2. Test Course Creation (Success)
  let courseId = "CRS-TEST-" + Math.random().toString(36).substring(7).toUpperCase();
  try {
    mockContext.mutationManifest = [];
    AcademicService.createCourse({
      course_id: courseId,
      segment_id: segmentId,
      name: "Relational Mapping 101",
      language_medium: "English",
      base_fee: 5000
    }, mockContext);
    console.log("✅ Course creation success.");
    if (mockContext.mutationManifest.includes("Course")) {
      console.log("✅ Mutation tracking verified for Course.");
    } else {
      console.error("❌ Mutation tracking failed for Course!");
    }
  } catch (e) {
    console.error("❌ Course creation failed:", e.message);
  }

  // 3. Test Course Creation (Failure - Invalid Segment)
  try {
    mockContext.mutationManifest = [];
    AcademicService.createCourse({
      course_id: "FAIL-CRS",
      segment_id: "NON-EXISTENT",
      name: "Ghost Course",
      language_medium: "Hindi",
      base_fee: 100
    }, mockContext);
    console.error("❌ Error: Course creation should have failed for invalid segment.");
  } catch (e) {
    if (e instanceof CourseTypeNotFoundError || e.name === "EntityNotFoundError") {
      console.log("✅ Validation check passed: Correctly caught EntityNotFoundError (CourseType).");
    } else {
      console.error("❌ Validation check failed: Caught unexpected error:", e.name, e.message);
    }
  }

  // 4. Test Batch Creation (Failure - Missing Course)
  try {
    mockContext.mutationManifest = [];
    AcademicService.createBatch({
      batch_id: "B-FAIL",
      course_id: "CRS-GHOST",
      batch_name: "Ghost Batch"
    }, mockContext);
  } catch (e) {
     if (e instanceof CourseNotFoundError || e.name === "EntityNotFoundError") {
      console.log("✅ Validation check passed: Correctly caught EntityNotFoundError (Course).");
    } else {
      console.error("❌ Validation check failed: Caught unexpected error:", e.name, e.message);
    }
  }

  console.log("🏁 Academic Service Tests Complete.");
}
