# Plan 078 — GOAP Gap Remediation: LOC, Architecture, Coverage, E2E CI

**Date**: 2026-07-25
**Status**: DONE (verified 2026-07-25)
**Method**: GOAP with swarm parallel execution
**Orchestrator**: `goap-agent` skill with `parallel-execution` + `agent-coordination`
**Branch**: `feat/078-gap-remediation`
**PR**: TBD (see Plan 079)

## Context

A comprehensive gap analysis identified 8 issues across 4 priority levels. This plan
addresses P0 (AGENTS.md violation), P1 (stale docs, coverage thresholds, missing E2E CI),
and P2 (test gaps for views, schema, sync modules). P3 items (stale branches, 50% coverage
target) are deferred.

Current state: 550 tests (492 unit + 58 E2E), 22/22 CI checks passing, 0 lint warnings,
0 type errors, 31.63% line coverage.

## Goals

| ID | Goal | Priority | Gap # | Status |
|----|------|----------|-------|--------|
| G1 | export-view.tsx under 500 LOC | **P0** | #1 | Done |
| G2 | ARCHITECTURE.md reflects actual Zustand + localStorage architecture | **P1** | #2 | Done |
| G3 | Coverage thresholds match actual values | **P1** | #3 | Done |
| G4 | E2E tests run in CI | **P1** | #4 | Done |
| G5 | View component unit tests (export, ai-harness, sync, editor, mindmap, graph) | **P2** | #5 | Done |
| G6 | schema.ts has comprehensive Zod validation tests | **P2** | #6 | Done |
| G7 | Sync module tests (discovery, presence, cursors) | **P2** | #7 | Done |

## Goal Dependency Graph

```
G1 (export-view split) ──→ G5 (view tests depend on new structure)
G2 (ARCHITECTURE.md)  ──── standalone, no deps
G3 (coverage thresholds) ─→ depends on G5/G6/G7 adding tests (thresholds must be set AFTER new tests land)
G4 (E2E CI) ────────────── standalone, no deps
G6 (schema tests) ──────── standalone, no deps
G7 (sync tests) ────────── standalone, no deps
```

## Wave Structure

### Wave 0 — Baseline Scan (read-only, sequential)

**Goal**: Confirm current state, identify exact file boundaries for splitting.

| ID | Action | Agent | Output |
|----|--------|-------|--------|
| W0.1 | Read export-view.tsx, map section boundaries and extractable components | explore-agent | Component boundary report |
| W0.2 | Read schema.ts, catalog all Zod schemas and validation functions | explore-agent | Schema inventory |
| W0.3 | Read discovery.ts, presence.ts, cursors.ts — identify testable units | explore-agent | Sync module test surface |
| W0.4 | Confirm E2E CI gap: verify no playwright job in ci-and-labels.yml | explore-agent | CI gap confirmation |
| W0.5 | Run `pnpm test:coverage` to get baseline numbers | test-runner | Exact coverage metrics |

**Gate 0**: All scans complete. Baseline numbers recorded. Component boundaries mapped.

---

### Wave 1 — P0 + P1 Critical Fixes (parallel swarm, 4 agents)

**Goal**: Fix the AGENTS.md violation (P0) and all P1 gaps.

| ID | Action | Goal | Agent | Files Changed | Effort |
|----|--------|------|-------|---------------|--------|
| W1.1 | Split export-view.tsx into subcomponents | G1 | component-refactor-agent | `export-view.tsx`, `export-format-grid.tsx`, `import-dropzone.tsx`, `backup-tips.tsx`, `encrypt-export-dialog.tsx`, `reset-confirm-dialog.tsx`, `import-preview-dialog.tsx`, `use-export-handlers.ts` | 2h |
| W1.2 | Rewrite ARCHITECTURE.md to reflect Zustand + localStorage | G2 | docs-agent | `plans/ARCHITECTURE.md` | 30m |
| W1.3 | Add E2E CI job to ci-and-labels.yml | G4 | ci-agent | `.github/workflows/ci-and-labels.yml` | 45m |

**Parallelization**: W1.1, W1.2, W1.3 are fully independent — run in parallel.

**W1.1 Detail — export-view.tsx Split**

Current 594 LOC file has 6 extractable sections:

| New File | Source Lines | LOC Est. | Contents |
|----------|-------------|----------|----------|
| `export-format-grid.tsx` | ~227-306 | ~80 | Format card grid (JSON, MD, HTML, PDF, DOCX, Encrypted) |
| `import-dropzone.tsx` | ~308-347 | ~40 | File upload dropzone with hidden input |
| `backup-tips.tsx` | ~349-374 | ~30 | Static informational callout |
| `encrypt-export-dialog.tsx` | ~390-477 | ~90 | Encrypted export password modal |
| `reset-confirm-dialog.tsx` | ~480-526 | ~50 | Reset to demo data confirmation |
| `import-preview-dialog.tsx` | ~529-591 | ~65 | Import preview/review dialog |
| `use-export-handlers.ts` | ~76-210 | ~135 | Custom hook: handleExport, handleImportClick, handleFileChange, handleConfirmImport, handleReset |
| `export-view.tsx` (refactored) | — | ~110 | Orchestrator component importing subcomponents + hook |

Target: Each file under 200 LOC. Parent `export-view.tsx` under 200 LOC. All under 500 LOC limit.

**W1.2 Detail — ARCHITECTURE.md Rewrite**

Replace the 17-line skeleton (which incorrectly references SQLite WASM/OPFS) with a
comprehensive architecture document reflecting ADR 028 and actual implementation:

- Storage: Zustand + localStorage with Zod-validated persistence envelope
- Model: Entities, Claims, Links, Notes (with schema versioning)
- State Management: Zustand store with computed selectors
- AI Harness: Client-side provider adapters (no backend)
- Sync: WebRTC/Yjs-based P2P collaboration
- Search: Client-side retrieval engine (Orama + optional semantic)
- Export: Multi-format (JSON, MD, HTML, encrypted) with import/replace workflow
- Testing: Vitest (unit) + Playwright (E2E), coverage via v8
- Interface: Editor, Graph, Mind Map, Chat, TRIZ, AI Harness

**W1.3 Detail — E2E CI Job**

Add a new `e2e-tests` job to `.github/workflows/ci-and-labels.yml`:

```yaml
e2e-tests:
  name: E2E Tests
  runs-on: ubuntu-latest
  timeout-minutes: 20
  needs: [changes, unit-tests]
  if: needs.changes.outputs.frontend == 'true'
  steps:
    - uses: actions/checkout@<pinned>
    - uses: pnpm/action-setup@<pinned>
    - uses: actions/setup-node@<pinned>
      with:
        node-version: '22'
        cache: 'pnpm'
    - run: pnpm install --frozen-lockfile
    - run: npx playwright install --with-deps chromium
    - run: pnpm run test:e2e --project=chromium
```

Key decisions:
- Only run on frontend changes (path filter: `frontend == 'true'`)
- Single browser (chromium) for CI speed; mobile/tablet in nightly if needed
- Timeout 20min (Playwright + dev server startup)
- Depends on `unit-tests` passing first (fail-fast)

**Gate 1**:
- [ ] `export-view.tsx` under 500 LOC (verify: `wc -l src/components/studio/views/export-view.tsx`)
- [ ] All new subcomponent files under 200 LOC
- [ ] `pnpm run lint` — 0 warnings
- [ ] `pnpm run typecheck` — 0 errors
- [ ] `pnpm run test` — all existing tests pass
- [ ] `pnpm run build` — success
- [ ] ARCHITECTURE.md no longer references SQLite WASM/OPFS
- [ ] E2E CI job definition is syntactically valid YAML

---

### Wave 2 — Test Suite Expansion (parallel swarm, 3 agents)

**Goal**: Add unit tests for schema.ts, sync modules, and view components (P2 gaps #5, #6, #7).

| ID | Action | Goal | Agent | Files Changed | Effort |
|----|--------|------|-------|---------------|--------|
| W2.1 | Write schema.ts tests | G6 | test-writer-agent | `src/lib/studio/schema.test.ts` (new) | 1h |
| W2.2 | Write sync module tests (discovery, presence, cursors) | G7 | test-writer-agent | `src/lib/sync/discovery.test.ts`, `src/lib/sync/presence.test.ts`, `src/lib/sync/cursors.test.ts` (all new) | 1.5h |
| W2.3 | Write view component tests (export-view, editor-view, graph-view, mindmap-view) | G5 | test-writer-agent | `export-view.test.tsx`, `editor-view.test.tsx`, `graph-view.test.tsx`, `mindmap-view.test.tsx` (all new) | 2h |

**Parallelization**: W2.1, W2.2, W2.3 are fully independent — run in parallel.

**W2.1 Detail — schema.test.ts**

Test cases for `src/lib/studio/schema.ts`:
- `validatePersistedState`: valid envelope passes, missing version fails, unknown version fails, corrupt records fail
- `validateImportPayload`: valid payload passes, missing entities/claims fails, invalid entity type fails, invalid confidence range fails, duplicate IDs fail, dangling claim references fail
- `EntitySchema`: valid entity parses, missing required fields fail, invalid enum values fail
- `ClaimSchema`: valid claim parses, confidence out of range fails, invalid verification status fails
- Round-trip: export → import preserves all validated data

Target: ~150-200 LOC test file covering all Zod schemas and both validation functions.

**W2.2 Detail — Sync Module Tests**

| File | Test Focus | Key Cases |
|------|-----------|-----------|
| `discovery.test.ts` | Peer discovery lifecycle | Start/stop discovery, handle peer found/lost, timeout stale peers |
| `presence.test.ts` | Presence tracking | Set/update/clear presence, handle remote presence changes, heartbeat |
| `cursors.test.ts` | Cursor position sync | Broadcast cursor, receive remote cursor, remove stale cursors, throttle updates |

Each test file ~100-150 LOC. Use mocked WebRTC/Yjs dependencies.

**W2.3 Detail — View Component Tests**

| Component | Test Focus | Key Cases |
|-----------|-----------|-----------|
| `export-view.test.tsx` | Export/import UI flow (uses refactored subcomponents) | Renders format grid, triggers export, shows import preview, password validation, reset confirmation |
| `editor-view.test.tsx` | Entity editing | Renders entity fields, saves changes, handles claim editing, type selection |
| `graph-view.test.tsx` | Graph rendering | Renders graph container, handles node selection, responds to entity changes |
| `mindmap-view.test.tsx` | Mind map interaction | Renders mind map, handles node expand/collapse, responds to data changes |

Each test file ~100-200 LOC. Use `@testing-library/react` with mocked store.

**Gate 2**:
- [ ] `pnpm run test` — all tests pass (existing + new)
- [ ] `pnpm run typecheck` — 0 errors
- [ ] New test files have no `any` types
- [ ] Coverage increase measurable (expect +3-5% lines)

---

### Wave 3 — Coverage Thresholds + Final Validation (sequential)

**Goal**: Update coverage thresholds to match actual + new test coverage. Full quality gate.

| ID | Action | Goal | Agent | Files Changed |
|----|--------|------|-------|---------------|
| W3.1 | Run `pnpm test:coverage` to get new numbers | G3 | test-runner | — |
| W3.2 | Update vitest.config.ts thresholds to match actual (with 1% margin) | G3 | config-agent | `vitest.config.ts` |
| W3.3 | Full quality gate: lint, typecheck, test, build | ALL | test-runner | — |
| W3.4 | Invoke code-review-assistant skill on all changed files | ALL | review-agent | — |

**W3.2 Detail — Threshold Updates**

Set thresholds to actual coverage minus 1% margin (prevents flaky regressions while
reflecting real state):

| Metric | Current Threshold | Expected Actual | New Threshold |
|--------|-------------------|-----------------|---------------|
| Lines | 28% | ~35-37% | actual - 1% |
| Branches | 19% | ~24-26% | actual - 1% |
| Functions | 20% | ~25-27% | actual - 1% |
| Statements | 28% | ~34-36% | actual - 1% |

Exact values determined by W3.1 measurement.

**Gate 3**:
- [ ] `pnpm run lint` — 0 warnings, 0 errors
- [ ] `pnpm run typecheck` — 0 errors
- [ ] `pnpm run test` — all tests pass
- [ ] `pnpm run test:coverage` — all thresholds pass
- [ ] `pnpm run build` — success
- [ ] `./scripts/quality_gate.sh` — passes
- [ ] Code review completed, all P1/P2 findings addressed
- [ ] No file exceeds 500 LOC

---

### Wave 4 — PR Creation + CI Verification

**Goal**: Push branch, create PR, verify CI passes.

| ID | Action | Agent |
|----|--------|-------|
| W4.1 | Create branch `feat/078-gap-remediation`, commit all changes | git-agent |
| W4.2 | Push and create PR with structured body | git-agent |
| W4.3 | Monitor CI checks — all must pass | ci-agent |
| W4.4 | Address any PR review comments | review-agent |
| W4.5 | Update plans/INDEX.md with Plan 078 entry | docs-agent |

**PR Body Template**:

```markdown
## Summary
- **P0**: Split export-view.tsx (594→~110 LOC) into 7 submodules, all under 200 LOC
- **P1**: Rewrote ARCHITECTURE.md to reflect Zustand + localStorage (was stale SQLite WASM)
- **P1**: Aligned coverage thresholds with actual test coverage
- **P1**: Added E2E tests to CI pipeline (Playwright on chromium)
- **P2**: Added unit tests for schema.ts, sync modules, and 4 view components

## Changes
- Split `export-view.tsx` into 7 files: format grid, import dropzone, backup tips,
  encrypt dialog, reset dialog, import preview dialog, custom hook
- Rewrote `plans/ARCHITECTURE.md` (17→~120 lines) reflecting ADR 028 architecture
- Updated `vitest.config.ts` coverage thresholds to match actual values
- Added `e2e-tests` job to `.github/workflows/ci-and-labels.yml`
- Added test files: `schema.test.ts`, `discovery.test.ts`, `presence.test.ts`,
  `cursors.test.ts`, `export-view.test.tsx`, `editor-view.test.tsx`,
  `graph-view.test.tsx`, `mindmap-view.test.tsx`

## Testing
- All 550+ existing tests pass
- ~8 new test files added (~1000+ new test LOC)
- Coverage thresholds updated to reflect actual + new tests
- E2E CI job verified locally with `pnpm run test:e2e --project=chromium`

## Checklist
- [ ] `pnpm run lint` passes
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run test` passes
- [ ] `pnpm run build` passes
- [ ] `pnpm run test:coverage` passes (new thresholds)
- [ ] No file exceeds 500 LOC
- [ ] Code review completed
```

---

## Agent Swarm Summary

| Wave | Agents | Max Parallel | Estimated Effort |
|------|--------|-------------|-----------------|
| W0 | 5 explore + 1 test-runner | 5 | 15 min |
| W1 | 3 (refactor + docs + CI) | 3 | 2h |
| W2 | 3 (schema + sync + views) | 3 | 2h |
| W3 | 2 (test-runner + config) | 1 (sequential) | 30 min |
| W4 | 2 (git + CI monitor) | 1 (sequential) | 30 min |
| **Total** | | | **~5.5h** |

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| export-view split breaks import/export functionality | Medium | High | Run E2E tests after split; manual smoke test of each format |
| New subcomponent files introduce circular imports | Low | Medium | Verify import graph after split; `pnpm run build` catches this |
| E2E CI job too slow (>20min) | Medium | Medium | Run only chromium; skip mobile/tablet in CI; use Playwright shard if needed |
| Coverage thresholds set too high after new tests | Low | Low | Use actual - 1% margin; verify with `pnpm test:coverage` before committing |
| New view tests require complex mocking | Medium | Medium | Use minimal mocks; focus on render + interaction, not internal state |
| Sync module tests need WebRTC/Yjs mocks | Medium | Medium | Use vi.mock() for Yjs; test pure logic, not WebRTC transport |
| PR review requests changes to split structure | Low | Medium | Follow existing component patterns; align with AGENTS.md conventions |

## Deferred to Plan 079+

| Item | Reason |
|------|--------|
| P3: 80+ stale local branches | Git hygiene, low impact, separate cleanup PR |
| P3: 50% coverage target | Progressive goal, needs sustained effort across multiple plans |
| E2E tests for mobile/tablet in CI | Speed concern; chromium-only for now |
| View tests for remaining views (library, chat, ai-harness, triz) | Lower priority; can be added incrementally |
| ai-harness-view.tsx (511 LOC) split | Also exceeds 500 LOC but lower priority than export-view |

## Success Criteria

- [ ] `export-view.tsx` is under 500 LOC (P0 resolved)
- [ ] No other file exceeds 500 LOC after changes
- [ ] ARCHITECTURE.md accurately describes Zustand + localStorage architecture
- [ ] ARCHITECTURE.md no longer references SQLite WASM/OPFS as current
- [ ] Coverage thresholds in vitest.config.ts match actual test coverage
- [ ] E2E CI job exists and runs Playwright tests on frontend changes
- [ ] schema.ts has a dedicated test file with comprehensive Zod validation tests
- [ ] discovery.ts, presence.ts, cursors.ts each have dedicated test files
- [ ] export-view, editor-view, graph-view, mindmap-view each have test files
- [ ] `pnpm run lint` — 0 warnings
- [ ] `pnpm run typecheck` — 0 errors
- [ ] `pnpm run test` — all tests pass
- [ ] `pnpm run test:coverage` — thresholds pass
- [ ] `pnpm run build` — success
- [ ] All CI checks pass on the PR
- [ ] Code review completed with all findings addressed
- [ ] PR merged to main

---

**This is a planning artifact. No source code is modified by this document.**
