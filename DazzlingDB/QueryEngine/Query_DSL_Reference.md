# DazzlingDB Advanced Query DSL - Frontend Documentation

This document describes the structure and usage of the `data_query` payload for the DazzlingDB Advanced Query Engine.

---

## 1. Action Details
- **Action Key:** `data_query`
- **Request Format:** POST
- **Top-level Payload Wrapper:** 
  All queries must be wrapped in a `payload` object within the standard API request envelope.

```json
{
  "action": "data_query",
  "token": "YOUR_AUTH_TOKEN",
  "payload": {
    "target": "Student",
    "where": { ... },
    "include": { ... },
    "select": [ ... ],
    "sort": [ ... ],
    "pagination": { ... }
  }
}
```

---

## 2. Query Object Structure

### `target` (Required)
- **Type:** `String`
- **Description:** The name of the table to query (e.g., "Student", "Course", "Teacher").
- **Constraints:** Must match a valid table defined in the database schema.

### `where` (Optional)
- **Type:** `Object`
- **Description:** Filters the results. Supports simple equality or complex operators.
- **Default:** `{}` (Returns all rows).

#### Simple Equality
```json
"where": {
  "status": "active",
  "gender": "male"
}
```

#### Advanced Operators
Operators are expressed as objects: `{ "field": { "operator": "op_name", "value": "some_value" } }`.

| Operator | Description | Example Value |
| :--- | :--- | :--- |
| `eq` | Equal to | `"active"` |
| `neq` | Not equal to | `"deleted"` |
| `gt` | Greater than | `18` |
| `gte` | Greater than or equal to | `18` |
| `lt` | Less than | `60` |
| `lte` | Less than or equal to | `60` |
| `contains` | Case-insensitive substring match | `"Moni"` |
| `in` | Value exists in array | `["active", "pending"]` |
| `between`| Value is between two numbers (inclusive)| `[100, 500]` |

**Example:**
```json
"where": {
  "age": { "operator": "gt", "value": 18 },
  "full_name": { "operator": "contains", "value": "John" },
  "status": { "operator": "in", "value": ["active", "probation"] }
}
```

---

### `include` (Optional)
- **Type:** `Array<String>` or `Object`
- **Description:** Hydrates relational data (solves the N+1 problem).
- **Behavior:** Fetches related entities as nested objects/arrays.

#### Array Format (Simple)
```json
"include": ["address", "enrollments"]
```

#### Object Format (Advanced/Nested)
Supports recursive hydration of sub-relations.
```json
"include": {
  "address": {},
  "enrollments": {
    "include": {
      "batch": {}
    }
  }
}
```

---

### `select` (Optional)
- **Type:** `Array<String>`
- **Description:** Limits the fields returned for the primary entity.
- **Security:** Sensitive fields (like `password_hash`) are automatically stripped even if selected.
- **Note:** If `select` is provided, only the listed fields will be in the output. Use with caution when combined with `include`.

```json
"select": ["id", "full_name", "email"]
```

---

### `sort` (Optional)
- **Type:** `Array<Object>` or `Object`
- **Description:** Defines multi-column sorting.

```json
"sort": [
  { "field": "full_name", "order": "ASC" },
  { "field": "created_at", "order": "DESC" }
]
```

---

### `pagination` (Optional)
- **Type:** `Object`
- **Description:** Controls the number of records and starting point.
- **Default:** `{ "limit": 50, "offset": 0 }`
- **Max Limit:** 200 (System enforced).

```json
"pagination": {
  "limit": 20,
  "offset": 0
}
```

---

## 3. Full Example

**The Query:** "Fetch 10 active students whose name contains 'Ali', sorted by name, including their address and their enrollments (with batch details)."

```json
{
  "action": "data_query",
  "token": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "payload": {
    "target": "Student",
    "where": {
      "status": "active",
      "full_name": { "operator": "contains", "value": "Ali" }
    },
    "include": {
      "address": {},
      "enrollments": {
        "include": ["batch"]
      }
    },
    "sort": [{ "field": "full_name", "order": "ASC" }],
    "pagination": {
      "limit": 10,
      "offset": 0
    }
  }
}
```

## 4. Response Structure

The Query Engine returns a standard response wrapper with metadata:

```json
{
  "success": true,
  "action": "data_query",
  "data": {
    "success": true,
    "target": "Student",
    "count": 10,
    "total_count": 45,
    "data": [
      {
        "id": "STU-001",
        "full_name": "Ali Khan",
        "status": "active",
        "address": { ... },
        "enrollments": [ ... ]
      },
      ...
    ]
  }
}
```
