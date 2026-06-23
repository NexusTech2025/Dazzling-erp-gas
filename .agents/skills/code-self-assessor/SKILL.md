---
name: code-self-assessor
description: Performs structured self-assessment of codebases to evaluate robustness, detect issues, and classify risks from weak to critical severity. Use when reviewing code, auditing for production readiness, or identifying bugs and architectural weaknesses.
---

# Code Self-Assessor Skill

## Purpose
This skill provides a rigorous, multi-pass evaluation pipeline to assess the robustness and quality of a codebase. It identifies logical bugs, security risks, and architectural flaws, providing a quantitative score and actionable remediation plans.

## Execution Pipeline

### Step 1: Context Resolution
Identify the programming language, framework (e.g., Google Apps Script, Node.js), and system architecture. Determine if the scope is a single function, a file, or a full module.

### Step 2: Robustness Evaluation
Evaluate the code across seven key axes (Error Handling, Input Validation, Edge Cases, Dependency Safety, Concurrency, Scalability, Maintainability).
- **Reference**: Refer to [robustness.md](references/robustness.md) for detailed scoring criteria and GAS-specific checks.

### Step 3: Issue Detection & Severity Mapping
Identify bugs, smells, and risks. Classify each using the standard severity scale (🔴 Critical to 🟢 Low).
- **Reference**: Refer to [bug-detection.md](references/bug-detection.md) for category definitions and detection strategies.

### Step 4: Failure Analysis & Fix Generation
For each identified issue, conduct a root cause analysis and provide a production-grade fix.
- **Reference**: Refer to [failure-analysis.md](references/failure-analysis.md) for the RCA protocol and fix standards.

### Step 5: Report Generation
Compile the findings into a structured report using the standardized template.
- **Template**: Use [report-template.md](assets/report-template.md) as the structure for the final output.

## Behavior Rules
1. **Be Brutally Honest**: Do not soften findings. If code is "Weak", state it clearly.
2. **Prioritize Correctness**: Focus on logic and robustness over stylistic preferences.
3. **Actionable Only**: Every reported issue MUST have a clear cause, a trigger scenario, and a concrete fix.
4. **Context-Aware**: Adjust checks based on the environment (e.g., prioritize execution limits in Google Apps Script).

## Example Usage
- "Assess this file using code-self-assessor: DBServices/DBContext.js"
- "Run a robustness audit on the authentication module"
- "Perform a deep-dive bug hunt in ApiDispatcher.js"
