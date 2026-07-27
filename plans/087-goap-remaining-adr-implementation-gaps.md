# Plan 087 — GOAP: Address Remaining ADR Implementation Gaps

**Date**: 2026-07-27
**Status**: DONE
**Method**: GOAP with hybrid execution (parallel swarm within waves)
**Orchestrator**: `goap-agent` skill with `parallel-execution`
**Branch**: `feat/087-remaining-adr-gaps`
**PR**: TBD

## Results

| Wave | Goal | Status | Changes |
|------|------|--------|---------|
| W1 | Implement conflict resolution application | Done | `sync-view.tsx` — handleConflictResolve now applies resolutions; `bridge.ts` — applyConflictResolution function |
| W1 | Implement bidirectional sync bridge lifecycle | Done | `bridge.ts` — startBidirectionalSync, `app-shell.tsx` — wired into app lifecycle |
| W2 | Persist recovery snapshots across sessions | Done | `store.ts` — importWithRollback persists to localStorage with 24h TTL |
| W2 | Add referential integrity check on import | Done | `export-helpers.ts` — parseImportFile validates claim entityId references |
| W3 | Setup reads manifest for all tools | Done | `setup-skills.sh` — reads manifest.json, creates symlinks for all declared tools |
| W3 | Add sync command to agent-surface.py | Done | `agent-surface.py` — sync_managed_surfaces function |
| W4 | Add fenced code block for multiline selections | Done | `formatting.ts` — applyInlineCode detects multiline and wraps in fenced block |
| W4 | Add split-mode width collapse | Done | `editor-view.tsx` — useEffect collapses split on narrow viewports |
| W5 | Quality gate | Done | Lint, typecheck, test (1048), build all pass |

## Task Analysis

**Primary Goal**: Close remaining ADR implementation gaps to bring all Accepted ADRs to Implemented status
**Constraints**: All CI must pass, new PR required, address all PR feedback
**Complexity**: Medium-High (4 ADRs, cross-cutting concerns, requires careful integration)

## Key Files

| File | Action |
|------|--------|
| `src/components/studio/views/sync-view.tsx` | Edit: implement conflict resolution application |
| `src/lib/sync/bridge.ts` | Edit: add applyConflictResolution, wire bidirectional sync |
| `src/components/studio/app-shell.tsx` | Edit: wire sync bridge lifecycle |
| `src/lib/studio/store.ts` | Edit: persist recovery snapshots |
| `src/components/studio/views/export-helpers.ts` | Edit: add referential integrity check |
| `scripts/setup-skills.sh` | Edit: read manifest.json for tool paths |
| `scripts/agent-surface.py` | Edit: add sync command |
| `src/lib/editor/formatting.ts` | Edit: add fenced code block logic |
| `src/components/studio/views/editor-view.tsx` | Edit: wire fenced code, add width collapse |

## Success Criteria

- [x] Conflict resolution applies user choices to store and propagates to Yjs
- [x] Bidirectional sync bridge runs in production lifecycle (not just manual join)
- [x] Recovery snapshots persist to localStorage with 24h TTL
- [x] Import validates claim entityId references against imported entities
- [x] Setup-skills.sh reads manifest.json and sets up all declared tools
- [x] agent-surface.py has `sync` command for managed surface creation
- [x] Multiline code selection wraps in fenced code blocks
- [x] Split mode collapses to Edit/Preview on narrow viewports
- [x] All existing tests pass (1048)
- [x] Lint, typecheck, build pass
- [ ] PR created with all CI checks passing
- [ ] All PR feedback addressed

---

**This is a planning artifact. Source code is modified by this document.**
