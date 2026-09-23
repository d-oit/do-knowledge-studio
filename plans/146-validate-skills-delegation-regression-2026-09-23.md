# Plan 146 — validate-skills.sh Delegation Regression (2026-09-23)

**Type**: regression fix (shell tooling) + CI coverage gap follow-up
**Scope**: `scripts/validate-skills.sh`
**Follows**: plans/145 (PR #806), which introduced the regression

## 1. Problem

PR #806 changed `scripts/validate-skills.sh` so the validator runs through the
provisioned Python interpreter:

```bash
"$VALIDATOR_PYTHON" ./scripts/agent-surface.py validate
```

`tests/validate-skills.bats` encodes the older contract — it stubs
`scripts/agent-surface.py` with a **bash** script and asserts the wrapper
delegates to it (`tests/validate-skills.bats` § "delegates to agent-surface.py",
"prints validation message", "uses REPO_ROOT override for script location").
Feeding a bash stub to a Python interpreter fails, so three tests broke:

```
1..4
not ok 1 delegates to agent-surface.py
ok 2 exits non-zero when agent-surface.py fails
not ok 3 prints validation message
not ok 4 uses REPO_ROOT override for script location
```

The full gate on `main` therefore failed:

```
  ✓ shellcheck passed
  ✗ bats tests failed
│ ✗ Quality Gate FAILED
```

## 2. Why CI did not catch it

`./scripts/quality_gate.sh` (scope `all`) runs the BATS suite and failed
locally. CI runs `./scripts/quality_gate.sh --changed`, and the Quality Gate
check on both #806 (`ba6c3b8`) and #807 (`47e9a24`) completed in **30 s and
39 s** respectively — far below the several minutes a gate that includes the
shell/BATS section takes, so that section did not run.

The `--changed` scope detection (§3 of this plan) explains how it can be
skipped: it derives the file list from `git diff --name-only "$BASE_BRANCH"`,
falling back to `git diff --name-only HEAD~1` when that fails. A PR checkout
has no local `main` branch, so the fallback sees only the **last commit** of
the PR — and the shell/BATS section is gated on the resulting `HAS_TOOLING` /
`HAS_AGENT` flags. A commit that touches only `e2e/` and `plans/` sets neither.

This is recorded as a follow-up (§4) rather than fixed here: it changes CI
behaviour for every PR and deserves its own plan and verification.

## 3. Fix

Keep the dependency provisioning, restore the delegation contract. The
validator is executed directly again, and the cached virtual environment is
placed **in front of `PATH`** so `agent-surface.py`'s own
`#!/usr/bin/env python3` shebang resolves to an interpreter that has PyYAML:

```bash
if ! "$PYTHON_BIN" -c 'import yaml' >/dev/null 2>&1; then
  mkdir -p "$VALIDATOR_CACHE_DIR"
  if [ ! -x "$VALIDATOR_VENV_DIR/bin/python" ]; then
    "$PYTHON_BIN" -m venv "$VALIDATOR_VENV_DIR"
  fi
  if ! "$VALIDATOR_VENV_DIR/bin/python" -c 'import yaml' >/dev/null 2>&1; then
    "$VALIDATOR_VENV_DIR/bin/python" -m pip install --disable-pip-version-check "PyYAML==$PY_YAML_VERSION"
  fi
  PATH="$VALIDATOR_VENV_DIR/bin:$PATH"
  export PATH
fi

echo "Validating skills via agent-surface.py..."
./scripts/agent-surface.py validate
```

The behaviour #806 wanted (no manual PyYAML install) is unchanged; what
changes is *how* the interpreter is selected. `PYTHON_BIN` still selects the
interpreter used to build the venv, and the cache location is still
`$XDG_CACHE_HOME/do-knowledge-studio/agent-surface`.

## 4. Verification

| Check | Result |
|---|---|
| `bats tests/validate-skills.bats` | 4/4 pass (was 1/4) |
| `shellcheck --severity=warning scripts/validate-skills.sh` | clean |
| `./scripts/validate-skills.sh` | `Agent surface validation passed.` |
| `./scripts/quality_gate.sh` (scope `all`) | ✓ all gates passed — bats, shellcheck, lint, typecheck, tests, links |

The dependency fallback was exercised end-to-end with an interpreter that
cannot import PyYAML — a throwaway venv used as `PYTHON_BIN`, with a temporary
cache directory:

```bash
PYTHON_BIN=/tmp/noyaml/bin/python3 XDG_CACHE_HOME=/tmp/vcache ./scripts/validate-skills.sh
```

It created the cached venv, installed `PyYAML==6.0.3`, and the validator's
shebang resolved to that interpreter: `Agent surface validation passed.`

## 5. Follow-ups

1. **`quality_gate.sh --changed` can silently skip the shell/BATS section**
   (§2) — the base-branch diff fails in a PR checkout and degrades to the last
   commit only. Fixing it means resolving the base ref explicitly (for example
   from `GITHUB_BASE_REF` or a fetched merge base) and failing closed when no
   base can be determined. Needs its own plan: it changes what CI enforces for
   every PR.
2. **DeepSource quota** (plans/141 §1) — account-level, needs the maintainer.
3. **ESLint 10 workaround** (plans/140 §2) — blocked upstream.
