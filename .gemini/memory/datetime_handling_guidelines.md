# Datetime Handling Guidelines: Dates, Times, and Datetimes in SheetDB & DazzlingDB

Working with dates and times in Google Sheets and Google Apps Script (GAS) can be complex due to default cell formatting behaviors, timezone transitions, and scoping boundaries between libraries. 

This document serves as the official design standard and implementation reference for managing dates, times, and datetimes in this codebase.

---

## 1. Core Concepts & Platform Quirks

### Time Value Coupling (The 1899 Epoch)
By default, Google Sheets does not support a standalone "Time" type. If you write a time string like `"08:00 AM"` or `"14:30"` into a cell, Google Sheets automatically converts it to a standard decimal representation and associates it with the epoch base date: **December 30, 1899** (e.g., `1899-12-30T08:00:00`).

### Reading and Writing Types
* **Writing**: When writing JavaScript `Date` objects to cells using `Range.setValues()`, Apps Script serializes them into Sheets-compatible datetime numbers.
* **Reading**: When reading formatted cells using `Range.getValues()`, Apps Script returns native JavaScript `Date` objects. If the cell was formatted only to display the time (e.g., `"HH:mm"`), the date portion remains locked to the 1899 epoch.

---

## 2. The GAS Cross-Realm Date Check Rule

### The Bug: Scoping and `instanceof Date`
In Google Apps Script, when the application runs across multiple scripts (such as `DazzlingDB` calling functions inside the `SheetDB` library), the execution scope is split. Because of these cross-realm prototype scoping boundaries, checking if a value is a date using `value instanceof Date` will evaluate to `false` if the `Date` object was instantiated in a different realm.

### The Fix: Standardizing on `isDate()`
Never use `instanceof Date` for verification or type casting. Instead, use the native-safe `isDate()` helper defined in [Utils.js](e:/NAST/Dazzling/GAS/SheetDB/Utils.js).

```javascript
function isDate(val) {
  if (val === null || val === undefined) return false;
  
  // Extract native underlying type slot (bypasses prototype scopes)
  const isDateStructure = Object.prototype.toString.call(val) === '[object Date]';
  
  // Ensure the underlying time value is numerical (filters out 'Invalid Date')
  return isDateStructure && !isNaN(val.getTime());
}
```

* **Inside `SheetDB`**: Access this helper globally as `isDate(value)` or via `globalThis.isDate(value)`.
* **Inside `DazzlingDB`**: Access it via the library namespace: `SheetDB.isDate(value)`.

---

## 3. Database Schema Mapping

Database table schemas represent dates and datetimes using specific types under `DazzlingDB/Config/Schema/`:

* **`"date"`**: Standard dates (e.g., `"2026-06-11"`). The `TableGateway` normalizes these values into local date-only representations or formats them to standard ISO formats.
* **`"datetime"`**: Full datetimes containing both calendar dates and hours/minutes/seconds. Recommended for tracking timestamps, check-in, and check-out events.

```json
"attendance_date": {
  "type": "date",
  "required": true
},
"entry_time": {
  "type": "datetime",
  "required": false
}
```

---

## 4. The Structured JSON Time Pattern

To prevent time format parsing errors and timezone shift anomalies, the system uses the **Structured JSON Time Pattern** at the API boundary, while storing the results as native datetimes in the spreadsheet database.

```
[API Payload: JSON Time Object] 
       │
       ▼
 [Service Layer] ──────────► 1. In-memory validation (e.g., hour: 1-12, minute: 0-59, period: AM/PM)
       │                     2. Combine with 'attendance_date' -> Native JS Date object
       ▼
 [Database Layer] ─────────► Stored as native DateTime in Sheet (Clean, formatted cells)
       │
       ▼
 [Query Hydration] ────────► 1. Read native Date objects
                             2. Subtraction: (Exit Date - Entry Date) = Duration
                             3. Format back to JSON Time Object for the client payload response
```

### 1. API Payload Representation
API inputs and outputs represent times using a structured JSON object:
```json
{
  "hour": 8,
  "minute": 15,
  "period": "AM"
}
```

### 2. Pre-processing on Write (JSON to Date)
Before storing the payload in the database, the service layer validates the JSON time parameters and anchors them to the corresponding `attendance_date`. This generates a native `Date` object containing the calendar year, month, day, and time coordinates:

```javascript
// Example validation and datetime construction in AttendanceUtil.js
convertJsonToDate(timeObj, dateVal) {
  if (!timeObj || typeof timeObj !== 'object') return null;
  const { hour, minute, period } = timeObj;

  // Validate components in-memory
  if (typeof hour !== 'number' || hour < 1 || hour > 12) throw new Error("Invalid hour.");
  if (typeof minute !== 'number' || minute < 0 || minute > 59) throw new Error("Invalid minute.");
  if (period !== 'AM' && period !== 'PM') throw new Error("Invalid period.");

  let hrs = hour;
  if (period === 'PM' && hrs < 12) hrs += 12;
  if (period === 'AM' && hrs === 12) hrs = 0;

  // Parse base date safely without timezone offset shifting
  let dt;
  if (isDate(dateVal)) {
    dt = new Date(dateVal.getTime());
  } else {
    // Replace dashes with slashes to ensure local timezone parsing in Apps Script
    dt = new Date(dateVal.split('T')[0].replace(/-/g, '/'));
  }

  dt.setHours(hrs, minute, 0, 0);
  return dt;
}
```

### 3. Post-processing on Read (Date to JSON)
When retrieving rows for query reports, the database loads the native `Date` objects. The service layer converts these datetimes back to the client-facing JSON structure during hydration:

```javascript
convertDateToJson(dateVal) {
  if (!dateVal) return null;

  let dt = isDate(dateVal) ? dateVal : new Date(dateVal);
  if (!isDate(dt)) return null;

  let hour = dt.getHours();
  const minute = dt.getMinutes();
  const period = hour >= 12 ? 'PM' : 'AM';

  hour = hour % 12;
  if (hour === 0) hour = 12;

  return { hour, minute, period };
}
```

---

## 5. Time Math & Overnight Rollovers

### Native Datetime Math
When check-in (`entry_time`) and check-out (`exit_time`) are stored as full native `Date` objects, calculating the elapsed duration is simplified to a millisecond subtraction:

```javascript
const durationHours = (exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60);
return parseFloat(durationHours.toFixed(2));
```

### Overnight Rollovers
During the pre-processing step, the service layer checks if the check-out time occurs chronologically before the check-in time on the same date. If true, the check-out date is incremented by 1 calendar day:

```javascript
if (entryDate && exitDate && exitDate < entryDate) {
  exitDate.setDate(exitDate.getDate() + 1); // Add 1 calendar day for overnight rollover
}
```
Because the date component is advanced, standard millisecond subtraction automatically handles shifts that cross midnight without custom modulo-24 calculations.

### String Fallback Parsing (Testing Utility)
To support unit testing or standalone calculations where raw time strings (e.g., `"08:00 AM"`, `"23:00"`) are passed directly without date contexts:
1. Parse the strings using regular expressions into minutes relative to midnight.
2. If `exitMinutes < entryMinutes`, add `1440` minutes (`24 * 60`) to the exit minutes to account for rollover.
3. Compute the decimal hours: `(exitMinutes - entryMinutes) / 60`.
