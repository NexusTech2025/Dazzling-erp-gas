const DATABASE_SCHEMA = {
  "version": "2.2.0",
  "database": "DazzlingDB",
  "categories": {
    "Academic": {
      "tables": {
        "Batch": {
          "primaryKey": "batch_id",
          "columns": {
            "course_id": {
              "type": "foreign_key",
              "maxLength": 255,
              "onDelete": "protect"
            },
            "teacher_id": {
              "type": "foreign_key",
              "maxLength": 255,
              "onDelete": "protect"
            },
            "branch_id": {
              "type": "foreign_key",
              "maxLength": 255,
              "onDelete": "protect"
            },
            "batch_name": {
              "type": "string",
              "required": true,
              "maxLength": 255
            },
            "start_date": {
              "type": "date"
            },
            "end_date": {
              "type": "date"
            },
            "capacity": {
              "type": "number",
              "default": 30
            },
            "batch_type": {
              "type": "string",
              "required": true,
              "choices": [
                "Academy",
                "Computer",
                "Foundation",
                "Competitive"
              ],
              "maxLength": 255
            },
            "status": {
              "type": "string",
              "choices": [
                "active",
                "completed",
                "cancelled"
              ],
              "default": "active",
              "maxLength": 255
            },
            "schedule": {
              "type": "json"
            },
            "batch_id": {
              "type": "auto",
              "idPrefix": "BAT",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "course": {
              "type": "belongsTo",
              "target": "Course",
              "foreignKey": "course_id"
            },
            "teacher": {
              "type": "belongsTo",
              "target": "Teacher",
              "foreignKey": "teacher_id"
            },
            "branch": {
              "type": "belongsTo",
              "target": "Branch",
              "foreignKey": "branch_id"
            },
            "allocations": {
              "type": "hasMany",
              "target": "BatchAllocation",
              "foreignKey": "batch_id"
            },
            "studentleads": {
              "type": "hasMany",
              "target": "StudentLead",
              "foreignKey": "batch_id"
            },
            "studentattendance": {
              "type": "hasMany",
              "target": "StudentAttendance",
              "foreignKey": "batch_id"
            },
            "classtests": {
              "type": "hasMany",
              "target": "Test",
              "foreignKey": "batch_id",
              "onDelete": "protect"
            }
          }
        },
        "BatchAllocation": {
          "primaryKey": "allocation_id",
          "columns": {
            "student_id": {
              "type": "foreign_key",
              "required": true,
              "maxLength": 255,
              "onDelete": "cascade"
            },
            "enrollment_id": {
              "type": "foreign_key",
              "required": true,
              "maxLength": 255,
              "onDelete": "protect"
            },
            "course_id": {
              "type": "foreign_key",
              "required": true,
              "maxLength": 255,
              "onDelete": "protect"
            },
            "batch_id": {
              "type": "foreign_key",
              "required": false,
              "maxLength": 255,
              "onDelete": "protect"
            },
            "status": {
              "type": "string",
              "choices": [
                "active",
                "suspended",
                "completed",
                "dropped"
              ],
              "default": "active",
              "maxLength": 255
            },
            "remarks": {
              "type": "string",
              "required": false,
              "maxLength": 500
            },
            "assigned_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "required": false
            },
            "dropped_at": {
              "type": "datetime",
              "required": false
            },
            "allocation_id": {
              "type": "auto",
              "idPrefix": "BAL",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "student": {
              "type": "belongsTo",
              "target": "Student",
              "foreignKey": "student_id",
              "onDelete": "cascade"
            },
            "enrollment": {
              "type": "belongsTo",
              "target": "Enrollment",
              "foreignKey": "enrollment_id"
            },
            "course": {
              "type": "belongsTo",
              "target": "Course",
              "foreignKey": "course_id"
            },
            "batch": {
              "type": "belongsTo",
              "target": "Batch",
              "foreignKey": "batch_id"
            }
          }
        },
        "Course": {
          "primaryKey": "course_id",
          "columns": {
            "segment_id": {
              "type": "foreign_key",
              "maxLength": 255,
              "onDelete": "protect"
            },
            "entity_type": {
              "type": "string",
              "choices": [
                "subject",
                "course"
              ],
              "maxLength": 255
            },
            "name": {
              "type": "string",
              "required": true,
              "maxLength": 255
            },
            "short_code": {
              "type": "string",
              "unique": true,
              "maxLength": 255
            },
            "language_medium": {
              "type": "string",
              "required": true,
              "choices": [
                "English",
                "Hindi",
                "Urdu"
              ],
              "maxLength": 255
            },
            "description": {
              "type": "string",
              "maxLength": 255
            },
            "duration_value": {
              "type": "number"
            },
            "duration_unit": {
              "type": "string",
              "choices": [
                "months",
                "days",
                "weeks"
              ],
              "default": "months",
              "maxLength": 255
            },
            "base_fee": {
              "type": "number",
              "required": true
            },
            "default_installment_count": {
              "type": "number",
              "default": 1
            },
            "status": {
              "type": "string",
              "choices": [
                "active",
                "inactive"
              ],
              "default": "active",
              "maxLength": 255
            },
            "metadata": {
              "type": "json"
            },
            "course_id": {
              "type": "auto",
              "idPrefix": "CRS",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "coursetype": {
              "type": "belongsTo",
              "target": "CourseType",
              "foreignKey": "segment_id"
            },
            "batches": {
              "type": "hasMany",
              "target": "Batch",
              "foreignKey": "course_id"
            },
            "batchallocations": {
              "type": "hasMany",
              "target": "BatchAllocation",
              "foreignKey": "course_id"
            },
            "teachersubjects": {
              "type": "hasMany",
              "target": "TeacherSubject",
              "foreignKey": "subject_id"
            },
            "enrollments": {
              "type": "hasMany",
              "target": "Enrollment",
              "foreignKey": "item_id"
            },
            "packageitems": {
              "type": "hasMany",
              "target": "PackageItem",
              "foreignKey": "entity_id"
            }
          }
        },
        "CourseType": {
          "primaryKey": "segment_id",
          "columns": {
            "segment_name": {
              "type": "string",
              "required": true,
              "maxLength": 255
            },
            "entity_label": {
              "type": "string",
              "description": "Singular label for items in this segment",
              "maxLength": 255
            },
            "description": {
              "type": "string",
              "maxLength": 255
            },
            "status": {
              "type": "string",
              "choices": [
                "active",
                "inactive"
              ],
              "default": "active",
              "maxLength": 255
            },
            "segment_id": {
              "type": "auto",
              "idPrefix": "SEG",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "courses": {
              "type": "hasMany",
              "target": "Course",
              "foreignKey": "segment_id"
            }
          }
        },
        "Enrollment": {
          "primaryKey": "enrollment_id",
          "columns": {
            "student_id": {
              "type": "foreign_key",
              "required": true,
              "maxLength": 255,
              "onDelete": "cascade"
            },
            "enrollment_type": {
              "type": "string",
              "choices": [
                "course",
                "package",
                "subject"
              ],
              "required": true,
              "maxLength": 255
            },
            "item_id": {
              "type": "foreign_key",
              "required": true,
              "maxLength": 255,
              "onDelete": "protect"
            },
            "roll_number": {
              "type": "number",
              "required": false
            },
            "enrollment_date": {
              "type": "date",
              "required": false
            },
            "status": {
              "type": "string",
              "choices": [
                "active",
                "completed",
                "withdrawn"
              ],
              "default": "active",
              "maxLength": 255
            },
            "academic_status": {
              "type": "string",
              "choices": [
                "active",
                "suspended",
                "completed",
                "withdrawn"
              ],
              "default": "active",
              "maxLength": 255
            },
            "metadata": {
              "type": "json",
              "required": false
            },
            "enrollment_id": {
              "type": "auto",
              "idPrefix": "ENR",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "student": {
              "type": "belongsTo",
              "target": "Student",
              "foreignKey": "student_id",
              "onDelete": "cascade"
            },
            "item": {
              "type": "belongsToPolymorphic",
              "typeField": "enrollment_type",
              "idField": "item_id",
              "mapping": {
                "course": "Course",
                "package": "Package",
                "subject": "Course"
              }
            },
            "allocations": {
              "type": "hasMany",
              "target": "BatchAllocation",
              "foreignKey": "enrollment_id"
            },
            "studentfeeaccounts": {
              "type": "hasMany",
              "target": "StudentFeeAccount",
              "foreignKey": "enrollment_id"
            }
          }
        },
        "Package": {
          "primaryKey": "package_id",
          "columns": {
            "name": {
              "type": "string",
              "required": true,
              "maxLength": 255
            },
            "description": {
              "type": "string",
              "maxLength": 255
            },
            "target_class": {
              "type": "string",
              "maxLength": 255
            },
            "board": {
              "type": "string",
              "maxLength": 255
            },
            "month": {
              "type": "number",
              "description": "Duration in months"
            },
            "package_fee": {
              "type": "number",
              "required": true
            },
            "discount_percent": {
              "type": "number"
            },
            "status": {
              "type": "string",
              "choices": [
                "active",
                "inactive",
                "draft"
              ],
              "default": "active",
              "maxLength": 255
            },
            "package_id": {
              "type": "auto",
              "idPrefix": "PKG",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "packageperks": {
              "type": "hasMany",
              "target": "PackagePerk",
              "foreignKey": "package_id"
            },
            "packageitems": {
              "type": "hasMany",
              "target": "PackageItem",
              "foreignKey": "package_id"
            }
          }
        },
        "PackageItem": {
          "primaryKey": "item_id",
          "columns": {
            "package_id": {
              "type": "foreign_key",
              "required": true,
              "maxLength": 255,
              "onDelete": "protect"
            },
            "entity_type": {
              "type": "string",
              "choices": [
                "course",
                "subject"
              ],
              "maxLength": 255
            },
            "entity_id": {
              "type": "foreign_key",
              "required": true,
              "maxLength": 255,
              "onDelete": "protect"
            },
            "item_id": {
              "type": "auto",
              "idPrefix": "PKI",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "package": {
              "type": "belongsTo",
              "target": "Package",
              "foreignKey": "package_id"
            },
            "entity": {
              "type": "belongsToPolymorphic",
              "typeField": "entity_type",
              "idField": "entity_id",
              "mapping": {
                "course": "Course",
                "subject": "Course"
              }
            }
          }
        },
        "PackagePerk": {
          "primaryKey": "perk_id",
          "columns": {
            "package_id": {
              "type": "foreign_key",
              "maxLength": 255,
              "onDelete": "protect"
            },
            "perk_title": {
              "type": "string",
              "required": true,
              "maxLength": 255
            },
            "perk_description": {
              "type": "string",
              "maxLength": 255
            },
            "icon": {
              "type": "string",
              "maxLength": 255
            },
            "display_order": {
              "type": "number"
            },
            "perk_id": {
              "type": "auto",
              "idPrefix": "PRK",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "package": {
              "type": "belongsTo",
              "target": "Package",
              "foreignKey": "package_id"
            }
          }
        }
      }
    },
    "Attendance": {
      "tables": {
        "StudentAttendance": {
          "primaryKey": "attendance_id",
          "columns": {
            "student_id": {
              "type": "foreign_key",
              "required": true,
              "target": "Student",
              "maxLength": 255,
              "onDelete": "cascade"
            },
            "batch_id": {
              "type": "foreign_key",
              "required": true,
              "target": "Batch",
              "maxLength": 255,
              "onDelete": "protect"
            },
            "attendance_date": {
              "type": "date",
              "required": true
            },
            "status": {
              "type": "string",
              "required": true,
              "choices": [
                "P",
                "A",
                "L"
              ],
              "maxLength": 10
            },
            "entry_time": {
              "type": "datetime",
              "required": false
            },
            "exit_time": {
              "type": "datetime",
              "required": false
            },
            "attendance_mode": {
              "type": "string",
              "choices": [
                "Manual",
                "QR",
                "Biometric"
              ],
              "maxLength": 50,
              "default": "Manual"
            },
            "remarks": {
              "type": "string",
              "maxLength": 500,
              "required": false
            },
            "marked_by": {
              "type": "string",
              "maxLength": 255,
              "required": false
            },
            "attendance_id": {
              "type": "auto",
              "idPrefix": "ATT",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "student": {
              "type": "belongsTo",
              "target": "Student",
              "foreignKey": "student_id",
              "onDelete": "cascade"
            },
            "batch": {
              "type": "belongsTo",
              "target": "Batch",
              "foreignKey": "batch_id",
              "onDelete": "protect"
            }
          }
        },
        "TeacherAttendance": {
          "primaryKey": "attendance_id",
          "columns": {
            "teacher_id": {
              "type": "foreign_key",
              "required": true,
              "target": "Teacher",
              "maxLength": 255,
              "onDelete": "protect"
            },
            "batch_id": {
              "type": "foreign_key",
              "required": true,
              "target": "Batch",
              "maxLength": 255,
              "onDelete": "protect"
            },
            "attendance_date": {
              "type": "date",
              "required": true
            },
            "status": {
              "type": "string",
              "required": true,
              "choices": [
                "P",
                "A",
                "L"
              ],
              "maxLength": 10
            },
            "entry_time": {
              "type": "datetime",
              "required": false
            },
            "exit_time": {
              "type": "datetime",
              "required": false
            },
            "attendance_mode": {
              "type": "string",
              "choices": [
                "Manual",
                "QR",
                "Biometric"
              ],
              "maxLength": 50,
              "default": "Manual"
            },
            "remarks": {
              "type": "string",
              "maxLength": 500,
              "required": false
            },
            "marked_by": {
              "type": "string",
              "maxLength": 255,
              "required": false
            },
            "attendance_id": {
              "type": "auto",
              "idPrefix": "TAT",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "teacher": {
              "type": "belongsTo",
              "target": "Teacher",
              "foreignKey": "teacher_id"
            },
            "batch": {
              "type": "belongsTo",
              "target": "Batch",
              "foreignKey": "batch_id",
              "onDelete": "protect"
            }
          }
        }
      }
    },
    "Auth": {
      "tables": {
        "Session": {
          "primaryKey": "session_id",
          "columns": {
            "user_id": {
              "type": "foreign_key",
              "required": true,
              "maxLength": 255,
              "onDelete": "protect"
            },
            "expires_at": {
              "type": "datetime",
              "required": true
            },
            "client_info": {
              "type": "string",
              "description": "JSON string of device/browser info",
              "maxLength": 255
            },
            "token": {
              "type": "string",
              "unique": true,
              "required": true,
              "maxLength": 255
            },
            "session_id": {
              "type": "auto",
              "idPrefix": "SES",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "user": {
              "type": "belongsTo",
              "target": "User",
              "foreignKey": "user_id"
            }
          }
        },
        "User": {
          "primaryKey": "user_id",
          "columns": {
            "username": {
              "type": "string",
              "required": true,
              "unique": true,
              "maxLength": 255
            },
            "password_hash": {
              "type": "string",
              "required": true,
              "editable": false,
              "maxLength": 255
            },
            "password_salt": {
              "type": "string",
              "required": true,
              "editable": false,
              "description": "Unique salt for password hashing",
              "maxLength": 255
            },
            "failed_attempts": {
              "type": "number",
              "default": 0,
              "description": "Counter for failed login attempts"
            },
            "role": {
              "type": "string",
              "required": true,
              "default": "guest",
              "maxLength": 255
            },
            "status": {
              "type": "string",
              "choices": [
                "active",
                "locked",
                "disabled"
              ],
              "default": "active",
              "maxLength": 255
            },
            "last_login": {
              "type": "datetime"
            },
            "user_id": {
              "type": "auto",
              "idPrefix": "USR",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "sessions": {
              "type": "hasMany",
              "target": "Session",
              "foreignKey": "user_id"
            }
          }
        }
      }
    },
    "Core": {
      "tables": {
        "Branch": {
          "primaryKey": "branch_id",
          "columns": {
            "branch_name": {
              "type": "string",
              "required": true,
              "maxLength": 255
            },
            "location": {
              "type": "string",
              "maxLength": 255
            },
            "status": {
              "type": "string",
              "choices": [
                "active",
                "inactive"
              ],
              "default": "active",
              "maxLength": 255
            },
            "branch_id": {
              "type": "auto",
              "idPrefix": "BRN",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "batches": {
              "type": "hasMany",
              "target": "Batch",
              "foreignKey": "branch_id"
            },
            "teachers": {
              "type": "hasMany",
              "target": "Teacher",
              "foreignKey": "branch_id"
            }
          }
        },
        "PromoCode": {
          "primaryKey": "promo_id",
          "columns": {
            "code": {
              "type": "string",
              "required": true,
              "unique": true,
              "maxLength": 255
            },
            "entity_type": {
              "type": "string",
              "choices": [
                "course",
                "package"
              ],
              "maxLength": 255
            },
            "entity_id": {
              "type": "string",
              "maxLength": 255
            },
            "discount_type": {
              "type": "string",
              "choices": [
                "percentage",
                "amount"
              ],
              "maxLength": 255
            },
            "discount_value": {
              "type": "number"
            },
            "max_usage": {
              "type": "number"
            },
            "valid_from": {
              "type": "date"
            },
            "valid_until": {
              "type": "date"
            },
            "status": {
              "type": "string",
              "choices": [
                "active",
                "expired",
                "disabled"
              ],
              "default": "active",
              "maxLength": 255
            },
            "promo_id": {
              "type": "auto",
              "idPrefix": "PRM",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {}
        }
      }
    },
    "Finance": {
      "tables": {
        "ExpenseCategory": {
          "primaryKey": "category_id",
          "columns": {
            "category_id": {
              "type": "auto",
              "idPrefix": "EXC",
              "editable": false,
              "unique": true,
              "required": false,
              "description": "Unique auto-generated identifier for this expense or revenue category.\nPrefixed with EXC and used as the foreign key in financial transaction logs."
            },
            "name": {
              "type": "string",
              "required": true,
              "unique": true,
              "maxLength": 255,
              "description": "The display name of the financial category (e.g., Rent, Salaries, Marketing).\nMust be unique to prevent duplicates and is used for reporting groups."
            },
            "type": {
              "type": "string",
              "choices": [
                "in",
                "out",
                "both"
              ],
              "default": "both",
              "maxLength": 50,
              "description": "Defines if this category is valid for incoming funds (in), outgoing expenses (out), or both (both).\nRestricts category selections in transaction entry forms."
            },
            "description": {
              "type": "string",
              "maxLength": 255,
              "description": "Additional details outlining the accounting scope of this category.\nHelps administrators classify transactions consistently during entry."
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "moneytransactions": {
              "type": "hasMany",
              "target": "MoneyTransaction",
              "foreignKey": "category_id",
              "onDelete": "protect"
            }
          }
        },
        "FeeAdjustment": {
          "primaryKey": "adjustment_id",
          "columns": {
            "student_fee_id": {
              "type": "foreign_key",
              "maxLength": 255,
              "onDelete": "protect"
            },
            "adjustment_type": {
              "type": "string",
              "choices": [
                "scholarship",
                "coupon",
                "referral",
                "manual"
              ],
              "maxLength": 255
            },
            "amount": {
              "type": "number",
              "required": true
            },
            "reason": {
              "type": "string",
              "maxLength": 255
            },
            "created_by": {
              "type": "string",
              "maxLength": 255
            },
            "adjustment_id": {
              "type": "auto",
              "idPrefix": "FAD",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "studentfeeaccount": {
              "type": "belongsTo",
              "target": "StudentFeeAccount",
              "foreignKey": "student_fee_id",
              "onDelete": "protect"
            }
          }
        },
        "FeePlan": {
          "primaryKey": "fee_plan_id",
          "columns": {
            "entity_id": {
              "type": "string",
              "maxLength": 255
            },
            "entity_type": {
              "type": "string",
              "choices": [
                "course",
                "package",
                "subject"
              ],
              "maxLength": 255
            },
            "plan_name": {
              "type": "string",
              "required": true,
              "maxLength": 255
            },
            "total_fee": {
              "type": "number",
              "required": true
            },
            "discount_allowed": {
              "type": "boolean",
              "default": true
            },
            "installment_allowed": {
              "type": "boolean",
              "default": true
            },
            "fee_plan_id": {
              "type": "auto",
              "idPrefix": "FPL",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "studentfeeaccounts": {
              "type": "hasMany",
              "target": "StudentFeeAccount",
              "foreignKey": "fee_plan_id"
            }
          }
        },
        "Installment": {
          "primaryKey": "installment_id",
          "columns": {
            "student_fee_id": {
              "type": "foreign_key",
              "maxLength": 255,
              "onDelete": "protect"
            },
            "installment_number": {
              "type": "number"
            },
            "due_amount": {
              "type": "number",
              "required": true
            },
            "paid_amount": {
              "type": "number",
              "default": 0
            },
            "late_fee_amount": {
              "type": "number",
              "default": 0
            },
            "due_date": {
              "type": "date",
              "required": true
            },
            "status": {
              "type": "string",
              "choices": [
                "pending",
                "partially_paid",
                "paid",
                "overdue"
              ],
              "default": "pending",
              "maxLength": 255
            },
            "installment_id": {
              "type": "auto",
              "idPrefix": "INS",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "studentfeeaccount": {
              "type": "belongsTo",
              "target": "StudentFeeAccount",
              "foreignKey": "student_fee_id",
              "onDelete": "protect"
            },
            "payments": {
              "type": "hasMany",
              "target": "Payment",
              "foreignKey": "installment_id"
            }
          }
        },
        "MoneyTransaction": {
          "primaryKey": "transaction_id",
          "columns": {
            "transaction_id": {
              "type": "auto",
              "idPrefix": "MTX",
              "editable": false,
              "unique": true,
              "required": false,
              "description": "Unique auto-generated identifier for this general ledger entry.\nPrefixed with MTX and acts as the primary key for the consolidated transaction register."
            },
            "amount": {
              "type": "number",
              "required": true,
              "min": 0.01,
              "description": "The absolute monetary value of this transaction.\nMust be a positive number and represents the physical cash flow amount."
            },
            "type": {
              "type": "string",
              "choices": [
                "in",
                "out"
              ],
              "required": true,
              "maxLength": 50,
              "description": "The flow direction of the money, either 'in' for revenue inflows or 'out' for expense outflows.\nUsed to calculate net cash balances in reports."
            },
            "by": {
              "type": "string",
              "required": true,
              "maxLength": 255,
              "description": "The internal system handler signatures. If type=='in' means Received By; if type=='out' means Sent By."
            },
            "from_to": {
              "type": "string",
              "required": true,
              "maxLength": 255,
              "description": "The target counterparty description label. If type=='in' means Received From; if type=='out' means Sent To."
            },
            "category_id": {
              "type": "foreign_key",
              "target": "ExpenseCategory",
              "required": true,
              "maxLength": 255,
              "onDelete": "protect",
              "description": "Foreign key referencing the ExpenseCategory table.\nGroups the transaction into accounting categories like rent, marketing, or salaries."
            },
            "payment_method": {
              "type": "string",
              "choices": [
                "cash",
                "paytm",
                "phonepe",
                "bank",
                "other"
              ],
              "maxLength": 255,
              "required": true,
              "description": "The physical or digital channel used to complete the transaction (cash, paytm, phonepe, bank, or other).\nMatches cash drawer tracking."
            },
            "payment_reference": {
              "type": "string",
              "maxLength": 255,
              "required": false,
              "description": "Optional reference details such as transaction hash, bank reference, or check numbers.\nCrucial for tracing funds in bank audits."
            },
            "attachment_drive_id": {
              "type": "string",
              "maxLength": 255,
              "required": false,
              "description": "Clean Google Drive file reference unique string pointing to scanned receipt/invoice attachments."
            },
            "reconciliation_status": {
              "type": "string",
              "choices": [
                "unreconciled",
                "matched",
                "discrepancy"
              ],
              "default": "unreconciled",
              "required": true,
              "description": "Audit control check matching physical cash drawers to bank settlement records.",
              "maxLength": 255
            },
            "party_type": {
              "type": "string",
              "choices": [
                "student",
                "teacher",
                "staff",
                "external"
              ],
              "maxLength": 50,
              "required": true,
              "description": "Identifies the database model of the related party (student, teacher, staff, or external).\nGoverns the target registry path for polymorphic lookups."
            },
            "party_id": {
              "type": "foreign_key",
              "required": false,
              "maxLength": 255,
              "onDelete": "do_nothing",
              "description": "The foreign key targeting the specific party record (STU-XXX, TCH-XXX, STF-XXX).\nKept null for external parties who do not have system profiles."
            },
            "party_name": {
              "type": "string",
              "maxLength": 255,
              "required": true,
              "description": "The literal name of the transaction partner.\nUsed for external parties (e.g., local vendors) or to cache names for rapid display."
            },
            "transaction_date": {
              "type": "date",
              "required": true,
              "description": "The calendar date when the money was physically exchanged.\nSeparate from creation timestamps to support backdated bookkeeping entry."
            },
            "notes": {
              "type": "string",
              "maxLength": 255,
              "required": false,
              "description": "General descriptive details of the transaction (e.g., 'Weekly grocery expenses', 'Refund for session').\nHelps clarify the purpose of the expense."
            },
            "remarks": {
              "type": "string",
              "maxLength": 255,
              "required": false,
              "description": "Internal accounting notes or auditor corrections.\nUsed for special payment flags, dispute details, or correction logs."
            },
            "created_by": {
              "type": "string",
              "maxLength": 255,
              "required": false,
              "description": "The username or email of the system user who logged this transaction.\nEssential for audit trails and tracing accountability."
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "category": {
              "type": "belongsTo",
              "target": "ExpenseCategory",
              "foreignKey": "category_id",
              "onDelete": "protect"
            },
            "party": {
              "type": "belongsToPolymorphic",
              "typeField": "party_type",
              "idField": "party_id",
              "onDelete": "do_nothing",
              "mapping": {
                "student": "Student",
                "teacher": "Teacher",
                "staff": "StaffMember"
              }
            }
          }
        },
        "Payment": {
          "primaryKey": "payment_id",
          "columns": {
            "installment_id": {
              "type": "foreign_key",
              "maxLength": 255,
              "onDelete": "protect"
            },
            "student_fee_id": {
              "type": "foreign_key",
              "maxLength": 255,
              "onDelete": "protect"
            },
            "amount_paid": {
              "type": "number",
              "required": true
            },
            "payment_date": {
              "type": "datetime"
            },
            "payment_method": {
              "type": "string",
              "choices": [
                "cash",
                "upi",
                "bank_transfer",
                "cheque"
              ],
              "maxLength": 255
            },
            "transaction_reference": {
              "type": "string",
              "maxLength": 255
            },
            "status": {
              "type": "string",
              "choices": [
                "success",
                "pending",
                "failed"
              ],
              "default": "success",
              "maxLength": 255
            },
            "remarks": {
              "type": "string",
              "maxLength": 255
            },
            "created_by": {
              "type": "string",
              "maxLength": 255
            },
            "payment_id": {
              "type": "auto",
              "idPrefix": "PAY",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "installment": {
              "type": "belongsTo",
              "target": "Installment",
              "foreignKey": "installment_id",
              "onDelete": "protect"
            },
            "studentfeeaccount": {
              "type": "belongsTo",
              "target": "StudentFeeAccount",
              "foreignKey": "student_fee_id",
              "onDelete": "protect"
            }
          }
        },
        "StudentFeeAccount": {
          "primaryKey": "student_fee_id",
          "columns": {
            "enrollment_id": {
              "type": "foreign_key",
              "maxLength": 255,
              "onDelete": "cascade"
            },
            "fee_plan_id": {
              "type": "foreign_key",
              "maxLength": 255,
              "onDelete": "protect"
            },
            "total_fee": {
              "type": "number"
            },
            "discount": {
              "type": "number",
              "default": 0
            },
            "adjustment_type": {
              "type": "string",
              "choices": [
                "scholarship",
                "coupon",
                "referral",
                "manual_override",
                "none"
              ],
              "maxLength": 255
            },
            "coupon_code": {
              "type": "string",
              "maxLength": 255
            },
            "final_fee": {
              "type": "number"
            },
            "amount_paid": {
              "type": "number",
              "default": 0
            },
            "balance_due": {
              "type": "number"
            },
            "is_overdue": {
              "type": "boolean",
              "default": false
            },
            "penalty_amount": {
              "type": "number",
              "default": 0
            },
            "next_due_date": {
              "type": "date"
            },
            "status": {
              "type": "string",
              "choices": [
                "active",
                "completed",
                "defaulted",
                "refunded"
              ],
              "default": "active",
              "maxLength": 255
            },
            "remarks": {
              "type": "string",
              "maxLength": 255
            },
            "created_by": {
              "type": "string",
              "maxLength": 255
            },
            "student_fee_id": {
              "type": "auto",
              "idPrefix": "SFA",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "enrollment": {
              "type": "belongsTo",
              "target": "Enrollment",
              "foreignKey": "enrollment_id",
              "onDelete": "cascade"
            },
            "feeplan": {
              "type": "belongsTo",
              "target": "FeePlan",
              "foreignKey": "fee_plan_id"
            },
            "feeadjustments": {
              "type": "hasMany",
              "target": "FeeAdjustment",
              "foreignKey": "student_fee_id"
            },
            "installments": {
              "type": "hasMany",
              "target": "Installment",
              "foreignKey": "student_fee_id"
            },
            "payments": {
              "type": "hasMany",
              "target": "Payment",
              "foreignKey": "student_fee_id"
            }
          }
        }
      }
    },
    "Staff": {
      "tables": {
        "StaffMember": {
          "primaryKey": "staff_id",
          "columns": {
            "staff_id": {
              "type": "auto",
              "idPrefix": "STF",
              "editable": false,
              "unique": true,
              "required": false,
              "description": "Unique auto-generated identifier for the non-faculty staff member.\nPrefixed with STF and used as the polymorphic target ID in money transaction tables."
            },
            "name": {
              "type": "string",
              "required": true,
              "maxLength": 255,
              "description": "The full legal name of the staff member.\nUsed in payroll processing, HR lists, and display references on admin dashboards."
            },
            "role": {
              "type": "string",
              "choices": [
                "admin",
                "receptionist",
                "support",
                "security",
                "cleaner",
                "other"
              ],
              "default": "other",
              "maxLength": 255,
              "description": "The designated organizational role of the staff member (e.g. admin, receptionist, security, cleaner).\nHelps define operational boundaries and access permissions."
            },
            "status": {
              "type": "string",
              "choices": [
                "active",
                "inactive"
              ],
              "default": "active",
              "maxLength": 255,
              "description": "Indicates if the staff member is currently active or inactive.\nInactive staff are hidden from active rosters and cannot be selected for new payouts."
            },
            "phone": {
              "type": "string",
              "maxLength": 50,
              "description": "Contact telephone number of the staff member.\nUsed for HR communication and verifying identity details."
            },
            "email": {
              "type": "string",
              "maxLength": 255,
              "description": "The official email address of the staff member.\nUsed for sending payment receipts, account notifications, and communication logs."
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "moneytransactions": {
              "type": "hasMany",
              "target": "MoneyTransaction",
              "foreignKey": "party_id",
              "onDelete": "do_nothing"
            }
          }
        },
        "Teacher": {
          "primaryKey": "teacher_id",
          "columns": {
            "full_name": {
              "type": "string",
              "required": true,
              "maxLength": 255
            },
            "mobile_number": {
              "type": "string",
              "required": true,
              "unique": true,
              "maxLength": 255
            },
            "email": {
              "type": "string",
              "unique": true,
              "maxLength": 255
            },
            "gender": {
              "type": "string",
              "choices": [
                "male",
                "female",
                "other"
              ],
              "maxLength": 255
            },
            "date_of_birth": {
              "type": "date"
            },
            "profile_photo_url": {
              "type": "string",
              "maxLength": 255
            },
            "experience_years": {
              "type": "number",
              "required": true
            },
            "qualification": {
              "type": "string",
              "maxLength": 255
            },
            "specialization": {
              "type": "string",
              "maxLength": 255
            },
            "previous_institute": {
              "type": "string",
              "maxLength": 255
            },
            "teacher_type": {
              "type": "string",
              "required": true,
              "choices": [
                "full_time",
                "part_time",
                "guest"
              ],
              "maxLength": 255
            },
            "joining_date": {
              "type": "date",
              "required": true
            },
            "status": {
              "type": "string",
              "choices": [
                "active",
                "inactive",
                "pending"
              ],
              "default": "active",
              "maxLength": 255
            },
            "notes": {
              "type": "string",
              "maxLength": 255
            },
            "created_by": {
              "type": "string",
              "maxLength": 255
            },
            "branch_id": {
              "type": "foreign_key",
              "description": "FK reference to the Branch where this teacher is assigned",
              "maxLength": 255,
              "onDelete": "protect"
            },
            "address": {
              "type": "string",
              "description": "Residential address of the teacher",
              "maxLength": 500
            },
            "prefered_time_slot": {
              "type": "string",
              "choices": [
                "Morning",
                "Afternoon",
                "Evening"
              ],
              "description": "Preferred time slot for teaching",
              "maxLength": 255,
              "required": false
            },
            "teacher_id": {
              "type": "auto",
              "idPrefix": "TCH",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "branch": {
              "type": "belongsTo",
              "target": "Branch",
              "foreignKey": "branch_id"
            },
            "teachersubject": {
              "type": "hasMany",
              "target": "TeacherSubject",
              "foreignKey": "teacher_id"
            },
            "teachersalaryconfig": {
              "type": "hasMany",
              "target": "TeacherSalaryConfig",
              "foreignKey": "teacher_id"
            },
            "teacherdocument": {
              "type": "hasMany",
              "target": "TeacherDocument",
              "foreignKey": "teacher_id"
            },
            "teacherpaymenttransaction": {
              "type": "hasMany",
              "target": "TeacherPaymentTransaction",
              "foreignKey": "teacher_id"
            },
            "batches": {
              "type": "hasMany",
              "target": "Batch",
              "foreignKey": "teacher_id"
            },
            "teacherattendance": {
              "type": "hasMany",
              "target": "TeacherAttendance",
              "foreignKey": "teacher_id"
            },
            "moneytransactions": {
              "type": "hasMany",
              "target": "MoneyTransaction",
              "foreignKey": "party_id",
              "onDelete": "do_nothing"
            }
          }
        },
        "TeacherDocument": {
          "primaryKey": "document_id",
          "columns": {
            "teacher_id": {
              "type": "foreign_key",
              "required": true,
              "maxLength": 255,
              "onDelete": "protect"
            },
            "document_type": {
              "type": "string",
              "choices": [
                "id_proof",
                "resume",
                "other"
              ],
              "maxLength": 255
            },
            "file_url": {
              "type": "string",
              "required": true,
              "maxLength": 255
            },
            "uploaded_at": {
              "type": "datetime"
            },
            "document_id": {
              "type": "auto",
              "idPrefix": "TDO",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "teacher": {
              "type": "belongsTo",
              "target": "Teacher",
              "foreignKey": "teacher_id"
            }
          }
        },
        "TeacherPaymentTransaction": {
          "primaryKey": "transaction_id",
          "columns": {
            "teacher_id": {
              "type": "foreign_key",
              "required": true,
              "maxLength": 255,
              "onDelete": "protect"
            },
            "salary_config_id": {
              "type": "foreign_key",
              "maxLength": 255,
              "onDelete": "protect"
            },
            "payment_type": {
              "type": "string",
              "required": true,
              "choices": [
                "salary",
                "advance",
                "bonus",
                "deduction"
              ],
              "maxLength": 255
            },
            "amount": {
              "type": "number",
              "required": true
            },
            "payment_mode": {
              "type": "string",
              "required": true,
              "choices": [
                "cash",
                "bank_transfer",
                "upi",
                "cheque"
              ],
              "maxLength": 255
            },
            "transaction_date": {
              "type": "date",
              "required": true
            },
            "reference_number": {
              "type": "string",
              "maxLength": 255
            },
            "notes": {
              "type": "string",
              "maxLength": 255
            },
            "salary_month": {
              "type": "string",
              "maxLength": 255
            },
            "created_by": {
              "type": "string",
              "maxLength": 255
            },
            "transaction_id": {
              "type": "auto",
              "idPrefix": "TPT",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "teacher": {
              "type": "belongsTo",
              "target": "Teacher",
              "foreignKey": "teacher_id"
            },
            "teachersalaryconfig": {
              "type": "belongsTo",
              "target": "TeacherSalaryConfig",
              "foreignKey": "salary_config_id"
            }
          }
        },
        "TeacherSalaryConfig": {
          "primaryKey": "salary_config_id",
          "columns": {
            "teacher_id": {
              "type": "foreign_key",
              "required": true,
              "maxLength": 255,
              "onDelete": "protect"
            },
            "salary_type": {
              "type": "string",
              "required": true,
              "choices": [
                "monthly",
                "per_class"
              ],
              "maxLength": 255
            },
            "base_amount": {
              "type": "number",
              "required": true
            },
            "effective_from": {
              "type": "date",
              "required": true
            },
            "salary_config_id": {
              "type": "auto",
              "idPrefix": "TSC",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "teacher": {
              "type": "belongsTo",
              "target": "Teacher",
              "foreignKey": "teacher_id"
            },
            "teacherpaymenttransactions": {
              "type": "hasMany",
              "target": "TeacherPaymentTransaction",
              "foreignKey": "salary_config_id"
            }
          }
        },
        "TeacherSubject": {
          "primaryKey": "teacher_subject_id",
          "columns": {
            "teacher_id": {
              "type": "foreign_key",
              "required": true,
              "maxLength": 255,
              "onDelete": "protect"
            },
            "subject_id": {
              "type": "foreign_key",
              "required": true,
              "maxLength": 255,
              "onDelete": "protect"
            },
            "teacher_subject_id": {
              "type": "auto",
              "idPrefix": "TSB",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "teacher": {
              "type": "belongsTo",
              "target": "Teacher",
              "foreignKey": "teacher_id"
            },
            "subject": {
              "type": "belongsTo",
              "target": "Course",
              "foreignKey": "subject_id"
            }
          }
        }
      }
    },
    "Students": {
      "tables": {
        "Address": {
          "primaryKey": "address_id",
          "columns": {
            "student_id": {
              "type": "foreign_key",
              "maxLength": 255,
              "onDelete": "cascade",
              "unique": true
            },
            "line1": {
              "type": "string",
              "required": true,
              "maxLength": 255
            },
            "line2": {
              "type": "string",
              "maxLength": 255
            },
            "city": {
              "type": "string",
              "required": true,
              "maxLength": 255
            },
            "state": {
              "type": "string",
              "required": true,
              "maxLength": 255
            },
            "pin_code": {
              "type": "string",
              "required": true,
              "maxLength": 255
            },
            "country": {
              "type": "string",
              "default": "India",
              "maxLength": 255
            },
            "address_id": {
              "type": "auto",
              "idPrefix": "ADR",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "student": {
              "type": "belongsTo",
              "target": "Student",
              "foreignKey": "student_id",
              "onDelete": "cascade"
            },
            "contactinfos": {
              "type": "hasMany",
              "target": "ContactInfo",
              "foreignKey": "address_id"
            }
          }
        },
        "ContactInfo": {
          "primaryKey": "contact_id",
          "columns": {
            "student_id": {
              "type": "foreign_key",
              "maxLength": 255,
              "onDelete": "cascade",
              "unique": true
            },
            "address_id": {
              "type": "foreign_key",
              "maxLength": 255,
              "onDelete": "cascade"
            },
            "email": {
              "type": "string",
              "maxLength": 255
            },
            "mobile_number": {
              "type": "string",
              "maxLength": 255
            },
            "emergency_name": {
              "type": "string",
              "maxLength": 255
            },
            "emergency_phone": {
              "type": "string",
              "maxLength": 255
            },
            "emergency_relationship": {
              "type": "string",
              "maxLength": 255
            },
            "contact_id": {
              "type": "auto",
              "idPrefix": "CON",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "student": {
              "type": "belongsTo",
              "target": "Student",
              "foreignKey": "student_id",
              "onDelete": "cascade"
            },
            "address": {
              "type": "belongsTo",
              "target": "Address",
              "foreignKey": "address_id",
              "onDelete": "cascade"
            }
          }
        },
        "Education": {
          "primaryKey": "education_id",
          "columns": {
            "student_id": {
              "type": "foreign_key",
              "maxLength": 255,
              "onDelete": "cascade"
            },
            "highest_qualification": {
              "type": "string",
              "maxLength": 255
            },
            "institution_name": {
              "type": "string",
              "maxLength": 255
            },
            "year_of_passing": {
              "type": "number"
            },
            "percentage_or_cgpa": {
              "type": "string",
              "maxLength": 255
            },
            "education_id": {
              "type": "auto",
              "idPrefix": "EDU",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "student": {
              "type": "belongsTo",
              "target": "Student",
              "foreignKey": "student_id",
              "onDelete": "cascade"
            }
          }
        },
        "Student": {
          "primaryKey": "student_id",
          "columns": {
            "student_name": {
              "type": "string",
              "required": true,
              "maxLength": 255
            },
            "email": {
              "type": "string",
              "unique": true,
              "maxLength": 255
            },
            "phone": {
              "type": "string",
              "maxLength": 255
            },
            "gender": {
              "type": "string",
              "choices": [
                "Male",
                "Female",
                "Other"
              ],
              "maxLength": 255
            },
            "dob": {
              "type": "date"
            },
            "mother_name": {
              "type": "string",
              "maxLength": 255
            },
            "father_name": {
              "type": "string",
              "maxLength": 255
            },
            "avatarUrl": {
              "type": "string",
              "maxLength": 255
            },
            "status": {
              "type": "string",
              "choices": [
                "active",
                "inactive",
                "applicant"
              ],
              "default": "active",
              "maxLength": 255
            },
            "student_id": {
              "type": "auto",
              "idPrefix": "STU",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "address": {
              "type": "hasOne",
              "target": "Address",
              "foreignKey": "student_id"
            },
            "contact": {
              "type": "hasOne",
              "target": "ContactInfo",
              "foreignKey": "student_id"
            },
            "education": {
              "type": "hasMany",
              "target": "Education",
              "foreignKey": "student_id"
            },
            "enrollments": {
              "type": "hasMany",
              "target": "Enrollment",
              "foreignKey": "student_id"
            },
            "allocations": {
              "type": "hasMany",
              "target": "BatchAllocation",
              "foreignKey": "student_id"
            },
            "moneytransactions": {
              "type": "hasMany",
              "target": "MoneyTransaction",
              "foreignKey": "party_id",
              "onDelete": "do_nothing"
            },
            "studentattendance": {
              "type": "hasMany",
              "target": "StudentAttendance",
              "foreignKey": "student_id"
            },
            "testmarks": {
              "type": "hasMany",
              "target": "TestMarks",
              "foreignKey": "student_id",
              "onDelete": "do_nothing"
            }
          }
        },
        "StudentLead": {
          "primaryKey": "lead_id",
          "columns": {
            "student_name": {
              "type": "string",
              "required": true,
              "maxLength": 255
            },
            "phone": {
              "type": "string",
              "required": true,
              "maxLength": 255
            },
            "email": {
              "type": "string",
              "maxLength": 255
            },
            "batch_id": {
              "type": "foreign_key",
              "required": true,
              "maxLength": 255,
              "onDelete": "protect"
            },
            "referral_id": {
              "type": "string",
              "maxLength": 255
            },
            "internal_notes": {
              "type": "string",
              "maxLength": 255
            },
            "lead_source": {
              "type": "string",
              "choices": [
                "walk-in",
                "online",
                "referral",
                "social_media",
                "other"
              ],
              "default": "walk-in",
              "required": true,
              "maxLength": 255
            },
            "priority": {
              "type": "string",
              "choices": [
                "ready_to_enroll",
                "hot",
                "warm",
                "cold"
              ],
              "default": "ready_to_enroll",
              "required": true,
              "maxLength": 255
            },
            "status": {
              "type": "string",
              "choices": [
                "prospect",
                "contacted",
                "converted",
                "lost"
              ],
              "default": "prospect",
              "required": true,
              "maxLength": 255
            },
            "is_registered": {
              "type": "boolean",
              "default": false
            },
            "created_at": {
              "type": "datetime",
              "autoNowAdd": true
            },
            "updated_at": {
              "type": "datetime",
              "autoNow": true
            },
            "lead_id": {
              "type": "auto",
              "idPrefix": "SLD",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "batch": {
              "type": "belongsTo",
              "target": "Batch",
              "foreignKey": "batch_id"
            }
          }
        }
      }
    },
    "Test": {
      "tables": {
        "Test": {
          "primaryKey": "id",
          "columns": {
            "title": {
              "type": "string",
              "required": true,
              "maxLength": 255
            },
            "batch_id": {
              "type": "foreign_key",
              "required": true,
              "target": "Batch",
              "maxLength": 255,
              "onDelete": "protect"
            },
            "test_date": {
              "type": "date",
              "required": true
            },
            "total_marks": {
              "type": "number",
              "required": true,
              "validations": [
                {
                  "rule": "custom",
                  "handler": "validatePositiveTotalMarks"
                }
              ]
            },
            "passing_marks": {
              "type": "number",
              "required": true,
              "default": 0,
              "validations": [
                {
                  "rule": "custom",
                  "handler": "validatePassingMarks"
                }
              ]
            },
            "status": {
              "type": "string",
              "required": true,
              "choices": [
                "Draft",
                "Completed",
                "Published"
              ],
              "default": "Draft",
              "maxLength": 50
            },
            "remarks": {
              "type": "string",
              "required": false,
              "maxLength": 1000
            },
            "created_at": {
              "type": "datetime",
              "autoNowAdd": true
            },
            "updated_at": {
              "type": "datetime",
              "autoNow": true
            },
            "id": {
              "type": "auto",
              "idPrefix": "TST",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "batch": {
              "type": "belongsTo",
              "target": "Batch",
              "foreignKey": "batch_id",
              "onDelete": "protect"
            },
            "marks": {
              "type": "hasMany",
              "target": "TestMarks",
              "foreignKey": "test_id"
            },
            "papers": {
              "type": "hasMany",
              "target": "TestPaper",
              "foreignKey": "test_id"
            }
          }
        },
        "TestMarks": {
          "primaryKey": "id",
          "columns": {
            "test_id": {
              "type": "foreign_key",
              "required": true,
              "target": "Test",
              "maxLength": 255,
              "onDelete": "cascade"
            },
            "student_id": {
              "type": "foreign_key",
              "required": true,
              "target": "Student",
              "maxLength": 255,
              "onDelete": "cascade",
              "validations": [
                {
                  "rule": "custom",
                  "handler": "validateStudentAllocation"
                }
              ]
            },
            "obtained_marks": {
              "type": "number",
              "required": false,
              "validations": [
                {
                  "rule": "custom",
                  "handler": "validateObtainedMarks"
                }
              ]
            },
            "is_absent": {
              "type": "boolean",
              "default": false,
              "required": true
            },
            "remarks": {
              "type": "string",
              "required": false,
              "maxLength": 500
            },
            "created_at": {
              "type": "datetime",
              "autoNowAdd": true
            },
            "updated_at": {
              "type": "datetime",
              "autoNow": true
            },
            "id": {
              "type": "auto",
              "idPrefix": "TMK",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "test": {
              "type": "belongsTo",
              "target": "Test",
              "foreignKey": "test_id",
              "onDelete": "cascade"
            },
            "student": {
              "type": "belongsTo",
              "target": "Student",
              "foreignKey": "student_id",
              "onDelete": "cascade"
            }
          }
        },
        "TestPaper": {
          "primaryKey": "id",
          "columns": {
            "test_id": {
              "type": "foreign_key",
              "required": true,
              "target": "Test",
              "maxLength": 255,
              "onDelete": "cascade"
            },
            "title": {
              "type": "string",
              "required": true,
              "maxLength": 255
            },
            "paper_file_url": {
              "type": "string",
              "required": false,
              "maxLength": 1000
            },
            "answer_key_file_url": {
              "type": "string",
              "required": false,
              "maxLength": 1000
            },
            "uploaded_at": {
              "type": "datetime",
              "autoNowAdd": true
            },
            "id": {
              "type": "auto",
              "idPrefix": "TPP",
              "editable": false,
              "unique": true,
              "required": false
            },
            "__tx_id": {
              "type": "string",
              "system": true,
              "required": false,
              "editable": false,
              "description": "Unique Transaction ID"
            },
            "__tx_status": {
              "type": "string",
              "choices": [
                "PENDING",
                "COMMITTED",
                "FAILED"
              ],
              "default": "PENDING",
              "system": true,
              "required": false,
              "editable": false
            },
            "__created_at": {
              "type": "datetime",
              "autoNowAdd": true,
              "system": true,
              "required": false,
              "editable": false
            }
          },
          "relations": {
            "test": {
              "type": "belongsTo",
              "target": "Test",
              "foreignKey": "test_id",
              "onDelete": "cascade"
            }
          }
        }
      }
    }
  }
};
