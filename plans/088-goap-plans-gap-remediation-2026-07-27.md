# Plan 088 — GOAP: Address Remaining plans/ Implementation & Documentation Gaps

**Date**: 2026-07-27
**Status**: IN PROGRESS
**Method**: GOAP with hybrid execution (parallel swarm within waves)
**Orchestrator**: `goap-agent` skill with `parallel-execution`
**Branch**: `feat/088-plans-gap-remediation`

## Context

Analysis of the entire plans/ folder identified gaps across three categories:

1. **ADR Status Staleness**: 8 ADRs have implementations complete but status never promoted to "Implemented"
2. **Accessibility Manual Testing**: Screen reader verification, 200% zoom, 400% reflow, skip-nav — deferred since Plan 071
3. **Documentation Discrepancies**: GOAL.md stale coverage numbers, plan checkboxes never checked, non-standard ADR format

All code implementations from Plans 078–087 are verified present in the codebase. No missing source code. The gaps are documentation and manual a11y verification.

## Goals

| ID | Goal | Priority | Effort |
|----|------|----------|--------|
| G1 | Update 8 ADR statuses to Implemented/Superseded | P1 | 30min |
| G2 | Add skip navigation link | P1 | 30min |
| G3 | Improve zoom/reflow CSS for 200%/400% compliance | P1 | 1h |
| G4 | Fix GOAL.md stale coverage numbers | P2 | 10min |
| G5 | Check off completed plan success criteria | P2 | 30min |
| G6 | Fix ADR 06 non-standard status format | P3 | 10min |
| G7 | Quality gate + PR + CI verification | P0 | 1h |

## Wave Structure

### Wave 1 — ADR Status Updates (parallel swarm, 4 agents)

| ID | Action | Goal | Files |
|----|--------|------|-------|
| W1.1 | Update ADR 003 status to "Implemented" | G1 | plans/ADRs/003-vite-env-security.md |
| W1.2 | Update ADR 020 status to "Implemented" | G1 | plans/ADRs/020-rich-text-editor-strategy.md |
| W1.3 | Update ADRs 025, 026, 027, 028, 029 status to "Implemented" | G1 | plans/ADRs/025-*.md through 029-*.md |
| W1.4 | Update ADR 06 status to "Superseded" | G6 | plans/ADRs/06-llm-provider-system.md |

### Wave 2 — Accessibility Quick Wins (sequential)

| ID | Action | Goal | Files |
|----|--------|------|-------|
| W2.1 | Add skip navigation link to app shell | G2 | src/components/studio/app-shell.tsx |
| W2.2 | Add zoom/reflow CSS for 200%/400% compliance | G3 | src/app/globals.css |

### Wave 3 — Documentation Fixes (parallel, 3 agents)

| ID | Action | Goal | Files |
|----|--------|------|-------|
| W3.1 | Update GOAL.md coverage numbers and remaining work | G4 | plans/GOAL.md |
| W3.2 | Check off completed success criteria in plans 078, 080, 081, 082, 083, 087 | G5 | plans/078-*.md through 087-*.md |
| W3.3 | Update INDEX.md with Plan 088 | G5 | plans/INDEX.md |

### Wave 4 — Quality Gate + PR

| ID | Action | Goal |
|----|--------|------|
| W4.1 | Run lint, typecheck, test, build | G7 |
| W4.2 | Create branch, commit, push, create PR | G7 |
| W4.3 | Monitor CI — all checks must pass | G7 |
| W4.4 | Address any PR feedback | G7 |

## Success Criteria

- [ ] All 8 ADR statuses updated to Implemented or Superseded
- [ ] Skip navigation link present in app shell
- [ ] Zoom/reflow CSS handles 200% and 400% gracefully
- [ ] GOAL.md reflects actual coverage (57%)
- [ ] Plan checkboxes checked for completed work
- [ ] ADR 06 format standardized
- [ ] All existing tests pass (1048)
- [ ] Lint, typecheck, build pass
- [ ] PR created with all CI checks passing
- [ ] All PR feedback addressed

## Key Files

| File | Action |
|------|--------|
| `plans/ADRs/003-vite-env-security.md` | Edit: status → Implemented |
| `plans/ADRs/020-rich-text-editor-strategy.md` | Edit: status → Implemented |
| `plans/ADRs/025-ai-provider-consolidation.md` | Edit: status → Implemented |
| `plans/ADRs/026-p2p-sync-architecture.md` | Edit: status → Implemented |
| `plans/ADRs/027-canonical-state-and-p2p-sync-bridge.md` | Edit: status → Implemented |
| `plans/ADRs/028-validated-recoverable-local-data-boundaries.md` | Edit: status → Implemented |
| `plans/ADRs/029-manifest-driven-agent-harness.md` | Edit: status → Implemented |
| `plans/ADRs/06-llm-provider-system.md` | Edit: status → Superseded |
| `src/components/studio/app-shell.tsx` | Edit: add skip-nav link |
| `src/app/globals.css` | Edit: zoom/reflow CSS |
| `plans/GOAL.md` | Edit: update coverage numbers |
| `plans/INDEX.md` | Edit: add Plan 088 entry |
| `plans/078-*.md` through `plans/087-*.md` | Edit: check success criteria |

---

**This is a planning artifact. Source code is modified by this document.**
