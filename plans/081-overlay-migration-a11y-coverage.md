# Plan 081 — Overlay Migration, Semantic A11y, Coverage Target

**Date**: 2026-07-26
**Status**: DONE (verified 2026-07-26)
**Method**: GOAP with swarm parallel execution
**Orchestrator**: `goap-agent` skill with `parallel-execution` + `agent-coordination`
**Branch**: `feat/081-overlay-migration-a11y`
**PR**: [#516](https://github.com/d-oit/do-knowledge-studio/pull/516) — all 20 CI checks pass

## Context

Gap analysis of plans/ folder identified incomplete implementations:

1. **ADR 014 Overlay Migration** — PARTIALLY IMPLEMENTED (3 surfaces still un-migrated)
2. **ADR 014 Semantic Cleanups** — 2 items pending (search listbox, dead useFocusTrap)
3. **GOAL.md Coverage Target** — 46.5% lines vs 50% target
4. **Overlay variant support** — ADR 014 specifies sheet-bottom, sheet-left, fullscreen but only center exists

### Baseline (verified 2026-07-26)

| Metric | Value |
|--------|-------|
| Tests | 732 passed (54 files) |
| Coverage (lines) | 46.54% |
| Coverage (branches) | 38.9% |
| Coverage (functions) | 38.24% |
| Coverage (statements) | 46.7% |
| Lint | 0 warnings |
| Typecheck | 0 errors |
| Build | Success |
| CI | 22/22 passing |

## Goals

| ID | Goal | Priority | Effort |
|----|------|----------|--------|
| G1 | Add Overlay variant support (sheet-bottom, sheet-left, fullscreen) | P0 | 2h |
| G2 | Migrate command-palette.tsx to Overlay | P0 | 1h |
| G3 | Migrate mobile-drawer.tsx to Overlay | P0 | 1.5h |
| G4 | Migrate shortcuts-dialog.tsx to Overlay | P1 | 1h |
| G5 | Search listbox semantic cleanup (right-panel.tsx, mobile-drawer.tsx) | P1 | 1h |
| G6 | Remove dead useFocusTrap hook (or wire into Overlay) | P2 | 15min |
| G7 | Coverage to 50% lines (add ~25 tests) | P1 | 2h |
| G8 | Update GOAL.md with current status | P2 | 10min |
| G9 | Update ADR 014 status to IMPLEMENTED | P2 | 10min |
| G10 | Create PR, verify CI, address feedback | P0 | 1h |

## Wave Structure

### Wave 1 — Foundation (sequential: G1 must complete before G2-G4)

G1: Add variant support to Overlay component in shared-primitives.tsx:
- `center` (existing, default)
- `sheet-bottom` (full-width, slides up from bottom, safe-area padding)
- `sheet-left` (full-height, slides from left)
- `fullscreen` (covers entire viewport)
- Each variant gets appropriate ARIA, sizing, and animation

### Wave 2 — Parallel Migrations (G2 + G3 + G4 + G5 + G6)

| Agent | Task | Files |
|-------|------|-------|
| Agent A | G2: Migrate command-palette.tsx | command-palette.tsx |
| Agent B | G3: Migrate mobile-drawer.tsx | mobile-drawer.tsx |
| Agent C | G4: Migrate shortcuts-dialog.tsx | shortcuts-dialog.tsx |
| Agent D | G5: Search listbox semantics | right-panel.tsx, mobile-drawer.tsx |
| Agent E | G6: Remove/consolidate dead useFocusTrap | use-keyboard-trap.ts, shared-primitives.tsx |

### Wave 3 — Coverage + Docs (G7 + G8 + G9)

| Agent | Task | Files |
|-------|------|-------|
| Agent F | G7: Add tests for Overlay variants + migrated surfaces | New test files |
| Agent G | G8+G9: Update GOAL.md + ADR 014 | plans/GOAL.md, plans/ADRs/014 |

### Wave 4 — Quality Gate + PR (G10)

1. Run lint, typecheck, test, build
2. Run quality gate
3. Create branch, commit, push, create PR
4. Monitor CI — all 22 checks must pass
5. Address any PR review comments

## Key Files

| File | Action |
|------|--------|
| `src/components/studio/ui/shared-primitives.tsx` | Edit: add Overlay variants |
| `src/components/studio/command-palette.tsx` | Edit: migrate to Overlay |
| `src/components/studio/mobile-drawer.tsx` | Edit: migrate to Overlay |
| `src/components/studio/shortcuts-dialog.tsx` | Edit: migrate to Overlay |
| `src/components/studio/right-panel.tsx` | Edit: search listbox semantics |
| `src/lib/a11y/use-keyboard-trap.ts` | Delete or refactor |
| `plans/GOAL.md` | Edit: update remaining work |
| `plans/ADRs/014-overlay-accessibility-primitive.md` | Edit: update status |

## Success Criteria

- [x] Overlay component supports all 4 variants
- [x] command-palette, mobile-drawer, shortcuts-dialog use shared Overlay
- [x] Search results use proper listbox/option semantics
- [x] Dead useFocusTrap hook removed or consolidated
- [x] Coverage >= 50% lines
- [x] All existing tests pass
- [x] Lint, typecheck, build pass
- [x] PR created with all CI checks passing
- [x] All PR feedback addressed

---

**This is a planning artifact. No source code is modified by this document.**
