---
name: symbol-indexer
description: Generates structured symbol mappings (.map.json) for codebase files. Use when you need to parse large source files to map class, method, or function boundaries and line ranges to enable fast lookup optimizations.
---

# Symbol Indexer

This skill automates the extraction and compilation of structural symbol mappings for large codebase modules. By creating `.map.json` index files, agents can query specific line ranges and semantic descriptors instead of loading full source files into context.

## Workflow

Follow this two-phase execution workflow to generate a complete symbol index:

### 1. Phase 1: Draft Mode
Run the parser script to extract the code file structure and generate the draft description file (`temp_des.json`).

```bash
node .agents/skills/symbol-indexer/scripts/index_symbols.js --file <target_file_path> --phase draft
```

* **Output**: Generates `E:/NAST/Dazzling/GAS/.gemini/memory/indexs/temp_des.json` listing discovered symbols and placeholders.

### 2. Description Generation (AI Agent Role)
Read the generated `temp_des.json` file. For each symbol in the file:
- Replace the description placeholder with a refined **2-3 line description**.
- Explain the **goal** of the symbol and **why/when** to use it.
- Save the updated `temp_des.json` file.

### 3. Phase 2: Compile Mode
Run the parser script in compile mode to merge your custom descriptions with the structural code maps and output the final index.

```bash
node .agents/skills/symbol-indexer/scripts/index_symbols.js --file <target_file_path> --phase compile
```

* **Output**: Generates the final `<filename>.map.json` file under `E:/NAST/Dazzling/GAS/.gemini/memory/indexs/`.

---

## Downstream Usage

When inspecting or working with a mapped code file:
1. First load its `.map.json` index file from `.gemini/memory/indexs/`.
2. Locate the class or symbol you want to examine to find its exact `line_range` parameters.
3. Call `view_file` specifying the `StartLine` and `EndLine` parameters to pull only that specific block into context.
