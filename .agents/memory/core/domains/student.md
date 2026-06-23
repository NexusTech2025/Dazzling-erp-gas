Created At: 2026-05-26T21:22:00Z
Completed At: 2026-05-26T21:22:00Z
File Path: `file:///e:/NAST/Dazzling/GAS/.agents/memory/core/domains/student.md`

# Domain Actions: Students & Leads

This handbook documents the lifecycle, contracts, and codebase integrations for the Student management and Lead capture domain in **DazzlingDB**.

---

# Action Post: `student_register_student` — Nested Relational Registration

Registering a student is an orchestration that links personal profile, contact info, and address sheets. Using SheetDB's nested relational persistence `db.Student.insertOne()`, we insert a deeply nested object while maintaining relational integrity.

## 1. Request / Response Lifecycle

```
[Incoming POST Request]
         │
         ▼
[StudentService.js] ──► Orchestrate student registration:
         │
         ├──► 1. ID Generation:
         │       ├── Generate student_id (Prefix: STU)
         │       ├── Generate address_id (Prefix: ADDR)
         │       └── Generate contact_id (Prefix: CONT)
         │
         ├──► 2. Build Nested Payload Structure:
         │       ├── Merge student_id, address_id, contact_id
         │       └── Attach nested address and contact objects
         │
         └──► 3. Bulk Insert: db.Student.insertOne(nestedPayload)
                 └── Automatically persists across Student, Address, & ContactInfo
```

## 2. API Contract & Constraints

*   **`profile.student_name`**: Required, String.
*   **`profile.status`**: Optional, String. Defaults to `active`.
*   **`address`**: Required, Object. Address details.
*   **`contact`**: Required, Object. Contact details.

## 3. Payload Reference

#### Request Example
```json
{
  "action": "student_register_student",
  "payload": {
    "profile": {
      "student_name": "Moni Kumar",
      "date_of_birth": "2005-04-12"
    },
    "address": {
      "street": "123 Main Street",
      "city": "Gurugram",
      "postal_code": "122001"
    },
    "contact": {
      "email": "moni.kumar@example.com",
      "phone": "9876543210"
    }
  }
}
```

#### Response Example
```json
{
  "success": true,
  "action": "studentregisterstudent",
  "data": {
    "student_id": "STU-Y2T8Q1",
    "student_name": "Moni Kumar",
    "date_of_birth": "2005-04-12",
    "status": "active",
    "created_at": "2026-05-26T21:22:00.000Z",
    "address": {
      "address_id": "ADDR-L0K7M2",
      "student_id": "STU-Y2T8Q1",
      "street": "123 Main Street",
      "city": "Gurugram",
      "postal_code": "122001"
    },
    "contact": {
      "contact_id": "CONT-N9J4B3",
      "student_id": "STU-Y2T8Q1",
      "address_id": "ADDR-L0K7M2",
      "email": "moni.kumar@example.com",
      "phone": "9876543210"
    }
  }
}
```

---

# Action Post: `student_get_profile` — Hydrated Profile Loading

Loads the student profile with all of their relational dependencies.

## 1. Request / Response Lifecycle

```
[Incoming GET/POST Request]
         │
         ▼
[StudentService.js] ──► Get Profile:
         │
         └──► db.Student.findById(studentId, ['Address', 'ContactInfo', 'Enrollment'])
```

---

# Action Post: `student_add_student_lead` — Lead Capture

Registers a prospect lead before they formally register.

## 1. Request / Response Lifecycle

```
[Incoming POST Request]
         │
         ▼
[StudentService.js] ──► Add Lead:
         │
         ├──► 1. ID Generation: Generate lead_id (Prefix: SLD)
         │
         └──► 2. Insert Lead: db.StudentLead.insertOne(recordPayload)
```
