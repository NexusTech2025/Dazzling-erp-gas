Created At: 2026-05-26T21:21:00Z
Completed At: 2026-05-26T21:21:00Z
File Path: `file:///e:/NAST/Dazzling/GAS/.agents/memory/core/domains/core.md`

# Domain Actions: Core & Foundation

This handbook documents the lifecycle, contracts, and codebase integrations for the Core and Organizational Foundation domain in **DazzlingDB** (Branches, Promos, and Configuration).

---

# Action Post: `core_create_branch` — Physical Location Provisioning

This endpoint registers new physical branch locations of the institution.

## 1. Request / Response Lifecycle

```
[Incoming POST Request]
         │
         ▼
[CoreService.js] ──► Provision physical branch:
         │
         ├──► 1. Merge status default: active
         │
         └──► 2. Insert Branch: db.Branch.insert(payload)
                 └── Throws IntegrityError on insert failures
```

## 2. API Contract & Constraints

*   **`branch_name`**: Required, String. Distinct name of the physical branch.
*   **`location`**: Optional, String. Address details.
*   **`status`**: Optional, String. Allowed: `active`, `inactive`. Defaults to `active`.

## 3. Payload Reference

#### Request Example
```json
{
  "action": "core_create_branch",
  "payload": {
    "branch_name": "South Campus",
    "location": "New Delhi, India"
  }
}
```

#### Response Example
```json
{
  "success": true,
  "action": "corecreatebranch",
  "data": {
    "branch_id": "BRN-5A9E2B",
    "branch_name": "South Campus",
    "location": "New Delhi, India",
    "status": "active"
  }
}
```

---

# Action Post: `core_update_branch` — Branch Modification

Modifies attributes of an existing branch.

## 1. Request / Response Lifecycle

```
[Incoming POST Request]
         │
         ▼
[CoreService.js] ──► Update branch:
         │
         ├──► 1. Integrity check: db.Branch.findById(branch_id)
         │       └── Throws EntityNotFoundError if branch doesn't exist
         │
         └──► 2. Update Branch: db.Branch.update(branch_id, payload)
```

## 2. API Contract & Constraints

*   **`branch_id`** (URL or Route Parameter): Required, String. Target branch.
*   **`payload`**: Object containing attributes to update.

---

# Action Post: `core_create_promo_code` — Discount Campaigns

Creates a promotional code that can apply globally or bind strictly to a particular `Course` or `Package`.

## 1. Request / Response Lifecycle

```
[Incoming POST Request]
         │
         ▼
[CoreService.js] ──► Create Promo Code:
         │
         ├──► 1. Proactive Conflict check: db.PromoCode.exists({ code })
         │       └── Throws ConflictError if duplicate code found
         │
         ├──► 2. Relational Integrity check:
         │       ├── If entity_id is provided:
         │       └── Verify existence in db.Course or db.Package
         │           └── Throws IntegrityError on missing target entity
         │
         └──► 3. Insert Promo Code: db.PromoCode.insert(payload)
```

## 2. API Contract & Constraints

*   **`code`**: Required, String. Code must be unique.
*   **`discount_type`**: Required, String. E.g., `percentage`, `fixed`.
*   **`discount_value`**: Required, Number.
*   **`entity_type`**: Optional, String. Target table: `course` or `package`.
*   **`entity_id`**: Optional, String. Must exist in the table defined by `entity_type`.
*   **`status`**: Optional, String. Defaults to `active`.
*   **`max_usage`**: Optional, Number. Defaults to `100`.

## 3. Payload Reference

#### Request Example
```json
{
  "action": "core_create_promo_code",
  "payload": {
    "code": "SUMMER50",
    "discount_type": "percentage",
    "discount_value": 50,
    "entity_type": "course",
    "entity_id": "CRS-9A8D7C",
    "valid_until": "2026-08-31"
  }
}
```

---

# Action Post: `core_validate_promo_code` — Promo Application Validation

Validates promo codes for cart checkouts.

## 1. Request / Response Lifecycle

```
[Incoming POST Request]
         │
         ▼
[CoreService.js] ──► Validate Promo Code:
         │
         ├──► 1. Retrieve: db.PromoCode.findOne({ code, status: "active" })
         │       └── Throws EntityNotFoundError if not found/active
         │
         ├──► 2. Entity binding check:
         │       └── Verify promo.entity_id matches incoming entityId
         │           └── Throws ValidationError if mismatched
         │
         └──► 3. Expiration check:
                 └── Verify current date is before promo.valid_until
                     └── Throws ValidationError if expired
```
