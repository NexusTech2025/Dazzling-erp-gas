---
name: dazzling-test-writer
description: Guides the writing of non-API integration, unit, and diagnostic tests for DazzlingDB in Google Apps Script. Use when asked to write new test files or append scenarios in the DazzlingDB/Test folder.
---

# DazzlingDB Test Writer

This skill guides the design and implementation of automated tests for DazzlingDB.

## Core Reference Materials

- **Test Template**: Boilerplate code structure for writing tests. See [test_template.js](references/test_template.js).
- **Style Guide**: Detailed requirements for logs formatting, exception assertion, and database interactions. See [style_guide.md](references/style_guide.md).

## Test Implementation Workflow

1. **Create the Test File**:
   - Location: [DazzlingDB/Test/](file:///e:/NAST/Dazzling/GAS/DazzlingDB/Test/)
   - Naming Convention: `[Domain]_[Feature]Tests.js` in PascalCase. E.g., `Academic_CourseTests.js`.

2. **Structure the Suite**:
   - Define a main suite runner `run[Domain][Feature]Tests()`.
   - Setup a `results` accumulator.
   - Run scenarios sequentially and capture their pass/fail status.
   - Log the final suite report using `JSON.stringify()`.
   - Return the `results` object.

3. **Implement Scenarios**:
   - Wrap each scenario in a descriptive sub-function.
   - Wrap all logical steps in `try...catch` blocks to capture exceptions.
   - Match log styling using the standard emoji vocabulary (🚀, 🎓, ▶️, ⚙️, ✅, ❌, 🏁, 📊).

4. **Verify Exception Mappings**:
   - If testing negative validation constraints, assert that the database throws the expected error type (e.g. `ValidationError`, `EntityNotFoundError`).
   - Extract and log `error.name`, `error.message`, and `error.context`.
