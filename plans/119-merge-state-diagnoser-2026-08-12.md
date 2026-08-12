# Plan 119 — PR Merge-State Diagnosis: Incident + Automated Diagnoser

Date: 2026-08-12
Status: RESOLVED

## Incident (PR #652)

PR #652 (ADR 032 + store cache reset wiring) showed
`mergeStateStatus: BLOCKED` while `gh pr checks` reported every check as
SUCCESS. Merge attempts failed with "the base branch policy prohibits the
merge" for over an hour.

### Diagnosis sequence

1. Verified the ruleset endpoints (Codacy is the only required check;
   approvals required = 0; stale-review dismissal off) — all satisfied.
2. Verified no unresolved review threads and no `CHANGES_REQUESTED`
   reviews — none.
3. `commits/{sha}/check-runs` on the head commit revealed the real
   blocker: a fresh "Unit Tests" run was still `in_progress` (the
   empty-commit nudge had re-triggered CI). This was NOT staleness.
4. After all 36 check runs completed green, the state remained BLOCKED —
   genuine staleness. It survived an empty-commit nudge and a
   close/reopen. Auto-merge re-arming hung (gh CLI) / 404'd (API).
5. Per AGENTS.md, `--admin` was requested and explicitly approved by the
   user; the squash merge completed.

### Root causes

- `gh pr checks` aggregates per-check state and can show stale SUCCESS
  while the head commit has in-flight runs.
- GitHub merge-state staleness (plans/098) can persist through nudge and
  close/reopen.
- `--admin` is the final rung and requires explicit user approval.

## Resolution

- **LESSON-028** recorded (LESSONS.md, lessons.jsonl, AGENTS.md):
  diagnose BLOCKED in order — ruleset required checks, threads, then
  in-flight check-runs on the head SHA — before declaring staleness.
- **`pr-merge-state-diagnoser.yml`**: new workflow that posts one
  idempotent comment (marker `<!-- blocked-pr-diagnoser -->`) on BLOCKED
  PRs naming the real blocker: in-flight runs, failing runs, or an
  all-green staleness note with the remediation ladder. The comment is
  updated in place and deleted when the PR is no longer blocked.
- Template + properties added under `.github/workflow-templates/`;
  README table and section updated; workflow tests added to
  `src/lib/__tests__/workflows.test.ts`.

## Verification

- Full quality gate on main: typecheck, ESLint, production build clean;
  480/480 Playwright matrix (all four projects); full unit suite passed.
- Workflow validated with yamllint and actionlint; workflow tests pass.

## Follow-up hardening (PR #654, merged)

- All diagnosis logic extracted from the workflow YAML into
  `scripts/diagnose-merge-state.sh` (executable, shellcheck-clean). The
  workflow and template are thin wrappers that invoke it with env inputs,
  so the duplicated bash can never drift.
- `scripts/verify.sh` gained a "YAML Lint (CI parity)" check running the
  exact CI yamllint invocation (inline `-d` config, 120-char limit) — the
  local-vs-CI config drift that failed the first #653 CI run.

## Smoke test (throwaway PR #655, closed unmerged)

End-to-end verification of the diagnoser on a live PR:

- **Create** (`opened` + blocked): ✅ comment posted naming in-flight
  checks, via the real script and live API.
- **Update in place** (`synchronize`): ✅ PATCH — count stayed 1 and the
  body refreshed with the new run list.
- **Delete** (clean state): ✅ verified locally via the mocked-gh BATS
  suite (`tests/diagnose-merge-state.bats`); the smoke PR's state went
  permanently stale (the exact plans/098 scenario), so no clean-state
  event could fire end-to-end.
- **Script-based run**: ✅ the diagnoser posted on #655 via
  `scripts/diagnose-merge-state.sh`.

Findings: create/update are verified end-to-end; the deletion path is
covered by the committed BATS suite (`bats tests/`, 9 tests, mocked `gh`
covering in-progress, failures, staleness, PATCH idempotency, DELETE
cleanup, fork skip, and missing-env failure). BATS runs in quality_gate.sh
and scripts/verify.sh whenever tests/ exists, so the regression suite is
part of CI.

## Follow-up hardening (PR #657–#658)

- Mocked-`gh` harness extracted to `tests/helpers/mock-gh.bash`;
  `run_check` extracted to `scripts/lib/run-check.sh` with its own BATS
  coverage. Suite now 19 tests (12 diagnoser + 7 run-check).
- **LESSON-029**: ubuntu-latest runners do not ship bats-core — the suite
  had never run in CI. CI quality-gate and cleanup jobs now install bats;
  `quality_gate.sh` FAILS when `tests/` is missing and treats `^tests/`
  as tooling scope; `verify.sh` gained a `shellcheck --shell=bats` lint
  pass (caught SC2314 vacuous negative assertions in the suite).
- **PR #659**: `verify.sh` gained a "Shell Lint (CI parity)" check running
  the exact security-scan shellcheck invocation (`--enable=` flags),
  end-to-end pass/fail gate tests with a stubbed PATH, and
  `tests/README.md` documenting the bats conventions.
- **PR #660**: yamllint CI-parity guard test; BATS suite for
  `validate-github-actions-shas.sh` (found and fixed a real bug — the
  placeholder regex's block pattern used `\1` for a group-2 backref,
  making grep error out and the check silently never fire);
  `scripts/lib/README.md` documenting the shared shell libraries.
- **PR #661**: quality_gate.sh BATS-coverage pairing guard (`diff-filter=A`
  ensures every *new* scripts/*.sh ships with a matching .bats file);
  inline-comment edge tests for the SHA validator; full re-verification
  sweep on main: 473 e2e pass, verify.sh + quality_gate.sh clean.
