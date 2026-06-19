/**
 * @file Student_RegistrationResponseEnvelopeTests.js
 * API test to verify Response Envelope formatting for Student Registration.
 * 
 * Instructions: Run `Student_RegistrationResponseEnvelopeTests.run()` from the Apps Script editor.
 */

const Student_RegistrationResponseEnvelopeTests = (function () {

  function run() {
    const { logger } = ApiTestHelper;

    console.log("\n🧪 STARTING STUDENT REGISTRATION RESPONSE ENVELOPE API TEST SUITE 🧪");

    const superToken = typeof PropertiesService !== "undefined"
      ? PropertiesService.getScriptProperties().getProperty("DEV_SUPER_TOKEN")
      : null;

    const stats = { passed: 0, failed: 0, scenarios: [] };

    function runScenario(name, fn) {
      try {
        fn();
        stats.passed++;
        stats.scenarios.push({ name: name, status: "PASSED" });
      } catch (error) {
        stats.failed++;
        stats.scenarios.push({ name: name, status: "FAILED", error: error.message });
        throw error;
      }
    }

    let createdStudentId = null;

    try {
      // Scenario 1: Verify Happy-Path Success Envelope Format
      runScenario("Scenario 1: Success Response Envelope", () => {
        const suffix = Math.random().toString(36).substring(7).toUpperCase();
        const uniqueEmail = `envelope.success.${suffix.toLowerCase()}@example.com`;
        const uniqueMobile = "9" + Math.floor(100000000 + Math.random() * 900000000);

        const payload = {
          profile: {
            student_name: `Success Envelope Student ${suffix}`,
            email: uniqueEmail,
            gender: "Male"
          },
          address: {
            line1: "123 Success St",
            city: "Pune",
            state: "Maharashtra",
            pin_code: "411001"
          },
          contact: {
            mobile_number: uniqueMobile
          }
        };

        logger.action("Dispatching student_register with valid payload...");
        const res = _dispatch("student_register", payload, superToken);

        logger.data("Success Envelope Output", res);

        // Assertions
        if (res.success !== true) {
          throw new Error(`Expected success property to be true, got: ${res.success}`);
        }
        if (!res.data || !res.data.student_id) {
          throw new Error("Success envelope missing data.student_id");
        }
        createdStudentId = res.data.student_id;

        if (!res.data._presentation || !res.data._presentation.toast_message) {
          throw new Error("Success envelope missing data._presentation.toast_message");
        }
        if (typeof res.context.execution_time_ms !== "number") {
          throw new Error(`Success envelope missing or invalid context.execution_time_ms: ${res.context.execution_time_ms}`);
        }
        if (res.context.mutated_records_count === undefined || res.context.mutated_records_count === 0) {
          throw new Error("Success envelope missing or zero context.mutated_records_count");
        }
        if (!Array.isArray(res.context.mutated_records) || res.context.mutated_records.length === 0) {
          throw new Error("Success envelope missing or empty context.mutated_records array");
        }
        if (!res.meta || !res.meta.environment || !res.meta.timestamp) {
          throw new Error("Success envelope missing meta block properties");
        }
        if (res.meta.version !== SYSTEM_VERSION) {
          throw new Error(`Meta version mismatch: expected ${SYSTEM_VERSION}, got ${res.meta.version}`);
        }
        logger.success("Success response envelope conforms to standard.");
      });

      // Scenario 2.1: Verify Action-Level Failure Response Envelope (Missing required student_name)
      runScenario("Scenario 2.1: Action-Level Failure Response Envelope", () => {
        const payload = {
          profile: {
            email: "envelope.fail.action@example.com"
          }
        };

        logger.action("Dispatching student_register without student_name...");
        const res = _dispatch("student_register", payload, superToken);

        logger.data("Action-Level Failure Envelope Output", res);

        // Assertions
        if (res.success !== false) {
          throw new Error(`Expected failure envelope success property to be false, got: ${res.success}`);
        }
        if (!res.error || res.error.code !== "ACTION_VALIDATION_FAILURE") {
          throw new Error(`Expected error.code 'ACTION_VALIDATION_FAILURE', got: ${res.error ? res.error.code : 'undefined'}`);
        }
        if (!res.error.message) {
          throw new Error("Failure envelope missing error.message");
        }
        if (typeof res.context.execution_time_ms !== "number") {
          throw new Error(`Failure envelope missing or invalid context.execution_time_ms: ${res.context.execution_time_ms}`);
        }
        if (res.context.transaction_status !== "FAILED") {
          throw new Error(`Expected transaction_status 'FAILED', got: ${res.context.transaction_status}`);
        }
        if (!res.meta || !res.meta.correlation_id || !res.meta.timestamp) {
          throw new Error("Failure envelope missing meta block properties");
        }
        if (res.meta.version !== SYSTEM_VERSION) {
          throw new Error(`Meta version mismatch: expected ${SYSTEM_VERSION}, got ${res.meta.version}`);
        }
        logger.success("Action-level failure response envelope conforms to standard.");
      });

      // Scenario 2.2: Verify Schema-Level Failure Response Envelope (Missing multiple required Address fields)
      runScenario("Scenario 2.2: Schema-Level Failure Response Envelope", () => {
        const suffix = Math.random().toString(36).substring(7).toUpperCase();
        const uniqueEmail = `envelope.fail.schema.${suffix.toLowerCase()}@example.com`;
        const uniqueMobile = "9" + Math.floor(100000000 + Math.random() * 900000000);

        const payload = {
          profile: {
            student_name: `Fail Schema Student ${suffix}`,
            email: uniqueEmail,
            gender: "Male"
          },
          address: {
            // missing line1 and state which are required by Address schema
            city: "Pune",
            pin_code: "411001"
          },
          contact: {
            mobile_number: uniqueMobile
          }
        };

        logger.action("Dispatching student_register with missing Address fields line1 and state...");
        const res = _dispatch("student_register", payload, superToken);

        logger.data("Schema-Level Failure Envelope Output", res);

        // Assertions
        if (res.success !== false) {
          throw new Error(`Expected failure envelope success property to be false, got: ${res.success}`);
        }
        if (!res.error || res.error.code !== "VALIDATION_FAILURE") {
          throw new Error(`Expected error.code 'VALIDATION_FAILURE', got: ${res.error ? res.error.code : 'undefined'}`);
        }
        
        // Verify multiple field validation errors were collected
        if (!res.error.details || !Array.isArray(res.error.details.errors)) {
          throw new Error("Expected res.error.details.errors to be an array of validation errors.");
        }
        const errorFields = res.error.details.errors.map(err => err.fieldName);
        if (!errorFields.includes("line1") || !errorFields.includes("state")) {
          throw new Error(`Expected errors for both 'line1' and 'state', but got: ${JSON.stringify(errorFields)}`);
        }

        if (typeof res.context.execution_time_ms !== "number") {
          throw new Error(`Failure envelope missing or invalid context.execution_time_ms: ${res.context.execution_time_ms}`);
        }
        if (res.context.transaction_status !== "ROLLED_BACK") {
          throw new Error(`Expected transaction_status 'ROLLED_BACK', got: ${res.context.transaction_status}`);
        }
        if (!res.meta || !res.meta.correlation_id || !res.meta.timestamp) {
          throw new Error("Failure envelope missing meta block properties");
        }
        if (res.meta.version !== SYSTEM_VERSION) {
          throw new Error(`Meta version mismatch: expected ${SYSTEM_VERSION}, got ${res.meta.version}`);
        }
        logger.success("Schema-level failure response envelope correctly collected multiple validation errors.");
      });

      console.log("\n🎉 RESPONSE ENVELOPE TEST SUITE COMPLETED SUCCESSFULLY! 🎉\n");
    } catch (error) {
      logger.error(`Response Envelope Test Suite halted due to critical error: ${error.message}`);
    } finally {
      // Print Summary before Teardown
      console.log("\n=========================================");
      console.log("📊 API TEST RUNNER SUMMARY:");
      console.log(`   - Scenarios Run     : ${stats.passed + stats.failed}`);
      console.log(`   - Successful Steps  : ${stats.passed}`);
      console.log(`   - Failed Steps      : ${stats.failed}`);
      console.log("\n   - Details:");
      stats.scenarios.forEach((s) => {
        const marker = s.status === "PASSED" ? "✅" : "❌";
        console.log(`     ${marker} ${s.name} : ${s.status}`);
        if (s.error) {
          console.log(`         ↳ Error: ${s.error}`);
        }
      });
      console.log("=========================================\n");

      // Cleanup created student record if any
      if (createdStudentId) {
        logger.phase("N: Teardown and Cleanup");
        try {
          const db = DBContext.getInstance();
          const contact = db.ContactInfo.findOne({ student_id: createdStudentId });
          if (contact) db.ContactInfo.remove(contact.contact_id);
          const addr = db.Address.findOne({ student_id: createdStudentId });
          if (addr) db.Address.remove(addr.address_id);
          db.Student.remove(createdStudentId);
          logger.success(`Cleaned up student record: ${createdStudentId}`);
        } catch (cleanupErr) {
          logger.error(`Failed to clean up student ${createdStudentId}: ${cleanupErr.message}`);
        }
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

  return {
    run: run
  };

})();

function runStudentRegistrationResponseEnvelopeTests() {
  Student_RegistrationResponseEnvelopeTests.run();
}
