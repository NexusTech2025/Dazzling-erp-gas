/**
 * DazzlingDB Flat Batch Generation Script
 * Generates and saves a clean, flat JSON array of batches list.
 */
const fs = require('fs');
const path = require('path');

// Workspace resource path bindings
const COURSE_LIST_FILE = path.join(__dirname, 'courses_list.json');
const BATCH_MAPPING_FILE = path.join(__dirname, 'batch_mapping.json');
const OUTPUT_FILE = path.join(__dirname, 'batches_list.json');

function executeFlatHydrationPipeline() {
    try {
        console.log('====== Launching Flat Array Batch Generation Pipeline ======');

        // Validate availability of necessary file assets
        if (!fs.existsSync(COURSE_LIST_FILE)) {
            throw new Error(`Critical Input File Missing: ${COURSE_LIST_FILE}`);
        }
        if (!fs.existsSync(BATCH_MAPPING_FILE)) {
            throw new Error(`Critical Input File Missing: ${BATCH_MAPPING_FILE}`);
        }

        // Ingest data streams
        const coursesRaw = JSON.parse(fs.readFileSync(COURSE_LIST_FILE, 'utf8'));
        const mapping = JSON.parse(fs.readFileSync(BATCH_MAPPING_FILE, 'utf8'));

        // Handle both encapsulated object graphs and raw arrays cleanly
        const coursesArray = Array.isArray(coursesRaw) ? coursesRaw : (coursesRaw.courses || []);

        const flatBatchList = [];

        // Map rows using O(1) memory index lookups
        for (const course of coursesArray) {
            const shortCode = course.short_code || course.course_id;

            if (!mapping[shortCode] || !mapping[shortCode].batch_name) {
                console.warn(`[Relational Structuring Gap] Code '${shortCode}' bypassed. Mapping signature not found.`);
                continue;
            }

            const exactBatchName = mapping[shortCode].batch_name;

            // Build schema-compliant entity node
            const batchNode = {
                "batch_name": exactBatchName,
                "batch_type": "Academy",
                "course_id": "<course_id>",  // To be resolved dynamically upstream via real DB identifiers
                "branch_id": "<branch_id>",  // To be resolved dynamically upstream via real DB identifiers
                "teacher_id": "<teacher_id>", // To be resolved dynamically upstream via real DB identifiers
                "start_date": "01-07-2026",  // Standard Indian Standard locale template format
                "end_date": "31-12-2026",    // Standard Indian Standard locale template format
                "max_seats": 30,
                "status": "upcoming",
                "schedule": {
                    "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], // Excluded Sunday
                    "start_time": "09:00",
                    "end_time": "11:00",
                    "room_number": "Main Hall"
                }
            };

            flatBatchList.push(batchNode);
        }

        // Write strictly the flat array to target path file
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(flatBatchList, null, 2), 'utf8');

        console.log(`Pipeline Status: ✅ SUCCESS`);
        console.log(`Flat JSON array holding ${flatBatchList.length} records written to: ${OUTPUT_FILE}`);
        console.log('============================================================');

    } catch (error) {
        console.error('Pipeline Status: 🔴 CRITICAL EXCEPTION MET');
        console.error(error.message);
        process.exit(1);
    }
}

executeFlatHydrationPipeline();