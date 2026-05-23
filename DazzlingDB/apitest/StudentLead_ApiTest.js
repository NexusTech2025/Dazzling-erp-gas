/**
 * @file StudentLead_ApiTest.js
 * API Test for Student Lead Management using ApiTestHelper.
 * 
 * Instructions: Run `StudentLead_ApiTest.run()` from the Apps Script editor.
 */

const StudentLead_ApiTest = (function () {

  function run() {
    const { logger, callApi } = ApiTestHelper;

    console.log("\n🧪 STARTING STUDENT LEAD API TEST SUITE 🧪");

    try {
      const batchId = _getOrCreateTestBatch(logger, callApi);
      const leadId = _testCreateLead(batchId, logger, callApi);
      _testValidation(batchId, logger, callApi);
      _verifyLeadQuery(leadId, logger, callApi);
      _testUpdateAndDelete(leadId, logger);

      console.log("\n🎉 STUDENT LEAD API TEST SUITE COMPLETED SUCCESSFULLY! 🎉\n");
    } catch (error) {
      ApiTestHelper.logger.error(`API Test Suite Failed: ${error.message}`);
    }
  }

  function _getOrCreateTestBatch(logger, callApi) {
    logger.phase("0: Resolve Batch Dependency");
    logger.action("Querying for an active Batch...");
    const result = callApi("data_query", {
      target: "Batch",
      where: { status: "active" }
    });

    if (result && result.data && result.data.length > 0) {
      const batchId = result.data[0].batch_id;
      logger.success(`Found active Batch: ${batchId}`);
      return batchId;
    }

    logger.detail("No active Batch found. Creating temporary academic configuration...");
    const courseType = callApi("academic_create_course_type", {
      segment_name: "Lead_API_Temp_Segment",
      entity_label: "Subject",
      description: "Temporary segment for Lead API testing."
    });
    
    const course = callApi("academic_create_course", {
      segment_id: courseType.segment_id,
      name: "Lead API Temp Course",
      base_fee: 1000,
      language_medium: "English",
      entity_type: "subject"
    });

    const batch = callApi("academic_create_batch", {
      item_id: course.course_id,
      batch_name: "Lead API Temp Batch",
      batch_type: "Academy",
      capacity: 20
    });

    logger.success(`Temporary Batch created: ${batch.batch_id}`);
    return batch.batch_id;
  }

  function _testCreateLead(batchId, logger, callApi) {
    logger.phase("1: Create Student Lead (API Test)");

    const payload = {
      leadData: {
        student_name: "Lead API Tester",
        phone: "9988776655",
        email: "lead.api.test@example.com",
        batch_id: batchId,
        lead_source: "online",
        priority: "hot",
        status: "prospect"
      }
    };

    logger.action("Executing student_add_lead action...");
    const lead = callApi("student_add_lead", payload);
    
    if (!lead || !lead.lead_id) {
      throw new Error("Created lead does not contain a lead_id.");
    }
    if (!lead.lead_id.startsWith("SLD-")) {
      throw new Error(`Expected lead_id to start with 'SLD-', but got '${lead.lead_id}'`);
    }
    if (lead.student_name !== "Lead API Tester") {
      throw new Error(`Expected student_name 'Lead API Tester', but got '${lead.student_name}'`);
    }
    if (lead.batch_id !== batchId) {
      throw new Error(`Expected batch_id '${batchId}', but got '${lead.batch_id}'`);
    }
    if (lead.is_registered !== false) {
      throw new Error(`Expected is_registered to be false, but got '${lead.is_registered}'`);
    }

    logger.success(`Student Lead Created with ID: ${lead.lead_id}`);
    return lead.lead_id;
  }

  function _testValidation(batchId, logger, callApi) {
    logger.phase("2: Validate Required Parameter Checks");

    logger.action("Testing missing leadData...");
    try {
      callApi("student_add_lead", {});
      throw new Error("Validation failed: student_add_lead succeeded without leadData.");
    } catch (e) {
      logger.success(`Validation correctly blocked missing leadData: ${e.message}`);
    }

    logger.action("Testing missing student_name...");
    try {
      callApi("student_add_lead", { leadData: { phone: "12345", batch_id: batchId } });
      throw new Error("Validation failed: student_add_lead succeeded without student_name.");
    } catch (e) {
      logger.success(`Validation correctly blocked missing student_name: ${e.message}`);
    }

    logger.action("Testing missing phone...");
    try {
      callApi("student_add_lead", { leadData: { student_name: "No Phone Student", batch_id: batchId } });
      throw new Error("Validation failed: student_add_lead succeeded without phone.");
    } catch (e) {
      logger.success(`Validation correctly blocked missing phone: ${e.message}`);
    }

    logger.action("Testing missing batch_id...");
    try {
      callApi("student_add_lead", { leadData: { student_name: "No Batch Student", phone: "9876543210" } });
      throw new Error("Validation failed: student_add_lead succeeded without batch_id.");
    } catch (e) {
      logger.success(`Validation correctly blocked missing batch_id: ${e.message}`);
    }
  }

  function _verifyLeadQuery(leadId, logger, callApi) {
    logger.phase("3: Verify Lead Retrieval via QueryEngine");

    const queryPayload = {
      target: "StudentLead",
      where: { lead_id: leadId }
    };

    logger.action("Fetching Student Lead via QueryEngine...");
    const result = callApi("data_query", queryPayload);

    if (!result || !result.data || result.data.length === 0) {
      throw new Error(`Student lead '${leadId}' not found in query results.`);
    }

    const lead = result.data[0];
    logger.data("Query Results", {
      id: lead.lead_id,
      name: lead.student_name,
      phone: lead.phone,
      email: lead.email,
      status: lead.status
    });

    if (lead.student_name !== "Lead API Tester") {
      throw new Error(`Data mismatch on query: Expected student_name 'Lead API Tester', got '${lead.student_name}'`);
    }

    logger.success("Verification successful.");
  }

  function _testUpdateAndDelete(leadId, logger) {
    logger.phase("4: ORM Structural Check (Update & Delete)");

    const db = DBContext.getInstance();

    logger.action("Testing ORM Update of status...");
    const updated = db.StudentLead.update(leadId, { status: "contacted" });
    if (updated.status !== "contacted") {
      throw new Error(`ORM Update failed. Expected status 'contacted', got '${updated.status}'`);
    }
    logger.success("ORM Update Passed");

    logger.action("Testing ORM Delete...");
    const deleted = db.StudentLead.remove(leadId);
    if (!deleted) {
      throw new Error("ORM Delete failed.");
    }
    logger.success("ORM Delete Passed");
  }

  return {
    run: run
  };

})();

function runStudentLeadTest() {
  StudentLead_ApiTest.run();
}
