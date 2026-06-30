# DazzlingDB API Documentation for Frontend Developers

This document details how to interact with the **DazzlingDB** backend via its Command-Action API.

---

## 1. General Protocol

- **Base URL:** `https://script.google.com/macros/s/[DEPLOYMENT_ID]/exec`
- **Method:** `POST` (Highly recommended for all operations)
- **Content-Type:** `application/json`
- **Response Format:** JSON Envelope

### Request Structure
Every request MUST include an `action` and a `payload`. For protected routes, a `token` is required.

```json
{
  "action": "action_key_here",
  "token": "your_auth_token",
  "payload": {
    "key": "value" // All parameters must be inside this object
  }
}
```

### Response Envelope
```json
{
  "success": true,
  "action": "actionname",
  "data": { ... },
  "error": { "type": "ErrorName", "message": "Details" } 
}
```

---

## 2. Authentication Flow

1. **Login:** Execute `user_login` with credentials.
2. **Token:** Store the `data.token` returned in your application (LocalStorage/Secure Cookie).
3. **Authorization:** Pass the `token` in the root of the JSON request body for all subsequent calls.

---

## 3. API Reference

### A. Authentication & Identity
| Action Key | Payload Requirements | Description |
| :--- | :--- | :--- |
| `user_login` | `{ "payload": { "username": "...", "password": "..." } }` | Returns a session `token`. |
| `user_register` | `{ "payload": { "username": "...", "password": "...", "role": "..." } }` | Creates a new system user. |
| `user_logout` | `{ "payload": { "token": "..." } }` | Invalidates the current session. |
| `auth_delete_many_users` | `{ "payload": { "ids": ["USR1", "USR2"], "dryRun": true/false } }` | **Bulk Delete Users:** Restricts deleting admin/self, cascade deletes sessions. |
| `auth_delete_many_sessions` | `{ "payload": { "ids": ["SES1", "SES2"], "dryRun": true/false } }` | **Bulk Delete Sessions:** Deletes user active session tokens. |

### B. Student Management
| Action Key | Payload Requirements | Description |
| :--- | :--- | :--- |
| `student_register` | `{ "payload": { "profile": {...}, "address": {...}, "contact": {...} } }` | **Relational Insert:** Creates student, address, and contact in one transaction. |
| `student_delete` | `{ "payload": { "student_id": "...", "dryRun": true/false } }` | **Delete Student:** Restricts if active financial history exists, cascades to addresses, contacts, and education records. |
| `student_delete_many_students` | `{ "payload": { "ids": ["STU1", "STU2"], "dryRun": true/false } }` | **Bulk Delete Students:** Restricts if active enrollments/fees exist, cascades to addresses/contacts/education. |

### C. Academic & Curriculum
| Action Key | Payload Requirements | Description |
| :--- | :--- | :--- |
| `academic_create_course_type` | `{ "payload": { "segment_name": "..." } }` | Create segments like "Academic" or "Vocational". |
| `academic_create_course` | `{ "payload": { "segment_id": "...", "name": "...", "base_fee": 0 } }` | Create a specific subject/course. |
| `academic_create_batch` | `{ "payload": { "course_id": "...", "batch_name": "...", "capacity": 30 } }` | Create a batch for a course. |
| `academic_create_package` | `{ "payload": { "name": "...", "package_fee": 1000, ... } }` | Bulk package creation with perks/courses. |
| `academic_update_package` | `{ "payload": { "package_id": "...", ... } }` | Transactional update of package details, perks, and courses. |
| `academic_delete_package` | `{ "payload": { "package_id": "..." } }` | Deletes a package with RESTRICT validation and CASCADE cleanup. |
| `academic_enroll_student` | `{ "payload": { "student_id": "...", "item_id": "...", "batch_id": "..." } }` | Enrolls a student in a batch. |
| `academic_delete_many_enrollments` | `{ "payload": { "ids": ["ENR1", "ENR2"], "dryRun": true/false } }` | **Bulk Delete Enrollments:** Restricts if fee accounts have payments, cascades to batch allocations/fees/installments. |
| `academic_delete_many_packages` | `{ "payload": { "ids": ["PKG1", "PKG2"], "dryRun": true/false } }` | **Bulk Delete Packages:** Restricts if student enrollment exists, cascades to perks/items. |

### D. Staff & HR
| Action Key | Payload Requirements | Description |
| :--- | :--- | :--- |
| `staff_onboard_teacher` | `{ "payload": { "full_name": "...", "mobile_number": "..." } }` | Register teacher profile. |
| `staff_update_teacher` | `{ "payload": { "teacher_id": "...", "data": { "full_name": "..." } } }` | Updates an existing teacher profile with validation checks. |
| `staff_assign_subjects` | `{ "payload": { "teacher_id": "...", "subject_ids": ["ID1", "ID2"] } }` | Link teacher to courses. |
| `staff_mark_attendance` | `{ "payload": { "teacher_id": "...", "status": "present", "attendance_date": "YYYY-MM-DD" } }` | Record attendance. |
| `staff_record_payment` | `{ "payload": { "teacher_id": "...", "amount": 5000, "payment_type": "salary" } }` | Log financial transactions for staff. |
| `staff_set_salary_config` | `{ "payload": { "teacher_id": "...", "salary_config_type": "recurring_monthly", "rate_type": "monthly", "base_value": 20000, "scope_type": "global", "effective_from": "YYYY-MM-DD" } }` | Define payroll rules. |
| `staff_get_salary_configs` | `{ "payload": { "teacher_id": "..." } }` | Retrieve all salary configs for a teacher. |
| `staff_get_salary_config` | `{ "payload": { "teacher_id": "...", "salary_config_id": "..." } }` | Retrieve a specific salary config for a teacher. |
| `staff_update_salary_config` | `{ "payload": { "teacher_id": "...", "salary_config_id": "...", "data": { ... } } }` | Update a teacher's salary config block. |
| `staff_delete_salary_config` | `{ "payload": { "teacher_id": "...", "salary_config_id": "..." } }` | Delete a teacher's salary config block. |
| `staff_add_document` | `{ "payload": { "teacher_id": "...", "document": {...} } }` | Attach file links to staff. |
| `staff_delete_many_teachers` | `{ "payload": { "ids": ["TCH1", "TCH2"], "dryRun": true/false } }` | **Bulk Delete Teachers:** Restricts if assigned to active batches or payroll transactions exist, cascades to subjects/docs/salary configs. |
| **Generic CRUD (StaffMember)** | Use generic actions (`data_create`, `data_query`, etc.) with `"table": "StaffMember"`. | Management of non-faculty staff members (admin, receptionist, security, support, etc.). |

### E. Finance Management
| Action Key | Payload Requirements | Description |
| :--- | :--- | :--- |
| `finance_delete_many_fee_accounts` | `{ "payload": { "ids": ["SFA1", "SFA2"], "dryRun": true/false } }` | **Bulk Delete Fee Accounts:** Restricts if payments exist (`amount_paid > 0`), cascades to installments/adjustments. |
| `finance_delete_many_installments` | `{ "payload": { "ids": ["INS1", "INS2"], "dryRun": true/false } }` | **Bulk Delete Installments:** Restricts if paid/partially paid, cascades recalculation of parent fee account balances. |
| `finance_delete_many_payments` | `{ "payload": { "ids": ["PAY1", "PAY2"], "dryRun": true/false } }` | **Bulk Delete Payments:** Reverts paid amounts from installment status/balances and parent fee account balances. |
| `finance_delete_many_adjustments` | `{ "payload": { "ids": ["ADJ1", "ADJ2"], "dryRun": true/false } }` | **Bulk Delete Adjustments:** Reverts adjustment amounts and parent fee account balances. |
| **Generic CRUD (ExpenseCategory)** | Use generic actions (`data_create`, `data_query`, etc.) with `"table": "ExpenseCategory"`. | Configuration of accounting categories (incoming/outgoing ledger classifications). |
| **Generic CRUD (MoneyTransaction)** | Use generic actions (`data_create`, `data_query`, etc.) with `"table": "MoneyTransaction"`. | General ledger logging. Supports polymorphic party links to Student, Teacher, or StaffMember. |

---

## 4. React Integration Example

```javascript
const API_URL = "https://script.google.com/macros/s/[ID]/exec";

/**
 * Standard API Caller
 * @param {string} action - The action key (e.g. 'user_login')
 * @param {Object} data - The parameters to be placed inside 'payload'
 * @param {string} token - The auth token (if available)
 */
async function callDazzlingApi(action, data = {}, token = null) {
  const response = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action,
      token,
      payload: data // Encapsulates all data inside payload
    }),
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error.message);
  }
  return result.data;
}

// Example Usage:
const login = async () => {
  const data = await callDazzlingApi("user_login", { 
    username: "admin", 
    password: "123" 
  });
  console.log("Logged in:", data.token);
};
```

---

## 5. Admin Operations (Restricted)
*Requires `admin` role.*

| Action Key | Payload Requirements | Description |
| :--- | :--- | :--- |
| `admin_get_schema` | N/A | Returns the JSON schema. |
| `admin_analyze_table` | N/A | Checks for structural issues. |
| `admin_repair_table` | N/A | Rebuilds missing sheets or columns. |
| `admin_peek_data` | `{ "payload": { "table": "Student" } }` | Returns last 5 rows of a table. |
| `admin_bootstrap` | `{ "payload": { "setupKey": "...", "userData": {...} } }` | One-time system setup. |

---

## 6. Important Notes
1. **Redirection:** Google Apps Script uses `302` redirects. `fetch` handles this automatically.
2. **IDs:** Create actions return objects with generated IDs (e.g., `STU-123X`).
3. **Strict Nesting:** The API will reject requests where parameters (like `username`) are at the root. Always use the `payload` object.

---

## 7. Batch REST API (CRUD Reference)

The `Batch` table stores academic/course batch instances. Because it is in the `GLOBAL_CRUD_WHITELIST`, it can be manipulated using generic data actions (`data_create`, `data_query`, `data_update`, `data_delete`, `data_delete_many`) as well as the specialized endpoint `academic_create_batch` for creation.

### Batch Schema Reference

| Field Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `batch_id` | `string` | Read-only, Primary Key | Auto-generated ID with prefix `BAT-` (e.g., `BAT-AF010AEC`). |
| `batch_name` | `string` | **Required**, max 255 chars | The name/label of the batch. |
| `course_id` | `string` | **Required** (validated) | Foreign key pointing to a valid `Course.course_id`. |
| `branch_id` | `string` | Optional (validated if provided) | Foreign key pointing to a valid `Branch.branch_id`. |
| `teacher_id` | `string` | Optional (validated if provided) | Foreign key pointing to a valid `Teacher.teacher_id`. |
| `batch_type` | `string` | **Required**, enum | Choices: `Academy`, `Computer`, `Foundation`, `Competitive`. |
| `status` | `string` | Enum, default: `active` | Choices: `active`, `completed`, `cancelled`. |
| `capacity` | `number` | Default: `30` | Maximum student enrollment capacity. |
| `start_date` | `string` | Date (`YYYY-MM-DD`) | Batch start date. |
| `end_date` | `string` | Date (`YYYY-MM-DD`) | Batch end/expiry date. |
| `schedule` | `object` | JSON structure | Defines custom scheduling parameters (days, times, room). |

---

### A. Create Batch (2 Alternatives)

#### 1. Specialized Endpoint: `academic_create_batch`
This endpoint creates a new batch configuration after executing domain validations (checking that `course_id`, `branch_id`, and `teacher_id` exist and are active).

**Key Points:**
* **Referential Validation:** Strongly recommended for frontend forms, as it actively guards against orphaned relationship errors.
* **Auto-Defaulting:** Automatically defaults `status` to `"active"` and `capacity` to `30` if they are omitted.

**Request Body:**
```json
{
  "action": "academic_create_batch",
  "token": "YOUR_AUTH_TOKEN",
  "payload": {
    "batch_name": "Math 10th - Elite",
    "branch_id": "BRN-3GVP91T",
    "course_id": "CRS-D40D4661",
    "teacher_id": "TCH-248AE945",
    "batch_type": "Academy",
    "status": "active",
    "capacity": 30,
    "start_date": "2026-05-01",
    "end_date": "2026-05-31",
    "schedule": {
      "days_of_week": ["Mon", "Wed", "Fri"],
      "start_time": "09:00",
      "end_time": "11:00",
      "room": "Room 102"
    }
  }
}
```

**Response Body (Success):**
```json
{
  "success": true,
  "action": "academic_create_batch",
  "data": {
    "batch_name": "Math 10th - Elite",
    "branch_id": "BRN-3GVP91T",
    "course_id": "CRS-D40D4661",
    "teacher_id": "TCH-248AE945",
    "batch_type": "Academy",
    "status": "active",
    "capacity": 30,
    "start_date": "2026-05-01",
    "end_date": "2026-05-31",
    "schedule": {
      "days_of_week": ["Mon", "Wed", "Fri"],
      "start_time": "09:00",
      "end_time": "11:00",
      "room": "Room 102"
    },
    "batch_id": "BAT-E20D1E4B",
    "__tx_id": "TX-12345678",
    "__tx_status": "COMMITTED",
    "__created_at": "2026-05-23T15:00:00.000Z"
  }
}
```

#### 2. Generic Endpoint: `data_create`
This endpoint bypasses custom domain checks and inserts a record directly into the `Batch` database table.

**Key Points:**
* **Bypasses Hooks:** Useful for migrations, seed data, or testing where strict relational check constraints are not required.
* **Schema Enforcement:** Still enforces basic column restrictions (types, required fields, and enum choices).

**Request Body:**
```json
{
  "action": "data_create",
  "token": "YOUR_AUTH_TOKEN",
  "payload": {
    "table": "Batch",
    "data": {
      "batch_name": "Math 10th - Elite",
      "branch_id": "BRN-3GVP91T",
      "course_id": "CRS-D40D4661",
      "teacher_id": "TCH-248AE945",
      "batch_type": "Academy",
      "status": "active",
      "capacity": 30,
      "start_date": "2026-05-01",
      "end_date": "2026-05-31",
      "schedule": {
        "days_of_week": ["Mon", "Wed", "Fri"],
        "start_time": "09:00",
        "end_time": "11:00",
        "room": "Room 102"
      }
    }
  }
}
```

**Response Body (Success):**
```json
{
  "success": true,
  "action": "data_create",
  "data": {
    "message": "Successfully created record in table 'Batch' with ID 'BAT-E20D1E4B'.",
    "id": "BAT-E20D1E4B",
    "record": {
      "batch_name": "Math 10th - Elite",
      "branch_id": "BRN-3GVP91T",
      "course_id": "CRS-D40D4661",
      "teacher_id": "TCH-248AE945",
      "batch_type": "Academy",
      "status": "active",
      "capacity": 30,
      "start_date": "2026-05-01",
      "end_date": "2026-05-31",
      "schedule": {
        "days_of_week": ["Mon", "Wed", "Fri"],
        "start_time": "09:00",
        "end_time": "11:00",
        "room": "Room 102"
      },
      "batch_id": "BAT-E20D1E4B",
      "__tx_id": "TX-12345678",
      "__tx_status": "COMMITTED",
      "__created_at": "2026-05-23T15:00:00.000Z"
    }
  }
}
```

---

### B. Read / Query Batch (`data_query`)

This endpoint searches for and retrieves batch records from the database that match specified filter criteria.

**Key Points:**
* **Flexible Filters:** Query by any combination of fields (e.g. `batch_id`, `branch_id`, `status`).
* **Pagination Support:** Supports passing limit and offset parameters to paginate large lists of batches.

**Request Body:**
```json
{
  "action": "data_query",
  "token": "YOUR_AUTH_TOKEN",
  "payload": {
    "target": "Batch",
    "where": {
      "batch_id": "BAT-E20D1E4B"
    }
  }
}
```

**Response Body (Success):**
```json
{
  "success": true,
  "action": "data_query",
  "data": {
    "data": [
      {
        "batch_name": "Math 10th - Elite",
        "branch_id": "BRN-3GVP91T",
        "course_id": "CRS-D40D4661",
        "teacher_id": "TCH-248AE945",
        "batch_type": "Academy",
        "status": "active",
        "capacity": 30,
        "start_date": "2026-05-01",
        "end_date": "2026-05-31",
        "schedule": {
          "days_of_week": ["Mon", "Wed", "Fri"],
          "start_time": "09:00",
          "end_time": "11:00",
          "room": "Room 102"
        },
        "batch_id": "BAT-E20D1E4B",
        "__tx_id": "TX-12345678",
        "__tx_status": "COMMITTED",
        "__created_at": "2026-05-23T15:00:00.000Z"
      }
    ],
    "meta": {
      "total": 1,
      "limit": 1000,
      "offset": 0
    }
  }
}
```

---

### C. Update Batch (`data_update`)

This endpoint updates existing columns in a specific batch record. It merges the modifications provided in the `data` block with the existing database record.

> [!WARNING]
> **Important Update Rule:** Do not pass the `where` parameter inside `payload`. The update API endpoint (`data_update`) expects the record's primary identifier directly in **`payload.id`**, and the values to update inside **`payload.data`**.
>
> Passing `"where": { "batch_id": "..." }` will result in a validation error: `"Payload must contain 'id' parameter."`

**Key Points:**
* **Identifier Required:** You must provide `payload.id` containing the exact batch ID string (e.g., `BAT-E20D1E4B`).
* **Differential Updates:** Only specify the fields you want to update inside `data`; other columns remain untouched.

**Request Body (Correct Format):**
```json
{
  "action": "data_update",
  "token": "YOUR_AUTH_TOKEN",
  "payload": {
    "table": "Batch",
    "id": "BAT-E20D1E4B",
    "data": {
      "batch_name": "Batch Alpha - 2026",
      "branch_id": "BR-001",
      "course_id": "CRS-066FFEEF",
      "teacher_id": "TCH-1B9EA640",
      "batch_type": "Academy",
      "status": "active",
      "capacity": 30,
      "start_date": "2026-05-02",
      "end_date": "2026-05-31",
      "schedule": {
        "days_of_week": ["Mon", "Tue", "Wed", "Thu", "Sat", "Fri"],
        "start_time": null,
        "end_time": null,
        "room": "TBD"
      }
    }
  }
}
```

**Response Body (Success):**
```json
{
  "success": true,
  "action": "data_update",
  "data": {
    "message": "Successfully updated record in table 'Batch' with ID 'BAT-E20D1E4B'.",
    "id": "BAT-E20D1E4B",
    "record": {
      "batch_name": "Batch Alpha - 2026",
      "branch_id": "BR-001",
      "course_id": "CRS-066FFEEF",
      "teacher_id": "TCH-1B9EA640",
      "batch_type": "Academy",
      "status": "active",
      "capacity": 30,
      "start_date": "2026-05-02",
      "end_date": "2026-05-31",
      "schedule": {
        "days_of_week": ["Mon", "Tue", "Wed", "Thu", "Sat", "Fri"],
        "start_time": null,
        "end_time": null,
        "room": "TBD"
      },
      "batch_id": "BAT-E20D1E4B",
      "__tx_id": "TX-12345678",
      "__tx_status": "COMMITTED",
      "__created_at": "2026-05-23T15:00:00.000Z"
    }
  }
}
```

---

### D. Delete Batch (`data_delete`)

This endpoint permanently deletes a batch record from the database using its primary ID.

**Key Points:**
* **Direct Removal:** Removes the physical row matching the specified ID from the underlying database sheet.
* **No Cascade:** Does not automatically delete child records (such as Enrollments); ensure dependent records are cleaned up first.

**Request Body:**
```json
{
  "action": "data_delete",
  "token": "YOUR_AUTH_TOKEN",
  "payload": {
    "table": "Batch",
    "id": "BAT-E20D1E4B"
  }
}
```

**Response Body (Success):**
```json
{
  "success": true,
  "action": "data_delete",
  "data": {
    "message": "Successfully deleted record in table 'Batch' with ID 'BAT-E20D1E4B'.",
    "id": "BAT-E20D1E4B"
  }
}
```

---

### E. Batch Delete Records (`data_delete_many`)

This endpoint deletes multiple records in a single high-performance operation with integrated dependency resolution and dry-run safety.

> [!IMPORTANT]
> **Safeguard Whitelist Restriction:**
> `data_delete_many` is a generic data API action and **only** operates on tables listed in the `GLOBAL_CRUD_WHITELIST` (e.g. `Branch`, `PromoCode`, `Course`, `Batch`, `BatchAllocation`, etc.).
> 
> Attempting to use `data_delete_many` on non-generic tables (such as `User`, `Student`, `Enrollment`, `Installment`, etc.) will fail with a `ValidationError`: `"Table '[table]' is not eligible for generic CRUD operations. Please use specialized endpoints."`
>
> For bulk deletes of non-generic tables, you MUST call their specialized bulk delete endpoints:
> *   **`User`**: Use `auth_delete_many_users`
> *   **`Session`**: Use `auth_delete_many_sessions`
> *   **`Enrollment`**: Use `academic_delete_many_enrollments`
> *   **`Package`**: Use `academic_delete_many_packages`
> *   **`Student`**: Use `student_delete_many_students`
> *   **`StudentFeeAccount`**: Use `finance_delete_many_fee_accounts`
> *   **`Installment`**: Use `finance_delete_many_installments`
> *   **`Payment`**: Use `finance_delete_many_payments`
> *   **`FeeAdjustment`**: Use `finance_delete_many_adjustments`
> *   **`Teacher`**: Use `staff_delete_many_teachers`

**Key Points:**
* **Safety Dry-Run:** By default, `dryRun` is `true`. The API checks referential constraints and reports exactly what would be deleted without executing the changes. Set `"dryRun": false` to perform physical deletes.
* **RESTRICT Dependency Checks:** Automatically scans for references to the target records in downstream tables. If a referencing child record exists, the deletion for that specific ID is blocked.
* **Batch Limits:** The number of IDs is capped (defaults to a maximum batch size of 200).
* **Detailed Manifest:** Returns a manifest detailing which IDs were successfully deleted, skipped (non-existent), or failed (blocked by constraints with reasons).

**Request Body:**
```json
{
  "action": "data_delete_many",
  "token": "YOUR_AUTH_TOKEN",
  "payload": {
    "table": "Batch",
    "ids": ["BAT-E20D1E4B", "BAT-NONEXISTENT", "BAT-BLOCKED"],
    "dryRun": false
  }
}
```

**Response Body (Success):**
```json
{
  "success": true,
  "action": "data_delete_many",
  "data": {
    "success": true,
    "dryRun": false,
    "deletedCount": 1,
    "manifest": {
      "deleted": ["BAT-E20D1E4B"],
      "skipped": ["BAT-NONEXISTENT"],
      "failed": {
        "BAT-BLOCKED": "Blocked: Active reference found in dependent table 'BatchAllocation' (column 'batch_id')."
      }
    }
  }
}
```

---

## 8. Package REST API (CRUD Reference)

The `Package` table stores bundled offerings of courses/subjects and their associated student perks. These operations are managed via specialized, transaction-safe endpoints that support automated cascades and rollback features.

### Package Schema Reference

| Field Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `package_id` | `string` | Read-only, Primary Key | Auto-generated ID with prefix `PKG-` (e.g., `PKG-F93C08AE`). |
| `name` | `string` | **Required**, max 255 chars | The name/label of the package. |
| `description` | `string` | Optional, max 255 chars | Detailed description of the package. |
| `target_class` | `string` | Optional, max 255 chars | The academic grade/class targeted. |
| `board` | `string` | Optional, max 255 chars | Academic board (e.g., CBSE, ICSE, State). |
| `month` | `number` | Optional | Duration of the package in months. |
| `package_fee` | `number` | **Required** | The base fee for the package. |
| `discount_percent` | `number` | Optional | The discount percentage applicable to the package fee. |
| `status` | `string` | Enum, default: `active` | Choices: `active`, `inactive`, `draft`. |

---

### A. Create Package (`academic_create_package`)

This endpoint inserts a new package, along with associated perks (`PackagePerk`) and items (`PackageItem`), in a single transaction.

**Key Points:**
* **Cascading Insert:** Child elements are automatically created and linked to the new package.
* **Polymorphic Normalization:** Course entities automatically trim and normalize `entity_type` (e.g. `"Course "` and `" subject"` normalize to `"course"` and `"subject"`).
* **Rollback Safety:** If any course/perk insertion fails, the entire transaction is rolled back, removing all partially created records.

**Request Body:**
```json
{
  "action": "academic_create_package",
  "token": "YOUR_AUTH_TOKEN",
  "payload": {
    "name": "Class 10 Science Combo",
    "description": "Includes Physics, Chemistry & Biology with perks",
    "target_class": "10th",
    "board": "CBSE",
    "month": 12,
    "package_fee": 15000,
    "discount_percent": 10,
    "status": "active",
    "courses": [
      { "entity_type": "Course", "entity_id": "CRS-D40D4661" },
      { "entity_type": "Subject", "entity_id": "CRS-9A8D7C" }
    ],
    "perks": [
      { "perk_title": "Monthly Mock Tests", "perk_description": "Online MCQ tests", "icon": "check-square" },
      { "perk_title": "Doubt Sessions", "perk_description": "Weekly 1-on-1 calls", "icon": "help-circle", "display_order": 2 }
    ]
  }
}
```

**Response Body (Success):**
```json
{
  "success": true,
  "action": "academic_create_package",
  "data": {
    "name": "Class 10 Science Combo",
    "description": "Includes Physics, Chemistry & Biology with perks",
    "target_class": "10th",
    "board": "CBSE",
    "month": 12,
    "package_fee": 15000,
    "discount_percent": 10,
    "status": "active",
    "package_id": "PKG-D2C6F12A",
    "__tx_id": "TX-98765432",
    "__tx_status": "COMMITTED"
  }
}
```

#### Quick Package (On-Demand Course Creation & Perks Presets)

This endpoint supports a **Quick Package** flow. Instead of pre-creating courses and manually listing perks, you can dynamically create courses on the fly and let the system automatically resolve default perks based on the target class.

**Key Features:**
1. **On-Demand Course Creation:** Inside the `courses` array, set `"on_demand": true` on a course object. The system will dynamically insert a new course under the resolved segment.
   * **Segment Resolution:** Provide `segment_id` or `segment_name`. If neither is supplied, the system automatically falls back to the first active `CourseType` in the database. If no active `CourseType` is found, the request fails.
   * **Uniqueness Safeguard:** If a provided `short_code` already exists, a database constraint error is raised.
   * **Atomic Rollback:** If any error occurs downstream (such as a validation error on package items), any on-demand courses created during the request are automatically rolled back (physically deleted).
2. **Auto Perks Presets:** If you omit `perks` or pass an empty array, the system auto-populates perks based on the `target_class` parameter (case-insensitive):
   * **Senior Perks** (if `target_class` contains `"11"`, `"12"`, or `"senior"`):
     * "Free Basic Computer Course with new admission"
     * "Daily Practice Papers (DPP)"
     * "Regular Assignments and Study Materials"
     * "Monthly Parent-Teacher Meetings"
     * "Dedicated Student Monitoring Mobile Application"
     * "Note: Package Excludes Hindi & English"
   * **Standard Perks** (for all other classes):
     * "Daily Practice Papers (DPP)"
     * "Regular Assignments and Study Materials"
     * "Monthly Parent-Teacher Meetings"
     * "Online & Offline learning resources"
     * "Dedicated Student Monitoring Mobile Application"

**Request Body (Quick Package with On-Demand Course & Perks Preset):**
```json
{
  "action": "academic_create_package",
  "token": "YOUR_AUTH_TOKEN",
  "payload": {
    "name": "Class 10 Advanced Combo",
    "description": "Dynamic quick package with on-demand course",
    "target_class": "Class 10",
    "package_fee": 12000,
    "status": "active",
    "courses": [
      { "entity_type": "course", "entity_id": "CRS-D40D4661" },
      {
        "entity_type": "course",
        "on_demand": true,
        "name": "On-Demand Mathematics",
        "short_code": "CRS-MATH-10",
        "language_medium": "English",
        "duration_value": 10,
        "duration_unit": "months",
        "base_fee": 6000,
        "segment_name": "Academic",
        "status": "active"
      }
    ]
  }
}
```

**Response Body (Success):**
```json
{
  "success": true,
  "action": "academic_create_package",
  "data": {
    "name": "Class 10 Advanced Combo",
    "description": "Dynamic quick package with on-demand course",
    "target_class": "Class 10",
    "package_fee": 12000,
    "status": "active",
    "package_id": "PKG-FE0F7C74",
    "__tx_id": "TX-12345678",
    "__tx_status": "COMMITTED"
  }
}
```

#### Structured API Error Codes

If the creation fails, the returned `error` object includes a specific `errorCode` alongside the generic error type and message:

*   **`DUPLICATE_SHORT_CODE`**: Occurs if the `short_code` supplied for an on-demand course already exists.
*   **`REFERENCED_COURSE_NOT_FOUND`**: Occurs if `entity_id` is missing (without `"on_demand": true`) or if the referenced `entity_id` does not exist.
*   **`INVALID_ENTITY_TYPE`**: Occurs if `entity_type` is not one of `"course"` or `"subject"`.
*   **`SEGMENT_RESOLUTION_FAILED` / `SEGMENT_NOT_FOUND`**: Occurs if the `segment_id` or `segment_name` does not resolve to a valid active course segment.

**Response Body (Error - Duplicate Course Short Code):**
```json
{
  "success": false,
  "action": "academic_create_package",
  "error": {
    "type": "ConflictError",
    "message": "Failed to save Course: Unique constraint violation on column 'short_code' (value 'CRS-MATH-10' already exists).",
    "errorCode": "DUPLICATE_SHORT_CODE"
  }
}
```

---

### B. Update Package (`academic_update_package`)

This endpoint updates core package columns and synchronizes the list of courses/subjects and perks by rewriting and validating relationships.

**Key Points:**
* **Full Sync:** Submitting new `courses` or `perks` arrays replaces existing items and perks for the package.
* **Transaction Rollback:** Powered by `TransactionTracker`, if any step fails (e.g., duplicate key or validation error), the database state is rolled back. Sub-records are restored using the sheet's raw gateway to preserve their original identifiers.

**Request Body:**
```json
{
  "action": "academic_update_package",
  "token": "YOUR_AUTH_TOKEN",
  "payload": {
    "package_id": "PKG-D2C6F12A",
    "name": "Class 10 Science Combo - Premium",
    "package_fee": 18000,
    "courses": [
      { "entity_type": "course", "entity_id": "CRS-D40D4661" }
    ],
    "perks": [
      { "perk_title": "Weekly Mock Tests", "perk_description": "Rigorous prep", "icon": "star" }
    ]
  }
}
```

**Response Body (Success):**
```json
{
  "success": true,
  "action": "academic_update_package",
  "data": {
    "success": true,
    "message": "Package 'PKG-D2C6F12A' successfully updated."
  }
}
```

---

### C. Delete Package (`academic_delete_package`)

This endpoint permanently deletes a package along with all child records.

**Key Points:**
* **RESTRICT Check:** Deletion is blocked and throws a validation error if any student `Enrollment` record exists referencing the package (`enrollment_type === 'package'` and `item_id === packageId`).
* **CASCADE Delete:** Automatically deletes all associated `PackagePerk` and `PackageItem` records.
* **Transactional Rollback:** Uses `TransactionTracker` to store deleted records. If the deletion of the core package or any child record fails, all deleted parent and child records are restored to the sheet with their original primary keys.

**Request Body:**
```json
{
  "action": "academic_delete_package",
  "token": "YOUR_AUTH_TOKEN",
  "payload": {
    "package_id": "PKG-D2C6F12A"
  }
}
```

**Response Body (Success):**
```json
{
  "success": true,
  "action": "academic_delete_package",
  "data": {
    "success": true,
    "message": "Package 'PKG-D2C6F12A' successfully deleted."
  }
}
```

---

## 9. Standard Request and Response Payload Architecture

All communications with the DazzlingDB API MUST conform to a strict structural contract. This section describes the layout of the full HTTP body for requests and responses.

### A. API Request Full Body Structure

Every request sent to the API must be a single JSON object containing three top-level keys:

```json
{
  "action": "action_key",
  "token": "session_token_string",
  "payload": {
    "param1": "value1"
  }
}
```

#### Request Fields Contract:

1. **`action`** *(String, Required)*: 
   The specific endpoint registry key identifier (e.g., `user_login`, `data_query`, `data_delete`). This determines which backend action controller resolves and executes the request.
2. **`token`** *(String, Optional/Required)*: 
   The session token string retrieved during login. Required for all protected actions. If provided, the dispatcher automatically resolves user credentials and verifies RBAC table access permissions.
3. **`payload`** *(Object, Required)*: 
   The parameters container. **All input variables and arguments must live inside this object.** Placing fields outside of `payload` (at the root) will result in a `ValidationError` or parse failure.

---

### B. Expected Response Envelope Structure

The API always returns a standard JSON envelope with a consistent root-level format, indicating either a successful operation or a structured failure.

#### 1. Success Response Structure

When the action completes successfully, `success` is set to `true`, and the execution output is returned inside `data`.

```json
{
  "success": true,
  "action": "action_key",
  "data": {
    "message": "Operation completed successfully.",
    "id": "BAT-E20D1E4B",
    "record": { ... }
  }
}
```

*   **`success`** *(Boolean)*: Always `true`.
*   **`action`** *(String)*: Echoes the action key that was requested and executed.
*   **`data`** *(Object|Array)*: Contains the return values (e.g., database records, pagination metadata, session token, or status message).

#### 2. Error Response Structure

If validation fails, unauthorized access is detected, or a database rule is violated, the API sets `success` to `false` and populates the `error` object.

```json
{
  "success": false,
  "action": "action_key",
  "error": {
    "type": "ActionValidationError",
    "message": "Payload must contain 'id' parameter."
  }
}
```

*   **`success`** *(Boolean)*: Always `false`.
*   **`action`** *(String)*: Echoes the requested action key.
*   **`error`** *(Object)*: Encloses the error details:
    *   **`type`** *(String)*: The system error class name (e.g., `ActionValidationError`, `ActionAuthorizationError`, `ValidationError`, `EntityNotFoundError`, `ForbiddenError`).
    *   **`message`** *(String)*: A descriptive, human-readable reason for the failure.

---

## 10. Student Deletion REST API (`student_delete`)

This endpoint permanently deletes a student record from the database using its primary ID.

### Key Points
* **RESTRICT Check (Protect):** Deletion is blocked and throws an `ActionValidationError` if the student has active financial ledger records (payments, installments) or active batch allocations.
* **CASCADE Delete:** Automatically deletes associated `Address`, `ContactInfo`, and `Education` records recursively.
* **dryRun Parameter:** Supports a safety checks mode. Set `"dryRun": true` (or omit `"dryRun"`) to run constraint checks in memory without executing physical deletes. Set `"dryRun": false` to perform physical deletes.

### Request Payload Attributes

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `student_id` | `string` | **Yes** | The unique identifier of the target student to be deleted (e.g., `STU-C3NEA67`). |
| `dryRun` | `boolean` | No | If `true` (default), checks constraints and returns validation status without modifying data. Set to `false` for physical deletion. |

### Request Body (Dry-Run / Physical Delete)
```json
{
  "action": "student_delete",
  "token": "YOUR_AUTH_TOKEN",
  "payload": {
    "student_id": "STU-C3NEA67",
    "dryRun": false
  }
}
```

### Success Response Body
When the student has no active financial history and deletion succeeds:
```json
{
  "success": true,
  "action": "student_delete",
  "data": {
    "success": true,
    "message": "Successfully deleted Student 'STU-C3NEA67'.",
    "student_id": "STU-C3NEA67"
  }
}
```

### Error Response Body (Blocked Deletion)
When deletion is blocked due to active financial ledger records (e.g., installments exist on the student fee account):
```json
{
  "success": false,
  "action": "student_delete",
  "error": {
    "type": "ActionValidationError",
    "message": "Delete Protected: Cannot delete from 'StudentFeeAccount' because active records in 'Installment' refer to it (FK: 'student_fee_id')."
  }
}
```

---

## 11. Expense Category REST API (Generic CRUD Reference)

The `ExpenseCategory` table stores accounting category classifications (e.g., rent, payroll, utilities). It is in the `GLOBAL_CRUD_WHITELIST` and supports standard generic data actions (`data_create`, `data_query`, `data_update`, `data_delete`, `data_delete_many`).

### Expense Category Schema Reference

| Field Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `category_id` | `string` | Read-only, Primary Key | Auto-generated ID prefixed with `EXC-` (e.g., `EXC-2B632258`). |
| `name` | `string` | **Required**, unique, max 255 chars | Display name of the category (e.g., "Office Utilities"). |
| `type` | `string` | Enum, default: `both` | Choices: `in` (revenue only), `out` (expenses only), `both` (any). |
| `description` | `string` | Optional, max 255 chars | Details outlining the scope of this category. |

### Relationships and Deletion Policy
* **`moneytransactions` (hasMany)**: Referencing the `MoneyTransaction` table's `category_id` column.
* **Deletion Protection (`onDelete: "protect"`)**: Deleting an `ExpenseCategory` row will fail with an `IntegrityError` if any `MoneyTransaction` records are actively referencing it.

### A. Create Expense Category (`data_create`)

**Request Body:**
```json
{
  "action": "data_create",
  "token": "YOUR_AUTH_TOKEN",
  "payload": {
    "table": "ExpenseCategory",
    "data": {
      "name": "Office Utilities",
      "type": "both",
      "description": "Water, electricity, internet bills"
    }
  }
}
```

**Response Body (Success):**
```json
{
  "success": true,
  "action": "data_create",
  "data": {
    "message": "Successfully created record in table 'ExpenseCategory' with ID 'EXC-2B632258'.",
    "id": "EXC-2B632258",
    "record": {
      "category_id": "EXC-2B632258",
      "name": "Office Utilities",
      "type": "both",
      "description": "Water, electricity, internet bills"
    }
  }
}
```

---

## 12. Staff Member REST API (Generic CRUD Reference)

The `StaffMember` table stores profiles of non-faculty organizational staff members. It is in the `GLOBAL_CRUD_WHITELIST` and supports generic actions (`data_create`, `data_query`, `data_update`, `data_delete`, `data_delete_many`).

### Staff Member Schema Reference

| Field Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `staff_id` | `string` | Read-only, Primary Key | Auto-generated ID prefixed with `STF-` (e.g., `STF-F6F68672`). |
| `name` | `string` | **Required**, max 255 chars | The full legal name of the staff member. |
| `role` | `string` | Enum, default: `other` | Choices: `admin`, `receptionist`, `support`, `security`, `cleaner`, `other`. |
| `status` | `string` | Enum, default: `active` | Choices: `active`, `inactive`. Inactive staff cannot be selected for new payouts. |
| `phone` | `string` | Optional, max 50 chars | Contact telephone number. |
| `email` | `string` | Optional, max 255 chars | Official email address. |

### Relationships and Deletion Policy
* **`moneytransactions` (hasMany)**: Referencing the polymorphic target `party_id` in `MoneyTransaction`.
* **Non-Blocking Deletion (`onDelete: "do_nothing"`)**: Deleting a `StaffMember` will succeed and leave any associated child `MoneyTransaction` records intact.

### A. Create Staff Member (`data_create`)

**Request Body:**
```json
{
  "action": "data_create",
  "token": "YOUR_AUTH_TOKEN",
  "payload": {
    "table": "StaffMember",
    "data": {
      "name": "Security Guard",
      "role": "security",
      "status": "active",
      "phone": "+91-9999888877",
      "email": "guard@test.com"
    }
  }
}
```

**Response Body (Success):**
```json
{
  "success": true,
  "action": "data_create",
  "data": {
    "message": "Successfully created record in table 'StaffMember' with ID 'STF-F6F68672'.",
    "id": "STF-F6F68672",
    "record": {
      "staff_id": "STF-F6F68672",
      "name": "Security Guard",
      "role": "security",
      "status": "active",
      "phone": "+91-9999888877",
      "email": "guard@test.com"
    }
  }
}
```

---

## 13. Money Transaction REST API (Generic CRUD Reference)

The `MoneyTransaction` table is the general ledger register logging all cash flows. It is in the `GLOBAL_CRUD_WHITELIST` and supports generic actions (`data_create`, `data_query`, `data_update`, `data_delete`, `data_delete_many`). It integrates a polymorphic relation linking entries to students, teachers, or staff members.

### Money Transaction Schema Reference

| Field Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `transaction_id` | `string` | Read-only, Primary Key | Auto-generated ID prefixed with `MTX-` (e.g., `MTX-7D43EF46`). |
| `amount` | `number` | **Required**, minimum: `0.01` | Absolute positive decimal cash flow amount. |
| `type` | `string` | **Required**, enum | Choices: `in` (revenue inflows), `out` (expense outflows). |
| `by` | `string` | **Required**, max 255 chars | The internal system handler signatures. If type=='in' means Received By; if type=='out' means Sent By. |
| `from_to` | `string` | **Required**, max 255 chars | The target counterparty description label. If type=='in' means Received From; if type=='out' means Sent To. |
| `category_id` | `string` | **Required**, Foreign Key | References `ExpenseCategory.category_id`. Inherits protect rule. |
| `payment_method` | `string` | **Required**, enum | Choices: `cash`, `paytm`, `phonepe`, `bank`, `other`. |
| `payment_reference` | `string` | Optional, max 255 chars | Check numbers, transaction hashes, or bank refs. |
| `attachment_drive_id` | `string` | Optional, max 255 chars | Google Drive file reference unique string pointing to scanned receipt/invoice attachments. |
| `reconciliation_status` | `string` | **Required**, enum | Choices: `unreconciled`, `matched`, `discrepancy`. Default: `unreconciled`. |
| `party_type` | `string` | Enum | Choices: `student`, `teacher`, `staff`, `external`. |
| `party_id` | `string` | Optional, Polymorphic FK | References `student_id` (Student), `teacher_id` (Teacher), or `staff_id` (StaffMember) depending on `party_type`. |
| `party_name` | `string` | **Required**, max 255 chars | Literal name of partner (required for `external` party types). |
| `transaction_date` | `string` | **Required**, Date | Format: `YYYY-MM-DD`. Supporting backdated entries. |
| `notes` | `string` | Optional, max 255 chars | Details describing the purpose of transaction. |
| `remarks` | `string` | Optional, max 255 chars | Internal accounting audit remarks or correction details. |
| `created_by` | `string` | Optional, max 255 chars | Email/username of the logging user. |

### Relationships and Deletion Policy
* **`category` (belongsTo)**: References `ExpenseCategory` via `category_id`. Deletion is protected (`onDelete: "protect"`).
* **`party` (belongsToPolymorphic)**: Resolves dynamically to `Student`, `Teacher`, or `StaffMember` depending on `party_type`. Deletion uses a non-blocking `"onDelete": "do_nothing"` policy, which ensures that deleting parent student, teacher, or staff profiles does not orphan or block ledger history logs.

### A. Log a Transaction (`data_create`)

**Request Body (Polymorphic Staff Payout):**
```json
{
  "action": "data_create",
  "token": "YOUR_AUTH_TOKEN",
  "payload": {
    "table": "MoneyTransaction",
    "data": {
      "amount": 1500,
      "type": "out",
      "by": "Admin User",
      "from_to": "Security Guard",
      "category_id": "EXC-2B632258",
      "payment_method": "cash",
      "reconciliation_status": "unreconciled",
      "party_type": "staff",
      "party_id": "STF-F6F68672",
      "party_name": "Security Guard",
      "transaction_date": "2026-06-09",
      "notes": "Salary payout for May 2026"
    }
  }
}
```

**Response Body (Success):**
```json
{
  "success": true,
  "action": "data_create",
  "data": {
    "message": "Successfully created record in table 'MoneyTransaction' with ID 'MTX-7D43EF46'.",
    "id": "MTX-7D43EF46",
    "record": {
      "transaction_id": "MTX-7D43EF46",
      "amount": 1500,
      "type": "out",
      "by": "Admin User",
      "from_to": "Security Guard",
      "category_id": "EXC-2B632258",
      "payment_method": "cash",
      "reconciliation_status": "unreconciled",
      "party_type": "staff",
      "party_id": "STF-F6F68672",
      "party_name": "Security Guard",
      "transaction_date": "2026-06-09",
      "notes": "Salary payout for May 2026"
    }
  }
}

---

## 14. Attendance API (Student & Teacher)

The **Attendance System** manages daily attendance logs, statuses (Present, Absent, Leave), and mode classifications (Manual, QR, Biometric) for both students and teachers. 

Attendance logs reside in a separate, physical `Attendance` spreadsheet file under worksheets `StudentAttendance` and `TeacherAttendance`. To bypass string parsing inconsistencies and timezone shifting anomalies, the API utilizes a **Structured JSON Time Object** (`{ hour, minute, period }`) at the boundary, which the backend pre-processes and stores as a native `datetime` in the sheet.

---

### A. Student Attendance Actions

#### 1. Mark Student Attendance (`student_mark_attendance`)
Saves or updates (upserts) a student's daily attendance. The backend verifies the composite key `{ student_id, attendance_date }` to prevent duplicates and update the existing row if it already exists.

**Request Payload:**
```json
{
  "action": "student_mark_attendance",
  "token": "YOUR_AUTH_TOKEN",
  "payload": {
    "student_id": "STU-ATT-4KMAUL",
    "batch_id": "BAT-ATT-4KMAUL",
    "attendance_date": "2026-06-10",
    "status": "P",
    "entry_time": { "hour": 8, "minute": 1, "period": "AM" },
    "exit_time": { "hour": 1, "minute": 5, "period": "PM" },
    "attendance_mode": "Manual",
    "remarks": "On time arrival",
    "marked_by": "TCH-MOCK-1"
  }
}
```

**Response Envelope (Success):**
```json
{
  "success": true,
  "action": "student_mark_attendance",
  "data": {
    "attendance_id": "ATT-50B21429",
    "student_id": "STU-ATT-4KMAUL",
    "batch_id": "BAT-ATT-4KMAUL",
    "attendance_date": "2026-06-10",
    "status": "P",
    "entry_time": { "hour": 8, "minute": 1, "period": "AM" },
    "exit_time": { "hour": 1, "minute": 5, "period": "PM" },
    "attendance_mode": "Manual",
    "remarks": "On time arrival",
    "marked_by": "TCH-MOCK-1"
  }
}
```

#### 2. Bulk Mark Student Attendance (`student_mark_attendance_bulk`)
Performs batch upserts of student attendance for a batch on a specific date.

**Request Payload:**
```json
{
  "action": "student_mark_attendance_bulk",
  "token": "YOUR_AUTH_TOKEN",
  "payload": {
    "batch_id": "BAT-ATT-4KMAUL",
    "attendance_date": "2026-06-11",
    "attendance_mode": "Biometric",
    "marked_by": "TCH-MOCK-1",
    "records": [
      {
        "student_id": "STU-ATT-4KMAUL",
        "status": "P",
        "entry_time": { "hour": 8, "minute": 0, "period": "AM" },
        "exit_time": { "hour": 1, "minute": 0, "period": "PM" }
      },
      {
        "student_id": "STU-ATT-2-4KMAUL",
        "status": "A",
        "remarks": "Sick leave"
      }
    ]
  }
}
```

**Response Envelope (Success):**
```json
{
  "success": true,
  "action": "student_mark_attendance_bulk",
  "data": {
    "success": true,
    "processedCount": 2,
    "records": [
      {
        "attendance_id": "ATT-DBFA0DAD",
        "student_id": "STU-ATT-4KMAUL",
        "batch_id": "BAT-ATT-4KMAUL",
        "attendance_date": "2026-06-11",
        "status": "P",
        "entry_time": { "hour": 8, "minute": 0, "period": "AM" },
        "exit_time": { "hour": 1, "minute": 0, "period": "PM" },
        "attendance_mode": "Biometric",
        "remarks": null,
        "marked_by": "TCH-MOCK-1"
      },
      {
        "attendance_id": "ATT-5252457C",
        "student_id": "STU-ATT-2-4KMAUL",
        "batch_id": "BAT-ATT-4KMAUL",
        "attendance_date": "2026-06-11",
        "status": "A",
        "entry_time": null,
        "exit_time": null,
        "attendance_mode": "Biometric",
        "remarks": "Sick leave",
        "marked_by": "TCH-MOCK-1"
      }
    ]
  }
}
```

#### 3. Query Student Attendance (`student_query_attendance`)
Retrieves filtered student attendance logs. Hydrates records with dynamic computed duration values, student names, batch names, and course details.

**Request Payload:**
```json
{
  "action": "student_query_attendance",
  "token": "YOUR_AUTH_TOKEN",
  "payload": {
    "where": {
      "batch_id": "BAT-ATT-4KMAUL",
      "attendance_date": "2026-06-11"
    }
  }
}
```

**Response Envelope (Success):**
```json
{
  "success": true,
  "action": "student_query_attendance",
  "data": [
    {
      "attendance_id": "ATT-DBFA0DAD",
      "student_id": "STU-ATT-4KMAUL",
      "batch_id": "BAT-ATT-4KMAUL",
      "attendance_date": "2026-06-11",
      "status": "P",
      "entry_time": { "hour": 8, "minute": 0, "period": "AM" },
      "exit_time": { "hour": 1, "minute": 0, "period": "PM" },
      "attendance_mode": "Biometric",
      "remarks": null,
      "marked_by": "TCH-MOCK-1",
      "duration": 5.0,
      "student_name": "Learner Attendance",
      "batch_name": "Att Batch Morning",
      "course_id": "CRS-ATT-4KMAUL",
      "course_name": "Attendance 101"
    },
    {
      "attendance_id": "ATT-5252457C",
      "student_id": "STU-ATT-2-4KMAUL",
      "batch_id": "BAT-ATT-4KMAUL",
      "attendance_date": "2026-06-11",
      "status": "A",
      "entry_time": null,
      "exit_time": null,
      "attendance_mode": "Biometric",
      "remarks": "Sick leave",
      "marked_by": "TCH-MOCK-1",
      "duration": null,
      "student_name": "Learner 2 Attendance",
      "batch_name": "Att Batch Morning",
      "course_id": "CRS-ATT-4KMAUL",
      "course_name": "Attendance 101"
    }
  ]
}
```

---

### B. Teacher Attendance Actions

#### 1. Mark Teacher Attendance (`staff_mark_attendance`)
Saves or updates (upserts) a teacher's daily log per batch. Prevents duplicate rows on same date/teacher/batch.

**Request Payload:**
```json
{
  "action": "staff_mark_attendance",
  "token": "YOUR_AUTH_TOKEN",
  "payload": {
    "teacher_id": "TCH-ATT-4KMAUL",
    "batch_id": "BAT-ATT-MORN",
    "attendance_date": "2026-06-10",
    "status": "P",
    "entry_time": { "hour": 7, "minute": 45, "period": "AM" },
    "exit_time": { "hour": 2, "minute": 30, "period": "PM" },
    "attendance_mode": "Manual",
    "remarks": "Arrived early"
  }
}
```

**Response Envelope (Success):**
```json
{
  "success": true,
  "action": "staff_mark_attendance",
  "data": {
    "attendance_id": "TAT-BD910F70",
    "teacher_id": "TCH-ATT-4KMAUL",
    "batch_id": "BAT-ATT-MORN",
    "attendance_date": "2026-06-10",
    "status": "P",
    "entry_time": { "hour": 7, "minute": 45, "period": "AM" },
    "exit_time": { "hour": 2, "minute": 30, "period": "PM" },
    "attendance_mode": "Manual",
    "remarks": "Arrived early",
    "marked_by": null
  }
}
```

#### 2. Bulk Mark Teacher Attendance (`staff_mark_attendance_bulk`)
Performs batch upserts of teacher attendance records for a specific date and batch.

**Request Payload:**
```json
{
  "action": "staff_mark_attendance_bulk",
  "token": "YOUR_AUTH_TOKEN",
  "payload": {
    "attendance_date": "2026-06-11",
    "attendance_mode": "Biometric",
    "records": [
      {
        "teacher_id": "TCH-ATT-4KMAUL",
        "batch_id": "BAT-ATT-MORN",
        "status": "P",
        "entry_time": { "hour": 7, "minute": 40, "period": "AM" },
        "exit_time": { "hour": 2, "minute": 45, "period": "PM" }
      }
    ]
  }
}
```

**Response Envelope (Success):**
```json
{
  "success": true,
  "action": "staff_mark_attendance_bulk",
  "data": {
    "success": true,
    "processedCount": 1,
    "records": [
      {
        "attendance_id": "TAT-DFB2EA8B",
        "teacher_id": "TCH-ATT-4KMAUL",
        "batch_id": "BAT-ATT-MORN",
        "attendance_date": "2026-06-11",
        "status": "P",
        "entry_time": { "hour": 7, "minute": 40, "period": "AM" },
        "exit_time": { "hour": 2, "minute": 45, "period": "PM" },
        "attendance_mode": "Biometric",
        "remarks": null,
        "marked_by": null
      }
    ]
  }
}
```

#### 3. Query Teacher Attendance (`staff_query_attendance`)
Retrieves and filters teacher attendance logs. Hydrates records with dynamic calculated durations, teacher names, and batch/course details.

**Request Payload:**
```json
{
  "action": "staff_query_attendance",
  "token": "YOUR_AUTH_TOKEN",
  "payload": {
    "where": {
      "teacher_id": "TCH-ATT-4KMAUL",
      "attendance_date": "2026-06-11"
    }
  }
}
```

**Response Envelope (Success):**
```json
{
  "success": true,
  "action": "staff_query_attendance",
  "data": [
    {
      "attendance_id": "TAT-DFB2EA8B",
      "teacher_id": "TCH-ATT-4KMAUL",
      "batch_id": "BAT-ATT-MORN",
      "attendance_date": "2026-06-11",
      "status": "P",
      "entry_time": { "hour": 7, "minute": 40, "period": "AM" },
      "exit_time": { "hour": 2, "minute": 45, "period": "PM" },
      "attendance_mode": "Biometric",
      "remarks": null,
      "marked_by": null,
      "duration": 7.08,
      "teacher_name": "Instructor Attendance",
      "batch_name": "Att Batch Morning",
      "course_id": "CRS-ATT-101",
      "course_name": "Attendance 101"
    }
  ]
}
```

---

### C. Generic Deletion & Administrative CRUD

Standard administrative CRUD operations (creation, updates, deletions) are supported on `StudentAttendance` and `TeacherAttendance` tables using generic endpoints.

| Action Key | Payload Requirements | Description |
| :--- | :--- | :--- |
| `data_delete` | `{ "payload": { "table": "StudentAttendance", "id": "ATT-..." } }` | Hard delete an attendance record by ID. |
| `data_delete_many` | `{ "payload": { "table": "StudentAttendance", "ids": ["ATT-...", "ATT-..."] } }` | Hard delete multiple attendance records. |

---

## 15. Class Test API

The **Class Test System** manages schedules, papers, and performance results of classroom tests and examinations. Dynamic calculations are processed on-the-fly to keep spreadsheets lightweight.

### A. Core Action Mappings

#### 1. Create Class Test (`test_create`)
Schedules a new test for a batch.

**Request Payload:**
```json
{
  "action": "test_create",
  "token": "YOUR_AUTH_TOKEN",
  "payload": {
    "title": "Science Weekly Quiz 01",
    "batch_id": "BAT-ATT-MORN",
    "test_date": "2026-06-12",
    "total_marks": 50,
    "passing_marks": 20,
    "remarks": "Covers light and refraction modules"
  }
}
```

**Response Envelope (Success):**
```json
{
  "success": true,
  "action": "test_create",
  "data": {
    "id": "TST-00B21429",
    "title": "Science Weekly Quiz 01",
    "batch_id": "BAT-ATT-MORN",
    "test_date": "2026-06-12",
    "total_marks": 50,
    "passing_marks": 20,
    "status": "Draft",
    "remarks": "Covers light and refraction modules"
  }
}
```

---

#### 2. Save Test Marks Bulk (`test_save_marks_bulk`)
Saves or overrides (upserts) student test marks. Validates that the student is active in the batch, bounds checks the score against the test max, and normalizes absent marks to `null`.

**Request Payload:**
```json
{
  "action": "test_save_marks_bulk",
  "token": "YOUR_AUTH_TOKEN",
  "payload": {
    "test_id": "TST-00B21429",
    "records": [
      {
        "student_id": "STU-001",
        "obtained_marks": 45,
        "is_absent": false,
        "remarks": "Excellent score"
      },
      {
        "student_id": "STU-002",
        "obtained_marks": null,
        "is_absent": true,
        "remarks": "Voided: Sick leave"
      }
    ]
  }
}
```

**Response Envelope (Success):**
```json
{
  "success": true,
  "action": "test_save_marks_bulk",
  "data": {
    "success": true,
    "processedCount": 2,
    "records": [
      {
        "id": "TMK-50B21429",
        "test_id": "TST-00B21429",
        "student_id": "STU-001",
        "obtained_marks": 45,
        "is_absent": false,
        "remarks": "Excellent score"
      },
      {
        "id": "TMK-5252457C",
        "test_id": "TST-00B21429",
        "student_id": "STU-002",
        "obtained_marks": null,
        "is_absent": true,
        "remarks": "Voided: Sick leave"
      }
    ]
  }
}
```

---

#### 3. Query Test Performance Report (`test_query_report`)
Compiles a dynamic report containing hydrated details, student percentages, grades, ranks (using Standard Competition Ranking), and aggregate statistics.

**Request Payload:**
```json
{
  "action": "test_query_report",
  "token": "YOUR_AUTH_TOKEN",
  "payload": {
    "test_id": "TST-00B21429"
  }
}
```

**Response Envelope (Success):**
```json
{
  "success": true,
  "action": "test_query_report",
  "data": {
    "test": {
      "id": "TST-00B21429",
      "title": "Science Weekly Quiz 01",
      "batch_id": "BAT-ATT-MORN",
      "batch_name": "Att Batch Morning",
      "course_name": "Attendance 101",
      "test_date": "2026-06-12",
      "total_marks": 50,
      "passing_marks": 20,
      "status": "Draft",
      "remarks": "Covers light and refraction modules"
    },
    "stats": {
      "total_students": 2,
      "present_students": 1,
      "absent_students": 1,
      "highest_marks": 45,
      "lowest_marks": 45,
      "average_marks": 45,
      "pass_percentage": 50,
      "fail_percentage": 0,
      "absent_percentage": 50,
      "toppers": [
        {
          "student_id": "STU-001",
          "student_name": "Learner Attendance",
          "obtained_marks": 45
        }
      ]
    },
    "records": [
      {
        "id": "TMK-50B21429",
        "test_id": "TST-00B21429",
        "student_id": "STU-001",
        "student_name": "Learner Attendance",
        "obtained_marks": 45,
        "is_absent": false,
        "remarks": "Excellent score",
        "percentage": 90,
        "grade": "A",
        "rank": 1
      },
      {
        "id": "TMK-5252457C",
        "test_id": "TST-00B21429",
        "student_id": "STU-002",
        "student_name": "Learner 2 Attendance",
        "obtained_marks": null,
        "is_absent": true,
        "remarks": "Voided: Sick leave",
        "percentage": null,
        "grade": "Absent",
        "rank": "Absent"
      }
    ]
  }
}
```





