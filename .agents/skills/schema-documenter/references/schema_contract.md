# Schema Documenter — Tag-to-Section Contract

This document is the **single source of truth** for how template tags map to section headings in source Markdown files.

## Why This Contract Exists

The `merge_schema_docs.js` generator works by:
1. Loading a template (`table_template.md` or `category_template.md`)
2. Scanning it for `{{Tags}}`
3. Looking up each tag in the `TAG_TO_SECTION` map
4. Searching the old Markdown file for a heading containing that section title
5. Extracting the body and injecting it into the new doc

**If a tag is missing from the map, the generator will produce a `[TODO: ...]` placeholder** — even if the content existed in the old doc.

---

## Tag-to-Section Map

### Table Template Tags

| Template Tag | Section Heading Searched (case-insensitive) |
|---|---|
| `{{Overview}}` | `Overview` |
| `{{BusinessContext}}` | `Business Context` |
| `{{LifecycleNarrative}}` | `Lifecycle Narrative` |
| `{{RealWorldUseCases}}` | `Real-World Use Cases` |
| `{{QueryExamples}}` | `Query Examples` |
| `{{PerformanceConsiderations}}` | `Performance Considerations` |
| `{{SecurityPrivacy}}` | `Security & Privacy` |
| `{{FutureEvolution}}` | `Future Evolution` |

### Category Template Tags

| Template Tag | Section Heading Searched (case-insensitive) |
|---|---|
| `{{PurposeOfTheCategory}}` | `Purpose of the Category` |
| `{{DomainWorkflowNarrative}}` | `Domain Workflow Narrative` |

### Computed Tags (Programmatic — No Source Extraction)

These tags are **never searched for in the source Markdown**. They are generated entirely from the schema JSON at runtime.

| Template Tag | Source |
|---|---|
| `{{TableName}}` | Table key name from `schema.categories.X.tables` |
| `{{CategoryName}}` | Category key name from `schema.categories` |
| `{{ColumnTable}}` | Generated from `tableDef.columns` |
| `{{MermaidRelations}}` | Generated from `tableDef.relations` (Mermaid syntax) |
| `{{RelationshipText}}` | Generated from `tableDef.relations` (plain text) |
| `{{TableList}}` | Generated from all table names in the category |
| `{{MermaidDomainGraph}}` | Generated from all table relations in the category |

---

## Rules for Adding a New Section

> [!IMPORTANT]
> You must complete **all 3 steps** together. Missing any step will silently produce a `[TODO: ...]`.

**Step 1**: Add the `{{NewTag}}` to the relevant template file:
- Table sections → `assets/templates/table_template.md`
- Category sections → `assets/templates/category_template.md`

**Step 2**: Add the mapping to `TAG_TO_SECTION` in `scripts/generators/merge_schema_docs.js`:
```js
const TAG_TO_SECTION = {
    // ... existing entries ...
    NewTag: 'Exact Heading Text In Source File',
};
```

**Step 3**: Update this file (`references/schema_contract.md`) with the new entry in the table above.

---

## Section Heading Matching Rules

The `extractSection()` function uses **case-insensitive substring matching**:
- A source heading of `## 2. Business Context` will match the search string `"Business Context"` ✅
- A source heading of `# business context` will also match ✅
- A source heading of `## Biz Context` will **not** match `"Business Context"` ❌

This means the search string must be a substring of the actual heading in the source file.
