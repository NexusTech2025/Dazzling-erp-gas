/**
 * DazzlingDB Package Hydration & On-Demand Seeding Orchestration Script
 * File Location: Scripts/hydrate_bundles.js
 * * Enforces Axiom 2 (Polymorphic Referencing) and Axiom 5 (Zero Hardcoding) 
 * by resolving nested child data graphs prior to batch ingestion.
 */

const fs = require('fs');
const path = require('path');

// Configure authoritative resource paths
const COURSES_FILE = path.join(__dirname, 'courses_list.json');
const PACKAGES_FILE = path.join(__dirname, 'package_bundle_packed.json');
const OUTPUT_FILE = path.join(__dirname, 'package_bundle_unpacked.json');

function hydrateBundles() {
    console.log('🚀 Initiating Relational Bundle In-Memory Hydration...');

    try {
        // 1. Read raw JSON inputs
        if (!fs.existsSync(COURSES_FILE) || !fs.existsSync(PACKAGES_FILE)) {
            throw new Error('Relational Structuring Gap: Missing courses.json or packages.json source files.');
        }

        const rawCourses = JSON.parse(fs.readFileSync(COURSES_FILE, 'utf8'));
        const rawPackages = JSON.parse(fs.readFileSync(PACKAGES_FILE, 'utf8'));

        console.log(`📦 Loaded ${rawCourses.length} Courses and ${rawPackages.length} Skeleton Packages.`);

        // 2. Build an O(1) Dictionary Lookup Map for Courses using their short_code
        const courseMap = new Map();
        rawCourses.forEach(course => {
            if (course.short_code) {
                // Ensure unique upper-case mapping to avoid casing collisions
                courseMap.set(course.short_code.toUpperCase(), course);
            }
        });

        // 3. Process and Hydrate Nested Package Item Nodes
        const populatedPackages = rawPackages.map(pkg => {
            // Shallow copy package shell attributes
            const hydratedPkg = { ...pkg };

            if (Array.isArray(hydratedPkg.items)) {
                hydratedPkg.items = hydratedPkg.items.map(item => {
                    const lookupCode = item.item_short_code ? item.item_short_code.toUpperCase() : '';

                    if (!courseMap.has(lookupCode)) {
                        console.warn(`⚠️ Warning: Shortcode [${lookupCode}] not found in courses.json database map.`);
                        return { ...item, on_demand: true }; // Fallback with instruction flag only
                    }

                    // Retrieve reference master data to protect core definitions
                    const masterCourseData = courseMap.get(lookupCode);

                    // Build complete polymorphic payload contract with on_demand execution hook
                    return {
                        item_type: item.item_type || "subject",
                        item_short_code: lookupCode,
                        on_demand: true, // Enforces auto-generation tracking if missing inside the sheet gateway

                        // Structural schema propagation from referenced subject data
                        name: masterCourseData.name,
                        segment_id: masterCourseData.segment_id,
                        entity_type: masterCourseData.entity_type,
                        language_medium: masterCourseData.language_medium,
                        description: masterCourseData.description,
                        duration_value: masterCourseData.duration_value,
                        duration_unit: masterCourseData.duration_unit,
                        base_fee: masterCourseData.base_fee,
                        default_installment_count: masterCourseData.default_installment_count,
                        metadata: { ...masterCourseData.metadata },
                        status: masterCourseData.status
                    };
                });
            }

            return hydratedPkg;
        });

        // 4. Output the complete nested transaction block array
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(populatedPackages, null, 2), 'utf8');
        console.log(`\n✅ Hydration Lifecycle Completed! File persisted to: ${OUTPUT_FILE}`);
        console.log(`📈 Proportional Amortization Check: Ready for AbstractCreateManyRecordsAction batch pipeline.`);

    } catch (error) {
        console.error('❌ Critical Pipeline Failure:', error.message);
        process.exit(1);
    }
}

// Execute the hydration script routine
hydrateBundles();