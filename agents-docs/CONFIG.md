# Configuration Reference

> Centralized configuration for AI agent template repository.  
> `agents-docs/CONFIG.md` - Detailed reference for `.agents/config.sh`

## Overview

`.agents/config.sh` is the **machine-readable single source of truth** for all repository constants. It contains named constants, utility functions, and configuration values used across scripts.

## Why Separate from AGENTS.md?

| File | Purpose | Audience |
|------|---------|----------|
| `AGENTS.md` | Human-readable guidelines, style rules | AI agents (Claude, Gemini, OpenCode, etc.) |
| `.agents/config.sh` | Machine-readable constants, shell functions | Bash scripts, quality gates, CI/CD |

**Benefits:**
- Scripts can `source` constants directly (no copy-paste errors)
- Single source of truth - change in one place, applies everywhere
- `AGENTS.md` uses shell variable references (e.g., `` `${MAX_LINES_PER_SOURCE_FILE}` ``) that stay in sync
- Linting and validation tools can source the same values

## Usage in Scripts

Source the config file at the start of your script:

```bash
#!/bin/bash
# Source config.sh from script location
source "$(dirname "$0")/../.agents/config.sh"

# Now use the constants
echo "Max lines per file: $MAX_LINES_PER_SOURCE_FILE"
log_info "Starting process..."
```

**Pattern breakdown:**
- `$(dirname "$0")` - Gets the directory where your script lives
- `/../.agents/config.sh` - Navigates up to project root, then into `.agents/`
- Works regardless of where the script is called from

## Available Constants

### File Size Limits

```bash
readonly MAX_LINES_PER_SOURCE_FILE=500     # Scripts, code files
readonly MAX_LINES_PER_SKILL_MD=250        # SKILL.md files
readonly MAX_LINES_PER_CONFIG_FILE=250     # Config files
readonly MAX_LINES_AGENTS_MD=150           # AGENTS.md (AGENTS.md only)
readonly MAX_CONTEXT_TOKENS=4000           # Context tokens for memory retrieval
```

### Retry and Polling

```bash
readonly DEFAULT_MAX_RETRIES=3             # Max retry attempts
readonly DEFAULT_RETRY_DELAY_SECONDS=5     # Delay between retries
readonly DEFAULT_POLL_INTERVAL_SECONDS=5    # Poll check interval
readonly DEFAULT_MAX_POLL_ATTEMPTS=12       # Max polls before timeout
readonly DEFAULT_TIMEOUT_SECONDS=1800       # Operation timeout (30 min)
```

### Git / PR Configuration

```bash
readonly MAX_COMMIT_SUBJECT_LENGTH=72       # Commit subject max chars
readonly MAX_PR_TITLE_LENGTH=72              # PR title max chars
readonly MAX_PR_BODY_LINE_LENGTH=80         # PR description line max
```

### Quality Thresholds

```bash
readonly MIN_TEST_COVERAGE_PERCENT=80       # Minimum test coverage
readonly MAX_ALLOWED_WARNINGS=0              # Warnings allowed (0=strict)
readonly MAX_ALLOWED_LINT_ERRORS=0           # Lint errors allowed
```

### Atomic Commit Configuration

```bash
readonly ATOMIC_COMMIT_TIMEOUT_VAR="ATOMIC_COMMIT_TIMEOUT"
readonly ATOMIC_COMMIT_NO_ROLLBACK_VAR="ATOMIC_COMMIT_NO_ROLLBACK"
readonly ATOMIC_COMMIT_CI_MODE_VAR="ATOMIC_COMMIT_CI_MODE"
readonly ATOMIC_COMMIT_DEFAULT_TIMEOUT=1800
```

### Skill Validation

```bash
readonly SKILL_REQUIRED_FIELDS=("name" "description")
readonly SKILL_RECOMMENDED_FIELDS=("license")
readonly SKILL_CATEGORIES=("Security" "Coordination" "UI/UX" "APIDevelopment" ...)
```

### Directory Structure

```bash
readonly SKILLS_SOURCE_DIR=".agents/skills"
readonly CLAUDE_DIR=".claude"
readonly OPCODE_DIR=".opencode"
readonly GEMINI_DIR=".gemini"
readonly QWEN_DIR=".qwen"
```

### Color Codes

Available when stdout is a terminal (auto-disabled in CI):

```bash
readonly COLOR_RED='\033[0;31m'
readonly COLOR_GREEN='\033[0;32m'
readonly COLOR_YELLOW='\033[1;33m'
readonly COLOR_BLUE='\033[0;34m'
readonly COLOR_PURPLE='\033[0;35m'
readonly COLOR_CYAN='\033[0;36m'
readonly COLOR_RESET='\033[0m'
readonly COLOR_BOLD='\033[1m'
```

Disable colors with `FORCE_COLOR=0`.

## Utility Functions

### Logging Functions

```bash
log_info "Message"       # [INFO] in blue
log_success "Message"    # [PASS] in green
log_warning "Message"    # [WARN] in yellow (to stderr)
log_error "Message"      # [ERROR] in red (to stderr)
log_section "Header"     # Bold cyan header with newline
```

### Helper Functions

```bash
command_exists "docker"           # Check if command exists (returns 0/1)
count_content_lines "file.sh"     # Count non-empty, non-comment lines
is_valid_version "1.2.3"        # Validate semantic version format
is_ci                              # Check if running in CI (returns 0/1)
get_git_relative_path              # Get path from git root (e.g., "scripts/")
```

## Complete Example

```bash
#!/bin/bash
set -euo pipefail

# Source config
source "$(dirname "$0")/../.agents/config.sh"

# Use constants
log_section "Validation"

file="$1"
lines=$(wc -l < "$file")

if [[ $lines -gt $MAX_LINES_PER_SOURCE_FILE ]]; then
    log_error "File too long: $lines lines (max: $MAX_LINES_PER_SOURCE_FILE)"
    exit 1
fi

log_success "File length OK: $lines lines"

# Use utilities
if command_exists "shellcheck"; then
    log_info "Running shellcheck..."
    shellcheck "$file"
    log_success "No issues found"
else
    log_warning "shellcheck not installed"
fi
```

## CI/CD Integration

GitHub Actions can source the same config:

```yaml
- name: Run validation
  run: |
    source .agents/config.sh
    echo "Max PR title length: $MAX_PR_TITLE_LENGTH"
    # ... validation logic
```

## Modifying Constants

When changing values in `.agents/config.sh`:

1. **Update this file** (`agents-docs/CONFIG.md`) to match
2. **Check `AGENTS.md`** - ensure variable references are consistent
3. **Run quality gate** - verify nothing breaks: `./scripts/quality_gate.sh`
4. **Commit** with message like `refactor: increase MAX_LINES_PER_SKILL_MD to 300`

## Reference

- `../.agents/config.sh` - The actual configuration file
- `../AGENTS.md` - Human-readable guidelines (references these constants)
