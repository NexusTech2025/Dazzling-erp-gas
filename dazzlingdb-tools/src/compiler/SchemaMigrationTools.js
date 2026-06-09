/**
 * @file SchemaMigrationTools.js
 * @description Schema migration and alignment utility suite.
 * 
 * Provides structural routines to automate schema consistency and integrity corrections:
 * 1. `fixFkTypes`:
 *    - Scans schemas and converts column types from standard text/number representations (e.g. "string")
 *      to the explicit "foreign_key" type for any column referenced in a "belongsTo" or "belongsToPolymorphic" relation.
 *    - Automatically corrects relationship directions (e.g. converting erroneous "hasOne" types to "belongsTo"
 *      on child tables holding the physical foreign key columns).
 * 2. `fixBackwardRefs`:
 *    - Restores relational symmetry by appending missing inverse relationship properties ("hasMany"/"hasOne")
 *      to parent tables pointing back to children.
 *    - Enables reliable bidirectional traversal, eager loading, serialization, and cascading constraint resolution.
 */

const fs = require('fs');
const path = require('path');
const Logger = require('../logger/Logger');

const REVERSE_RELATIONS = {
  "Teacher.json": {
    "batches": {
      "type": "hasMany",
      "target": "Batch",
      "foreignKey": "teacher_id"
    },
    "teacherattendance": {
      "type": "hasMany",
      "target": "TeacherAttendance",
      "foreignKey": "teacher_id"
    }
  },
  "Branch.json": {
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
  },
  "CourseType.json": {
    "courses": {
      "type": "hasMany",
      "target": "Course",
      "foreignKey": "segment_id"
    }
  },
  "Package.json": {
    "packageitems": {
      "type": "hasMany",
      "target": "PackageItem",
      "foreignKey": "package_id"
    }
  },
  "User.json": {
    "sessions": {
      "type": "hasMany",
      "target": "Session",
      "foreignKey": "user_id"
    }
  },
  "StudentFeeAccount.json": {
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
  },
  "Installment.json": {
    "payments": {
      "type": "hasMany",
      "target": "Payment",
      "foreignKey": "installment_id"
    }
  },
  "Enrollment.json": {
    "studentfeeaccounts": {
      "type": "hasMany",
      "target": "StudentFeeAccount",
      "foreignKey": "enrollment_id"
    }
  },
  "FeePlan.json": {
    "studentfeeaccounts": {
      "type": "hasMany",
      "target": "StudentFeeAccount",
      "foreignKey": "fee_plan_id"
    }
  },
  "TeacherSalaryConfig.json": {
    "teacherpaymenttransactions": {
      "type": "hasMany",
      "target": "TeacherPaymentTransaction",
      "foreignKey": "salary_config_id"
    }
  },
  "Address.json": {
    "contactinfos": {
      "type": "hasMany",
      "target": "ContactInfo",
      "foreignKey": "address_id"
    }
  },
  "Batch.json": {
    "studentleads": {
      "type": "hasMany",
      "target": "StudentLead",
      "foreignKey": "batch_id"
    }
  }
};

function getJsonFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getJsonFiles(fullPath));
    } else if (file.endsWith('.json')) {
      results.push(fullPath);
    }
  });
  return results;
}

/**
 * Normalizes and converts all physical foreign keys to `"type": "foreign_key"`.
 */
function fixFkTypes(schemaDir) {
  const files = getJsonFiles(schemaDir);
  Logger.logEvent({ level: 'info', category: 'migration', message: `Scanning ${files.length} schema files to correct foreign key column types...` });

  // Load all schemas
  const schemas = {};
  files.forEach(filePath => {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      schemas[filePath] = JSON.parse(content);
    } catch (err) {
      Logger.logEvent({ level: 'error', category: 'migration', message: `Failed to read ${filePath}: ${err.message}` });
    }
  });

  // 1. One-to-one type fixes (so that address, contact, studentfeeaccount are belongsTo)
  for (const [filePath, schema] of Object.entries(schemas)) {
    const fileName = path.basename(filePath);
    if (fileName === 'Address.json' && schema.relations && schema.relations.student && schema.relations.student.type === 'hasOne') {
      schema.relations.student.type = 'belongsTo';
      Logger.logEvent({ level: 'info', category: 'migration', message: `Fixing Address.json relation 'student' type to 'belongsTo'` });
    }
    if (fileName === 'ContactInfo.json' && schema.relations && schema.relations.student && schema.relations.student.type === 'hasOne') {
      schema.relations.student.type = 'belongsTo';
      Logger.logEvent({ level: 'info', category: 'migration', message: `Fixing ContactInfo.json relation 'student' type to 'belongsTo'` });
    }
    if (fileName === 'StudentFeeAccount.json' && schema.relations && schema.relations.enrollment && schema.relations.enrollment.type === 'hasOne') {
      schema.relations.enrollment.type = 'belongsTo';
      Logger.logEvent({ level: 'info', category: 'migration', message: `Fixing StudentFeeAccount.json relation 'enrollment' type to 'belongsTo'` });
    }
  }

  // 2. Set belongsTo / belongsToPolymorphic foreign key column types to 'foreign_key' and align onDelete
  let modifiedCount = 0;
  for (const [filePath, schema] of Object.entries(schemas)) {
    let changed = false;
    if (schema.relations) {
      for (const [relName, relConfig] of Object.entries(schema.relations)) {
        if (relConfig.type === 'belongsTo') {
          const fk = relConfig.foreignKey;
          if (fk && schema.columns && schema.columns[fk]) {
            const relOnDelete = relConfig.onDelete || 'protect';
            if (schema.columns[fk].type !== 'foreign_key' || schema.columns[fk].onDelete !== relOnDelete) {
              Logger.logEvent({ level: 'info', category: 'migration', message: `Updating ${path.basename(filePath)} columns.${fk} type to 'foreign_key' and onDelete to '${relOnDelete}'` });
              schema.columns[fk].type = 'foreign_key';
              schema.columns[fk].onDelete = relOnDelete;
              changed = true;
            }
          }
        } else if (relConfig.type === 'belongsToPolymorphic') {
          const idField = relConfig.idField;
          if (idField && schema.columns && schema.columns[idField]) {
            const relOnDelete = relConfig.onDelete || 'protect';
            if (schema.columns[idField].type !== 'foreign_key' || schema.columns[idField].onDelete !== relOnDelete) {
              Logger.logEvent({ level: 'info', category: 'migration', message: `Updating ${path.basename(filePath)} columns.${idField} (polymorphic) type to 'foreign_key' and onDelete to '${relOnDelete}'` });
              schema.columns[idField].type = 'foreign_key';
              schema.columns[idField].onDelete = relOnDelete;
              changed = true;
            }
          }
        }
      }
    }
    if (changed) {
      fs.writeFileSync(filePath, JSON.stringify(schema, null, 2) + '\n', 'utf8');
      modifiedCount++;
    }
  }

  Logger.logEvent({ level: 'success', category: 'migration', message: `Successfully updated foreign key types in ${modifiedCount} schemas.` });
}

/**
 * Appends missing reverse relationship mappings to schemas.
 */
function fixBackwardRefs(schemaDir) {
  const files = getJsonFiles(schemaDir);
  Logger.logEvent({ level: 'info', category: 'migration', message: `Scanning ${files.length} schema files to add missing backward relations...` });

  let modifiedCount = 0;

  files.forEach(filePath => {
    const fileName = path.basename(filePath);
    const updates = REVERSE_RELATIONS[fileName];
    if (updates) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const schema = JSON.parse(content);
        
        if (!schema.relations) {
          schema.relations = {};
        }

        let changed = false;
        for (const [relName, relConfig] of Object.entries(updates)) {
          if (!schema.relations[relName]) {
            Logger.logEvent({ level: 'info', category: 'migration', message: `Adding reverse relation '${relName}' to ${fileName}` });
            schema.relations[relName] = relConfig;
            changed = true;
          }
        }

        if (changed) {
          fs.writeFileSync(filePath, JSON.stringify(schema, null, 2) + '\n', 'utf8');
          modifiedCount++;
        }
      } catch (err) {
        Logger.logEvent({ level: 'error', category: 'migration', message: `Failed to process ${fileName}: ${err.message}` });
      }
    }
  });

  Logger.logEvent({ level: 'success', category: 'migration', message: `Successfully added reverse relations to ${modifiedCount} schemas.` });
}

module.exports = {
  fixFkTypes,
  fixBackwardRefs
};
