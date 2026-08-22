# Plan 131 — GOAP Swarm Improvement Audit (2026-08-22)

Date: 2026-08-22
Status: PROPOSED
Method: Six-agent parallel swarm audit orchestrated via GOAP
Related: Plan 122 (list virtualization), Plan 130 (UI/UX, test pyramid,
error handling), ADR 027 (sync), ADR 028 (data integrity), ADR 018
(AI settings storage)

## Task Analysis (GOAP Phase 1)

**Primary Goal**: Produce a comprehensive, evidence-based improvement
plan for the codebase across six complementary domains, sequenced into
executable goals with dependency ordering — without duplicating work
already committed in Plans 122 and 130.

**Constraints**:

- Local-first only; Zustand + localStorage remains the canonical
  persistence layer.
- Strict TypeScript; named exports; no magic numbers (AGENTS.md).
- No overlap with Plan 130's lane (UI/UX tokens, E2E pyramid,
  error-boundary/logging infrastructure).
- Planning artifact only — implementation happens in follow-up PRs
  per goal.

## Method (Swarm Composition)

Six read-only explore agents ran in parallel, one per domain, each
returning prioritized findings with `file:line` evidence verified
against the working tree:

| Domain | Focus |
|--------|-------|
| D1 | State architecture, data integrity, sync layer |
| D2 | Runtime performance & bundle size |
| D3 | Search/NLP, AI harness, export pipeline internals |
| D4 | Component/view code architecture (not visual UX) |
| D5 | Unit/integration test depth & quality infrastructure |
| D6 | Dependencies, tooling & repository infrastructure |

Total: ~90 distinct findings. The highest-severity cluster is data
integrity around the persistence contract (D1), which gates several
other goals.

## Decisions Recorded (maintainer, 2026-08-22)

1. **Sync direction**: finish the bidirectional bridge per ADR 027
   (do not descope).
2. **Lint governance**: fix the ESLint config to match AGENTS.md
   (re-enable `@typescript-eslint/no-explicit-any` and
   `react-hooks/exhaustive-deps` incrementally) rather than amending
   AGENTS.md. This is the explicitly requested config change required
   by the "never modify lint config without approval" rule.
3. **Artifact scope**: full audit + complete GOAP decomposition in
   this single file.

## Reality Check (Findings Catalog)

### D1 — State architecture & data integrity

P0 — active user-data-loss paths:

- **D1.1 Corrupt-rehydration fallback is false.**
  `src/lib/studio/store.ts:429-436` — on Zod failure `migrate` does
  `return persistedState`; the comment claims seed defaults apply, but
  zustand's default merge is `{ ...currentState, ...persistedState }`,
  so raw invalid records spread directly over seed state. One persisted
  entity missing `tags` makes `useFilteredEntities` throw at
  `e.tags.some(...)` (`store.ts:460`) — Library white-screens.
  Contradicts ADR 028 §4. Same defect in the migration-failure branch
  (`store.ts:424-427`).
- **D1.2 First undo after reload reverts the library to demo seed
  data.** History is excluded from `partialize`
  (`store.ts:403-417`) and initializes to `[seedEntities]` /
  `historyIndex: 0` (`store.ts:130-131`). After rehydration,
  `entities` = user data while `entityHistory[0]` = seed. First edit
  post-reload builds `[seedEntities, currentUserData]`
  (`store.ts:155-165`) → one `undo()` swaps the corpus for the TRIZ
  demo dataset (`store.ts:167-173`).
- **D1.3 Version wiring ignores zustand's version argument.**
  Zustand calls `migrate(state, storedVersion)` with version *outside*
  state; our `migrate(persistedState)` drops the second argument and
  `runMigrations` reads `state.version ?? 1`
  (`src/lib/studio/migrations.ts:112,119`) — always undefined → the
  full chain replays on every mismatch hydration. Future-version
  stores are silently accepted, backfilled, stamped `version:
  CURRENT`, re-persisted at the old format, destroying newer-format
  fields. `migrations.test.ts:109-119` encodes the wrong assumption.

P1 — correctness/data-integrity defects:

- **D1.4 Chat/UI preferences dropped whenever `migrate` runs.**
  `partialize` persists `chat, currentView, searchQuery, typeFilter,
  sortBy, sortDir, rightPanelOpen` (`store.ts:403-417`);
  `PersistedEnvelopeSchema` (`schema.ts:121-129`) contains none of
  them → validation returns only envelope fields → prefs reset to
  seed on any version bump.
- **D1.5 Zod validation runs only on version mismatch.** Same-version
  hydration (the common path) merges deserialized state with no
  validation anywhere (zustand only calls `migrate` when versions
  differ). Any corrupt-but-parseable write lands unvalidated.
- **D1.6 Deleting an entity deletes its claims permanently — even
  undo cannot restore them.** `deleteEntity` removes matching claims
  (`store.ts:228`) but history snapshots entities only
  (`Entity[][]`); claims CRUD never participates in history
  (`store.ts:233-271`).
- **D1.7 Sync inbound bridge is dead code.**
  `startBidirectionalSync` (`src/lib/sync/bridge.ts:278-332`) is the
  only caller of `subscribeToYjs`/`applyRemoteUpdate`; grep finds zero
  production call sites. `sync-view.tsx` pushes local→Yjs only
  (`:132,:155`) — users see "Merged N entities" while received data is
  invisible. ADR 027 §2 requires this lifecycle owner.
- **D1.8 Claim provenance destroyed by any sync round-trip.**
  `claimToYMap` omits `version`/`editHistory`
  (`sync/types.ts:60-73`); `ymapToClaim` never restores them;
  `mergeSingleClaim` builds merged claims from 7 fields, dropping
  `createdAt/updatedAt/version/editHistory` (`merge.ts:250-258`) —
  LWW degrades and versioning restarts at 2 after one merge.
- **D1.9 Join-time conflicts silently auto-resolved; tombstones die
  with the session.** `mergeIntoYjs`'s `result.conflicts` discarded on
  join (`sync-view.tsx:132-133`, surfaced only on manual Resync at
  `:154-165`) violates ADR 027 §4. Tombstones live inside the Yjs doc
  meta map (`tombstones.ts:16-27`) so `destroy()` erases deletion
  records → deleted records resurrect on next merge. Leave→Join never
  re-invokes `initPersistence` (`sync-view.tsx:71-75`) → no durable
  replica for the second session.
- **D1.10 No cross-tab coordination.** Zero `BroadcastChannel` /
  `storage` listeners for the main store; two tabs are last-writer-
  wins over the whole blob on every `setState`.
- **D1.11 Tombstone guard inverted for new records.**
  `bridge.ts:186,195` — `if (!local || !isTombstoned(remote.id))`:
  absent local short-circuits true, so a tombstoned remote record gets
  inserted. Currently masked by pre-filtered callers; the exported
  contract is wrong and its branch test cements it.
- **D1.12 Recovery path unreachable; rollback success reported
  without a durable backup.** `restoreFromRecovery` has no production
  invoker (tests only); `importWithRollback` may skip the snapshot
  above 4 MB (`recovery-helpers.ts:57-59`) yet still returns
  `{ success: true }` (`store.ts:355`); recovery snapshotting clones
  the full 50-deep history synchronously (`recovery-helpers.ts:45`).
- **D1.13 AI settings diverge from the storage architecture.**
  IndexedDB + sessionStorage AES key (`ai-settings.ts:101-148`) is a
  third persistence layer with no Zod validation on read
  (`applyStoredSettings` `:220-235`); legacy localStorage migration
  marks done before verifying the subsequent read works (`:179-194`).

P2 — design debt:

- **D1.14** Store at 497 LOC spans six concerns; slicing due before
  next feature (`commitEntity` vs `saveEntity` differ only by
  navigation side effects, `store.ts:182-208`).
- **D1.15** Unknown-key policy is silent stripping; forward-compat
  fields vanish without trace (`schema.test.ts:102-106` asserts it as
  intended) — policy undocumented.
- **D1.16** History memory model relies on an undocumented
  shallow-clone invariant: `entities.map(e => ({ ...e }))`
  (`store.ts:157`) shares `links`/`tags` arrays across up-to-50
  snapshots; safe only while every mutator replaces wholesale.
- **D1.17** `deleteEntity` leaves `graph.nodes/edges`, `mindMap`,
  `links[]`, `tags[]` dangling (`store.ts:218-231`); exports ship
  ghost nodes/edges verbatim (`export-view.tsx:19-20`).
- **D1.18** Merge semantics gaps: tags union without delete semantics
  (`merge.ts:134-174`); tie-breaks disagree between
  `merge.ts:122-131` (local) and `conflict.ts:7,14` (remote via `>=`).
- **D1.19** Cursor/presence registries fan out N² and leak across
  sessions (`cursors.ts:131-155`, `presence.ts:104-130`;
  `doc.destroy()` clears nothing).
- **D1.20** Sync stack ships always-on with duplicated hardcoded
  signaling endpoints incl. a defunct herokuapp host
  (`doc.ts:54-57`, `discovery.ts:148-151`); no feature flag/env gate;
  static import chain defeats `initSync`'s dynamic import
  (`bridge.ts:214-217`).
- **D1.21** Every keystroke serializes the full corpus to localStorage
  (`searchQuery` in `partialize` + persist writes per `setState`).
- **D1.22** `undo`/`redo` leave `editingEntityId`/`selectedEntityId`
  dangling (`store.ts:167-181`); AI chat send lacks AbortController
  (`store.ts:278-304`).
- **D1.23** Recovery-snapshot history rows validated as bare
  `{ id }` shells (`recovery-helpers.ts:72,121-132`) — restore can
  poison undo.
- **D1.24** `readRecoverySnapshot` lets `JSON.parse` throw to callers
  (`recovery-helpers.ts:102`).
- **D1.25** Reset paths spread module-level seed arrays by reference
  (`store.ts:107-122`) — clone or freeze for hermetic resets.

Strengths to preserve: atomic selector discipline + derived hooks
(`store.ts:444-497`); import front door honors ADR 028 (validation,
orphan rejection with paths, preview); echo-loop origin tagging
(`bridge.ts:19,141,147`); inbound peer records reuse Entity/Claim
schemas (`inbound.ts`); draft storage validates-and-deletes corrupt
entries; bounded BM25 cache.

### D2 — Runtime performance & bundle size

Prior work already done (exclude from plans): windowed virtualization
(Plan 122 W1/W3), icon consolidation, React Compiler auto-memoization
(Plan 128), six lazy-loaded views, named-icon imports, BM25 index
cache, editor/chat debounces.

- **D2.1 [P0]** Sync stack (yjs + y-webrtc + simple-peer ≈ −54 KB gz)
  eager-loaded via the CursorTracker import chain:
  `editor-view.tsx:16` → `lib/sync/cursors.ts:1` → `doc.ts:1-3`.
  Defeats `bridge.ts`'s dynamic import.
- **D2.2 [P0]** Persisted `searchQuery` serializes the whole corpus to
  localStorage per keystroke (`store.ts:403-417` with persist writing
  on every setState) — O(corpus) synchronous stringify per character.
- **D2.3 [P1]** jspdf/docx/yaml chunk (~268 KB gz) loads on Export tab
  mount instead of first click (`use-export-handlers.ts:11,230,268`).
- **D2.4 [P1]** framer-motion eager for trivial fades (−42 KB gz):
  `home-view.tsx:16`, `chat-view.tsx:11`, `offline-indicator.tsx:4`.
- **D2.5 [P1]** react-markdown/remark-gfm eager (−30–40 KB gz):
  `chat-view.tsx:8-9`, `editor-view.tsx:10-11`.
- **D2.6 [P1]** Whole-store subscriptions in chrome components:
  `topbar.tsx:23-31`, `sidebar.tsx:77,132`, `shortcuts-dialog.tsx:102-103`.
- **D2.7 [P1]** O(E²) edge dedup + defeated `visibleEdges` memo
  (unused deps force recomputes): `graph-view.tsx:128-139,164-176`.
- **D2.8 [P1]** Pan/zoom through React state re-renders the full SVG
  subtree (`graph-view.tsx:109-110,346-350`).
- **D2.9 [P1]** Un-debounced ranked search + unmemoized mobile path +
  wasted filtered sort: `right-panel.tsx:41-45`,
  `mobile-drawer.tsx:240-249`.
- **D2.10 [P1]** Sync boot hydration blocks first paint; Zod gate
  skips normal boots (`store.ts:125-131,399,421-437`) — couples boot
  time to corpus size (Benchmark 1 target).
- **D2.11–D2.16 [P2]** Mindmap Set churn / focus-driven full-tree
  re-render / always-mounted command palette / undo memory ×50 shells
  / delete churn / double Home sort (see agent report; fold into file
  touches above).
- **D2.17 [P2]** `next.config.ts` — no material gaps; lucide-react
  already framework-optimized. Only hygiene applies
  (`poweredByHeader: false`).
- **D2.18 [P2]** `plans/perf-baselines.md:38-86` documents libraries
  that no longer exist (orama/sigma/mind-elixir) — refresh before any
  optimization work so benchmarks name real subsystems.
- **D2.19 [P2]** Per-node motion wrappers compound mind-map
  reconciliation (`mindmap-view.tsx:225-231,324-336`).
- **D2.20 [P2]** CSS payload 142 KB raw / ~15–25 KB gzip across two
  render-blocking files — defer.

Combined realistic win if D2.1–D2.5 land: initial JS ~450 KB gz →
~280–320 KB gz (−30–35%), plus removal of the largest per-keystroke
and per-interaction CPU stalls (D2.2, D2.6–D2.9).

### D3 — Search/AI/export library internals

- **D3.1 [P0]** Non-ASCII query wipes results: tokenizer/retrieval
  pipeline built ASCII-only despite AGENTS.md i18n guidance — CJK and
  accented text score zero (`retrieval.ts` tokenization + normalization
  path).
- **D3.2 [P1]** Plaintext API key migration gap (legacy localStorage
  keys not fully migrated/cleared on upgrade path).
- **D3.3 [P1]** Index-rebuild cliff: full BM25 rebuild after edits
  with no debounce/incremental strategy (`retrieval.ts` cache misses
  invalidate wholesale).
- **D3.4 [P1]** DOMPurify sanitizers built but never wired into HTML
  export/import round-trips.
- **D3.5 [P1]** AppError taxonomy exists (`src/lib/errors.ts`) but
  provider/network layers don't map failures onto it.
- **D3.6 [P1]** No retry/backoff/timeout discipline on provider
  fetches beyond abort plumbing.
- **D3.7–D3.17 [P2]** Settings (incl. API key) re-encrypted + written
  to IDB per keystroke (`ai-harness-view.tsx:87-101`); session-storage
  AES threat model undocumented (`ai-settings.ts:137-148`); module-
  scope mutable search cache global (`retrieval.ts:137-154`); O(n²)
  entity lookup building AI context (`context.ts:24-27`); HTML export
  field parity + enum interpolation escaping; remaining minor items in
  the D3 agent report.

Strengths: BM25 implementation genuinely correct with tested edge
cases; AbortController compliance exemplary end-to-end; streaming
(SSE + NDJSON) robust; Zod at every boundary; SSRF defense thorough
(`research.ts:8-171`); AES-256-GCM/PBKDF2-600k encryption textbook;
exported HTML ships CSP; zip round-trip clean.

### D4 — Component/view code architecture

- **D4.1 [P0]** Dead feature: "Save snapshot" writes
  `dks-graph-snapshot` that nothing ever reads
  (`graph-view.tsx:280-292`, button `:320`).
- **D4.2 [P0]** Non-functional control: mind map "Compact" toggle
  changes nothing (`mindmap-view.tsx:46,391-400`; rendering ignores
  it).
- **D4.3 [P0]** Four parallel toolbar icon-button implementations;
  the shared `ToolbarBtn` (`ui/shared-primitives.tsx:156-187`) has
  zero production consumers; locals at `graph-view.tsx:48-95`,
  `mindmap-view.tsx:439-462`, `editor-toolbar.tsx:17-37`.
- **D4.4 [P0]** Mobile drawer forks desktop search panel + sidebar
  nav and has already diverged (unmemoized inline results vs memoized
  scored columns): `mobile-drawer.tsx:166-226,231-347` vs
  `right-panel.tsx:34-180`, `sidebar.tsx:76-128`; theme toggle third
  copy (`mobile-drawer.tsx:352-388`).
- **D4.5 [P0]** Whole-store subscriptions in always-mounted chrome
  (same fix as D2.6).
- **D4.6 [P0]** Three views within 1–38 lines of the 500 LOC ceiling:
  graph-view 499, chat-view 491, mindmap-view 462 — decomposition
  paths identified (layout math → `graph-index.ts`; keyboard pan/zoom
  → `useGraphViewport`; PNG rasterization shared; chat subcomponents
  → sibling files; tree renderer → `mindmap-tree.tsx`).
- P1: dead shared primitives (EmptyState/Button/FieldLabel/
  SelectInput unused while eight sites hand-roll equivalents);
  tripled Escape/dismissal systems (`export-view.tsx:60-78` redundant
  over `Overlay`'s native trap; `shortcuts-dialog.tsx:142-167` third
  path); module-scope pub/sub for shortcuts dialog coexisting with
  zustand (`shortcuts-dialog.tsx:79-97`); missing dep hides stale
  closure in mind-map keyboard handler (`mindmap-view.tsx:86-111`);
  confirm-dialog duplication (`right-panel.tsx:291-320` vs
  `reset-confirm-dialog.tsx:27-73`); AI chat stream never aborted on
  unmount (`use-ai-harness-chat.ts:53,84-86`); dead close button +
  inconsistent close semantics in right-panel (`:54-59`, `:216`).
- P2: undo/redo enablement logic duplicated across toolbars; two PNG
  rasterization implementations; Cmd+K owned twice; dual test-naming
  conventions + misnamed `qr-scanner-coverage.test.tsx`; triz subview
  naming breaks `-view` vocabulary; suggestion-chip markup duplicated
  in chat-view; 13-value hook return drilled prop-by-prop into export
  dialogs; settings bag drilled as ~21 props; inert `key` on TableRow
  root; memoization inconsistencies in graph-view; scattered
  breakpoint magic numbers vs existing `readBreakpointPx`; chat send
  debounce wipes concurrent typing (`chat-view.tsx:100-117`).

Highest-leverage single move: make `ui/shared-primitives.tsx` the
real toolkit it pretends to be (ToolbarBtn, EmptyState, ConfirmDialog,
EntitySearchList) and delete the forks — resolves six findings and
buys ~150 LOC of headroom for D4.6 decomposition.

### D5 — Testing depth & quality infrastructure

Lane note: E2E pyramid structure and coverage-threshold targets belong
to Plan 130; items below are unit/integration depth + gate integrity.

- **D5.1 [P0]** Untested data-loss semantic: undo/claims interplay —
  delete-with-claims then undo leaves claims gone; no store-level
  regression test pins transactional deletion (pairs with D1.6;
  `store-coverage.test.ts:255-303` covers only additive mutations).
- **D5.2 [P0]** CI quality gate silently inert: hooks check skipped
  via `SKIP_GLOBAL_HOOKS_CHECK: true` (`ci-and-labels.yml:96-97`);
  local `core.hooksPath` unset with no pre-commit installed —
  AGENTS.md's mandatory `quality_gate.sh` enforced nowhere.
- **D5.3 [P1]** Vitest typecheck wiring inert: enabled against
  `tsconfig.test.json` but include defaults to `*.test-d.*` which
  don't exist — type errors in 149 test files unnoticed.
- **D5.4 [P1]** Coverage counts colocated test files as source
  (`vitest.config.ts:26-32` excludes only `__tests__/**`) — reported
  numbers inflated; thresholds live in a non-required job.
- **D5.5 [P1]** `useAiHarnessChat` extracted for unit-testability yet
  has zero direct tests (cooldown chain, preemptive abort, context
  assembly untested).
- **D5.6 [P1]** Real rate limiter never integrated with chat flow in
  tests (barrel fully mocked; signature change would pass everything).
- **D5.7 [P1]** Speech-recognition unmount lifecycle untested
  (`use-speech-recognition.ts:46-48` cleanup; `stop()`→`onend` gap).
- **D5.8 [P1]** Pre-commit gates opt-in and currently absent;
  `install-hooks.sh` writes into `.git/hooks` (lost on rebuild) — use
  committed `.githooks/` + `core.hooksPath` via `prepare`.
- **D5.9 [P1]** `verify-deps.sh` referenced by AGENTS.md as mandatory
  but wired into no script/workflow — dependabot majors reach main
  without its unique checks.
- P2: `.perf.test` files gate no performance (rename or add real
  budgets like `retrieval.test.ts:186-249`); wall-clock ceilings
  (500 ms/100 ms) in default suite are a CI flake vector; graph
  snapshot write-only test cements the half-feature (pairs D4.1);
  add-child costs two undo steps (`mindmap-view.tsx:61-84` pairs
  D1.6); editor draft-save test uses real 500 ms timer; `-coverage`
  naming institutionalizes branch-chasing (25 files) — convention
  rule needed; hand-copied reset fixtures drift across suites (shared
  helpers needed); no composed persist round-trip test (pairs D1.x
  fixes); citation correctness proven only for additive mutations;
  `Date.now()` fixtures under frozen timers collide; no
  `restoreMocks`/`mockReset` defaults in vitest config; `maxWorkers:
  2` hardcoded.

Calibration (healthy, preserve): zero snapshot abuse; fake-timer
discipline where it matters; genuine behavioral coverage for undo
guards, MAX_HISTORY trim, import rollback triple-fallback, cache
invalidation.

### D6 — Dependencies, tooling & repository infrastructure

- **D6.1 [P0]** README gives wrong instructions: `bun install/run`
  contradicts pnpm mandate; documents nonexistent `db:push`/prisma and
  `src/lib/db.ts`; "nine views" vs actual ten (Sync missing from
  table); claims standalone output that isn't configured.
- **D6.2 [P0]** `.env.example` is Vite-era fiction (`VITE_*` vars,
  references to nonexistent `src/features/ai/`, `src/lib/resolver.ts`;
  zero env reads exist in `src/`).
- **D6.3 [P0]** `tsconfig.node.json` includes seven deleted source
  paths; project unreferenced today, breaks instantly under `tsc -b`.
- **D6.4 [P1]** ~31 of 43 shadcn primitives dead → 20 unused
  `@radix-ui/*` runtime deps; their 27 UI tests inflate coverage
  thresholds.
- **D6.5 [P1]** Six feature deps consumed only by dead wrappers:
  react-day-picker, vaul, react-resizable-panels,
  react-hook-form + @hookform/resolvers, date-fns (transitive only).
- **D6.6 [P1]** `uuid ^14.0.1` fully unused direct dep (contradicts
  crypto.randomUUID mandate; dependabot burned a PR on it).
- **D6.7 [P1]** `sharp` unused and double-pinned (dep + override);
  zero `next/image` usage.
- **D6.8 [P1]** Two toast systems; Radix toast/toaster dead code
  (Sonner is live). Same pattern: `ui/command.tsx` dead vs live cmdk
  palette.
- **D6.9 [P1]** `tailwind.config.ts` never loaded under Tailwind 4
  CSS-first config; `tailwindcss-animate` ghost dep (real layer is
  `tw-animate-css`).
- **D6.10 [P1]** Committed root-level scratch violates placement
  rules: `analysis/` (12 files), `test-sync/test.md`,
  `examples/triz-swarm-migration.md`, 42 KB `worklog.md`.
- **D6.11 [P1]** ESLint disables contradict AGENTS.md:
  `eslint.config.mjs:15` (`no-explicit-any` off), `:23`
  (`exhaustive-deps` off); five eslint devDeps imported by no config.
  → Decision: fix config incrementally (see Decisions).
- **D6.12 [P1]** `biome.json` orphaned (no biome dep/script; lint =
  ESLint only) — maintainer decision pending; do not touch until
  asked.
- P2 currency/config: framer-motion one major behind (12→13);
  TypeScript one major behind (6→7, `ignoreDeprecations` stopgap);
  `engines.node >=20` too loose for Next 16 (needs ≥20.9); `@types/node`
  pinned ahead of runtime (26 vs Node 22 runtimes); Playwright defines
  4 projects, CI runs chromium only (device emulation never runs on
  PRs); e2e webServer boots dev via tee-piped script (masks exit codes,
  litters dev.log) — prefer build+start; tsconfig.app.json carries Vite
  scaffolding emitting root artifacts (`composite`, emit settings,
  `vite/client` types); vitest typecheck inert (D5.3);
  `plans/INDEX.md` freshness gap (now being fixed by this plan);
  1 MB regenerable `bundle-report-before.html` versioned; no CSP/
  security headers for the deployed app itself (export artifacts have
  them; app doesn't); package name still scaffold default;
  `pnpm.overrides` carries 13 security-era pins with no expiry mapping.

Verified-clean (preserve): single zod/react resolutions; peer-dep
risk none; toolchain coherence (.nvmrc ↔ CI ↔ devcontainer ↔ compiler
flags); agents-docs cross-references intact; release notes labeled
RELEASED matching VERSION; all "suspected heavy deps" actually used.

## Sub-Goals (GOAP Phase 2)

Dependency sketch:

```text
G7 (gates honest) ──> every wave measures truthfully
G1 ──> G2 (history model widened before claims-in-history)
G3 ──> G5 (pruning precedes primitive consolidation)
G4 ──> G6 (lazy sync chunk is prerequisite for bridge work)
G8, G9 independent
```

- **G1 — Persistence contract repair** — **P0**, no deps.
  Thread zustand's version argument into `runMigrations`; reject
  future versions with recovery offer (ADR 028 §4); validate every
  hydration via custom `merge`/`onRehydrateStorage` (fixes D1.1,
  D1.3, D1.5); extend envelope schema to cover every `partialize` key
  + CI guard test (D1.4); rebase history on rehydrate
  (`entityHistory: [validated.entities], historyIndex: 0`) killing
  the seed-revert undo (D1.2); drop ephemeral keys (`searchQuery`)
  from partialize or debounce persistence (D1.21/D2.2); composed
  persist round-trip test seeding v0/v1/current/corrupt/future
  envelopes (D5 pair); document unknown-key policy (D1.15).
- **G2 — Undo/transactional integrity** — **P0**, depends on G1.
  Widen history snapshots to `{ entities, claims }` (or operation
  log); route claim mutations through `pushHistory` (D1.6/D5.1);
  batch add-child into one history step (D5 pair); clear dangling
  `editingEntityId`/`selectedEntityId` in undo/redo (D1.22); prune
  graph/mindMap/links/tags in the same deleteEntity transaction or
  derive at export time (D1.17); AbortController on chat send
  (D1.22).
- **G3 — Dead code removal, dependency pruning & docs truth** —
  **P0**, no deps.
  Implement-or-remove decisions: graph snapshot restore-on-mount or
  remove button (D4.1 — recommend remove until designed); wire or
  remove Compact toggle (D4.2). Delete dead primitives + their tests
  (D6.4); prune ~26 deps: 20 Radix packages, uuid, sharp (both
  entries), tailwindcss-animate, react-day-picker, vaul,
  react-resizable-panels, react-hook-form, @hookform/resolvers,
  date-fns, Radix toast (D6.4–D6.9); keep Sonner + cmdk. Rewrite
  README (pnpm commands, real scripts, ten views, no prisma),
  replace `.env.example` with Next.js reality, delete
  `tsconfig.node.json` (D6.1–D6.3). Relocate root scratch dirs into
  `plans/` or delete (D6.10). Audit `pnpm.overrides` pins with
  `pnpm why`, retire obsolete ones, record pin→alert mapping (D6
  P2). Refresh `plans/perf-baselines.md` subsystem names (D2.18).
- **G4 — Bundle & startup performance** — **P1**, no deps.
  Break the sync import chain: CursorTracker lazy boundary so yjs/y-
  webrtc/simple-peer load on demand (D2.1/D1.20); jspdf/docx/yaml
  dynamic import at first export click (D2.3); framer-motion → CSS
  transitions or lazy for fades (D2.4); react-markdown lazy below
  fold (D2.5); migrate topbar/sidebar/shortcuts-dialog to atomic
  selectors (D2.6/D4.5); GraphView O(E²) dedup → adjacency index +
  trim memo deps + memoize visibleNodes (D2.7); pointer-event pan/
  zoom outside React state (D2.8); debounce ranked search + share
  memoized path with mobile drawer (D2.9, lands naturally with G5
  de-forking).
- **G5 — Component architecture consolidation** — **P1**, depends on
  G3 (pruning shrinks surface first).
  Promote ToolbarBtn (richest variant w/ active+help) into
  `shared-primitives.tsx`; adopt EmptyState at all eight hand-rolled
  sites; extract ConfirmDialog on Overlay; extract EntitySearchList
  consumed by right-panel + mobile drawer; extract NavGroupList
  (D4.3/D4.4/D4-P1 set). Delete redundant Escape listeners in
  export-view; unify shortcuts dialog state into the studio store
  (D4-P1). Decompose graph/chat/mindmap views under ceiling using
  identified extraction seams (D4.6). Fix stale-closure dep +
  prefer React Compiler idiom (D4-P1). Add abort-on-unmount to
  `useAiHarnessChat` (D4-P1). Wire/remove dead close buttons (D4-P1).
- **G6 — Sync bridge completion (decision: finish)** — **P1**,
  depends on G1 (hydration contract) and G4 (lazy chunk).
  Call `startBidirectionalSync()` after successful joinRoom with
  unsubscribe cleanup (D1.7); move tombstones to persistent
  room-keyed IDB collection with retention policy (D1.9b); surface
  join-time conflicts like Resync does (D1.9a); carry full claim
  fields through YMap round-trip preserving timestamps/version for
  LWW (D1.8); fix inverted tombstone guard + its test (D1.11);
  re-init persistence on rejoin (D1.9c); env-configured signaling
  list, dedupe constants, drop defunct host (D1.20); storage-event/
  BroadcastChannel coordination with field-level merge using existing
  mergeEntities/mergeClaims (D1.10); pick one merge tie-break policy
  and share it (D1.18); fix cursor/presence registry fan-out +
  destroy cleanup (D1.19). Update ADR 027 status honestly upon
  completion.
- **G7 — Quality-infrastructure honesty** — **P1**, no deps; land
  early so all waves measure truthfully.
  Enforce quality_gate in CI: remove `SKIP_GLOBAL_HOOKS_CHECK`
  bypass and verify hook contents instead (D5.2); commit `.githooks/`
  + `core.hooksPath` via prepare script (D5.8); exclude
  `src/**/*.test.*` + setup from coverage, re-baseline thresholds
  with honest numbers (D5.4); fix vitest typecheck (real
  `*.test-d.ts` samples or drop the flag) (D5.3); wire
  `verify-deps.sh` into a lockfile-triggered CI job (D5.9);
  `restoreMocks: true` + `unstubGlobals` defaults (D5 P2); extract
  `test-helpers.ts` (`resetStore`/`makeEntity`/`makeClaim` from
  structuredClone(SEED_STATE)) replacing drifted fixtures (D5 P2);
  monotonic/UUID fixture IDs (D5 P2); lint-config governance per
  decision: enable `react-hooks/exhaustive-deps` first, then
  `no-explicit-any` incrementally with typed-any last (D6.11).
- **G8 — Library hardening backlog** — **P1**, independent.
  Wire DOMPurify sanitizers into HTML export/import (D3.4); map
  provider failures onto AppError taxonomy + add retry/backoff/
  timeout (D3.5/D3.6); complete plaintext-key migration path
  (D3.2); incremental/debounced index rebuild (D3.3); debounced AI
  settings saves (D3.7); AISettings Zod boundary on IDB reads +
  documented exception ADR (D1.13/D3.8); Map-based AI context lookup
  (D3.10); expose retrieval entity map (D3.11); recovery
  reachability banner + `backupPersisted` flag + live-state-only
  snapshot (D1.12); validate/drop recovery history rows (D1.23);
  internal JSON.parse guard (D1.24); structuredClone seeds on reset
  (D1.25); document session-storage AES threat model (D3.8).
- **G9 — Hygiene sweep** — **P2**, opportunistic, fold into file
  touches.
  Remaining D4 P2s (undo bounds hook, shared svgToPngBlob, Cmd+K
  authority, naming conventions incl. triz panels and `-coverage`
  rule, suggestion chips, prop-drilling shape, breakpoint constants,
  chat debounce capture-clear, inert key); remaining D5 P2s (perf-test
  renames, benchmark ceilings behind `test:bench`, editor draft fake
  timers, citation mutation cases, maxWorkers derivation); remaining
  D6 P2s (framer-motion 13 spike, TS 7 spike, engines floor ≥20.9,
  @types/node ^22, Playwright nightly device projects, prod-mode e2e
  webServer, tsconfig.app de-Vite, INDEX freshness process, remove
  bundle-report-before.html binary, CSP headers for the app,
  package.json identity, poweredByHeader).

## Execution Waves

| Wave | Goals | Rationale |
|------|-------|-----------|
| 1 | G7 core (gates, coverage honesty, lint governance) + G1 | Honest measurement + stop active data loss |
| 2 | G2 + G3 (parallelizable) | Undo integrity; dead-code/dep mass removal |
| 3 | G4 + start G5 | Bundle wins; primitive consolidation |
| 4 | G6 | Sync bridge on sound foundations |
| 5 | G8 + G9 | Backlog burn-down |

## Quality Gates

Per goal: `pnpm run lint && pnpm run typecheck && pnpm run test &&
pnpm run build` green, warnings treated as errors. Data-model/persistence
goals (G1, G2, G6) additionally require `pnpm run test:coverage` and
E2E suite green (`pnpm run test:e2e`). Dependency deletions (G3)
require `./scripts/verify-deps.sh`. Each goal lands as its own PR;
quality_gate.sh before every commit; code-review-assistant pass
before merge.

## Verification Matrix (key regressions pinned by new tests)

| Regression class | Test |
|------------------|------|
| Undo-after-reload seed revert (D1.2) | store test: rehydrate → save → undo ⇒ user data intact |
| Unvalidated hydration (D1.1/D1.5) | corrupt envelope ⇒ seed state + recovery offer |
| Future-version acceptance (D1.3) | v(N+1) envelope ⇒ rejected, not rewritten |
| Claims lost to undo (D1.6) | delete-with-claims → undo ⇒ both restored |
| CJK/accent search wipeout (D3.1) | retrieval tests: Japanese/accented corpora rank > 0 |
| Peer data invisible (D1.7) | bridge integration: remote update ⇒ store reflects it |
| Tombstone resurrection (D1.9b) | leave/join cycle ⇒ deletions stay deleted |

## Out of Scope / Explicitly Excluded

- All prior completed work listed under D2 (Plans 122/128) — do not
  repeat.
- Plan 130's lanes: error boundaries/global handlers, console.*
  logging migration, E2E pyramid structure, coverage threshold
  targets, theme-token/responsive/motion UX debt.
- `biome.json` modification (D6.12) — awaiting explicit maintainer
  instruction.
