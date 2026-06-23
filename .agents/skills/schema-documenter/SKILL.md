---
name: schema-documenter
description: Synchronizes a DazzlingDB JSON schema file with its enterprise-grade Markdown documentation. Use when the schema has been updated and docs need to be regenerated, or when a new schema version is being documented for the first time. Preserves all existing human-written business context (overviews, narratives, use cases) while auto-generating structural sections (columns, relations).
---

# Schema Documenter (DazzlingDB)

A **Hybrid Intelligence** documentation workflow. Node.js scripts do the deterministic heavy lifting; the AI provides creative synthesis only for brand-new tables that have no prior documentation.

---

## The 4-Step Workflow

### Step 0 — Pre-flight: Understand What Changed

Before generating anything, run the schema diff tool to get a complete picture of what changed between schema versions.

```bash
node scripts/analyzers/schema_diff.js <oldSchemaPath> <newSchemaPath>
```

**Example:**
```bash
node scripts/analyzers/schema_diff.js E:\NAST\Dazzling\GAS\DazzlingDB\full_schemav2.json E:\NAST\Dazzling\GAS\DazzlingDB\full_schemav3.json
```

This reports:
- `➕ NEW TABLES` — need full AI documentation (you'll handle these in Step 2)
- `🗑️ REMOVED TABLES` — their docs should be deprecated
- `📝 MODIFIED TABLES` — column/relation sections will be auto-updated by the generator
- `✅ UNCHANGED TABLES` — no action needed

---

### Step 1 — Generate: Run the Merger Script

Do **not** manually write Markdown files. Run the generator to produce all output at once.

```bash
node scripts/generators/merge_schema_docs.js <schemaPath> <sourceDocsDir> <targetDocsDir>
```

**Example:**
```bash
node scripts/generators/merge_schema_docs.js E:\NAST\Dazzling\GAS\DazzlingDB\full_schemav3.json E:\NAST\Dazzling\GAS\docs\schema\v1 E:\NAST\Dazzling\GAS\docs\schema\v3
```

**Optional overrides (args 4 & 5):**
```bash
node scripts/generators/merge_schema_docs.js <schema> <source> <target> <tableTemplatePath> <categoryTemplatePath>
```

What the script does:
- Reads every category and table from the JSON schema
- For each table, loads the old `.md` file (if it exists) and extracts human-written prose by section heading
- Regenerates the structural sections (columns, Mermaid ER diagram, relations) fresh from the schema
- Merges them into the output using the templates in `assets/templates/`
- Produces `[TODO: Write ...]` placeholders for any section with no prior content

---

### Step 2 — Synthesize: Fill in New Table Documentation (AI Task)

After the generator runs, new tables (identified in Step 0) will have `[TODO: ...]` placeholders. Your job is to fill these in.

**Find which tables need synthesis:**
```bash
node scripts/analyzers/run_verification.js <sourceDocsDir> <targetDocsDir> --list-new-tables
```

For each new table:
1. Read its generated `.md` file to understand its column structure and relations
2. Read `references/schema_contract.md` to understand which sections need content
3. Write the business prose for:
   - `Overview` — what this table stores and why it exists
   - `Business Context` — who uses it, for what purpose
   - `Lifecycle Narrative` — the status states a record goes through
   - `Real-World Use Cases` — concrete scenarios from the institution's workflow

**Core Rule: Never delete human content.** Sections already populated from Step 1 must not be touched.

---

### Step 3 — Verify: Confirm Zero Data Loss

Run the single verification command to prove the generation was clean.

```bash
node scripts/analyzers/run_verification.js <sourceDocsDir> <targetDocsDir>
```

**Example:**
```bash
node scripts/analyzers/run_verification.js E:\NAST\Dazzling\GAS\docs\schema\v1 E:\NAST\Dazzling\GAS\docs\schema\v3
```

This checks:
1. **Inventory** — source vs target table count, new table detection
2. **Prose Fidelity** — section-level diff across all common tables
3. **Placeholder Scan** — any remaining `[TODO: ...]` in the output
4. **Summary** — overall pass/fail with clear action items

If the report shows `⚠️ ACTION REQUIRED`, fix the flagged issues and re-run.

---

## Script Reference

| Script | Purpose | Key Args |
|--------|---------|----------|
| `scripts/analyzers/schema_diff.js` | Pre-flight schema change report | `<oldSchema> <newSchema>` |
| `scripts/generators/merge_schema_docs.js` | Generate all Markdown docs from schema | `<schema> <sourceDir> <targetDir>` |
| `scripts/analyzers/run_verification.js` | Full post-generation audit | `<sourceDir> <targetDir> [--list-new-tables]` |
| `scripts/analyzers/cross_check_columns.js` | Authoritative field-by-field JSON vs MD check | `<schemaPath> <docsTablesDir>` |
| `scripts/analyzers/schema_linter.js` | Structural quality check on a single dir | `<targetDir> [mandatory-sections]` |
| `scripts/analyzers/verify_diff.js` | Single-file prose fidelity check | `<sourceFile> <targetFile>` |

---

## Template Contract

Templates drive everything. Tags in templates map to section headings in source docs.

See `references/schema_contract.md` for the complete Tag-to-Section map.

**To add a new documentation section:**
1. Add `{{NewTag}}` to the template in `assets/templates/`
2. Add `NewTag: 'Exact Heading Text'` to `TAG_TO_SECTION` in `merge_schema_docs.js`
3. Update `references/schema_contract.md`

---

## Documentation Standards

- **Mermaid diagrams are mandatory** in every table's Section 5 (Relationship Documentation)
- **Human prose sections (1–3, 6–10) are sacred** — never overwrite them with generated content
- **Structural sections (4–5) are always regenerated** from the schema — never edit them manually
- **Deprecated tables** must have `> [!WARNING]` alerts in their Overview
- All tooling stays in **Node.js** — no Python, no shell-only scripts
