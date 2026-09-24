# Plan 149 — Nightly E2E Sweep Covers Every Viewport (2026-09-24)

**Type**: CI coverage extension + test robustness
**Scope**: `.github/workflows/ci-and-labels.yml`, `e2e/semantic-search.spec.ts`
**Follows**: plans/148 §6.1–6.2, plans/122 W2 (which introduced the nightly E2E job)

## 1. Problem

CI's E2E job installs **Chromium only** and runs `pnpm run test:e2e
--project=chromium`. The `mobile` (iPhone 13, 390×664) and `tablet` (iPad Pro 11,
834×1194) projects are **WebKit** device descriptors, so they have never run in
CI — not on PRs, not in the nightly sweep that plans/122 added.

That gap is not theoretical: the graph label-click defect in plans/148 reached
`main` and was only caught by a manual four-project sweep. Playwright's own log
showed the failure at `chromium`, but the sweep is also the only way
viewport-specific layout regressions surface at all.

### The nightly never ran at all

Checking the most recent scheduled run (`2026-09-24T07:59Z`, head `064702a`)
before changing anything showed:

```
Detect Changes: completed/success
Quality Gate: completed/skipped
Unit Tests: completed/skipped
E2E Tests: completed/skipped
Build: completed/skipped
```

`e2e-tests` declares `needs: [changes, unit-tests]`, and `unit-tests` excludes
scheduled events (`github.event_name != 'schedule'`). GitHub skips a job whose
needed job was skipped unless the dependent job uses a status function, and the
E2E condition has none — so the "nightly E2E backfill" added by plans/122 W2 has
been a no-op since it landed. Nothing in the workflow said so: the job that would
have reported it was the one being skipped.

Two things therefore stood in the way of a working nightly:

1. **WebKit is not installed** in that job (`playwright install --with-deps
   chromium`), and installing it adds apt dependencies — fine nightly, wasteful
   per PR.
2. **`e2e/semantic-search.spec.ts` is load-sensitive.** It waits up to 20 s for
   transformers.js to finish failing its blocked CDN fetches before the lexical
   fallback hint appears. Under a four-project sweep it failed on both the
   attempt *and* the retry, while passing 9/9 in isolation. A nightly that goes
   red for that reason is worse than no nightly.

## 2. Change

**Workflow** (`e2e-tests` job):

| Event | Browsers installed | Projects run |
|---|---|---|
| `pull_request` | chromium | `--project=chromium` |
| `schedule` (nightly, main) | chromium + webkit | all four |
| `workflow_dispatch` | chromium + webkit | all four |

`timeout-minutes` goes 20 → 40: PR runs still finish in ~3 minutes, and the
nightly now runs 596 tests across four projects on WebKit as well as Chromium.
The existing `actions/cache` step for `~/.cache/ms-playwright` keeps the WebKit
download off the nightly's critical path after the first run.

**Workflow** (`unit-tests` job): the `github.event_name != 'schedule'` exclusion
is dropped, so the job runs nightly. This is the fix for the silently skipped
sweep — `e2e-tests` needs it, and a skipped dependency skips the dependent. The
alternative (keeping the exclusion and giving `e2e-tests` an `always()`/`!cancelled()`
escape) relies on status-function semantics that cannot be exercised by a manual
dispatch, whereas "the dependency runs in every event that reaches it" is
provable from the run history and testable in the workflow contract test. The
nightly therefore also runs the unit suite on `main`, which is a bonus signal
rather than a deviation.

**Spec** (`semantic-search.spec.ts`): the fallback-hint budget goes 20 s → 60 s,
with the reason recorded in the comment — the assertion waits on a *failing
network stack*, not on app logic, so its timing is a property of the environment.

## 3. Verification

| Check | Result |
|---|---|
| Workflow YAML parses (`yaml.safe_load`) | OK — `timeout-minutes: 40` |
| `yamllint -c .yamllint.yml` | clean |
| `shellcheck` on both `run:` blocks | clean |
| Both branches of each `run:` block, executed for `pull_request` and `schedule` | select the intended command |
| Workflow contract test (`src/lib/__tests__/workflows.test.ts`) | 63/63 pass |
| `pnpm run test:e2e` (all four projects, 596 tests) | 592 passed, 4 skipped, 0 failed |
| `e2e/semantic-search.spec.ts --repeat-each=3` in isolation | 9/9 pass |
| `./scripts/quality_gate.sh`, `pnpm run build` | ✓ green |
| **Live nightly path**: `workflow_dispatch` on `main` after merge | see §4 |

The workflow suite asserted `timeout-minutes: 20` for the E2E job, so this change
updates it to 40 and adds two cases:

- PR runs install and run Chromium only, while the scheduled and manual paths
  install WebKit and run every project. Both branches are split on `else` and
  asserted by exact command — `--project=chromium` is a prefix of the nightly
  command and `chromium` is a prefix of `chromium webkit`, so substring checks
  would pass on a Chromium-only nightly (mutation-checked: rewriting the nightly
  branch to `--project=chromium`, or the PR branch to install `chromium webkit`,
  each fails the suite).
- No job in `e2e-tests.needs` may exclude scheduled events, since a skipped
  dependency skips the dependent (mutation-checked: restoring the exclusion on
  `unit-tests` fails the suite).

## 4. Post-merge check

The change is only proven when the dispatched run actually installs WebKit and
executes the mobile/tablet projects on `main`. `workflow_dispatch` exists for
exactly this (plans/122 W2), so the run is triggered immediately after merge
rather than waiting for the 03:00 UTC cron.

Dispatch exercises the same dependency chain the schedule does — `changes` runs
in both, `unit-tests` now runs in both, and `e2e-tests` follows it. What dispatch
cannot show is that the *other* jobs stay skipped on schedule, which does not
affect `e2e-tests`.

## 5. Follow-ups

1. **The next real nightly should be confirmed.** The dispatch run proves the
   mechanism; the 03:00 UTC schedule run is the last piece. If it reports
   `E2E Tests: skipped` again, the cause is a dependency this plan did not see.
2. **PR runs still cover one viewport.** The nightly closes the gap daily, not
   per PR. If a viewport-specific regression lands, the next nightly catches it —
   acceptable for now; a matrix job per viewport would cost ~3× the runner time
   on every frontend PR.
3. **`lint_cache.sh` is skipped silently when absent** (plans/147 §4.1) — every
   lint reports as failed with a misleading message.
4. **DeepSource quota** (plans/141 §1) — account-level, needs the maintainer.
5. **ESLint 10 workaround** (plans/140 §2) — blocked upstream.
