## LESSON-029: GitHub ubuntu-latest runners do not ship bats-core

**Issue**: The diagnoser BATS suite (tests/) passed 12/12 locally but had
NEVER executed in CI. `quality_gate.sh` only ran `bats tests/` when the
`tests/` dir existed and bats was installed, otherwise printing a warning
and continuing — and ubuntu-latest images ship shellcheck/yamllint but not
bats. A tests-only PR also failed to set `HAS_TOOLING` in `--changed`
scope, so the whole shell-check block (including BATS) was skipped
silently. The suite was green on every PR without ever running.

**Root Cause**:

- The ubuntu-latest runner image does not include bats-core; a gate that
  warns-and-continues on missing bats silently skips the suite in CI.
- `--changed` scope detection matched `scripts/`, `.github/`, and
  `package.json` for tooling, but not `tests/` — so tests-only changes
  skipped shell checks entirely.
- Bats 1.10 warns (BW02) unless `bats_require_minimum_version 1.5.0` is
  declared; without it, `run ! cmd` does not negate and instead tries to
  execute `!` (status 127).

**Prevention**:

- CI quality-gate and cleanup jobs install bats explicitly
  (`sudo apt-get install -y bats`) before running the gate.
- `quality_gate.sh` now FAILS when `tests/` is missing (never silently
  skips) and treats `^tests/` as tooling scope in `--changed` mode.
- `scripts/verify.sh` gained a "Shell Lint (BATS)" pass
  (`shellcheck --shell=bats -S warning`), which also catches SC2314
  (`!` does not fail a bats test — use `run !` + `bats_require_minimum_version`).

**Tags**: #github-actions #bats #runner-images #quality-gate #ci
