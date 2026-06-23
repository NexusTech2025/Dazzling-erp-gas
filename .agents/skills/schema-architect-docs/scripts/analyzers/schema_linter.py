import os
import re
import argparse
import sys

class SchemaLinter:
    def __init__(self, docs_dir):
        self.docs_dir = docs_dir
        self.errors = []
        self.warnings = []
        self.found_tables = []

    def lint(self):
        print(f"--- Starting Schema Linting in: {self.docs_dir} ---")
        
        # 1. Collect all table documentation files and verify naming
        md_files = [f for f in os.listdir(self.docs_dir) if f.endswith('.md')]
        for filename in md_files:
            table_name = filename[:-3]
            self.found_tables.append(table_name)
            
            # Check PascalCase
            if not re.match(r'^[A-Z][a-zA-Z0-9]*$', table_name):
                self.errors.append(f"File naming violation: '{filename}' should be PascalCase.")

        # 2. Deep inspection of each file
        for filename in md_files:
            file_path = os.path.join(self.docs_dir, filename)
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                self._check_mandatory_sections(filename, content)
                self._check_relationships(filename, content)

        self._report()

    def _check_mandatory_sections(self, filename, content):
        mandatory = [
            r"# 1\. Overview",
            r"## 4\.1 Technical Implementation Summary",
            r"## 4\.2 Inherited System Fields",
            r"# 7\. Sanitization & Cleaning",
            r"# 9\. Performance Considerations",
            r"### Access Patterns"
        ]
        
        for section in mandatory:
            if not re.search(section, content):
                self.errors.append(f"Missing mandatory section in '{filename}': {section.replace('\\', '')}")

    def _check_relationships(self, filename, content):
        # Pattern to find: {{ Table }} → {{ Related Table }}
        # Or more generally look for relationship mentions
        rel_matches = re.findall(r'(\w+)\s*→\s*(\w+)', content)
        for source, target in rel_matches:
            if target not in self.found_tables:
                self.warnings.append(f"Broken relationship in '{filename}': Target table '{target}' not found in documentation directory.")

    def _report(self):
        print(f"\nLinting Summary:")
        print(f"Files Scanned: {len(self.found_tables)}")
        
        if self.errors:
            print(f"\nERRORS ({len(self.errors)}):")
            for err in self.errors:
                print(f"  [!] {err}")
        else:
            print("\n  [✓] No naming or structural errors found.")

        if self.warnings:
            print(f"\nWARNINGS ({len(self.warnings)}):")
            for warn in self.warnings:
                print(f"  [?] {warn}")
        
        if self.errors:
            sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Lint schema documentation for consistency and technical rigor.")
    parser.add_argument("docs_dir", help="Directory containing the .md documentation files")
    args = parser.parse_args()
    
    linter = SchemaLinter(args.docs_dir)
    linter.lint()
