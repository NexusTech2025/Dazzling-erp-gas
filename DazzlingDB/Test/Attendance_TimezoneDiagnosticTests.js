/**
 * @file Attendance_TimezoneDiagnosticTests.js
 * Automated testing module for analyzing timezone shifts in Attendance and DateTimeField.
 */

function runAttendanceTimezoneDiagnosticTests() {
  console.log("🚀 Starting Attendance Timezone Diagnostic Tests...");
  
  const results = {};
  
  console.log("\n=========================================");
  results.Scenario1_DateTimeFieldAlone = executeScenario1_DateTimeFieldAlone();
  
  console.log("\n=========================================");
  results.Scenario2_AttendanceUtilIntegration = executeScenario2_AttendanceUtilIntegration();
  
  console.log("=========================================\n");
  console.log("📊 FINAL TEST RESULTS: \n", JSON.stringify(results, null, 2));
  console.log("🏁 Attendance Timezone Diagnostic Tests Complete.");
  
  return results;
}

/**
 * SCENARIO 1: Test DateTimeField alone using 4:00 PM local time
 */
function executeScenario1_DateTimeFieldAlone() {
  console.log("▶️ SCENARIO 1: SheetDB DateTimeField Alone");
  try {
    const dateTimeField = new DateTimeField({ name: "test_datetime" });
    
    // Create Date object representing 4:00 PM local time on 2026-07-14
    // Replace dashes with slashes to ensure local timezone parsing in Apps Script
    const localDate = new Date("2026/07/14 16:00:00");
    console.log(`   [Local Input]  Native Local Date Object: ${localDate.toString()}`);
    console.log(`   [Local Input]  UTC ISO String:           ${localDate.toISOString()}`);
    
    // Serialize
    const sheetValue = dateTimeField.toSheetValue(localDate);
    console.log(`   [Serialized]   Value written to cell:    "${sheetValue}"`);
    
    // Deserialize
    const readDate = dateTimeField.fromSheetValue(sheetValue);
    console.log(`   [Deserialized] Native Read Date Object:  ${readDate.toString()}`);
    console.log(`   [Deserialized] UTC ISO String:           ${readDate.toISOString()}`);
    
    const diffMs = readDate.getTime() - localDate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    console.log(`   [Analysis]     Shift Difference:         ${diffHours} hours`);
    
    return {
      status: diffHours === 0 ? "✅ PASSED" : `⚠️ SHIFTED BY ${diffHours} HOURS`,
      originalUtc: localDate.toISOString(),
      readUtc: readDate.toISOString(),
      differenceHours: diffHours
    };
  } catch (error) {
    console.error("   ❌ Failed:");
    console.error("      Error Message:", error.message);
    return `❌ FAILED: ${error.message}`;
  }
}

/**
 * SCENARIO 2: Test AttendanceUtil + DateTimeField integration
 */
function executeScenario2_AttendanceUtilIntegration() {
  console.log("▶️ SCENARIO 2: AttendanceUtil + DateTimeField Integration");
  try {
    const dateTimeField = new DateTimeField({ name: "test_datetime" });
    const timeJson = { hour: 4, minute: 0, period: "PM" };
    const dateStr = "2026-07-14";
    
    // 1. Convert JSON time to Date using AttendanceUtil
    const attendanceDate = AttendanceUtil.convertJsonToDate(timeJson, dateStr);
    console.log(`   [Step 1] AttendanceUtil.convertJsonToDate: ${attendanceDate.toString()}`);
    console.log(`   [Step 1] UTC ISO String:                   ${attendanceDate.toISOString()}`);
    
    // 2. Serialize
    const sheetValue = dateTimeField.toSheetValue(attendanceDate);
    console.log(`   [Step 2] Serialized to Sheet Cell:         "${sheetValue}"`);
    
    // 3. Deserialize
    const readDate = dateTimeField.fromSheetValue(sheetValue);
    console.log(`   [Step 3] Deserialized from Sheet:          ${readDate.toString()}`);
    console.log(`   [Step 3] UTC ISO String:                   ${readDate.toISOString()}`);
    
    // 4. Convert back to JSON time object using AttendanceUtil
    const resultJson = AttendanceUtil.convertDateToJson(readDate);
    console.log(`   [Step 4] Re-hydrated JSON Time:            ${JSON.stringify(resultJson)}`);
    console.log(`   [Step 4] Expected JSON Time:               ${JSON.stringify(timeJson)}`);
    
    const passed = (resultJson && resultJson.hour === timeJson.hour && resultJson.period === timeJson.period);
    
    if (passed) {
      console.log("   ✅ Success: Re-hydrated JSON time matches original input.");
      return "✅ PASSED";
    } else {
      console.error("   ❌ Mismatch: Time shift detected.");
      return `❌ FAILED: Shifted to ${JSON.stringify(resultJson)}`;
    }
  } catch (error) {
    console.error("   ❌ Failed:");
    console.error("      Error Message:", error.message);
    return `❌ FAILED: ${error.message}`;
  }
}
