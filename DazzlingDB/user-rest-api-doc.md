# DazzlingDB User Administrative REST API Documentation

This document details the specialized administrative API actions (`user_query`, `user_update`, and `user_delete`) available in DazzlingDB. These actions bypass the generic CRUD whitelists and are strictly restricted to the `superadmin` role.

---

## 1. Security & Authentication Safeguards

- **Access Level**: `superadmin` only. 
- **Privilege Enforcement**: Any request carrying a token belonging to `admin`, `teacher`, `student`, or `guest` roles will be rejected immediately with a `FORBIDDEN_ACCESS` error.
- **Request Wrapper**: Standard request body syntax applies, wrapping all params inside the `payload` block.

---

## 2. API Endpoint Reference

### `user_query`
Queries the system user directory with full support for DazzlingDB Query DSL filters, projections, sorting, and pagination.

* **Action Key:** `user_query`
* **HTTP Method:** `POST`
* **Target Table:** Hardlocked internally to the `User` table.
* **Credentials Stripping:** For security compliance, the API automatically sanitizes all response user objects by stripping `password_hash` and `password_salt` fields.

#### Request Example (Advanced Operator Filter)
```json
{
  "action": "user_query",
  "token": "YOUR_SUPERADMIN_SESSION_TOKEN",
  "payload": {
    "where": {
      "role": { "operator": "in", "value": ["admin", "superadmin"] },
      "status": "active"
    },
    "sort": [
      { "field": "username", "order": "ASC" }
    ],
    "pagination": {
      "limit": 10,
      "offset": 0
    }
  }
}
```

#### Response Example (Sanitized User Array)
```json
{
  "success": true,
  "data": {
    "success": true,
    "target": "User",
    "count": 2,
    "total_count": 2,
    "data": [
      {
        "user_id": "USR-1D860279",
        "username": "superadmin_moni",
        "role": "superadmin",
        "status": "active",
        "last_login": "2026-07-13T14:54:39.000Z",
        "failed_attempts": 0
      },
      {
        "user_id": "USR-10338E25",
        "username": "admin_clerk",
        "role": "admin",
        "status": "active",
        "last_login": "2026-07-13T14:50:11.000Z",
        "failed_attempts": 0
      }
    ]
  },
  "context": {
    "execution_time_ms": 35
  },
  "meta": {
    "environment": "DEVELOPMENT",
    "version": "2.1.2",
    "timestamp": "2026-07-13T15:24:10.000Z"
  }
}
```

---

### `user_update`
Updates user metadata (username, role, status) and handles password resets.

* **Action Key:** `user_update`
* **HTTP Method:** `POST`
* **Password Hashing:** Passing a plaintext `"password"` field in the `data` payload automatically triggers password strength validation (minimum 8 characters, requiring uppercase, lowercase, digit, and special char), generates a new unique cryptographic salt, computes the SHA-256 hash, updates the database, and deletes the plain text reference from RAM.
* **Session Invalidation**: If the user's `role` or `status` is updated, the API automatically terminates all active sessions associated with the user, immediately forcing clients to re-authenticate.
* **Sole Superadmin Lockout Protection**: The API blocks demoting (changing role from superadmin) or locking/disabling the last active superadmin.

#### Request Example (Updating Status and Changing Password)
```json
{
  "action": "user_update",
  "token": "YOUR_SUPERADMIN_SESSION_TOKEN",
  "payload": {
    "user_id": "USR-5C100273",
    "data": {
      "status": "locked",
      "password": "NewSecurePassword123!"
    }
  }
}
```

#### Response Example (Sanitized Updated Record)
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Successfully updated user 'USR-5C100273'.",
    "user": {
      "user_id": "USR-5C100273",
      "username": "guest_user",
      "role": "guest",
      "status": "locked",
      "failed_attempts": 0
    }
  },
  "context": {
    "execution_time_ms": 112,
    "mutated_records_count": 1,
    "mutated_records": ["User"]
  },
  "meta": {
    "environment": "DEVELOPMENT",
    "version": "2.1.2",
    "timestamp": "2026-07-13T15:24:12.000Z"
  }
}
```

---

### `user_delete`
Deletes a single user record and cascade removes all active session tokens.

* **Action Key:** `user_delete`
* **HTTP Method:** `POST`
* **Self-Deletion Block**: A superadmin is strictly prohibited from deleting their own active profile.
* **Superadmin Protection**: Deleting other `superadmin` role users is prohibited to maintain database administration safety.
* **Cascade Deletion**: Removes all active session tokens in the `Session` repository associated with the target user ID to prevent orphaned logins.

#### Request Example
```json
{
  "action": "user_delete",
  "token": "YOUR_SUPERADMIN_SESSION_TOKEN",
  "payload": {
    "user_id": "USR-5C100273"
  }
}
```

#### Response Example
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Successfully deleted user 'USR-5C100273' and cleared all active sessions.",
    "deleted_id": "USR-5C100273"
  },
  "context": {
    "execution_time_ms": 94,
    "mutated_records_count": 1,
    "mutated_records": ["User"]
  },
  "meta": {
    "environment": "DEVELOPMENT",
    "version": "2.1.2",
    "timestamp": "2026-07-13T15:24:14.000Z"
  }
}
```
