# Failure Analysis & Remediation

This reference provides instructions on how to conduct deep-dive failure analysis and propose exact fixes.

---

## 1. Root Cause Analysis (RCA) Protocol

For every identified issue (High or Critical), perform the following analysis:

1. **The WHY**: Explain the technical reason for the failure (e.g., "The code fails because it tries to access a property of an undefined object").
2. **The WHEN**: Describe the exact scenario or state that triggers the failure (e.g., "This happens when the `getUser()` function returns `null` because the user ID is missing").
3. **Reproduction Scenario**: Provide a minimal, step-by-step description or pseudo-code to reproduce the failure.

---

## 2. Improvement Suggestions

Every identified issue must be accompanied by a solution:

- **Exact Fix**: Provide a code snippet that directly solves the problem.
- **Refactoring Suggestion**: If the issue is systemic, suggest a broader change to the code structure.
- **Architectural Shift**: If the design is fundamentally flawed, propose a new pattern (e.g., "Switch from inheritance to composition for better testability").

---

## 3. Fix Quality Standards

- **Minimalist**: Change only what is necessary to fix the issue.
- **Idiomatic**: Follow the project's existing style and language conventions.
- **Defensive**: Ensure the fix doesn't just solve the current bug but also prevents similar issues in the future.
- **Verified**: Verify (mentally or via simulation) that the fix works and doesn't introduce regressions.

---

## 4. GAS Performance Optimization
- **Caching**: Suggest `CacheService` for frequently accessed data.
- **Batching Operations**: Propose `getValues()`/`setValues()` over individual cell access.
- **Efficient Filtering**: Recommend filtering data in memory rather than iterating through Spreadsheet rows.