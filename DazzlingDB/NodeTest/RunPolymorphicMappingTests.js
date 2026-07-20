/**
 * @file RunPolymorphicMappingTests.js
 * Verification suite testing DazzlingDB/SheetDB polymorphic shorthand registrations and dynamic traversals.
 */
const path = require('path');
const { bootstrapVirtualEnv } = require(path.resolve(__dirname, '../../NodeEnvDB/setup'));
const { resetDatabase } = require('../../NodeEnvDB/database');

console.log("🚀 BOOTSTRAPPING VIRTUAL TEST CONTEXT...");
bootstrapVirtualEnv();



function runPolymorphicMappingTests() {
  console.log("▶️ STARTING POLYMORPHIC MAPPING TESTING SUITE...");

  try {
    console.log("\n=========================================");
    executeScenario1_Registry();

    console.log("\n=========================================");
    executeScenario2_CourseTraversal();

    console.log("\n=========================================");
    executeScenario3_SubjectTraversal();

    console.log("=========================================\n");
    console.log("🎉 ALL POLYMORPHIC MAPPING TESTS PASSED!");
  } catch (err) {
    console.error("\n❌ TEST SUITE RUNNER CRASHED:", err);
    process.exit(1);
  }
}

function executeScenario1_Registry() {
  console.log("▶️ SCENARIO 1: Polymorphic Registry Verification");
  
  // Warm up DBContext singleton to trigger global registrations
  DBContext.getInstance();
  
  if (typeof PolymorphicRegistry === 'undefined') {
    throw new Error("PolymorphicRegistry is not globally defined.");
  }

  const expectedMappings = {
    course: "Course",
    subject: "Course",
    package: "Package",
    staff: "StaffMember",
    student: "Student",
    teacher: "Teacher"
  };

  Object.entries(expectedMappings).forEach(([typeCode, targetTable]) => {
    console.log(`   Verifying type code mapping: '${typeCode}' -> '${targetTable}'...`);
    const resolved = PolymorphicRegistry.resolve(typeCode);
    if (resolved !== targetTable) {
      throw new Error(`Expected type code '${typeCode}' to resolve to '${targetTable}', got: '${resolved}'`);
    }
  });

  // Verify unregistered lookup throws
  let unregisteredThrew = false;
  try {
    PolymorphicRegistry.resolve("nonexistent_type");
  } catch (e) {
    unregisteredThrew = true;
    console.log(`   [Expected Catch] Resolving unregistered code threw: "${e.message}"`);
  }

  if (!unregisteredThrew) {
    throw new Error("Expected resolving unregistered code to throw lookup failure, but it succeeded.");
  }

  console.log("   ✅ Success! Polymorphic registry holds all expected mappings.");
}

function executeScenario2_CourseTraversal() {
  console.log("▶️ SCENARIO 2: Polymorphic Relation Traversal - Type 'course'");
  resetDatabase();

  const db = DBContext.getInstance();
  
  // Insert parent Package record to satisfy referential constraint check
  console.log("   Inserting parent Package 'PKG-MOCK'...");
  const pkg = db.Package.insert({
    package_id: "PKG-MOCK",
    name: "Polymorphic Test Package",
    package_fee: 1200
  });

  const itemRepo = db.PackageItem;

  // Insert test package item referencing course type
  console.log("   Inserting PackageItem linked to course type 'course'...");
  const item = itemRepo.insert({
    package_id: pkg.package_id,
    entity_type: "course",
    entity_id: "CRS-3550D968"
  });

  // Check traversal
  console.log("   Traversing dynamic relation: item.entity()...");
  const relatedEntity = item.entity();

  if (!relatedEntity) {
    throw new Error("Relation traversal returned null/empty.");
  }

  console.log(`   Resolved model type: ${relatedEntity.getEntityType()}`);
  console.log(`   Resolved model ID: ${relatedEntity.course_id}`);
  console.log(`   Resolved model Name: ${relatedEntity.name}`);

  if (relatedEntity.getEntityType() !== "Course") {
    throw new Error(`Expected related entity type to be 'Course', got: '${relatedEntity.getEntityType()}'`);
  }

  if (relatedEntity.course_id !== "CRS-3550D968") {
    throw new Error(`Expected related entity ID to be 'CRS-3550D968', got: '${relatedEntity.course_id}'`);
  }

  if (relatedEntity.name !== "Mathematcis") {
    throw new Error(`Expected course name to be 'Mathematcis', got: '${relatedEntity.name}'`);
  }

  console.log("   ✅ Success! Traversed packageItem -> course dynamic relation successfully.");
}

function executeScenario3_SubjectTraversal() {
  console.log("▶️ SCENARIO 3: Polymorphic Relation Traversal - Type 'subject'");
  resetDatabase();

  const db = DBContext.getInstance();
  
  // Insert parent Package record to satisfy referential constraint check
  console.log("   Inserting parent Package 'PKG-MOCK'...");
  const pkg = db.Package.insert({
    package_id: "PKG-MOCK",
    name: "Polymorphic Test Package",
    package_fee: 1200
  });

  const itemRepo = db.PackageItem;

  // Insert test package item referencing subject type
  console.log("   Inserting PackageItem linked to subject type 'subject'...");
  const item = itemRepo.insert({
    package_id: pkg.package_id,
    entity_type: "subject",
    entity_id: "CRS-3550D968"
  });

  // Check traversal
  console.log("   Traversing dynamic relation: item.entity()...");
  const relatedEntity = item.entity();

  if (!relatedEntity) {
    throw new Error("Relation traversal returned null/empty.");
  }

  console.log(`   Resolved model type: ${relatedEntity.getEntityType()}`);
  console.log(`   Resolved model ID: ${relatedEntity.course_id}`);
  console.log(`   Resolved model Name: ${relatedEntity.name}`);

  if (relatedEntity.getEntityType() !== "Course") {
    throw new Error(`Expected related entity type to be 'Course', got: '${relatedEntity.getEntityType()}'`);
  }

  if (relatedEntity.course_id !== "CRS-3550D968") {
    throw new Error(`Expected related entity ID to be 'CRS-3550D968', got: '${relatedEntity.course_id}'`);
  }

  if (relatedEntity.name !== "Mathematcis") {
    throw new Error(`Expected course name to be 'Mathematcis', got: '${relatedEntity.name}'`);
  }

  console.log("   ✅ Success! Traversed packageItem -> subject dynamic relation successfully.");
}

// Run the tests
runPolymorphicMappingTests();
