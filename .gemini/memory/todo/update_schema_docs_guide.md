# TODO: Update Schema Architecture Documentation & Guide

This document tracks the tasks required to update the database schema architecture documentation, table definition guides, and constraint rules to align with the modular JSON schema structure in DazzlingDB.

---

## **Architectural Goal**
Update the guides, rules, and architecture documents to reflect the modular schema configuration files under `DazzlingDB/Config/Schema/<Category>/<Table>.json`, detail constraints like `onDelete` policies (`protect`, `cascade`, `set_null`), and document compilation via `dazzlingdb-tools`.

---

## **Refactoring Checklist**

### **1. Update Add Table Guide**
- [ ] Refactor [add_table_guide.md](e:/NAST/Dazzling/GAS/docs/schema/v2/add_table_guide.md) to replace references to `full_schemav3.json` with the new modular format:
  - Document creating individual JSON files under `DazzlingDB/Config/Schema/<Category>/<Table>.json`.
  - Explain how fields like system audit fields (`__tx_id`, `__tx_status`, `__created_at`) are automatically compiled or structured.
  - Describe running the schema compilation command `npm run compile-graph:prod` in `dazzlingdb-tools/` to generate `database_schema.js` and `dependency_graph.js`.

### **2. Document Relational Integrity & Delete Constraints**
- [ ] Add explicit sections to the guide detailing relational integrity constraints:
  - Explain the `onDelete` property for `foreign_key` fields.
  - Document supported policies: `protect`, `cascade`, and `set_null`.
  - Provide concrete examples (e.g., how changing [PackagePerk.json](e:/NAST/Dazzling/GAS/DazzlingDB/Config/Schema/Academic/PackagePerk.json) to `cascade` or [PackageItem.json](e:/NAST/Dazzling/GAS/DazzlingDB/Config/Schema/Academic/PackageItem.json) to `set_null` behaves).

### **3. Document Polymorphic Relations**
- [ ] Detail how to define and use polymorphic relations (e.g., `belongsToPolymorphic` structure using `typeField`, `idField`, and the `mapping` registry object).

### **4. Align Global Rules & Tools**
- [ ] Ensure that configuration and linting rules in `.agents/` reflect modular JSON schemas and strict schema verification practices.
