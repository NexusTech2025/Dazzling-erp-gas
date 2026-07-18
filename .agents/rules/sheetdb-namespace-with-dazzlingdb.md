---
trigger: model_decision
description: This Rule Must be applied only when we update the any `*.js` file within the `DazzlingDB/` directory and where we use any identifier from SheetDB to DazzlingDB.
---

# Framework Governance Directive: Explicit SheetDB Namespace Resolution

## 1. Context & Operational Invariant
Within the Google Apps Script (GAS) runtime container, `DazzlingDB` does not exist as a native multi-module project bundle; instead, it is compiled as an independent script workspace that depends on `SheetDB` attached as an external **Apps Script Script Library**. 

Because GAS runs in a unified global namespace scope per script execution instance, failure to append the explicit library identifier prefix when calling upstream engine elements introduces critical runtime symbol collision risks or unresolvable reference exceptions. 

To enforce absolute compilation compliance and avoid silent global reference truncation, this rule mandates that **every** low-level object, constructor class, parser utility, or interface property exposed by `SheetDB/index.js` must be qualified through the explicit `SheetDB` object handle.

---

## 2. Architectural Blueprint

### Explicit SheetDB Namespace Protocol (Bound Library Prefixing)

### 2.1 Explicit Identifier Qualification Mandate
* **Enforcement**: Any reference made inside the `DazzlingDB` business service workspace (`DazzlingDB/DBServices/`, actions controllers, or test suites) to a symbol originating inside the underlying persistence layer code must be explicitly addressed via its attached namespace token context.
* **Syntax Format**: 
  $$\text{Target Ref} \equiv \texttt{SheetDB.[Identifier]}$$

### 2.2 Compilation Target Scope Whitelist
All low-level modules, fields, engines, and utilities crossing the boundary between the business domain layer and storage driver facade must obey this convention. This includes but is not limited to:
* **Fields & Serialization**: `SheetDB.ForeignKeyField`, `SheetDB.CharField`, `SheetDB.DateTimeField`, `SheetDB.BaseField`.
* **Infrastructure Drivers**: `SheetDB.SchemaResolver`, `SheetDB.SheetDataSource`, `SheetDB.SpreadsheetFileSystem`.
* **Validation & Registry Pools**: `SheetDB.ValidationRegistry`, `SheetDB.PrimaryKeyCache`, `SheetDB.PolymorphicRegistry`.

---

## 3. Structural Code Contrast Profiles

### ❌ Non-Compliant Legacy Code Pattern (Global Collision Risk)
```javascript
// Throws unresolvable reference exceptions or evaluates stale mock structures inside GAS container runtime
const schema = new SchemaResolver(DATABASE_SCHEMA);
const studentIdField = new AutoField({ idPrefix: "STU" });

```

### Hardened Production-Safe Pattern (Explicit Namespace Protocol Compliant)

```javascript
// Deterministically resolves the symbol path directly to the SheetDB distribution library interface bound at runtime
const schema = new SheetDB.SchemaResolver(DATABASE_SCHEMA);
const studentIdField = new SheetDB.AutoField({ idPrefix: "STU" });

```

---

## 4. Trigger & Awareness Conditions

The agent must apply this rule instantly under the following conditions:

* Writing or proposing any service file logic or business actions inside the `DazzlingDB/` scope that directly references foundational ORM types or properties.
* Reviewing code fragments for structural regressions or troubleshooting boundary exceptions passing payload fields across data sheets.

```
[DazzlingDB Runtime Execution Frame]
                 │
                 ▼
     Is Identifier Exposed by SheetDB?
                 │
                 ├──► (Yes) ──► Append Prefix ──► SheetDB.SchemaResolver [PASSED]
                 └──► (No)  ──► Native Domain ──► DynamicRepository.js   [DOM-LOCAL]



```

* **System Trace Anchor**: Generated and registered the `Explicit SheetDB Namespace Protocol` layout configuration under contextual session memory to preserve absolute symbol resolution pathways.

```