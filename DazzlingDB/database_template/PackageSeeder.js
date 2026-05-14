/**
 * @file PackageSeeder2.js
 * Optimized Seeder for Packages and nested Perks using SheetDB's native relational engine.
 * 
 * Responsibility:
 * - Performs a single-pass bulk insertion of Packages and their Perks.
 * - Leverages SheetDB's automatic Foreign Key injection.
 * - Minimizes Spreadsheet I/O via BatchBucket integration.
 */

/**
 * Executes the seeding process for Packages and their nested Perks.
 * Run this function directly from the Google Apps Script editor.
 */
function seedPackagesV2() {
  console.log("🚀 Starting Optimized Package & Perks Seeding...");
  
  const db = DBContext.getInstance();
  
  // 1. Validate Schema Presence
  if (!db.Package || !db.PackagePerk) {
    throw new Error("❌ Schema Error: 'Package' or 'PackagePerk' table not found. Ensure your schema is correctly deployed.");
  }

  // 2. Validate Template Availability
  if (typeof PACKAGE_TEMPLATE === 'undefined' || !PACKAGE_TEMPLATE.packages) {
    throw new Error("❌ Template Error: PACKAGE_TEMPLATE is not defined. Ensure package_template.js is deployed in the project.");
  }

  const packagesData = PACKAGE_TEMPLATE.packages;

  try {
    console.log(`▶️ Preparing bulk insertion of ${packagesData.length} Packages with nested Perks...`);

    /**
     * IDIOMATIC SheetDB PATTERN:
     * We pass the raw template data (with nested 'packageperks' arrays) directly to insertMany.
     * The library will:
     * 1. Extract core Package fields.
     * 2. Generate Package IDs.
     * 3. Automatically inject the new ID into each Perk's 'package_id' field.
     * 4. Perform a single batch write for Packages and a single batch write for Perks.
     */
    const results = db.Package.insertMany(packagesData);
    
    // 3. Post-Insertion Diagnostics
    const totalPackages = results.length;
    let totalPerks = 0;

    results.forEach(pkg => {
      // Check if the library hydrated the relation (depends on relation config)
      // or count from the original template data.
      const perks = packagesData.find(p => p.name === pkg.name)?.packageperks || [];
      totalPerks += perks.length;
      console.log(`   ✅ [${pkg.package_id}] ${pkg.name} (${perks.length} perks)`);
    });

    console.log(`\n🎉 Seeding Complete!`);
    console.log(`📊 Total Packages: ${totalPackages}`);
    console.log(`📊 Total Perks:    ${totalPerks}`);

    return { 
      success: true, 
      count: totalPackages,
      perks: totalPerks
    };

  } catch (error) {
    console.error(`💥 Seeding Failed: ${error.message}`);
    
    // Log detailed validation errors if the library provided them
    if (error.errors) {
      console.error("🔍 Validation Details:", JSON.stringify(error.errors, null, 2));
    }
    
    throw error;
  }
}