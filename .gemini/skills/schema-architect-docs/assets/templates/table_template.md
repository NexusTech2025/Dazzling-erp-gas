# Table: {{ Table Name }}

---

# 1. Overview
[Long paragraph explaining the purpose, business role, importance, and lifecycle of the table.]

# 2. Business Context
[Explain where it's used, who uses it, and its operational significance.]
Used By:
- [Module A]
- [Module B]

# 3. Lifecycle Narrative
[Explain lifecycle stages and status transitions. Example: Applicant -> Active Student -> Enrolled]

# 4. Column Documentation
[Document each column deeply. Include Purpose, Data Type, Required, Business Rule, Example, Edge Cases, Future Notes.]

## {{ column_name }}
### Purpose
[Why field exists]
### Data Type
`{{ type }}`
### Validation Rules
- Required: {{ is_required }}
- [Other rules]
### Example Values
[Provide real values]
### Business Notes
[Real-world logic]
### Edge Cases
[Failure conditions]
### Future Considerations
[Possible extensions]

# 5. Relationship Documentation
[Explain why the relationship exists, ownership model, cascade expectations, deletion rules.]
{{ Table }} → {{ Related Table }}
Relationship Type: {{ Type }}
[Explanation]

# 6. Real-World Use Cases
[VERY IMPORTANT. What makes docs enterprise-grade. E.g., Use Case 1: Student switches packages mid-session.]

# 7. Query Examples
[SQL, ORM, API Examples]

# 8. Performance Considerations
[Indexing, search patterns, scalability]

# 9. Security & Privacy
[Sensitive fields, compliance concerns, PII handling]

# 10. Future Evolution
[Explain expected schema growth for this table.]
