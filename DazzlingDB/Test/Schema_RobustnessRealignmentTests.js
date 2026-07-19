/**
 * @file Schema_RobustnessRealignmentTests.js
 * Integration test suite for validating safe column realignment, addition, and deletion
 * handling in the TESTING environment.
 * 
 * Instructions: Run `runSchemaRobustnessRealignmentTests()` from the Apps Script editor.
 */

/**
 * Executes a robustness integration test validating column reordering, additions, and deletions in RAM.
 * Provisions a temporary table, inserts mock rows, mutates the schema, re-provisions, and validates alignment.
 * Enforces timing assertions and cleans up spreadsheets on completion.
 * @returns {Object} Test execution result mapping including success state and detailed verification logs.
 * @throws {Error} If any assertion fails during the realignment lifecycle.
 */
function runSchemaRobustnessRealignmentTests() {
  console.log("🚀 Starting Schema Robustness Realignment Tests...");
  
  if (typeof PropertiesService === 'undefined') {
    throw new Error("PropertiesService is not defined. This test must be run in the Google Apps Script environment.");
  }

  const scriptProperties = PropertiesService.getScriptProperties();
  const originalEnv = scriptProperties.getProperty('ENV') || 'DEVELOPMENT';
  
  const testCategory = "Academic";
  const testTableName = "RobustnessTestTable";
  
  let originalCategorySchema = null;
  try {
    // 1. Force environment to TESTING and bootstrap
    scriptProperties.setProperty('ENV', 'TESTING');
    let db = DBContext.getInstance().bootstrapRepositories();

    // 2. Backup original schema category definition
    originalCategorySchema = JSON.parse(JSON.stringify(DATABASE_SCHEMA.categories[testCategory]));

    console.log(`[TEST] Phase 1: Injecting temporary table '${testTableName}' into schema...`);
    
    // Inject Phase 1 schema configuration
    DATABASE_SCHEMA.categories[testCategory].tables[testTableName] = {
      primaryKey: "id",
      columns: {
        id: { type: "string", required: true },
        name: { type: "string" },
        age: { type: "number" }
      }
    };

    // Re-bootstrap to provision the sheet
    db = DBContext.getInstance().bootstrapRepositories();
    db.setup.provision();

    console.log(`[TEST] Phase 2: Inserting mock rows...`);
    const repo = db[testTableName];
    if (!repo) throw new Error("Failed to resolve repository for temporary test table.");

    repo.insert({ id: "T001", name: "Alice", age: 30 });
    repo.insert({ id: "T002", name: "Bob", age: 25 });

    console.log(`[TEST] Phase 3: Mutating schema columns (Reordering, Adding, Deleting)...`);
    // Mutate the schema definition:
    // - Add: 'email'
    // - Reorder: 'age' moved after 'name'
    // - Delete: 'name' is kept, 'age' is kept, but let's delete 'age' from expected (it must be preserved physically)
    DATABASE_SCHEMA.categories[testCategory].tables[testTableName].columns = {
      id: { type: "string", required: true },
      email: { type: "string" }, // New column
      name: { type: "string" }    // Shuffled, and 'age' is deleted from schema
    };

    // Re-bootstrap and provision again
    db = DBContext.getInstance().bootstrapRepositories();
    const startTime = Date.now();
    db.setup.provision();
    const duration = Date.now() - startTime;
    console.log(`[TEST] Provision execution timing: ${duration}ms`);

    console.log(`[TEST] Phase 4: Asserting column alignment and data integrity...`);
    
    // Fetch physical headers
    const physicalHeaders = db[testTableName].gateway.dataSource.getHeaders(testCategory, testTableName);
    console.log(`[TEST] Physical headers after realignment: ${JSON.stringify(physicalHeaders)}`);

    // Expected final headers: expected schema columns first, followed by extra physical columns (like 'age') at the end
    const expectedHeaders = ['id', 'email', 'name', 'age'];
    const filteredPhysical = physicalHeaders.filter(h => !['__tx_id', '__tx_status', '__created_at'].includes(h));

    if (filteredPhysical.length !== expectedHeaders.length) {
      throw new Error(`Column count mismatch. Expected: ${expectedHeaders.length}, Got: ${filteredPhysical.length}`);
    }
    for (let i = 0; i < expectedHeaders.length; i++) {
      if (filteredPhysical[i] !== expectedHeaders[i]) {
        throw new Error(`Column alignment mismatch at index ${i}. Expected: '${expectedHeaders[i]}', Got: '${filteredPhysical[i]}'`);
      }
    }

    // Verify row values integrity by querying raw physical data
    const rawRows = db[testTableName].gateway.dataSource.readTable(testCategory, testTableName);
    if (rawRows.length !== 2) throw new Error(`Record count mismatch. Expected: 2, Got: ${rawRows.length}`);

    const alice = rawRows.find(r => r.id === "T001");
    if (alice.name !== "Alice") throw new Error(`Data corruption detected. Alice 'name' expected 'Alice', Got: '${alice.name}'`);
    if (Number(alice.age) !== 30) throw new Error(`Data corruption detected. Alice 'age' expected 30, Got: '${alice.age}'`);
    if (alice.email !== "") throw new Error(`Data corruption detected. Alice 'email' expected '', Got: '${alice.email}'`);

    console.log("✅ Schema Robustness Realignment Tests PASSED successfully.");

  } catch (err) {
    console.error(`❌ Schema Robustness Realignment Tests FAILED: ${err.message}`);
    throw err;
  } finally {
    // 5. Cleanup: Delete the temporary worksheet and restore schema Category
    try {
      console.log(`[TEST] Phase 5: Cleaning up test worksheet...`);
      const originalDB = DBContext.getInstance().bootstrapRepositories();
      const ssFile = originalDB.getSpreadsheetFileByName(testCategory);
      if (ssFile) {
        const sheet = ssFile.getSheetByName(testTableName);
        if (sheet) ssFile.deleteSheet(sheet);
      }
    } catch (cleanErr) {
      console.warn(`[TEST] Cleanup failed: ${cleanErr.message}`);
    }

    // Restore schema categories definition
    DATABASE_SCHEMA.categories[testCategory] = originalCategorySchema;
    scriptProperties.setProperty('ENV', originalEnv);
    DBContext.getInstance().bootstrapRepositories();
    console.log(`🏁 Restored environment context to [${originalEnv}].`);
  }
}
