# Session Memory: DazzlingDB API Toolchain Development
**Session Reference**: `75ee9c2d-8d21-4131-a739-e68b2b8b09e9`  
**Date**: 2026-06-03 / 2026-06-04

---

## 1. Overview of Achievements & Architecture

During this session, we built and refined a Node.js CLI toolchain in [DazzlingDB_Api/](E:/NAST/Dazzling/GAS/DazzlingDB_Api/) to query, audit, mutate, and manage records in DazzlingDB against the deployed Google Apps Script (GAS) API.

### A. Communication Protocol (Google Apps Script POST Bridge)
- **Endpoint**: `https://script.google.com/macros/s/AKfycbzKoVnCZ2U9N7mkPZePjYN9S0vGGT9jbLUG-3dkmP1-IoYkhKm4xfh41baGVW9ZI9V8/exec`
- **Method**: HTTP `POST`
- **Request Format**: JSON body containing three root-level parameters:
  - `action` (String): The registered action handler (e.g. `user_login`, `data_query`).
  - `token` (String, Optional/Required): The session token verified via `AuthBridge.resolveContext(token)` on the server.
  - `payload` (Object): Container holding all argument keys for the action.
- **Response Envelope**: Standard format returned for all actions:
  - **Success**: `{ "success": true, "action": "action_name", "data": { ... } }`
  - **Failure**: `{ "success": false, "action": "action_name", "error": { "type": "ErrorName", "message": "Reason" } }`

---

## 2. Decoupled Toolchain Design

All developed scripts are located in the [DazzlingDB_Api/](E:/NAST/Dazzling/GAS/DazzlingDB_Api/) folder:

### 1. Reusable API Helper: `api_client.js`
Located at [DazzlingDB_Api/api_client.js](E:/NAST/Dazzling/GAS/DazzlingDB_Api/api_client.js).
- Handles HTTP requests using Node's built-in `fetch` (with native support for GAS 302 redirects).
- Auto-loads the base URL and credentials from [dazzlingdb_api_settings.json](E:/NAST/Dazzling/GAS/DazzlingDB_Api/dazzlingdb_api_settings.json).
- Saves and loads tokens to [session_token.json](E:/NAST/Dazzling/GAS/DazzlingDB_Api/session_token.json).

### 2. User Authentication: `login.js`
Located at [DazzlingDB_Api/login.js](E:/NAST/Dazzling/GAS/DazzlingDB_Api/login.js).
- Performs the `user_login` action against the API.
- Reads credentials from the settings file first, falling back to CLI arguments `node login.js <user> <pass>` if missing.
- Saves the retrieved session key into `session_token.json`.

### 3. Display Controller Pipeline: `display_controller.js`
Located at [DazzlingDB_Api/display_controller.js](E:/NAST/Dazzling/GAS/DazzlingDB_Api/display_controller.js).
Handles post-fetch formatting and visualization in a decoupled pipeline:
- **Filtering**: Filters rows locally (e.g., `"hasRelations": true` filters out all rows containing empty relationship fields).
- **Sorting**: Sorts rows in memory based on a column key (`sort: { by: "field", order: "desc" }`).
- **Formatting**: Converts cell values (e.g. converting base fee numbers to currency strings like `₹ 32,000`).
- **Column Projection**: Limits displayed columns (`select: [...]`) in the primary table to fit terminal widths.
- **Prettified JSON Colorizer**: Uses ANSI escape codes to print cyan keys, green strings, yellow numbers, and magenta booleans for hydrated nested arrays.

### 4. Advanced Query Tool: `query.js`
Located at [DazzlingDB_Api/query.js](E:/NAST/Dazzling/GAS/DazzlingDB_Api/query.js).
Binds the `api_client.js` network dispatcher to the `display_controller.js` render pipeline.
- Supports flags (`--where`, `--include`, `--limit`, `--offset`).
- Supports a universal `--args <json_file_or_string>` flag to load full query DSL specifications at once.
- Dynamically resolves primary key columns (e.g. mapping Course to `course_id` and Student to `student_id`).

### 5. Orphaned Record Cleaner: `clean_courses.js`
Located at [DazzlingDB_Api/clean_courses.js](E:/NAST/Dazzling/GAS/DazzlingDB_Api/clean_courses.js).
- Audits and deletes courses that have zero active batches and zero enrollments.
- Mode 1: Dry run (`node clean_courses.js`) prints a list of course IDs eligible for deletion.
- Mode 2: Force Execution (`node clean_courses.js --delete`) deletes them sequentially calling `data_delete`.

---

## 3. Database Schema Modifications

### A. Course Schema Relationships
We updated [Course.json](E:/NAST/Dazzling/GAS/DazzlingDB/Config/Schema/Academic/Course.json) relations block to explicitly map backward/incoming links as forward `hasMany` relationships:
```json
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
```

### B. Compiler Refactoring
We modified [compile_schema.js](E:/NAST/Dazzling/GAS/compile_schema.js) to:
- Compile and build **ONLY** [database_schema.js](E:/NAST/Dazzling/GAS/DazzlingDB/Config/database_schema.js).
- Remove outputting raw JSON files (`full_schema.json` and `full_schemav3.json` to the file system and `docs/`).

---

## 4. Current State & Next Steps

### A. Saved Datasets
- [orphaned_course_ids.json](E:/NAST/Dazzling/GAS/DazzlingDB_Api/orphaned_course_ids.json): Stores the list of **44 Course IDs** verified as having 0 batches and 0 enrollments.

### B. Immediate Action Items (Next Session Resumption)
1. **Execute Cleanup**: Run the cleaner script to purge the 44 audited courses from the Google Sheets database:
   ```bash
   cd E:\NAST\Dazzling\GAS\DazzlingDB_Api
   node clean_courses.js --delete
   ```
2. **Dynamic Student Queries**: Perform student relation testing using refined templates:
   ```bash
   node query.js Student --args student_query_refined.json
   ```
3. **Template Configurations**: Edit templates inside [payloads/](E:/NAST/Dazzling/GAS/DazzlingDB_Api/payloads/) to test various relationship loads.
