# Plan 082 — GOAP: Address Missing Implementations from plans/ Analysis

**Date**: 2026-07-26
**Status**: DONE (verified 2026-07-26, PR #517 merged)
**Method**: GOAP with hybrid execution
**Orchestrator**: `goap-agent` skill with `parallel-execution`
**Branch**: `feat/082-missing-implementations`
**PR**: TBD

## Context

Analysis of plans/ folder identified 14 missing or incomplete implementations across 3 priority levels. This plan addresses the highest-impact items that can be delivered in a single PR:

1. **ADR 001 status correction** — Quick documentation fix (P2)
2. **ADR 028 remaining items** — Versioned hydration migrations (P0)
3. **Coverage improvement** — From ~47% to 55% lines (P1)
4. **Bundle size analysis** — Complete the TBD item from startup-audit.md (P2)

Items NOT addressed in this plan (deferred to future plans):
- ADR 003: API Key IndexedDB Migration (requires significant architecture change)
- ADR 011: CLI Command Extraction (low impact, can wait)
- ADR 012: PDF Export (requires @react-pdf/renderer evaluation)
- ADR 025: Web Research in Product Harness (requires Jina Reader integration)
- ADR 027: Bidirectional P2P Sync Bridge (complex, needs dedicated plan)
- ADR 029: Manifest-Driven Agent Harness (low priority)
- Full Accessibility Audit (requires dedicated plan)
- Stale Branch Cleanup (git hygiene, separate PR)
- E2E Mobile/Tablet in CI (speed concerns)

## Goals

| ID | Goal | Priority | Effort |
|----|------|----------|--------|
| G1 | Fix ADR 001 status from "Accepted" to "Superseded" | P2 | 5min |
| G2 | Implement versioned hydration migrations for ADR 028 | P0 | 2h |
| G3 | Improve test coverage from ~47% to 55% lines | P1 | 3h |
| G4 | Complete bundle size analysis in startup-audit.md | P2 | 30min |
| G5 | Update INDEX.md with Plan 082 | P2 | 10min |
| G6 | Create PR, verify CI, address feedback | P0 | 1h |

## Wave Structure

### Wave 1 — Documentation Fixes (parallel, 2 agents)

| ID | Action | Goal | Agent | Files |
|----|--------|------|-------|-------|
| W1.1 | Fix ADR 001 status to "Superseded by ADR 018" | G1 | docs-agent | plans/ADRs/001-sqlite-wasm.md |
| W1.2 | Complete bundle size analysis | G4 | analysis-agent | plans/startup-audit.md |

### Wave 2 — ADR 028 Versioned Hydration (sequential)

| ID | Action | Goal | Agent | Files |
|----|--------|------|-------|-------|
| W2.1 | Design versioned hydration migration system | G2 | architect-agent | plans/ADRs/028 (design) |
| W2.2 | Implement hydration version check in schema.ts | G2 | feature-agent | src/lib/studio/schema.ts |
| W2.3 | Add migration functions for each schema version | G2 | feature-agent | src/lib/studio/migrations.ts (new) |
| W2.4 | Write tests for versioned hydration | G2 | test-agent | src/lib/studio/migrations.test.ts (new) |

### Wave 3 — Coverage Improvement (parallel swarm, 3 agents)

| ID | Action | Goal | Agent | Files |
|----|--------|------|-------|-------|
| W3.1 | Add tests for src/lib/ai/ modules | G3 | test-agent | src/lib/ai/*.test.ts |
| W3.2 | Add tests for src/lib/export/ modules | G3 | test-agent | src/lib/export/*.test.ts |
| W3.3 | Add tests for src/lib/search/ modules | G3 | test-agent | src/lib/search/*.test.ts |

### Wave 4 — Quality Gate + PR

| ID | Action | Goal | Agent |
|----|--------|------|-------|
| W4.1 | Run lint, typecheck, test, build | ALL | test-runner |
| W4.2 | Run quality gate | ALL | quality-agent |
| W4.3 | Update INDEX.md | G5 | docs-agent |
| W4.4 | Create branch, commit, push, create PR | G6 | git-agent |
| W4.5 | Monitor CI — all checks must pass | G6 | ci-agent |

## Key Files

| File | Action |
|------|--------|
| plans/ADRs/001-sqlite-wasm.md | Edit: status to "Superseded" |
| plans/startup-audit.md | Edit: complete bundle size analysis |
| src/lib/studio/schema.ts | Edit: add version field to hydration |
| src/lib/studio/migrations.ts | Create: versioned migration functions |
| src/lib/studio/migrations.test.ts | Create: tests for migrations |
| src/lib/ai/*.test.ts | Create: AI module tests |
| src/lib/export/*.test.ts | Create: export module tests |
| src/lib/search/*.test.ts | Create: search module tests |
| plans/INDEX.md | Edit: add Plan 082 entry |

## Success Criteria

- [ ] ADR 001 status corrected to "Superseded"
- [ ] Bundle size analysis completed in startup-audit.md
- [ ] Versioned hydration migrations implemented and tested
- [ ] Test coverage >= 55% lines
- [ ] All existing tests pass
- [ ] Lint, typecheck, build pass
- [ ] PR created with all CI checks passing
- [ ] All PR feedback addressed

---

**This is a planning artifact. No source code is modified by this document.**
