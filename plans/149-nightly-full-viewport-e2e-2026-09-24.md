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

Two things stood in the way of simply widening the nightly:

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
| Workflow contract test (`src/lib/__tests__/workflows.test.ts`) | 62/62 pass |
| `pnpm run test:e2e` (all four projects, 596 tests) | 592 passed, 4 skipped, 0 failed |
| `e2e/semantic-search.spec.ts --repeat-each=3` in isolation | 9/9 pass |
| `./scripts/quality_gate.sh`, `pnpm run build` | ✓ green |
| **Live nightly path**: `workflow_dispatch` on `main` after merge | see §4 |

The workflow suite asserted `timeout-minutes: 20` for the E2E job, so this change
updates it to 40 and adds a case that pins the new split: PR runs install and run
Chromium only, while the scheduled and manual paths install WebKit and run every
project.

## 4. Post-merge check

The change is only proven when the dispatched run actually installs WebKit and
executes the mobile/tablet projects on `main`. `workflow_dispatch` exists for
exactly this (plans/122 W2), so the run is triggered immediately after merge
rather than waiting for the 03:00 UTC cron.

## 5. Follow-ups

1. **PR runs still cover one viewport.** The nightly closes the gap daily, not
   per PR. If a viewport-specific regression lands, the next nightly catches it —
   acceptable for now; a matrix job per viewport would cost ~3× the runner time
   on every frontend PR.
2. **`lint_cache.sh` is skipped silently when absent** (plans/147 §4.1) — every
   lint reports as failed with a misleading message.
3. **DeepSource quota** (plans/141 §1) — account-level, needs the maintainer.
4. **ESLint 10 workaround** (plans/140 §2) — blocked upstream.
