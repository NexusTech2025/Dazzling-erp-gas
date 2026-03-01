/**
 * ==============================================================
 * SchemaRegistryTest.gs
 * ==============================================================
 *
 * Manual test runner for SchemaRegistry
 * Run: testSchemaRegistry()
 * ==============================================================
 */

function testSchemaRegistry() {

  Logger.log("\n========== SchemaRegistry Tests ==========\n");

  try {

    const registry = new SchemaRegistry(DATABASE_SCHEMA);

    // -----------------------------
    // 1️⃣ Entity existence
    // -----------------------------
    assertTrue(registry.hasEntity("Student"), "Student entity exists");
    assertTrue(registry.hasEntity("Attendance"), "Attendance entity exists");

    // -----------------------------
    // 2️⃣ Table name resolution
    // -----------------------------
    const tableName = registry.getTableName("Student");
    assertEqual(tableName, "Students", "Student table name correct");

    // -----------------------------
    // 3️⃣ Primary key resolution
    // -----------------------------
    const pk = registry.getPrimaryKey("Student");
    assertEqual(pk, "id", "Primary key correct");

    // -----------------------------
    // 4️⃣ Column retrieval
    // -----------------------------
    const columns = registry.getColumns("Student");
    assertTrue(columns.hasOwnProperty("name"), "Column 'name' exists");

    // -----------------------------
    // 5️⃣ Filter validation (valid)
    // -----------------------------
    registry.validateFilter("Student", { name: "John" });
    Logger.log("✔ Valid filter accepted");

    // -----------------------------
    // 6️⃣ Filter validation (invalid column)
    // -----------------------------
    assertThrows(
      () => registry.validateFilter("Student", { invalidColumn: "x" }),
      "Invalid filter column should throw"
    );

    // -----------------------------
    // 7️⃣ Invalid entity
    // -----------------------------
    assertThrows(
      () => registry.getEntity("UnknownEntity"),
      "Unknown entity should throw"
    );

    Logger.log("\n✅ SchemaRegistry Tests PASSED\n");

  } catch (error) {
    Logger.log("\n❌ SchemaRegistry Test FAILED");
    Logger.log(error.message);
    Logger.log(error.stack);
  }
}


/**
 * ==============================================================
 * RepositoryRegistryTest.gs
 * ==============================================================
 *
 * Manual test runner for RepositoryRegistry
 * Run: testRepositoryRegistry()
 * ==============================================================
 */

function testRepositoryRegistry() {

  Logger.log("\n========== RepositoryRegistry Tests ==========\n");

  try {

    const registry = new RepositoryRegistry();

    // Create dummy repository
    const dummyRepo = {
      name: "DummyRepository"
    };

    // -----------------------------
    // 1️⃣ Register repository
    // -----------------------------
    registry.register("Student", dummyRepo);
    assertTrue(registry.has("Student"), "Student repo registered");

    // -----------------------------
    // 2️⃣ Retrieve repository
    // -----------------------------
    const retrieved = registry.get("Student");
    assertEqual(retrieved, dummyRepo, "Retrieved repository matches");

    // -----------------------------
    // 3️⃣ Duplicate registration
    // -----------------------------
    assertThrows(
      () => registry.register("Student", dummyRepo),
      "Duplicate registration should throw"
    );

    // -----------------------------
    // 4️⃣ Unknown repository access
    // -----------------------------
    assertThrows(
      () => registry.get("UnknownEntity"),
      "Unknown entity should throw"
    );

    // -----------------------------
    // 5️⃣ List entities
    // -----------------------------
    const entities = registry.list();
    assertTrue(entities.includes("Student"), "List contains Student");

    Logger.log("\n✅ RepositoryRegistry Tests PASSED\n");

  } catch (error) {
    Logger.log("\n❌ RepositoryRegistry Test FAILED");
    Logger.log(error.message);
    Logger.log(error.stack);
  }
}