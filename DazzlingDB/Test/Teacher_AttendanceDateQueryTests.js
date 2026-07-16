/**
 * @file Teacher_AttendanceDateQueryTests.js
 * Diagnostic query test to verify StaffService.queryAttendance correctly filters
 * TeacherAttendance records by a specific date using the updated DateComparator
 * pipeline in PredicateBuilder (timezone-safe local date comparison).
 *
 * Test Scenario:
 *   - Runs a plain query against DEVELOPMENT data for attendance_date = "2026-07-15".
 *   - Asserts every returned record's attendance_date resolves to "2026-07-15".
 *   - Logs the count and per-record date verification.
 *   - No mock data seeding or teardown is performed.
 */

function runTeacherAttendanceDateQueryTests() {
  console.log("🚀 Starting Teacher Attendance Date Query Tests...");

  // Environment Guard: prevent accidental production execution
  const activeEnv = typeof SYSTEM_ENV !== 'undefined' ? SYSTEM_ENV : 'development';
  if (activeEnv === 'production') {
    throw new Error("❌ Safety Guard: Test suite cannot be executed in the PRODUCTION environment.");
  }

  const db = DBContext.getInstance();
  const timings = {};
  const results = {};
  const TARGET_DATE = "2026-07-15";

  try {
    // =====================================================
    // QUERY: Plain date filter against DEVELOPMENT data
    // =====================================================
    console.log("\n--- [QUERY] Calling StaffService.queryAttendance for " + TARGET_DATE + " ---");
    const tQueryStart = new Date().getTime();

    const queryResult = StaffService.queryAttendance({
      where: { attendance_date: TARGET_DATE }
    });

    timings["Query: Date Filter"] = new Date().getTime() - tQueryStart;

    const records = queryResult.data || [];
    console.log("   📦 Total records returned: " + records.length);

    // =====================================================
    // ASSERTION 1: Records were returned (informational count log)
    // =====================================================
    results["Records Returned"] = records.length > 0
      ? "✅ " + records.length + " record(s) found"
      : "⚠️  No records found for " + TARGET_DATE + " in DEVELOPMENT data";
    console.log("\n   📊 " + results["Records Returned"]);

    // =====================================================
    // ASSERTION 2: Every returned record's date = TARGET_DATE
    // =====================================================
    console.log("\n   📅 Per-Record Date Verification:");
    let allDatesMatch = true;

    records.forEach(function(rec, i) {
      // Normalize: attendance_date may be a string ("2026-07-15 0:00:00") or a Date object
      var recDateStr;
      if (typeof rec.attendance_date === 'string') {
        recDateStr = rec.attendance_date.split(' ')[0].split('T')[0];
      } else if (isDate(rec.attendance_date)) {
        var d = rec.attendance_date;
        recDateStr = d.getFullYear() + "-"
          + String(d.getMonth() + 1).padStart(2, '0') + "-"
          + String(d.getDate()).padStart(2, '0');
      } else {
        recDateStr = String(rec.attendance_date);
      }

      var dateMatch = (recDateStr === TARGET_DATE);
      if (!dateMatch) allDatesMatch = false;

      console.log("   Record [" + (i + 1) + "] | Teacher: " + rec.teacher_id
        + " | Batch: " + rec.batch_id
        + " | Date: " + recDateStr
        + " | Match: " + (dateMatch ? "YES ✅" : "NO ❌ (Got: " + recDateStr + ")"));
    });

    results["Date Match Assertion (All Records)"] = records.length === 0
      ? "⚠️  Skipped — no records to verify"
      : allDatesMatch
        ? "✅ PASSED — all records match " + TARGET_DATE
        : "❌ FAILED — one or more records returned an incorrect date";

    console.log("\n   " + results["Date Match Assertion (All Records)"]);

  } catch (error) {
    console.error("\n   ❌ Test failed: " + error.message, error.stack);
    results["Test Execution"] = "❌ FAILED: " + error.message;
  } finally {
    // Rule G: Performance timing summary
    console.log("\n========================================================");
    console.log("⏱️  TEACHER ATTENDANCE DATE QUERY TIMING SUMMARY        ⏱️");
    console.log("========================================================");
    var totalTime = 0;
    Object.keys(timings).forEach(function(step) {
      console.log("- " + step.padEnd(38) + ": " + timings[step] + " ms");
      totalTime += timings[step];
    });
    console.log("--------------------------------------------------------");
    console.log("- Total Execution Time                    : " + totalTime + " ms");
    console.log("========================================================");

    // Results summary
    console.log("\n========================================================");
    console.log("📋 FINAL TEST RESULTS");
    console.log("========================================================");
    Object.keys(results).forEach(function(name) {
      console.log("- " + name.padEnd(40) + ": " + results[name]);
    });
    console.log("========================================================\n");
  }

  return results;
}
