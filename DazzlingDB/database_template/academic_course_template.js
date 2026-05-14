/**
 * @file academic_course_template.js
 * Contains the academic course preset data for DazzlingDB.
 */

const ACADEMIC_COURSE_TEMPLATE = {
  "courseTypes": [
    {
      "segment_name": "Academic",
      "entity_label": "Subject",
      "description": "School curriculum coaching (CBSE/RBSE)",
      "status": "active"
    },
    {
      "segment_name": "Computer",
      "entity_label": "Course",
      "description": "IT and Software training",
      "status": "active"
    },
    {
      "segment_name": "Foundation",
      "entity_label": "Program",
      "description": "Early preparation for competitive exams",
      "status": "active"
    },
    {
      "segment_name": "Competitive",
      "entity_label": "Exam",
      "description": "Preparation for entrance exams",
      "status": "active"
    }
  ],
  "academicCourses": [
    { "name": "Class 3 Mathematics", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "3", "board": "General" } },
    { "name": "Class 3 Science", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "3", "board": "General" } },
    { "name": "Class 3 English", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "3", "board": "General" } },
    { "name": "Class 3 Social Science", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "3", "board": "General" } },
    
    { "name": "Class 4 Mathematics", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "4", "board": "General" } },
    { "name": "Class 4 Science", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "4", "board": "General" } },
    { "name": "Class 4 English", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "4", "board": "General" } },
    { "name": "Class 4 Social Science", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "4", "board": "General" } },

    { "name": "Class 5 Mathematics", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "5", "board": "General" } },
    { "name": "Class 5 Science", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "5", "board": "General" } },
    { "name": "Class 5 English", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "5", "board": "General" } },
    { "name": "Class 5 Social Science", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "5", "board": "General" } },

    { "name": "Class 6 Mathematics", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "6", "board": "General" } },
    { "name": "Class 6 Science", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "6", "board": "General" } },
    { "name": "Class 6 English", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "6", "board": "General" } },
    { "name": "Class 6 Social Science", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "6", "board": "General" } },

    { "name": "Class 7 Mathematics", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "7", "board": "General" } },
    { "name": "Class 7 Science", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "7", "board": "General" } },
    { "name": "Class 7 English", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "7", "board": "General" } },
    { "name": "Class 7 Social Science", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "7", "board": "General" } },

    { "name": "Class 8 Mathematics - CBSE", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "8", "board": "CBSE" } },
    { "name": "Class 8 Science - CBSE", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "8", "board": "CBSE" } },
    { "name": "Class 8 English - CBSE", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "8", "board": "CBSE" } },
    { "name": "Class 8 Social Science - CBSE", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "8", "board": "CBSE" } },

    { "name": "Class 8 Mathematics - RBSE", "language_medium": "Hindi", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "8", "board": "RBSE" } },
    { "name": "Class 8 Science - RBSE", "language_medium": "Hindi", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "8", "board": "RBSE" } },
    { "name": "Class 8 English - RBSE", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "8", "board": "RBSE" } },
    { "name": "Class 8 Social Science - RBSE", "language_medium": "Hindi", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "8", "board": "RBSE" } },

    { "name": "Class 9 Mathematics - CBSE", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "9", "board": "CBSE" } },
    { "name": "Class 9 Science - CBSE", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "9", "board": "CBSE" } },
    { "name": "Class 9 English - CBSE", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "9", "board": "CBSE" } },
    { "name": "Class 9 Social Science - CBSE", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "9", "board": "CBSE" } },

    { "name": "Class 9 Mathematics - RBSE (Eng)", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "9", "board": "RBSE" } },
    { "name": "Class 9 Science - RBSE (Eng)", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "9", "board": "RBSE" } },
    { "name": "Class 9 English - RBSE (Eng)", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "9", "board": "RBSE" } },
    { "name": "Class 9 Social Science - RBSE (Eng)", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "9", "board": "RBSE" } },

    { "name": "Class 9 Mathematics - RBSE (Hindi)", "language_medium": "Hindi", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "9", "board": "RBSE" } },
    { "name": "Class 9 Science - RBSE (Hindi)", "language_medium": "Hindi", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "9", "board": "RBSE" } },
    { "name": "Class 9 English - RBSE (Hindi)", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "9", "board": "RBSE" } },
    { "name": "Class 9 Social Science - RBSE (Hindi)", "language_medium": "Hindi", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "9", "board": "RBSE" } },

    { "name": "Class 10 Mathematics - CBSE", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "10", "board": "CBSE" } },
    { "name": "Class 10 Science - CBSE", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "10", "board": "CBSE" } },
    { "name": "Class 10 English - CBSE", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "10", "board": "CBSE" } },
    { "name": "Class 10 Social Science - CBSE", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "10", "board": "CBSE" } },

    { "name": "Class 10 Mathematics - RBSE (Eng)", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "10", "board": "RBSE" } },
    { "name": "Class 10 Science - RBSE (Eng)", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "10", "board": "RBSE" } },
    { "name": "Class 10 English - RBSE (Eng)", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "10", "board": "RBSE" } },
    { "name": "Class 10 Social Science - RBSE (Eng)", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "10", "board": "RBSE" } },

    { "name": "Class 10 Mathematics - RBSE (Hindi)", "language_medium": "Hindi", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "10", "board": "RBSE" } },
    { "name": "Class 10 Science - RBSE (Hindi)", "language_medium": "Hindi", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "10", "board": "RBSE" } },
    { "name": "Class 10 English - RBSE (Hindi)", "language_medium": "English", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "10", "board": "RBSE" } },
    { "name": "Class 10 Social Science - RBSE (Hindi)", "language_medium": "Hindi", "base_fee": 0, "entity_type": "subject", "metadata": { "class": "10", "board": "RBSE" } },

    { "name": "Class 10 Standard Mathematics Program (R.D. Sharma)", "language_medium": "English", "base_fee": 12000, "entity_type": "subject", "metadata": { "class": "10", "board": "All", "premium": true } },

    { "name": "Class 11 Physics - CBSE", "language_medium": "English", "base_fee": 14000, "entity_type": "subject", "metadata": { "class": "11", "stream": "Science (Math/Bio)", "board": "CBSE" } },
    { "name": "Class 11 Chemistry - CBSE", "language_medium": "English", "base_fee": 14000, "entity_type": "subject", "metadata": { "class": "11", "stream": "Science (Math/Bio)", "board": "CBSE" } },
    { "name": "Class 11 Mathematics - CBSE", "language_medium": "English", "base_fee": 14000, "entity_type": "subject", "metadata": { "class": "11", "stream": "Science (Math)", "board": "CBSE" } },
    { "name": "Class 11 Biology - CBSE", "language_medium": "English", "base_fee": 14000, "entity_type": "subject", "metadata": { "class": "11", "stream": "Science (Bio)", "board": "CBSE" } },
    { "name": "Class 11 Accountancy - CBSE", "language_medium": "English", "base_fee": 14000, "entity_type": "subject", "metadata": { "class": "11", "stream": "Commerce", "board": "CBSE" } },
    { "name": "Class 11 Business Studies - CBSE", "language_medium": "English", "base_fee": 14000, "entity_type": "subject", "metadata": { "class": "11", "stream": "Commerce", "board": "CBSE" } },
    { "name": "Class 11 Economics - CBSE", "language_medium": "English", "base_fee": 14000, "entity_type": "subject", "metadata": { "class": "11", "stream": "Commerce/Arts", "board": "CBSE" } },
    { "name": "Class 11 History - CBSE", "language_medium": "English", "base_fee": 14000, "entity_type": "subject", "metadata": { "class": "11", "stream": "Arts", "board": "CBSE" } },
    { "name": "Class 11 Geography - CBSE", "language_medium": "English", "base_fee": 14000, "entity_type": "subject", "metadata": { "class": "11", "stream": "Arts", "board": "CBSE" } },
    { "name": "Class 11 Political Science - CBSE", "language_medium": "English", "base_fee": 14000, "entity_type": "subject", "metadata": { "class": "11", "stream": "Arts", "board": "CBSE" } },
    { "name": "Class 11 English - CBSE", "language_medium": "English", "base_fee": 14000, "entity_type": "subject", "metadata": { "class": "11", "stream": "All", "board": "CBSE" } },

    { "name": "Class 11 Physics - RBSE (Eng)", "language_medium": "English", "base_fee": 12000, "entity_type": "subject", "metadata": { "class": "11", "stream": "Science (Math/Bio)", "board": "RBSE" } },
    { "name": "Class 11 Chemistry - RBSE (Eng)", "language_medium": "English", "base_fee": 12000, "entity_type": "subject", "metadata": { "class": "11", "stream": "Science (Math/Bio)", "board": "RBSE" } },
    { "name": "Class 11 Mathematics - RBSE (Eng)", "language_medium": "English", "base_fee": 12000, "entity_type": "subject", "metadata": { "class": "11", "stream": "Science (Math)", "board": "RBSE" } },
    { "name": "Class 11 Biology - RBSE (Eng)", "language_medium": "English", "base_fee": 12000, "entity_type": "subject", "metadata": { "class": "11", "stream": "Science (Bio)", "board": "RBSE" } },
    { "name": "Class 11 Accountancy - RBSE (Eng)", "language_medium": "English", "base_fee": 12000, "entity_type": "subject", "metadata": { "class": "11", "stream": "Commerce", "board": "RBSE" } },
    { "name": "Class 11 Business Studies - RBSE (Eng)", "language_medium": "English", "base_fee": 12000, "entity_type": "subject", "metadata": { "class": "11", "stream": "Commerce", "board": "RBSE" } },
    { "name": "Class 11 Economics - RBSE (Eng)", "language_medium": "English", "base_fee": 12000, "entity_type": "subject", "metadata": { "class": "11", "stream": "Commerce/Arts", "board": "RBSE" } },
    { "name": "Class 11 History - RBSE (Eng)", "language_medium": "English", "base_fee": 12000, "entity_type": "subject", "metadata": { "class": "11", "stream": "Arts", "board": "RBSE" } },
    { "name": "Class 11 Geography - RBSE (Eng)", "language_medium": "English", "base_fee": 12000, "entity_type": "subject", "metadata": { "class": "11", "stream": "Arts", "board": "RBSE" } },
    { "name": "Class 11 Political Science - RBSE (Eng)", "language_medium": "English", "base_fee": 12000, "entity_type": "subject", "metadata": { "class": "11", "stream": "Arts", "board": "RBSE" } },
    { "name": "Class 11 English - RBSE (Eng)", "language_medium": "English", "base_fee": 12000, "entity_type": "subject", "metadata": { "class": "11", "stream": "All", "board": "RBSE" } },

    { "name": "Class 11 Physics - RBSE (Hindi)", "language_medium": "Hindi", "base_fee": 10000, "entity_type": "subject", "metadata": { "class": "11", "stream": "Science (Math/Bio)", "board": "RBSE" } },
    { "name": "Class 11 Chemistry - RBSE (Hindi)", "language_medium": "Hindi", "base_fee": 10000, "entity_type": "subject", "metadata": { "class": "11", "stream": "Science (Math/Bio)", "board": "RBSE" } },
    { "name": "Class 11 Mathematics - RBSE (Hindi)", "language_medium": "Hindi", "base_fee": 10000, "entity_type": "subject", "metadata": { "class": "11", "stream": "Science (Math)", "board": "RBSE" } },
    { "name": "Class 11 Biology - RBSE (Hindi)", "language_medium": "Hindi", "base_fee": 10000, "entity_type": "subject", "metadata": { "class": "11", "stream": "Science (Bio)", "board": "RBSE" } },
    { "name": "Class 11 Accountancy - RBSE (Hindi)", "language_medium": "Hindi", "base_fee": 10000, "entity_type": "subject", "metadata": { "class": "11", "stream": "Commerce", "board": "RBSE" } },
    { "name": "Class 11 Business Studies - RBSE (Hindi)", "language_medium": "Hindi", "base_fee": 10000, "entity_type": "subject", "metadata": { "class": "11", "stream": "Commerce", "board": "RBSE" } },
    { "name": "Class 11 Economics - RBSE (Hindi)", "language_medium": "Hindi", "base_fee": 10000, "entity_type": "subject", "metadata": { "class": "11", "stream": "Commerce/Arts", "board": "RBSE" } },
    { "name": "Class 11 History - RBSE (Hindi)", "language_medium": "Hindi", "base_fee": 10000, "entity_type": "subject", "metadata": { "class": "11", "stream": "Arts", "board": "RBSE" } },
    { "name": "Class 11 Geography - RBSE (Hindi)", "language_medium": "Hindi", "base_fee": 10000, "entity_type": "subject", "metadata": { "class": "11", "stream": "Arts", "board": "RBSE" } },
    { "name": "Class 11 Political Science - RBSE (Hindi)", "language_medium": "Hindi", "base_fee": 10000, "entity_type": "subject", "metadata": { "class": "11", "stream": "Arts", "board": "RBSE" } },
    { "name": "Class 11 English - RBSE (Hindi)", "language_medium": "English", "base_fee": 10000, "entity_type": "subject", "metadata": { "class": "11", "stream": "All", "board": "RBSE" } },

    { "name": "Class 12 Physics - CBSE", "language_medium": "English", "base_fee": 14000, "entity_type": "subject", "metadata": { "class": "12", "stream": "Science (Math/Bio)", "board": "CBSE" } },
    { "name": "Class 12 Chemistry - CBSE", "language_medium": "English", "base_fee": 14000, "entity_type": "subject", "metadata": { "class": "12", "stream": "Science (Math/Bio)", "board": "CBSE" } },
    { "name": "Class 12 Mathematics - CBSE", "language_medium": "English", "base_fee": 14000, "entity_type": "subject", "metadata": { "class": "12", "stream": "Science (Math)", "board": "CBSE" } },
    { "name": "Class 12 Biology - CBSE", "language_medium": "English", "base_fee": 14000, "entity_type": "subject", "metadata": { "class": "12", "stream": "Science (Bio)", "board": "CBSE" } },
    { "name": "Class 12 Accountancy - CBSE", "language_medium": "English", "base_fee": 14000, "entity_type": "subject", "metadata": { "class": "12", "stream": "Commerce", "board": "CBSE" } },
    { "name": "Class 12 Business Studies - CBSE", "language_medium": "English", "base_fee": 14000, "entity_type": "subject", "metadata": { "class": "12", "stream": "Commerce", "board": "CBSE" } },
    { "name": "Class 12 Economics - CBSE", "language_medium": "English", "base_fee": 14000, "entity_type": "subject", "metadata": { "class": "12", "stream": "Commerce/Arts", "board": "CBSE" } },
    { "name": "Class 12 History - CBSE", "language_medium": "English", "base_fee": 14000, "entity_type": "subject", "metadata": { "class": "12", "stream": "Arts", "board": "CBSE" } },
    { "name": "Class 12 Geography - CBSE", "language_medium": "English", "base_fee": 14000, "entity_type": "subject", "metadata": { "class": "12", "stream": "Arts", "board": "CBSE" } },
    { "name": "Class 12 Political Science - CBSE", "language_medium": "English", "base_fee": 14000, "entity_type": "subject", "metadata": { "class": "12", "stream": "Arts", "board": "CBSE" } },
    { "name": "Class 12 English - CBSE", "language_medium": "English", "base_fee": 14000, "entity_type": "subject", "metadata": { "class": "12", "stream": "All", "board": "CBSE" } },

    { "name": "Class 12 Physics - RBSE (Eng)", "language_medium": "English", "base_fee": 12000, "entity_type": "subject", "metadata": { "class": "12", "stream": "Science (Math/Bio)", "board": "RBSE" } },
    { "name": "Class 12 Chemistry - RBSE (Eng)", "language_medium": "English", "base_fee": 12000, "entity_type": "subject", "metadata": { "class": "12", "stream": "Science (Math/Bio)", "board": "RBSE" } },
    { "name": "Class 12 Mathematics - RBSE (Eng)", "language_medium": "English", "base_fee": 12000, "entity_type": "subject", "metadata": { "class": "12", "stream": "Science (Math)", "board": "RBSE" } },
    { "name": "Class 12 Biology - RBSE (Eng)", "language_medium": "English", "base_fee": 12000, "entity_type": "subject", "metadata": { "class": "12", "stream": "Science (Bio)", "board": "RBSE" } },
    { "name": "Class 12 Accountancy - RBSE (Eng)", "language_medium": "English", "base_fee": 12000, "entity_type": "subject", "metadata": { "class": "12", "stream": "Commerce", "board": "RBSE" } },
    { "name": "Class 12 Business Studies - RBSE (Eng)", "language_medium": "English", "base_fee": 12000, "entity_type": "subject", "metadata": { "class": "12", "stream": "Commerce", "board": "RBSE" } },
    { "name": "Class 12 Economics - RBSE (Eng)", "language_medium": "English", "base_fee": 12000, "entity_type": "subject", "metadata": { "class": "12", "stream": "Commerce/Arts", "board": "RBSE" } },
    { "name": "Class 12 History - RBSE (Eng)", "language_medium": "English", "base_fee": 12000, "entity_type": "subject", "metadata": { "class": "12", "stream": "Arts", "board": "RBSE" } },
    { "name": "Class 12 Geography - RBSE (Eng)", "language_medium": "English", "base_fee": 12000, "entity_type": "subject", "metadata": { "class": "12", "stream": "Arts", "board": "RBSE" } },
    { "name": "Class 12 Political Science - RBSE (Eng)", "language_medium": "English", "base_fee": 12000, "entity_type": "subject", "metadata": { "class": "12", "stream": "Arts", "board": "RBSE" } },
    { "name": "Class 12 English - RBSE (Eng)", "language_medium": "English", "base_fee": 12000, "entity_type": "subject", "metadata": { "class": "12", "stream": "All", "board": "RBSE" } },

    { "name": "Class 12 Physics - RBSE (Hindi)", "language_medium": "Hindi", "base_fee": 10000, "entity_type": "subject", "metadata": { "class": "12", "stream": "Science (Math/Bio)", "board": "RBSE" } },
    { "name": "Class 12 Chemistry - RBSE (Hindi)", "language_medium": "Hindi", "base_fee": 10000, "entity_type": "subject", "metadata": { "class": "12", "stream": "Science (Math/Bio)", "board": "RBSE" } },
    { "name": "Class 12 Mathematics - RBSE (Hindi)", "language_medium": "Hindi", "base_fee": 10000, "entity_type": "subject", "metadata": { "class": "12", "stream": "Science (Math)", "board": "RBSE" } },
    { "name": "Class 12 Biology - RBSE (Hindi)", "language_medium": "Hindi", "base_fee": 10000, "entity_type": "subject", "metadata": { "class": "12", "stream": "Science (Bio)", "board": "RBSE" } },
    { "name": "Class 12 Accountancy - RBSE (Hindi)", "language_medium": "Hindi", "base_fee": 10000, "entity_type": "subject", "metadata": { "class": "12", "stream": "Commerce", "board": "RBSE" } },
    { "name": "Class 12 Business Studies - RBSE (Hindi)", "language_medium": "Hindi", "base_fee": 10000, "entity_type": "subject", "metadata": { "class": "12", "stream": "Commerce", "board": "RBSE" } },
    { "name": "Class 12 Economics - RBSE (Hindi)", "language_medium": "Hindi", "base_fee": 10000, "entity_type": "subject", "metadata": { "class": "12", "stream": "Commerce/Arts", "board": "RBSE" } },
    { "name": "Class 12 History - RBSE (Hindi)", "language_medium": "Hindi", "base_fee": 10000, "entity_type": "subject", "metadata": { "class": "12", "stream": "Arts", "board": "RBSE" } },
    { "name": "Class 12 Geography - RBSE (Hindi)", "language_medium": "Hindi", "base_fee": 10000, "entity_type": "subject", "metadata": { "class": "12", "stream": "Arts", "board": "RBSE" } },
    { "name": "Class 12 Political Science - RBSE (Hindi)", "language_medium": "Hindi", "base_fee": 10000, "entity_type": "subject", "metadata": { "class": "12", "stream": "Arts", "board": "RBSE" } },
    { "name": "Class 12 English - RBSE (Hindi)", "language_medium": "English", "base_fee": 10000, "entity_type": "subject", "metadata": { "class": "12", "stream": "All", "board": "RBSE" } }
  ]
};
