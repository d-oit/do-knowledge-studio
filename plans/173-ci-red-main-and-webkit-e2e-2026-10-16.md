# Plan 173 — Red CI on main: coverage badge and WebKit gesture failures

**Date:** 2026-10-16  
**Status:** Done — merged in PR #979 at `f9e2058`; dispatched four-project sweep on `main` fully green (Coverage badge step success, E2E Tests success)  
**Related:** Plan 169 (gesture spec), Plan 172 (recent main pushes), `.github/workflows/ci-and-labels.yml`, `vitest.config.ts`

## Discovery

Two independent red signals on `main`:

1. **Every push-to-main CI run has been failing.** Inventory of the last 30 `ci-and-labels.yml` push runs: 26 `failure`, 4 `cancelled` (superseded), **0 success**. The stable failing job is `Coverage Report` → step *Generate coverage badge* (`if: github.ref == 'refs/heads/main'`): `jq: error: Could not open file coverage/coverage-summary.json: No such file or directory`. The PR path was green only because that step is skipped on non-main refs.
2. **The scheduled four-project E2E sweep fails** (`run 38869109906`): 2 failed + 1 flaky + 733 passed. Failures: `[mobile]` and `[tablet]` — "zooms the canvas viewBox on mouse wheel scroll" (both retries too); flaky: `[mobile]` "verifies Mind Map expander touch targets are at least 44x44px".

## Root causes

1. **Coverage badge**: the badge step reads `coverage/coverage-summary.json` (the `json-summary` reporter's output). Commit `3d8ae74` originally added `json-summary` to the vitest reporters for exactly this automation; a later refactor (`e36cf30`) changed the reporter list to `['text', 'json', 'html']`, dropping `json-summary` while keeping the step. Every main push since then failed at the badge step.
2. **Wheel test on touch devices**: reproduced locally — `page.mouse.wheel` throws `Mouse wheel is not supported in mobile WebKit` on the `mobile` (iPhone 13) and `tablet` (iPad Pro 11) device projects. Not an app defect: no wheel input exists in mobile WebKit.
3. **Target-size flake**: reproduced with `--repeat-each=6` — `Received: 43.99999237060547` against `>= 44`. A genuine 44px target measured with float noise (WebKit transformed-box reporting at device scale 3). The assertion, not the UI, is at fault.

## Fixes

| # | File | Change |
|---|---|---|
| 1 | `vitest.config.ts` | Restore `'json-summary'` to the coverage reporters (keeping `json`/`html`), with a comment naming the CI step it backs. |
| 2 | `e2e/graph-gestures.spec.ts` | `test.skip(isMobile, …)` for the wheel test — wheel zoom stays covered by the Chromium desktop projects; touch zoom is covered by `e2e/mobile-touch-gestures.spec.ts`. |
| 3 | `e2e/mobile-touch-gestures.spec.ts` | Sub-pixel tolerance (`0.01px`) on the 44px target assertions so float noise cannot flake; a real 43px control still fails. |

## Verification

- `pnpm exec playwright test e2e/graph-gestures.spec.ts e2e/mobile-touch-gestures.spec.ts --project=mobile --project=tablet --repeat-each=2 --retries=0` → **20 passed, 4 skipped, 0 failed/flaky** (wheel skips on both WebKit projects).
- `pnpm exec playwright test e2e/graph-gestures.spec.ts --project=chromium` → 3 passed (wheel zoom still exercised on desktop).
- `pnpm test:coverage` locally → `coverage/coverage-summary.json` written (76,814 bytes); `jq '.total.lines.pct'` reads **89** — exactly what the badge step consumes.
- Post-merge: the push run on `main` must be **green** (badge step finds the file), and a dispatched `ci-and-labels.yml` run must show the four-project E2E sweep green.

## Verification results (2026-10-16)

- PR #979 checks: all green including `Coverage Report` and `E2E Tests`.
- Merged at `f9e2058`; production deployment succeeded.
- Dispatched `ci-and-labels.yml` on `main` (`run 38914290426`, commit `f9e2058`): **overall success** — Detect Changes / Unit Tests / Quality Gate / Build / **Coverage Report (badge step: success)** / **E2E Tests (four projects incl. both WebKit): success**. The dispatch and push runs share the same job definitions, so the badge step now passes on the push path as well (the f9e2058 push run itself was cancelled by the same-ref dispatch concurrency).
- Nightly-class sweep therefore green: the wheel test skips only on `isMobile` projects (Chromium still exercises it), and the mind-map target assertion tolerates sub-pixel noise without accepting a real undersized control.
