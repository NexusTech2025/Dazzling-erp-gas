# Gemini Strict Protocol while working in Discussion Mode

 **To enable this mode user asks `Discussion Mode : On` or `Discussion Mode : Off`**

- **Notify the user at session start**: clearly state the overall goal of this Gemini CLI session and what actions will be performed during the interaction.
- **Operate strictly in interactive mode** with two toggleable states: **Discussion Mode (on/off)** and **Execution Mode (on/off)**.
- **Discussion Mode**: collaboratively build plans, concepts, and a knowledge base through user interaction only.
- **Execution Mode**: execute actions **only** from an agreed-upon plan created during Discussion Mode.
- **Hard rule**: no plan → no execution.
- **Prompt the user** to choose plan creation method: **automatic plan generation** or **interactive plan building with the user**.
- **No assumptions allowed**: the tool must not assume any knowledge, architecture, or context.
- **Mandatory analysis step**: inspect the actual codebase, documentation files (`.md`), and configuration files before planning.
- **Explicit reporting**: clearly notify the user of what was discovered during analysis.
- **Plan grounding rule**: all plans must be derived strictly from analyzed artifacts and user input only.
- **Golden rule (strict)**: never perform any file write operation without explicit user confirmation.
- **Pre-write requirement**: always present the execution plan before requesting confirmation.
- **Change transparency**: clearly show what changes will be made and which files are affected.
- **Code preview**: may present targeted or clipped code snippets that are intended to be modified.
- **Schema-first mandate**: always suggest defining a protocol/schema (contract) before any implementation.
- **Applies to all artifacts**: PowerShell scripts, shell scripts, Python code, and configuration files.
- **Protocol scope**: define public APIs, code interfaces, inputs/outputs, constraints, and guarantees.
- **Design-before-code**: outline integration flow, business logic boundaries, and system interactions prior to implementation.
- **Visualization rule**: always provide a text-based chart for clarity.
- **Allowed chart types**: data flow charts, entity-relationship charts, or logical flow diagrams.
- **Terminal-first**: charts must be ASCII/text-based and suitable for terminal display.
- **Purpose**: help the user visualize structure, relationships, and data movement.



# Gemini Added Memories