# TODO: Update Package, PackageItem, and PackagePerk Schema Constraints

This document tracks updates to the delete constraints on `Package`, `PackageItem`, and `PackagePerk` to align with a low-friction, seamless user experience.

---

## **Architectural Goal**
Prevent hard blocking errors when users perform delete operations on Packages or related entities (e.g. Course/Subject), ensuring the database cleans up child relations cleanly using cascading delete rules rather than blocking the operation with `protect` rules.

---

## **Proposed Constraint Updates**

### **1. PackagePerk Schema (`PackagePerk.json`)**
- [ ] Ensure `package_id` foreign key is configured with `"onDelete": "cascade"`.
  - **Rationale:** If a `Package` is deleted, all its associated perk items (titles, icons, descriptions) should be automatically cleaned up rather than blocking the package deletion.

### **2. PackageItem Schema (`PackageItem.json`)**
- [ ] Update `package_id` foreign key `onDelete` constraint from `"protect"` to `"cascade"`.
  - **Rationale:** When deleting a `Package`, the associated `PackageItem` linkages are no longer useful and must be cascade deleted.
- [ ] Evaluate `entity_id` foreign key `onDelete` constraint:
  - If a referenced `Course` or `Subject` is deleted, we should cascade-delete the `PackageItem` from any packages, rather than setting it to null (since `required: true` is set on `entity_id` and setting it to `null` violates schema requirements). Change `entity_id` onDelete to `"cascade"` or update `required` to `false`.

### **3. Verification & Compilation**
- [ ] Verify both JSON schema configuration files are valid.
- [ ] Run `npm run compile-graph:prod` inside `dazzlingdb-tools/` to compile the updated constraints into the runtime config.
