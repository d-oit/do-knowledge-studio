# Plan 113 — OKF PR #624 Sweep: E2E Remediation, Thread Resolution, Merge Re-arms (2026-08-11)

**Status**: DONE (code, tests, threads, re-arms) — merges pending GitHub auto-merge completion
**Scope**: Full quality-gate retry on `feat/okf-bundle-export-import`, e2e flake/failure fixes, real a11y contrast fix, OKF version validation, PR #624 thread resolution, re-arm auto-merge across 12 PRs.

## 1. Quality Gate Retry (first user request)

- `pnpm run lint` ✅, `typecheck` ✅, `test` ✅ (2137 passed), `build` ❌ → retry ✅.
- Root cause of the build failure: transient `next/font/google` fetch failure (`next/font/google queries have exactly one entry`) — Google Fonts API unreachable/rate-limited mid-build. Confirmed `fonts.googleapis.com` HTTP 200 and a plain retry compiled clean. **No code change needed.**

## 2. Full E2E Run → 15 Failures Investigated & Fixed

CI runs only `--project=chromium` (`ci-and-labels.yml`); the local full run (4 projects) exposed real issues:

### 2a. Command palette — 14 failures on mobile/tablet (reproducible)
- **Root cause**: `e2e/command-palette.spec.ts` `beforeEach` waited for the sidebar `Main navigation` to be visible — the sidebar is `hidden lg:flex`, so below 1024px the nav is inside the (closed) drawer → timeout.
- **Fix** (`612d09f`): wait for the `<main>` landmark instead (viewport-agnostic), plus `networkidle` for hydration before pressing Ctrl+K (fixes a pre-hydration keypress race seen on chromium). 3 consecutive full-project runs: 21/21 green.

### 2b. Touch targets — flaky 43px on the clicked sidebar nav button
- **Root cause**: `.press-scale:active { transform: scale(0.97) }` → 44×0.97 ≈ 42.7px. On touch-emulated projects (tablet), `:active` persists long enough that the *clicked* nav button measures 43px mid-transition.
- **Fix** (`bf15101`): `press-scale:active` is now disabled under `prefers-reduced-motion` (correct WCAG 2.3.3 behavior) and the touch-target spec emulates `reducedMotion: 'reduce'` so geometry is measured in the static layout.

### 2c. axe color-contrast — "Draft saved" `<span class="text-sage">` (editor footer)
- **Root cause**: light-theme `--sage: #5c7b6e` on paper `#faf8f3` = 4.38:1 < 4.5:1 for 11px text. Missed by Plan 095's token audit; the only `text-sage` usage in the repo.
- **Fix** (`bf15101`): `--sage: #587465` → 4.83:1. `DESIGN-SYSTEM.md` synced.
- Note: remaining 1 flaky `[tablet] closes with Escape` in the full suite = cold-start timing under full-suite load (passed on retry; 3 consecutive isolated runs green; never fails on the chromium project CI runs).

## 3. PR #624 Code Changes (all pre-commit gates green, 2141 unit tests)

| Commit | Change |
|--------|--------|
| `5abfe60` | `parseOkfBundle` validates `okf_version` from index.md (non-fatal errors for missing/unsupported versions, §8/§11); import-error toasts capped via `joinErrorMessages` (240 chars, cuts at last complete error). +4 unit tests. |
| `bf15101` | `--sage` light token darkened to AA; `press-scale` respects reduced motion; touch-target spec emulates reduced motion. |
| `612d09f` | command-palette spec: `main`-landmark + `networkidle` hydration wait. |
| `2ea6d34` | `u` flag on the truncation-assertion regex (DeepSource finding on new test code). |

## 4. Threads Resolved (10 + 2 new)

- **OwlWatch (3)**: error truncation → fixed `5abfe60`; okf_version validation → fixed `5abfe60`; optional graph/mindMap/links/tags in OKF preview → by design (format carries no graph/mindMap; tags preserved per-entity; edges render as `# Related` markdown links §6.1).
- **DeepSource (7 original + 1 new JS-R1005 on `parseOkfBundle`)**: all JS-R1005 medium-complexity findings — suppressed via `.deepsource.toml` `issue_patterns` (skip=true) on `main` since #627 merged; DeepSource is NOT a ruleset-required check (only Codacy is). Replied with evidence + resolved.
- **DeepSource `u`-flag on new test regex**: fixed in `2ea6d34`, replied + resolved.
- Result: **74 threads, 0 unresolved.**

## 5. Merge Orchestration (Plan 098 workflow)

- **#627/#628 confirmed MERGED** (DeepSource config fix + Codacy remediation landed on `main`).
- **Re-armed auto-merge** (`--auto --squash --delete-branch`) on: #624, #625, #626, #629, #630–#637 (12 PRs). Verified `autoMergeRequest` present on each; Codacy (the only ruleset-required check) green on all; #624/#625/#626 re-armed after head/branch updates.
- #625/#626 were `BEHIND` → `gh pr update-branch` applied.
- All still report `mergeStateStatus: BLOCKED` = GitHub merge-state staleness per Plan 098; merges complete on GitHub's cache refresh.

## 6. OKF Coverage Deep-Dive

`vitest run src/lib/okf --coverage` (scoped include):
- **All files: 90.9% lines / 89.8% stmts / 75.4% branch / 96.8% funcs** — bundle.ts 97.6% lines, import.ts 80.5%, trust.ts 100%.
- OKF suite: 19 tests (16 → 19 after adding version tests).

## 7. Findings / Follow-ups

1. **DeepSource `.deepsource.toml` suppressions still not effective on PR #624** even though `main` has the valid config (#627 merged): the post-#627 analysis STILL posted new JS-R1005 inline threads. Likely config-propagation lag or `issue_patterns.skip` semantics; needs a repo admin check (Plan 104 dashboard territory). Not a merge blocker (Codacy is the required check).
2. `[tablet] command-palette closes with Escape` remains a rare cold-start flake under full-suite load — monitor; if it recurs, add an explicit palette-mounted wait.
3. GitHub flagging 7 dependabot vulnerabilities on default branch (1 high, 6 moderate) — triage in a follow-up.
