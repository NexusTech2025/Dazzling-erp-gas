# DazzlingDB & SheetDB Data Platform Engine

## Unified Date-Time Format Interpretation Specification

This technical specification sheet establishes the authoritative parsing matrices, serialization rules, and engine strategy routing rules for date and time fields across all operational tiers of the `SheetDB` ORM and `DazzlingDB` domain layers.

Mismatched date-time evaluations across distributed runtime environments (Google Sheets Engine $\rightarrow$ Apps Script Engine $\rightarrow$ Node.js V8 Sandbox Core Engine) present a critical vector for data synchronization errors. This guide acts as the definitive engine blueprint for developers and autonomous toolchains.

---

## 1. Dedicated Supported Date Formats

When processing structured fields designated strictly for calendar track references (e.g., `due_date`, `installment_date`, `enrollment_date`), native JavaScript string parsing fallbacks can introduce significant data anomalies. In modern engines, initializing a string such as `new Date("2026-03-16")` forces an immediate internal conversion to **UTC Midnight**.

If the host container runs within a western hemisphere timezone offset, the calculated visual representation slips backward into the preceding calendar evening:

$$\text{Parsed Local Time} = T_{\text{UTC\_Midnight}} - \Delta O_{\text{host}}$$

Where $\Delta O_{\text{host}}$ represents the localized container timezone offset. For instance, an environment executed in Eastern Standard Time ($\text{UTC}-05:00$) evaluates the plain date string `"2026-03-16"` as `2026-03-15 19:00:00 EST`, corrupting structural ledger records. To bypass this breakdown, the framework segments parsing vectors explicitly between **Timezone-Free** and **Fully Timezoned** signatures.

### Date-Only Engine Reference Matrix

| Format Target Identifier | Sample Payload | Internal Engine Routing Strategy | Host Container Cross-Realm Evaluation Behavior |
| --- | --- | --- | --- |
| **ISO Extended Date-Only** <br>

<br>*(Timezone-Free Baseline)* | `"2026-03-16"` | **Strategy B** (Component Array Isomorphic Isolation via Regex) | Bypasses native parser string hooks. Instantiates directly using component arrays `new Date(year, monthIndex, day)`. Guaranteed stable across distributed boundaries. |
| **Slash-Delimited Calendar** <br>

<br>*(Timezone-Free Alternate)* | `"2026/03/16"` | **Strategy B** (Component Array Isomorphic Isolation via Regex) | Standardized conversion parsing handles slash configurations uniformly alongside hyphen split keys. Month markers are zero-indexed inside RAM. |
| **Fully Timezoned UTC Anchor** | `"2026-03-16Z"` | **Strategy C** (Direct Native Epoch Serialization Entry) | Recognized strictly as an absolute point-in-time snapshot. The engine relies on the native environment parser to preserve the strict chronological positioning. |
| **Explicit Hour Offset Date** | `"2026-03-16+05:30"` | **Strategy C** (Direct Native Epoch Serialization Entry) | The engine respects the trailing geographic layout boundary parameter block, calculating absolute milliseconds securely. |

### Technical Architectural Constraints

> ⚠️ **CRITICAL DATA WARNING: The Local Clock Invariance Pattern**
> Date-only database rows stored inside Google Sheets must reside as plain string primitives or explicitly decoupled formats. Never inject dynamic client machine offsets straight into master tracking ranges. If an input lacks an explicit timestamp component, the system forces an atomic component-based generation model, ensuring that:
> 
> $$\forall \text{ Execution Container } R_i, \quad \text{CompiledValue}(R_i) = T_{\text{Wall-Clock}}$$
> 
> 

---

## 2. Dedicated Supported Time and Datetime Formats

Combined temporal profiles and standalone operational time fields require structural normalization patterns to prevent parsing engine degradation or instant `Invalid Date` exceptions inside V8 sandboxes.

```
[Raw String Ingestion]
        │
        ├──► Standalone Time Pattern Match (e.g., "08:30 PM", "20:30")
        │    └──► [Strategy A] Anchor onto local baseline Epoch: new Date(1970, 0, 1, hr, min, sec)
        │
        └──► Datetime Structured Layout Match (e.g., YYYY-MM-DD HH:mm:ss)
             ├──► Timezone Offset Detected (Z, +HH:mm)
             │    └──► [Strategy C] Direct Native Epoch Serialization Entry
             │
             └──► Timezone-Free Signatures (AM/PM Variances / Military Time)
                  └──► [Strategy B] Deconstruct components to local object variables via Regex

```

### Standalone Time Validation Architecture (Strategy A)

Because standalone strings such as `"08:30 PM"` or `"20:30"` lack localized year-month-day data blocks, native JavaScript engines fail to parse them directly. To guarantee structural safety, the platform utilizes **Strategy A**, which intercepts the raw strings via regex, normalizes any 12-hour AM/PM modifiers, and builds an invariant local baseline anchor date:

$$\text{Baseline Frame} = \text{new Date}(1970, 0, 1, \text{Hour}_{\text{24h}}, \text{Minute}, \text{Second})$$

This forces the inner tracking methods (`.getHours()` and `.getMinutes()`) to output exact wall-clock matches, completely insulated from multi-realm container shift errors.

### Combined Time and Datetime Ingestion Matrix

| Format Target Identifier | Sample Input Payload String | Strategy Classification | Designated Timezone Parsing Behavior |
| --- | --- | --- | --- |
| **Standalone 12-Hour Morning** | `"08:30 AM"` | **Strategy A** | **Timezone-Free**: Built locally as `1970-01-01 08:30:00`. Modifiers are stripped post-calculation. |
| **Standalone 12-Hour Evening** | `"08:30 PM"` | **Strategy A** | **Timezone-Free**: Normalized mathematically via `hour + 12`. Maps to `1970-01-01 20:30:00`. |
| **Standalone 24-Hour Schedule** | `"20:30"` | **Strategy A** | **Timezone-Free**: Captured directly using component values. Anchors safely onto local 1970 layout. |
| **Lowercase Padding Variance** | `"4:20 pm"` | **Strategy A** | **Timezone-Free**: Case-insensitive regular expression engine normalizes tokens dynamically inside memory lines. |
| **Combined 24h Military Wall-Clock** | `"2026-03-16 20:30:00"` | **Strategy B** | **Timezone-Free**: Highly recommended format for database synchronization loops. Extracted elements write straight into local space parameters. |
| **Combined 12h Standard Morning** | `"2026-03-16 08:30:00 AM"` | **Strategy B** | **Timezone-Free**: Evaluated component-by-component in local coordinate ranges, eliminating machine shifts. |
| **Combined 12h Standard Evening** | `"2026-03-16 08:30:00 PM"` | **Strategy B** | **Timezone-Free**: Evaluated as hour value `20` attached directly to calendar indices `2026-03-16`. |
| **12-Hour Midnight Edge Case** | `"2026-03-16 12:15:00 AM"` | **Strategy B** | **Timezone-Free**: Strict edge case guard translates `12 AM` directly to `00:15` hour coordinates. |
| **12-Hour Noon Edge Case** | `"2026-03-16 12:45:00 PM"` | **Strategy B** | **Timezone-Free**: Guard isolates meridian lines, mapping parameters cleanly to hour value `12`. |
| **ISO 8601 Combined Absolute** | `"2026-03-16T20:30:00Z"` | **Strategy C** | **Fully Timezoned**: Evaluated as UTC absolute timeline ticks. Local displays shift according to environment locations. |
| **Offset Combined Absolute** | `"2026-03-16T20:30:00+05:30"` | **Strategy C** | **Fully Timezoned**: Decodes strict zone parameters explicitly at the network ingestion boundary. |

---

## 3. Concrete Regex Architecture Implementation Manifest

For historical tracking audits and environment alignment checks, the regular expressions used across the core parser engines (`SheetDB/Utils.js`) to capture, isolate, and route these formats are defined below:

### Pattern Alpha: Standalone Time Ingestion

```javascript
/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([aApPmM]{2})?$/

```

* **Capture Elements**: Captures hour groups, minute groups, optional second vectors, and case-insensitive meridian strings (`AM`/`PM`).

### Pattern Beta: Combined Date-Time Structural Isolation

```javascript
/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?\s*([aApPmM]{2})?)?/

```

* **Capture Elements**: Extracts the 4-digit calendar year, sliding month coordinates, day parameters, and localized wall-clock hour segments. This pattern provides full support for flexible structural separators (hyphens or slashes).

### Database Query Boundary Normalization Requirement

```javascript
// Example programmatic usage inside PredicateBuilder context structures
const searchFilter = { 
    entry_time: "08:30 PM" // Automatically routed via Strategy A 
};

const querySpec = {
    target: "TeacherAttendance",
    where: {
        exit_time: { lt: "20:30" } // Normalizes to 1970-01-01 20:30 local frame safely
    }
};

```

### Strategic System Architecture Rules

1. **Axiom 5 Enforcement Strategy**: No explicit string pattern matches or custom format assumptions may be hardcoded directly inside downstream business domain logic services (`StaffService`, `StudentService`). All field types must resolve metadata mappings dynamically at runtime from table schema JSON definitions under `DazzlingDB/Config/Schema/`.
2. **Network Payload Boundary Rule**: When packaging data arrays intended for transactional network transfers across external API portals, all raw Javascript objects must undergo pre-serialization mapping into invariant `"YYYY-MM-DD HH:mm:ss"` text markers to prevent server container timezone drift.