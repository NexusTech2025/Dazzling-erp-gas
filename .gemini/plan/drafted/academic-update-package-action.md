---
Date: 2026-06-02T15:43:00+05:30
Status: Approved
---

# Plan: Implement Specialized `academic_update_package` Action with Polymorphic Support

This plan outlines the design, architecture, and coding steps required to introduce the specialized `"academic_update_package"` endpoint in the **DazzlingDB** backend. It incorporates a **polymorphic entity mapping strategy** enabling packages to wrap both courses and subjects, and details safe manual transaction orchestration inside `AcademicService.js`.

---

## 1. Schema Analysis & Polymorphic Mappings

From reading the decoupled schemas under `Config/Schema/Academic/`:
* **Core Entity:** `Package.json` (Primary Key: `package_id`)
* **Child Courses/Subjects:** `PackageItem.json` (Primary Key: `item_id`, Foreign Key: `package_id`)
  * Maps dynamically to either `Course` or `Subject` via the polymorphic fields `"entity_type"` and `"entity_id"`.
* **Child Perks:** `PackagePerk.json` (Primary Key: `perk_id`, Foreign Key: `package_id`).

Because of the polymorphic nature of `PackageItem`, a simple flat array of IDs is insufficient. The API payload and domain service must be designed to explicitly declare the `entity_type` and `entity_id` for each item inside the package bundle.

---

## 2. API Contract Design

### Action Keys: `"academic_create_package"` & `"academic_update_package"`

#### Polymorphic Request Payload Specification
```json
{
  "action": "academic_update_package",
  "token": "USER_AUTH_TOKEN",
  "payload": {
    "package_id": "PKG-XXXXXX",
    "name": "Science & Math Combo - V2",
    "description": "Updated polymorphic combo package",
    "package_fee": 12500,
    "discount_percent": 10,
    "status": "active",
    "courses": [
      {
        "entity_type": "course",
        "entity_id": "CRS-9A8D7C"
      },
      {
        "entity_type": "subject",
        "entity_id": "SUB-2DEB0E44"
      }
    ],
    "perks": [
      {
        "perk_title": "Weekly Practice Material",
        "perk_description": "Standard digital workbooks",
        "icon": "book-open",
        "display_order": 1
      },
      {
        "perk_title": "Mock Examination Series",
        "perk_description": "Monthly simulated tests",
        "icon": "clipboard-list",
        "display_order": 2
      }
    ]
  }
}
```

---

## 3. Implementation Workflow

### Step 1: Register Action in `ApiDispatcher.js`
Register the action `"academic_update_package"` mapping to `UpdatePackageAction` in `_getStandardRegistry()`:
```javascript
"academic_update_package": UpdatePackageAction
```

### Step 2: Implement `UpdatePackageAction` in `DBServices/ConcreteActions.js`
Define the validation and execution blocks inside `ConcreteActions.js`:
```javascript
class UpdatePackageAction extends BaseAction {
  _validate() {
    this._requireParam("payload");
    const p = this._params.payload;
    if (!p.package_id) {
      throw new ActionValidationError("Payload must contain 'package_id'.");
    }
  }

  _execute() {
    return AcademicService.updatePackage(this._params.payload);
  }
}
```

### Step 3: Refactor Creation & Update Services in `DBServices/AcademicService.js`
To ensure maximum robustness and maintain clean layer decoupling, we delegate all column-level checks (such as required fields, choice enums, and lengths) entirely to the **SheetDB ORM layer** and schema constraints. 

The service layer focuses strictly on the **relational transaction pipeline** (backing up records, syncing, managing rollbacks) and performing **defensive polymorphic normalization** (casing/trimming) on incoming payloads so they successfully match the database schema constraints.

#### A. Refactored `createPackage(payload)`
```javascript
  createPackage(payload) {
    const db = DBContext.getInstance();
    console.log(`[AcademicService] Orchestrating Bulk Package: ${payload.name}`);

    // 1. Insert Core Package
    const coreFields = ["name", "description", "target_class", "board", "month", "package_fee", "discount_percent", "status"];
    const packageData = {};
    coreFields.forEach(f => {
      if (payload[f] !== undefined) packageData[f] = payload[f];
    });
    
    const newPackage = db.Package.insert(packageData);
    const packageId = newPackage.package_id;
    const insertedRecords = [{ table: "Package", id: packageId }];

    try {
      // 2. Insert Perks (Let SheetDB validate required/default columns)
      if (payload.perks && Array.isArray(payload.perks)) {
        payload.perks.forEach((perk, index) => {
          const newPerk = db.PackagePerk.insert({
            package_id: packageId,
            perk_title: perk.perk_title,
            perk_description: perk.perk_description || "",
            icon: perk.icon || "star",
            display_order: perk.display_order || (index + 1)
          });
          insertedRecords.push({ table: "PackagePerk", id: newPerk.perk_id });
        });
      }

      // 3. Insert Polymorphic Courses/Subjects (Trimming & Casing Normalization ONLY)
      if (payload.courses && Array.isArray(payload.courses)) {
        payload.courses.forEach(item => {
          const normalizedType = typeof item.entity_type === "string"
            ? item.entity_type.toLowerCase().trim()
            : item.entity_type;

          const newItem = db.PackageItem.insert({
            package_id: packageId,
            entity_type: normalizedType,
            entity_id: item.entity_id
          });
          insertedRecords.push({ table: "PackageItem", id: newItem.item_id });
        });
      }

      return newPackage;

    } catch (error) {
      // 🚨 Rollback transaction on creation failure
      console.error(`[AcademicService] Bulk creation failed, rolling back: ${error.message}`);
      for (let i = insertedRecords.length - 1; i >= 0; i--) {
        db[insertedRecords[i].table].remove(insertedRecords[i].id);
      }
      throw error;
    }
  }
```

#### B. Newly Implemented `updatePackage(payload)`
```javascript
  updatePackage(payload) {
    const db = DBContext.getInstance();
    const packageId = payload.package_id;
    console.log(`[AcademicService] Updating Package: ${packageId}`);

    const existingPackage = db.Package.findById(packageId);
    if (!existingPackage) throw new Error(`Package with ID '${packageId}' not found.`);

    // Backups for Transaction safety
    const backupPackageState = { ...existingPackage };
    let backupItems = [];
    let backupPerks = [];
    
    try {
      // A. Update Core Package Attributes (SheetDB automatically validates columns)
      const coreFields = ["name", "description", "target_class", "board", "month", "package_fee", "discount_percent", "status"];
      const updateData = {};
      coreFields.forEach(f => {
        if (payload[f] !== undefined) updateData[f] = payload[f];
      });
      db.Package.update(packageId, updateData);

      // B. Update Polymorphic Courses (PackageItem Sync via clean rewrite & normalization)
      if (payload.courses !== undefined) {
        backupItems = db.PackageItem.find({ package_id: packageId });
        backupItems.forEach(item => db.PackageItem.remove(item.item_id));

        payload.courses.forEach(item => {
          // Normalize only: let SheetDB validate required/choices constraints
          const normalizedType = typeof item.entity_type === "string"
            ? item.entity_type.toLowerCase().trim()
            : item.entity_type;

          db.PackageItem.insert({
            package_id: packageId,
            entity_type: normalizedType,
            entity_id: item.entity_id
          });
        });
      }

      // C. Update Package Perks (PackagePerk Sync via clean rewrite)
      if (payload.perks !== undefined) {
        backupPerks = db.PackagePerk.find({ package_id: packageId });
        backupPerks.forEach(perk => db.PackagePerk.remove(perk.perk_id));

        payload.perks.forEach((perk, index) => {
          db.PackagePerk.insert({
            package_id: packageId,
            perk_title: perk.perk_title,
            perk_description: perk.perk_description || "",
            icon: perk.icon || "star",
            display_order: perk.display_order || (index + 1)
          });
        });
      }

      return { success: true, message: `Package '${packageId}' successfully updated.` };

    } catch (error) {
      // 🚨 Rollback transaction on update failure
      db.Package.update(packageId, backupPackageState);

      if (payload.courses !== undefined) {
        const partialItems = db.PackageItem.find({ package_id: packageId });
        partialItems.forEach(item => db.PackageItem.remove(item.item_id));
        backupItems.forEach(item => db.PackageItem.insert(item));
      }

      if (payload.perks !== undefined) {
        const partialPerks = db.PackagePerk.find({ package_id: packageId });
        partialPerks.forEach(perk => db.PackagePerk.remove(perk.perk_id));
        backupPerks.forEach(perk => db.PackagePerk.insert(perk));
      }

      throw error;
    }
  }
```

---

## 4. Verification and Testing Design
1. **Validation Checks:** Write unit diagnostics in `Test/` verifying that:
   - Modifying only core parameters (e.g. `package_fee`) preserves child courses and perks.
   - Supplying a new array of polymorphic courses/subjects correctly syncs the mappings.
   - Downstream exceptions successfully trigger full rollbacks across all tables.
