# Plans Index

**Updated**: 2026-10-13
**Method**: GOAP (Goal-Oriented Action Planning) with ADRs

Plan records are filed as `plans/NNN-slug.md`, where `NNN` is the plan number used
below; accepted decision records are in `plans/ADRs/NNN-slug.md`. Work still in
flight or just landed is kept wave-by-wave below; every landed plan is one row.

## Active work

### Plan 166 — Codebase improvement audit and followups (2026-10-13)

| Wave | Goal | Status | Outcome |
| --- | --- | --- | --- |
| Reconcile | Re-verify recorded open items against source and runtime | Done | F1 (AI request control) is implemented (#923/#926/#927; 54 harness tests pass); Plan 161's dev search-worker error and both workflow-linter warnings no longer reproduce; first-mount reduced motion remains open; Plan 131's eager-chunk and source-error items are closed. |
| Audit | Find new improvement and missing-implementation candidates | Done | Typography classes inert (no `@tailwindcss/typography`; PR #951 open and conflicting), unused `indexeddb-backup.ts`, F3 gesture spec, Cursor/Windsurf manifest semantics, markdownlint gate wiring, plan/ADR number collisions. See `plans/166-codebase-improvement-audit-2026-10-13.md`. |

### Plan 167 — Precache manifest without the boot document (2026-10-13)

| Wave | Goal | Status | Outcome |
| --- | --- | --- | --- |
| Fix | Stop rejecting builds that complete without `.next/server/app/index.html` | In review | The boot-document scan is best-effort while both static inventories stay mandatory; [ADR 041](ADRs/041-offline-precache-scope-and-upgrade-identity.md) §2 amended. A new suite (4 cases) covers the Vercel layout; the manifest is byte-identical on the real build. `plans/167-precache-manifest-without-boot-document-2026-10-13.md`. |

### Plan 165 — Backlog remediation and PR integrity guards (2026-10-13)

| Wave | Goal | Status | Outcome |
| --- | --- | --- | --- |
| W1–W4 | Close selected Plan 162 gaps | Done | Commits `e2ee5a6`, `a2dcbea`, `f7d970f`, `cdbd0f3` implement canvas integrity, sync rejoin, URL hashes, and deferred heavy dependencies; see `plans/165-backlog-remediation-2026-10-13.md`. |
| W5 | Reconcile tooling and README claims | Done | Skills catalogs, agent-surface CLI, script/quality docs, and README storage/search/model-loading claims corrected. Plan 162 S3 remains open. |
| W6 | Add PR integrity guards | Done | Dependency-range and stale-base deletion CI guards with eight focused BATS cases; ADR 044; no ruleset change. |
| W7 | Reconcile records and complete delivery | PR #950 | Plan 162/163, the index, and ADRs reconciled; final local gate, browser suites, baseline shadow, and browser canary recorded in Plan 165. Five valid PR review findings fixed; remote checks, thread resolution, and merge status tracked on PR #950. |

### Plan 164 — Vercel deployment validation, and the doc-lint gate it exposed (2026-10-12)

| Wave | Goal | Status | Outcome |
| --- | --- | --- | --- |
| Vercel diagnosis | Why every deployment fails | Done | `plans/164-vercel-deployment-validation-and-doc-lint-2026-10-12.md`. The provider's own error — `api-deployments-free-per-day`, Hobby = 100 deployments per 24 h, owner-scoped (official: vercel.com/docs/limits) — explains **300+ consecutive failures since 2026-10-03**, productions included, so the live site has not advanced for nine days. One day produced 104 deployments. |
| Prevention | Reduce deployments created, in-repo | Done | `vercel.json` gains `ignoreCommand` (`scripts/vercel-ignore-build.sh`: doc/agent/CI-only pushes are skipped, `scripts/` deliberately not skippable, unknown state builds) and `git.deploymentEnabled` for `dependabot/**`. Both validated against Vercel's published schema. |
| Tests + skill | Make the behaviour regression-proof and reusable | Done | `tests/vercel-ignore-build.bats` (6 cases, incl. the scripts-only guardrail) and the `vercel-deployment` skill — diagnosis commands, the failure taxonomy, the two levers, and the push-discipline rule. `agents-docs/DEPLOYMENT.md` updated. |
| Doc-lint repair | The gate that could not fail | Done | `markdownlint.toml` was inert (`[tool.markdownlint]` is a Python convention the CLI ignores; rule ids mismatched their comments), so the pre-commit hook would have blocked doc authors while the quality gate skipped the check entirely. Rebuilt it with reasons per disabled rule; the corpus is now **clean**, after reverting a `--fix` pass that had turned 43 prose lines beginning with issue references into real headings (MD018, disabled with that reasoning recorded). |

### Plan 163 — Open-PR / open-issue sweep, roast, and land (2026-10-12)

| Wave | Goal | Status | Outcome |
| --- | --- | --- | --- |
| Inventory | 10 open PRs, 17 open issues, ruleset consequences | Done | `plans/163-open-pr-issue-sweep-2026-10-12.md`. Ruleset 15161694 has exactly one required context (`Codacy Static Code Analysis`), `strict` + linear history, and `required_review_thread_resolution`, so every merge needs an explicit `update-branch` pass and outdated threads block. |
| Verdicts | Decide what to close | Done | Only #932 closed — a fork-based duplicate of #927 (same fix for #884, divergent `useAiHarnessChat` error paths), closed with a credited explanation. Every other PR carried a behaviour change, an alert fix, or tests, and every issue reproduced. |
| Roast | 8 real defects inside the open PRs | Done | #923's timeout was dead on engines without `AbortSignal.any` and its Stop called `window.stop`; #928 shipped UI message ids to providers; #926 announced failure and abort as success; #925's clear could fail silently and its two banner e2e tests could not fail for the stated reason; #927/#923 disagreed on copy. Each fix carries a test re-injected with the defect. |
| Roast (main) | 2 defects already on `main` | Done | PR #910 had silently downgraded four dependency ranges (`next`, `react-day-picker`, `@tanstack/react-virtual`, `eslint-plugin-react-refresh`); `.gitignore`'s directory-only `node_modules/` staged worktree symlinks and `speech-coverage.test.ts` used `afterEach` without importing it. |
| Merges | Land the ready PRs | Done — 7 in `origin/main` | #920 (`6c4b20d`), #931 (`583e820`, #861), #923 (`ab26b78`, #885), #935 (`3919baf`, #865), #933 (`1e519e8`), #934 (`56428ea`), #924 (`d1ccc85`, Dependabot alert #75). |
| Issues | Implement the issue work | Landed and queued | #861 → #931 and #865 → #935 merged; #938 (#851/#852/#853/#858 touch token + type scale), #936 (#870 container constant + `ViewHeader`), #937 (#886 provider constants), #939 (#863/#856 shared `ConfirmDialog`) armed for auto-merge at session close. |
| Follow-ups | Open — partly closed | Plan 165 Step 6 implemented the no-downgrade and stale-base guards (ADR 044). Other follow-ups retain their dated 2026-10-12 status and are not reassessed here. |
| Verification | Evidence discipline | Done | Every fix reproduced before it was touched; every new regression test re-injected with the defect and observed to fail; per-lane unit suites, root `tsc --noEmit`, and Playwright where the change made it meaningful. |

### Plan 162 — Roadmap progress and next work (2026-10-05)

| Wave | Goal | Status | Outcome |
| --- | --- | --- | --- |
| Source audit | Preserve the 2026-10-05 findings | Historical — reconciled | Original source observations remain dated; Plan 162's 2026-10-13 addendum records later implementations. |
| Selected backlog | Close the recorded integrity and navigation gaps | Partially closed | Plan 165 resolves items #2–#4 and F2, and reconciles S1/S2/D1–D3. Plan 166 re-verified F1 as implemented (#923/#926/#927) and Plan 161's dev search-worker and workflow-linter follow-ons as resolved; F3, S3, first-mount reduced motion, and unscheduled candidates remain open. |

### Plan 116 — Open-PR / open-issue sweep, roast, and merge order (2026-10-11)

| Wave | Goal | Status | Outcome |
| --- | --- | --- | --- |
| W1 | Inventory 9 open PRs + 19 pure issues; roast each | Done | `plans/116-pr-issue-sweep-roast-merge-order-2026-10-11.md`. No-impact close verdict: **nothing** — every PR carried behaviour, an alert fix, or tests, and all 19 issues reproduced on `main`. |
| W2 | Implement missing tasks with zero PR overlap | Done | #861 (library table rows back to native semantics + a real open button) and #873 (system theme: `enableSystem`, `defaultTheme="system"`, sidebar System button). Lint + typecheck clean, 2838 unit tests green; e2e specs updated, CI awaited (no browsers in the sandbox). |
| W3 | Merge order + follow-ups | Historical — superseded | No merges were performed under this plan; the 2026-10-12 sweep supersedes the open-work half (see Plan 163): #924 and #920 landed there among seven merges, #910 had landed with four dependency downgrades that Plan 163 restored, and the PRs still open then are tracked in Plan 163's follow-up row. Recorded order was #922 → #924 → #920 → #923 → #928 → #927 → #926 → #910 (rebase) → #925 (Codacy HIGHs first) → this branch, with follow-up drafts (no GitHub write access here) for #926 i18n, #928 optional-id note, drawer theme parity, and 12 issue owners. |

### Plan 131 — GOAP Swarm Improvement Audit (2026-08-22)

| Wave | Goal | Status | Outcome |
| --- | --- | --- | --- |
| W1 | G7 gate honesty + G1 persistence contract | Done | `plans/131-goap-swarm-improvement-audit-2026-08-22.md`. `mergeHydratedState` validates on every load (not just version mismatches), rebase-on-hydrate, `HydrationRejectedError` preserves the payload on disk, honest coverage thresholds (75/78/84/85) with test files excluded, `.githooks/` committed + `core.hooksPath` wired via `prepare`. |
| W2 | G2 undo integrity + G3 dead-code/dep pruning | Partial — closed, nothing left to prune | Undo integrity landed in Plan 157 W3; #838 removed five dead shared primitives (`ui/shared-primitives.tsx` 317 → 131 lines). The ~26-dependency prune was estimated, not measured — of 63 deps only 4 have no import in `src/`, `e2e/`, or `scripts/`, and all four are required. |
| W3 | G4 bundle/startup + G5 view consolidation | Closed | Six lazy view boundaries in `app-shell.tsx` plus on-use dynamic imports for sync/export dependencies (Plan 165 `cdbd0f3`); the "zero `next/dynamic` call sites" note is historical — the repo uses `React.lazy` and `await import`. The shared `ToolbarBtn` dead-export problem is closed (#838); `chat-view.tsx` fell to 126 LOC on its own while `graph-view.tsx` (494) and `mindmap-view.tsx` (490) stay just under the ceiling. |
| W4 | G6 sync bridge completion | Done | `startBidirectionalSync` is called from `app-shell.tsx:130` and returns the unsubscribe; tombstone registry extracted to `cross-tab-tombstones.ts`. |
| W5 | G8 library hardening + G9 hygiene | Closed | DOMPurify wired in `lib/security.ts`, `verify-deps.sh` runs in CI on lockfile changes, markdown link sanitization + `noopener noreferrer`. Source-error gating is active: `vitest.config.ts` sets `ignoreSourceErrors: false` after Plan 159 F7 cleared the legacy `*.test.ts` errors (Plan 166). |

### Plan 123 — Codacy Merge Gate Playbook (2026-08-14)

| Wave | Goal | Status | Outcome |
| --- | --- | --- | --- |
| Reference | Document missing-check diagnosis and code-level false-positive fixes | Active reference | `plans/123-codacy-merge-gate-playbook-2026-08-14.md`. AGENTS.md and lessons updated; use for every PR sweep. |

## Completed plans

One row per landed plan: number, title and date as recorded, what it delivered, and
its file. Rows with a superseded or historical status keep that word.

| Plan | Title (date) | Outcome | Plan file |
| --- | --- | --- | --- |
| 160 | Fix every open Codacy issue in code; delete `.mimocode/` (2026-09-30) | Done — removed the foreign `.mimocode/` tree and its inert config entries, and fixed all five live Codacy findings in code, not by suppression (2788 unit tests green). | plans/160-codacy-open-issues-and-mimocode-cleanup-2026-09-30.md |
| 159 | Rejected-library recovery visibility and fail-closed persistence (2026-09-29) | Done — a refused hydration is now visible on Home and fails closed for the page session (`hydration-guard.ts`); quarantine occupancy is decided by key existence and dismissal is non-destructive; ADR 028 §4a. | plans/159-rejected-library-recovery-visibility-and-fail-closed.md |
| 157 | Codebase gap remediation: dead features, undo integrity, PWA, live announcements (2026-09-28) | Done — mind-map density and graph snapshots made real, undo carries claims, PWA raster icons + manifest/SW re-checks, 9 announcing mutations. | plans/157-codebase-gap-and-feature-remediation.md |
| 158 | September 2026 best-practice audit (2026-09-28) | Done — source-cited four-lane swarm; 3 P0 (Vercel pnpm 6 install, the service worker deleting its own precache, silent hydration rejection) plus the P1s fixed, 3 candidates rejected by browser verification; P2-2/3/10/11 remain. | plans/158-september-2026-best-practice-audit.md |
| 156 | Dependency audit remediation: `brace-expansion` (2026-09-28) | Done — the override had pinned the vulnerable version; narrowed to `<1.1.18` → `1.1.21`, `pnpm audit` clean across 889 dependencies; two warnings recorded as follow-ups F1/F2. | plans/156-dependency-audit-brace-expansion-remediation-2026-09-28.md |
| 155 | Local CPU-first AI and settings persistence (2026-09-26) | Done — CPU-first defaults with a reachable WebGPU toggle, a per-keystroke autosave that silently discarded partial hosts fixed, bracketed IPv6 loopback allowlisted. | plans/155-cpu-first-local-ai-and-settings-persistence.md |
| 129 | React Compiler ESLint Rules (2026-08-17) | Done — five `react-hooks` compiler rules enabled (all zero findings) and the sole `purity` violation fixed in `sidebar.tsx`. | plans/129-react-compiler-eslint-rules-2026-08-17.md |
| 128 | Enable React Compiler (2026-08-17) | Done — `reactCompiler: true` plus `babel-plugin-react-compiler`, with `'use no memo'` opt-outs on the components the compiler breaks. | plans/128-react-compiler-2026-08-17.md |
| 127 | Nightly Dependabot Alert Check (2026-08-16) | Done — new nightly `dependabot-alert-check.yml` fails CI on any open alert; the diagnoser reports outdated-but-unresolved review threads (LESSON-032). | plans/127-dependabot-alert-check-2026-08-16.md |
| 126 | Transitive nanoid Security Remediation (2026-08-15) | Done — the `nanoid@3` override bumped 3.3.17 → 3.3.18 with a regenerated lockfile, no application behaviour changed. | plans/126-dependabot-nanoid-remediation-2026-08-15.md |
| 125 | Markdown Preview E2E Verification (2026-08-15) | Done — the E2E spec and ADR 033 merged via #689, GFM support via #690. | plans/125-markdown-preview-e2e-2026-08-15.md |
| 124 | Skill Script Complexity Follow-up (2026-08-15) | Done — monitor loops decomposed via #691; #692 added the shared `scripts/lib/workflow-monitor.sh`, workflow-failure propagation and BATS coverage. | plans/124-skill-script-complexity-followup-2026-08-15.md |
| 122 | Large-List Render Cost (2026-08-14) | Done — library lists capped/windowed with CSS-sourced breakpoints, tooltips, SR labels and E2E coverage across PRs #677–#683. | plans/122-virtualize-graph-lists-2026-08-14.md |
| 121 | Version Consistency Audit (2026-08-12) | Done — version references aligned to 0.1.2 and `scripts/propagate-version.sh` restored and documented. | plans/121-version-audit-2026-08-12.md |
| 120 | Open Items Resolution Session (2026-08-12) | Done — closed issue #622 (SSRF false positive), fixed the PR #663 OwlWatch finding and its merge state, re-scanned plans 100–119 as DONE, and drafted release notes (2210 tests pass). | plans/120-open-items-resolution-2026-08-12.md |
| 119 | PR Merge-State Diagnosis: Incident + Automated Diagnoser (2026-08-12) | Done — diagnosed the PR #652 BLOCKED state and shipped `pr-merge-state-diagnoser.yml` with `scripts/diagnose-merge-state.sh` and a 19-test BATS suite. | plans/119-merge-state-diagnoser-2026-08-12.md |
| 118 | PR Sweep Session Summary (2026-08-12) | Done — swept PRs #624–#649 (8 merged manually, 3 auto-merged, 2 by maintainer), cut search query time ~84%, pinned gitleaks to v2.3.9. | plans/118-pr-sweep-session-summary-2026-08-12.md |
| 110 | GOAP: Missing Implementation Remediation (2026-08-07) | Done — split `export-helpers.ts` (544 LOC) into three modules, committed the Next.js 16 `next-env.d.ts`, closed Plan 109, and opened a reviewed PR. | plans/110-goap-missing-implementation-remediation-2026-08-07.md |
| 109 | Gap Remediation, CI Fix, and PR Cleanup (2026-08-06) | Done — created the missing `plans/094-smoke-tests-shadcn-primitives.md`, fixed 4 Codacy and 1 DeepSource finding, and landed PR #614 (2115 tests). | plans/109-gap-remediation-ci-fix-2026-08-06.md |
| 108 | Complete Task 143 Progressive Disclosure, Fix PR #613 CI, Viewport E2E (2026-08-06) | Done — Task-143 disclosure items implemented, 8 DeepSource findings resolved, and the E2E viewport matrix hardened (476/476 across four projects). | plans/108-goap-task143-completion-and-ci-fix-2026-08-06.md |
| 106 | DeepSource Remediation, CI Fix, and Coverage (2026-08-05) | Done — DeepSource-style code fixes, the PR #610 store regression repaired in #611, and new store-graph, helper-component and seed-data tests (2095 tests pass). | plans/106-deepsource-remediation-and-coverage-2026-08-05.md |
| 105 | ADR 010 Full Export Schema & Plan Reconciliation (2026-08-03) | Done — implemented the ADR 010 export schema (8 Zod schemas, graph/mindMap/links/tags in JSON) with 86 new tests and reconciled stale checkboxes (PR #598). | plans/105-goap-remaining-gaps-stale-checks-and-adr010-2026-08-03.md |
| 104 | Long-Term DeepSource JS CI Fix (2026-08-03) | Done — root-caused the recurring DeepSource JS failures with `.deepsource.toml` issue-pattern suppressions and `skip_doc_coverage`. | plans/104-deepsource-longterm-2026-08-03.md |
| 103 | Resolve DeepSource JS Findings (2026-08-03) | Done — fixed the findings in code across `src/lib` and added justified suppression entries for the remaining false-positive patterns. | plans/103-deepsource-adr022-findings-2026-08-03.md |
| 102 | Fix DeepSource JS Introduced Issues (2026-08-02) | Done — cleared the patterns PR #590 introduced; merged via #591 (`0ddf626`). | plans/102-deepsource-js-fixes-2026-08-02.md |
| 101 | ADR 022 setTimeout Removal & Plan Status Reconciliation (2026-08-02) | Done — removed the `sendMessage` fake delay (synchronous BM25 per ADR 022) and reconciled `plans/ADRs/007-doc-resolver-integration.md`, `plans/084-accessibility-audit-report.md` and `plans/10-implementation-audit-v1-completed.md` (1992 tests pass). | plans/101-goap-adr022-settimeout-and-plan-statuses-2026-08-02.md |
| 100 | GOAP: ADR 007 Stale Status & Codebase Gap Analysis (2026-08-02) | Done — marked ADR 007 superseded by ADR 022 with a five-point justification and produced the gap analysis that fed Plans 101–105. | plans/100-goap-adr007-stale-status-and-codebase-gaps-2026-08-02.md |
| 099 | GOAP: Address Remaining Gaps and Create PR (2026-08-02) | Done — consolidated the outstanding codebase gaps and merged the result via PR. | plans/099-goap-remaining-gaps-and-pr-2026-08-02.md |
| 097 | CI Cache Completion and Plan 15 Reconciliation (2026-08-01) | Done — added a lockfile-keyed Playwright browser cache, verified the remaining Plan 15 CI/config criteria, and merged via PR #584 (`720df58`). | plans/097-goap-plan15-ci-cache-and-reconciliation-2026-08-01.md |
| 096 | WCAG Touch Target and E2E Learnings (2026-07-29) | Done — created `plans/096-wcag-touch-target-and-e2e-learnings-2026-07-29.md`. | plans/096-wcag-touch-target-and-e2e-learnings-2026-07-29.md |
| 095 | Fix Pre-Existing Color Contrast Violations (2026-07-29) | Done — raised the light/dark contrast tokens (6.1:1 light / 5.8:1 dark), removed the kbd opacity modifiers, fixed the react-day-picker v10 rename and extended strict axe assertions to all 10 views (PR #541, 1379 tests). | plans/095-audit-color-contrast-fixes.md |
| 094 | Smoke Tests for Remaining 9 shadcn UI Primitives (2026-07-29) | Done — shared axe helpers plus 9 primitive test files (782 additions across 14 files); merged via PR #540. | plans/094-smoke-tests-shadcn-primitives.md |
| 093 | Full Accessibility Audit E2E Suite and UI Primitive Tests (2026-07-29) | Done — fixed the ARIA radiogroup keyboard focus and 44px touch targets, added the touch-target E2E test, and cleared 5 Codacy issues; merged via PR #539 (1322 tests). | plans/093-goap-a11y-e2e-and-ui-primitive-tests-2026-07-29.md |
| 092 | GOAP: Complete Plan 091 Deferred Smoke Tests & Reconcile Stale Plan Checkboxes (2026-07-29) | Done — added the 4 deferred shadcn smoke tests (39 tests) and reconciled Plans 091, 068 and 089. | plans/092-goap-plan091-smoke-tests-and-plan-reconciliation-2026-07-29.md |
| 091 | GOAP: Address Remaining plans/ Gaps, Coverage, and ADR Cleanup (2026-07-28) | Done — reconciled four stale plan checkboxes and ADR 003, and added hook plus service-worker-registration tests (25 new tests); PR #535 green on all 20 checks. | plans/091-goap-remaining-gaps-cleanup-2026-07-28.md |
| 090 | GOAP: PWA Service Worker, AI Provider Tests, A11y Automation (2026-07-28) | Done — cache-first service worker plus offline indicator, 53 provider tests and 48 keyboard-navigation tests; PR #534 green on all 20 checks. | plans/090-goap-pwa-tests-a11y-2026-07-28.md |
| 087 | GOAP: Address Remaining ADR Implementation Gaps (2026-07-27) | Done — applied conflict resolutions, completed the bidirectional sync bridge lifecycle, persisted recovery snapshots, added import referential integrity and a manifest-driven skills setup. | plans/087-goap-remaining-adr-implementation-gaps.md |
| 084 | GOAP: Address Remaining Implementation Gaps (2026-07-26) | Done — marked `plans/ADRs/012-pdf-export-strategy.md` implemented, hardened the ADR 029 validator, and created `plans/084-accessibility-audit-report.md`. | plans/084-goap-remaining-gaps-2026-07-26.md |
| 083 | GOAP: Coverage to 55%, Plan Status Fixes, ADR 011 Cleanup (2026-07-26) | Done — corrected three plan statuses, marked `plans/ADRs/011-cli-command-extraction.md` superseded, added 9 test files (109 tests) and raised the coverage thresholds. | plans/083-goap-coverage-plan-status-adr-cleanup.md |
| 082 | GOAP: Address Missing Implementations from plans/ Analysis (2026-07-26) | Done — marked `plans/ADRs/001-sqlite-wasm.md` superseded, completed the bundle-size analysis in `plans/startup-audit.md`, and added versioned hydration migrations plus 181 tests. | plans/082-goap-missing-implementations-2026-07-26.md |
| 081 | Overlay Migration, Semantic A11y, Dead Code Removal (2026-07-26) | Done — added the Overlay variants, migrated three surfaces and the search listbox semantics, deleted the unused focus-trap hook; PR #516 with 20 checks green and 0 Codacy issues. | plans/081-overlay-migration-a11y-coverage.md |
| 080 | Gap Remediation: GOAL.md, ai-harness split, shadcn exception (2026-07-26) | Done — refreshed GOAL.md/AGENTS.md and split `ai-harness-view.tsx` 511 → 255 LOC; PR #515 green on 22 checks. | plans/080-gap-remediation-goal-harness-branches.md |
| 079 | View Test Coverage + PR (2026-07-25) | Done — added 5 view test files and set the coverage thresholds; PR #514 green on 22 checks. | plans/079-view-tests-and-pr.md |
| 078 | GOAP Gap Remediation: LOC, Architecture, Coverage, E2E CI (2026-07-25) | Done — split `export-view.tsx` 594 → 128 LOC, rewrote ARCHITECTURE.md, added the E2E CI job and 163 tests; merged via PR #512. | plans/078-goap-gap-remediation-2026-07-25.md |
| 077 | Review Findings Remediation (2026-07-25) | Done — cleared the review P1–P3 findings (dead code + ARIA, keyboard navigation, focus polish, 20 touch targets) in PR #510. | plans/077-review-findings-remediation.md |
| 076 | Accessibility Audit, Overlay Migration, and Quick-Win Remediations (2026-07-25) | Done — swarm audit (68 findings), 18 ARIA fixes, 8 focus and 12 touch-target fixes, motion gating; merged via PR #508. | plans/076-a11y-audit-overlay-quickwins.md |
| 075 | Coverage, Overlay, Claims History, and Docs Reconciliation (2026-07-25) | Done — 8 new test files (492 tests, coverage 30.87% → 31.63% lines), the shared `Overlay`, and claims version history; merged via PR #505. | plans/075-plan-075-remediation.md |
| 074 | Sync Bridge, A11y, Data Layer, and Documentation (2026-07-25) | Done — claim timestamps, 13 ADR statuses, 44px targets plus export ARIA, and the bidirectional Yjs/Zustand sync bridge (PRs #502/#503). | plans/074-goap-sync-bridge-a11y-and-data-layer.md |
| 073 | Closeout of Plan 072 Remaining Gaps (2026-07-24) | Done — import preview and rollback, product-honesty plus CI fixes, mind-map ARIA tree with roving tabindex, raised coverage thresholds and 44px touch targets. | (no plan file) |
| 072 | GOAP Remediation (2026-07-24) | Done — accepted ADRs 027/028/029 and landed Zod hydration with import validation (P0), CI fail-closed changes (P1) and the honesty fixes (P1). | plans/072-goap-plan071-remediation.md |

## ADRs recorded since the 2026-07-25 reconciliation

| ADR | Scope (date) | Status | ADR file |
| --- | --- | --- | --- |
| 028 | Validated and recoverable local data boundaries (2026-09-29) | Implemented (§4a added) | plans/ADRs/028-validated-recoverable-local-data-boundaries.md |
| 040 | CPU-first local AI inference (2026-09-26) | Implemented | plans/ADRs/040-cpu-first-local-ai.md |
| 034 | Nightly Dependabot Alert Check + Resolve-Every-Thread Merge Gate (2026-08-16) | Done | plans/ADRs/034-nightly-dependabot-alert-check.md |

ADR 028 §4a makes the decision operational: a refused hydration fails closed for the
page session across the storage writer, the quarantine record, and cross-tab/Yjs
traffic; the refusal status, not the presence of a quarantine record, is the single
source of truth for "this workspace is temporary". ADR 040 makes CPU the invariant
default (WASM in-browser, `num_gpu: 0` for Ollama; GPU opt-in) and supersedes ADR 025
in part. ADR 034 documents the DEPENDABOT_TOKEN requirement and the LESSON-032
resolve-every-thread rule.

## Deferred items as recorded at the time

| Recorded under | Deferred to | Items |
| --- | --- | --- |
| Plan 074 | Plan 076 | Full accessibility audit (axe scanning, screen reader verification, 200% zoom, 400% reflow); coverage target to 50% (incremental, not one-shot). |
| Plan 073 | Plan 074 | G2: bidirectional Yjs/Zustand sync bridge (requires the G1 validation boundary); full accessibility audit (axe scanning, screen reader verification, 200% zoom). |

## Session summaries

### Session Summary (2026-08-01 — 5 PRs merged)

| Area | PRs | Key Changes |
| --- | --- | --- |
| ESLint peer alignment | #583 | `@eslint/js` 10.x → 9.39.4 to match `eslint` 9 toolchain; removed pnpm peer warning (`fa205fc`) |
| CI Playwright cache | #584 | Lockfile-keyed `~/.cache/ms-playwright` cache in `ci-and-labels.yml`; Plan 15/097 completed (`720df58`) |
| Merge-state staleness audit | #585 | `plans/098` root-cause doc + AGENTS.md "GitHub merge-state staleness" guidance (`fe1e58f`) |
| Branch protection ADR | #586 | `plans/ADRs/030` records single-source `main` ruleset config (0 approvals, linear history) (`148ca71`) |
| Plan status reconciliation | #587 | Plans 097 + 15 marked DONE; INDEX date + W3 wave updated (`6614240`) |

Session notes: GitHub's mergeability cache reported stale `BLOCKED` after the legacy branch protection removal; after verified-gate diagnosis and maintainer approval, the four PRs were merged via protected `--admin` squash (documented in Plan 098 / ADR 030). Final state: 0 open PRs, 0 open issues, 0 open Dependabot alerts, quality gate green (1,992 tests).

### Session Summary (2026-07-29 — 22 PRs merged)

| Area | PRs | Key Changes |
| --- | --- | --- |
| A11y E2E suite | #539–#543 | Strict axe assertions, color-contrast fixes, graph a11y fix |
| UI smoke tests | #540 | 9 shadcn primitive tests (782 additions) |
| Plan reconciliation | #544, #547–#549 | 7 plans reconciled, Status: DONE lines added |
| Release policy | #545 | Never create release without explicit human instruction |
| Version reconciliation | #546 | VERSION file, package.json, MIGRATION.md → 0.1.0 |
| Historical annotations | #548 | 9 superseded plans annotated with Historical Notes |
| Error boundary tests | #551 | 14 new tests for ErrorBoundary + ViewErrorBoundary |
| .gitignore cleanup | #550 | Added *.tsbuildinfo, removed duplicates |
| AI Harness E2E + component tests | #555 | 13 E2E tests + 81 unit tests for 6 untested components |
| Coverage thresholds raised | #554 | Thresholds raised to 55%/48%/50%/55% |
| Session learnings & tracking | #556 | GOAL.md, INDEX.md updates, Playwright selector + test isolation learnings |
| Studio component tests | #557 | 74 unit tests for sidebar, topbar, voice-input, command-palette |
| Studio component tests R2 | #559 | 45 unit tests for theme-provider, presence-indicator, conflict-ui, shortcuts-dialog |
| Studio component tests R3 | #560 | 71 unit tests for remote-cursors, voice-capture, qr-pairing, app-shell |
| Studio component tests R4 | #561 | 51 unit tests for mobile-drawer, right-panel — **all studio components tested** |
| Branch coverage round 1 | #563 | 51 branch-coverage tests for shortcuts-dialog keyboard handler (33) and bridge.ts (18) |

**Final metrics**: 1,766 unit tests, 111 E2E tests, 0 open PRs, quality gate green, Codacy clean. Coverage: 67.8% stmts / 58.45% branches / 61.46% funcs / 68.79% lines. All 17 studio components have unit test coverage (255 tests). PR #563 discovered dead code in shortcuts-dialog (`else if (key === 'g')` branch is unreachable because 'g' ∈ G_SEQ_MAP).

### Historical Plan Reconciliation (2026-07-29)

Added `Historical Note` blockquotes to 9 superseded plans (040–078) documenting their
relationship to the retired Vite/SQLite/Orama/CLI architecture (superseded by ADR 018 —
Next.js + Zustand + localStorage). Plans retain historical context; remaining unchecked
items were completed in later plans (090–096).

| Plan | Note |
| --- | --- |
| 040, 041-ui, 042, 05, 070 | Retired architecture note |
| 041-ai-harness | Retired AI architecture (superseded by ADR 025) |
| 051 | Superseded Vercel config |
| 068 | Follow-ups completed in 090–096 |
| 078 | Implementation-plan checkboxes, all success criteria done |

### Earlier sessions (pre-2026-07-24)

| Session | PRs | Outcome |
| --- | --- | --- |
| 2026-07-18 (Phase 10: Docs & Code Hygiene) | #481 | Plan 070: docs alignment (PHASES.md, GOAP.md, INDEX.md) and LOC remediation (triz-data split, ai-harness extraction). |
| 2026-07-17 (Phase 8 + Phase 9 full) | #461–#475, #476, #478–#480 | Plans 065 (AI provider consolidation: OpenRouter + Ollama), 066 (P2P sync, voice, presence, cursors), 067 (bundle optimization — lazy-load views), 069 (PWA offline, accessibility, UX polish). |
| 2026-07-16 (Plan 065) | #461 | Plan 065: OpenRouter + Ollama CPU-only, typed adapters, BM25 context, Zod validation. |
| Earlier sessions | #289, #399, #430–#431, #437, #445–#449 | Plans 063 (real 39x39 TRIZ contradiction matrix + 40 principles), 062 (shared component primitives), 061 (CodeMirror 6 spike — keep the textarea), 060 (Playwright E2E harness, 58 tests), 059 (perf/disclosure/locale), 058 (GOAP swarm: contrast, dialog semantics, home redesign, tablet breakpoint), 053 (markdown editor), 048 (Next.js migration cleanup), 049 (AI provider integration, encrypted export, Zod schemas, BM25), 040 (complete export pipeline). |

## Key Metrics (2026-07-26)

| Metric | Before (082) | After (083) |
| --- | --- | --- |
| Unit test files | 60 | 69 |
| Unit tests | 923 | 1037 |
| E2E test files | 8 | 8 |
| E2E tests | 58 | 58 |
| Total tests | 981 | 1095 |
| CI checks | 22/22 | 22/22 passing |
| LOC violations | 0 | 0 |
| Lint warnings | 0 | 0 |
| Type errors | 0 | 0 |
| Coverage (lines) | 52.56% | 57.04% (targets met) |
| Coverage (branches) | 45.13% | 50.02% |
| Coverage (functions) | 41.46% | 45.73% |
| Coverage (statements) | 52.66% | 57.50% |

## ADR Reconciliation (2026-07-25)

| ADR | New Status | Reason |
| --- | --- | --- |
| 002 Security Export | Implemented | XSS prevention via WebCrypto AES-GCM |
| 004 DB Migration | Superseded by ADR 028 | localStorage replaces SQLite |
| 005 Error Handling | Superseded by ADR 028 | Specific patterns replace generic |
| 010 Export Schema v1 | Implemented | Zod validators in schema.ts |
| 013 Design Tokens | Implemented | @theme block in globals.css |
| 015 Responsive Theming | Implemented | Mobile-first Tailwind breakpoints |
| 016 Feature Gap Closure | Superseded | By Plans 072/073 |
| 018 Next.js Architecture | Implemented | Production baseline |
| 019 AI Provider | Superseded by ADR 025 | OpenRouter + Ollama consolidation |
| 021 Encrypted Export | Implemented | WebCrypto in encrypt.ts |
| 022 Retrieval Engine | Implemented | BM25 in retrieval.ts |
| 023 Draft Persistence | Implemented | Versioned localStorage drafts |
| 024 Feedback Policy | Implemented | Inline status, no routine toasts |
| 011 CLI Extraction | Superseded by ADR 018 | CLI removed during Next.js migration |
