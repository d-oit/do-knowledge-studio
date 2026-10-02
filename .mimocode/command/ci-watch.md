---
description: "Monitor GitHub Actions CI status for a PR or branch. Polls until all checks pass or a failure is detected. Summarizes results with failure details."
---

# CI Watch

Monitor GitHub Actions CI status for a PR or branch. Replaces the manual pattern of repeatedly running `gh run view` and `gh pr checks`.

## Usage

```
/ci-watch <PR# or branch name> [--timeout 1800] [--interval 30]
```

## Arguments

- `$1` — PR number (e.g., `262`) or branch name (e.g., `feat/my-feature`)
- `--timeout` — Max seconds to wait (default: 1800)
- `--interval` — Poll interval in seconds (default: 30)
- `--once` — Check once and exit (no polling)

## Procedure

1. **Resolve target**: If argument is a number, treat as PR number. Otherwise, treat as branch name.
2. **Initial status**: Run `gh pr checks <PR>` or `gh run list --branch <branch> --limit 1` to get current state.
3. **Poll loop** (unless `--once`):
   - Wait `--interval` seconds
   - Check status via `gh pr checks` or `gh run view`
   - If all checks pass → report success and exit
   - If any check fails → extract failure details, report, and exit
   - If timeout reached → report current status and exit
4. **Failure report**: On failure, show:
   - Which check failed (name + conclusion)
   - Link to the failing run
   - First 20 lines of error output from the failing job

## Example Session

```
User: /ci-watch 262

→ Checking PR #262 CI status...
→ Run 24394484360: in_progress (2/5 checks complete)
→ Waiting 30s...
→ Run 24394484360: in_progress (4/5 checks complete)
→ Waiting 30s...
→ Run 24394484360: completed — FAILURE
→ Failed: lint (conclusion: failure)
→ Error output:
    Error: Unexpected unused variable at src/foo.ts:42
→ Fix the issue and re-run: /ci-watch 262
```

## Implementation

Use the companion script for the actual polling logic:

```bash
bash .mimocode/command/ci-watch.sh <PR#|branch> [--timeout N] [--interval N] [--once]
```

Or execute the equivalent `gh` commands inline as described above.
