// Local unit test utilizing the original BaseAction and Errors from the codebase
const fs = require("fs");
const path = require("path");

console.log("=== [DazzlingDB Local Test Suite: Loading Original BaseAction] ===\n");

try {
  // 1. Load Errors.js in the global context
  const errorsPath = path.join(__dirname, "../Errors.js");
  console.log(`Loading production Errors from: ${errorsPath}`);
  const errorsCode = fs.readFileSync(errorsPath, "utf8");
  eval(errorsCode); // Automatically registers SystemError, BaseActionError, ActionValidationError, etc. globally

  // 2. Load BaseActions.js in the global context
  const baseActionsPath = path.join(__dirname, "../DBServices/BaseActions.js");
  console.log(`Loading production BaseAction from: ${baseActionsPath}`);
  let baseActionsCode = fs.readFileSync(baseActionsPath, "utf8");
  // Expose BaseAction to the Node.js global context
  baseActionsCode += "\nglobal.BaseAction = BaseAction;";
  eval(baseActionsCode);

  console.log("✅ Production files successfully loaded into Node.js environment.\n");
} catch (error) {
  console.error("❌ Failed to load production dependency files:", error.message);
  process.exit(1);
}

// 3. Define the Legacy Action (Does NOT normalize casing, inherits from original BaseAction)
class LegacyUpdatePackageAction extends BaseAction {
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (p.courses && Array.isArray(p.courses)) {
      p.courses.forEach(item => {
        // Strict choices check WITHOUT casing normalization
        if (item.entity_type !== "course" && item.entity_type !== "subject") {
          throw new ActionValidationError(
            `Invalid polymorphic type '${item.entity_type}'. Casing must be strictly lowercase.`
          );
        }
      });
    }
  }
}

// 4. Define the Modern Action (Proposed Fix: Casing Normalization + Trimming + Validation)
class UpdatePackageAction extends BaseAction {
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.package_id) {
      throw new ActionValidationError("Payload must contain 'package_id'.");
    }

    // Proposed Fix: Casing Normalization & Polymorphic Validation
    if (p.courses && Array.isArray(p.courses)) {
      p.courses.forEach(item => {
        // Normalization (automatically lowercase and trim whitespace)
        if (typeof item.entity_type === "string") {
          item.entity_type = item.entity_type.toLowerCase().trim();
        }

        // Strict Choices check (matching PackageItem.json schema choices)
        if (item.entity_type !== "course" && item.entity_type !== "subject") {
          throw new ActionValidationError(
            `Invalid polymorphic type '${item.entity_type}'. Allowed values are strictly 'course' or 'subject'.`
          );
        }
      });
    }
  }
}

// 5. Run the Test Scenarios
console.log("--------------------------------------------------\n");

// Scenario A: Capitalized Input Casing (Should be normalized successfully)
try {
  const payload = {
    package_id: "PKG-77A91",
    courses: [
      { entity_type: "Course", entity_id: "CRS-9A8D7C" },
      { entity_type: "Subject", entity_id: "SUB-10B22" }
    ]
  };
  // BaseAction requires a 'db' parameter, so we pass a mock empty object
  const action = new UpdatePackageAction({ db: {}, params: { payload } });
  
  console.log("Scenario A: Capitalized Input Normalization");
  console.log("  Input types: 'Course', 'Subject'");
  action._validate();
  console.log("  ✅ SUCCESS: Casing normalized successfully.");
  console.log("  Normalized Output:", JSON.stringify(payload.courses));
} catch (e) {
  console.log("  ❌ FAILED:", e.message);
}

console.log("\n--------------------------------------------------\n");

// Scenario B: Invalid Polymorphic Values (Should be rejected)
try {
  const payload = {
    package_id: "PKG-77A91",
    courses: [
      { entity_type: "invalid_type", entity_id: "CRS-9A8D7C" }
    ]
  };
  const action = new UpdatePackageAction({ db: {}, params: { payload } });

  console.log("Scenario B: Invalid Polymorphic Values Rejection");
  console.log("  Input type: 'invalid_type'");
  action._validate();
  console.log("  ❌ FAILED: Validation failed to reject invalid type.");
} catch (e) {
  if (e instanceof ActionValidationError) {
    console.log("  ✅ SUCCESS: Successfully caught invalid type!");
    console.log("  Error Message:", e.message);
  } else {
    console.log("  ❌ FAILED: Threw unexpected error:", e.message);
  }
}

console.log("\n--------------------------------------------------\n");

// Scenario C: Case Mismatch Without Normalization (Legacy Validation Failure)
try {
  const payload = {
    package_id: "PKG-77A91",
    courses: [
      { entity_type: "Course", entity_id: "CRS-9A8D7C" }
    ]
  };
  const action = new LegacyUpdatePackageAction({ db: {}, params: { payload } });

  console.log("Scenario C: Case Mismatch Without Normalization (Legacy Action)");
  console.log("  Input type: 'Course'");
  action._validate();
  console.log("  ❌ FAILED: Legacy action failed to catch case-mismatch.");
} catch (e) {
  if (e instanceof ActionValidationError) {
    console.log("  ✅ SUCCESS: Legacy action successfully caught case-mismatch and threw validation error!");
    console.log("  Error Message:", e.message);
  } else {
    console.log("  ❌ FAILED: Threw unexpected error:", e.message);
  }
}

console.log("\n--------------------------------------------------\n");

// Scenario D: Untrimmed String Normalization
try {
  const payload = {
    package_id: "PKG-77A91",
    courses: [
      { entity_type: "  course   ", entity_id: "CRS-9A8D7C" },
      { entity_type: "  subject ", entity_id: "SUB-10B22" }
    ]
  };
  const action = new UpdatePackageAction({ db: {}, params: { payload } });

  console.log("Scenario D: Untrimmed String Normalization");
  console.log("  Input types: '  course   ', '  subject '");
  action._validate();
  console.log("  ✅ SUCCESS: Spaces successfully trimmed.");
  console.log("  Normalized Output:", JSON.stringify(payload.courses));
} catch (e) {
  console.log("  ❌ FAILED:", e.message);
}
