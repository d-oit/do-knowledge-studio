# Plan 083 — GOAP: Coverage to 55%, Plan Status Fixes, ADR 011 Cleanup

**Date**: 2026-07-26
**Status**: DONE (verified 2026-07-26)
**Method**: GOAP with hybrid execution
**Orchestrator**: `goap-agent` skill with `parallel-execution`
**Branch**: `feat/083-coverage-plan-cleanup`
**PR**: TBD

## Context

Post-Plan 082 analysis found:
- Coverage at 52.5% lines, target is 55% (GOAL.md)
- Plan 082 file still says "IN PROGRESS" but PR #517 is merged
- Plans 078/079 have stale OPEN goal statuses
- ADR 011 (CLI Command Extraction) is orphaned — CLI no longer exists post-Next.js migration
- 13+ view sub-components have 0% test coverage
- vitest thresholds are low (lines: 45%, branches: 37%)

## Goals

| ID | Goal | Priority | Effort |
|----|------|----------|--------|
| G1 | Fix stale plan statuses (082, 078, 079) | P2 | 10min |
| G2 | Mark ADR 011 as Superseded | P2 | 5min |
| G3 | Add tests for 0%-coverage components to reach 55% lines | P0 | 3h |
| G4 | Raise vitest coverage thresholds | P1 | 10min |
| G5 | Create PR, verify CI, address feedback | P0 | 1h |

## Wave Structure

### Wave 1 — Documentation Fixes (parallel, 2 agents)

| ID | Action | Goal | Files |
|----|--------|------|-------|
| W1.1 | Fix Plan 082 status to DONE, Plans 078/079 goal statuses | G1 | plans/082-*.md, plans/078-*.md, plans/079-*.md |
| W1.2 | Mark ADR 011 as Superseded by ADR 018 | G2 | plans/ADRs/011-cli-command-extraction.md |

### Wave 2 — Test Coverage Swarm (parallel, 3 agents)

| ID | Action | Goal | Target Files |
|----|--------|------|-------------|
| W2.1 | Add tests for export/import sub-components | G3 | use-export-handlers.ts, import-preview-dialog.tsx, encrypt-export-dialog.tsx, export-format-grid.tsx |
| W2.2 | Add tests for editor sub-components | G3 | type-selector.tsx, editor-toolbar.tsx, editor-claims-panel.tsx |
| W2.3 | Add tests for sync hooks | G3 | use-cursors.ts, use-presence.ts |

### Wave 3 — Thresholds + Quality Gate

| ID | Action | Goal |
|----|--------|------|
| W3.1 | Raise vitest coverage thresholds | G4 |
| W3.2 | Run lint, typecheck, test, build | ALL |
| W3.3 | Update INDEX.md with Plan 083 | G5 |
| W3.4 | Create branch, commit, push, create PR | G5 |
| W3.5 | Monitor CI — all checks must pass | G5 |

## Key Files

| File | Action |
|------|--------|
| plans/082-goap-missing-implementations-2026-07-26.md | Edit: status → DONE |
| plans/078-goap-gap-remediation-2026-07-25.md | Edit: goal statuses → Done |
| plans/079-view-tests-and-pr.md | Edit: goal statuses → Done |
| plans/ADRs/011-cli-command-extraction.md | Edit: status → Superseded |
| src/components/studio/views/use-export-handlers.ts | Create test |
| src/components/studio/views/import-preview-dialog.tsx | Create test |
| src/components/studio/views/encrypt-export-dialog.tsx | Create test |
| src/components/studio/views/export-format-grid.tsx | Create test |
| src/components/studio/views/type-selector.tsx | Create test |
| src/components/studio/views/editor-toolbar.tsx | Create test |
| src/components/studio/views/editor-claims-panel.tsx | Create test |
| src/lib/sync/use-cursors.ts | Create test |
| src/lib/sync/use-presence.ts | Create test |
| vitest.config.ts | Edit: raise thresholds |
| plans/INDEX.md | Edit: add Plan 083 |

## Success Criteria

- [ ] All stale plan statuses corrected
- [ ] ADR 011 marked Superseded
- [ ] Test coverage >= 55% lines
- [ ] All existing tests pass
- [ ] Lint, typecheck, build pass
- [ ] Coverage thresholds raised
- [ ] PR created with all CI checks passing
- [ ] All PR feedback addressed

---

**This is a planning artifact. No source code is modified by this document.**
