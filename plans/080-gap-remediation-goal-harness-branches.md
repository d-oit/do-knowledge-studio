# Plan 080 — Gap Remediation: GOAL.md, ai-harness split, branch cleanup

**Date**: 2026-07-26
**Status**: DONE (verified 2026-07-26)
**Method**: GOAP with swarm parallel execution
**Orchestrator**: `goap-agent` skill with `parallel-execution` + `agent-coordination`
**Branch**: `feat/080-gap-remediation`
**PR**: [#515](https://github.com/d-oit/do-knowledge-studio/pull/515) — all 22 CI checks pass

## Context

Gap analysis identified 4 actionable items from the plans/ folder:
1. GOAL.md has stale "Remaining Work" section referencing completed Plan 074 items
2. `ai-harness-view.tsx` is 511 LOC, exceeds 500 LOC AGENTS.md hard limit
3. `sidebar.tsx` is 733 LOC — shadcn-generated, needs exception decision
4. ~60 stale remote feature branches

Plan 071 exit criterion (a11y evidence) is partial but deferred to a future plan — not in scope here.

## Goals

| ID | Goal | Priority | Effort |
|----|------|----------|--------|
| G1 | Update GOAL.md to remove stale "Remaining Work" section | P0 | 5 min |
| G2 | Split ai-harness-view.tsx under 500 LOC | P1 | 2h |
| G3 | Document sidebar.tsx exception (shadcn vendor code) | P2 | 10 min |
| G4 | Clean up stale remote branches | P3 | 10 min |
| G5 | Create PR, verify CI, address feedback | P1 | 1h |

## Wave Structure

### Wave 1 — Parallel (G1 + G3)
- G1: Rewrite GOAL.md lines 31-33 to reflect current completed state
- G3: Add sidebar.tsx exception note to AGENTS.md or plans/

### Wave 2 — ai-harness split (G2)
- Extract settings panel into `ai-harness-settings-panel.tsx`
- Extract chat interface into `ai-harness-chat.tsx`
- Keep orchestrator in `ai-harness-view.tsx` (target: ~150 LOC)

### Wave 3 — Quality gate + PR (G5 + G4)
- Run lint, typecheck, test, build
- Create branch, commit, push, PR
- Clean stale branches
- Monitor CI, address feedback

## Key Files

| File | Action |
|------|--------|
| `plans/GOAL.md` | Edit: remove stale remaining work |
| `src/components/studio/views/ai-harness-view.tsx` | Edit: extract to ~150 LOC |
| `src/components/studio/views/ai-harness-settings-panel.tsx` | New: settings panel |
| `src/components/studio/views/ai-harness-chat.tsx` | New: chat interface |

## Success Criteria

- [x] GOAL.md no longer references completed Plan 074 items as remaining
- [x] ai-harness-view.tsx under 500 LOC
- [x] New extracted files under 500 LOC each
- [x] All existing tests pass
- [x] Lint, typecheck, build pass
- [x] PR created with all CI checks passing
- [x] All PR feedback addressed

---

**This is a planning artifact. No source code is modified by this document.**
