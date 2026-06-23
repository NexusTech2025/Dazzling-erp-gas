# Domain Actions: Staff & HR

This handbook serves as the technical API blog documenting the lifecycle, contract, and codebase integrations for the Staff & HR domain in **DazzlingDB**.

---

# Action Post: `staff_update_teacher` — The Consolidated Update Engine

Updating a complex, highly relational entity like a teacher is notoriously difficult in spreadsheet-based databases. In this post, we explore how DazzlingDB solves this elegantly by executing profile updates, subject syncs, and salary configuration modifications in a single consolidated API call.

## 1. Request / Response Lifecycle

```
[Incoming POST Request]
         │
         ▼
[ApiDispatcher.js]  ──► Route registered action key `"staff_update_teacher"`
         │
         ▼
[ConcreteActions.js] ──► Parse payload, validate `teacher_id` existence in request
         │
         ▼
[StaffService.js] ──► Orchestrate consolidated update:
         │
         ├──► 1. Pre-flight Validation (ValidationEngine.run with TeacherUpdateRules)
         │       ├── Existence Check (Critical short-circuit)
         │       ├── Strip Immutables (teacher_id, __tx_id, __tx_status, __created_at)
         │       ├── Mobile Uniqueness check (excluding own record)
         │       ├── Email Uniqueness check (excluding own record)
         │       └── Branch FK check
         │
         ├──► 2. Save Core Profile (db.Teacher.update)
         │
         ├──► 3. Synchronize Subjects Mapping (delete currently mapped, batch insert new)
         │
         └──► 4. Synchronize Compensation Rates (db.TeacherSalaryConfig.insert)
```

## 2. API Contract & Constraints

### Constraints
*   **`teacher_id`** (Payload Root): Required, String. Must exist in `Teacher` sheet.
*   **`data.mobile_number`**: Optional, String. Must be unique across all *other* teachers.
*   **`data.email`**: Optional, String. Must be unique across all *other* teachers.
*   **`data.branch_id`**: Optional, String. Must exist in `Branch` sheet.
*   **`data.prefered_time_slot`**: Optional, String. Allowed values: `Morning`, `Afternoon`, `Evening`.

### 3. Payload Reference

#### Success Flow Example (Request)
```json
{
  "action": "staff_update_teacher",
  "token": "DEV_SUPER_TOKEN_VALUE",
  "payload": {
    "teacher_id": "TCH-248AE945",
    "data": {
      "full_name": "Professor Moni API",
      "mobile_number": "9998887776",
      "email": "teacher_api_moni@example.com",
      "branch_id": "BRN-3GVP91T",
      "prefered_time_slot": "Morning",
      "subjects": [
        "CRS-87206D7D",
        "CRS-2DEB0E44"
      ],
      "salary_config": {
        "salary_type": "monthly",
        "base_amount": 75000
      }
    }
  }
}
```

#### Success Flow Example (Response)
```json
{
  "success": true,
  "action": "staffupdateteacher",
  "data": {
    "teacher_id": "TCH-248AE945",
    "full_name": "Professor Moni API",
    "mobile_number": "9998887776",
    "email": "teacher_api_moni@example.com",
    "branch_id": "BRN-3GVP91T",
    "prefered_time_slot": "Morning",
    "status": "active",
    "experience_years": 15,
    "joining_date": "2026-05-26"
  }
}
```

#### Validation Failure Example (Response)
```json
{
  "success": false,
  "action": "staffupdateteacher",
  "error": "Validation failed for teacher update.",
  "details": {
    "fields": [
      {
        "field": "mobile_number",
        "message": "Mobile number 9998887776 is already in use by another teacher."
      },
      {
        "field": "branch_id",
        "message": "Branch with ID BRN-INVALID does not exist."
      }
    ]
  }
}
```

## 4. Code Integrations & Implementation

### Running the Declarative Validation Engine
The service method extracts nested mappings, instantiates a `ValidationContext`, and runs the rule array. Relational maps are wiped from the payload before database updates to keep table schemas clean.

```javascript
// DazzlingDB/DBServices/StaffService.js -> updateTeacher
updateTeacher(payload) {
  const db = DBContext.getInstance();
  console.log(`[StaffService] Initiating validation for teacher update: ${payload.teacher_id}`);

  // Extract relational fields if present
  const subjects = payload.data ? payload.data.subjects : undefined;
  const salaryConfig = payload.data ? payload.data.salary_config : undefined;

  const ctx = new ValidationContext(db, payload.teacher_id, payload.data);
  ValidationEngine.run(ctx, TeacherUpdateRules);

  if (!ctx.isValid()) {
    throw new SheetDB.ValidationError("Validation failed for teacher update.", { fields: ctx.errors });
  }

  // Clean relations from payload so they don't merge into Teacher model fields
  delete ctx.payload.subjects;
  delete ctx.payload.salary_config;

  // 1. Update Core Profile
  const updatedTeacher = db.Teacher.update(ctx.entityId, ctx.payload);

  // 2. Synchronize Subjects (if provided)
  if (subjects !== undefined) {
    this.updateTeacherSubjects(db, ctx.entityId, subjects);
  }

  // 3. Synchronize Salary Configuration (if provided)
  if (salaryConfig) {
    this.setSalaryConfig({
      teacher_id: ctx.entityId,
      ...salaryConfig
    });
  }

  return updatedTeacher;
}
```

---

# Action Post: `staff_onboard_teacher` — Relational Onboarding & ACID-Simulation Rollbacks

Onboarding a new teacher is the entry point of the Staff lifecycle. Because we need to insert data across multiple sheets (Teachers, Users, Salaries, and Subjects) simultaneously, any failure mid-process risks leaving corrupt, orphaned records. Here is how DazzlingDB simulates database transactions using a stack-based **ACID Rollback Pattern**.

## 1. Request / Response Lifecycle

```
[Incoming POST Request]
         │
         ▼
[ApiDispatcher.js]  ──► Route registered action key `"staff_onboard_teacher"`
         │
         ▼
[ConcreteActions.js] ──► Parse payload, validate payload existence
         │
         ▼
[StaffService.js] ──► Orchestrate onboarding transaction:
         │
         ├──► 1. Pre-flight Validation (Rich multi-field uniqueness checks)
         │       ├── Mobile uniqueness check
         │       ├── Email uniqueness check
         │       └── Username account validation (User table check)
         │
         ├──► 2. core: Insert Teacher Profile (Staged in `insertedRecords` array)
         │
         ├──► 3. relation: Create Auth User Account (Staged in `insertedRecords` array)
         │
         ├──► 4. relation: Insert Compensation Rates (Staged in `insertedRecords` array)
         │
         ├──► 5. relation: Map Teaching Subjects (Staged in `insertedRecords` array)
         │
         └──► [Downstream Exception Raised?]
                 ├── YES: Perform rollback. Pop all items from `insertedRecords`
                 │        in reverse order and call `db[table].remove(id)`
                 └── NO: Complete transaction, clear array.
```

## 2. API Contract & Constraints

### Constraints
*   **`full_name`**: Required, String.
*   **`mobile_number`**: Required, String. Must be unique.
*   **`experience_years`**: Required, Number.
*   **`joining_date`**: Required, Date string (YYYY-MM-DD).
*   **`userData`**: Optional, Object. If provided, `userData.username` must be unique.
*   **`salary_config`**: Optional, Object. Needs `salary_type` and `base_amount`.

### 3. Payload Reference

#### Success Onboarding Request Payload
```json
{
  "action": "staff_onboard_teacher",
  "token": "DEV_SUPER_TOKEN_VALUE",
  "payload": {
    "full_name": "Professor Moni",
    "mobile_number": "9998887777",
    "email": "teacher_moni@example.com",
    "gender": "female",
    "date_of_birth": "1985-11-20",
    "experience_years": 12,
    "joining_date": "2026-05-26",
    "branch_id": "BRN-3GVP91T",
    "userData": {
      "username": "moni_teacher",
      "password": "hashed_master_password"
    },
    "salary_config": {
      "salary_type": "monthly",
      "base_amount": 75000
    },
    "subjects": [
      "CRS-87206D7D"
    ]
  }
}
```

## 4. Code Walkthrough: ACID-Simulation Rollbacks
```javascript
// E:\NAST\Dazzling\GAS\DazzlingDB\DBServices\StaffService.js -> onboardTeacher
onboardTeacher(payload) {
  const db = DBContext.getInstance();
  const insertedRecords = []; // Stack keeping track of all database insertions

  // [Pre-flight check blocks here]...

  try {
    // Stage 1: Insert Core Teacher
    const teacher = db.Teacher.insert({ ...teacherData });
    insertedRecords.push({ table: "Teacher", id: teacher.teacher_id });

    // Stage 2: Create User
    if (payload.userData) {
      const user = AuthBridge.registerUser({ ...payload.userData, user_id: teacher.teacher_id });
      insertedRecords.push({ table: "User", id: user.user_id });
    }

    // Stage 3: Compensation Rates
    if (payload.salary_config) {
      const sal = db.TeacherSalaryConfig.insert({ ...payload.salary_config, teacher_id: teacher.teacher_id });
      insertedRecords.push({ table: "TeacherSalaryConfig", id: sal.salary_config_id });
    }

    return teacher;
  } catch (e) {
    console.error("[StaffService] Onboarding failed! Executing transaction rollback...", e.message);
    
    // Pop in reverse order to undo insertions atomically
    for (let i = insertedRecords.length - 1; i >= 0; i--) {
      const record = insertedRecords[i];
      try {
        db[record.table].remove(record.id);
      } catch (rollbackErr) {
        console.error(`[Rollback Error] Failed to delete from ${record.table} ID: ${record.id}:`, rollbackErr.message);
      }
    }
    throw e;
  }
}
```
