/**
 * @file Code.js
 * Primary Entry Point for DazzlingDB Application.
 */

/**
 * Registers custom validation handlers in the global ValidationRegistry.
 */
function registerDatabaseValidators() {
  console.log("[App] Registering database custom validators...");
  if (typeof SheetDB !== 'undefined' && typeof SheetDB.ValidationRegistry !== 'undefined') {
    // Bulk register all custom validators
    SheetDB.ValidationRegistry.registerMany({
      validateEmail: function (value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(String(value)) ? null : "Invalid email address.";
      },
      validatePositiveTotalMarks: function(value) {
        const num = Number(value);
        return (!isNaN(num) && num > 0) ? null : "total_marks must be a positive number.";
      },
      validatePassingMarks: function(value, context) {
        const totalMarks = context.model.total_marks;
        const passingMarks = Number(value);
        if (isNaN(passingMarks) || passingMarks < 0 || passingMarks > totalMarks) {
          return "passing_marks must be a non-negative number and cannot exceed total_marks.";
        }
        return null;
      },
      validateObtainedMarks: function(value, context) {
        const isAbsent = context.model.is_absent === true || context.model.is_absent === "true";
        if (isAbsent) {
          return (value === null || value === undefined || value === "") ? null : "obtained_marks must be null when student is absent.";
        }
        if (value === undefined || value === null || value === "") {
          return "obtained_marks is required when present.";
        }
        const marks = Number(value);
        if (isNaN(marks) || marks < 0) {
          return "obtained_marks must be a non-negative number.";
        }
        const totalMarks = context.model.__totalMarks !== undefined ? context.model.__totalMarks : (context.db && context.model.test_id ? context.db.Test.findById(context.model.test_id)?.total_marks : null);
        if (totalMarks !== null && totalMarks !== undefined && marks > totalMarks) {
          return `obtained_marks (${marks}) cannot exceed total_marks (${totalMarks}) for student '${context.model.student_id}'.`;
        }
        return null;
      },
      validateStudentAllocation: function(value, context) {
        const model = context.model;
        if (model.__allowedStudents) {
          if (!model.__allowedStudents.has(value)) {
            const db = context.db;
            const test = db ? db.Test.findById(model.test_id) : null;
            const batchId = test ? test.batch_id : "Unknown";
            return `Student '${value}' is not allocated to Batch '${batchId}'.`;
          }
          return null;
        }
        const db = context.db;
        if (db && model.test_id && value) {
          const test = db.Test.findById(model.test_id);
          if (test) {
            const allocation = db.BatchAllocation.findOne({
              student_id: value,
              batch_id: test.batch_id,
              status: "active"
            });
            if (!allocation) {
              return `Student '${value}' is not allocated to Batch '${test.batch_id}'.`;
            }
          }
        }
        return null;
      }
    });
  }
}

/**
 * Registers polymorphic shorthand type mappings.
 */
function registerPolymorphicMappings() {
  console.log("[App] Registering polymorphic mappings...");
  if (typeof SheetDB !== 'undefined' && typeof SheetDB.PolymorphicRegistry !== 'undefined') {
    SheetDB.PolymorphicRegistry.register("course", "Course");
    SheetDB.PolymorphicRegistry.register("package", "Package");
    SheetDB.PolymorphicRegistry.register("subject", "Course");
    SheetDB.PolymorphicRegistry.register("staff", "StaffMember");
    SheetDB.PolymorphicRegistry.register("student", "Student");
    SheetDB.PolymorphicRegistry.register("teacher", "Teacher");
  }
}

/**
 * Bootstraps the database and provisions infrastructure.
 * Run this once to setup the physical spreadsheets.
 */
function bootstrapDatabase() {
  // Execute the validation registration hook prior to boot
  registerDatabaseValidators();

  const db = DBContext.getInstance();

  console.log("[App] Starting Physical Provisioning...");
  try {
    const result = db.setup.provision();

    if (result.errors && result.errors.length > 0) {
      console.warn(`[App] Provisioning finished with ${result.errors.length} error(s):`);
      result.errors.forEach(err => console.warn(` - ${err}`));
    }

    // Cleanup orphaned physical worksheets
    try {
      console.log("[App] Cleaning up legacy/orphaned physical worksheets...");
      const schema = DATABASE_SCHEMA;
      const fs = db.setup.fs;
      for (const [catName, catData] of Object.entries(schema.categories)) {
        const fileMeta = fs.findByName(catName);
        if (fileMeta) {
          const ss = fs.open(fileMeta.id);
          const sheets = ss.getSheets();
          const declaredTables = Object.keys(catData.tables);
          sheets.forEach(sheet => {
            const sheetName = sheet.getName();
            // Do not delete system sheets
            if (sheetName !== '__meta__' && sheetName !== '__tx_log__' && !declaredTables.includes(sheetName)) {
              console.log(`[App] Deleting orphaned sheet '${sheetName}' from spreadsheet '${catName}'`);
              ss.deleteSheet(sheet);
            }
          });
        }
      }
    } catch (cleanError) {
      console.warn("[App] Orphaned worksheet cleanup encountered an error:", cleanError.message || cleanError);
    }

    if (result.isChanged) {
      console.log("[App] Provisioning Complete. Changes applied:");
      if (result.createdFiles && result.createdFiles.length > 0) {
        console.log(` - Files Created: ${result.createdFiles.join(', ')}`);
      }
      if (result.createdSheets && result.createdSheets.length > 0) {
        console.log(` - Sheets Created: ${result.createdSheets.join(', ')}`);
      }
      if (result.updatedHeaders && result.updatedHeaders.length > 0) {
        console.log(` - Headers Updated: ${result.updatedHeaders.join(', ')}`);
      }
      if (result.metaUpdated && result.metaUpdated.length > 0) {
        console.log(` - Metadata Sheets Updated: ${result.metaUpdated.join(', ')}`);
      }
    } else {
      console.log("[App] Provisioning Complete. Database is already up to date (No changes required).");
    }
    return result;
  } catch (error) {
    console.error("[App] Fatal Error during database provisioning:", error.message || error);
    throw error;
  }
}

/**
 * Verifies the connection and health of the database.
 */
function verifyDatabase() {
  const status = DBContext.ping();
  console.log("[App] Health Status:", JSON.stringify(status, null, 2));
}

/**
 * HTTP Entry Point: POST requests
 */
function doPost(e) {
  try {
    return ApiDispatcher.dispatch(e);
  } catch (error) {
    console.error("[Code] Fatal Error in doPost:", error);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: { message: error.message || "Internal Server Error" }
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * HTTP Entry Point: GET requests
 */
function doGet(e) {
  const ui = e.parameter.ui;

  if (ui === 'test') {
    return HtmlService.createTemplateFromFile('views/test_api')
      .evaluate()
      .setTitle("DazzlingDB - API Tester")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (ui === 'admin') {
    return getAdminPanelContent();
  }

  return ApiDispatcher.dispatch(e);
}

/**
 * BRIDGE: Allows the HTML UI to execute API logic via google.script.run.
 * Consolidates Admin and Standard actions.
 */
function executeActionViaUI(request) {
  let { action, payload, token } = request;

  console.log(`[Code] UI Action: ${action}`);

  // Handle flattened requests (where payload properties are at the top level)
  // If the frontend didn't wrap it in 'payload', we do it here.
  if (!payload) {
    const { action: a, token: t, ...rest } = request;
    payload = rest;
  }

  const mockEvent = {
    parameter: {
      action: action,
      token: token
    },
    // We MUST wrap the payload object inside a { payload: ... } envelope so that 
    // ApiDispatcher._extractParams assigns it correctly to params.payload
    postData: { contents: JSON.stringify({ payload: payload }) }
  };

  const output = ApiDispatcher.dispatch(mockEvent);

  // Handle both ContentOutput (standard) and raw objects (bootstrap)
  if (output.getContent) {
    return JSON.parse(output.getContent());
  }
  return output;
}

/**
 * Console Trigger: Executes dry-run diagnostics on Student table.
 */
function runStudentDiagnostics() {
  const db = DBContext.getInstance();
  console.log("[Diagnostics] Starting dry-run diagnostics on table 'Student'...");
  const result = db.setup.diagnose('Student');
  console.log("[Diagnostics] Result Plan:", JSON.stringify(result, null, 2));
}

/**
 * Diagnostic Trigger: Prints the active environment settings and folder mappings.
 */
function checkEnvironmentConfiguration() {
  console.log("=== [DazzlingDB Environment Diagnostics] ===");
  console.log(`Active Environment (SYSTEM_ENV): ${SYSTEM_ENV}`);
  console.log(`Root Folder Target (DATABASE_ROOT_FOLDER_ID): ${DATABASE_ROOT_FOLDER_ID}`);
  
  if (typeof PropertiesService !== 'undefined') {
    const props = PropertiesService.getScriptProperties().getProperties();
    console.log("Online Script Properties Cached:", JSON.stringify(props, null, 2));
  } else {
    console.log("GAS PropertiesService is not available in the current context.");
  }
}
