/**
 * @file CourseQuery_ApiTest.js
 * API Test for testing the Advanced Query Engine via 'data_query'.
 * 
 * Instructions: Run `CourseQuery_ApiTest.run()` from the Apps Script editor.
 */

const CourseQuery_ApiTest = (function() {

  function run() {
    const { logger, callApi } = ApiTestHelper;

    console.log("\n🧪 STARTING COURSE QUERY API TEST 🧪");
    
    try {
      logger.phase("1: Fetch Active Courses with CourseType Hydration");

      const queryPayload = {
        target: "Course",
        where: {
            status: "active"
        },
        include: {
            coursetype: {}
        },
        pagination: {
            limit: 200 // Default is 50, Max is 200 per trip
        }
      };

      logger.action("Dispatching 'data_query' payload...");
      logger.detail("Payload: " + JSON.stringify(queryPayload));

      const result = callApi("data_query", queryPayload);
      
      logger.success(`Query executed successfully. Fetched ${result.count} courses.`);
      
      if (result.count === 0) {
        logger.detail("No active courses found in the database. Ensure the seeder has been run or courses have been created.");
      } else {
        // Map the results to a simpler format to display in logs safely without overwhelming the console
        const previewData = result.data.map(course => ({
          course_id: course.course_id,
          course_name: course.name,
          base_fee: course.base_fee,
          coursetype_name: course.coursetype ? course.coursetype.segment_name : "UNHYDRATED/MISSING"
        }));

        logger.data(`First 5 Hydrated Courses (Preview)`, previewData.slice(0, 5));
        
        // Summarize by CourseType
        const summary = {};
        previewData.forEach(c => {
          summary[c.coursetype_name] = (summary[c.coursetype_name] || 0) + 1;
        });
        logger.data("Course Count by Segment", summary);
        
        // Verify Hydration worked
        const unhydrated = previewData.filter(c => c.coursetype_name === "UNHYDRATED/MISSING");
        if (unhydrated.length > 0) {
           logger.error(`Found ${unhydrated.length} courses missing 'coursetype' relation.`);
           throw new Error("Hydration failure on 'coursetype' relation.");
        }
        
        logger.success("✅ Relational Hydration ('coursetype') verified for all returned courses.");
      }

      console.log("\n🎉 COURSE QUERY API TEST COMPLETED SUCCESSFULLY! 🎉\n");
    } catch (error) {
      ApiTestHelper.logger.error(`API Test Failed: ${error.message}`);
    }
  }

  return {
    run: run
  };

})();
