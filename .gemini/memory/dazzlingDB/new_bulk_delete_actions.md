# DazzlingDB API Reference - Non-Disruptive Bulk Deletion Actions

This document guides frontend developers on how to consume the new bulk deletion actions for the Curriculum and Catalog domains. These endpoints support the **Non-Disruptive Bulk Deletion Manifests (with Relational Violation Isolation)** pattern, allowing safe, non-crashing dry-runs that identify relational constraints before physical execution.

---

## 🏛️ General Protocol

* **Endpoint:** `POST https://script.google.com/macros/s/[DEPLOYMENT_ID]/exec`
* **Content-Type:** `application/json`
* **Authorization:** Standard `token` passed in the root payload.
* **Aggregated Results Policy**: The actions do not fail completely if some target rows are blocked during dry-runs. Instead, they isolate failures into a manifest. During a live delete, the action will execute in a transaction; if any records are blocked, it aborts the execution and returns a structured validation error containing all violating rows.

---

## 🛠️ Bulk Delete Action Endpoints

### 1. `academic_delete_many_course_types`
* **Target Domain**: Catalog / Course Types (Segments)
* **Payload Parameter**: `ids` (Array of `CourseType.segment_id` strings)
* **OnDelete Policy**: RESTRICT/PROTECT. Will be blocked if any active `Course` records point to target segments.

### 2. `academic_delete_many_courses`
* **Target Domain**: Catalog / Courses (Subjects)
* **Payload Parameter**: `ids` (Array of `Course.course_id` strings)
* **OnDelete Policy**: RESTRICT/PROTECT. Will be blocked if any active `Batch` records reference target courses.

### 3. `academic_delete_many_packages`
* **Target Domain**: Academic / Packages
* **Payload Parameter**: `ids` (Array of `Package.package_id` strings)
* **OnDelete Policy**:
  * **RESTRICT/PROTECT**: Will block if student `Enrollment` records reference the target package.
  * **CASCADE**: Will automatically delete linked `PackagePerk` and `PackageItem` records when a package is successfully deleted.

---

## 📡 JSON Payload Examples

### A. Dry-Run Verification (Manifest Isolation)
To check which records can be safely deleted without applying changes, pass `"dryRun": true` (default).

#### Request Envelope:
```json
{
  "action": "academic_delete_many_courses",
  "token": "USR_SESSION_TOKEN_XYZ",
  "payload": {
    "ids": ["CRS-D4C97383", "CRS-CLEAN999"],
    "dryRun": true
  }
}
```

#### Response Envelope (Success):
```json
{
  "success": true,
  "action": "academic_delete_many_courses",
  "data": {
    "success": true,
    "dryRun": true,
    "deletedCount": 0,
    "manifest": {
      "deleted": ["CRS-CLEAN999"],
      "skipped": [],
      "failed": {
        "CRS-D4C97383": {
          "message": "Relation integrity check blocked deletion of Course 'CRS-D4C97383'.",
          "violations": [
            {
              "table": "Batch",
              "foreignKey": "course_id",
              "ids": ["BAT-A582ED86"]
            }
          ]
        }
      }
    }
  }
}
```

* **Frontend Action**: Use `manifest.failed` to render warning indicators next to blocked rows in your data table, showing exactly which batches are blocking the deletion.

---

### B. Live Delete Execution (Transactions)
To execute the physical deletion, pass `"dryRun": false`.

#### Request Envelope:
```json
{
  "action": "academic_delete_many_courses",
  "token": "USR_SESSION_TOKEN_XYZ",
  "payload": {
    "ids": ["CRS-CLEAN999"],
    "dryRun": false
  }
}
```

#### Response Envelope (Success):
```json
{
  "success": true,
  "action": "academic_delete_many_courses",
  "data": {
    "success": true,
    "dryRun": false,
    "deletedCount": 1,
    "manifest": {
      "deleted": ["CRS-CLEAN999"],
      "skipped": [],
      "failed": {}
    }
  }
}
```

---

### C. Live Delete Blocked (ValidationError Envelope)
If you attempt a live delete (`dryRun: false`) on a blocked record, the server returns an API failure envelope.

#### Request Envelope:
```json
{
  "action": "academic_delete_many_courses",
  "token": "USR_SESSION_TOKEN_XYZ",
  "payload": {
    "ids": ["CRS-D4C97383"],
    "dryRun": false
  }
}
```

#### Response Envelope (Failure):
```json
{
  "success": false,
  "error": {
    "code": "ACTION_VALIDATION_FAILURE",
    "message": "Batch Delete Failed (Aggregated): Some deletions are blocked.",
    "details": {
      "violations": [
        {
          "table": "Batch",
          "foreignKey": "course_id",
          "ids": ["BAT-A582ED86"]
        }
      ]
    }
  }
}
```

---

## ⚛️ React Integration Example

Here is a clean utility pattern to handle dry-runs and structured warning dialogs prior to deleting catalog courses:

```javascript
import React, { useState } from 'react';

export function CourseListTable({ courses, onRefresh }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [manifest, setManifest] = useState(null);
  const [showWarningModal, setShowWarningModal] = useState(false);

  // Phase 1: Dry-Run relational inspection
  const handleInspectDelete = async () => {
    try {
      const response = await fetch("https://script.google.com/macros/s/.../exec", {
        method: "POST",
        body: JSON.stringify({
          action: "academic_delete_many_courses",
          token: localStorage.getItem("token"),
          payload: { ids: selectedIds, dryRun: true }
        })
      });
      const result = await response.json();
      
      if (result.success) {
        const { manifest } = result.data;
        setManifest(manifest);
        
        // Show warnings if any items are blocked
        if (Object.keys(manifest.failed).length > 0) {
          setShowWarningModal(true);
        } else {
          // If no blocks, proceed to live delete directly
          await handleConfirmLiveDelete(selectedIds);
        }
      }
    } catch (err) {
      console.error("Inspecting delete manifest failed:", err);
    }
  };

  // Phase 2: Live deletion of clean IDs
  const handleConfirmLiveDelete = async (idsToDelete) => {
    try {
      const response = await fetch("https://script.google.com/macros/s/.../exec", {
        method: "POST",
        body: JSON.stringify({
          action: "academic_delete_many_courses",
          token: localStorage.getItem("token"),
          payload: { ids: idsToDelete, dryRun: false }
        })
      });
      const result = await response.json();
      
      if (result.success) {
        alert(`Successfully deleted ${result.data.deletedCount} courses.`);
        setSelectedIds([]);
        setShowWarningModal(false);
        onRefresh();
      } else {
        alert(`Deletion blocked: ${result.error.message}`);
      }
    } catch (err) {
      console.error("Live delete transaction failed:", err);
    }
  };

  return (
    <div>
      {/* Table rows & checkboxes selection logic */}
      <button onClick={handleInspectDelete} disabled={selectedIds.length === 0}>
        Bulk Delete ({selectedIds.length})
      </button>

      {showWarningModal && manifest && (
        <div className="modal">
          <h3>Warning: Relational Violations Found</h3>
          <p>The following courses cannot be deleted because they have active classes:</p>
          <ul>
            {Object.keys(manifest.failed).map(id => (
              <li key={id}>
                <strong>Course ID {id}</strong>: Blocked by active batches:{" "}
                {manifest.failed[id].violations.flatMap(v => v.ids).join(", ")}
              </li>
            ))}
          </ul>
          
          <p>Would you like to delete the remaining clean courses ({manifest.deleted.length})?</p>
          <button onClick={() => handleConfirmLiveDelete(manifest.deleted)}>
            Yes, Delete Clean Courses
          </button>
          <button onClick={() => setShowWarningModal(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
```
