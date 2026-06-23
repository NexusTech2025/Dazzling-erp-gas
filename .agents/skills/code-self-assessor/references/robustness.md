# Robustness Evaluation Guidelines

This reference defines the framework for scoring code quality and robustness across seven key axes.

---

## 1. Evaluation Axes

### Error Handling
- **Weak**: Swallows errors, uses `try...catch` without logging, or fails silently.
- **Moderate**: Logs errors but lacks structured response or recovery.
- **Strong**: Specific error types, consistent logging, and graceful degradation.
- **Production-grade**: Complete observability, automated recovery or rollback, and detailed error context.

### Input Validation
- **Weak**: Assumes all inputs are valid and safe.
- **Moderate**: Basic type checks or null checks.
- **Strong**: Schema validation, boundary checks, and sanitization.
- **Production-grade**: Strict contract enforcement at every boundary, defense-in-depth.

### Edge Case Handling
- **Weak**: Fails on empty arrays, null objects, or unexpected data shapes.
- **Moderate**: Handles common edge cases but misses complex scenarios.
- **Strong**: Explicit handling for concurrency, timeouts, and boundary values.
- **Production-grade**: Exhaustive coverage of all theoretical failure modes.

### Dependency Safety
- **Weak**: Blindly trusts third-party libraries or internal services.
- **Moderate**: Minimal checks for dependency presence or return values.
- **Strong**: Circuit breakers, timeouts, and fallback logic for external calls.
- **Production-grade**: Zero-trust architecture, robust mocking for tests, and strict dependency isolation.

### Concurrency / State Safety
- **Weak**: Shared state without locks, race conditions are likely.
- **Moderate**: Uses basic synchronization but logic is fragile.
- **Strong**: Immutable state patterns or robust locking mechanisms.
- **Production-grade**: Atomic operations, transaction isolation, and proven thread/process safety.

### Scalability Design
- **Weak**: O(n^2) or worse algorithms, memory leaks, or blocking I/O.
- **Moderate**: Efficient for small datasets but fails at scale.
- **Strong**: Optimized data structures, pagination, and non-blocking patterns.
- **Production-grade**: Distributed systems ready, horizontal scalability, and optimized resource usage.

### Code Maintainability
- **Weak**: "Spaghetti" code, giant functions, no documentation.
- **Moderate**: Modular but tightly coupled, inconsistent naming.
- **Strong**: Clean architecture, SOLID principles, and clear documentation.
- **Production-grade**: Highly decoupled, self-documenting code, and comprehensive test suite.

---

## 2. Robustness Scoring Rubric

Assign a score from 0 to 10 based on the aggregate performance across the axes:

- **0–3 → Weak**: Significant risks. Code is prone to frequent failure and hard to debug. Not suitable for production.
- **4–6 → Moderate**: Functional but fragile. Suitable for prototypes or low-risk internal tools. Needs hardening.
- **7–8 → Strong**: Reliable and well-structured. Handles most scenarios gracefully. Ready for staging/UAT.
- **9–10 → Production-grade**: Exceptional. Mission-critical quality. Highly resilient and maintainable.

---

## 3. GAS (Google Apps Script) Specific Checks
- **Execution Limits**: Check for logic that might exceed the 6-minute (or 30-minute) quota.
- **Quota Management**: Handle `UrlFetchApp` or `SpreadsheetApp` quota limits.
- **LockService**: Proper use of locks in concurrent environments (e.g., Web Apps).
- **Batching**: Ensure data is processed in batches rather than row-by-row.