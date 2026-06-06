/**
 * @file CourseRelationQueryTest.js
 * API Test for verifying Course relations (batches, enrollments, packageitems) using 'data_query'.
 * 
 * Instructions: Run `runCourseRelationQueryTest()` from the Apps Script editor.
 */

const CourseRelationQueryTest = (function () {

  function run() {
    const { logger, callApi } = ApiTestHelper;

    console.log("\n🧪 STARTING COURSE RELATION QUERY TEST SUITE 🧪");

    try {
      logger.phase("1: Query Courses with relations: batches, enrollments, packageitems");

      // Payload matching the desired includes for relations
      const queryPayload = {
        target: "Course",
        include: {
          batches: {},
          enrollments: {},
          packageitems: {}
        },
        pagination: {
          limit: 200
        }
      };

      logger.action("Dispatching 'data_query' for Course with full relations...");
      const result = callApi("data_query", queryPayload);

      if (!result || !result.success) {
        throw new Error("API request failed: " + JSON.stringify(result));
      }

      logger.success(`Query executed successfully. Fetched ${result.count} courses.`);
      const courses = result.data || [];

      if (courses.length === 0) {
        logger.detail("No courses found in database to verify.");
        return;
      }

      // Format for console.table display
      const formattedTableData = courses.map((course, index) => {
        const batchList = Array.isArray(course.batches) ? course.batches.map(b => b.batch_id) : [];
        const enrollmentList = Array.isArray(course.enrollments) ? course.enrollments.map(e => e.enrollment_id) : [];
        const packageitemList = Array.isArray(course.packageitems) ? course.packageitems.map(p => p.entity_id || p.package_item_id || "") : [];

        return {
          "Index": index + 1,
          "Course ID": course.course_id,
          "Course Name": course.name,
          "Base Fee": course.base_fee,
          "Batches": `${batchList.join(", ")} (Total: ${batchList.length})`,
          "Enrollments": `Total: ${enrollmentList.length}`,
          "Package Items": `Total: ${packageitemList.length}`
        };
      });

      console.log("\n📋 --- COURSE RELATION QUERY RESULTS ---");
      _printAsciiTable(formattedTableData);

      // Verify that hydration attached arrays (even if empty)
      let hydrationPassed = true;
      courses.forEach(course => {
        if (!Array.isArray(course.batches) || !Array.isArray(course.enrollments) || !Array.isArray(course.packageitems)) {
          hydrationPassed = false;
        }
      });

      if (hydrationPassed) {
        logger.success("✅ Verification SUCCESS: All course records successfully hydrated with batches, enrollments, and packageitems arrays.");
      } else {
        logger.error("❌ Verification FAILURE: One or more courses were returned with unhydrated relations.");
        throw new Error("Relational hydration validation failed.");
      }

      console.log("\n🎉 COURSE RELATION QUERY TEST SUITE COMPLETED SUCCESSFULLY! 🎉\n");

    } catch (error) {
      logger.error(`API Test Failed: ${error.message}`);
    }
  }

  /**
   * Generates and logs a clean ASCII table representation of arrays of objects.
   * @private
   */
  function _printAsciiTable(data) {
    if (!data || data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    
    // 1. Calculate max width for each column
    const colWidths = {};
    headers.forEach(header => {
      colWidths[header] = header.length;
    });
    
    data.forEach(row => {
      headers.forEach(header => {
        const valStr = String(row[header] !== undefined ? row[header] : "");
        if (valStr.length > colWidths[header]) {
          colWidths[header] = valStr.length;
        }
      });
    });
    
    // 2. Build border lines
    const border = "+" + headers.map(h => "-".repeat(colWidths[h] + 2)).join("+") + "+";
    
    // 3. Log Header
    console.log(border);
    const headerLine = "|" + headers.map(h => " " + h.padEnd(colWidths[h]) + " ").join("|") + "|";
    console.log(headerLine);
    console.log(border);
    
    // 4. Log Rows
    data.forEach(row => {
      const rowLine = "|" + headers.map(h => {
        const valStr = String(row[h] !== undefined ? row[h] : "");
        return " " + valStr.padEnd(colWidths[h]) + " ";
      }).join("|") + "|";
      console.log(rowLine);
    });
    
    console.log(border);
  }

  return {
    run: run
  };

})();

function runCourseRelationQueryTest() {
  CourseRelationQueryTest.run();
}
