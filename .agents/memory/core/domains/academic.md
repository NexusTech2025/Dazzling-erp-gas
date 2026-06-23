Created At: 2026-05-26T21:20:00Z
Completed At: 2026-05-26T21:20:00Z
File Path: `file:///e:/NAST/Dazzling/GAS/.agents/memory/core/domains/academic.md`

# Domain Actions: Academic, Curriculum & Enrollment

This handbook documents the lifecycle, contracts, and codebase integrations for the Academic domain inside **DazzlingDB**.

---

# Action Post: `academic_create_course_type` — Segment Provisioning

The curriculum begins with course types (or segmentations, e.g. Academic, Vocational). These define the boundaries of the subjects and batches offered.

## 1. Request / Response Lifecycle

```
[Incoming POST Request]
         │
         ▼
[ApiDispatcher.js]  ──► Route action key `"academic_create_course_type"`
         │
         ▼
[AcademicService.js] ──► Create Course Type:
         │
         └──► db.CourseType.insert(payload)
```

## 2. API Contract & Constraints

*   **`segment_name`**: Required, String. Unique name of the curriculum segment.

## 3. Payload Reference

#### Request Example
```json
{
  "action": "academic_create_course_type",
  "token": "DEV_SUPER_TOKEN_VALUE",
  "payload": {
    "segment_name": "Academic"
  }
}
```

#### Response Example
```json
{
  "success": true,
  "action": "academiccreatecoursetype",
  "data": {
    "segment_id": "TYP-82F3D9",
    "segment_name": "Academic"
  }
}
```

---

# Action Post: `academic_create_course` — Course & Subject Definitions

Courses reside inside a specific segment. Before a Course can be provisioned, its parent `CourseType` must exist.

## 1. Request / Response Lifecycle

```
[Incoming POST Request]
         │
         ▼
[AcademicService.js] ──► Orchestrate course creation:
         │
         ├──► 1. Pre-flight check: payload.segment_id validation
         │
         ├──► 2. Integrity check: db.CourseType.findById(segment_id)
         │       └── Throws EntityNotFoundError if segment is missing
         │
         └──► 3. Insert Course: db.Course.insert(payload)
```

## 2. API Contract & Constraints

*   **`segment_id`**: Required, String. Must exist in the `CourseType` sheet.
*   **`name`**: Required, String. Name of the course.

## 3. Payload Reference

#### Request Example
```json
{
  "action": "academic_create_course",
  "payload": {
    "segment_id": "TYP-82F3D9",
    "name": "Grade 10 Mathematics",
    "code": "MATH10"
  }
}
```

#### Response Example
```json
{
  "success": true,
  "action": "academiccreatecourse",
  "data": {
    "course_id": "CRS-9A8D7C",
    "segment_id": "TYP-82F3D9",
    "name": "Grade 10 Mathematics",
    "code": "MATH10"
  }
}
```

---

# Action Post: `academic_create_batch` — Class Scheduling & Multi-Point Health Checks

A Batch is a running instance of a Course scheduled at a Branch with a assigned Teacher. To maintain referential integrity, creating a batch triggers cross-domain checks against the Academic (Course) and Staff (Teacher, Branch) sheets.

## 1. Request / Response Lifecycle

```
[Incoming POST Request]
         │
         ▼
[AcademicService.js] ──► Orchestrate Batch Provisioning:
         │
         ├──► 1. Integrity check: db.Course.findById(course_id)
         │
         ├──► 2. Cross-domain check: db.Teacher.findById(teacher_id) [Staff Domain]
         │
         ├──► 3. Cross-domain check: db.Branch.findById(branch_id) [Core/Staff Domain]
         │
         └──► 4. Insert Batch: db.Batch.insert(payload) (With defaults)
```

## 2. API Contract & Constraints

*   **`course_id`**: Required, String. Must refer to a valid Course.
*   **`teacher_id`**: Optional, String. If provided, must refer to a valid Teacher.
*   **`branch_id`**: Optional, String. If provided, must refer to a valid Branch.
*   **`status`**: Optional, String. Defaults to `"active"`.
*   **`capacity`**: Optional, Number. Defaults to `30`.

## 3. Payload Reference

#### Request Example
```json
{
  "action": "academic_create_batch",
  "payload": {
    "batch_name": "Math Grade 10 - Batch A",
    "course_id": "CRS-9A8D7C",
    "teacher_id": "TCH-FE51B99E",
    "branch_id": "BRN-3GVP91T",
    "capacity": 25
  }
}
```

#### Response Example
```json
{
  "success": true,
  "action": "academiccreatebatch",
  "data": {
    "batch_id": "BCH-6F5E4D",
    "batch_name": "Math Grade 10 - Batch A",
    "course_id": "CRS-9A8D7C",
    "teacher_id": "TCH-FE51B99E",
    "branch_id": "BRN-3GVP91T",
    "status": "active",
    "capacity": 25
  }
}
```

---

# Action Post: `academic_create_package` — Bulk Package Orchestration

A Package encapsulates multiple courses, discounts, or bundles. It uses SheetDB's nested relational persistence engines to insert bulk hierarchies.

## 1. Request / Response Lifecycle

```
[Incoming POST Request]
         │
         ▼
[AcademicService.js] ──► Create Package:
         │
         └──► db.Package.insertOne(payload)
                 └── Throws PackageOrchestrationError on failure
```

## 2. API Contract & Constraints

*   **`name`**: Required, String. Package name.
*   **`price`**: Required, Number. Cost of the package.
*   **`courses`**: Optional, Array of Strings. Course IDs associated with the package.

## 3. Payload Reference

#### Request Example
```json
{
  "action": "academic_create_package",
  "payload": {
    "name": "Science & Math Combo",
    "price": 12000,
    "courses": [
      "CRS-9A8D7C",
      "CRS-2DEB0E44"
    ]
  }
}
```

---

# Action Post: `academic_enroll_student` — Student Batch Enrollment

Enrollment registers a Student into a particular Course/Batch.

## 1. Request / Response Lifecycle

```
[Incoming POST Request]
         │
         ▼
[AcademicService.js] ──► Enroll Student:
         │
         ├──► 1. Integrity check: db.Student.findById(student_id)
         │
         └──► 2. Insert Enrollment: db.Enrollment.insert(payload)
```

## 2. API Contract & Constraints

*   **`student_id`**: Required, String. Must exist in `Student`.
*   **`course_id` / `batch_id`**: Required, String. Target course or batch.
*   **`enrollment_date`**: Optional, Date. Defaults to the current date/time.
*   **`status`**: Optional, String. Defaults to `"active"`.

## 3. Payload Reference

#### Request Example
```json
{
  "action": "academic_enroll_student",
  "payload": {
    "student_id": "STU-A1B2C3",
    "course_id": "CRS-9A8D7C"
  }
}
```
