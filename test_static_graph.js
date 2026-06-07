/**
 * @file test_static_graph.js
 * Node-level unit test script for the Static Schema Graph and compiler helpers.
 */

const fs = require('fs');
const path = require('path');

console.log("🧪 Starting Node-Level Static Graph Test Suite...\n");

// 1. Mock global dependencies
globalThis.ValidationError = class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
};

// 2. Load the Graph classes
require('./SheetDB/Graph/StaticNode.js');
require('./SheetDB/Graph/StaticEdge.js');
require('./SheetDB/Graph/StaticGraph.js');
require('./SheetDB/Graph/GraphNode.js');
require('./SheetDB/Graph/GraphEdge.js');
require('./SheetDB/Graph/DynamicGraph.js');
require('./SheetDB/Graph/DynamicGraphBuilder.js');

// Helper assertion function
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
}

// Helper for verifying exceptions are thrown
function assertThrows(fn, expectedErrorName, messageSubstring) {
  try {
    fn();
    assert(false, `Expected function to throw ${expectedErrorName || 'Error'}, but it completed successfully.`);
  } catch (err) {
    if (expectedErrorName) {
      assert(err.name === expectedErrorName, `Expected error name '${expectedErrorName}', but got '${err.name}' (${err.message}).`);
    }
    if (messageSubstring) {
      assert(err.message.includes(messageSubstring), `Expected error message to contain '${messageSubstring}', but got '${err.message}'.`);
    }
  }
}

// -------------------------------------------------------------
// Test Section 1: Helper Functions Type-Safety & Robustness
// -------------------------------------------------------------
console.log("1. Testing StaticGraphBuilder._getParentTableName and _getChildTableName...");

// TestbelongsTo
const belongsToRel = {
  type: "belongsTo",
  target: "Course",
  foreignKey: "subject_id"
};
assert(
  globalThis.StaticGraphBuilder._getParentTableName("TeacherSubject", belongsToRel) === "Course",
  "belongsTo parent should be the target table"
);
assert(
  globalThis.StaticGraphBuilder._getChildTableName("TeacherSubject", belongsToRel) === "TeacherSubject",
  "belongsTo child should be the current table"
);

// Test hasMany
const hasManyRel = {
  type: "hasMany",
  target: "TeacherSubject",
  foreignKey: "subject_id"
};
assert(
  globalThis.StaticGraphBuilder._getParentTableName("Course", hasManyRel) === "Course",
  "hasMany parent should be the current table"
);
assert(
  globalThis.StaticGraphBuilder._getChildTableName("Course", hasManyRel) === "TeacherSubject",
  "hasMany child should be the target table"
);

// Test hasOne
const hasOneRel = {
  type: "hasOne",
  target: "Address",
  foreignKey: "student_id"
};
assert(
  globalThis.StaticGraphBuilder._getParentTableName("Student", hasOneRel) === "Student",
  "hasOne parent should be the current table"
);
assert(
  globalThis.StaticGraphBuilder._getChildTableName("Student", hasOneRel) === "Address",
  "hasOne child should be the target table"
);

// Error Handling: Unsupported type
const unsupportedRel = {
  type: "manyToMany",
  target: "Group",
  foreignKey: "group_id"
};
assertThrows(() => {
  globalThis.StaticGraphBuilder._getParentTableName("User", unsupportedRel);
}, "ValidationError", "Unsupported or invalid relation type");
assertThrows(() => {
  globalThis.StaticGraphBuilder._getChildTableName("User", unsupportedRel);
}, "ValidationError", "Unsupported or invalid relation type");

// Error Handling: Missing target
const missingTargetRel = {
  type: "belongsTo",
  foreignKey: "subject_id"
};
assertThrows(() => {
  globalThis.StaticGraphBuilder._getParentTableName("TeacherSubject", missingTargetRel);
}, "ValidationError", "Relation target is missing or invalid");

console.log("✅ Helper function validation tests passed.\n");

// -------------------------------------------------------------
// Test Section 2: Reconstruct Database Schema & Compile
// -------------------------------------------------------------
console.log("2. Loading local database schema files...");
const SCHEMA_DIR = path.join(__dirname, 'DazzlingDB', 'Config', 'Schema');
const schema = {
  categories: {}
};

try {
  const categories = fs.readdirSync(SCHEMA_DIR);
  categories.forEach(cat => {
    const catPath = path.join(SCHEMA_DIR, cat);
    if (!fs.statSync(catPath).isDirectory()) return;

    schema.categories[cat] = {
      tables: {}
    };

    const tableFiles = fs.readdirSync(catPath).filter(f => f.endsWith('.json'));
    tableFiles.forEach(file => {
      const tableName = path.basename(file, '.json');
      const tableData = JSON.parse(fs.readFileSync(path.join(catPath, file), 'utf8'));
      schema.categories[cat].tables[tableName] = tableData;
    });
  });
  console.log(`Loaded ${Object.keys(schema.categories).length} categories successfully.`);
} catch (err) {
  console.error("❌ Failed to load schema directory:", err);
  process.exit(1);
}

console.log("\n3. Compiling Static Graph from database schemas...");
let staticGraph;
try {
  staticGraph = globalThis.StaticGraphBuilder.compile(schema);
  console.log("✅ Static Graph compiled successfully without schema validation errors!");
} catch (err) {
  console.error("❌ Schema compilation failed:", err);
  process.exit(1);
}

// -------------------------------------------------------------
// Test Section 3: Topology Assertions (Target relations)
// -------------------------------------------------------------
console.log("\n4. Verifying compiled graph topology...");

// Assert Course table node
const courseNode = staticGraph.getNode("Course");
assert(courseNode !== null, "Course node must exist in static graph");

// Assert TeacherSubject table node
const teacherSubjectNode = staticGraph.getNode("TeacherSubject");
assert(teacherSubjectNode !== null, "TeacherSubject node must exist in static graph");

// Assert Course -> TeacherSubject relation (hasMany, foreignKey: subject_id)
const courseToTeacherSubjectEdge = courseNode.outgoing.find(
  e => e.toNode.entityName === "TeacherSubject" && e.foreignKey === "subject_id"
);
assert(courseToTeacherSubjectEdge !== undefined, "Course -> TeacherSubject edge must be present");
assert(courseToTeacherSubjectEdge.relationType === "hasMany", "Course -> TeacherSubject must be 'hasMany'");
assert(courseToTeacherSubjectEdge.onDelete === "protect", "Course -> TeacherSubject delete policy must be 'protect'");

// Assert TeacherSubject has Course as incoming parent node
const teacherSubjectIncomingCourseEdge = teacherSubjectNode.incoming.find(
  e => e.fromNode.entityName === "Course" && e.foreignKey === "subject_id"
);
assert(teacherSubjectIncomingCourseEdge !== undefined, "TeacherSubject must have incoming edge from Course");

// Assert Student -> Address relation (hasOne, onDelete: cascade)
const studentNode = staticGraph.getNode("Student");
assert(studentNode !== null, "Student node must exist");

const studentToAddressEdge = studentNode.outgoing.find(
  e => e.toNode.entityName === "Address"
);
assert(studentToAddressEdge !== undefined, "Student -> Address edge must be present");
assert(studentToAddressEdge.relationType === "hasOne", "Student -> Address must be 'hasOne'");
assert(studentToAddressEdge.onDelete === "cascade", "Student -> Address delete policy must be 'cascade'");

// Assert Polymorphic Relations (Course -> Enrollment and Package -> Enrollment via item_id)
const enrollmentNode = staticGraph.getNode("Enrollment");
assert(enrollmentNode !== null, "Enrollment node must exist");

const courseToEnrollmentEdge = courseNode.outgoing.find(
  e => e.toNode.entityName === "Enrollment" && e.foreignKey === "item_id"
);
assert(courseToEnrollmentEdge !== undefined, "Course -> Enrollment polymorphic edge must be present");
assert(courseToEnrollmentEdge.relationType === "hasMany", "Course -> Enrollment must be 'hasMany'");
assert(courseToEnrollmentEdge.onDelete === "protect", "Course -> Enrollment must use column-default onDelete policy 'protect'");

const packageNode = staticGraph.getNode("Package");
assert(packageNode !== null, "Package node must exist");

const packageToEnrollmentEdge = packageNode.outgoing.find(
  e => e.toNode.entityName === "Enrollment" && e.foreignKey === "item_id"
);
assert(packageToEnrollmentEdge !== undefined, "Package -> Enrollment polymorphic edge must be present");
assert(packageToEnrollmentEdge.relationType === "hasMany", "Package -> Enrollment must be 'hasMany'");
assert(packageToEnrollmentEdge.onDelete === "protect", "Package -> Enrollment must use column-default onDelete policy 'protect'");

// -------------------------------------------------------------
// Test Section 4: Cyclical Node Duplication Prevention
// -------------------------------------------------------------
console.log("\n5. Running Test Section 4: Cyclical Node Duplication Prevention...");

const mockGraphConfig = {
  TableA: [{ table: "TableB", fk: "a_id", onDelete: "cascade" }],
  TableB: [{ table: "TableA", fk: "b_id", onDelete: "cascade" }]
};

const mockQueryDelegate = (table, fk, parentId) => {
  if (table === "TableB" && parentId === "A-1") {
    return [{ b_id: "B-1", a_id: "A-1", _primaryKey: "b_id" }];
  }
  if (table === "TableA" && parentId === "B-1") {
    return [{ a_id: "A-1", b_id: "B-1", _primaryKey: "a_id" }];
  }
  return [];
};

const mockStaticGraph = globalThis.StaticGraphBuilder.compileFromDependencyGraph(mockGraphConfig);
const builder = new globalThis.DynamicGraphBuilder(mockStaticGraph, mockQueryDelegate);

const mockRecordA = { a_id: "A-1", _primaryKey: "a_id" };
const dynamicGraph = builder.build("TableA", "A-1", mockRecordA);

const dynamicNodes = dynamicGraph.getNodes();
assert(
  dynamicNodes.length === 2,
  `Cycle duplication check failed: expected exactly 2 nodes, found ${dynamicNodes.length}`
);

const nodeA = dynamicGraph.findNodeContaining("TableA", "A-1");
const nodeB = dynamicGraph.findNodeContaining("TableB", "B-1");
assert(nodeA !== null, "Missing TableA node");
assert(nodeB !== null, "Missing TableB node");

console.log("✅ Cyclical node duplication tests passed.");

console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! Node-level Static & Dynamic Graph system is robust.");
process.exit(0);
