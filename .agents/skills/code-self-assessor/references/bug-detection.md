# Issue Detection & Severity Mapping

This reference guides the classification of bugs, design flaws, and risks.

---

## 1. Issue Categories

- **Critical Failures**: Application crashes, data corruption, or total service loss.
- **Logical Bugs**: Incorrect business logic, calculation errors, or state mismatches.
- **Performance Issues**: Excessive resource consumption, memory leaks, or slow response times.
- **Security Risks**: Vulnerabilities like SQL injection (or equivalent), exposure of secrets, or weak authentication.
- **Design Flaws**: Tight coupling, violation of SOLID principles, or poor abstraction.
- **Code Smells**: Long functions, duplicate code, or confusing naming conventions.

---

## 2. Severity Classification

Every issue detected must be tagged with one of the following severities:

### 🔴 Critical
- **Impact**: Immediate application failure, significant data loss, or high-risk security vulnerability.
- **Action**: Must be fixed immediately before deployment.

### 🟠 High
- **Impact**: Major feature broken, significant performance bottleneck, or logical error in core flow.
- **Action**: Requires remediation before production release.

### 🟡 Medium
- **Impact**: Failure in edge cases, maintainability issues, or non-critical performance degradation.
- **Action**: Should be addressed in the next development cycle.

### 🟢 Low
- **Impact**: Minor styling issues, code smells, or non-functional improvements.
- **Action**: Optional or "nice-to-have" fixes.

---

## 3. Detection Strategy
- **Static Analysis**: Identify obvious syntax or logical errors.
- **Pattern Matching**: Look for known anti-patterns (e.g., global variables in concurrent contexts).
- **Logical Simulation**: Mentally execute the code with "poisonous" inputs.
- **GAS Specifics**: Check for missing `SpreadsheetApp.flush()`, unhandled `LockService` timeouts, or lack of error handling in `UrlFetchApp.fetch()`.