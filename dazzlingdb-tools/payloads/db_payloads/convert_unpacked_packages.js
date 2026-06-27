/**
 * DazzlingDB Package Payload Converter Script
 * Converts the schema structure of package_bundle_unpacked.json to match
 * the exact payload expectations of the 'academic_create_package' Action.
 */

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, 'package_bundle_unpacked.json');

function convertPayloads() {
  console.log(`Reading payloads from: ${FILE_PATH}`);
  if (!fs.existsSync(FILE_PATH)) {
    console.error('File not found!');
    return;
  }

  const rawData = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
  console.log(`Loaded ${rawData.length} packages to convert.`);

  const correctedData = rawData.map(pkg => {
    // 1. Map parent keys
    const newPkg = {
      name: pkg.name || pkg.package_name,
      description: pkg.description || "",
      target_class: pkg.class,
      board: pkg.board,
      month: pkg.month || 12,
      package_fee: pkg.package_fee || 0,
      discount_percent: pkg.discount_percent || 0,
      status: pkg.status || "active",
      perks: pkg.perks || []
    };

    // 2. Map items to courses
    const itemsList = pkg.items || [];
    newPkg.courses = itemsList.map(item => {
      // Resolve class/board metadata to the root of the item
      const itemClass = item.metadata?.class || pkg.class;
      const itemBoard = item.metadata?.board || pkg.board;

      return {
        entity_type: item.entity_type || item.item_type || "subject",
        on_demand: item.on_demand !== undefined ? item.on_demand : true,
        name: item.name,
        short_code: item.short_code || item.item_short_code,
        language_medium: item.language_medium || "English",
        duration_value: item.duration_value || 12,
        duration_unit: item.duration_unit || "months",
        base_fee: item.base_fee || 0,
        segment_id: item.segment_id,
        default_installment_count: item.default_installment_count || 1,
        status: item.status || "active",
        class: itemClass,
        board: itemBoard
      };
    });

    return newPkg;
  });

  // Write back to the same file
  fs.writeFileSync(FILE_PATH, JSON.stringify(correctedData, null, 2), 'utf8');
  console.log(`✅ Successfully corrected and saved payload schema to: ${FILE_PATH}`);
}

convertPayloads();
