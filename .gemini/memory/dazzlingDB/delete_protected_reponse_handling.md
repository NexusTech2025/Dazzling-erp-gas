# Guidelines: Handling Delete Protected Violations & Client Integration

This document outlines the standard protocol for handling referential integrity deletion failures (`protect` constraints) across the SheetDB / DazzlingDB API and client layers. It defines the JSON error envelope contracts and details how the frontend client must parse, map, present interactive resolution options, and synchronize local UI state upon deletion validation failures.

---

## **1. Architectural Overview & Traceability**

* **Reference Schemas:**
  * [Package.json](e:/NAST/Dazzling/GAS/DazzlingDB/Config/Schema/Academic/Package.json)
  * [Enrollment.json](e:/NAST/Dazzling/GAS/DazzlingDB/Config/Schema/Academic/Enrollment.json)
  * [Student.json](e:/NAST/Dazzling/GAS/DazzlingDB/Config/Schema/Students/Student.json)
  * [Payment.json](e:/NAST/Dazzling/GAS/DazzlingDB/Config/Schema/Finance/Payment.json)
* **Reference Core Modules:**
  * [DeletionValidationRegistry.js](e:/NAST/Dazzling/GAS/SheetDB/Graph/DeletionValidationRegistry.js)
  * [DynamicRepository.js](e:/NAST/Dazzling/GAS/SheetDB/Repositories/DynamicRepository.js)
  * [ConcreteActions.js](e:/NAST/Dazzling/GAS/DazzlingDB/DBServices/ConcreteActions.js)
  * [AcademicService.js](e:/NAST/Dazzling/GAS/DazzlingDB/DBServices/AcademicService.js)

---

## **2. The Database Constraint Protocol**

SheetDB enforces referential integrity dynamically at runtime using a compiled schema dependency graph:
* **`cascade`**: Dependent child records are automatically collected and deleted along with the parent.
* **`set_null`**: The foreign key in dependent child records is set to `null` (unless marked as required in the schema).
* **`protect`**: Blocks the deletion of the parent record if any active child records reference it, raising an `IntegrityError`.

---

## **3. Server Response Contracts**

On deletion validation failure, the server returns a structured JSON payload detailing the blocked tables, referencing child record primary keys, and constraint policies.

### **Single Record Deletion Failure**
Thrown when a single entity deletion is blocked. The error details map directly into the `error.details` property of the response:

```json
{
  "success": false,
  "error": {
    "code": "ACTION_VALIDATION_FAILURE",
    "message": "Delete Protected: Cannot delete from 'Student' because active records in 'Payment' refer to it (FK: 'student_fee_id').",
    "details": {
      "parentTable": "Student",
      "parentId": "STU-7HG8F9A",
      "violations": [
        {
          "table": "Payment",
          "foreignKey": "student_fee_id",
          "ids": ["PAY-K3J4H5L"],
          "policy": "protect"
        }
      ]
    }
  },
  "context": {
    "execution_time_ms": 42,
    "active_transaction_id": "NONE",
    "transaction_status": "FAILED"
  },
  "meta": {
    "environment": "DEVELOPMENT",
    "version": "2.2.0",
    "timestamp": "2026-06-21T15:08:42.123Z",
    "correlation_id": "be121762-a75d-4a7a-8f38-cf8a3453ab80"
  }
}
```

### **Batch Record Deletion Failure**
Thrown when multiple records are requested for deletion and one or more are blocked. The failure mapping maps inside the `error.details.failed` directory:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILURE",
    "message": "Batch Delete Failed (Aggregated): Some deletions are blocked.",
    "details": {
      "failed": {
        "STU-001": {
          "message": "Delete Protected: Cannot delete from 'Student' because active records in 'Payment' refer to it.",
          "violations": [
            {
              "table": "Payment",
              "foreignKey": "student_fee_id",
              "ids": ["PAY-K3J4H5L"],
              "policy": "protect"
            }
          ]
        },
        "STU-002": {
          "message": "Delete Protected: Cannot delete from 'Student' because active records in 'Enrollment' refer to it.",
          "violations": [
            {
              "table": "Enrollment",
              "foreignKey": "student_id",
              "ids": ["ENR-9999"],
              "policy": "protect"
            }
          ]
        }
      }
    }
  },
  "context": {
    "execution_time_ms": 115,
    "active_transaction_id": "NONE",
    "transaction_status": "FAILED"
  },
  "meta": {
    "environment": "DEVELOPMENT",
    "version": "2.2.0",
    "timestamp": "2026-06-21T15:10:02.123Z",
    "correlation_id": "be121762-a75d-4a7a-8f38-cf8a3453ab80"
  }
}
```

---

## **4. Client-Side Parsing Logic**

When the client invokes a deletion API action, it must implement defensive checks to parse the response structure.

```javascript
/**
 * Processes deletion API failures and extracts detailed referential blockers.
 * @param {Object} response - The unified JSON API response envelope.
 * @returns {Array<Object>} List of normalized blocker objects for UI rendering.
 */
function parseDeleteBlockers(response) {
  if (response.success) return [];

  const error = response.error || {};
  const details = error.details || {};
  const blockers = [];

  // Case 1: Single Record Delete Failure
  if (details.violations && Array.isArray(details.violations)) {
    details.violations.forEach(v => {
      blockers.push({
        targetId: details.parentId,
        targetTable: details.parentTable,
        blockerTable: v.table,
        foreignKey: v.foreignKey,
        blockerIds: v.ids,
        policy: v.policy,
        message: v.message
      });
    });
  }

  // Case 2: Batch Record Delete Failure
  if (details.failed && typeof details.failed === 'object') {
    Object.keys(details.failed).forEach(id => {
      const failItem = details.failed[id];
      if (failItem.violations && Array.isArray(failItem.violations)) {
        failItem.violations.forEach(v => {
          blockers.push({
            targetId: id,
            targetTable: details.parentTable || "ParentTable",
            blockerTable: v.table,
            foreignKey: v.foreignKey,
            blockerIds: v.ids,
            policy: v.policy,
            message: failItem.message
          });
        });
      }
    });
  }

  return blockers;
}
```

---

## **5. User Interface (UI/UX) Guidelines**

To maintain a premium, state-of-the-art user experience, the client-side presentation layer must follow these design standards when presenting delete failures to operators.

### **A. Humanized Table Labels**
Never display database schema table names directly. Map technical values into natural language descriptors:

| Table Code Name | Humanized Singular Label | Humanized Plural Label |
|---|---|---|
| `Student` | Student Profile | Student Profiles |
| `Enrollment` | Course Enrollment | Course Enrollments |
| `StudentFeeAccount` | Fee Account Ledger | Fee Account Ledgers |
| `Installment` | Installment Due | Installment Dues |
| `Payment` | Cash/UPI Payment | Cash/UPI Payments |
| `Batch` | Subject Batch Section | Subject Batch Sections |
| `Course` | Subject Course | Subject Courses |
| `Package` | Academic Program Package | Academic Program Packages |

### **B. Blocked Deletion Dialog Layout**
Present a structured **Constraint Warning Dialog** instead of a plain alert box.
1. **Title**: "Deletion Blocked: Active Dependencies Detected"
2. **Body**:
   - Explicitly declare that the record cannot be deleted because it is referenced elsewhere.
   - Assert database consistency: *"No changes have been made to this record."*
3. **Actionable Links**:
   - Provide clickable tags or navigation links referencing the blocking child IDs.
   - **Example**: Rendering a card block like:
     ```
     [Active Cash/UPI Payments]
     - PAY-K3J4H5L (Click to view/void payment)
     ```

### **C. Batch Grid Indicators**
When bulk deleting records from a list grid:
- Render a status pill next to each record indicating the outcome.
- For failed items, render a red **"Blocked"** pill which triggers a tooltip displaying the list of referencing dependencies when hovered or clicked. This avoids cluttering the screen while retaining full diagnostic utility.

---

## **6. Recommended Client Resolution Workflows**

When a deletion is blocked due to referential constraints, the client application must guide the user through clear resolution paths:

### **Workflow A: Deleting Child Dependencies First (Hard Deletion)**
If the child records are no longer required, the user can navigate to the referencing entities and delete them first.
1. The user clicks on the blocker link (e.g., `PAY-K3J4H5L`).
2. The UI navigates the user to the Payment detail view.
3. The user deletes or voids the Payment.
4. The user returns to the parent entity and retries deletion.

### **Workflow B: Unlinking / Foreign Key Nullification (Soft Unlinking)**
If the child records must be preserved but should no longer reference the parent entity:
1. Check if the schema allows null values on the foreign key field (`required: false`).
2. If nullable, the UI can offer an **"Unlink Dependencies"** button.
3. The client calls the batch-update endpoint to set the foreign key to `null` on all blocking child IDs.
4. Once completed, the client automatically retries deleting the parent entity.

### **Workflow C: Reassigning / Transferring References**
If the child records must remain active but should point to a different parent record:
1. The UI prompts the user with a **"Reassign & Delete"** dialog.
2. The user selects a target entity (e.g., reassigning student enrollments to a new student account).
3. The client updates all child records (`ForeignKeyField`) to point to the new parent ID.
4. Once the old parent record is free of dependencies, the client retries the deletion.

---

## **7. State Synchronization & Optimistic UI Rollbacks**

Modern UIs often use **optimistic updates** to make deletions feel instantaneous. When dealing with relational constraints, optimistic UI updates present high risk of data inconsistency.

### **Mandatory Best Practices:**
1. **Revert Cache & State immediately**: If a delete operation fails with `ACTION_VALIDATION_FAILURE` or `VALIDATION_FAILURE`, any optimistic removal from client-side state (such as React Query caches or local component state) must be immediately rolled back.
2. **Refresh Stale Data**: Trigger a refetch of the parent record to ensure the UI displays the latest data from the spreadsheet.
3. **Display Toast Alerts**: Provide a clear toast notification that the item could not be deleted, alongside a button to open the detailed blocker dialog.

---

## **8. Client Integration Blueprint (React & React Query)**

Here is a practical integration pattern using React, React Query, and Axios:

```jsx
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

// Humanization dictionary
const tableLabels = {
  Student: { singular: 'Student Profile', plural: 'Student Profiles' },
  Enrollment: { singular: 'Course Enrollment', plural: 'Course Enrollments' },
  Payment: { singular: 'Cash/UPI Payment', plural: 'Cash/UPI Payments' }
};

export function useDeleteStudent() {
  const queryClient = useQueryClient();
  const [violations, setViolations] = useState(null);

  const mutation = useMutation({
    mutationFn: async (studentId) => {
      const response = await axios.post('/api/dispatch', {
        action: 'delete_student',
        payload: { id: studentId }
      });
      
      if (!response.data.success) {
        throw response.data.error;
      }
      return response.data;
    },
    onMutate: async (studentId) => {
      // 1. Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['students'] });

      // 2. Snapshot current value
      const previousStudents = queryClient.getQueryData(['students']);

      // 3. Optimistically remove from list
      queryClient.setQueryData(['students'], (old) => 
        old ? old.filter(s => s.id !== studentId) : []
      );

      return { previousStudents };
    },
    onError: (err, studentId, context) => {
      // 4. Rollback optimistic update
      if (context?.previousStudents) {
        queryClient.setQueryData(['students'], context.previousStudents);
      }

      // 5. Parse and store constraint violations
      if (err.code === 'ACTION_VALIDATION_FAILURE' && err.details?.violations) {
        setViolations(err.details.violations);
      } else {
        alert(`Failed to delete student: ${err.message}`);
      }
    },
    onSuccess: () => {
      setViolations(null);
      queryClient.invalidateQueries({ queryKey: ['students'] });
    }
  });

  return { ...mutation, violations, clearViolations: () => setViolations(null) };
}

export function DeletionWarningModal({ violations, onClose, onResolve }) {
  if (!violations || violations.length === 0) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h3>Deletion Blocked: Active Dependencies Detected</h3>
        <p className="modal-subtitle">
          This record cannot be removed because other parts of the system reference it. 
          No changes have been made to the database.
        </p>

        <div className="violations-list">
          {violations.map((v, index) => {
            const label = tableLabels[v.table] || { singular: v.table, plural: `${v.table}s` };
            return (
              <div key={index} className="violation-item">
                <span className="violation-badge">{label.singular}</span>
                <div className="violation-ids">
                  {v.ids.map(id => (
                    <a key={id} href={`/dashboard/${v.table.toLowerCase()}s/${id}`} className="blocker-link">
                      {id}
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
          <button className="btn-primary" onClick={onResolve}>Resolve Dependencies</button>
        </div>
      </div>
    </div>
  );
}
```
