# DazzlingDB Test Writing Style Guide

This document establishes the guidelines for visual layout, logging formatting, and exception handling when writing non-API tests for DazzlingDB.

## 1. Visual & Emoji Logging Layout

Every test suite must output structured, indented logs using the following emoji conventions:

| Log Type | Emoji | Prefix & Indentation | Example |
|---|---|---|---|
| Suite Start | 🚀 | `🚀 Starting [Suite Name]...` | `🚀 Starting Academic Service Integration Tests...` |
| Divider | (none) | `\n=========================================` | `\n=========================================` |
| Scenario Title | ▶️ | `▶️ SCENARIO [X]: [Description]` | `▶️ SCENARIO 1: Relational Insertion (Course)` |
| Action Step | ⚙️ | `   ⚙️ [Action / Parameter Details]` | `   ⚙️ Inserting payload: {"name":"Test Course"}` |
| Success Pass | ✅ | `   ✅ Success! [Outcome Details]` | `   ✅ Success! Created Course: Physics 101` |
| Failure / Error | ❌ | `   ❌ Failed: [Error details]` | `   ❌ Failed: Course AutoField failed` |
| Summary Report | 📊 | `📊 FINAL TEST RESULTS: \n [JSON]` | `📊 FINAL TEST RESULTS: { ... }` |
| Suite Complete | 🏁 | `🏁 [Suite Name] Complete.` | `🏁 Academic Service Tests Complete.` |

### Guidelines
- Standard indentation for steps inside a scenario is **3 spaces** before the emoji (e.g. `   ⚙️` or `   ✅`).
- Log payloads or database results in JSON format using `JSON.stringify(data)` for clear traceability.

---

## 2. Robust Exception Handling & Verification

All database interactions must be protected by explicit exception boundaries.

### Positive Validation (Testing Success Pathways)
Wrap the transaction in a `try...catch`. If any error occurs, intercept it, print the name and message, and return the failure string:
```javascript
try {
  const result = db.Course.insert(payload);
  // Verify key fields
  if (!result.course_id) throw new Error("ID generation failed.");
  return "✅ PASSED";
} catch (e) {
  console.error("   ❌ Failed:", e.message);
  return `❌ FAILED: ${e.message}`;
}
```

### Negative Validation (Testing Constraints / Failure Pathways)
When testing validation errors or missing relation constraints, verify that:
1. An exception IS thrown.
2. The exception class/name matches expectations (e.g., `ValidationError`, `EntityNotFoundError`).
3. Unexpected errors are logged clearly.

```javascript
let passed = true;
let messages = [];
try {
  db.Course.insert({ description: "Missing required fields" });
  passed = false;
  messages.push("Failed to catch missing required fields constraint.");
} catch (e) {
  if (e.name !== 'ValidationError') {
    passed = false;
    messages.push(`Expected ValidationError, got ${e.name} instead.`);
  } else {
    console.log("   ✅ Caught missing required fields correctly.");
  }
}
return passed ? "✅ PASSED" : `❌ FAILED: ${messages.join(" | ")}`;
```

---

## 3. Database Context Interactions
- Tests must retrieve the DB instance using `const db = DBContext.getInstance()`.
- Operate directly on repositories (e.g., `db.Course.insert()`, `db.Course.update()`, `db.Course.remove()`, `db.Course.exists()`). Do not call low-level spreadsheet boundaries.
