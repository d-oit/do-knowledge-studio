# Plan 130 — UI/UX, Test Pyramid, Errors & Logging (GOAP) (2026-08-22)

Date: 2026-08-22
Status: PROPOSED
ADRs: `plans/ADRs/035-global-error-handling-and-client-side-logging.md`,
`plans/ADRs/036-e2e-responsive-test-matrix.md`,
`plans/ADRs/037-url-addressable-view-state.md`

## Task Analysis (GOAP Phase 1)

**Primary Goal**: Close the structural gaps found in the 2026-08-22
audit across three focus areas — global error handling & logging, the
E2E test pyramid with full responsive coverage, and UI/UX adoption
debt — without breaking local-first rules or adding runtime deps.

**Method**: Codebase exploration (app shell, all views, store, and
config), official docs research (Next.js App Router error handling,
Playwright best practices), and structured-logging practice review.

**Constraints**:

- Local-first only; no required backend; zero new runtime deps.
- Strict TypeScript, named exports, no magic numbers (AGENTS.md).
- Planning artifacts land first (this file plus ADRs 035–037).
- Every goal keeps lint/typecheck/unit/build green; e2e goals keep
  the existing suite passing before adding to it.

## Sub-Goals (GOAP Phase 2)

- **G1** — Error handling & logging infrastructure — **P0**, no deps,
  ADR 035.
- **G2** — E2E pyramid integrity (prod build + CI matrix + shared
  fixtures) — **P0**, no deps, ADR 036.
- **G3** — Missing flow E2E coverage — P1, depends on G2, ADR 036.
- **G4** — UI/UX P1 fixes (tokens, theme, motion, responsive) — P1,
  no deps.
- **G5** — Coverage thresholds, dark-theme tests, hygiene, visual
  regression — P2, depends on G2 and G4, ADR 036.
- **G6** — URL-addressable view state — P1, no deps, ADR 037.

Dependency sketch:

```text
G1 ──┐
G2 ──┼──> G3 ──> G5
G4 ──┘
G6 (independent)
```

## Reality Check (from audit)

- `src/app/` has no `error.tsx`, no `global-error.tsx`, no
  `not-found.tsx`, and no `global-not-found.tsx`; no
  `unhandledrejection` or `error` listeners exist anywhere in `src/`.
- `AppError` (`src/lib/errors.ts`) and `ViewErrorBoundary`
  (`view-error-boundary.tsx`, wired at `app-shell.tsx:77`) are solid
  foundations to layer onto.
- 31 `console.*` call sites across store/sync/AI/editor/speech code.
- `playwright.config.ts` webServer runs `pnpm run dev`; CI runs only
  `--project=chromium` (`ci-and-labels.yml`) although the `mobile`,
  `tablet`, and `desktop-xl` projects are configured. Plan 002 fixed
  this once (prod TDZ crash class) and it regressed back.
- Persist-envelope seeding exists inline only in
  `library-virtualization.spec.ts` (key `'do-knowledge-studio-store'`,
  versioned envelope). Helpers available:
  `e2e/helpers/navigation.ts` (`navClick`, `openNavIfHidden`),
  `e2e/helpers/editor.ts` (`createNewEntity`, `switchEditorMode`),
  and `e2e/helpers/a11y.ts` (axe assertions).
- No delete-entity, export-import, graph-interaction, or mind-map
  editing specs exist. No screenshot assertions anywhere; dark theme
  is never activated in E2E.
- Vitest thresholds gate nothing: branches 48 %, functions 50 %,
  lines 55 %, statements 55 % (`vitest.config.ts:33-38`).
- UI debt: dead SearchPanel close button (`right-panel.tsx:54-59`);
  CitationsPanel lacks a close affordance (~`:326-375`); about 55 raw
  palette classes break dark parity; no semantic status tokens;
  hardcoded `'#faf8f3'` (`mindmap-view.tsx:138`); system color-scheme
  disabled (`theme-provider.tsx:11-12`); static `themeColor`
  (`layout.tsx:58-60`); missing reduced-motion gating in
  `ai-harness-chat.tsx`; fixed `h-[520px]` chat height; TRIZ matrix
  table without overflow affordance (`triz-matrix-view.tsx:126`);
  editor panes fixed `min-h-[420px]` (`editor-view.tsx:254,260`);
  228 arbitrary `text-[Npx]` despite type-scale utilities
  (`globals.css:452-460`); dead vaul dep plus unused `ui/drawer.tsx`
  and `ui/toast.tsx`; view state not URL-addressable
  (`store.ts:407`).

## Execution Strategy (GOAP Phase 3-4)

Strategy: tracks run in parallel; within a track actions are
sequential by number. Quality gates per action: lint, typecheck, and
unit tests; e2e actions also run the full Playwright suite on all
configured projects locally before push.

### G1 — Error handling & logging infrastructure (ADR 035)

- **A1** (2h) — Create `src/lib/logging/logger.ts`: levels
  (`debug|info|warn|error`), child context tags, console sink,
  bounded ring-buffer sink, and a `LogSink` interface for future
  opt-in transports.
- **A2** (1h) — Unit tests for the logger covering levels, tags,
  ring-buffer bounds, and redaction-safe serialization.
- **A3** (2h) — Add `src/app/error.tsx` (`error` + `reset` props,
  log in `useEffect`, show digest), `global-error.tsx` (own
  `<html>/<body>`), `not-found.tsx`, and `global-not-found.tsx`;
  token-styled wherever layout allows.
- **A4** (1h) — Global runtime handlers provider registering
  `unhandledrejection` and `error` into the logger with dedup, and
  effect cleanup on unmount.
- **A5** (2h) — Migrate all 31 `console.*` sites to tagged logger
  calls.
- **A6** (1.5h) — E2E boundary-recovery spec proving the fallback
  renders and recovers; error files reachable.

Success criteria: every failure path lands in one stream; framework
crash pages are themed; zero bare `console.*` left in `src/`.

### G2 — E2E pyramid integrity (ADR 036)

- **A7** (1h) — `playwright.config.ts`: production-build default
  webServer via `PLAYWRIGHT_MODE` switch; HTML reporter; add the
  `webkit` project for the nightly tier.
- **A8** (1.5h) — CI wiring: PR gate runs chromium + mobile; nightly
  runs the full matrix including webkit; install only tier browsers.
- **A9** (2h) — Extract `e2e/helpers/store.ts` seed fixture (persist
  envelope, schema-version aware) plus an export-download helper;
  refactor `library-virtualization.spec.ts` onto them.

Success criteria: E2E exercises the production bundle; mobile layout
gates PRs; seeding is reusable.

### G3 — Missing flow E2E coverage

- **A10** (1.5h) — `crud-delete.spec.ts`: entity deletion plus
  reset-confirm destructive flows.
- **A11** (2h) — `export-import.spec.ts`: JSON export download, then
  re-import, then verify round-trip.
- **A12** (2h) — `graph-interaction.spec.ts`: node focus and
  neighborhood, snapshot undo/redo.
- **A13** (2h) — `mindmap-editing.spec.ts`: create, rename, connect,
  delete nodes.

Conventions: role-based locators only, viewport-aware navigation via
helpers, isolated contexts per test.

### G4 — UI/UX P1 fixes

- **A14** (0.5h) — Wire SearchPanel close
  (`setRightPanelOpen(false)`); add CitationsPanel close affordance.
- **A15** (3h) — Add semantic status tokens `--success`,
  `--warning`, `--danger` (light+dark) to `@theme`; migrate raw
  palette classes; fix the hardcoded hex in mindmap-view.
- **A16** (1.5h) — System color-scheme tri-state toggle; adaptive
  `themeColor`.
- **A17** (1.5h) — `useReducedMotion` gating in ai-harness-chat;
  dvh-aware chat height; TRIZ table overflow scroll; audit editor
  pane min-heights on short screens.

### G5 — Coverage, dark theme, hygiene, visual regression

- **A18** (0.5h) — Raise vitest thresholds toward actuals (target
  lines >= 75 %, branches >= 65 %).
- **A19** (1h) — Activate dark theme in a11y/touch-target specs via
  data-theme context.
- **A20** (0.5h) — Purge dead vaul dep and unused `ui/drawer.tsx`,
  `ui/toast.tsx`.
- **A21** (3h) — Codemod worst-offender `text-[Npx]` sites to
  type-scale utilities (sync-helpers, right-panel, library-view
  first).
- **A22** (2h) — Visual baselines: home/library/editor/graph times
  light/dark times 375/768/1280 with `maxDiffPixelRatio` tolerance;
  document the regeneration script.

### G6 — URL-addressable views (ADR 037)

- **A23** (2h) — Hash-sync module mapping `#/view` to currentView
  with popstate handling, hash-wins-on-load, invalid-to-home
  fallback; wire into app-shell.
- **A24** (1h) — E2E deep-link and Back/Forward traversal spec
  across viewports.

## Validation Plan (GOAP Phase 5)

Per track and final:

```bash
pnpm run lint && pnpm run typecheck && pnpm run test
pnpm run build
pnpm run test:e2e            # all projects locally after G2 lands
./scripts/quality_gate.sh    # required before commit
```

Additional gates:

- Grep gate for G1: no `console.(log|warn|error)` outside the logger
  module and test files.
- Threshold gate for G5: `test:coverage` passes at raised thresholds.
- Visual baselines committed intentionally; CI diff failures are
  reviewed as real regressions until proven noise.
- CI must be fully green (including Codacy) before merge; PR squash
  merge only (linear history).

## Out of Scope (follow-up candidates)

- Remote/opt-in telemetry sink behind the `LogSink` interface.
- Functional sync/QR-pairing E2E (multi-context WebRTC harness).
- Firefox project addition (WebKit covers cross-engine risk first).
- Full i18n extraction of user-facing strings (locale constants were
  noted during the audit).
