# Style Guide Configurations

Common style guide configurations for the Code Review Assistant skill.

## Overview

This guide provides configuration examples for popular code style guides and linters used across different programming languages.

## Python

### PEP 8 (Official Python Style Guide)

**Key Rules:**
- Indentation: 4 spaces (no tabs)
- Line length: 79 characters (88 with Black)
- Imports: Grouped (stdlib, third-party, local)
- Naming: snake_case for functions/variables, CamelCase for classes

**Tool Configuration:**

```ini
# .flake8
[flake8]
max-line-length = 88
extend-ignore = E203, W503
exclude = 
    .git,
    __pycache__,
    .venv,
    venv
```

```toml
# pyproject.toml - Black configuration
[tool.black]
line-length = 88
target-version = ['py311']
include = '\.pyi?$'
extend-exclude = '''
/(
  # directories
  \.eggs
  | \.git
  | \.venv
  | build
  | dist
)/
'''
```

### Google Python Style Guide

**Key Differences from PEP 8:**
- Docstrings: Google format (not reStructuredText)
- Type hints: Required for public APIs
- Line length: 80 characters

```python
# Google style docstring
def fetch_data(url: str, timeout: int = 30) -> dict:
    """Fetch data from a URL.

    Args:
        url: The URL to fetch data from.
        timeout: Request timeout in seconds.

    Returns:
        A dictionary containing the response data.

    Raises:
        ConnectionError: If the request fails.
    """
    pass
```

## JavaScript / TypeScript

### Airbnb JavaScript Style Guide

**Key Rules:**
- Quotes: Single quotes for strings
- Semicolons: Required at end of statements
- Trailing commas: Required (multiline)
- Variable declaration: Use `const` or `let` (no `var`)

```json
// .eslintrc.json - Airbnb config
{
  "extends": ["airbnb-base"],
  "rules": {
    "indent": ["error", 2],
    "max-len": ["error", 100, { "ignoreUrls": true }],
    "no-console": "warn",
    "no-unused-vars": "error"
  },
  "env": {
    "browser": true,
    "node": true,
    "es2021": true
  }
}
```

### StandardJS

**Key Rules:**
- No semicolons (ASI)
- Single quotes
- No trailing commas
- Space after function name: `function name (args)`

```json
// .eslintrc.json - Standard config
{
  "extends": ["standard"],
  "rules": {
    "comma-dangle": ["error", "never"],
    "semi": ["error", "never"]
  }
}
```

## Go

### Effective Go + gofmt

**Key Rules:**
- Formatting: Use `gofmt` (no options, standardized)
- Line length: No hard limit, but keep readable
- Naming: Exported = CamelCase, unexported = camelCase
- Braces: Opening brace on same line

```bash
# Format Go code
gofmt -w .

# Or with simplification
gofmt -s -w .
```

### golint + go vet

```yaml
# .golangci.yml
linters:
  enable:
    - golint
    - govet
    - errcheck
    - staticcheck
    - unused
  
linters-settings:
  golint:
    min-confidence: 0.8
  
run:
  timeout: 5m
  skip-dirs:
    - vendor
    - .git
```

## Rust

### Rustfmt

**Key Rules:**
- Indentation: 4 spaces
- Line width: 100 characters (default)
- Imports: Grouped and sorted
- Trailing commas: Always for multiline

```toml
# rustfmt.toml
max_width = 100
hard_tabs = false
tab_spaces = 4
use_small_heuristics = "Default"
reorder_imports = true
reorder_modules = true
remove_nested_parens = true
```

### Clippy

```toml
# .clippy.toml
cognitive-complexity-threshold = 30
too-many-arguments-threshold = 7
type-complexity-threshold = 250
```

## Shell / Bash

### Google Shell Style Guide

**Key Rules:**
- Indentation: 2 spaces
- Line length: 80 characters
- Quoting: Always quote variables ("$var")
- Functions: Use function_name() syntax

```bash
#!/bin/bash
# Good example
process_file() {
  local file="$1"
  local output="$2"
  
  if [[ ! -f "$file" ]]; then
    echo "Error: File not found: $file" >&2
    return 1
  fi
  
  cat "$file" | while IFS= read -r line; do
    echo "Processing: $line"
  done > "$output"
}
```

### ShellCheck

```bash
# Run shellcheck
shellcheck script.sh

# With severity filter
shellcheck --severity=warning script.sh

# Enable extra checks
shellcheck --shell=bash \
  --enable=add-default-case,avoid-nullary-conditions \
  script.sh
```

## Ruby

### RuboCop (StandardRB)

```yaml
# .rubocop.yml
AllCops:
  TargetRubyVersion: 3.1
  NewCops: enable

Layout:
  LineLength:
    Max: 100

Style:
  StringLiterals:
    EnforcedStyle: single_quotes
  
  TrailingCommaInArguments:
    EnforcedStyleForMultiline: comma
```

## Java

### Google Java Style Guide

**Key Rules:**
- Indentation: 2 spaces
- Line length: 100 characters
- Imports: No wildcard imports
- Braces: Required even for single-line blocks

```xml
<!-- checkstyle.xml -->
<!DOCTYPE module PUBLIC
    "-//Checkstyle//DTD Checkstyle Configuration 1.3//EN"
    "https://checkstyle.org/dtds/configuration_1_3.dtd">
<module name="Checker">
    <module name="TreeWalker">
        <module name="LineLength">
            <property name="max" value="100"/>
        </module>
        <module name="Indentation">
            <property name="basicOffset" value="2"/>
            <property name="caseIndent" value="2"/>
        </module>
    </module>
</module>
```

## Configuration Priority

When multiple style guides apply:

1. **Project-specific config** (highest priority)
   - `.editorconfig`
   - Project's linting config files

2. **Team/organization standards**
   - Shared configurations in team repos

3. **Language defaults**
   - PEP 8, Effective Go, etc.

4. **Tool defaults** (lowest priority)
   - Built-in tool configurations

## Automated Enforcement

### Pre-commit Hooks

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.4.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files

  - repo: https://github.com/psf/black
    rev: 23.1.0
    hooks:
      - id: black
        language_version: python3.11

  - repo: https://github.com/pycqa/flake8
    rev: 6.0.0
    hooks:
      - id: flake8

  - repo: https://github.com/shellcheck-py/shellcheck-py
    rev: v0.9.0.2
    hooks:
      - id: shellcheck
```

### CI Integration

```yaml
# .github/workflows/lint.yml
name: Lint

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install black flake8 isort
      
      - name: Run black
        run: black --check .
      
      - name: Run flake8
        run: flake8 .
      
      - name: Run isort
        run: isort --check-only .
```

## Review Integration

The code-review-assistant can check style compliance by:

1. **Detecting language** from file extensions
2. **Finding config files** in the repository
3. **Running appropriate linters** on changed files
4. **Reporting violations** as review comments

Example workflow:

```python
# Check Python files with project config
def check_python_style(files):
    config = find_config(['pyproject.toml', 'setup.cfg', '.flake8'])
    
    for file in files:
        if file.endswith('.py'):
            result = run_linter('flake8', file, config)
            if result.violations:
                add_review_comment(file, result.violations)
```
