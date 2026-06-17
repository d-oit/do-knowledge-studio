# GOAP Plan: Close Remaining Gaps in Plans 35, 36, 37 — 2026-06-16

**Generated**: 2026-06-16
**Source**: 4-agent parallel swarm audit of `plans/34-37` against current codebase
**Method**: Goal-Oriented Action Planning with swarm execution and ADRs
**Orchestrator**: `goap-agent` skill
**Execution**: `parallel-execution` + `agent-coordination` swarm

---

## 1. Task Analysis

**Primary Goal**: Land the three remaining workstreams that audit found **not yet implemented**:

- **G-TESTING-GAP** — Mind map, CLI DB, GraphView, ClaimExtension, MentionExtension, useFocusTrap, DbProvider, 5 E2E journeys, coverage threshold raise
- **G-DOCS-GAP** — JSDoc on major `.tsx` components + `docs/DEPLOYMENT.md`
- **G-LOGGING-GAP** — Replace 12 silent-catch comments with active `logger.debug` calls (Plan 37.5)

**Constraints** (from AGENTS.md):
- Local-first only — no required backend
- Strict TypeScript — no `any`, no `as unknown as`
- Max 500 LOC per source file
- All planning artifacts go in `plans/`, not repo root
- `pnpm` only
- Never modify `biome.json` / `eslint.config.js` / lint suppressions

**Complexity**: **Medium** (3 goals, 3 ADRs, 21+ atomic actions, mostly parallel with one validation phase)

**Audit results summary**:

| Plan | Status | % Complete | Source |
|------|--------|-----------|--------|
| 34 (Architecture) | All items PASS | 100% | Swarm audit |
| **35 (Testing)** | 1/7 PASS, 3 PARTIAL, 3 MISSING | **~30%** | Swarm audit |
| **36 (Docs)** | 6/9 PASS, 2 PARTIAL | **~85%** | Swarm audit |
| **37 (Security)** | 5/6 PASS, 1 PARTIAL | **~95%** | Swarm audit |

This plan addresses the **unfinished items** in 35, 36, 37. Plan 34 is fully landed and is not in scope.

---

## 2. Goal Hierarchy

```
G-LOGGING-GAP (P1, fastest — 2-3h, parallel-safe)
       │
G-DOCS-GAP (P1, 6-8h)
       │
G-TESTING-GAP (P1, 18-24h — biggest)
       │
       ▼
G-VALIDATE (P0, full quality gate)
```

| ID | Goal | Priority | Est. Effort | Source Plan |
|----|------|----------|-------------|-------------|
| G-LOGGING-GAP | Add active `logger.debug` to 12 silent-catch blocks | **P1** | 1-2h | 37.5 |
| G-DOCS-GAP-DEPLOY | Author `docs/DEPLOYMENT.md` | **P1** | 2-3h | 36.7 |
| G-DOCS-GAP-JSDOC | JSDoc on 11+ major `.tsx` exported components | **P1** | 3-4h | 36.2 |
| G-TESTING-GAP-MINDMAP | Mind map unit tests + `mindmap-tree.ts` extraction | **P1** | 4-5h | 35.1 |
| G-TESTING-GAP-CLI | `cli/__tests__/db.test.ts` + expand commands test | **P1** | 3-4h | 35.2 |
| G-TESTING-GAP-GRAPH | `GraphView.test.tsx` + `graph-data.ts` extraction | **P1** | 4-5h | 35.3 |
| G-TESTING-GAP-EXTENSIONS | `ClaimExtension.test.ts` + `MentionExtension.test.ts` | **P1** | 3-4h | 35.4 |
| G-TESTING-GAP-QUICKWINS | `useFocusTrap.test.ts` + `DbProvider.test.tsx` | **P1** | 2-3h | 35.5 |
| G-TESTING-GAP-E2E | 5 new E2E spec files (entity-crud, search-nav, graph, mindmap, export) | **P1** | 5-7h | 35.6 |
| G-TESTING-GAP-THRESHOLDS | Raise `vitest.config.ts` coverage thresholds to 40/50/50/50 | **P1** | 0.5h | 35.7 |

**Total estimated effort**: 25-35 hours (agent time, parallelizable)

---

## 3. Decomposition (Atomic Actions)

### Wave 1 — PARALLEL (no inter-deps, ~1h)

| # | Action | Agent | Quality Gate |
|---|--------|-------|--------------|
| A1 | Write `plans/041-...md` (this file) | orchestrator | File exists, 250+ lines |
| A2 | Author `plans/ADRs/013-silent-catch-logging.md` | plans-writer | Documents logger.debug vs comment policy |
| A3 | Author `plans/ADRs/014-test-architecture.md` | plans-writer | Documents test extraction patterns (mindmap-tree, graph-data) |
| A4 | Author `plans/ADRs/015-jsdoc-policy.md` | plans-writer | Documents JSDoc-first rule for exported components |
| A5 | Author `docs/DEPLOYMENT.md` | docs-writer | File ≥ 200 lines, covers Netlify/Vercel/GH Pages/self-host/OPFS reqs |

### Wave 2 — PARALLEL (test extraction + logging, ~6h)

| # | Action | Agent | Quality Gate |
|---|--------|-------|--------------|
| B1 | Add `logger.debug` to 12 silent-catch blocks (37.5) | refactorer | `grep -c "logger.debug" src/ cli/` increases by ≥ 12; tests pass |
| B2 | Extract `src/lib/mindmap-tree.ts` with `buildTree()` pure function | implementer | Pure function, no React deps, < 200 LOC |
| B3 | Add `src/features/mindmap/__tests__/MindMapView.test.tsx` + tree tests | implementer | ≥ 8 test cases (empty, single, parent-child, depth, relation filter, null, circular) |
| B4 | Extract `src/lib/graph-data.ts` with `buildGraphologyInstance()` | implementer | Pure function, no React deps, < 200 LOC |
| B5 | Add `src/lib/__tests__/graph-data.test.ts` | implementer | ≥ 6 test cases (empty, entities, links, duplicates) |

**Wave 2 gate**: B1 lands a single PR (`chore(quality): add logger.debug to silent catch blocks`); B2-B5 land a single PR (`test(mindmap,graph): extract pure data transforms and add unit tests`).

### Wave 3 — PARALLEL (CLI + extensions + quick wins, ~8h)

| # | Action | Agent | Quality Gate |
|---|--------|-------|--------------|
| C1 | Add `cli/__tests__/db.test.ts` — db init, schema, connection close | implementer | ≥ 6 test cases, uses temp file |
| C2 | Expand `cli/__tests__/commands.test.ts` with end-to-end command tests | implementer | ≥ 10 new test cases (entity-create, list, update, delete; claim-create; link-create; search; db:status; db:backup) |
| C3 | Add `src/features/editor/__tests__/ClaimExtension.test.ts` | implementer | ≥ 6 test cases (registration, input rule, node view, claim creation trigger) |
| C4 | Add `src/features/editor/__tests__/MentionExtension.test.ts` | implementer | ≥ 6 test cases (registration, `@` trigger, filter, select, keyboard nav) |
| C5 | Add `src/hooks/__tests__/useFocusTrap.test.ts` | implementer | ≥ 5 test cases (Tab wrap, Shift+Tab wrap, focus restore, inactive, empty) |
| C6 | Add `src/db/__tests__/DbProvider.test.tsx` | implementer | ≥ 3 test cases (renders children, error state, throws outside provider) |

### Wave 4 — PARALLEL (JSDoc + GraphView test, ~6h)

| # | Action | Agent | Quality Gate |
|---|--------|-------|--------------|
| D1 | Add JSDoc to 11+ exported `.tsx` components in `src/features/`, `src/components/`, `src/app/` | docs-writer | Each file has leading JSDoc with `@param` for all props |
| D2 | Add JSDoc to Zod schemas in `src/lib/validation.ts` | docs-writer | EntitySchema, ClaimSchema, NoteSchema, LinkSchema documented |
| D3 | Add `src/features/graph/__tests__/GraphView.test.tsx` | implementer | ≥ 6 test cases (renders, node click, focus mode, snapshot save, load, diff) |

### Wave 5 — SEQUENTIAL (E2E + threshold, ~6h)

| # | Action | Agent | Quality Gate |
|---|--------|-------|--------------|
| E1 | Author `tests/e2e/entity-crud.spec.ts` | e2e-author | Covers create/edit/delete/search entity |
| E2 | Author `tests/e2e/search-navigation.spec.ts` | e2e-author | Search → click result → editor opens |
| E3 | Author `tests/e2e/graph-interaction.spec.ts` | e2e-author | Click node, toggle focus, save snapshot |
| E4 | Author `tests/e2e/mindmap-interaction.spec.ts` | e2e-author | Click node, add child, rename |
| E5 | Author `tests/e2e/export.spec.ts` | e2e-author | Click export, verify file download, valid content |
| E6 | Raise `vitest.config.ts` thresholds to branches:40, functions:50, lines:50, statements:50 | test-runner | `pnpm run test:coverage` passes new thresholds; do this LAST after all tests added |

### Wave 6 — VALIDATION (gates before merge)

| # | Action | Agent | Quality Gate |
|---|--------|-------|--------------|
| F1 | `pnpm run lint` | test-runner | 0 errors, 0 warnings |
| F2 | `pnpm run typecheck` | test-runner | 0 errors |
| F3 | `pnpm run test` | test-runner | All tests pass (currently 542, expect 700+) |
| F4 | `pnpm run test:coverage` | test-runner | New thresholds met (40/50/50/50) |
| F5 | `pnpm run build` | test-runner | `dist/` produced without errors |
| F6 | `pnpm run test:e2e` | test-runner | All E2E spec files pass |
| F7 | `./scripts/quality_gate.sh` | test-runner | Exits 0 |
| F8 | Update `plans/INDEX.md` with new plan + ADR entries + refreshed health scores | plans-writer | INDEX renders cleanly |

---

## 4. Strategy Selection

| Wave | Strategy | Rationale |
|------|----------|-----------|
| 1 | **Parallel** | All ADRs + deployment doc are independent |
| 2 | **Parallel** | Logging refactor + 2 test extractions (mindmap + graph-data) touch different files |
| 3 | **Parallel** | CLI/extension/quick-win tests touch different test files + their source |
| 4 | **Parallel** | JSDoc + GraphView test touch different files |
| 5 | **Sequential (E1-E5 parallel, E6 last)** | E2E specs independent; threshold raise must come after all tests added |
| 6 | **Sequential** | Quality gates must each pass before next runs |

**Swarm composition** (one message per wave, parallel calls):

- **Wave 1**: 1 `plans-writer` (3 ADRs) + 1 `docs-writer` (DEPLOYMENT.md)
- **Wave 2**: 1 `refactorer` (B1) + 1 `implementer` (B2-B5 mindmap+graph)
- **Wave 3**: 2 `implementer`s (CLI + extensions, quick-wins)
- **Wave 4**: 1 `docs-writer` (D1-D2 JSDoc) + 1 `implementer` (D3 GraphView test)
- **Wave 5**: 2 `e2e-author`s + 1 `test-runner` (E6 last)
- **Wave 6**: 1 `test-runner` with quality-gate skill

---

## 5. Agent Assignment

| Action | Agent | Skill |
|--------|-------|-------|
| Plans/ADRs | `plans-writer` | `goap-agent`, `task-decomposition` |
| Deployment doc | `docs-writer` | `documentation` patterns from `github-readme` |
| JSDoc on components | `docs-writer` | `impeccable` (typography/conventions) |
| Logging refactor | `refactorer` | `code-quality`, `testing-strategy` |
| Test extraction + unit tests | `implementer` | `testing-strategy`, `testdata-builders` |
| CLI tests | `implementer` | `testing-strategy` |
| Editor extension tests | `implementer` | `testing-strategy` (TipTap mocks) |
| E2E specs | `e2e-author` | `agent-browser`, `document-rendering-and-locators` |
| Quality gates | `test-runner` | `test-runner`, `self-fix-loop` |

---

## 6. Execution Plan

### Phase 1 — Wave 1 (PARALLEL, ~30 min)
- Spawn 2 agents in one message:
  1. Plans writer — drafts 3 ADRs (`013`, `014`, `015`) and writes to `plans/ADRs/`
  2. Docs writer — authors `docs/DEPLOYMENT.md`
- **Quality gate**: `ls plans/ADRs/01{3,4,5}-*.md docs/DEPLOYMENT.md` returns 4 files

### Phase 2 — Wave 2 (PARALLEL, ~6h agent time)
- 1 refactorer + 1 implementer in parallel
- Refactorer: B1 (logger.debug)
- Implementer: B2-B5 (mindmap + graph-data extraction + tests)
- **Quality gate**: `pnpm run test` passes for both new test files; B1 PR has 12+ logger.debug additions

### Phase 3 — Wave 3 (PARALLEL, ~8h agent time)
- 2 implementers: CLI tests (C1-C2) + extensions/quick-wins tests (C3-C6)
- **Quality gate**: `pnpm run test cli/__tests__/ src/features/editor/__tests__/ src/hooks/__tests__/ src/db/__tests__/DbProvider` all pass

### Phase 4 — Wave 4 (PARALLEL, ~6h agent time)
- 1 docs writer (D1-D2 JSDoc) + 1 implementer (D3 GraphView test)
- **Quality gate**: JSDoc lint check passes; GraphView test runs

### Phase 5 — Wave 5 (PARALLEL then SEQUENTIAL, ~6h agent time)
- 2 e2e authors in parallel for E1-E5
- E6 (threshold raise) runs after all tests are in
- **Quality gate**: `pnpm run test:e2e` runs all 11+ spec files (6 existing + 5 new) green

### Phase 6 — Wave 6 (VALIDATION, ~1h)
- All quality scripts in sequence
- Fix anything red via `self-fix-loop` skill
- Update `plans/INDEX.md`

---

## 7. Quality Gates (per phase)

| Phase | Gate | Script |
|-------|------|--------|
| 1 | ADRs + DEPLOYMENT.md authored | `ls plans/ADRs/01{3,4,5}-*.md docs/DEPLOYMENT.md` |
| 2 | B1 lands | `grep -c "logger.debug" src/ cli/` increased by ≥ 12 |
| 2 | B2-B5 land | `pnpm run test src/lib/mindmap-tree src/lib/graph-data` |
| 3 | CLI/extension/quick-win tests pass | `pnpm run test` exit 0 |
| 4 | JSDoc + GraphView test | `pnpm run typecheck` clean; GraphView test runs |
| 5 | E2E green | `pnpm run test:e2e` exit 0 |
| 6 | Full quality | `./scripts/quality_gate.sh` exit 0; coverage ≥ new thresholds |

---

## 8. Risk Register

| Risk | Mitigation |
|------|------------|
| `mindmap-tree` extraction may break existing imports | Run `pnpm run typecheck` after extraction; update `MindMapView.tsx` import |
| Coverage threshold raise causes CI failure if any module dips below new threshold | Run `pnpm run test:coverage` BEFORE raising threshold; if any module is below, add tests first or scope threshold to specific files |
| E2E tests are flaky in CI | Use existing patterns from `tests/e2e/library.spec.ts`; avoid timing-dependent assertions |
| TipTap editor mocking for ClaimExtension/MentionExtension is complex | Use `vi.mocked()` per existing `Editor.test.tsx` pattern; mock editor with `createEmptyEditor()` helper |
| logger.debug may flood console | Use level-based filtering in `src/lib/logger.ts`; production build strips debug logs |
| JSDoc on `GraphView` may bloat the file (currently 456 LOC) | Keep JSDoc to < 20 lines per component; rely on `Tsdgen` to enforce concise form |
| E2E `export.spec.ts` requires browser download support | Use Playwright's `page.waitForEvent('download')` API |

---

## 9. Dependencies (action → action)

```
A1 ──┐
A2 ──┤
A3 ──┼──→ (gate: plans + DEPLOYMENT.md done) ──→ B1 ─┐
A4 ──┤                                                  ├──→ (gate: wave 2 done) ──→ C* ──→ D* ──→ E1-E5 ──→ E6 ──→ F*
A5 ──┘                                                  └──→ B2-B5 ─────────────────────────────┘
```

`F*` = all of F1-F8 must pass.

---

## 10. Success Criteria

- [ ] ADRs `013`, `014`, `015` committed in `plans/ADRs/`
- [ ] `docs/DEPLOYMENT.md` exists (≥ 200 lines, covers Netlify/Vercel/GH Pages/self-host)
- [ ] 12 silent-catch blocks now have `logger.debug` (37.5 complete)
- [ ] `src/lib/mindmap-tree.ts` extracted with ≥ 8 unit tests
- [ ] `src/lib/graph-data.ts` extracted with ≥ 6 unit tests
- [ ] `cli/__tests__/db.test.ts` exists with ≥ 6 tests
- [ ] `cli/__tests__/commands.test.ts` has ≥ 10 new end-to-end command tests
- [ ] `src/features/editor/__tests__/ClaimExtension.test.ts` exists with ≥ 6 tests
- [ ] `src/features/editor/__tests__/MentionExtension.test.ts` exists with ≥ 6 tests
- [ ] `src/hooks/__tests__/useFocusTrap.test.ts` exists with ≥ 5 tests
- [ ] `src/db/__tests__/DbProvider.test.tsx` exists with ≥ 3 tests
- [ ] `src/features/graph/__tests__/GraphView.test.tsx` exists with ≥ 6 tests
- [ ] JSDoc on 11+ major `.tsx` components (GraphView, AIHarness, SearchPanel, MindMapView, Editor, SidebarNav, ThemeSwitcher, Header, CommandPalette, ErrorBoundary, SyncToggle, DatabaseSettings, MobileDrawer, LoadingSpinner, JobMetrics, Skeletons)
- [ ] JSDoc on Zod schemas (EntitySchema, ClaimSchema, NoteSchema, LinkSchema)
- [ ] 5 new E2E specs: `entity-crud`, `search-navigation`, `graph-interaction`, `mindmap-interaction`, `export`
- [ ] `vitest.config.ts` thresholds raised to 40/50/50/50 and enforced in CI
- [ ] Total test count: from ~520 → ≥ 700 unit tests; 6 → 11 E2E spec files
- [ ] All quality gates (F1-F8) pass
- [ ] `plans/INDEX.md` reflects new state and refreshed health scores

---

## 11. Post-execution

- Update `plans/INDEX.md` health scores:
  - Architecture: 82 → 82 (no change; 34 is complete)
  - Implementation Completeness: 88 → 88 (no change; 33, 40 are complete)
  - **Test Coverage: 70 → 85** (15-point gain from new test files + threshold raise)
  - **Documentation: 70 → 78** (8-point gain from JSDoc + DEPLOYMENT.md)
  - Security: 95 → 96 (small gain from active logging)
- Mark plans 35, 36, 37 as **MERGED** in INDEX
- This plan (041) becomes the "closeout" for the post-swarm wave

---

## 12. ADR Index (new)

| # | Title | Status | Notes |
|---|-------|--------|-------|
| 013 | Silent Catch Logging Policy | 📝 Proposed | Replace descriptive comments with `logger.debug` calls (Plan 37.5 closure) |
| 014 | Test Architecture: Pure Data Transforms | 📝 Proposed | Extract React-free modules (`mindmap-tree`, `graph-data`) for unit testing (Plan 35) |
| 015 | JSDoc-First Documentation Policy | 📝 Proposed | Require leading JSDoc on all exported `.tsx` components (Plan 36.2 closure) |
