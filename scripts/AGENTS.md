# scripts/ AGENTS.md

> Scoped guidance for agents working in this directory.
> Nearest AGENTS.md takes precedence over root.

## Protected Scripts

Do NOT modify without explicit user instruction:
- `quality_gate.sh` - Core quality gate
- `pre-commit-hook.sh` - Git hook template
- `setup-skills.sh` - Skill symlink creation

## Naming Convention

Scripts use `snake_case.sh`. New scripts must follow this convention.

## REPO_ROOT Detection

Every script must detect repo root portably:
```bash
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
```
Never hardcode paths.

## Non-Obvious Lessons

- `validate-skills.sh` and `validate-skill-format.sh` must use `set +e` explicitly to allow full error report (LESSON-011)
- Avoid generic Bash variables like `temp_table` in global scope; use script-specific prefixes (LESSON-012)
- CI hangs can be caused by BATS recursion if a script under test calls BATS itself (LESSON-013)
- Use `--severity=error` in Shellcheck CI to prevent style warnings from blocking functional PRs (LESSON-014)
- GitHub API 403 errors in CI usually mean the workflow needs explicit `permissions: issues: write` (LESSON-015)
- Linting results for `shellcheck` and `markdownlint` are cached in `.git/lint-cache/` to speed up subsequent runs. The cache is per-file and aware of configuration changes.

## Adding a New Script

1. Must pass `shellcheck` with no warnings
2. Must have a `bats` test if stateful
3. Add to `agents-docs/SCRIPTS.md`
4. Use `#!/usr/bin/env bash` shebang
