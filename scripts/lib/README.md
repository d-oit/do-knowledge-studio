# Shared Shell Libraries

Reusable bash helpers for `scripts/*.sh`. Keep them small, focused, and
shellcheck-clean — they are linted by both `scripts/verify.sh` and CI.

## Libraries

- `run-check.sh` — the verification gate plumbing used by
  `scripts/verify.sh`: color tokens (`RED`/`GREEN`/`BLUE`/`YELLOW`/`NC`),
  the caller-owned `FAILED` flag, and `run_check <name> <cmd...>` which
  reports ✓/✗ and sets `FAILED=1` on failure. `run_check` always returns
  0 so `set -e` callers keep running the remaining checks.
- `lint_cache.sh` — file-hash cache (`lint_if_changed`) so quality gates
  skip unchanged files. Used by `scripts/quality_gate.sh`.
- `workflow-monitor.sh` — shared `monitor_parse_checks` helper used by the
  GitHub workflow skill scripts to classify pending, failed, and warning
  check output consistently.

## Sourcing

Source relative to the calling script's location, never rely on CWD:

```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source-path=scripts
# shellcheck source=lib/run-check.sh
source "$SCRIPT_DIR/lib/run-check.sh"
```

Skill scripts source the same library through the repository root:

```bash
# shellcheck source=scripts/lib/workflow-monitor.sh
source "$REPO_ROOT/scripts/lib/workflow-monitor.sh"
```

The `# shellcheck source-path=scripts` / `source=` directive pair lets
shellcheck follow the library regardless of the invocation CWD.

## Conventions

- **Guard against double-loading.** Every library starts with a loaded
  sentinel so re-sourcing is idempotent:

  ```bash
  if [[ -z "${MY_LIB_LOADED:-}" ]]; then
    MY_LIB_LOADED=1
    # definitions...
  fi
  ```

- **Export shared state deliberately.** Vars meant for the sourcing
  script (e.g. `FAILED`, the color tokens) are exported with a comment —
  this both documents the contract and silences SC2034 legitimately.
- **Library files must not execute anything at load time** beyond
  variable/function definitions; side effects belong to the caller.
- **Keep every library under `scripts/lib/`** and follow the existing
  naming (both `run-check.sh` and `lint_cache.sh` are in use — prefer a
  `-` separator for new files and don't rename existing ones).

## Adding a library

1. Write the definitions behind a `*_LOADED` guard.
2. Shellcheck it with `shellcheck --shell=bash -S warning`.
3. Add BATS coverage in `tests/` following `tests/verify-run-check.bats`
   (see `tests/README.md` for the suite conventions).
