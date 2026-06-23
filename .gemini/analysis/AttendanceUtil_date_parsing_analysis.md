# Root Cause Analysis — `new Date(cleanDateStr.replace(/-/g, '/'))`

> Session: **Attendance System Teacher & Student** (`333faa0c`)
> Date: **2026-06-10**

---

## TL;DR

`replace(/-/g, '/')` was introduced as a **browser/V8 ISO 8601 parsing workaround** — specifically to prevent `new Date("2026-06-10")` from being interpreted in **UTC midnight**, which causes the date to shift to the previous calendar day when read back in the **IST (+05:30) timezone** on Google Apps Script's V8 runtime.

---

## The Chain of Events

### Phase 1 — Original Design (09:13 UTC)
The attendance schema used `"type": "string"` for `entry_time` and `exit_time`.
Dates like `"2026-06-10"` were passed as plain strings in the payload and stored as-is.

`AttendanceUtil.js` was created with a **string-based** `calculateDuration()` — pure regex parsing,
no native `Date` construction from date strings. No `replace(/-/g, '/')` existed yet.

---

### Phase 2 — Test Failure: Date Filter Returns Empty Results (09:42 UTC)
After deploying the attendance CRUD, integration test **Case 4 & 5** failed:

```
❌ Student Attendance Query Report  → 0 results
❌ Teacher Attendance Query Report  → 0 results
```

The root cause diagnosed was **dual**:

#### Problem A — `instanceof Date` Cross-Realm Failure
SheetDB is loaded as a GAS **library** (separate script context/realm). When
`PredicateBuilder.js` did `value instanceof Date` to detect date-filter operands,
it was evaluating `Date` from the **host realm** against an object instantiated in the
**library realm**. They are different constructors. Result: `false` even for valid Date objects,
causing the date filter branch to never execute → **zero matches**.

**Fix applied (Step 293–310):** Replaced all `instanceof Date` checks with the native-safe
`isDate()` helper from `SheetDB/Utils.js` which uses `Object.prototype.toString` instead.

#### Problem B — `duration` Returned `null` (10:01 UTC, after fix A)
After fixing the cross-realm issue, queries now matched records.
But a new failure appeared:

```
❌ duration → null
❌ entry_time, exit_time → verbose Date-string representations
```

The reason: `entry_time` was stored as a raw string (`"08:00 AM"`), but the hydration
layer now tried to do `exitDateTime - entryDateTime` as a millisecond subtraction —
which fails on plain strings. `calculateDuration()` received full verbose date-strings
from `getValues()` instead of simple time strings, returned `null`.

---

### Phase 3 — The Architectural Decision (10:12–10:28 UTC)

You raised a key discussion:

> *"We will capture the whole date_time, suppose that the user will insert `"08:00 AM"` only
> as the supported time format — we pre-process the time in-memory, attach it to the
> current/assigned date, and save a fully defined datetime object."*

After evaluating two approaches (`getDisplayValues()` string approach vs. native DateTime objects),
the architecture was updated to:

```
API Input:  { hour: 8, minute: 0, period: "AM" }  ← structured, unambiguous
            +
            attendance_date: "2026-06-10"

Service Layer (AttendanceUtil.parseJsonTimeToDate):
  → Construct full native JS Date object in-memory
  → Store as a native DateTime value in the Sheet

Query Hydration:
  → exitDateTime - entryDateTime = milliseconds → hours (duration)
  → Convert back to { hour, minute, period } JSON for API response
```

This required `AttendanceUtil.js` to be **completely rewritten** (Step 388) with a
`parseJsonTimeToDate()` function.

---

### Phase 4 — Where `replace(/-/g, '/')` Was Born (Step 388 code)

Inside the new `parseJsonTimeToDate()`, the function needed to construct a native
`Date` object anchored to the `attendance_date` value:

```js
// The problem:
const dt = new Date("2026-06-10");   // ← This is parsed as UTC midnight: 2026-06-10T00:00:00Z
// In IST (+05:30): dt.getHours() reads back as 5:30 AM — WRONG calendar day anchor
```

#### Why Does This Happen?
Per the **ECMAScript spec**, `new Date("YYYY-MM-DD")` (ISO 8601 date-only form with hyphens)
is treated as **UTC midnight**. When GAS's V8 runtime converts it to local time (IST = +05:30),
`getHours()` returns `5` instead of `0`. If `hour = 8` and `minute = 0`, `setHours(8, 0, 0, 0)`
would operate on a shifted date object.

#### The Fix — Slash Format
```js
// ISO 8601 with hyphens → UTC midnight (bad)
new Date("2026-06-10")       // UTC: Jun 10 00:00Z → IST: Jun 10 05:30 ✓ (but .getDate() = 10 only due to offset direction)

// vs. non-ISO slash format → LOCAL midnight (good)
new Date("2026/06/10")       // Parsed as LOCAL: Jun 10 00:00 IST → .getDate() = 10 ✓
```

When you replace `-` with `/`, you deliberately break ECMAScript's ISO 8601 detection.
The browser/V8 then falls back to an **implementation-defined locale-aware parse**,
which in V8 treats `"2026/06/10"` as **local midnight** — exactly what we need before
calling `setHours(hrs, min, 0, 0)` to anchor the time correctly.

```js
// What was written in Step 388:
const cleanDateStr = dateStr.replace(/-/g, '/');
const dt = new Date(cleanDateStr);   // → local midnight in IST
dt.setHours(hrs, minute, 0, 0);     // → "2026-06-10T08:00:00+05:30"
```

---

### Phase 5 — Later Replaced (Update DBServices session, 2026-06-17)

In the `9882af7c` session, this `replace(/-/g, '/')` approach was identified as
**locale-unsafe** and replaced with explicit `split` parsing:

```js
// Old (fragile — depends on V8's locale-aware fallback behavior):
const dt = new Date(cleanDateStr.replace(/-/g, '/'));

// New (locale-safe — always constructs Date from explicit numeric components):
const [y, m, d] = dateStr.split(/[-\/]/);
const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
```

The `split` approach bypasses the JavaScript engine's date-string parser entirely and
constructs the `Date` object from integer parts — removing dependence on browser/V8
locale interpretation behavior.

---

## Root Cause Summary

| Layer | Problem | Why |
|---|---|---|
| ECMAScript spec | `new Date("YYYY-MM-DD")` = UTC midnight | ISO 8601 date-only strings are UTC by spec |
| GAS V8 runtime | IST is +05:30 offset | Local time shifted relative to UTC anchor |
| `AttendanceUtil` | Needed local-midnight anchor to combine with user-supplied time | `setHours()` must start from midnight in local tz |
| Workaround | `replace(/-/g, '/')` breaks ISO 8601 detection → V8 falls back to local parse | Slash format is not spec-defined → locale-aware |
| Final fix | `split(/[-\/]/)` → `new Date(y, m-1, d)` | Constructor form is always local, no string parsing |

---

## Session Reference
- [AttendanceUtil.js](e:/NAST/Dazzling/GAS/DazzlingDB/DBServices/AttendanceUtil.js)
- Session `333faa0c` — Steps 154, 275, 293, 351, 357–368, 388
- Session `9882af7c` — Step 993 (final fix)
