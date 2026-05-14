/**
 * @file BatchSeeder.js
 * Utility to seed the database with predefined Batch schedule data.
 */

/**
 * Executes the seeding process for Batches.
 * Run this function directly from the Google Apps Script editor.
 */
function seedBatches() {
  console.log("?? Starting Batch Seeding Process...");
  
  const db = DBContext.getInstance();
  const batchTable = db.Batch;

  if (!batchTable) {
    throw new Error("? Schema Error: 'Batch' table not found. Ensure your schema includes the Batch table.");
  }

  // Ensure BATCH_TEMPLATE is available in the global scope
  if (typeof BATCH_TEMPLATE === 'undefined' || !BATCH_TEMPLATE.batches) {
    throw new Error("? Template Error: BATCH_TEMPLATE is not defined. Ensure batch_template.js is deployed.");
  }

  const batchesData = BATCH_TEMPLATE.batches;

  try {
    // 1. Check for existing data to prevent accidental duplication
    const existingCount = batchTable.count();
    if (existingCount > 0) {
      console.warn(`?? Warning: 'Batch' table already contains ${existingCount} records. Seeding will append new data.`);
    }

    console.log(`?? Bulk inserting ${batchesData.length} Batch records...`);

    /**
     * IDIOMATIC SheetDB PATTERN:
     * We pass batchesData directly to insertMany. 
     * The library handles field mapping and schema validation automatically.
     */
    const insertedBatches = batchTable.insertMany(batchesData);
    
    // 2. Strict Success Validation
    if (!insertedBatches || !Array.isArray(insertedBatches)) {
      throw new Error("? Persistence Error: Database failed to return inserted records.");
    }

    const batchesInsertedCount = insertedBatches.length;

    console.log(`? Successfully inserted ${batchesInsertedCount} Batches in a single bulk operation.`);
    console.log(`?? Seeding Complete!`);

    return { 
      success: true, 
      batches: batchesInsertedCount
    };

  } catch (error) {
    console.error(`?? Seeding Failed: ${error.message}`);
    
    // Log detailed validation errors if provided by SheetDB
    if (error.errors) {
      console.error("?? Validation Details:", JSON.stringify(error.errors, null, 2));
    }
    
    throw error;
  }
}
