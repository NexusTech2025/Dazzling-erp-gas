/**
 * @file database.js
 * In-memory virtual database store mapping categories and tables to 2D array structures.
 */

const DATABASE_STORE = {
  Core: {
    Branch: [
      ["branch_id", "branch_name"],
      ["BRN-1001", "Mock Branch"]
    ]
  },
  Academic: {
    CourseType: [
      ["segment_name", "entity_label", "description", "status", "segment_id"],
      ["Academic", "Academic", "Academic Segment Type", "active", "SEG-40C4B9E6"],
      ["Course", "Course", "Course Segment Type", "active", "SEG-53CD6891"],
      ["Subject", "Subject", "Subject Segment Type", "active", "SEG-6B07F8DC"],
      ["Computer", "Course", "All Computer Science basic to advance courses", "active", "SEG-FEF99A52"],
      ["Integration Segment Kl93I", "", "", "active", "SEG-DA664728"]
    ],
    Course: [
      ["__tx_id", "__tx_status", "__created_at", "course_id", "segment_id", "entity_type", "name", "short_code", "language_medium", "description", "duration_value", "duration_unit", "base_fee", "default_installment_count", "status", "metadata"],
      ["", "PENDING", "2026-06-25 2:07:26", "CRS-3550D968", "SEG-40C4B9E6", "subject", "Mathematcis", "MATH-11", "English", "", "12", "months", "10000", "3", "active", "{\"class\":\"11\",\"board\":\"RBSE\"}"],
      ["", "PENDING", "2026-06-25 13:07:27", "CRS-35B43F12", "SEG-40C4B9E6", "course", "Chemistry", "CHM-11", "English", "", "12", "months", "10000", "1", "inactive", "{}"],
      ["", "PENDING", "2026-06-25 13:07:28", "CRS-F59DE511", "SEG-40C4B9E6", "subject", "Physics", "PHY-11", "English", "", "12", "months", "10000", "1", "active", "{\"class\":\"11\",\"board\":\"RBSE\"}"],
      ["", "PENDING", "2026-06-25 13:33:30", "CRS-FB15A55B", "SEG-53CD6891", "subject", "Class 11 Physics (CBSE)", "PHY11CBSE", "English", "", "12", "months", "15000", "1", "active", "{\"class\":\"11\",\"board\":\"CBSE\"}"],
      ["", "PENDING", "2026-06-25 19:03:33", "CRS-8FD279B7", "SEG-53CD6891", "subject", "Class 11 Chemistry (CBSE)", "CHM11CBSE", "English", "", "12", "months", "30000", "1", "active", "{}"],
      ["", "PENDING", "2026-06-25 19:03:35", "CRS-79E92F19", "SEG-53CD6891", "subject", "Class 11 Mathematics (CBSE)", "MAT11CBSE", "English", "", "12", "months", "32000", "1", "active", "{}"],
      ["", "PENDING", "2026-06-25 19:03:36", "CRS-140B5888", "SEG-53CD6891", "subject", "Class 11 Biology (CBSE)", "BIO11CBSE", "English", "", "12", "months", "32000", "1", "active", "{}"],
      ["", "PENDING", "2026-06-25 19:03:52", "CRS-E824375D", "SEG-53CD6891", "subject", "Class 11 Physics (RBSE)", "PHY11RBSE", "English", "", "12", "months", "24000", "1", "active", "{}"],
      ["", "PENDING", "2026-06-25 19:03:53", "CRS-D645DF91", "SEG-53CD6891", "subject", "Class 11 Chemistry (RBSE)", "CHM11RBSE", "English", "", "12", "months", "24000", "1", "active", "{}"],
      ["", "PENDING", "2026-06-25 19:03:55", "CRS-EBB612EA", "SEG-53CD6891", "subject", "Class 11 Mathematics (RBSE)", "MAT11RBSE", "English", "", "12", "months", "26000", "1", "active", "{}"],
      ["", "PENDING", "2026-06-25 19:03:56", "CRS-54D8BE44", "SEG-53CD6891", "subject", "Class 11 Biology (RBSE)", "BIO11RBSE", "English", "", "12", "months", "26000", "1", "active", "{}"],
      ["", "PENDING", "2026-06-25 19:04:07", "CRS-8F74FF2A", "SEG-53CD6891", "subject", "Class 12 Physics (CBSE)", "PHY12CBSE", "English", "", "12", "months", "34000", "1", "active", "{\"class\":\"12\",\"board\":\"RBSE\"}"],
      ["", "PENDING", "2026-06-25 19:04:07", "CRS-2FFE76CC", "SEG-53CD6891", "subject", "Class 12 Chemistry (CBSE)", "CHM12CBSE", "English", "", "12", "months", "34000", "1", "active", "{\"class\":\"12\",\"board\":\"RBSE\"}"],
      ["", "PENDING", "2026-06-25 19:04:08", "CRS-FCE33995", "SEG-53CD6891", "subject", "Class 12 Mathematics (CBSE)", "MAT12CBSE", "English", "", "12", "months", "36000", "1", "active", "{\"class\":\"12\",\"board\":\"RBSE\"}"],
      ["", "PENDING", "2026-06-25 19:04:09", "CRS-7CB5D43A", "SEG-53CD6891", "subject", "Class 12 Biology (CBSE)", "BIO12CBSE", "English", "", "12", "months", "36000", "1", "active", "{\"class\":\"12\",\"board\":\"RBSE\"}"],
      ["", "PENDING", "2026-06-25 19:11:10", "CRS-44534B85", "SEG-FEF99A52", "course", "RSCIT - GOV.", "RSCIT", "English", "", "3", "months", "3500", "1", "active", "{\"min_class\":\"7\",\"max_class\":\"\"}"],
      ["", "PENDING", "2026-06-30 6:09:59", "CRS-FD0D2D6C", "SEG-40C4B9E6", "subject", "Mathematics 10 (RBSE)", "MAT10-E", "English", "", "12", "months", "8000", "2", "active", "{\"class\":\"10\",\"board\":\"RBSE\"}"],
      ["", "PENDING", "2026-07-14 7:35:38", "CRS-676C16E8", "SEG-DA664728", "", "Integration Course KI93I", "", "English", "", "", "months", "5000", "1", "active", "{}"],
      ["", "PENDING", "2026-07-18 15:37:23", "CRS-0EFEBFA1", "SEG-FEF99A52", "course", "Course 1", "CRS01", "English", "Dummay Course 1", "1", "months", "997", "1", "active", "{\"min_class\":\"10\",\"max_class\":\"\"}"],
      ["", "PENDING", "2026-07-18 15:38:26", "CRS-9637CE65", "SEG-FEF99A52", "course", "Course 2", "CRS02", "English", "", "1", "months", "1000", "1", "active", "{\"min_class\":\"10\",\"max_class\":\"\"}"]
    ],
    TeacherSubject: [
      ["teacher_subject_id", "teacher_id", "subject_id"],
      ["TSUB-1001", "TCH-1001", "CRS-3550D968"]
    ],
    Package: [
      ["package_id", "name", "description", "target_class", "board", "month", "package_fee", "discount_percent", "status"],
      ["PKG-MOCK-1001", "Class 11 Science Premium Package", "Includes Mathematics, Chemistry, and Physics subjects with 3 perks.", "11", "CBSE", 12, 25000, 10, "active"]
    ],
    PackageItem: [
      ["item_id", "package_id", "entity_type", "entity_id"],
      ["PKI-1001", "PKG-MOCK-1001", "subject", "CRS-3550D968"],
      ["PKI-1002", "PKG-MOCK-1001", "course", "CRS-35B43F12"],
      ["PKI-1003", "PKG-MOCK-1001", "subject", "CRS-F59DE511"]
    ],
    PackagePerk: [
      ["perk_id", "package_id", "perk_title", "perk_description", "icon", "display_order"],
      ["PRK-1001", "PKG-MOCK-1001", "Free Printed Study Guides", "Physical books delivered to your home.", "book", 1],
      ["PRK-1002", "PKG-MOCK-1001", "Weekly Doubt Solving Sessions", "Live interactive sessions with expert teachers.", "live", 2],
      ["PRK-1003", "PKG-MOCK-1001", "Slack Portal Access", "Connect 24/7 with the academic peer group.", "chat", 3]
    ]
  }
};

/**
 * Retrieves the 2D array representing a table.
 * If the table does not exist in the store, it initializes it with headers from schema.
 * @param {string} category - Spreadsheet file name.
 * @param {string} tableName - Table/sheet name.
 * @returns {Array<Array<*>>}
 */
function getTableData(category, tableName) {
  if (!DATABASE_STORE[category]) {
    DATABASE_STORE[category] = {};
  }
  if (!DATABASE_STORE[category][tableName]) {
    DATABASE_STORE[category][tableName] = [];
  }
  return DATABASE_STORE[category][tableName];
}

/**
 * Resets the in-memory database to its original initial state.
 */
function resetDatabase() {
  Object.keys(DATABASE_STORE).forEach(key => delete DATABASE_STORE[key]);
  Object.assign(DATABASE_STORE, {
    Core: {
      Branch: [
        ["branch_id", "branch_name"],
        ["BRN-1001", "Mock Branch"]
      ]
    },
    Academic: {
      CourseType: [
        ["segment_name", "entity_label", "description", "status", "segment_id"],
        ["Academic", "Academic", "Academic Segment Type", "active", "SEG-40C4B9E6"],
        ["Course", "Course", "Course Segment Type", "active", "SEG-53CD6891"],
        ["Subject", "Subject", "Subject Segment Type", "active", "SEG-6B07F8DC"],
        ["Computer", "Course", "All Computer Science basic to advance courses", "active", "SEG-FEF99A52"],
        ["Integration Segment Kl93I", "", "", "active", "SEG-DA664728"]
      ],
      Course: [
        ["__tx_id", "__tx_status", "__created_at", "course_id", "segment_id", "entity_type", "name", "short_code", "language_medium", "description", "duration_value", "duration_unit", "base_fee", "default_installment_count", "status", "metadata"],
        ["", "PENDING", "2026-06-25 2:07:26", "CRS-3550D968", "SEG-40C4B9E6", "subject", "Mathematcis", "MATH-11", "English", "", "12", "months", "10000", "3", "active", "{\"class\":\"11\",\"board\":\"RBSE\"}"],
        ["", "PENDING", "2026-06-25 13:07:27", "CRS-35B43F12", "SEG-40C4B9E6", "course", "Chemistry", "CHM-11", "English", "", "12", "months", "10000", "1", "inactive", "{}"],
        ["", "PENDING", "2026-06-25 13:07:28", "CRS-F59DE511", "SEG-40C4B9E6", "subject", "Physics", "PHY-11", "English", "", "12", "months", "10000", "1", "active", "{\"class\":\"11\",\"board\":\"RBSE\"}"],
        ["", "PENDING", "2026-06-25 13:33:30", "CRS-FB15A55B", "SEG-53CD6891", "subject", "Class 11 Physics (CBSE)", "PHY11CBSE", "English", "", "12", "months", "15000", "1", "active", "{\"class\":\"11\",\"board\":\"CBSE\"}"],
        ["", "PENDING", "2026-06-25 19:03:33", "CRS-8FD279B7", "SEG-53CD6891", "subject", "Class 11 Chemistry (CBSE)", "CHM11CBSE", "English", "", "12", "months", "30000", "1", "active", "{}"],
        ["", "PENDING", "2026-06-25 19:03:35", "CRS-79E92F19", "SEG-53CD6891", "subject", "Class 11 Mathematics (CBSE)", "MAT11CBSE", "English", "", "12", "months", "32000", "1", "active", "{}"],
        ["", "PENDING", "2026-06-25 19:03:36", "CRS-140B5888", "SEG-53CD6891", "subject", "Class 11 Biology (CBSE)", "BIO11CBSE", "English", "", "12", "months", "32000", "1", "active", "{}"],
        ["", "PENDING", "2026-06-25 19:03:52", "CRS-E824375D", "SEG-53CD6891", "subject", "Class 11 Physics (RBSE)", "PHY11RBSE", "English", "", "12", "months", "24000", "1", "active", "{}"],
        ["", "PENDING", "2026-06-25 19:03:53", "CRS-D645DF91", "SEG-53CD6891", "subject", "Class 11 Chemistry (RBSE)", "CHM11RBSE", "English", "", "12", "months", "24000", "1", "active", "{}"],
        ["", "PENDING", "2026-06-25 19:03:55", "CRS-EBB612EA", "SEG-53CD6891", "subject", "Class 11 Mathematics (RBSE)", "MAT11RBSE", "English", "", "12", "months", "26000", "1", "active", "{}"],
        ["", "PENDING", "2026-06-25 19:03:56", "CRS-54D8BE44", "SEG-53CD6891", "subject", "Class 11 Biology (RBSE)", "BIO11RBSE", "English", "", "12", "months", "26000", "1", "active", "{}"],
        ["", "PENDING", "2026-06-25 19:04:07", "CRS-8F74FF2A", "SEG-53CD6891", "subject", "Class 12 Physics (CBSE)", "PHY12CBSE", "English", "", "12", "months", "34000", "1", "active", "{\"class\":\"12\",\"board\":\"RBSE\"}"],
        ["", "PENDING", "2026-06-25 19:04:07", "CRS-2FFE76CC", "SEG-53CD6891", "subject", "Class 12 Chemistry (CBSE)", "CHM12CBSE", "English", "", "12", "months", "34000", "1", "active", "{\"class\":\"12\",\"board\":\"RBSE\"}"],
        ["", "PENDING", "2026-06-25 19:04:08", "CRS-FCE33995", "SEG-53CD6891", "subject", "Class 12 Mathematics (CBSE)", "MAT12CBSE", "English", "", "12", "months", "36000", "1", "active", "{\"class\":\"12\",\"board\":\"RBSE\"}"],
        ["", "PENDING", "2026-06-25 19:04:09", "CRS-7CB5D43A", "SEG-53CD6891", "subject", "Class 12 Biology (CBSE)", "BIO12CBSE", "English", "", "12", "months", "36000", "1", "active", "{\"class\":\"12\",\"board\":\"RBSE\"}"],
        ["", "PENDING", "2026-06-25 19:11:10", "CRS-44534B85", "SEG-FEF99A52", "course", "RSCIT - GOV.", "RSCIT", "English", "", "3", "months", "3500", "1", "active", "{\"min_class\":\"7\",\"max_class\":\"\"}"],
        ["", "PENDING", "2026-06-30 6:09:59", "CRS-FD0D2D6C", "SEG-40C4B9E6", "subject", "Mathematics 10 (RBSE)", "MAT10-E", "English", "", "12", "months", "8000", "2", "active", "{\"class\":\"10\",\"board\":\"RBSE\"}"],
        ["", "PENDING", "2026-07-14 7:35:38", "CRS-676C16E8", "SEG-DA664728", "", "Integration Course KI93I", "", "English", "", "", "months", "5000", "1", "active", "{}"],
        ["", "PENDING", "2026-07-18 15:37:23", "CRS-0EFEBFA1", "SEG-FEF99A52", "course", "Course 1", "CRS01", "English", "Dummay Course 1", "1", "months", "997", "1", "active", "{\"min_class\":\"10\",\"max_class\":\"\"}"],
        ["", "PENDING", "2026-07-18 15:38:26", "CRS-9637CE65", "SEG-FEF99A52", "course", "Course 2", "CRS02", "English", "", "1", "months", "1000", "1", "active", "{\"min_class\":\"10\",\"max_class\":\"\"}"]
      ],
      TeacherSubject: [
        ["teacher_subject_id", "teacher_id", "subject_id"],
        ["TSUB-1001", "TCH-1001", "CRS-3550D968"]
      ],
      Package: [
        ["package_id", "name", "description", "target_class", "board", "month", "package_fee", "discount_percent", "status"],
        ["PKG-MOCK-1001", "Class 11 Science Premium Package", "Includes Mathematics, Chemistry, and Physics subjects with 3 perks.", "11", "CBSE", 12, 25000, 10, "active"]
      ],
      PackageItem: [
        ["item_id", "package_id", "entity_type", "entity_id"],
        ["PKI-1001", "PKG-MOCK-1001", "subject", "CRS-3550D968"],
        ["PKI-1002", "PKG-MOCK-1001", "course", "CRS-35B43F12"],
        ["PKI-1003", "PKG-MOCK-1001", "subject", "CRS-F59DE511"]
      ],
      PackagePerk: [
        ["perk_id", "package_id", "perk_title", "perk_description", "icon", "display_order"],
        ["PRK-1001", "PKG-MOCK-1001", "Free Printed Study Guides", "Physical books delivered to your home.", "book", 1],
        ["PRK-1002", "PKG-MOCK-1001", "Weekly Doubt Solving Sessions", "Live interactive sessions with expert teachers.", "live", 2],
        ["PRK-1003", "PKG-MOCK-1001", "Slack Portal Access", "Connect 24/7 with the academic peer group.", "chat", 3]
      ]
    }
  });
}

module.exports = {
  DATABASE_STORE,
  getTableData,
  resetDatabase
};
