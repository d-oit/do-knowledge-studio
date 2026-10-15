# Plan 166 — Codebase Improvement Audit and Followups

**Date:** 2026-10-13

**Scope:** Static audit of `src/`, `scripts/`, and `.github/workflows/` at
`1f1fc50`, plus targeted runtime checks. This plan makes no source changes: it
records verified progress against Plans 131/161/162/165 and the followups the
audit found.

## Method and evidence

- Static inspection of source, plan records, and workflow files.
- Runtime checks: two AI-harness Vitest suites; a live `pnpm run dev` browser
  pass (agent-browser) through a real chat send; yamllint 1.38.0 and actionlint
  1.7.12 run with the CI configurations.
- Not run: the full `quality_gate.sh`, the full unit/E2E suites, coverage, CI,
  or deployment checks.

## Progress reconciliation (verified 2026-10-13)

| Item | Status | Evidence |
|---|---|---|
| F1 — AI request control | **Implemented** | Stop control plus a 120s request timeout (#923, merged 2026-10-12), localized provider-error mapping (#927), and completed-response announcements (#926). `use-ai-harness-chat.ts` exposes `stop`; `ai-harness-chat.tsx` renders the Stop button while loading and restores Send afterwards. `pnpm vitest run ai-harness-view.test.tsx ai-harness-chat.test.tsx` → 2 files, **54 tests passed, 0 type errors**, including "Stop aborts the in-flight turn (#923)". Localized copy lives in `src/lib/i18n/messages/ai.ts`. Plan 162/165 still list F1 as open; the merged implementation and tests show otherwise. |
| F2 — URL deep links | Implemented | Plan 165 Step 3 (`f7d970f`); [ADR 037](ADRs/037-url-addressable-view-state.md) is Implemented. |
| Plan 161 — dev search-worker error | **Resolved — verified in dev** | Live dev pass: a chat send fetched the Turbopack worker bundle (`…/src_lib_search_search-worker_ts_…`), the captured `console.error` list stayed empty, and the reply rendered with cited sources. The worker no longer uses `importScripts` (semantic search runs on the main thread; `search-worker.ts` is a module worker), and `SearchWorkerClient` bounds requests with `SEARCH_WORKER_TIMEOUT_MS = 3000` plus a main-thread fallback. |
| Plan 161 — workflow-linter warnings | **Resolved — verified** | `yamllint -d "{extends: default, rules: {line-length: {max: 120}, indentation: {spaces: 2}}}" .github/` → exit 0, no findings; `actionlint .github/workflows/*.yml` → exit 0, no findings. The previously cited `comments-indentation` and `SC2002` warnings no longer reproduce. |
| Plan 161 — first-mount reduced motion | **Partially open** | `use-reduced-motion.ts` uses `useSyncExternalStore`, fixing the hydration mismatch (`getServerSnapshot = () => false`). Because the server and hydration renders answer `false`, a reduced-motion user's first mount can still tween before the preference applies. The recorded acceptance ("first paint has no unintended tween and no hydration mismatch") is not met yet. |
| Plan 131 — eager sync/export chunks | **Closed** | `app-shell.tsx` lazy-loads all six heavy views (`React.lazy`); `use-export-handlers.ts` imports `fflate`, `export-documents`, and `encrypt` on use; `sync/bridge.ts` imports `./doc` persistence on use. |
| Plan 131 — Vitest source-error gating | **Closed** | `vitest.config.ts` sets `ignoreSourceErrors: false`; the legacy `*.test.ts` errors were cleared under Plan 159 F7. |

## New findings

### N1 — Markdown typography classes are inert (High)

`editor-preview.tsx:21` and `chat-subcomponents.tsx:258` render Markdown inside
`prose prose-sm dark:prose-invert`, but `@tailwindcss/typography` is absent from
`package.json` and `pnpm-lock.yaml`, and `globals.css` has no `@plugin` directive.
Every `prose` class is therefore inert: headings, lists, blockquotes, and code in
the editor preview and in assistant messages fall back to unstyled output.

PR #951 ("Enable Tailwind Typography for Markdown preview") adds the plugin,
lockfile entries, and a regenerated `precache-manifest.json`. It is currently
**CONFLICTING / DIRTY** and its Vercel check fails; the other checks pass.

Followup acceptance: plugin enabled through the Tailwind v4 `@plugin` directive;
preview and chat headings/lists/blockquotes styled in both themes with accessible
contrast; `pnpm run build` regenerates the precache manifest; PR #951 rebased or
superseded with a fresh deployment check.

**Outcome (2026-10-15) — resolved and merged.** PR #951 was merged into `main`
at `f0aead5` under standing authorization after full CI, Codacy, and E2E passes.
The Tailwind v4 `@plugin` directive is active, `@tailwindcss/typography` is locked,
emitted CSS carries 544 `prose` rules, and production deployment succeeded on Vercel.
Light/dark theme contrast and assistant chat prose formatting are verified in production.

### N2 — `indexeddb-backup.ts` has no production caller (Medium)

`src/lib/studio/indexeddb-backup.ts` (and its test file) is referenced only from a
comment in `vector-store.ts:14`. README was corrected in Plan 165 to describe
IndexedDB as the Yjs sync replica rather than a recovery tier, which leaves the
module as unclaimed dead code.

Followup acceptance: either wire it as a documented tier (quota/refusal tests and
truthful UI) or delete module and tests; the tree should not keep a half-state.

**Outcome (2026-10-15) — resolved by deletion.** Removed `src/lib/studio/indexeddb-backup.ts`,
its test suite `src/lib/studio/indexeddb-backup.test.ts`, and the stale comment in
`src/lib/search/vector-store.ts`. Cleaned up 269 LOC of uncalled storage code; local truth
remains strictly Zustand + localStorage per AGENTS.md.
### N3 — Pointer/touch interaction (F3) needs its gesture spec (Medium)

Graph: node click/Enter selection, keyboard pan (`Arrow` keys), zoom (`+`/`-`),
Home reset, and toolbar buttons; no drag-pan, wheel zoom, or pinch. Mind map:
click and keyboard tree operations; no touch gestures. Plan 162 requires the
gesture spec before implementation.

Followup acceptance (spec first): drag-pan, wheel/pinch zoom clamped to the
existing `MIN_ZOOM`/`MAX_ZOOM`, tap-select, long-press actions, preserved keyboard
navigation/ARIA tree behavior/native scroll, 44px targets, and reduced-motion
respect; then implement with pointer/touch E2E coverage.

**Outcome (2026-10-15) — spec accepted.** Authored [Plan 169](169-touch-gesture-specification-2026-10-15.md)
specifying pointer drag-pan, cursor-focal wheel zoom, 2-finger touch pinch-to-zoom/pan,
and tree swipe disclosure actions under strict clamping and accessibility invariants. Ready for Phase 1 implementation.

### N4 — Cursor/Windsurf manifest semantics (Low)

`.agents/manifest.json` declares `"symlink_strategy": "directory"` for `.cursor`
and `.windsurf`, while `agent-surface.py` treats every non-`none` value as a
relative symlink; both directories are currently symlinked and validate.

Followup acceptance: manifest values match implemented behavior (or directory
semantics are implemented), and `setup-skills.sh` plus `agent-surface.py validate`
stay clean.

### N5 — markdownlint is not installable by the gate (Low)

`quality_gate.sh` skips markdown checks when the `markdownlint` binary is absent
(it is not a devDependency, so CI and clean sandboxes skip it). ADR 042 records
that adding `markdownlint-cli` is necessary but not sufficient (`--config` must be
passed and the binary must reach `PATH`).

Followup acceptance: the gate runs `markdownlint --config markdownlint.toml` in
CI, or the skip is explicitly accepted in ADR 042.

### N6 — Plan/ADR number collisions (Low)

Duplicate plan numbers: 12, 041, 043, 059, 080, 084, 111, 116, 134, 135, 136,
160, 162. The ADR set has both `006-export-deduplication.md` and
`06-llm-provider-system.md`. Renaming files would break links; disambiguate in
`plans/INDEX.md` (or rename with redirects) instead.

Followup acceptance: INDEX distinguishes same-numbered records; no broken links.

## Unscheduled feature candidates (scope refined)

- **Graph revision comparison:** diff a stored snapshot against the current
  graph; list added/removed entities and edges; read-only; snapshot and graph
  unchanged.
- **Synthesis Inbox (Plan 11.1):** local heuristics (shared tags/claims, vector
  similarity) propose links and contradictions; human accept/dismiss; accept
  creates a link, dismiss persists; fully local, no backend.
- **Visual Query Builder (Plan 11.6):** retarget from the retired SQLite/Orama
  stack (ADR 018) to current retrieval; compose type/tag/relation/text filters
  with a live result preview; no server.

## Suggested order

1. N1 typography (visible defect; an open PR already exists).
2. N2 backup decision (dead code and claim accuracy).
3. N3 gesture spec, then F3 implementation.
4. N4 manifest alignment; N5 gate wiring; N6 index hygiene.
5. Candidates only when prioritized.

## Verification performed

- `pnpm vitest run src/components/studio/views/ai-harness-view.test.tsx src/components/studio/views/ai-harness-chat.test.tsx` → 2 files, 54 tests passed, 0 type errors.
- Live dev pass on `pnpm run dev`: worker bundle fetched, zero captured `console.error` entries, cited reply rendered.
- `yamllint` 1.38.0 (CI config) and `actionlint` 1.7.12 → clean.
- Static scans: no TODO/FIXME markers, empty `catch` blocks, `any`, `console.log`, `Math.random()`, `JSON.parse(JSON.stringify(…))`, or `dangerouslySetInnerHTML` in production source. Largest production file: `ui/sidebar.tsx` (788 LOC, documented shadcn exception); `store.ts` is 365 LOC with slices.
- Docs gates for this change: `./scripts/quality_gate.sh --scope docs` passed; `validate-links.sh` checked 58 skill files / 211 links with 0 broken; `validate-skills.sh` passed agent-surface validation; `markdownlint --config markdownlint.toml` over the four changed files reported no findings (config enforcement sanity-checked against a trailing-space file).

## Records updated

- This plan; `plans/INDEX.md` (Plan 166 entry plus Plan 162 and Plan 131 status corrections).
- Reconciliation notes appended to Plans 162 and 165.
