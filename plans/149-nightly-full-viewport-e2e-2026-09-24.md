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
| push to `main` | chromium | `--project=chromium` |
| `schedule` (nightly, main) | chromium + webkit | all four |
| `workflow_dispatch` | chromium + webkit | all four |

`timeout-minutes` goes 20 → 40: PR runs still finish in ~3 minutes, and the
nightly now runs 596 tests across four projects on WebKit as well as Chromium.
The existing `actions/cache` step for `~/.cache/ms-playwright` keeps the WebKit
download off the nightly's critical path after the first run.

The condition is written as `event_name == 'schedule' || event_name ==
'workflow_dispatch'` rather than `event_name != 'pull_request'`. The first
version used the negation, which silently included **pushes to `main`** — every
frontend merge then paid the four-project cost (~10 minutes, observed on the
merge that landed this work). A push to `main` is a merge the PR already
validated; the sweep belongs to the nightly that exists for that gap. The
contract test now pins the sweep to those two events.

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

**Result** — dispatch run [`35986156948`](https://github.com/d-oit/do-knowledge-studio/actions/runs/35986156948)
on `main` (`9d693ba`):

| Job | Result |
|---|---|
| Detect Changes | success |
| Quality Gate | success |
| Unit Tests | success |
| Coverage Report | success |
| Build | success |
| **E2E Tests** | **success — `Running 596 tests using 2 workers`, 591 passed, 4 skipped, 1 flaky (8.5 m)** |

So the full-viewport sweep now executes in CI for the first time: 596 tests, not
the 149 that a Chromium-only run covers. The dispatch also confirmed the
dependency fix — `unit-tests` ran and `e2e-tests` followed it, which is the exact
chain the schedule needs.

Note: the dispatch and the post-merge push run share the `ci-main` concurrency
group, so the push-triggered run was cancelled by the dispatch. Same commit, and
the dispatch ran the superset.

### The flaky test it surfaced

`1 flaky`: `[desktop-xl] keyboard-navigation.spec.ts:27 › Escape closes command palette`
failed on the first attempt and passed on retry — `getByRole('dialog', { name:
/command/i })` was not found within 5 s.

Cause: `keyboard-navigation.spec.ts` was the only one of the three specs that
presses Ctrl+K *without* a readiness wait — its `beforeEach` was just
`page.goto('/')`, and the in-test `expectNavigationReachable` only proves the
sidebar is *visible*, which it is from server-rendered HTML. The shortcut is
bound by an effect, so a press issued before hydration is simply lost, and no
timeout increase would recover it.

Fix: the shell now renders a real readiness signal, and the specs wait on it.

- `AppShell` sets `data-app-ready="true"` from a mount effect. React flushes child
  effects before parent effects, so when the attribute appears every descendant
  listener — including `CommandPalette`'s window-level Ctrl+K handler — is bound.
  It is set from an effect rather than rendered during hydration, so server and
  client markup still match on the first pass (the mistake that forced the removal
  of a `data-hydrated` attribute in plans/145).
- `e2e/helpers/navigation.ts` gains `waitForAppReady(page)`, which waits for that
  attribute, and all three specs call it from `beforeEach`.

Verified in a live browser: the attribute is absent immediately after `goto`
(count 0), appears after mount (count 1), Ctrl+K opens the palette immediately
after it appears, and there are **no hydration-related console messages**.
`src/components/studio/app-shell.test.tsx` pins the hook so it cannot be dropped
silently.

### What the first fix got wrong

The first attempt waited on `networkidle` plus a visible `<main>` landmark. Review
correctly rejected it: `AppShell` renders `<main>` unconditionally, so a
server-rendered DOM satisfies both conditions before hydration — the helper
correlated with readiness without observing it. It happened to remove the flake,
but for the wrong reason, and the plan already argued for the marker it should
have used.

## 5. Follow-ups

1. **The next real nightly should be confirmed.** The dispatch run proves the
   mechanism; the 03:00 UTC schedule run is the last piece. If it reports
   `E2E Tests: skipped` again, the cause is a dependency this plan did not see.
2. **Pre-hydration interaction audit — closed at the helpers (2026-09-24).** The
   exposure was measured across all 24 specs rather than patched per spec:
   - `openNavIfHidden` (and therefore `navClick`) now waits for `data-app-ready`
     first. That covers the 22 specs that navigate through the helpers —
     `crud-workflow`, `home`, `timeline`, `progressive-disclosure` and
     `accessibility` all have `navClick(...)` as their first action, so no per-spec
     edit was needed.
   - `responsive.spec.ts` waits after each of its seven `goto` calls. It sets the
     viewport *before* navigating, so a `beforeEach` wait would run against
     `about:blank` and time out — worth remembering for viewport-specific specs.
   - `right-panel.spec.ts` waits in its `beforeEach`: its first action is a click
     on a server-rendered close control.
   - `contrast.spec.ts` performs no interactions.
   - `claim-extraction` and `editor-mentions` build on `createNewEntity`, which
     navigates via `navClick`.
   What remains unguarded is a spec that clicks a statically imported view's
   element before hydration *without* going through the helpers; none does today.
3. **PR runs still cover one viewport.** The nightly closes the gap daily, not
   per PR. If a viewport-specific regression lands, the next nightly catches it —
   acceptable for now; a matrix job per viewport would cost ~3× the runner time
   on every frontend PR.
4. **`lint_cache.sh` is skipped silently when absent** (plans/147 §4.1) — every
   lint reports as failed with a misleading message.
5. **DeepSource quota** (plans/141 §1) — account-level, needs the maintainer.
6. **ESLint 10 workaround** (plans/140 §2) — blocked upstream.
