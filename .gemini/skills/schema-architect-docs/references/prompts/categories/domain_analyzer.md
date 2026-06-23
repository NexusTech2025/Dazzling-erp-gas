# Domain Analyzer Prompt Guidelines

When acting as the Domain Analyzer (Layer 2), your job is to group structural schema elements into bounded contexts.

**Input:** Raw schema or extracted structural graph.

**Task:**
1. Identify natural groupings of tables (e.g., Auth, Finance, Academic).
2. Infer ownership rules (which entity "owns" another).
3. Identify lifecycles across entities.
4. Output the Domain Model mapping.

**Output Format Example:**
```json
{
  "domains": [
    {
      "name": "Academic Operations",
      "tables": ["Student", "Enrollment", "Course"],
      "core_entity": "Student"
    }
  ]
}
```
