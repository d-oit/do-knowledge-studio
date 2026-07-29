# GOAP Plan: UI Modernization, Full Responsiveness & Feature-Gap Closure — 2026-06-18

> **Historical Note**: This plan references the retired Vite/SQLite/Orama/CLI architecture (superseded by ADR 018 — Next.js + Zustand + localStorage, 2026-07). Remaining unchecked items were completed in later plans (090–096). Retained for historical context only.

**Generated**: 2026-06-18
**Source**: 3-agent parallel codebase analysis (UI modernization, UX/responsiveness, missing implementations) against `origin/main` @ `5172ee8`
**Method**: Goal-Oriented Action Planning with ADRs
**Orchestrator**: `goap-agent` skill
**Execution**: `parallel-execution` + `agent-coordination` swarm
**Companion ADRs**: `plans/ADRs/013-semantic-design-tokens.md`, `014-overlay-accessibility-primitive.md`, `015-responsive-and-visualization-theming.md`, `016-feature-gap-closure.md`

---

## 1. Task Analysis

**Primary Goal**: Modernize the UI, make every view fully responsive (mobile-first), and close verified feature-implementation gaps — captured as a planning-only artifact set (GOAP + ADRs). No code is changed by this plan; it is the execution contract for follow-up implementation waves.

**Constraints** (from `AGENTS.md`):
- Local-first only — no required backend.
- Strict TypeScript — no `any`, no `as unknown as`.
- Max 500 LOC per source file; refactor before extending oversized files.
- No magic numbers; extract named constants / design tokens.
- Use design tokens from `src/styles/`; mobile-first; interactive targets ≥ 44×44px.
- Never modify `biome.json` / `eslint.config.js` / lint suppressions without explicit approval.
- All planning artifacts live in `plans/`, never repo root.
- `pnpm` only.

**Complexity**: **Complex** (3 top-level goals, 4 ADRs, 30+ atomic actions, parallel + sequential waves).

**Repository state observed** (verified by reading source):
- Mature token layer in `src/styles/tokens.css` (4 themes: app, game, neural, technical), but several components reference **undefined tokens**.
- Responsive shell exists (`src/styles/layout.css`, `MobileDrawer`, mobile search overlay) but feature views are desktop-first.
- Import parsers + CLI exist, but no browser import UI and CLI `import` does not persist.
- Tags/categories and entity version history are absent from schema/repository/UI.

---

## 2. Verified Findings (grounded evidence)

### 2.1 Bugs / broken wiring (P0)

| # | Finding | Evidence |
|---|---------|----------|
| F1 | Mobile drawer **Search** routes to a non-rendered view (`setCurrentView('search')` with no matching `main-content` branch). Desktop passes `onSearchClick`, mobile drawer does not. | `src/app/App.tsx:275-280` (no `onSearchClick`), `src/app/App.tsx:177-256` (no `search` branch), `src/components/SidebarNav.tsx:42,60-68` |
| F2 | `Editor` is passed `onEditEntity` but `EditorProps` does not declare it — dead prop / refactor residue. | `src/app/App.tsx:186`, `src/features/editor/Editor.tsx:27-31` |
| F3 | Undefined CSS token `--border-color` (canonical is `--border-default`) → invalid border, disappears. | `src/features/search/SearchPanel.tsx:270,296`; `src/styles/tokens.css:41` |
| F4 | Undefined CSS tokens `--surface-primary` / `--surface-secondary` (canonical `--bg-surface` / `--bg-base`) → transparent backgrounds across themes. | `src/features/ai/ChatView.tsx:29,31`; `src/features/ai/AIHarness.tsx:203` |
| F5 | Search **"Create new entity"** CTA has no handler — decorative. | `src/features/search/SearchPanel.tsx:59-62` |
| F6 | Chat citation cards only `logger.info(...)` on click — do not navigate. | `src/features/chat/Chat.tsx:111-116` |
| F7 | Command-palette knowledge results default to `onViewChange('editor')` without selecting the entity. | `src/components/CommandPalette.tsx:104-115` |

### 2.2 UI modernization (P1)

| # | Finding | Evidence |
|---|---------|----------|
| U1 | Hardcoded graph colors bypass all 4 themes (`#2563eb`, `#ef4444`, `#8b5cf6`, `#94a3b8`, `#7c3aed`). | `src/features/graph/GraphView.tsx:182-188,219-225,256-259` |
| U2 | Themes override only a subset of semantic tokens; `--text-muted`, `--bg-overlay`, `--status-*`, `--interactive-disabled`, focus/border tokens stay light-biased in dark/game/technical. | `src/styles/tokens.css:123-173` |
| U3 | Hardcoded status/claim/type-badge backgrounds won't adapt to themes. | `src/styles/utilities.css:23-32`; `src/styles/features.css:267-278,650-653` |
| U4 | Widespread inline styles in Editor, ChatView, MindMapView, SearchPanel, GraphControls drift off-token. | `src/features/editor/Editor.tsx:315-430`; `src/features/ai/ChatView.tsx:26-34,197-210`; `src/features/mindmap/MindMapView.tsx:323-439` |
| U5 | Toolbar toggle buttons lack `aria-pressed`; repetitive non-composable button defs; disabled via inline opacity. | `src/features/editor/EditorToolbar.tsx:26-145` |
| U6 | No `prefers-reduced-motion` handling for spinner/skeleton/smooth-scroll. | `src/styles/utilities.css:91-108`; `src/features/ai/ChatView.tsx:95-97` |
| U7 | Skeletons exist but encode raw inline dimensions; not composable; boot uses plain text instead of `LoadingSpinner`. | `src/components/Skeletons.tsx:3-19`; `src/app/App.tsx:177-179` |

### 2.3 Responsiveness / accessibility (P0–P1)

| # | Finding | Evidence |
|---|---------|----------|
| R1 | Graph/mind-map canvases force inline 600px height, overriding `.viz-container { height: 60vh }`; overflows phones. | `src/features/graph/GraphView.tsx:412-416`; `src/features/mindmap/MindMapView.tsx:441-442`; `src/styles/features.css:230-236` |
| R2 | Mind-map toolbar is a dense desktop bar; wraps/overflows on phones; keyboard hints shown on touch. | `src/features/mindmap/MindMapView.tsx:323-439`; `src/styles/features.css:245-253` |
| R3 | Mobile graph controls lose snapshot/export/layout/snapshot-mode (drawer mounts `GraphControls` with partial props). | `src/app/App.tsx:284-294` vs `src/features/graph/GraphView.tsx:395-409` |
| R4 | Mobile search overlay has no focus trap / Escape / scroll-lock (unlike `MobileDrawer`). | `src/app/App.tsx:299-308`; `src/components/MobileDrawer.tsx:15-16` |
| R5 | Command palette + SettingsWizard + EntityReviewDialog lack focus-trap / dialog semantics / responsive width. | `src/components/CommandPalette.tsx:126-139`; `src/features/ai/SettingsWizard.tsx:30-41`; `src/features/ai/EntityReviewDialog.tsx:63-81` |
| R6 | Graph inspector fixed 360px side panel covers phone screens — no bottom-sheet breakpoint. | `src/styles/features.css:424-436` |
| R7 | Library uses a 4-col desktop grid with no mobile card layout; virtualizer 64px estimate breaks if rows wrap. | `src/styles/features.css:593-610`; `src/features/library/LibraryView.tsx:63-68` |
| R8 | Touch targets below 44px: `.filter-chip` (32px), `.source-chip-remove` (20px), `.close-button` (36px), `.layout-toggle button` (36px), `.input-clear-button` (auto). | `src/styles/components.css:439-449,543-552`; `src/styles/features.css:209-220,390-393,481-488` |
| R9 | `100vh` shells ignore mobile dynamic viewport / safe-area; viewport meta lacks `viewport-fit=cover`. | `src/styles/layout.css:10-16`; `src/styles/features.css:92-103`; `index.html:5` |
| R10 | Search sidebar hidden below a wide 1200px breakpoint; nav "Search" opens palette on desktop but search overlay on mobile (inconsistent). | `src/styles/layout.css:68-77` |

### 2.4 Missing implementations (P1–P2)

| # | Finding | Evidence |
|---|---------|----------|
| M1 | Browser import UI absent; CLI `import` parses but does **not** persist (logs "Imported …" while writing nothing). | `cli/commands/export.ts:78-92`; `src/features/export/ExportPanel.tsx:151-219` |
| M2 | Graph filtering / node search (#232) only exists as neighborhood focus — no search/type/relation/degree filters. | `src/features/graph/GraphView.tsx:100-112`; `src/features/graph/GraphControls.tsx:119-218` |
| M3 | Tags / categories (#234) absent from schema, repository, validation, UI. | `public/db/migrations/001_initial.sql:3-84`; `src/lib/validation.ts:3-12`; `src/db/repository/types.ts` |
| M4 | Entity version history (#235) absent — updates overwrite in place. | `src/db/repository/entities.ts:180-214` |
| M5 | Static export is single-file HTML, not a multi-page site (#236). | `src/lib/export-core.ts:28-125`; `cli/commands/export.ts:27-32` |
| M6 | Notes not indexed as first-class search docs although UI offers a "Notes" filter. | `src/lib/search/progressive.ts:17-23,61-110`; `src/features/search/SearchPanel.tsx:15-25` |
| M7 | Two divergent chats: main `Chat` view is "Local search only"; provider/tool/streaming chat lives in AI Harness (`useChat`). #227 partial. | `src/features/chat/Chat.tsx:37-70`; `src/features/ai/useChat.ts:143-230` |
| M8 | Semantic toggle does not switch search mode; `progressiveSearch` runs semantic regardless once embeddings ready. | `src/features/search/SearchPanel.tsx:184,270-290`; `src/lib/search/progressive.ts:292-306` |
| M9 | Claims/mentions extracted on create only; entity update does not reconcile claim/link marks. | `src/features/editor/Editor.tsx:145-160,180-225` |
| M10 | Editor lacks image/table/slash-command support; mention picker lists all entities (no inline `@` autocomplete). | `src/features/editor/Editor.tsx:51-57,430-453`; `src/features/editor/EditorToolbar.tsx:25-120` |
| M11 | Graph/mind-map have no undo/redo (#231 partial — editor only). | `src/features/mindmap/MindMapView.tsx:360-434`; `src/features/graph/GraphControls.tsx:119-218` |
| M12 | Rate limiter hook exists but is not wired into the AI send path. | `src/features/ai/useRateLimiter.ts`; `src/features/ai/useChat.ts:170-215` |
| M13 | Mind-map `relatedEntities` prop is vestigial (destructured as `_relatedEntities`, unused). | `src/features/mindmap/MindMapView.tsx:16-78`; `src/app/App.tsx:223-228` |

---

## 3. Goal Hierarchy

```
G-FOUNDATION (P0 — unblocks everything)
   ├── G-TOKENS        semantic token system + theme coverage   → ADR 013
   └── G-OVERLAY       shared modal/overlay a11y primitive       → ADR 014
        │
        ▼
G-RESPONSIVE (P0/P1 — depends on tokens + overlay)
   ├── G-LAYOUT        dynamic viewport, safe-area, breakpoints  → ADR 015
   ├── G-TOUCH         44px targets, mobile controls
   └── G-VIZ-THEME     graph/mindmap theming + responsive canvas → ADR 015
        │
        ▼
G-MODERNIZE (P1 — depends on tokens + overlay)
   ├── G-PRIMITIVES    Button/IconButton/Toolbar/EmptyState/Skeleton
   ├── G-A11Y          aria-pressed, dialog semantics, list markup
   └── G-MOTION        prefers-reduced-motion policy
        │
        ▼
G-FEATURES (P1/P2 — independent tracks)               → ADR 016
   ├── G-IMPORT        import persistence (browser + CLI)
   ├── G-TAGS          tags/categories schema + UI
   ├── G-HISTORY       entity version history
   ├── G-SEARCH        note indexing + semantic mode + filters
   └── G-CHAT          unify chat / wire rate limiter / citations nav
```

| ID | Goal | Priority | Est. | ADR |
|----|------|----------|------|-----|
| G-TOKENS | Define `--border-color`/`--surface-*` fixes + semantic token families; complete per-theme coverage | **P0** | 4-6h | 013 |
| G-OVERLAY | `useOverlay`/`<Overlay>` primitive (focus-trap, Escape, scroll-lock, dialog roles) | **P0** | 4-6h | 014 |
| G-LAYOUT | Dynamic viewport units, safe-area insets, breakpoint review, fix F1 mobile search nav | **P0** | 6-8h | 015 |
| G-TOUCH | Enforce ≥44px targets (coarse-pointer), mobile graph/mindmap control model | **P1** | 6-8h | 015 |
| G-VIZ-THEME | Graph/mindmap read CSS theme tokens; responsive canvas height; mobile inspector bottom-sheet | **P1** | 6-8h | 015 |
| G-PRIMITIVES | Extract Button/IconButton/Toolbar/EmptyState/ErrorState/Skeleton; replace inline styles | **P1** | 10-14h | 013 |
| G-A11Y | `aria-pressed`, dialog semantics, valid listbox markup, library row semantics | **P1** | 4-6h | 014 |
| G-MOTION | `prefers-reduced-motion` policy + gated smooth scroll | **P1** | 2-3h | 013 |
| G-IMPORT | Persisting import (browser UI + CLI writes, transactional, reindex) | **P1** | 10-14h | 016 |
| G-TAGS | Tags/categories: migration, repository, validation, editor/library/search UI | **P1** | 12-16h | 016 |
| G-HISTORY | `entity_versions` table, capture-on-write, history/diff/restore UI | **P2** | 10-14h | 016 |
| G-SEARCH | Index notes; honor semantic mode; graph filters/node search; fix F5 | **P1** | 10-14h | 016 |
| G-CHAT | Unify chat surfaces / wire rate limiter / citation navigation (F6) | **P2** | 8-12h | 016 |

---

## 4. Decomposition (Atomic Actions)

### Wave 0 — PLANNING (this artifact set, parallel)

| # | Action | Agent | Quality Gate |
|---|--------|-------|--------------|
| P0 | Write this GOAP plan | orchestrator | File exists, findings cite file:line |
| P1 | Author `ADRs/013-semantic-design-tokens.md` | plans-writer | Matches ADR format; lists token families |
| P2 | Author `ADRs/014-overlay-accessibility-primitive.md` | plans-writer | Defines primitive API + a11y contract |
| P3 | Author `ADRs/015-responsive-and-visualization-theming.md` | plans-writer | Defines breakpoints, dynamic viewport, viz token bridge |
| P4 | Author `ADRs/016-feature-gap-closure.md` | plans-writer | Sequences import/tags/history/search/chat |
| P5 | Update `plans/INDEX.md` | orchestrator | New plan + ADRs linked |

### Wave 1 — FOUNDATION (P0, parallel — no inter-deps)

| # | Action | Goal | Quality Gate |
|---|--------|------|--------------|
| A1 | Add `--border-color`→`--border-default` and `--surface-primary/secondary`→`--bg-*` (alias OR canonical replacement) | G-TOKENS | No undefined token refs (grep clean) |
| A2 | Add semantic token families: `--status-*-bg/-border`, `--entity-*-bg/-text`, `--graph-*`, `--control-height-*`, `--z-*`, `--focus-ring` | G-TOKENS | All 4 themes define or fall back intentionally |
| A3 | Add `@media (prefers-reduced-motion: reduce)` policy | G-MOTION | spin/skeleton/scroll respect reduce |
| A4 | Build `<Overlay>` primitive (focus-trap, Escape, scroll-lock, `role="dialog"`, `aria-modal`, focus restore) | G-OVERLAY | Unit test focus trap + Escape |

### Wave 2 — RESPONSIVE + MODERNIZE (P0/P1, after Wave 1)

| # | Action | Goal | Quality Gate |
|---|--------|------|--------------|
| B1 | Fix F1: mobile drawer Search opens search overlay (or remove `search` from nav) + align `View` type | G-LAYOUT | Mobile Search nav renders search; typecheck clean |
| B2 | Remove dead `onEditEntity` prop on `Editor` (F2) | G-LAYOUT | typecheck clean |
| B3 | Replace `100vh` shells with `100dvh`/`svh`; add safe-area insets; `viewport-fit=cover` | G-LAYOUT | iOS/Android chrome no longer clips composer |
| B4 | Enforce ≥44px via `@media (pointer: coarse)` for `.filter-chip`/`.close-button`/`.layout-toggle`/`.input-clear-button`/`.source-chip-remove` | G-TOUCH | Targets ≥44px on coarse pointer |
| B5 | Migrate mobile search overlay + CommandPalette + SettingsWizard + EntityReviewDialog onto `<Overlay>` | G-A11Y | Focus trapped; Escape closes; scroll locked |
| B6 | Graph/mindmap canvas → CSS `clamp()` viewport height; remove inline 600px | G-VIZ-THEME | No overflow on 667px-tall phone |
| B7 | Graph reads `--graph-*` tokens via `getComputedStyle`; mobile inspector becomes bottom sheet | G-VIZ-THEME | Theme switch recolors graph |
| B8 | Mobile graph/mindmap control model (bottom sheet / segmented bar) with full action parity (F R3) | G-TOUCH | All graph actions reachable on mobile |
| B9 | Library mobile card layout < 640px; dynamic row measurement | G-LAYOUT | Rows readable at 320px |
| B10 | Extract `ToolbarButton`/`Button`/`IconButton`/`EmptyState`/`ErrorState`/`Skeleton` primitives; add `aria-pressed` to toggles | G-PRIMITIVES | Inline styles reduced; toggles announce state |
| B11 | Replace hardcoded status/claim/type-badge/graph colors with tokens | G-PRIMITIVES | grep: no hex in feature components |

### Wave 3 — FEATURES (P1/P2, independent — parallelizable)

| # | Action | Goal | Quality Gate |
|---|--------|------|--------------|
| C1 | CLI `import` persists JSON+MD transactionally; reindex FTS/Orama (M1) | G-IMPORT | Round-trip: export→import→deep-equal; data in DB |
| C2 | Browser import UI (file picker/drag-drop) → repository writes + reindex (M1) | G-IMPORT | Import note/entity appears in library + search |
| C3 | Tags schema migration + repository methods + validation type (M3) | G-TAGS | Migration applies; CRUD tags tested |
| C4 | Tags UI in editor/library filters/search (M3) | G-TAGS | Filter by tag returns expected entities |
| C5 | `entity_versions` table + capture-on-update/delete + history/diff/restore (M4) | G-HISTORY | Edit→history shows prior; restore works |
| C6 | Index notes as search docs; map results to parent entity (M6) | G-SEARCH | "Notes" filter returns note hits |
| C7 | Semantic toggle controls mode in `progressiveSearch` (M8) | G-SEARCH | Keyword-only mode skips semantic stage |
| C8 | Graph filters + node search UI (#232 / M2) | G-SEARCH | Filter by type/relation; node search highlights |
| C9 | Wire F5 "Create new entity" + F7 palette result open + F6 citation nav | G-CHAT/G-SEARCH | CTA + citation + palette open the entity |
| C10 | Unify chat OR rename main Chat as "Ask"; wire rate limiter into send path (M7/M12) | G-CHAT | Single coherent chat story; rate limit gates send |

### Deferred / documented-only (P2 — capture as issues, not this wave)

- M5 multi-page static export bundle (zip + per-entity pages + static search) — large; track in ADR 016 §Phasing.
- M9 claim/mention reconciliation on entity update — track as follow-up.
- M10 editor image/table/slash-command extensions — track as follow-up.
- M11 graph/mindmap undo/redo (operation history) — depends on reversible-op model.
- M13 remove vestigial `relatedEntities` prop — trivial cleanup, bundle with B2.

---

## 5. Execution Strategy

```diagram
╭──────────────╮   ╭───────────────╮   ╭───────────────╮
│ Wave 0       │──▶│ Wave 1        │──▶│ Wave 2        │
│ Plans + ADRs │   │ Foundation    │   │ Responsive +  │
│ (this set)   │   │ tokens/overlay│   │ Modernize     │
╰──────────────╯   ╰───────┬───────╯   ╰───────┬───────╯
                           │                   │
                           ▼                   ▼
                   ╭───────────────────────────────────╮
                   │ Wave 3 — Features (parallel tracks)│
                   │ import · tags · history · search   │
                   │ · chat                             │
                   ╰───────────────────────────────────╯
```

- **Wave 1 is the gate**: tokens + overlay primitive unblock most Wave 2/3 work and prevent re-introducing inline styles / ad-hoc modals.
- **Wave 2** is mostly CSS + small component refactors; keep each file under 500 LOC (split `GraphView.tsx`, `MindMapView.tsx` if extension pushes them over).
- **Wave 3 tracks are independent** — assign one sub-agent per track (import / tags / history / search / chat) with disjoint write targets.

---

## 6. Quality Gates (per AGENTS.md)

Run for every implementation wave:

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

Run for UI/editor/graph/mindmap/db/search/export changes:

```bash
pnpm run test:e2e
```

Required before commit:

```bash
./scripts/quality_gate.sh
```

**Wave-specific verification**
- Wave 1: `grep -rn "var(--border-color)\|--surface-primary\|--surface-secondary" src/` returns nothing; reduced-motion respected.
- Wave 2: manual device-class check (320 / 390 / 768 / 1200px) — no overflow; all actions reachable; focus trapped in overlays; `tap-target` audit ≥44px on coarse pointer.
- Wave 3: round-trip import test; tag filter test; version restore test; notes appear in search.

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Token rename breaks existing styles silently | Wave 1 adds aliases first; migrate to canonical names incrementally; grep-verify. |
| Sigma/MindElixir don't react to CSS var changes | Read tokens via `getComputedStyle` at render + on theme-change event; re-apply node/edge reducers. |
| Splitting `GraphView`/`MindMapView` risks regressions | Cover with E2E before refactor; keep diffs scoped. |
| CLI import persistence corrupts DB | Transactional writes; dry-run flag; conflict policy documented in ADR 016. |
| Schema migrations (tags, versions) | Use existing migration framework (ADR 004); additive, reversible; test up/down. |
| Files exceed 500 LOC after feature additions | Extract sub-components/modules before extending (AGENTS.md hard rule). |

---

## 8. Definition of Done

- [ ] All Wave 0 planning artifacts merged (this plan + ADRs 013–016 + INDEX update).
- [ ] No undefined CSS token references remain.
- [ ] Every view reachable and usable at 320 / 390 / 768 / 1200px with no overflow.
- [ ] All interactive targets ≥44×44px on coarse pointers.
- [ ] All overlays trap focus, close on Escape, lock scroll, expose `role="dialog"`.
- [ ] `prefers-reduced-motion` respected app-wide.
- [ ] Import persists in both browser and CLI with round-trip parity.
- [ ] Tags and version history implemented with migrations + tests.
- [ ] Notes indexed; semantic toggle controls mode; graph filters/search present.
- [ ] Coherent single chat story; rate limiter wired; citations navigate.
- [ ] `./scripts/quality_gate.sh` green; relevant E2E green.

---

## 9. Files Affected (forecast, by wave — implementation only)

**Wave 1**: `src/styles/tokens.css`, `src/styles/utilities.css`, `src/styles/components.css`, `src/styles/features.css`, NEW `src/components/Overlay.tsx` + `src/hooks/useScrollLock.ts`.
**Wave 2**: `src/app/App.tsx`, `index.html`, `src/styles/layout.css`, `src/features/graph/GraphView.tsx`, `src/features/mindmap/MindMapView.tsx`, `src/features/library/LibraryView.tsx`, `src/components/CommandPalette.tsx`, `src/features/ai/SettingsWizard.tsx`, `src/features/ai/EntityReviewDialog.tsx`, `src/features/editor/EditorToolbar.tsx`, NEW `src/components/ui/*` primitives.
**Wave 3**: `cli/commands/export.ts`, `src/features/export/ExportPanel.tsx`, `public/db/migrations/*.sql`, `src/db/repository/*`, `src/lib/validation.ts`, `src/lib/search/progressive.ts`, `src/lib/search/fts5-hydrator.ts`, `src/features/search/SearchPanel.tsx`, `src/features/graph/GraphControls.tsx`, `src/features/chat/Chat.tsx`, `src/features/ai/useChat.ts`.

---

**This is a planning artifact. No source code is modified by this document.**
