/**
 * @file QueryEngine_AttendanceTests.js
 * Test Suite containing separate runs for ProjectionEngine formatting,
 * DateFetcher filtering, and QueryEngine execution against TeacherAttendance.
 */

// Environment Guard (Rule E)
function _guardProductionEnv() {
  const activeEnv = typeof SYSTEM_ENV !== 'undefined' ? SYSTEM_ENV : 'development';
  if (activeEnv === 'production') {
    throw new Error("❌ Safety Guard: Test suite cannot be executed in the PRODUCTION environment.");
  }
}

/**
 * Run Method 1: Tests ProjectionEngine.project date formatting.
 */
function runProjectionEngineTests() {
  _guardProductionEnv();
  console.log("🚀 Starting ProjectionEngine tests...");
  
  const db = DBContext.getInstance();
  const TeacherAttendanceModel = SheetDB.ModelRegistry.getModel("TeacherAttendance");
  
  const testDate = new Date(2026, 6, 15); // July 15 local midnight
  const entryDate = new Date(2026, 6, 15, 14, 30, 0); // Datetime

  const record = new TeacherAttendanceModel({
    attendance_id: "TAT-MOCK-1",
    teacher_id: "TCH-MOCK-1",
    batch_id: "BAT-MOCK-1",
    attendance_date: testDate,
    entry_time: entryDate,
    exit_time: entryDate,
    status: "P"
  });

  console.log("--- PROJECTING ROW ---");
  const projected = ProjectionEngine.project([record]);
  console.log("Projected Output:", JSON.stringify(projected, null, 2));

  const row = projected[0];
  
  // Assertions
  // Date type column 'attendance_date' must serialize timezone-safely to YYYY-MM-DD
  const dateStr = row.attendance_date;
  if (dateStr !== "2026-07-15") {
    throw new Error(`❌ Projection Fail: expected '2026-07-15' for date field, got '${dateStr}'`);
  }
  console.log("✅ Passed: date column correctly formatted to local YYYY-MM-DD.");

  // Datetime type column 'entry_time' must serialize to ISO string
  const entryStr = row.entry_time;
  if (entryStr !== entryDate.toISOString()) {
    throw new Error(`❌ Projection Fail: expected ISO string for datetime, got '${entryStr}'`);
  }
  console.log("✅ Passed: datetime column correctly formatted to ISO string.");
  console.log("🎉 ProjectionEngine tests completed successfully!");
}

/**
 * Run Method 2: Tests DataFetcher query filtering against DEVELOPMENT data.
 */
function runDateFetcherTests() {
  _guardProductionEnv();
  console.log("🚀 Starting DateFetcher query tests...");

  const db = DBContext.getInstance();
  const TARGET_DATE = "2026-07-15";

  // Simulate a parsed query object
  const query = {
    target: "TeacherAttendance",
    where: { attendance_date: TARGET_DATE },
    select: null,
    include: null,
    sort: null,
    pagination: { offset: 0, limit: 1000 }
  };

  console.log(`--- FETCHING PRIMARY DATA FOR ${TARGET_DATE} ---`);
  const tStart = new Date().getTime();
  const records = DataFetcher.executePrimary(query, db);
  const duration = new Date().getTime() - tStart;

  console.log(`Fetched ${records.length} records in ${duration} ms.`);

  records.forEach((row, i) => {
    // Assert and verify the date matches locally
    const recDate = row.attendance_date;
    let recDateStr;
    if (typeof recDate === 'string') {
      recDateStr = recDate.split(' ')[0].split('T')[0];
    } else if (isDate(recDate)) {
      const y = recDate.getFullYear();
      const m = String(recDate.getMonth() + 1).padStart(2, '0');
      const d = String(recDate.getDate()).padStart(2, '0');
      recDateStr = `${y}-${m}-${d}`;
    } else {
      recDateStr = String(recDate);
    }

    if (recDateStr !== TARGET_DATE) {
      throw new Error(`❌ DateFetcher Fail: Record [${i+1}] date ${recDateStr} does not match ${TARGET_DATE}`);
    }
    console.log(`Record [${i+1}] matches: ${row.attendance_id} (${recDateStr})`);
  });

  console.log("🎉 DateFetcher tests completed successfully!");
}

/**
 * Run Method 3: Tests end-to-end QueryEngine date filters and serialization.
 */
function runQueryEngineTests() {
  _guardProductionEnv();
  console.log("🚀 Starting QueryEngine date query tests...");

  const db = DBContext.getInstance();
  const TARGET_DATE = "2026-07-15";

  console.log(`--- EXECUTING QUERY FOR ${TARGET_DATE} ---`);
  const tStart = new Date().getTime();
  const results = QueryEngine.execute({
    target: "TeacherAttendance",
    where: { attendance_date: TARGET_DATE }
  }, db);
  const duration = new Date().getTime() - tStart;

  console.log(`Query Engine execution completed in ${duration} ms.`);
  console.log("Response envelope:", JSON.stringify(results, null, 2));

  if (!results.success) {
    throw new Error("❌ QueryEngine query failed");
  }

  const data = results.data || [];
  data.forEach((row, i) => {
    const dateStr = row.attendance_date.split(' ')[0].split('T')[0];
    if (dateStr !== TARGET_DATE) {
      throw new Error(`❌ QueryEngine Fail: Record [${i+1}] serialized date ${dateStr} does not match ${TARGET_DATE}`);
    }
    console.log(`Serialized record [${i+1}] matches: ${row.attendance_id} (${dateStr})`);
  });

  console.log("🎉 QueryEngine tests completed successfully!");
}

/**
 * Run Method 4: Verifies if row.constructor.schema is defined on rows returned by table.gateway.all().
 */
function runRowConstructorSchemaTests() {
  _guardProductionEnv();
  console.log("🚀 Starting Row Constructor Schema tests...");

  const db = DBContext.getInstance();
  const query = {
    target: "TeacherAttendance",
    where: { attendance_date: "2026-07-15" },
    select: null,
    include: null,
    sort: null,
    pagination: { offset: 0, limit: 1000 }
  };

  const records = DataFetcher.executePrimary(query, db);
  if (records.length === 0) {
    console.log("⚠️ No records found in DEVELOPMENT to verify.");
    return;
  }

  const firstRow = records[0];
  console.log("--- ROW DETAILS ---");
  console.log("Row type/constructor:", firstRow.constructor.name);
  console.log("row.__tableName:", firstRow.__tableName);
  console.log("row.constructor.schema defined?", firstRow.constructor.schema !== undefined ? "YES" : "NO");

  if (firstRow.constructor.schema === undefined) {
    console.log("✅ Assertion Confirmed: row.constructor.schema is UNDEFINED (plain object returned from gateway).");
  } else {
    console.log("❌ Assertion Failed: row.constructor.schema is defined (unexpected BaseModel instance).");
  }
}
