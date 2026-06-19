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
    
    const superToken = typeof PropertiesService !== "undefined"
      ? PropertiesService.getScriptProperties().getProperty("DEV_SUPER_TOKEN")
      : null;

    if (!superToken) {
      logger.detail("⚠️ DEV_SUPER_TOKEN not found. Running without token...");
    } else {
      logger.success("🔑 Bootstrapped Super Token loaded.");
    }

    let createdLeadId = null;
    let envelopeLeadId = null;

    try {
      const batchId = _getOrCreateTestBatch(logger, callApi, superToken);
      
      // Phase 1: Register lead with dynamic/unique credentials
      createdLeadId = _testCreateLead(batchId, logger, callApi, superToken);
      
      // Phase 2: Negative/Validation flow
      _testValidation(batchId, logger, callApi, superToken);
      
      // Phase 3: Retrieve lead via QueryEngine
      _verifyLeadQuery(createdLeadId, logger, callApi, superToken);
      
      // Phase 4: ORM Update check
      _testUpdate(createdLeadId, logger);

      // Phase 5: Test Success & Failure Response Envelope Formats
      envelopeLeadId = _testResponseEnvelopeFormats(batchId, logger, superToken);

      console.log("\n🎉 STUDENT LEAD API TEST SUITE COMPLETED SUCCESSFULLY! 🎉\n");
    } catch (error) {
      ApiTestHelper.logger.error(`API Test Suite Failed: ${error.message}`);
    } finally {
      const db = DBContext.getInstance();
      if (createdLeadId || envelopeLeadId) {
        logger.phase("N: Teardown and Cleanup");
        [createdLeadId, envelopeLeadId].forEach(id => {
          if (id) {
            try {
              db.StudentLead.remove(id);
              logger.success(`Cleaned up student lead: ${id}`);
            } catch (cleanupErr) {
              logger.error(`Failed to clean up student lead ${id}: ${cleanupErr.message}`);
            }
          }
        });
      }
    }
  }

  function _dispatch(action, payload, token = null) {
    const mockEvent = {
      postData: {
        contents: JSON.stringify({ action, token, payload })
      }
    };
    const output = ApiDispatcher.dispatch(mockEvent);
    return output.getContent ? JSON.parse(output.getContent()) : output;
  }

  function _getOrCreateTestBatch(logger, callApi, superToken) {
    logger.phase("0: Resolve Batch Dependency");
    logger.action("Querying for an active Batch...");
    const result = callApi("data_query", {
      target: "Batch",
      where: { status: "active" }
    }, superToken);

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
    }, superToken);
    
    const course = callApi("academic_create_course", {
      segment_id: courseType.segment_id,
      name: "Lead API Temp Course",
      base_fee: 1000,
      language_medium: "English",
      entity_type: "subject"
    }, superToken);

    const batch = callApi("academic_create_batch", {
      item_id: course.course_id,
      batch_name: "Lead API Temp Batch",
      batch_type: "Academy",
      capacity: 20
    }, superToken);

    logger.success(`Temporary Batch created: ${batch.batch_id}`);
    return batch.batch_id;
  }

  function _testCreateLead(batchId, logger, callApi, superToken) {
    logger.phase("1: Create Student Lead (API Test)");

    const suffix = Math.random().toString(36).substring(7).toUpperCase();
    const uniqueMobile = "9" + Math.floor(100000000 + Math.random() * 900000000);
    const uniqueEmail = `lead_${suffix.toLowerCase()}@example.com`;

    const payload = {
      leadData: {
        student_name: `Lead API Tester ${suffix}`,
        phone: uniqueMobile,
        email: uniqueEmail,
        batch_id: batchId,
        lead_source: "online",
        priority: "hot",
        status: "prospect"
      }
    };

    logger.action("Executing student_add_lead action...");
    const lead = callApi("student_add_lead", payload, superToken);
    
    if (!lead || !lead.lead_id) {
      throw new Error("Created lead does not contain a lead_id.");
    }
    if (!lead.lead_id.startsWith("SLD-")) {
      throw new Error(`Expected lead_id to start with 'SLD-', but got '${lead.lead_id}'`);
    }
    if (lead.student_name !== `Lead API Tester ${suffix}`) {
      throw new Error(`Expected student_name 'Lead API Tester ${suffix}', but got '${lead.student_name}'`);
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

  function _testValidation(batchId, logger, callApi, superToken) {
    logger.phase("2: Validate Required Parameter Checks");

    logger.action("Testing missing leadData...");
    try {
      callApi("student_add_lead", {}, superToken);
      throw new Error("Validation failed: student_add_lead succeeded without leadData.");
    } catch (e) {
      logger.success(`Validation correctly blocked missing leadData: ${e.message}`);
    }

    logger.action("Testing missing student_name...");
    try {
      callApi("student_add_lead", { leadData: { phone: "12345", batch_id: batchId } }, superToken);
      throw new Error("Validation failed: student_add_lead succeeded without student_name.");
    } catch (e) {
      logger.success(`Validation correctly blocked missing student_name: ${e.message}`);
    }

    logger.action("Testing missing phone...");
    try {
      callApi("student_add_lead", { leadData: { student_name: "No Phone Student", batch_id: batchId } }, superToken);
      throw new Error("Validation failed: student_add_lead succeeded without phone.");
    } catch (e) {
      logger.success(`Validation correctly blocked missing phone: ${e.message}`);
    }

    logger.action("Testing missing batch_id...");
    try {
      callApi("student_add_lead", { leadData: { student_name: "No Batch Student", phone: "9876543210" } }, superToken);
      throw new Error("Validation failed: student_add_lead succeeded without batch_id.");
    } catch (e) {
      logger.success(`Validation correctly blocked missing batch_id: ${e.message}`);
    }
  }

  function _verifyLeadQuery(leadId, logger, callApi, superToken) {
    logger.phase("3: Verify Lead Retrieval via QueryEngine");

    const queryPayload = {
      target: "StudentLead",
      where: { lead_id: leadId }
    };

    logger.action("Fetching Student Lead via QueryEngine...");
    const result = callApi("data_query", queryPayload, superToken);

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

    if (!lead.student_name.startsWith("Lead API Tester")) {
      throw new Error(`Data mismatch on query: Expected student_name starting with 'Lead API Tester', got '${lead.student_name}'`);
    }

    logger.success("Verification successful.");
  }

  function _testUpdate(leadId, logger) {
    logger.phase("4: ORM Structural Check (Update)");

    const db = DBContext.getInstance();

    logger.action("Testing ORM Update of status...");
    const updated = db.StudentLead.update(leadId, { status: "contacted" });
    if (updated.status !== "contacted") {
      throw new Error(`ORM Update failed. Expected status 'contacted', got '${updated.status}'`);
    }
    logger.success("ORM Update Passed");
  }

  function _testResponseEnvelopeFormats(batchId, logger, superToken) {
    logger.phase("5: Test Success & Failure Response Envelope Formats");

    // A. Verify Happy-Path Success Envelope Format
    logger.action("Verifying happy-path success envelope format...");
    const suffix = Math.random().toString(36).substring(7).toUpperCase();
    const uniqueMobile = "9" + Math.floor(100000000 + Math.random() * 900000000);
    const uniqueEmail = `envelope_${suffix.toLowerCase()}@example.com`;

    const payload = {
      leadData: {
        student_name: `Envelope Tester ${suffix}`,
        phone: uniqueMobile,
        email: uniqueEmail,
        batch_id: batchId,
        lead_source: "online",
        priority: "hot",
        status: "prospect"
      }
    };

    const successRes = _dispatch("student_add_lead", payload, superToken);

    logger.data("Success Envelope Output", successRes);

    if (successRes.success !== true) {
      throw new Error(`Expected success envelope success property to be true, got: ${successRes.success}`);
    }
    if (!successRes.data || !successRes.data.lead_id) {
      throw new Error("Success envelope missing data.lead_id");
    }
    if (!successRes.data._presentation || !successRes.data._presentation.toast_message) {
      throw new Error("Success envelope missing data._presentation.toast_message");
    }
    if (typeof successRes.context.execution_time_ms !== "number") {
      throw new Error(`Success envelope missing or invalid context.execution_time_ms: ${successRes.context.execution_time_ms}`);
    }
    if (successRes.context.mutated_records_count === undefined) {
      throw new Error("Success envelope missing context.mutated_records_count");
    }
    if (!Array.isArray(successRes.context.mutated_records)) {
      throw new Error("Success envelope missing context.mutated_records array");
    }
    if (!successRes.meta || !successRes.meta.environment || !successRes.meta.timestamp) {
      throw new Error("Success envelope missing meta block properties");
    }

    logger.success("Success response envelope conforms to standard.");

    // B. Verify Failure Envelope Format
    logger.action("Verifying validation-failure envelope format...");
    const failureRes = _dispatch("student_add_lead", {}, superToken);

    logger.data("Failure Envelope Output", failureRes);

    if (failureRes.success !== false) {
      throw new Error(`Expected failure envelope success property to be false, got: ${failureRes.success}`);
    }
    if (!failureRes.error || failureRes.error.code !== "ACTION_VALIDATION_FAILURE") {
      throw new Error(`Expected error.code 'ACTION_VALIDATION_FAILURE', got: ${failureRes.error ? failureRes.error.code : 'undefined'}`);
    }
    if (!failureRes.error.message) {
      throw new Error("Failure envelope missing error.message");
    }
    if (typeof failureRes.context.execution_time_ms !== "number") {
      throw new Error(`Failure envelope missing or invalid context.execution_time_ms: ${failureRes.context.execution_time_ms}`);
    }
    if (!failureRes.meta || !failureRes.meta.correlation_id || !failureRes.meta.timestamp) {
      throw new Error("Failure envelope missing meta block properties");
    }

    logger.success("Failure response envelope conforms to standard.");

    return successRes.data.lead_id;
  }

  return {
    run: run
  };

})();

function runStudentLeadTest() {
  StudentLead_ApiTest.run();
}


