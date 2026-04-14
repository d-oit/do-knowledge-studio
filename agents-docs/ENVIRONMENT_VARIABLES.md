# Environment Variables Reference

> Reference doc - not loaded by default.

Complete reference for all environment variables used across the AI agent template repository.

## Table of Contents

- [Quality Gate Variables](#quality-gate-variables)
- [Atomic Commit Variables](#atomic-commit-variables)
- [Validation Variables](#validation-variables)
- [CI/CD Detection Variables](#cicd-detection-variables)
- [Output Control Variables](#output-control-variables)

---

## Quality Gate Variables

### `SKIP_TESTS`

**Description**: Skip test execution in the quality gate.

**Default**: `false`

**Example Usage**:
```bash
SKIP_TESTS=true ./scripts/quality_gate.sh
```

**When to Use**:
- Running quick lint/format checks only
- CI environments where tests are run separately
- Troubleshooting quality gate failures (isolate test issues)

---

### `SKIP_CLIPPY`

**Description**: Skip Clippy linting for Rust projects.

**Default**: `false`

**Example Usage**:
```bash
SKIP_CLIPPY=true ./scripts/quality_gate.sh
```

**When to Use**:
- Rust projects where Clippy warnings are being addressed separately
- Quick format checks without full linting
- CI optimization when Clippy runs in a separate job

---

### `SKIP_GLOBAL_HOOKS_CHECK`

**Description**: Skip validation of global git hooks configuration.

**Default**: `false`

**Example Usage**:
```bash
SKIP_GLOBAL_HOOKS_CHECK=true git commit -m "feat: add feature"
./scripts/install-hooks.sh  # During setup
```

**When to Use**:
- When global hooks path is intentionally set and you need to commit anyway
- Installing hooks in environments with custom git configurations
- Emergency commits when hook validation is blocking

---

## Atomic Commit Variables

### `ATOMIC_COMMIT_TIMEOUT`

**Description**: Timeout for atomic commit operations (in seconds).

**Default**: `1800` (30 minutes)

**Example Usage**:
```bash
ATOMIC_COMMIT_TIMEOUT=3600 ./scripts/atomic-commit/run.sh
```

**When to Use**:
- Slow CI environments requiring longer wait times
- Large projects with extensive test suites
- Network latency issues with remote verification

---

### `ATOMIC_COMMIT_NO_ROLLBACK`

**Description**: Disable automatic rollback on failure.

**Default**: `0` (rollback enabled)

**Example Usage**:
```bash
ATOMIC_COMMIT_NO_ROLLBACK=1 ./scripts/atomic-commit/run.sh
```

**When to Use**:
- Debugging atomic commit failures (preserve state)
- Manual intervention required for failed operations
- Custom rollback procedures in CI/CD pipelines

---

### `ATOMIC_COMMIT_CI_MODE`

**Description**: Enable CI-specific atomic commit behavior.

**Default**: Not set (interactive mode)

**Example Usage**:
```bash
ATOMIC_COMMIT_CI_MODE=true ./scripts/atomic-commit/run.sh
```

**When to Use**:
- Non-interactive environments (GitHub Actions, GitLab CI)
- Headless automation scripts
- Disables prompts and assumes default answers

---

## Validation Variables

### `MAX_SKILL_LINES`

**Description**: Override the maximum allowed lines per `SKILL.md` file.

**Default**: `250`

**Example Usage**:
```bash
MAX_SKILL_LINES=300 ./scripts/quality_gate.sh
```

**When to Use**:
- Large skills requiring more documentation space
- Temporary override during skill refactoring
- Legacy skills migration period

---

## CI/CD Detection Variables

### `CI`

**Description**: Detect CI environment (set automatically by most CI providers).

**Default**: Not set (local development)

**Detected Values**:
- `true` - Running in CI environment

**Example Usage**:
```bash
if [ "${CI:-}" == "true" ]; then
    echo "Running in CI mode"
fi
```

**When to Use**:
- Scripts automatically detect this - rarely set manually
- Force CI behavior in local testing
- Override CI detection for debugging

**Common CI Providers**:
- GitHub Actions (sets both `CI` and `GITHUB_ACTIONS`)
- GitLab CI
- Travis CI
- CircleCI
- Jenkins

---

### `GITHUB_ACTIONS`

**Description**: Detect GitHub Actions environment (set automatically).

**Default**: Not set (local development)

**Detected Values**:
- Any non-empty value indicates GitHub Actions

**Example Usage**:
```bash
if [ -n "${GITHUB_ACTIONS:-}" ]; then
    echo "Running in GitHub Actions"
fi
```

**When to Use**:
- GitHub Actions-specific behavior
- Conditional logic for GitHub-specific features (`gh` CLI)
- Debugging workflow issues locally

---

## Output Control Variables

### `FORCE_COLOR`

**Description**: Force color output even in non-TTY environments.

**Default**: Not set (auto-detect based on TTY)

**Accepted Values**:
- `1` or any non-zero - Force colors on
- `0` - Force colors off

**Example Usage**:
```bash
FORCE_COLOR=1 ./scripts/quality_gate.sh | cat  # Force colors through pipe
FORCE_COLOR=0 ./scripts/quality_gate.sh        # Disable colors in terminal
```

**When to Use**:
- CI logs that support ANSI color codes
- Piped output that needs color preservation
- Disabling colors for log file capture
- Enabling colors in non-interactive terminals

---

## Quick Reference Table

| Variable | Type | Default | Scope |
|----------|------|---------|-------|
| `SKIP_TESTS` | boolean | `false` | Quality gate |
| `SKIP_CLIPPY` | boolean | `false` | Quality gate (Rust) |
| `SKIP_GLOBAL_HOOKS_CHECK` | boolean | `false` | Git hooks |
| `ATOMIC_COMMIT_TIMEOUT` | integer | `1800` | Atomic commit |
| `ATOMIC_COMMIT_NO_ROLLBACK` | boolean | `0` | Atomic commit |
| `ATOMIC_COMMIT_CI_MODE` | boolean | not set | Atomic commit |
| `MAX_SKILL_LINES` | integer | `250` | Skill validation |
| `CI` | string | not set | CI detection |
| `GITHUB_ACTIONS` | string | not set | CI detection |
| `FORCE_COLOR` | string | not set | Output control |

---

## Combining Variables

Multiple variables can be combined:

```bash
# CI mode with no rollback for debugging
ATOMIC_COMMIT_CI_MODE=true ATOMIC_COMMIT_NO_ROLLBACK=1 ./scripts/atomic-commit/run.sh

# Quick quality check (no tests, no clippy)
SKIP_TESTS=true SKIP_CLIPPY=true ./scripts/quality_gate.sh

# Full CI run with extended timeout
CI=true ATOMIC_COMMIT_TIMEOUT=3600 ./scripts/atomic-commit/run.sh
```

---

## See Also

- `references/quality-gate.md` - Quality gate documentation
- `references/atomic-commit.md` - Atomic commit workflow
- `TROUBLESHOOTING.md` - Common issues and solutions
