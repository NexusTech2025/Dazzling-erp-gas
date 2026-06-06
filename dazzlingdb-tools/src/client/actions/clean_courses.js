/**
 * @file clean_courses.js
 * CLI tool to identify and clean up courses that have no active batches or enrollments.
 * Usage:
 *   Audit only (Dry run): node clean_courses.js
 *   Execute Deletion:     node clean_courses.js --delete
 */

const { callApi } = require('../api_client');

async function main() {
  const args = process.argv.slice(2);
  const executeDelete = args.includes('--delete');

  console.log('\n🔍 Auditing courses to find orphaned records...');
  console.log('ℹ️  Orphaned criteria: Course must have 0 batches and 0 enrollments.\n');

  try {
    // 1. Fetch all courses with batches and enrollments relations
    const payload = {
      target: 'Course',
      include: ['batches', 'enrollments'],
      limit: 1000 // Ensure we fetch all rows for audit
    };

    const result = await callApi('data_query', payload);
    const rows = result.data || [];

    if (rows.length === 0) {
      console.log('📭 No courses found in the database.\n');
      return;
    }

    // 2. Filter in memory to identify courses with no batches and no enrollments
    const orphanedCourses = rows.filter(row => {
      const hasBatches = Array.isArray(row.batches) && row.batches.length > 0;
      const hasEnrollments = Array.isArray(row.enrollments) && row.enrollments.length > 0;
      return !hasBatches && !hasEnrollments;
    });

    if (orphanedCourses.length === 0) {
      console.log('✅ Success: No orphaned courses detected! All courses have active batches or enrollments.\n');
      return;
    }

    console.log(`⚠️  Detected ${orphanedCourses.length} orphaned courses eligible for deletion:`);
    
    // Display summary table
    const tableData = orphanedCourses.map((c, index) => ({
      index,
      course_id: c.course_id,
      name: c.name,
      base_fee: c.base_fee,
      status: c.status
    }));
    console.table(tableData);

    const targetIds = orphanedCourses.map(c => c.course_id);

    if (!executeDelete) {
      console.log('\n📝 Dry run complete.');
      console.log('💡 To perform deletions, run:');
      console.log('   \x1b[33mnode clean_courses.js --delete\x1b[0m\n');
      return;
    }

    // 3. Perform Deletion loop
    console.log(`\n🔥 Starting deletion of ${targetIds.length} courses...`);
    
    for (let i = 0; i < targetIds.length; i++) {
      const id = targetIds[i];
      process.stdout.write(`  [${i + 1}/${targetIds.length}] Deleting ${id}... `);
      try {
        await callApi('data_delete', {
          table: 'Course',
          id: id
        });
        console.log('\x1b[32mSuccess\x1b[0m');
      } catch (err) {
        console.log(`\x1b[31mFailed\x1b[0m (${err.message})`);
      }
    }

    console.log('\n✨ Database cleanup complete!\n');

  } catch (error) {
    console.error(`\n❌ Auditing failed: ${error.message}\n`);
    process.exit(1);
  }
}

main();
