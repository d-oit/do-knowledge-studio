# Plan 165 — Backlog Remediation and PR Integrity Guards

**Date**: 2026-10-13
**Related**: [Plan 162](162-roadmap-progress-and-next-work-2026-10-05.md), [Plan 163](163-open-pr-issue-sweep-2026-10-12.md), [ADR 027](ADRs/027-canonical-state-and-p2p-sync-bridge.md), [ADR 037](ADRs/037-url-addressable-view-state.md), [ADR 043](ADRs/043-canvas-reference-integrity.md), [ADR 044](ADRs/044-pr-integrity-guards.md)

## Scope

Execute the selected implementation gaps recorded by Plan 162 and the two CI
follow-ups from Plan 163. The dated source findings in those plans remain
historical; this plan records the later implementation and its evidence.

## Step outcomes

| Step | Commit | Outcome and evidence |
|---|---|---|
| 1 — Canvas reference integrity | `e2ee5a6` | Delete, import, hydration, recovery restore, remote reconciliation, and JSON export prune dangling graph/mind-map edges and links. Undo/recovery history carries canvas state. Added unit, integration, and browser coverage. See [ADR 043](ADRs/043-canvas-reference-integrity.md). |
| 2 — Sync leave/rejoin lifecycle | `a2dcbea` | Leaving destroys the WebRTC provider without destroying the shared Yjs document or IndexedDB persistence; the app-shell bridge stays active for rejoin. Initial join now surfaces canonical-merge conflicts. Covered by `doc-rejoin.test.ts` and `sync-view-coverage.test.tsx`; [ADR 027](ADRs/027-canonical-state-and-p2p-sync-bridge.md) records the lifecycle correction. |
| 3 — URL-addressable views | `f7d970f` | View state synchronizes with recognized `#/view` hashes, reload, and browser Back/Forward; unknown hashes resolve to Home. `e2e/view-url.spec.ts` covers precedence, reload, invalid hashes, and history traversal. [ADR 037](ADRs/037-url-addressable-view-state.md) is Implemented. |
| 4 — Heavy-leaf deferral | `cdbd0f3` | Sync and document-export dependencies are deferred behind their usage boundaries. The measured first-load JavaScript decreased by 9,333 bytes (about 0.53%); the production build regenerated the precache manifest. |
| 5 — Documentation reconciliation | `786250d` plus the Step 7 README correction | Reconciled the skills catalogs, agent-surface CLI, script catalog, quality-gate workflow, and stale README claims. The final README distinguishes core Zustand/localStorage state and recovery snapshots from the separate Yjs IndexedDB replica; it also documents browser-local BM25 and first-use model downloads versus later offline inference while cached assets remain. Cursor/Windsurf `directory` strategy semantics remain open (Plan 162 S3). |
| 6 — PR integrity guards | `1848da9` | Added dependency-range and stale-base deletion checks to PR CI, focused BATS suites, workflow documentation, and [ADR 044](ADRs/044-pr-integrity-guards.md). The repository ruleset was not changed. |
| 7 — Records, verification, and delivery | Step 7 commit | Reconciles Plan 162/163, INDEX, and ADR 027; records Plan 165 and ADR 044; fixes ChatView focusability; pins Vitest and coverage at 4.1.11. The E2E defect and local evidence are below. Remote CI, review threads, and merge remain in the PR workflow. |

## Verification evidence

- **Steps 1–4 combined** — the full lint, typecheck, unit-test, coverage,
  production-build, and offline E2E runs passed. The canvas and URL browser specs
  are in the repository's E2E suite.
- **Step 5** — `./scripts/quality_gate.sh --scope docs` passed; generated skill
  catalogs passed `--check`; the validator found 58 skill files, 211 references,
  and 0 broken links.
- **Step 6** — both focused BATS suites passed (7/7); defect-injected guard
  failures were observed before restoring the implementation; ShellCheck passed.
  `pnpm install --frozen-lockfile` and
  `./scripts/quality_gate.sh --scope tooling` passed. The workflow YAML suite
  passed 64 tests. A local run against `origin/main` found no dependency
  downgrades and no target-branch additions missing from the PR tree.
- **Step 7 all-scope quality gate** — `./scripts/quality_gate.sh` passed after
  the ChatView fix and reran after the exact Vitest pin: skills validation
  (58 files / 211 links / 0 broken), lint, typecheck, Vitest, ShellCheck, and
  BATS all passed. The final docs-scope rerun after the plan edits also passed
  (58 skill files / 211 links / 0 broken).
- **Vitest typecheck notice** — The commit hook emitted Vitest's experimental
  typecheck banner. `vitest` and `@vitest/coverage-v8` are exact-pinned to
  `4.1.11` per its recommendation; the focused `doc-rejoin.test.ts` passed 1/1
  after the pin. The banner remains because typechecking is experimental; a
  stable test-source typecheck is a tooling follow-up.
- **Mobile accessibility regression** — The initial full E2E run ended with 703
  passed, 4 skipped, and 1 failed: the mobile Chat axe check found serious
  `scrollable-region-focusable` on the message scroller
  (`e2e/accessibility.spec.ts:142`, `chat-view.tsx:95`). The isolated mobile
  axe test reproduced it before the fix. Adding `tabIndex={0}` made the focused
  test pass (1/1); unsetting `NO_COLOR` removed the conflicting Node warning.
- **Final browser suites** — `env -u NO_COLOR pnpm run build` passed and
  generated 70 precache URLs (22 document, 45 chunks, 17 media).
  `env -u NO_COLOR pnpm run test:e2e` passed 704 tests, with 4 skipped and none
  failed; `env -u NO_COLOR pnpm run test:e2e:offline` passed 6/6. The dev suite
  logged the still-open Plan 162 search-worker `importScripts` follow-on,
  Playwright service-worker registration-block diagnostics, and the deliberate
  version-99 / oversized-recovery test scenarios; none failed the suite.

## Shadow and canary evidence

- **Canvas shadow** — `e2e/canvas-integrity.spec.ts` ran against isolated
  baseline dev server at `dff8b53` and the candidate production build with the
  same imported fixture. Baseline produced both pre-fix failures: deleting
  `e1` left graph/mind-map nodes, the graph edge, and top-level link persisted;
  JSON export retained `e1`. The candidate passed both checks. Each origin kept
  its own localStorage.
- **Sync shadow** — The same `before-leave` Yjs entity and `room-a` scenario ran
  through the baseline `destroy()` path in an isolated Vitest worktree: the
  provider was destroyed, `getDoc()` returned a replacement, and the entity
  list emptied. Candidate `doc-rejoin.test.ts` in the full Vitest suite covers
  `leaveRoom()` preserving the document, entity, and observer.
- **Local canary** — The candidate production build ran in managed Chromium at
  a 390 × 844 mobile viewport. The Chat scroller had `tabIndex=0`; sequential
  Tab reached it at stop 12 and the focus outline rendered. Mobile drawer
  navigation set `#/graph`; browser Back returned to `#/chat`, and reload kept
  `#/chat`. `tab.errors()` was empty. The message scroller measured 480px high
  with 480px of content, so this verified keyboard focus and URL navigation,
  not overflow movement.

## Remaining scope

Plan 165 does not close Plan 162 F1 (AI request control), F3 (pointer/touch
interaction), S3 (Cursor/Windsurf strategy semantics), the three Plan 161
recorded follow-ons, graph revision comparison, Synthesis Inbox, or Visual Query
Builder. These remain explicitly open in Plan 162; this plan does not claim
otherwise.
