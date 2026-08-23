const fs = require('fs');
const path = require('path');

const classes = ['3', '4', '5', '6', '7', '8'];
const boards = [
  { code: 'CBSE', name: 'CBSE', medium: 'English', suffix: 'CBSEE' },
  { code: 'RBSE', name: 'RBSE - English', medium: 'English', suffix: 'RBSEE' },
  { code: 'RBSE', name: 'RBSE - Hindi', medium: 'Hindi', suffix: 'RBSEH' }
];

const subjects = [
  { code: 'MAT', name: 'Mathematics' },
  { code: 'SCI', name: 'Science' },
  { code: 'ENG', name: 'English' },
  { code: 'SST', name: 'Social Science' }
];

const segmentId = 'SEG-40C4B9E6'; // Academic segment
const payload = [];

for (const cls of classes) {
  const paddedClass = cls.padStart(2, '0');
  
  // Resolve base fee based on class tier
  let baseFee = 6000;
  if (cls === '6' || cls === '7') {
    baseFee = 7000;
  } else if (cls === '8') {
    baseFee = 8000;
  }

  for (const board of boards) {
    for (const sub of subjects) {
      const displayName = `Class ${cls} ${sub.name} (${board.name})`;
      const shortCode = `${sub.code}${paddedClass}${board.suffix}`;
      
      payload.push({
        segment_id: segmentId,
        entity_type: 'subject',
        name: displayName,
        short_code: shortCode,
        language_medium: board.medium,
        description: `${sub.name} for Class ${cls} ${board.name}`,
        duration_value: 12,
        duration_unit: 'months',
        base_fee: baseFee,
        default_installment_count: 3,
        status: 'active',
        metadata: {
          class: cls,
          board: board.code
        }
      });
    }
  }
}

const targetPath = path.resolve(__dirname, '../payloads/course_batch_payload.json');
fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2), 'utf8');
console.log(`Successfully generated ${payload.length} courses in ${targetPath}`);
