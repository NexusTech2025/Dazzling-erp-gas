# DazzlingDB — Full Database Seeding Workflow

> **Purpose**: Step-by-step operational guide for seeding the DazzlingDB production/development database using the `dazzlingdb-tools` CLI commands. Every step depends on IDs produced by the previous step. **Never skip a step or proceed without confirmed IDs.**

---

## Prerequisites

```bash
# 1. Ensure you are in the dazzlingdb-tools directory
cd E:\NAST\Dazzling\GAS\dazzlingdb-tools

# 2. Authenticate (one-time per session)
npm run api-login
```

> [!IMPORTANT]
> All commands below must be run from `E:\NAST\Dazzling\GAS\dazzlingdb-tools\`.

---

## CLI Reference

### `api-batch-insert`

```text
npm run api-batch-insert -- <action_key> <table_name> <payload_json_file> [--env <env>]
```

| Argument | Description |
|---|---|
| `action_key` | The dispatcher action name (e.g., `core_create_branch`) |
| `table_name` | The schema model name (e.g., `Branch`) |
| `payload_json_file` | Path to the JSON array of records |
| `--env` | Optional. `development` or `production` (default: `production`) |

### How it works internally

The `HomogeneousBatchEngine` loops over each record in the payload array and dispatches a **single HTTP POST** per record to the GAS web app using the specified `action_key`. It is **not** a bulk write — it is sequential single-row insertion with error aggregation.

### Response telemetry

After execution, the engine writes a telemetry report to:

```
dazzlingdb-tools/responses/batch_<table_lowercase>_manifest.json
```

This file contains:
- `successManifest[]` — each entry has `resolvedId` (the server-generated primary key) and `recordSnapshot`
- `failureManifest{}` — keyed by array index, with error messages
- `executionMetadata` — wall time, success/failure counts, average latency

> [!CAUTION]
> **ID Dependency Rule**: Every subsequent step requires `resolvedId` values from the previous step's `successManifest`. If a step produces failures, do NOT proceed until the failures are resolved or acknowledged.

---

## Seeding Sequence

```text
┌──────────────────────────────────┐
│  STEP 1: Insert Branches        │
│  Action: core_create_branch      │
│  Output: branch_id values        │
└───────────────┬──────────────────┘
                │
                ▼
┌──────────────────────────────────┐
│  STEP 2: Insert Packages        │
│  (auto-creates Courses on-demand)│
│  Action: academic_create_package │
│  Output: package_id, course_id   │
│          values                  │
└───────────────┬──────────────────┘
                │
                ▼
┌──────────────────────────────────┐
│  STEP 3: Insert Teachers         │
│  (requires branch_id from Step 1)│
│  Action: staff_onboard_teacher   │
│  Output: teacher_id values       │
└───────────────┬──────────────────┘
                │
                ▼
┌──────────────────────────────────┐
│  STEP 4: Insert Batches          │
│  (requires course_id from Step 2 │
│   + branch_id from Step 1)       │
│  Action: academic_create_batch   │
│  Phases:                         │
│   4A - RBSE English Medium       │
│   4B - RBSE Hindi Medium (confirm│
│   4C - CBSE Classes     (confirm)│
└──────────────────────────────────┘
```

---

## STEP 1 — Insert Branches

### Payload file

[branches_list.json](E:\NAST\Dazzling\GAS\dazzlingdb-tools\payloads\db_payloads\branches_list.json)

```json
[
  { "branch_name": "Main Branch", "location": "9 Jagat Vihar...", "status": "active" },
  { "branch_name": "Home Branch", "location": "21 Mahesh Colony...", "status": "active" }
]
```

### Command

```bash
npm run api-batch-insert -- core_create_branch Branch ./payloads/db_payloads/branches_list.json
```

### Post-execution

1. Open `responses/batch_branch_manifest.json`
2. Extract `resolvedId` from each entry in `successManifest`:

```text
Expected output IDs (example):
  Main Branch  →  BRN-XXXXXXXX   (referred to as MAIN_BRANCH_ID below)
  Home Branch  →  BRN-YYYYYYYY   (referred to as HOME_BRANCH_ID below)
```

3. **Record these IDs** — they are required for Steps 3 and 4.

> [!TIP]
> The "Main Branch" ID is the default branch for all teachers. Note it separately.

---

## STEP 2 — Insert Packages (with on-demand Course creation)

### Payload file

[package_bundle_unpacked.json](E:\NAST\Dazzling\GAS\dazzlingdb-tools\payloads\db_payloads\package_bundle_unpacked.json)

This file contains **30 packages** across:

| Board | Medium | Classes |
|---|---|---|
| CBSE | English | 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 |
| RBSE | English | 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 |
| RBSE | Hindi | 3, 4, 5, 6, 7, 8, 9, 10 |

Each package contains `items[]` with `on_demand: true`, which means the server-side `CreatePackageAction` will **auto-create** the corresponding Course/Subject records if they don't already exist.

### Command

```bash
npm run api-batch-insert -- academic_create_package Package ./payloads/db_payloads/package_bundle_unpacked.json
```

### Post-execution

1. Open `responses/batch_package_manifest.json`
2. Each `recordSnapshot` in `successManifest` will contain:
   - `package_id` — the created package's ID
   - The nested course/subject records with their `course_id` values (created on-demand)

3. **Extract and catalog all `course_id` values** grouped by board + medium + class. These are required for Step 4 (batch creation).

> [!IMPORTANT]
> The on-demand course creation means you do **not** need a separate `academic_create_course` step. The courses are created as a side-effect of package insertion.

### Course ID Catalog (template to fill after execution)

Use this table to record the course IDs from the response:

```text
┌────────────────────────────────────────┬──────────────────┬──────────┐
│ Course Name                            │ Short Code       │ course_id│
├────────────────────────────────────────┼──────────────────┼──────────┤
│ RBSE ENGLISH MEDIUM                    │                  │          │
├────────────────────────────────────────┼──────────────────┼──────────┤
│ Class 3 Science (RBSE - English)       │ SCI03RBSEE       │          │
│ Class 3 Mathematics (RBSE - English)   │ MAT03RBSEE       │          │
│ Class 3 Social Studies (RBSE - English)│ SST03RBSEE       │          │
│ Class 3 English (RBSE)                 │ ENG03RBSEE       │          │
│ ...repeat for Classes 4–12...          │                  │          │
├────────────────────────────────────────┼──────────────────┼──────────┤
│ RBSE HINDI MEDIUM                      │                  │          │
├────────────────────────────────────────┼──────────────────┼──────────┤
│ कक्षा 3 विज्ञान (RBSE - हिंदी माध्यम)     │ SCI03RBSEH       │          │
│ ...repeat for Classes 3–10...          │                  │          │
├────────────────────────────────────────┼──────────────────┼──────────┤
│ CBSE ENGLISH MEDIUM                    │                  │          │
├────────────────────────────────────────┼──────────────────┼──────────┤
│ Class 3 Science (CBSE)                 │ SCI03CBSEE       │          │
│ ...repeat for Classes 3–12...          │                  │          │
└────────────────────────────────────────┴──────────────────┴──────────┘
```

---

## STEP 3 — Insert Teachers

### Dependency

| Required ID | Source |
|---|---|
| `branch_id` | Step 1 → `MAIN_BRANCH_ID` |

### Payload preparation

The raw file at [teachers_list.json](E:\NAST\Dazzling\GAS\dazzlingdb-tools\payloads\db_payloads\teachers_list.json) contains placeholder `branch_id` values (`BRN-MUM01`, `BRN-DEL01`).

**Before running, you MUST replace all `branch_id` values** with the actual `MAIN_BRANCH_ID` from Step 1.

#### Option A — Manual edit

Open the file and replace every `"branch_id": "BRN-MUM01"` and `"branch_id": "BRN-DEL01"` with the real ID from Step 1.

#### Option B — Copy and patch via CLI (PowerShell)

```powershell
$mainBranchId = "BRN-XXXXXXXX"  # <-- paste real ID here
$content = Get-Content ./payloads/db_payloads/teachers_list.json -Raw
$patched = $content -replace '"BRN-MUM01"', "`"$mainBranchId`"" -replace '"BRN-DEL01"', "`"$mainBranchId`""
$patched | Set-Content ./payloads/db_payloads/teachers_list_patched.json -Encoding UTF8
```

### Teachers roster (10 teachers)

| # | Name | Specialization | Original Placeholder |
|---|---|---|---|
| 1 | Rahul Baba | Maths | BRN-MUM01 |
| 2 | AbhiShek Solanki | Bio | BRN-MUM01 |
| 3 | Ritu Sharma | General Subjects | BRN-DEL01 |
| 4 | Priyanka Maam | Arts | BRN-MUM01 |
| 5 | Dev Sharma | Chemistry | BRN-DEL01 |
| 6 | Manmohan Sir | Physics | BRN-MUM01 |
| 7 | Manish Kumar | Computer Science | BRN-MUM01 |
| 8 | Jitendra Sharma | English | BRN-DEL01 |
| 9 | Ansul Sharma | Accounting | BRN-MUM01 |
| 10 | Neha Sharma | Economics | BRN-DEL01 |

### Command

```bash
# If you patched to a new file:
npm run api-batch-insert -- staff_onboard_teacher Teacher ./payloads/db_payloads/teachers_list_patched.json

# If you edited the original in-place:
npm run api-batch-insert -- staff_onboard_teacher Teacher ./payloads/db_payloads/teachers_list.json
```

### Post-execution

1. Open `responses/batch_teacher_manifest.json`
2. Extract `resolvedId` (teacher_id) for each teacher
3. Record the teacher_id values — useful for future batch-teacher assignment operations

---

## STEP 4 — Insert Batches (Phased, User-Confirmed)

### Dependencies

| Required ID | Source |
|---|---|
| `course_id` | Step 2 → from `successManifest` per course |
| `branch_id` | Step 1 → `MAIN_BRANCH_ID` |

### Batch payload structure (per record)

Each batch record sent to `academic_create_batch` requires:

```json
{
  "batch_name": "Class 11 Physics Batch (RBSE - English)",
  "batch_type": "Academy",
  "course_id": "<COURSE_ID_FROM_STEP_2>",
  "branch_id": "<MAIN_BRANCH_ID_FROM_STEP_1>",
  "capacity": 30,
  "status": "active"
}
```

#### Field reference

| Field | Required | Type | Notes |
|---|---|---|---|
| `batch_name` | ✅ Yes | `string` | Descriptive name (max 255 chars) |
| `batch_type` | ✅ Yes | `string` | **Must be one of**: `Academy`, `Computer`, `Foundation`, `Competitive` |
| `course_id` | ✅ Yes | `foreign_key` | From Step 2 response — existence-checked server-side |
| `branch_id` | ❌ Optional | `foreign_key` | From Step 1 response — validated only if provided |
| `teacher_id` | ❌ Optional | `foreign_key` | From Step 3 response — validated only if provided |
| `capacity` | ❌ Optional | `number` | Defaults to `30` if omitted |
| `status` | ❌ Optional | `string` | Defaults to `active`. Choices: `active`, `completed`, `cancelled` |
| `start_date` | ❌ Optional | `date` | Batch start date |
| `end_date` | ❌ Optional | `date` | Batch end date |
| `schedule` | ❌ Optional | `json` | Free-form JSON for slot/timing info (no enforced structure) |

> **Note**: There is no dedicated `slot_time` column. If you need to store class timing, embed it inside the `schedule` JSON field (e.g., `{"slot": "08:00 AM - 09:00 AM", "days": ["Mon","Wed","Fri"]}`).

> [!WARNING]
> **Hard gate**: Do NOT execute any batch insert command if the required `course_id` or `branch_id` is missing or unresolved. Every foreign key must point to a confirmed, existing record.

### Phase 4A — RBSE English Medium Batches

Create one batch per subject for all RBSE English Medium classes (Classes 3–12).

**Payload file to create**: `./payloads/db_payloads/batches_rbse_english.json`

Generate the JSON array using the course_id values from Step 2 for subjects with `language_medium: "English"` and `board: "RBSE"`.

```bash
npm run api-batch-insert -- academic_create_batch Batch ./payloads/db_payloads/batches_rbse_english.json
```

**Post-execution**: Verify `responses/batch_batch_manifest.json` for success.

---

### Phase 4B — RBSE Hindi Medium Batches

> [!IMPORTANT]
> **🛑 USER CONFIRMATION REQUIRED**: Before executing this phase, ask the user:
> _"RBSE English Medium batches are inserted. Shall I proceed with RBSE Hindi Medium batches?"_
>
> Only proceed after explicit confirmation.

Create one batch per subject for all RBSE Hindi Medium classes (Classes 3–10).

**Payload file to create**: `./payloads/db_payloads/batches_rbse_hindi.json`

```bash
npm run api-batch-insert -- academic_create_batch Batch ./payloads/db_payloads/batches_rbse_hindi.json
```

---

### Phase 4C — CBSE English Medium Batches

> [!IMPORTANT]
> **🛑 USER CONFIRMATION REQUIRED**: Before executing this phase, ask the user:
> _"RBSE Hindi Medium batches are inserted. Shall I proceed with CBSE English Medium batches?"_
>
> Only proceed after explicit confirmation.

Create one batch per subject for all CBSE classes (Classes 3–12).

**Payload file to create**: `./payloads/db_payloads/batches_cbse_english.json`

```bash
npm run api-batch-insert -- academic_create_batch Batch ./payloads/db_payloads/batches_cbse_english.json
```

---

## Complete Summary Table

| Step | Action Key | Table | Payload File | Produces |
|---|---|---|---|---|
| 1 | `core_create_branch` | Branch | `branches_list.json` | `branch_id` |
| 2 | `academic_create_package` | Package | `package_bundle_unpacked.json` | `package_id`, `course_id` (on-demand) |
| 3 | `staff_onboard_teacher` | Teacher | `teachers_list.json` (patched) | `teacher_id` |
| 4A | `academic_create_batch` | Batch | `batches_rbse_english.json` (generated) | `batch_id` |
| 4B | `academic_create_batch` | Batch | `batches_rbse_hindi.json` (generated) | `batch_id` |
| 4C | `academic_create_batch` | Batch | `batches_cbse_english.json` (generated) | `batch_id` |

---

## ID Storage Convention

All telemetry manifests are saved to `dazzlingdb-tools/responses/`:

```text
responses/
  batch_branch_manifest.json       ← Step 1 IDs
  batch_package_manifest.json      ← Step 2 IDs (packages + on-demand courses)
  batch_teacher_manifest.json      ← Step 3 IDs
  batch_batch_manifest.json        ← Step 4 IDs (overwritten per phase)
```

> [!TIP]
> Since Step 4 has three phases that all write to `batch_batch_manifest.json`, **manually rename** the output file after each phase to preserve the data:
> ```powershell
> Rename-Item ./responses/batch_batch_manifest.json batch_batch_rbse_english_manifest.json
> # then run phase 4B ...
> Rename-Item ./responses/batch_batch_manifest.json batch_batch_rbse_hindi_manifest.json
> # then run phase 4C ...
> Rename-Item ./responses/batch_batch_manifest.json batch_batch_cbse_english_manifest.json
> ```

---

## Aira Execution Checklist (for future AI sessions)

When Aira is asked to execute this workflow:

1. ✅ Run `npm run api-login` first
2. ✅ Execute Step 1 → extract `branch_id` values from response
3. ✅ Execute Step 2 → extract all `course_id` values from response
4. ✅ Patch `teachers_list.json` with real `branch_id` → execute Step 3
5. ✅ Generate batch payload files using `course_id` + `branch_id` from prior steps
6. ✅ Execute Phase 4A (RBSE English Medium)
7. 🛑 **ASK user** before Phase 4B (RBSE Hindi Medium)
8. ✅ Execute Phase 4B after confirmation
9. 🛑 **ASK user** before Phase 4C (CBSE English Medium)
10. ✅ Execute Phase 4C after confirmation
11. ✅ Rename telemetry files after each phase to prevent overwrites

> [!CAUTION]
> **NEVER** execute an `api-batch-insert` if any required foreign key (`branch_id`, `course_id`) is a placeholder or unresolved. The server will reject the record and it will count as a failure in the telemetry manifest.
