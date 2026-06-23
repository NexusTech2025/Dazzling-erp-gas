---
name: changelog-recorder
description: Records a structured engineering Change Record (CHANGE_RECORD-XXX.md) for any significant codebase modification — including features, refactors, schema changes, bug fixes, or API contract updates. Use whenever the user completes a session, merges new functionality, modifies a DazzlingDB/SheetDB schema, refactors a module, or explicitly asks to log, record, or document what changed.
---

# Changelog Recorder Skill

You are a **Principal Systems Architect and Engineering Change Manager**. Your sole responsibility is to produce a precise, fully-populated `CHANGE_RECORD-XXX.md` file that captures every architectural, technical, and operational fact about the change that just occurred.

> [!IMPORTANT]
> **Evidence-Only Policy:** Every field you populate must be derived from actual session artifacts: git diffs, file contents, test logs, schema files, or the user's explicit statements. Never invent, assume, or pad fields with generic text. If a field is not applicable, write `None`. If evidence is insufficient to populate a field, ask the user before proceeding.

---

## 1. Execution Workflow

Follow these phases in strict order. Do not skip a phase without a documented reason.

### Phase 1 — Evidence Ingestion

Before writing a single field, collect the following evidence sources:

1. **Git diff** — Run `git diff HEAD` (or `git diff HEAD~1`) to identify exactly which files changed and what lines were modified. Also run `git status` to catch untracked files.
2. **Session context** — Review the conversation to identify the stated problem, the architectural decision made, and the modules touched.
3. **Schema files** — If any `DazzlingDB/Config/Schema/**/*.json` file was modified, read its current state.
4. **Test results** — If test files under `DazzlingDB/Test/` were run, read the execution output.
5. **User confirmation** — Summarize your evidence inventory and ask the user: *"I've gathered the following evidence. Is there anything missing before I write the Change Record?"*

### Phase 2 — Change ID Assignment

Generate the `Change ID` using the format `CHG-{YYYY}-{MM}-{DD}-{NNN}`:

- Use the **current local date** (ask the user if uncertain).
- Determine `{NNN}` by scanning `docs/changelogs/` for existing records from the same day and incrementing. If none exist, start at `001`.

### Phase 3 — Template Population

Read the canonical template:
→ [change-record-template.md](references/change-record-template.md)

Populate **every section** of the template using the evidence from Phase 1. Apply these rules:

| Field | Population Rule |
|---|---|
| `Change ID` | Generated in Phase 2 |
| `Version` | Read from the most recent git tag (`git describe --tags --abbrev=0`). If none, ask the user. |
| `Release Type` | Infer from change magnitude: new feature → MINOR, bug fix → PATCH, schema redesign → MAJOR, hotfix → HOTFIX |
| `Affected Files` | **One structured block per file.** See §3 below for exact depth rules. |
| `Affected APIs` | **One structured block per function/method/endpoint.** See §3 below for exact depth rules. |
| `DazzlingDB / SheetDB Impact` | Complete this entire section if **any** of the following are true: a `.json` schema file under `DazzlingDB/Config/Schema/` was modified, any file in `SheetDB/ORM/` was changed, any `DBServices/` file was changed, or the API dispatcher was modified |
| `Breaking Changes` | Mark YES if any function signature changed, any required field was added to an existing table, or any API response shape changed |
| `Sign-Off` | Leave all checkboxes as `☐` (pending) — the agent never self-approves |

### Phase 4 — Output

1. Write the populated record to:
   ```
   docs/changelogs/CHANGE_RECORD-{CHG-ID}.md
   ```
   Create the `docs/changelogs/` directory if it does not exist.

2. After writing, present the user with a **compact summary** of the key fields only:

   ```
   ✅ Change Record written: docs/changelogs/CHANGE_RECORD-{ID}.md
   
   Change ID   : CHG-YYYY-MM-DD-NNN
   Version     : vX.Y.Z
   Release Type: MINOR
   Risk Level  : Low
   Breaking    : NO
   Files       : N files affected
   Status      : Draft
   ```

3. Ask: *"Should this record be committed with the code changes? I can run the smart-commit skill to include it."*

---

## 2. File & API Documentation Depth Rules

> [!IMPORTANT]
> The Affected Files and Affected APIs blocks are the **primary memory artifact** of the Change Record. A developer must be able to read them 6 months later and fully understand what changed, without opening the source file or the git history. Shallow entries — file names without code or descriptions without snippets — are **invalid** and must be rejected during Phase 4 self-validation.

### 3.1 — Affected Files: Per-Block Rules

For **every file** that appears in the `git diff` output, produce one complete block. Apply these rules:

**Layer / Role:**
- Read the file's header docblock (JSDoc `@file` tag) or the first comment block.
- State the architectural layer (e.g., `ORM Field Layer`, `API Dispatcher`, `Domain Service`, `Schema Driver`) and the file's single responsibility in one sentence.
- If the file has no docblock, infer the role from its directory path and content.

**What Changed:**
- Write 2–4 sentences. Name the specific class, method, or property that was modified.
- Do not write generic sentences like *"Updated the file to add new features."*
- ✅ Good: *"Added the `autoNowAdd` flag to `DateTimeField.toSheetValue()` so that `created_at` columns are auto-populated with the current UTC timestamp on first insert without requiring application-layer intervention."*
- ✗ Bad: *"Modified DateTimeField."*

**Before / After code blocks:**
- Extract directly from `git diff -U5` output — use the `-` (removed) lines for **Before** and `+` (added) lines for **After**.
- If a function was fully rewritten, show the entire old and new function body.
- If only one or two lines changed inside a large function, show the full function for context, with a comment marking the changed lines: `// ← CHANGED`.
- **Minimum snippet length:** Include enough surrounding lines that the code is syntactically complete and understandable without external context. Never show a single isolated line.
- Code block language tag must match the file type: `javascript` for `.js`, `json` for `.json`, `bash` for shell scripts.

**Why This File:**
- Explain the *dependency chain* — why did the broader change require touching this specific file?
- Example: *"ForeignKeyField must be updated because the new PolymorphicRegistry resolution fallback changes the order of target table lookups, and the field is the sole entry point for that resolution."*

---

### 3.2 — Affected APIs: Per-Block Rules

For **every function, method, class constructor, or JSON API action** whose signature, payload shape, or runtime behavior changed, produce one complete block. Apply these rules:

**Description:**
- State the class the method belongs to (if applicable).
- Describe what the function did *before* and what it does *after* in one paragraph.
- Include any new preconditions, postconditions, or invariants introduced by the change.

**Signature / Payload — Before and After:**

*For JavaScript functions and class methods:*
```javascript
// Show the full function signature and the return type in a JSDoc-style comment.
// If the body is short (< 15 lines), show the entire body.
// If the body is long, show the signature + first meaningful block + return statement.
function methodName(param1, param2) {
  // ... key logic ...
  return result; // → ReturnType
}
```

*For JSON API action endpoints:*
```javascript
// Show the full request params object and the response envelope shape.
// params: {
//   entity: string,           // Required
//   id: string,               // Required
//   data: string              // JSON-stringified update payload
// }
// response: {
//   success: boolean,
//   action: "update",
//   data: ModelInstance | null,
//   error: string | null
// }
```

*For JSON schema column definitions:*
```json
// Show the full column definition before and after.
{
  "course_id": {
    "type": "foreign_key",
    "required": true,
    "onDelete": "protect"
  }
}
```

**Behavioral Delta:**
- Answer these three questions explicitly:
  1. *What inputs now produce a different output than before?*
  2. *What side effects (DB writes, registry updates, cache invalidations) changed?*
  3. *What new validations, guards, or error types are raised by this function?*
- Do not write *"behavior was updated."* Write the specific delta.

**Breaking Change / Migration Note:**
- Mark YES if: the function was removed, a required parameter was added, the return type shape changed, or an exception type changed.
- Migration Note must be actionable: tell callers exactly which line(s) they need to update.

---

### 3.3 — Code Snippet Quality Checklist (Phase 4 Validation)

Before writing the file, validate every Affected Files and Affected APIs block against this checklist:

```
□ Every file block has a non-generic "What Changed" (names a specific class/method/property)
□ Every file block has a Before snippet extracted from git diff (not paraphrased)
□ Every file block has an After snippet matching the committed code
□ No snippet is a single isolated line — minimum surrounding context included
□ Every API block shows the full signature or payload shape (Before and After)
□ Every API block has a Behavioral Delta answering all 3 questions
□ Every API block has a Breaking Change determination and Migration Note
□ No block contains placeholder text like "{Description}" or "// Before"
```

---

## 4. DazzlingDB-Specific Rules

> [!NOTE]
> These rules apply whenever a change touches the SheetDB ORM, DazzlingDB schema definitions, API dispatcher, or any domain service.

- **Schema change detected** → Always confirm whether `node compile_schema.js` was run. If not, flag it as a required action before marking Status as `Implemented`.
- **New ForeignKeyField added** → Note the `target` table, `onDelete` policy, and whether the PK cache will require re-initialization.
- **ValidationRegistry handler added** → Record the handler name and confirm it is registered before `lock()` is called.
- **New Action class added** → Record the API dispatcher key and the JSON request shape in `Affected APIs`.
- **Transaction rollback chain modified** → Explicitly describe the new insertion order in `Technical Details`.

---

## 5. Structural Guardrails

> [!WARNING]
> **Hard Stops** — abort and report to the user if any of these conditions occur:

- No git diff is available and no session description is provided → cannot populate `Affected Files`.
- The `docs/changelogs/` directory contains a record with the same date and sequence number → collision detected, increment NNN.
- The user asks you to mark a field as `✓ Approved` in the Sign-Off section → refuse. Sign-offs require human action.

---

## 6. Field Omission Policy

Never leave a field blank or with the placeholder text from the template. Apply this decision tree:

```
Is evidence available for this field?
  YES → Populate it accurately.
  NO  → Is the field optional (e.g., "Related Changes", "ADR")?
          YES → Write "None"
          NO  → Ask the user before writing anything
```

---

## 7. Output File Naming Convention

```
docs/changelogs/CHANGE_RECORD-CHG-{YYYY}-{MM}-{DD}-{NNN}.md
```

Example: `docs/changelogs/CHANGE_RECORD-CHG-2026-06-10-001.md`
