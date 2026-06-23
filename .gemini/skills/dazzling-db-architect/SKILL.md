---
name: dazzling-db-architect
description: Provides core architectural conceptual knowledge, active record CRUD abstractions, database transactions, validation engine structures, and individual action API blog handbooks for DazzlingDB. Use when working with DazzlingDB code modifications, writing new endpoints, or designing transactional pipelines.
---

# DazzlingDB Architect Handguide

This skill equips Gemini CLI with the deep structural design patterns, validation pipelines, and transaction safeguards governing the **DazzlingDB** system. 

When executing development tasks in DazzlingDB, you MUST strictly follow these procedural rules.

---

## 1. Procedural Execution Guidelines

### Rule 1: Observe Architectural Layer Decoupling
Do not blur the lines between routing, transaction orchestration, and active persistence. Maintain the strict hierarchy:
1.  **API Dispatcher** (`ApiDispatcher.js`): Maps JSON keys directly to Action classes.
2.  **Action Controllers** (`DBServices/ConcreteActions.js`): Inherits from `BaseAction`. Validates raw parameter existence and executes the domain service.
3.  **Domain Services** (`DBServices/StaffService.js`, etc.): Orchestrates transaction loops, checks pre-flight parameters, runs validations, and modifies relational models.
4.  **Database Persistence** (`SheetDB ORM`): CRUD operations and low-level data persistence.

### Rule 2: Enforce Pre-flight Validation Pipelines
For all complex updates and inserts, execute declarative validation rules using `ValidationEngine.run(context, rules)` before writing any model updates to database tables. Always strip relation arrays/configs from the payload before applying active updates on the core model to avoid column structure pollution.

### Rule 3: Implement Stack-Based Transaction Rollbacks
If a domain service performs writes to multiple tables, you MUST utilize a local rollback array to track successful insertions. In the event of a downstream exception, reverse-iterate through the array and remove staged records:
```javascript
const insertedRecords = [];
try {
  const primary = db.Entity.insert(data);
  insertedRecords.push({ table: "Entity", id: primary.id });
  
  const related = db.Related.insert({ entity_id: primary.id });
  insertedRecords.push({ table: "Related", id: related.id });
} catch (err) {
  for (let i = insertedRecords.length - 1; i >= 0; i--) {
    db[insertedRecords[i].table].remove(insertedRecords[i].id);
  }
  throw err;
}
```

---

## 2. Decoupled Workspace Memory References

To prevent skill bloating and ensure the agent stays perfectly in sync with the codebase as it evolves, all architecture diagrams, constraints, schemas, and action blog handbooks are stored directly inside the workspace repository memory. You MUST load these references into context whenever modifying the core database or writing API endpoints:

*   **Architecture Blueprint**: Core database tiers, ORM active records, validation loops, and map synchronization mechanics.
    *   Read: [architecture.md](file:///E:/NAST/Dazzling/GAS/.agents/memory/core/architecture.md)
*   **Staff & HR API Blog Handbook**: Complete technical walkthrough, JSON payloads, request/response lifecycles, and code snippets for `staff_update_teacher` and `staff_onboard_teacher`.
    *   Read: [staff.md](file:///E:/NAST/Dazzling/GAS/docs/knowledge/domains/staff.md)
*   **Academic & Curriculum API Blog Handbook**: Lifecycle and contract mappings for course creation, class scheduling, bulk packaging, and enrollment actions.
    *   Read: [academic.md](file:///E:/NAST/Dazzling/GAS/.agents/memory/core/domains/academic.md)
*   **Core & Foundation API Blog Handbook**: Lifecycle and contracts for branch provisioning and promo code applications.
    *   Read: [core.md](file:///E:/NAST/Dazzling/GAS/.agents/memory/core/domains/core.md)
*   **Students & Leads API Blog Handbook**: Specifications for nested relational registrations, hydrated profile retrievals, and prospect lead capture.
    *   Read: [student.md](file:///E:/NAST/Dazzling/GAS/.agents/memory/core/domains/student.md)
