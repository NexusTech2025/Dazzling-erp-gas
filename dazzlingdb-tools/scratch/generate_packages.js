const fs = require('fs');
const path = require('path');

const coursesPath = path.resolve(__dirname, '../payloads/course_batch_payload.json');
const targetPath = path.resolve(__dirname, '../payloads/package_bundle_payload.json');

if (!fs.existsSync(coursesPath)) {
  console.error(`Error: Source file not found at ${coursesPath}`);
  process.exit(1);
}

const courses = JSON.parse(fs.readFileSync(coursesPath, 'utf8'));

// Group courses by Class and Board
const groups = {};

for (const course of courses) {
  const cls = course.metadata.class;
  const board = course.metadata.board;
  const medium = course.language_medium;
  const key = `${cls}_${board}_${medium}`;
  
  if (!groups[key]) {
    groups[key] = {
      class: cls,
      board: board,
      medium: medium,
      courses: []
    };
  }
  groups[key].courses.push(course);
}

const packages = [];

for (const [key, group] of Object.entries(groups)) {
  const boardLabel = group.board === 'CBSE' ? 'CBSE' : `RBSE - ${group.medium}`;
  const packageName = `Class ${group.class} ${boardLabel} Package`;
  
  // Map courses to on_demand payload format
  const onDemandCourses = group.courses.map(c => ({
    entity_type: 'course',
    on_demand: true,
    name: c.name,
    short_code: c.short_code,
    language_medium: c.language_medium,
    duration_value: c.duration_value,
    duration_unit: c.duration_unit,
    base_fee: c.base_fee,
    segment_id: c.segment_id,
    status: c.status,
    metadata: c.metadata
  }));
  
  // Determine package fee based on class tier
  let packageFee = 12000;
  const clsInt = parseInt(group.class, 10);
  if (clsInt === 6 || clsInt === 7) {
    packageFee = 14000;
  } else if (clsInt === 8) {
    packageFee = 16000;
  }
  
  packages.push({
    name: packageName,
    description: `Package bundling Mathematics, Science, English, and Social Science for Class ${group.class} (${boardLabel})`,
    target_class: `Class ${group.class}`,
    board: group.board,
    month: 12,
    package_fee: packageFee,
    discount_percent: 0,
    status: 'active',
    courses: onDemandCourses
  });
}

fs.writeFileSync(targetPath, JSON.stringify(packages, null, 2), 'utf8');
console.log(`Successfully generated ${packages.length} packages in ${targetPath}`);
