/**
 * @file index_symbols.js
 * Robust Codebase Symbol Indexer and AST Parser.
 * Generates structural code symbol mappings (classes, functions, methods) to optimize agent file analysis.
 */

const fs = require('fs');
const path = require('path');

// ==========================================
// CONFIGURATION & GLOBAL STATE
// ==========================================
const DEFAULT_INDEX_DIR = path.resolve('E:/NAST/Dazzling/GAS/.gemini/memory/indexs');
const DEFAULT_TEMP_DES = path.resolve(DEFAULT_INDEX_DIR, 'temp_des.json');

const INVALID_METHOD_NAMES = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'with', 'function', 'class', 'return', 'super', 'typeof', 'instanceof'
]);

// ==========================================
// CORE DOMAIN LOGIC
// ==========================================

class SymbolIndexer {
  constructor(filePath, outputDir = DEFAULT_INDEX_DIR) {
    this.filePath = path.resolve(filePath);
    this.outputDir = outputDir;
    this.fileName = path.basename(this.filePath);
    this.lines = [];
  }

  /**
   * Main orchestrator for symbol parsing.
   * @param {string} phase - 'draft' | 'compile'
   * @param {string} descriptionsPath - Path to temp_des.json
   */
  run(phase = 'draft', descriptionsPath = DEFAULT_TEMP_DES) {
    try {
      this.logInfo(`Initiating indexing sequence for file: ${this.filePath} (Phase: ${phase.toUpperCase()})`);
      
      this.verifySourceFileExists();
      this.lines = this.readFileLines();

      const parsedSymbols = this.parseSymbols();
      this.logInfo(`Discovered ${parsedSymbols.length} symbol declarations.`);

      if (phase === 'draft') {
        this.executeDraftPhase(parsedSymbols, descriptionsPath);
      } else if (phase === 'compile') {
        this.executeCompilePhase(parsedSymbols, descriptionsPath);
      } else {
        throw new Error(`Invalid phase parameter: '${phase}'. Must be 'draft' or 'compile'.`);
      }
    } catch (error) {
      this.logError(`Execution halted due to exception: ${error.message}`);
      throw error;
    }
  }

  // ==========================================
  // PHASE EXECUTORS
  // ==========================================

  executeDraftPhase(symbols, outputPath) {
    this.logInfo(`Compiling draft descriptor mapping...`);
    const draftStructure = {
      file: this.getRelativeWorkspacePath(this.filePath),
      generated_at: new Date().toISOString(),
      symbols: {}
    };

    symbols.forEach(sym => {
      const uniqueName = sym.parent ? `${sym.parent}.${sym.name}` : sym.name;
      draftStructure.symbols[uniqueName] = {
        goal: sym.goal || `Goal of the ${sym.type} ${uniqueName}`,
        description: `PLACEHOLDER: Please write a 2-3 line description explaining the goal of ${uniqueName} and why to use it.`
      };
    });

    this.ensureDirectoryExists(path.dirname(outputPath));
    fs.writeFileSync(outputPath, JSON.stringify(draftStructure, null, 2), 'utf-8');
    this.logSuccess(`Draft descriptors successfully written to: ${outputPath}`);
  }

  executeCompilePhase(symbols, descriptionsPath) {
    this.logInfo(`Compiling final index using descriptors from: ${descriptionsPath}`);
    
    if (!fs.existsSync(descriptionsPath)) {
      throw new Error(`Descriptions descriptor file not found at: ${descriptionsPath}. Please run draft phase first.`);
    }

    const rawDes = fs.readFileSync(descriptionsPath, 'utf-8');
    const descriptionsData = JSON.parse(rawDes);
    const symbolsDictionary = descriptionsData.symbols || {};

    const compiledSymbols = symbols.map(sym => {
      const uniqueName = sym.parent ? `${sym.parent}.${sym.name}` : sym.name;
      const userMeta = symbolsDictionary[uniqueName] || {};
      return {
        name: sym.name,
        type: sym.type,
        extends: sym.extends || undefined,
        parent: sym.parent || undefined,
        goal: userMeta.goal || sym.goal || `Goal definition for ${uniqueName}`,
        description: userMeta.description || `Operation executing procedures for ${uniqueName}.`,
        line_range: sym.line_range
      };
    });

    const finalMap = {
      file: this.getRelativeWorkspacePath(this.filePath),
      generated_at: new Date().toISOString(),
      how_to_use: "This index provides a fast lookup directory of all symbols defined within the target file. Agents can use the 'line_range' attribute to target and view individual sections instead of loading the entire file.",
      actions: compiledSymbols
    };

    const finalMapPath = path.resolve(this.outputDir, `${path.basename(this.filePath, '.js')}.map.json`);
    this.ensureDirectoryExists(this.outputDir);
    fs.writeFileSync(finalMapPath, JSON.stringify(finalMap, null, 2), 'utf-8');
    this.logSuccess(`Final symbols map index successfully written to: ${finalMapPath}`);
  }

  // ==========================================
  // PARSING IMPLEMENTATION
  // ==========================================

  parseSymbols() {
    const symbols = [];
    const totalLines = this.lines.length;
    let activeClass = null;
    let classBraceEnd = 0;

    for (let i = 0; i < totalLines; i++) {
      const line = this.lines[i];

      // Track if we exit active class scope
      if (activeClass && (i + 1) > classBraceEnd) {
        activeClass = null;
      }

      if (this.isClassDeclaration(line)) {
        const classMeta = this.extractClassMetadata(line, i);
        symbols.push(classMeta);
        activeClass = classMeta.name;
        classBraceEnd = classMeta.line_range.end;
      } else if (activeClass && this.isMethodDeclaration(line)) {
        const methodMeta = this.extractMethodMetadata(line, i, activeClass);
        if (methodMeta) {
          symbols.push(methodMeta);
        }
      } else if (!activeClass && this.isFunctionDeclaration(line)) {
        const funcMeta = this.extractFunctionMetadata(line, i);
        symbols.push(funcMeta);
      }
    }
    return symbols;
  }

  extractClassMetadata(line, index) {
    const classMatch = line.match(/^\s*class\s+(\w+)(?:\s+extends\s+(\w+))?/i);
    const className = classMatch[1];
    const extendsClass = classMatch[2] || '';
    const startLine = index + 1;
    const endLine = this.calculateBlockEndLine(index);

    const precedingComments = this.getPrecedingComments(index);
    const goal = this.cleanGoalFromComments(precedingComments);

    return {
      name: className,
      type: 'class',
      extends: extendsClass,
      goal: goal || `Class definition for ${className}`,
      line_range: {
        start: startLine,
        end: endLine
      }
    };
  }

  extractMethodMetadata(line, index, parentClassName) {
    const methodMatch = line.match(/^\s*(?:async|get|set)?\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)\s*\{/);
    if (!methodMatch) return null;

    const methodName = methodMatch[1];
    if (INVALID_METHOD_NAMES.has(methodName)) return null;

    const startLine = index + 1;
    const endLine = this.calculateBlockEndLine(index);

    const precedingComments = this.getPrecedingComments(index);
    const goal = this.cleanGoalFromComments(precedingComments);

    return {
      name: methodName,
      type: 'method',
      parent: parentClassName,
      goal: goal || `Method ${methodName} of ${parentClassName}`,
      line_range: {
        start: startLine,
        end: endLine
      }
    };
  }

  extractFunctionMetadata(line, index) {
    const funcMatch = line.match(/^\s*(?:async)?\s*function\s+(\w+)\s*\(([^)]*)\)\s*\{/i);
    const funcName = funcMatch[1];
    const startLine = index + 1;
    const endLine = this.calculateBlockEndLine(index);

    const precedingComments = this.getPrecedingComments(index);
    const goal = this.cleanGoalFromComments(precedingComments);

    return {
      name: funcName,
      type: 'function',
      goal: goal || `Function ${funcName}`,
      line_range: {
        start: startLine,
        end: endLine
      }
    };
  }

  calculateBlockEndLine(startIndex) {
    let braceCount = 0;
    let foundStartBrace = false;

    for (let i = startIndex; i < this.lines.length; i++) {
      const line = this.lines[i];

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '{') {
          braceCount++;
          foundStartBrace = true;
        } else if (char === '}') {
          braceCount--;
        }
      }

      if (foundStartBrace && braceCount === 0) {
        return i + 1;
      }
    }
    return this.lines.length;
  }

  getPrecedingComments(startIndex) {
    const comments = [];
    let i = startIndex - 1;

    while (i >= 0) {
      const line = this.lines[i].trim();
      if (this.isCommentLine(line)) {
        comments.unshift(line);
        i--;
      } else if (line === '') {
        i--;
      } else {
        break;
      }
    }
    return comments.join(' ');
  }

  cleanGoalFromComments(commentString) {
    if (!commentString) return '';
    return commentString
      .replace(/\/\*\*|\*\/|\/\/|\*/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ==========================================
  // HELPER BOOLEAN PREDICATES
  // ==========================================

  isClassDeclaration(line) {
    return /^\s*class\s+\w+/i.test(line);
  }

  isMethodDeclaration(line) {
    return /^\s*(?:async|get|set)?\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*\([^)]*\)\s*\{/.test(line);
  }

  isFunctionDeclaration(line) {
    return /^\s*(?:async)?\s*function\s+\w+/i.test(line);
  }

  isCommentLine(line) {
    return line.startsWith('//') || line.startsWith('/*') || line.startsWith('*') || line.startsWith('*/');
  }

  // ==========================================
  // SYSTEM & FILE SYSTEM UTILITIES
  // ==========================================

  verifySourceFileExists() {
    if (!fs.existsSync(this.filePath)) {
      throw new Error(`Target source file does not exist: ${this.filePath}`);
    }
    const stat = fs.statSync(this.filePath);
    if (!stat.isFile()) {
      throw new Error(`Target path is not a file: ${this.filePath}`);
    }
  }

  readFileLines() {
    const content = fs.readFileSync(this.filePath, 'utf-8');
    return content.split(/\r?\n/);
  }

  ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
      this.logInfo(`Creating destination directory: ${dirPath}`);
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  getRelativeWorkspacePath(fullPath) {
    const base = 'E:/NAST/Dazzling/GAS';
    return path.relative(base, fullPath).replace(/\\/g, '/');
  }

  // ==========================================
  // LOGGING ENGINE
  // ==========================================

  logInfo(msg) {
    console.log(`[INFO] ${msg}`);
  }

  logSuccess(msg) {
    console.log(`[SUCCESS] ${msg}`);
  }

  logWarning(msg) {
    console.warn(`[WARNING] ${msg}`);
  }

  logError(msg) {
    console.error(`[ERROR] ${msg}`);
  }
}

// ==========================================
// CLI ARGUMENT PARSER & INVOCATION ENTRY
// ==========================================

function main() {
  const args = process.argv.slice(2);
  const params = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--file' || arg === '-f') {
      params.file = args[++i];
    } else if (arg === '--output' || arg === '-o') {
      params.output = args[++i];
    } else if (arg === '--phase' || arg === '-p') {
      params.phase = args[++i];
    } else if (arg === '--descriptions' || arg === '-d') {
      params.descriptions = args[++i];
    }
  }

  if (!params.file) {
    console.error('Usage: node index_symbols.js --file <target_file> [--output <output_dir>] [--phase <draft|compile>] [--descriptions <temp_des_path>]');
    process.exit(1);
  }

  try {
    const indexer = new SymbolIndexer(params.file, params.output);
    indexer.run(params.phase || 'draft', params.descriptions);
  } catch (err) {
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { SymbolIndexer };
