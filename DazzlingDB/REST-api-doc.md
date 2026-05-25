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

### B. Student Management
| Action Key | Payload Requirements | Description |
| :--- | :--- | :--- |
| `student_register` | `{ "payload": { "profile": {...}, "address": {...}, "contact": {...} } }` | **Relational Insert:** Creates student, address, and contact in one transaction. |

### C. Academic & Curriculum
| Action Key | Payload Requirements | Description |
| :--- | :--- | :--- |
| `academic_create_course_type` | `{ "payload": { "segment_name": "..." } }` | Create segments like "Academic" or "Vocational". |
| `academic_create_course` | `{ "payload": { "segment_id": "...", "name": "...", "base_fee": 0 } }` | Create a specific subject/course. |
| `academic_create_batch` | `{ "payload": { "course_id": "...", "batch_name": "...", "capacity": 30 } }` | Create a batch for a course. |
| `academic_create_package` | `{ "payload": { "name": "...", "package_fee": 1000, ... } }` | Bulk package creation with perks/courses. |
| `academic_enroll_student` | `{ "payload": { "student_id": "...", "item_id": "...", "batch_id": "..." } }` | Enrolls a student in a batch. |

### D. Staff & HR
| Action Key | Payload Requirements | Description |
| :--- | :--- | :--- |
| `staff_onboard_teacher` | `{ "payload": { "full_name": "...", "mobile_number": "..." } }` | Register teacher profile. |
| `staff_assign_subjects` | `{ "payload": { "teacher_id": "...", "subject_ids": ["ID1", "ID2"] } }` | Link teacher to courses. |
| `staff_mark_attendance` | `{ "payload": { "teacher_id": "...", "status": "present", "attendance_date": "YYYY-MM-DD" } }` | Record attendance. |
| `staff_record_payment` | `{ "payload": { "teacher_id": "...", "amount": 5000, "payment_type": "salary" } }` | Log financial transactions for staff. |
| `staff_set_salary_config` | `{ "payload": { "teacher_id": "...", "salary_type": "monthly", "base_amount": 20000 } }` | Define payroll rules. |
| `staff_add_document` | `{ "payload": { "teacher_id": "...", "document": {...} } }` | Attach file links to staff. |

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

The `Batch` table stores academic/course batch instances. Because it is in the `GLOBAL_CRUD_WHITELIST`, it can be manipulated using generic data actions (`data_create`, `data_query`, `data_update`, `data_delete`) as well as the specialized endpoint `academic_create_batch` for creation.

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

## 8. Standard Request and Response Payload Architecture

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


