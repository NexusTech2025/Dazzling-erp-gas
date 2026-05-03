/**
 * @file RBAC.js
 * Role-Based and Attribute-Based Access Control matrix.
 */

const RBAC = {
  
  // Matrix defines which roles can access which tables
  // '*' means all tables/operations.
  _MATRIX: {
    "admin": ["*"],
    "teacher": [
      "Teacher", "Course", "Batch", "Student", "TeacherAttendance", 
      "TeacherSubject", "TeacherSalaryConfig", "TeacherDocument", "TeacherPaymentTransaction"
    ],
    "student": [
      "Student", "Course", "Batch", "Enrollment", "Installment", 
      "StudentFeeAccount", "Address", "ContactInfo"
    ],
    "guest": [] // Minimal access
  },

  /**
   * Core Guard function. Checks if a user has access to a table.
   * @param {Object} userContext
   * @param {string} tableName
   * @returns {boolean}
   */
  canAccessTable(userContext, tableName) {
    if (!userContext || !userContext.isValid) return false;

    const role = userContext.role || "guest";
    const allowedTables = this._MATRIX[role];

    if (!allowedTables) return false;

    // Admin override
    if (allowedTables.includes("*")) return true;

    return allowedTables.includes(tableName);
  }
};
