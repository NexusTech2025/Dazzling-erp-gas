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
| `academic_create_batch` | `{ "payload": { "item_id": "...", "batch_name": "...", "capacity": 30 } }` | Create a batch for a course. |
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
