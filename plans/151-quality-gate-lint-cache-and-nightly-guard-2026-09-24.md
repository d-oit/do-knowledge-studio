# Plan 151 — Quality-Gate Lint-Cache Fallback + Nightly Scope Guard (2026-09-24)

**Type**: tooling correctness + CI hardening
**Scope**: `scripts/quality_gate.sh`, `.github/workflows/ci-and-labels.yml`,
`tests/quality-gate-lint-cache.bats`, `src/lib/__tests__/workflows.test.ts`
**Follows**: plans/147 §4.1 (lint cache), plans/149 §5.1 (nightly confirmation)

## 1. `lint_cache.sh` was required but optional (plans/147 §4.1)

`quality_gate.sh` sources `scripts/lib/lint_cache.sh` only when the file exists,
but calls `lint_if_changed` unconditionally in two places (shellcheck, ~line 581;
markdownlint, ~line 661). With the library absent the helper is undefined, so
each call fails as `command not found` and the gate reports

```
✗ shellcheck failed: <file>      # for every shell file
✗ markdownlint failed: <file>    # for every markdown file
```

That is a **false failure**, and the cause is invisible: the shellcheck call
redirects stderr to `/dev/null`, so the `command not found` never reaches the
log. Fail-closed was the right instinct, but the message accused the wrong thing.

**Fix.** An `else` branch defines an uncached fallback and says so once:

```bash
echo "Warning: scripts/lib/lint_cache.sh is missing - lints run uncached" >&2
lint_if_changed() {
    shift 3
    "$@"
}
```

The contract is unchanged — first three arguments are consumed, the rest is the
command — so both call sites keep working, and a real finding still fails the
gate. Fail-soft, not fail-open.

## 2. A scheduled run had no guaranteed scope (plans/149 §5.1)

The nightly's job graph is `e2e-tests needs [changes, unit-tests]`, and both gate
on `needs.changes.outputs.any_code == 'true'`. On a scheduled run there is no
diff, so that value came from `dorny/paths-filter`'s fallback (list every file as
added) — verified in the `2026-09-24T07:59Z` run, which reported
`Detected 1404 changed files` with `any_code = true`. It worked, but **by
accident**: had the filter resolved to `false`, `unit-tests` would be skipped and
`e2e-tests` — which needs it — skipped with it. That is the same class of silent
no-op plans/149 fixed one layer up, so it is now explicit instead of incidental.

A `forced` step in the `changes` job writes all three outputs as `true` when the
event is `schedule` or `workflow_dispatch`, and every job output prefers it:

```yaml
if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
```

Pull requests and pushes keep the real diff, so PR scope and cost are untouched
(the full four-project sweep stays nightly-only, plans/149 §5.3).

### Why the nightly looked broken today

The `07:59Z` scheduled run skipped every job — including Unit Tests and E2E. It
was **not** a regression: the run's head was `064702a` (2026-09-23 21:47), which
predates the plans/149 fix (`9d693ba`, 2026-09-24 10:14 UTC). The schedule fires
against the workflow on the default branch at trigger time, so today's run used
the pre-fix file. The next nightly is the first scheduled execution of the fixed
workflow.

Observed cadence, for the record: the cron is `0 3 * * *`, but GitHub has fired
this workflow at `07:40`–`08:24Z` every day for the last week (7/7 runs). The
delay is GitHub's scheduler, not this repository; the daily sweep is what
matters, and `workflow_dispatch` remains the on-demand lever.

## 3. Verification

| Check | Result |
|---|---|
| `bats tests/quality-gate-lint-cache.bats` | 3/3 pass |
| Mutation: revert §1, rerun the suite | test 1 fails (`status` non-zero — the false failure is reproduced), tests 2–3 pass |
| `pnpm exec vitest run src/lib/__tests__/workflows.test.ts` | 64/64 pass |
| Mutation: drop the `forced` step, rerun | the new contract test fails |
| `./scripts/quality_gate.sh` | see §4 |

`tests/quality-gate-lint-cache.bats` builds a throwaway repository with **no**
`scripts/lib/lint_cache.sh` and stub linters on `PATH`, so it is independent of
whether shellcheck/markdownlint are installed and of their versions. Test 2 pins
the other direction: a stub that exits 1 must still fail the gate.

### Review finding on the workflow contract test

The first version of the contract test asserted the forced term with `toContain`
and checked only `any_code=true`. Both were too weak, and the second was wrong in
a way that matters:

- **Ordering.** In a GitHub Actions `||` chain the first non-empty term wins, so
  a forced term placed *after* the filter would never apply — and `toContain`
  passes anyway. The test now splits each output expression on `||` and asserts the
  exact order: forced, filter, diff-API default.
- **Emissions.** Only one of the three emissions was asserted, so deleting
  `frontend=true` or `tooling=true` would have passed while restoring the
  fallback-dependent value for that output. All three are now asserted.

Both gaps were confirmed by mutation before pushing: reordering the `frontend`
output and deleting the `frontend=true` emission each fail the test.

## 4. Gate and CI results

| Check | Result |
|---|---|
| `./scripts/quality_gate.sh` (full, all scopes) | **✓ All Quality Gates PASSED** — lint, typecheck, test, shellcheck, `bats tests/`, link validation |
| `yamllint` (CI-parity config) on `.github/` | exit 0 — and the two warnings this file carried (`truthy` on `on:`, `comments-indentation` on the `workflow_dispatch` comment) are now cleared |
| `actionlint .github/workflows/ci-and-labels.yml` | exit 0 — the SC2129 findings in both output steps are gone |

## 5. Follow-ups

1. **`SC2002` in the coverage job** — `COVERAGE=$(cat coverage/coverage-summary.json | jq …)`
   (`ci-and-labels.yml`, "Generate coverage badge"). Pre-existing and style-level
   (`actionlint` runs with `fail_level: error`), so it does not fail CI; it is the
   last finding in that file and unrelated to this change.
2. **Confirm the next nightly** — the first scheduled execution of the guarded
   workflow. `gh api "repos/d-oit/do-knowledge-studio/actions/runs?event=schedule"`
   and check `E2E Tests` is not `skipped`.
   → **Mechanism proven on `main`** (dispatch run
   [`36048842590`](https://github.com/d-oit/do-knowledge-studio/actions/runs/36048842590),
   head `55033bf`): `Treat every path as changed on scheduled and manual runs`
   ran, **Unit Tests ran** instead of being skipped, and `E2E Tests` swept
   `604 tests` with `600 passed` in 9.9 min across all four projects. The guarded
   path and the scheduled path differ only in `github.event_name`, which the
   contract test pins — the remaining confirmation is the next 03:00 UTC
   (observed ~08:00 UTC) scheduled run.
3. **`semantic-search.spec.ts` load sensitivity** (plans/148 §6.1) — unchanged.
4. **ESLint 10 workaround** (plans/140 §2) — still blocked upstream.
5. **Graph density** (plans/148 §6.3) — the remaining item from the same follow-up
   sweep; tracked in plans/152.
