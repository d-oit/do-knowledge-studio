# GOAP Master Implementation Plan — 2026-06-22

> **Historical Note**: This plan references the retired Vite/SQLite/Orama/CLI architecture (superseded by ADR 018 — Next.js + Zustand + localStorage, 2026-07). Remaining unchecked items were completed in later plans (090–096). Retained for historical context only.

**Generated**: 2026-06-22
**Source**: All open plans (34, 35, 36, 37, 041) + GitHub issues #226–#240
**Method**: Goal-Oriented Action Planning with swarm execution
**Orchestrator**: `goap-agent` skill
**Execution**: `parallel-execution` + `agent-coordination` swarm

---

## 1. Task Analysis

**Primary Goal**: Execute all open implementation plans in coordinated waves, closing every verified gap from the 2026-05-31 swarm analysis and the 2026-06-18 UI/UX audit.

**Constraints** (from AGENTS.md):
- Local-first only — no required backend
- Strict TypeScript — no `any`, no `as unknown as`
- Max 500 LOC per source file
- No magic numbers; no `VITE_` env for API keys
- Markdown is import/export only — never canonical truth
- Never modify `biome.json` / `eslint.config.js` / lint suppressions
- All planning artifacts go in `plans/`, not repo root
- `pnpm` only

**Complexity**: **Critical** (5 plans, 40+ atomic actions, 4 waves, parallel + sequential)

---

## 2. Open Plans Summary

| Plan | Goal | Priority | Effort | Status |
|------|------|----------|--------|--------|
| 34 | Architecture Hygiene (split 4 files) | P1 | 16-20h | 📝 OPEN |
| 35 | Test Coverage Expansion | P1 | 20-28h | 📝 OPEN |
| 36 | Documentation Overhaul | P1 | 12-16h | 📝 OPEN |
| 37 | Security & Quality Hardening | P1 | 8-12h | 📝 OPEN |
| 041 | UI/UX Modernization & Feature Gaps | P0 | 90-130h | 📝 OPEN |

---

## 3. Goal Hierarchy

```
G-FOUNDATION (P0 — unblocks everything)
   ├── G-TOKENS        semantic token system + plan 041 A1-A2
   ├── G-OVERLAY       shared modal/overlay a11y primitive → plan 041 A4
   ├── G-SECURITY      API key encryption, SSRF, validation → plan 37
   └── G-ARCHITECTURE  split 4 oversized files → plan 34
        │
        ▼
G-MODERNIZE (P0/P1 — depends on tokens + overlay + architecture)
   ├── G-LAYOUT        dynamic viewport, safe-area, breakpoints → plan 041 B1-B3,B9
   ├── G-TOUCH         44px targets, mobile controls → plan 041 B4,B8
   ├── G-VIZ-THEME     graph/mindmap theming + responsive canvas → plan 041 B6-B7
   ├── G-PRIMITIVES    Button/IconButton/Toolbar/EmptyState/Skeleton → plan 041 B10-B11
   ├── G-A11Y          aria-pressed, dialog semantics, list markup → plan 041 B5
   └── G-MOTION        prefers-reduced-motion policy → plan 041 A3
        │
        ▼
G-FEATURES (P1/P2 — independent tracks)
   ├── G-IMPORT        import persistence (browser + CLI) → plan 041 C1-C2
   ├── G-TAGS          tags/categories schema + UI → plan 041 C3-C4
   ├── G-HISTORY       entity version history → plan 041 C5
   ├── G-SEARCH        note indexing + semantic mode + filters → plan 041 C6-C8
   └── G-CHAT          unify chat / wire rate limiter / citations → plan 041 C9-C10
        │
        ▼
G-QUALITY (P1/P2 — validation layer)
   ├── G-TESTING       test coverage expansion → plan 35
   └── G-DOCS          documentation overhaul → plan 36
```

---

## 4. Execution Waves

### Wave 1 — FOUNDATION (P0, parallel — no inter-deps)

| # | Action | Goal | Plan | Agent | Quality Gate |
|---|--------|------|------|-------|--------------|
| A1 | Fix undefined CSS tokens (`--border-color`→`--border-default`, `--surface-primary/secondary`→`--bg-*`) | G-TOKENS | 041 | tokens-agent | grep clean |
| A2 | Add semantic token families (`--status-*-bg`, `--entity-*-bg`, `--graph-*`, `--control-height-*`, `--z-*`, `--focus-ring`) | G-TOKENS | 041 | tokens-agent | All 4 themes define tokens |
| A3 | Add `@media (prefers-reduced-motion: reduce)` policy | G-MOTION | 041 | motion-agent | spin/skeleton/scroll respect reduce |
| A4 | Build `<Overlay>` primitive (focus-trap, Escape, scroll-lock, `role="dialog"`) | G-OVERLAY | 041 | overlay-agent | Unit test focus trap + Escape |
| A5 | Encrypt API keys at rest (AES-GCM via Web Crypto) | G-SECURITY | 37.1 | security-agent | Keys encrypted in localStorage |
| A6 | Fix SSRF in URL resolution (validate URL, block private IPs) | G-SECURITY | 37.2 | security-agent | Private IPs blocked |
| A7 | Fix browser migration fallback (import.meta.glob) | G-SECURITY | 37.3 | security-agent | All migrations bundled |
| A8 | Add Zod validation for graph snapshot loading | G-SECURITY | 37.4 | security-agent | Invalid snapshots show error |
| A9 | Add logging to silent catch blocks | G-SECURITY | 37.5 | security-agent | All catch blocks have logging |
| A10 | Define IRepository interface + split repository.ts | G-ARCHITECTURE | 34.5,34.1 | arch-agent | Each submodule < 200 LOC |
| A11 | Split GraphView.tsx | G-ARCHITECTURE | 34.2 | arch-agent | GraphView < 300 LOC |
| A12 | Split AIHarness.tsx | G-ARCHITECTURE | 34.3 | arch-agent | AIHarness < 200 LOC |
| A13 | Split search.ts | G-ARCHITECTURE | 34.4 | arch-agent | search modules < 200 LOC |

### Wave 2 — RESPONSIVE + MODERNIZE (P0/P1, after Wave 1)

| # | Action | Goal | Plan | Agent | Quality Gate |
|---|--------|------|------|-------|--------------|
| B1 | Fix F1: mobile drawer Search opens search overlay | G-LAYOUT | 041 | layout-agent | Mobile Search nav renders |
| B2 | Remove dead `onEditEntity` prop on Editor (F2) | G-LAYOUT | 041 | layout-agent | typecheck clean |
| B3 | Replace `100vh` with `100dvh`/`svh`; add safe-area insets | G-LAYOUT | 041 | layout-agent | iOS/Android chrome no clip |
| B4 | Enforce ≥44px via `@media (pointer: coarse)` | G-TOUCH | 041 | touch-agent | Targets ≥44px on coarse |
| B5 | Migrate overlays onto `<Overlay>` primitive | G-A11Y | 041 | a11y-agent | Focus trapped; Escape closes |
| B6 | Graph/mindmap canvas → CSS `clamp()` viewport height | G-VIZ-THEME | 041 | viz-agent | No overflow on 667px phone |
| B7 | Graph reads `--graph-*` tokens via getComputedStyle | G-VIZ-THEME | 041 | viz-agent | Theme switch recolors graph |
| B8 | Mobile graph/mindmap control model | G-TOUCH | 041 | touch-agent | All actions reachable on mobile |
| B9 | Library mobile card layout < 640px | G-LAYOUT | 041 | layout-agent | Rows readable at 320px |
| B10 | Extract Button/IconButton/Toolbar/EmptyState/Skeleton primitives | G-PRIMITIVES | 041 | primitives-agent | Inline styles reduced |
| B11 | Replace hardcoded colors with tokens | G-PRIMITIVES | 041 | primitives-agent | No hex in feature components |

### Wave 3 — FEATURES (P1/P2, independent — parallelizable)

| # | Action | Goal | Plan | Agent | Quality Gate |
|---|--------|------|------|-------|--------------|
| C1 | CLI `import` persists transactionally + reindex | G-IMPORT | 041 | import-agent | Round-trip works |
| C2 | Browser import UI (file picker/drag-drop) | G-IMPORT | 041 | import-agent | Import appears in library |
| C3 | Tags schema migration + repository + validation | G-TAGS | 041 | tags-agent | Migration applies; CRUD tested |
| C4 | Tags UI in editor/library/search | G-TAGS | 041 | tags-agent | Filter by tag works |
| C5 | `entity_versions` table + history/diff/restore | G-HISTORY | 041 | history-agent | Edit→history shows prior |
| C6 | Index notes as search docs | G-SEARCH | 041 | search-agent | "Notes" filter returns hits |
| C7 | Semantic toggle controls mode | G-SEARCH | 041 | search-agent | Keyword-only skips semantic |
| C8 | Graph filters + node search UI | G-SEARCH | 041 | search-agent | Filter by type/relation |
| C9 | Wire F5/F6/F7 (create entity, citation nav, palette) | G-CHAT | 041 | chat-agent | CTA + citation + palette work |
| C10 | Unify chat / wire rate limiter | G-CHAT | 041 | chat-agent | Single coherent chat story |

### Wave 4 — QUALITY (P1/P2, after features)

| # | Action | Goal | Plan | Agent | Quality Gate |
|---|--------|------|------|-------|--------------|
| D1 | Mind map unit tests | G-TESTING | 35.1 | test-agent | buildTree edge cases covered |
| D2 | CLI tests | G-TESTING | 35.2 | test-agent | All CLI commands tested |
| D3 | Graph view tests | G-TESTING | 35.3 | test-agent | Graph data transformation tested |
| D4 | Editor extension tests | G-TESTING | 35.4 | test-agent | Extensions register and work |
| D5 | Quick win tests (focusTrap, markdown, DbProvider) | G-TESTING | 35.5 | test-agent | All quick wins covered |
| D6 | E2E test expansion | G-TESTING | 35.6 | test-agent | Critical journeys covered |
| D7 | CLI reference docs | G-DOCS | 36.1 | docs-agent | All commands documented |
| D8 | JSDoc for exported components | G-DOCS | 36.2 | docs-agent | All components documented |
| D9 | Database schema docs | G-DOCS | 36.3 | docs-agent | ER diagram accurate |
| D10 | Search architecture docs | G-DOCS | 36.4 | docs-agent | Pipeline documented |
| D11 | Developer onboarding guide | G-DOCS | 36.5 | docs-agent | New contributors can navigate |
| D12 | LLM setup guide | G-DOCS | 36.6 | docs-agent | All providers documented |
| D13 | Deployment guide | G-DOCS | 36.7 | docs-agent | Deployment steps work |
| D14 | Repository API docs | G-DOCS | 36.8 | docs-agent | All methods documented |
| D15 | Fix VERSION/CHANGELOG sync | G-DOCS | 36.9 | docs-agent | VERSION matches CHANGELOG |
| D16 | Raise coverage thresholds | G-TESTING | 35.7 | test-agent | Thresholds enforced |

---

## 5. Execution Strategy

```diagram
╭──────────────╮   ╭───────────────╮   ╭───────────────╮   ╭───────────────╮
│ Wave 1       │──▶│ Wave 2        │──▶│ Wave 3        │──▶│ Wave 4        │
│ Foundation   │   │ Responsive +  │   │ Features      │   │ Quality       │
│ tokens/sec/  │   │ Modernize     │   │ import/tags/  │   │ tests/docs    │
│ overlay/arch │   │               │   │ history/search│   │               │
╰──────────────╯   ╰───────┬───────╯   ╰───────┬───────╯   ╰───────────────╯
                           │                   │
                           ▼                   ▼
                   ╭───────────────────────────────────╮
                   │ Parallel swarm per wave           │
                   │ 5-8 agents simultaneously        │
                   ╰───────────────────────────────────╯
```

- **Wave 1** is the gate: tokens + security + overlay + architecture unblock everything.
- **Wave 2** is CSS + small component refactors after Wave 1 merges.
- **Wave 3** tracks are independent — assign one sub-agent per track.
- **Wave 4** runs after features land — tests and docs.

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

---

## 7. Definition of Done

- [ ] All Wave 1 foundation work merged (tokens, overlay, security, architecture splits)
- [ ] All Wave 2 responsive/modernize work merged
- [ ] All Wave 3 feature work merged
- [ ] All Wave 4 quality work merged
- [ ] No undefined CSS token references remain
- [ ] Every view usable at 320 / 390 / 768 / 1200px
- [ ] All interactive targets ≥44×44px on coarse pointers
- [ ] All overlays trap focus, close on Escape, lock scroll
- [ ] API keys encrypted at rest
- [ ] SSRF protection in URL resolution
- [ ] All 4 oversized files split under 500 LOC
- [ ] Tags, version history, import persistence implemented
- [ ] Notes indexed; semantic toggle works; graph filters present
- [ ] Chat unified; rate limiter wired; citations navigate
- [ ] Test coverage expanded (mind map, CLI, graph, extensions, E2E)
- [ ] Documentation complete (CLI, JSDoc, DB schema, search, onboarding, LLM, deployment, API)
- [ ] `./scripts/quality_gate.sh` green; E2E green

---

**This is a planning artifact. No source code is modified by this document.**
