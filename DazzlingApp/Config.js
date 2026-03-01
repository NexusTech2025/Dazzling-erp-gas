const CONFIG = {
  // Use the helper to find file by name, or hardcode the ID if you have it
  get DB_ID() { return getSpreadsheetId("DummyRecord"); },

  /**
   * Security Configuration
   * --------------------------------------------------------------
   * Use a long, random string for the pepper.
   * In a real production app, this should be an environment variable.
   */
  SECRET_PEPPER: "Dazzling_Secret_Pepper_2026_!@#$",

  // These MUST match the keys in your JSON output exactly
  SHEET_NAMES: {
    STUDENTS: "Students",             // Was 'Student_Profile'
    ATTENDANCE: "AttendanceLog",      // Was 'Attendance_Log'
    SUBJECTS: "StPerformance",        // Was 'Subject_Performance'
    TEACHERS: "Teachers",             // Matches
    EXAMS: "Exams",                   // Matches
    TIME_SERIES: "PerformanceTrend",  // Matches
    USERS: "Users",
    ADMINS: "Admins"
  }
};

const DATABASE_SCHEMA = {

  // ==========================================
  // 🔑 ENTITY: USERS (Identity & Auth)
  // ==========================================
  "User": {
    "tableName": "Users",
    "primaryKey": "id",
    "columns": {
      "id":            { "label": "User ID", "type": "string" },
      "username":      { "label": "Username", "type": "string" },
      "password_hash": { "label": "Password Hash", "type": "string" },
      "email":         { "label": "Email", "type": "string" },
      "role":          { "label": "Role", "type": "string" }, // 'student'|'teacher'|'admin'
      "status":        { "label": "Status", "type": "string" }, // 'active'|'inactive'
      "created_at":    { "label": "Created At", "type": "date" },
      "updated_at":    { "label": "Updated At", "type": "date" }
    }
  },

  // ==========================================
  // 🛡️ ENTITY: ADMINS (Admin Profiles)
  // ==========================================
  "Admin": {
    "tableName": "Admins",
    "primaryKey": "id",
    "columns": {
      "id":          { "label": "Admin ID", "type": "string" },
      "user_id":     { "label": "User ID", "type": "string" },
      "name":        { "label": "Full Name", "type": "string" },
      "designation": { "label": "Designation", "type": "string" }
    },
    "relations": {
      "user": {
        "type": "belongsTo",
        "targetEntity": "User",
        "foreignKey": "user_id"
      }
    }
  },

  // ==========================================
  // 👤 ENTITY 1: STUDENT PROFILE
  // ==========================================
  "Student": {
    "tableName": "Students",
    "primaryKey": "id",
    "columns": {
      "id":         { "label": "Student ID", "type": "string" },
      "user_id":    { "label": "User ID", "type": "string" },
      "name":       { "label": "Full Name", "type": "string" },
      "class":      { "label": "Class", "type": "string" },
      "stream":     { "label": "Stream", "type": "string" },
      "rollNo":     { "label": "Roll Number", "type": "number" },
      "avatarUrl":  { "label": "Photo URL", "type": "url" },
      "rank":       { "label": "Class Rank", "type": "number" },
      "overallGPA": { "label": "GPA", "type": "number" },
      "feeStatus":  { "label": "Fee Status", "type": "string" } // 'Paid' | 'Pending'
    },
    "relations": {
      "user": {
        "type": "belongsTo",
        "targetEntity": "User",
        "foreignKey": "user_id"
      },
      "attendance": {
        "type": "hasMany",
        "targetEntity": "Attendance",
        "foreignKey": "student_id"
      },
      "academic_results": {
        "type": "hasMany",
        "targetEntity": "Subject",
        "foreignKey": "student_id"
      },
      "exams": {
        "type": "hasMany",
        "targetEntity": "Exam",
        "foreignKey": "student_id"
      },
      "trends": {
         "type": "hasMany",
         "targetEntity": "TimeSeries",
         "foreignKey": "student_id"
      }
    }
  },

  // ==========================================
  // 📅 ENTITY 2: ATTENDANCE LOGS
  // ==========================================
  "Attendance": {
    "tableName": "AttendanceLog",
    "primaryKey": "id",
    "columns": {
      "id":             { "label": "Log ID", "type": "string" },
      "student_id":     { "label": "Student ID", "type": "string" },
      "date":           { "label": "Date", "type": "date" },
      "status":         { "label": "Status", "type": "string" }, // 'present'|'absent'|'late'
      "missedTopics":   { "label": "Topics Missed", "type": "json" }, // Array of strings
      "recoveryStatus": { "label": "Recovery", "type": "string" }
    },
    "relations": {
      "student": {
        "type": "belongsTo",
        "targetEntity": "Student",
        "foreignKey": "student_id"
      }
    }
  },

  // ==========================================
  // 📚 ENTITY 3: SUBJECT PERFORMANCE
  // ==========================================
  "Subject": {
    "tableName": "StPerformance", // Note: Matches your Sheet Name
    "primaryKey": "id",
    "columns": {
      "id":             { "label": "Record ID", "type": "string" },
      "student_id":     { "label": "Student ID", "type": "string" },
      "subject_code":   { "label": "Subject Code", "type": "string" },
      "name":           { "label": "Subject Name", "type": "string" },
      "currentScore":   { "label": "Score (%)", "type": "number" },
      "classAverage":   { "label": "Class Avg", "type": "number" },
      "trend":          { "label": "Performance Trend", "type": "string" },
      "topic_analysis": { "label": "Topic Analysis", "type": "json" } // Complex Array of Objects
    },
    "relations": {
      "instructor": {
        "type": "hasOne", 
        "targetEntity": "Teacher",
        "foreignKey": "subject_code", // Key in Teacher table
        "localKey": "subject_code"    // Key in this table
      }
    }
  },

  // ==========================================
  // 👨‍🏫 ENTITY 4: TEACHERS
  // ==========================================
  "Teacher": {
    "tableName": "Teachers",
    "primaryKey": "id",
    "columns": {
      "id":           { "label": "Teacher ID", "type": "string" },
      "user_id":      { "label": "User ID", "type": "string" },
      "subject_code": { "label": "Subject Taught", "type": "string" },
      "name":         { "label": "Name", "type": "string" },
      "designation":  { "label": "Designation", "type": "string" },
      "avatarUrl":    { "label": "Photo URL", "type": "url" }
    },
    "relations": {
      "user": {
        "type": "belongsTo",
        "targetEntity": "User",
        "foreignKey": "user_id"
      }
    }
  },

  // ==========================================
  // 📝 ENTITY 5: EXAMS
  // ==========================================
  "Exam": {
    "tableName": "Exams",
    "primaryKey": "id",
    "columns": {
      "id":            { "label": "Exam ID", "type": "string" },
      "student_id":    { "label": "Student ID", "type": "string" },
      "date":          { "label": "Exam Date", "type": "date" },
      "title":         { "label": "Exam Title", "type": "string" },
      "type":          { "label": "Exam Type", "type": "string" }, // 'Mock'|'Unit'
      "status":        { "label": "Status", "type": "string" },
      "marksTotal":    { "label": "Total Marks", "type": "number" },
      "marksObtained": { "label": "Marks Obtained", "type": "number" },
      "syllabus":      { "label": "Syllabus Links", "type": "json" } // Array of URLs
    }
  },

  // ==========================================
  // 📈 ENTITY 6: TIME SERIES (Trend Data)
  // ==========================================
  "TimeSeries": {
    "tableName": "PerformanceTrend",
    "primaryKey": "id",
    "columns": {
      "id":                { "label": "Record ID", "type": "string" },
      "student_id":        { "label": "Student ID", "type": "string" },
      "period":            { "label": "Month", "type": "string" },
      "scoreAverage":      { "label": "Avg Score", "type": "number" },
      "attendanceAverage": { "label": "Avg Attendance", "type": "number" }
    }
  }
};

// const DATABASE_SCHEMA = {
//   "Student": {
//     "tableName": "Students",
//     "primaryKey": "id",
//     "columns": {
//       "id": { "label": "Student ID", "type": "string" },
//       "name": { "label": "Full Name", "type": "string" },
//       "class": { "label": "Class", "type": "string" },
//       "stream": { "label": "Stream", "type": "string" },
//       "rollNo": { "label": "Roll Number", "type": "number" },
//       "avatarUrl": { "label": "Photo URL", "type": "url" },
//       "rank": { "label": "Class Rank", "type": "number" },
//       "overallGPA": { "label": "GPA", "type": "number" },
//       "feeStatus": { "label": "Fee Status", "type": "string" }
//     }
//   },
//   "Attendance": {
//     "tableName": "AttendanceLog",
//     "primaryKey": "id",
//     "columns": {
//       "id": { "label": "Log ID", "type": "string" },
//       "student_id": { "label": "Student ID", "type": "string" },
//       "date": { "label": "Date", "type": "date" },
//       "status": { "label": "Status", "type": "string" },
//       "missedTopics": { "label": "Topics Missed", "type": "json" },
//       "recoveryStatus": { "label": "Recovery", "type": "string" }
//     }
//   },
//   "Subject": {
//     "tableName": "StPerformance",
//     "primaryKey": "id",
//     "columns": {
//       "id": { "label": "Record ID", "type": "string" },
//       "student_id": { "label": "Student ID", "type": "string" },
//       "subject_code": { "label": "Subject Code", "type": "string" },
//       "name": { "label": "Subject Name", "type": "string" },
//       "currentScore": { "label": "Score (%)", "type": "number" },
//       "classAverage": { "label": "Class Avg", "type": "number" },
//       "trend": { "label": "Performance Trend", "type": "string" },
//       "topic_analysis": { "label": "Topic Analysis", "type": "json" }
//     }
//   },
//   "Teacher": {
//     "tableName": "Teachers",
//     "primaryKey": "id",
//     "columns": {
//       "id": { "label": "Teacher ID", "type": "string" },
//       "subject_code": { "label": "Subject Taught", "type": "string" },
//       "name": { "label": "Name", "type": "string" },
//       "designation": { "label": "Designation", "type": "string" },
//       "avatarUrl": { "label": "Photo URL", "type": "url" }
//     }
//   },
//   "Exam": {
//     "tableName": "Exams",
//     "primaryKey": "id",
//     "columns": {
//       "id": { "label": "Exam ID", "type": "string" },
//       "student_id": { "label": "Student ID", "type": "string" },
//       "date": { "label": "Exam Date", "type": "date" },
//       "title": { "label": "Exam Title", "type": "string" },
//       "type": { "label": "Exam Type", "type": "string" },
//       "status": { "label": "Status", "type": "string" },
//       "marksTotal": { "label": "Total Marks", "type": "number" },
//       "marksObtained": { "label": "Marks Obtained", "type": "number" },
//       "syllabus": { "label": "Syllabus Links", "type": "json" }
//     }
//   },
//   "TimeSeries": {
//     "tableName": "PerformanceTrend",
//     "primaryKey": "id",
//     "columns": {
//       "id": { "label": "Record ID", "type": "string" },
//       "student_id": { "label": "Student ID", "type": "string" },
//       "period": { "label": "Month", "type": "string" },
//       "scoreAverage": { "label": "Avg Score", "type": "number" },
//       "attendanceAverage": { "label": "Avg Attendance", "type": "number" }
//     }
//   }
// }