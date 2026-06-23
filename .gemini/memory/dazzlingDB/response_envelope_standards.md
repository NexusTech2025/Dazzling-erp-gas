# API Response Envelope Standards & Frontend Integration Guide

This memory node defines the unified, protocol-driven API Response Envelope used across the Dazzling ERP system, as established in the Application Service Layer ([BaseActions.js](e:/NAST/Dazzling/GAS/DazzlingDB/DBServices/BaseActions.js)) and routed through [ApiDispatcher.js](e:/NAST/Dazzling/GAS/DazzlingDB/ApiDispatcher.js).

---

## 1. Architectural Mandate (CQS Compliance)

To achieve clean separation of concerns and deterministic transaction tracking, all API endpoints are categorized into:
- **Queries (`QUERY`)**: Read-only operations. These responses omit mutating context markers entirely to keep payload size optimal.
- **Mutations (`CREATE`, `UPDATE`, `DELETE`)**: State-changing operations. These guarantee transaction status tracking, transaction rollbacks on failure, and mutation manifests indicating affected tables.

---

## 2. Success Response Envelope

A successful operation always returns `success: true` and packages all target records inside `data`.

### Success Schema (JSON)
```json
{
  "success": true,
  "data": {
    // Action-specific payload (e.g. Student Profile, Onboarded Teacher, etc.)
    "_presentation": {
      "display_status": "Active",
      "toast_message": "Data transaction committed safely to physical files."
    }
  },
  "context": {
    "execution_time_ms": 142,
    "mutated_records_count": 2,      // Present only on mutations (CREATE/UPDATE/DELETE)
    "mutated_records": [             // Present only on mutations
      "Student",
      "Address"
    ]
  },
  "meta": {
    "environment": "production",
    "version": "2.1.2",
    "timestamp": "2026-06-19T00:43:35.000Z"
  }
}
```

### Success Field Specifications
* **`success`** (boolean): Always `true` for successful operations.
* **`data`** (object|array): The core payload. 
  * For single-record mutations, `data` includes an auto-injected `_presentation` block with human-readable status mapping (`display_status`) and toast advice (`toast_message`).
* **`context`** (object): Operational metrics.
  * `execution_time_ms` (number): The server processing duration.
  * `mutated_records_count` (number): Number of unique tables written to (mutations only).
  * `mutated_records` (string[]): Table names updated during transaction (mutations only).
* **`meta`** (object): Environment variables, app version, and ISO timestamp.

---

## 3. Failure Response Envelope

A failed operation guarantees database rollbacks where transactions are active, and provides structured error categorization rather than generic raw stack traces to the client.

### Failure Schema (JSON)
```json
{
  "success": false,
  "error": {
    "code": "ACTION_VALIDATION_FAILURE",
    "message": "Consolidated ledger baseline valuations cannot be zero or negative.",
    "details": [
      {
        "field": "financials.total_fee",
        "issue": "Value must balance above zero scale."
      }
    ]
  },
  "context": {
    "execution_time_ms": 54,
    "active_transaction_id": "TX-9982-AA",
    "transaction_status": "ROLLED_BACK"
  },
  "meta": {
    "environment": "development",
    "version": "2.1.2",
    "timestamp": "2026-06-19T00:43:35.000Z",
    "correlation_id": "7ac237d0-1b20-4e50-bd1c-1f55a1cb5ab2",
    "diagnostics": {                  // Injected ONLY in development mode
      "stack_trace": [
        "ActionValidationError: Consolidated ledger...",
        "    at BaseAction.run (BaseActions.js:52)"
      ]
    }
  }
}
```

### Failure Field Specifications
* **`success`** (boolean): Always `false` for failed operations.
* **`error`** (object): Structured error payload.
  * `code` (string): Standardized error identifier (e.g. `ACTION_VALIDATION_FAILURE`, `PACKAGE_ORCHESTRATION_BREACH`, `INTEGRITY_VIOLATION`, `ENTITY_NOT_FOUND`, `VALIDATION_FAILURE`, `CONFLICT_ERROR`, `FORBIDDEN_ACCESS`, `UNHANDLED_SERVER_FAULT`).
  * `message` (string): User-friendly, safe error description.
  * `details` (array|object|null): Fine-grained validation arrays specifying which fields failed and why.
* **`context`** (object): Transaction rollback metrics.
  * `active_transaction_id` (string): The active transaction tracker context, if any.
  * `transaction_status` (string): Either `ROLLED_BACK` (successful rollback) or `FAILED`.
* **`meta`** (object): Correlated telemetry fields.
  * `correlation_id` (string): Unique request uuid used to trace the logs.
  * `diagnostics` (object): Included ONLY in `development` environment; contains the backend execution stack trace.

---

## 4. Frontend Developer Integration Guide

### 4.1 Axios / Fetch Standard Handler
When calling the backend, always evaluate the `success` field before reading `data` or invoking generic alerts.

```javascript
import axios from 'axios';

/**
 * Standard API Request Wrapper
 */
export async function executeServerAction(actionName, payload = {}) {
  try {
    const response = await axios.post('/api', {
      action: actionName,
      payload: payload
    });

    const envelope = response.data;

    if (envelope.success) {
      // 1. Trigger Toast Notifications automatically if presentation exists
      if (envelope.data?._presentation?.toast_message) {
        showToast(envelope.data._presentation.toast_message, 'success');
      }
      return envelope.data;
    } else {
      // 2. Handle Application-level Failures
      handleBackendError(envelope);
      throw envelope.error;
    }
  } catch (error) {
    // 3. Handle Network or Uncaught Exceptions
    if (error.code) {
      // It's a structured backend error
      throw error;
    }
    showToast('Network error, please try again.', 'danger');
    throw error;
  }
}
```

### 4.2 Handling Complex Form Validation Errors
For `ACTION_VALIDATION_FAILURE` responses, map the `error.details` array directly to form UI fields.

```javascript
function handleBackendError(envelope) {
  const { error, meta } = envelope;
  
  if (error.code === 'ACTION_VALIDATION_FAILURE' && Array.isArray(error.details)) {
    // Map fields directly to UI input errors
    error.details.forEach(detail => {
      setFieldError(detail.field, detail.issue);
    });
  } else {
    // Generic modal for system breaches
    showSystemErrorModal({
      title: `Error: ${error.code}`,
      message: error.message,
      correlationId: meta.correlation_id
    });
  }
}
```
