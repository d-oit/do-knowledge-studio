# Plan 074 — Sync Bridge, Accessibility, and Data Layer Hardening

**Date**: 2026-07-25
**Status**: DONE (2026-07-25)
**Method**: GOAP with ADRs
**Orchestrator**: `goap-agent` skill with parallel swarm
**Resolution**: All waves W0-W4 completed via PRs #502, #503, #504. Deferred: full a11y audit, coverage 50%, overlay primitive, claims history (tracked in Plan 075).

## Context

Plans 072–073 closed the majority of Plan 071's 14 findings. Two items were
explicitly deferred to Plan 074:

1. **G2**: Bidirectional Yjs/Zustand sync bridge (ADR 027 accepted, not implemented)
2. **Full accessibility audit**: axe scanning, screen reader, 200% zoom

Additional gaps remain from 071 and 073 that need incremental closure:
- Claims schema lacks `createdAt`/`updatedAt` timestamps (incomplete provenance)
- Touch targets still below 44px in graph/mindmap/chat views
- Encrypted export dialog missing ARIA attributes (ADR 014 gap)
- 16 ADRs still "Proposed" despite implementations being done or decisions superseded
- Coverage thresholds at 25/25/18/15%, target is 50%
- Agent docs reference nonexistent scripts/commands

## Goals

| ID | Goal | Priority | PR |
|----|------|----------|----|
| G1 | Claims schema: add `createdAt`/`updatedAt` for provenance | P0 | PR-A |
| G2 | Bidirectional Yjs/Zustand sync bridge per ADR 027 | P1 | PR-B |
| G3 | Touch target remediation: all interactive elements ≥ 44px | P1 | PR-A |
| G4 | Overlay ARIA: encrypted export dialog + stale ADR cleanup | P2 | PR-A |
| G5 | Coverage thresholds: raise to 30/30/22/20% with new tests | P2 | PR-A |
| G6 | Documentation: agent docs, skill manifest accuracy | P3 | PR-C |
| G7 | ADR status reconciliation (16 stale "Proposed") | P2 | PR-A |

## PR Strategy

### PR-A: Data Layer + A11y Polish (single PR, ~400 lines net)
Feasible as one PR because changes are localized and independent:
- Schema migration for Claim timestamps
- Touch target CSS fixes (3 view files)
- Encrypted export dialog ARIA attributes (1 file)
- ADR status updates (16 markdown files)
- Coverage threshold bump + new tests

### PR-B: Bidirectional Sync Bridge (dedicated PR, ~600 lines net)
Requires its own PR due to architectural complexity:
- Origin tagging for echo-loop prevention
- Tombstone schema for deletions
- Inbound Zod validation boundary
- Conflict resolution integration
- Full lifecycle tests

### PR-C: Documentation Cleanup (small PR, ~100 lines)
- Agent docs script/command references
- Skill manifest surface accuracy
- Any remaining P3 polish

## Wave Structure

### W0 — Baseline & Decisions
**Goal**: Establish working baseline, make ADR status decisions
**Agent**: `explore` (read-only scan)
**Tasks**:
1. Run full quality gate (`./scripts/quality_gate.sh`) — record baseline
2. Run coverage (`pnpm run test:coverage`) — record current percentages
3. Run axe-core scan on all views — record violations
4. Inventory all 16 "Proposed" ADRs and classify:
   - **Superseded**: mark as "Superseded by ADR X" (ADR 004 by 028, ADR 005 general by specifics, ADR 016 by 072/073)
   - **Implemented**: mark as "Implemented" (ADR 002 XSS → export uses WebCrypto now, ADR 010 schema v1 exists, ADR 013 tokens in globals.css, ADR 015 responsive in place, ADR 018 Next.js is the baseline, ADR 019 merged into 025, ADR 022 retrieval engine exists, ADR 023 drafts implemented, ADR 024 feedback policy implemented)
   - **Keep Proposed**: ADR 007 (doc resolver), ADR 011 (CLI extraction), ADR 012 (PDF strategy), ADR 014 (overlay primitive — still needed)
   - **Superseded/Abandoned**: ADR 004 (SQLite migration → we use localStorage, not SQLite), ADR 005 (generic error handling → specific patterns now in ADR 028)
5. Verify sync bridge current state — confirm one-way snapshot push only

**Gate**: Baseline recorded, ADR classification agreed, no regressions

### W1 — Data Layer (G1) + ADR Cleanup (G7)
**Goal**: Schema provenance + ADR status reconciliation
**Agent**: `general` (data-layer specialist)
**Tasks**:
1. **ClaimSchema migration** (`src/lib/studio/schema.ts`):
   - Add `createdAt: z.string()` and `updatedAt: z.string()` to `ClaimSchema`
   - Make both optional with defaults in migration path (existing claims get `new Date().toISOString()`)
   - Update `PersistedEnvelopeSchema` version from current to next
2. **Store migration** (`src/lib/studio/store.ts`):
   - Add migration case for existing claims without timestamps
   - Backfill `createdAt`/`updatedAt` from `new Date().toISOString()` during hydration
3. **Export/Import update** (`src/lib/export/`, `src/components/studio/views/export-helpers.ts`):
   - Ensure export includes new fields
   - Ensure import validates new fields (optional for backward compat with old exports)
4. **Seed data** (`src/lib/studio/seed.ts`):
   - Add timestamps to seed claims
5. **Tests**:
   - Unit test: claim with timestamps round-trips through export/import
   - Unit test: migration backfills timestamps on old claims
   - Unit test: claim created via store gets `createdAt`/`updatedAt`
6. **ADR reconciliation** (16 files in `plans/ADRs/`):
   - Update status field per W0 classification
   - Add brief note explaining status change

**Files changed**:
- `src/lib/studio/schema.ts` — ClaimSchema fields
- `src/lib/studio/store.ts` — migration logic
- `src/lib/studio/seed.ts` — seed timestamps
- `src/lib/export/*.ts` — export field handling
- `src/components/studio/views/export-helpers.ts` — import validation
- `plans/ADRs/002-security-export.md` → Implemented
- `plans/ADRs/004-db-migration-system.md` → Superseded by ADR 028
- `plans/ADRs/005-error-handling.md` → Superseded by ADR 028
- `plans/ADRs/007-doc-resolver-integration.md` → Keep Proposed
- `plans/ADRs/010-export-schema-v1.md` → Implemented
- `plans/ADRs/011-cli-command-extraction.md` → Keep Proposed
- `plans/ADRs/012-pdf-export-strategy.md` → Keep Proposed (PDF export now works)
- `plans/ADRs/013-semantic-design-tokens.md` → Implemented
- `plans/ADRs/014-overlay-accessibility-primitive.md` → Keep Proposed
- `plans/ADRs/015-responsive-and-visualization-theming.md` → Implemented
- `plans/ADRs/016-feature-gap-closure.md` → Superseded by Plans 072/073
- `plans/ADRs/018-nextjs-architecture-baseline.md` → Implemented
- `plans/ADRs/019-ai-provider-integration.md` → Superseded by ADR 025
- `plans/ADRs/021-encrypted-export-webcrypto.md` → Implemented (WebCrypto AES-GCM exists)
- `plans/ADRs/022-client-side-retrieval-engine.md` → Implemented
- `plans/ADRs/023-editor-draft-persistence-and-commit-lifecycle.md` → Implemented
- `plans/ADRs/024-editor-feedback-and-notification-policy.md` → Implemented

**Gate**: `pnpm run typecheck && pnpm run test` pass, all ADR statuses updated

### W2 — Touch Targets (G3) + Export ARIA (G4)
**Agent**: `general` (UI specialist)
**Tasks**:
1. **Touch target fixes** — add `min-h-[44px] min-w-[44px]` or equivalent:
   - `src/components/studio/views/graph-view.tsx`:
     - `ToolbarBtn` (line ~384): add `min-h-[44px] min-w-[44px]`
     - Layout toggle buttons (line ~198): add `min-h-[44px] min-w-[44px]`
   - `src/components/studio/views/mindmap-view.tsx`:
     - `ToolbarBtn` (line ~457): add `min-h-[44px] min-w-[44px]`
     - Expand/collapse chevron (line ~233): change `p-0.5` to `min-h-[44px] min-w-[44px] flex items-center justify-center`
     - Depth slider (line ~373): add `min-h-[44px]`
   - `src/components/studio/views/chat-view.tsx`:
     - Suggestion chips (lines ~101, ~222): add `min-h-[44px]`
     - Citation toggle (line ~161): add `min-h-[44px]`
     - Citation entity buttons (line ~182): add `min-h-[44px] min-w-[44px]`
     - Clear button (line ~278): add `min-h-[44px]`
2. **Export dialog ARIA** (`src/components/studio/views/export-view.tsx`):
   - Add `role="dialog"` to encrypted export overlay container
   - Add `aria-modal="true"`
   - Add `aria-labelledby` pointing to the title element
   - Add focus trap (reuse existing `useFocusTrap` if available, or add `tabIndex={-1}` + focus on open)
   - Add Escape key handler to close
3. **New tests**:
   - E2E: encrypted export dialog has `role="dialog"` and `aria-modal`
   - Unit test: touch target utility class verification (snapshot or computed style check)
4. **Coverage threshold bump** (`vitest.config.ts`):
   - Lines: 25% → 30%
   - Statements: 25% → 30%
   - Functions: 18% → 22%
   - Branches: 15% → 20%
   - Write new unit tests to cover the gap (target: 2-3 new test files covering schema migration, export helpers, sync bridge utils)

**Files changed**:
- `src/components/studio/views/graph-view.tsx` — touch targets
- `src/components/studio/views/mindmap-view.tsx` — touch targets
- `src/components/studio/views/chat-view.tsx` — touch targets
- `src/components/studio/views/export-view.tsx` — ARIA attributes
- `vitest.config.ts` — threshold bump
- New test files as needed for coverage

**Gate**: `pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run build` pass

### W3 — Sync Bridge (G2) [PR-B]
**Goal**: Implement bidirectional Yjs/Zustand bridge per ADR 027
**Agent**: `general` (sync specialist)
**Dependencies**: W1 (validated data boundary from ADR 028, claim timestamps)
**Tasks**:
1. **Origin tagging** (`src/lib/sync/bridge.ts`):
   - Add `origin` field to Yjs transactions to prevent echo loops
   - Skip inbound projection when origin is "zustand-outbound"
2. **Tombstone schema** (`src/lib/sync/tombstones.ts` — new file):
   - Define `TombstoneSchema` with `id`, `deletedAt`, `deletedBy`
   - Add tombstone map to Yjs doc
   - `removeYjsEntity`/`removeYjsClaim` write tombstones instead of deleting
3. **Inbound validation** (`src/lib/sync/inbound.ts` — new file):
   - `validateInboundEntity(data: unknown): ValidatedEntity | null`
   - `validateInboundClaim(data: unknown): ValidatedClaim | null`
   - Uses existing Zod schemas (EntitySchema, ClaimSchema)
   - Rejects invalid data with structured logging
4. **Conflict resolution** (`src/lib/sync/conflict.ts` — new file):
   - Timestamp-wins strategy (last writer wins with `updatedAt`)
   - `resolveConflict<T>(local: T, remote: T, timestamp: string): T`
   - Integrated into inbound projection
5. **Bridge lifecycle** (`src/lib/sync/bridge.ts`):
   - `subscribeToYjs()` now projects validated inbound changes to Zustand
   - Origin check prevents echo loops
   - Tombstones prevent deleted entity resurrection
   - `destroyBridge()` cleans up all subscriptions
6. **Store integration** (`src/lib/studio/store.ts`):
   - Add `applySyncUpdate(entities, claims)` action for inbound projections
   - Uses atomic transaction (single set() call)
7. **Tests**:
   - Unit: outbound → Yjs → inbound round-trip
   - Unit: origin tagging prevents echo loops
   - Unit: tombstone prevents resurrection
   - Unit: invalid inbound data is rejected
   - Unit: conflict resolution picks newer timestamp
   - Integration: two mock peers sync entities with conflict

**Files changed**:
- `src/lib/sync/bridge.ts` — origin tagging, inbound projection
- `src/lib/sync/merge.ts` — conflict resolution integration
- `src/lib/sync/tombstones.ts` — new: tombstone schema and operations
- `src/lib/sync/inbound.ts` — new: validation boundary
- `src/lib/sync/conflict.ts` — new: conflict resolution
- `src/lib/studio/store.ts` — `applySyncUpdate` action
- New test files: `src/lib/sync/__tests__/bridge.test.ts`, `tombstones.test.ts`, `inbound.test.ts`, `conflict.test.ts`

**Gate**: `pnpm run typecheck && pnpm run test` pass, all sync tests green

### W4 — Documentation (G6) [PR-C]
**Agent**: `general` (docs specialist)
**Tasks**:
1. **Agent docs audit** (`agents-docs/`):
   - Fix references to nonexistent scripts/commands
   - Align with actual `scripts/` directory contents
2. **Skill manifest audit**:
   - Verify skill descriptions match actual capabilities
   - Remove claims about unsupported surfaces
3. **Plan 071 status update**:
   - Mark findings as resolved (Plans 072/073/074)
4. **INDEX.md update**:
   - Add Plan 074 entry with wave status
   - Update key metrics
5. **This plan file**: update status to DONE

**Files changed**:
- `agents-docs/**/*.md` — script/command references
- `plans/071-goap-codebase-gap-audit-2026-07-19.md` — status update
- `plans/INDEX.md` — Plan 074 entry

**Gate**: `./scripts/quality_gate.sh --scope docs` passes

### W5 — Final Verification & Merge Prep
**Agent**: `general` (QA specialist)
**Tasks**:
1. Full quality gate: `./scripts/quality_gate.sh`
2. Coverage report: verify thresholds met
3. Axe-core scan: verify zero critical/serious violations
4. E2E full suite: `pnpm run test:e2e`
5. Build: `pnpm run build`
6. Code review invocation: `code-review-assistant` skill
7. Address all review findings
8. Update INDEX.md final status

**Gate**: All CI checks green, code review complete, zero P1/P2 findings

## Agent Swarm Structure

```
┌─────────────────────────────────────────────┐
│              GOAP Orchestrator               │
│         (goap-agent skill driver)            │
├──────────┬──────────┬──────────┬────────────┤
│  explore │ general  │ general  │  general   │
│ (W0 scan)│ (W1+W2)  │ (W3)    │  (W4+W5)  │
│ read-only│ data+a11y│ sync    │  docs+QA   │
│          │          │ bridge  │            │
└──────────┴──────────┴──────────┴────────────┘
     │          │          │          │
     ▼          ▼          ▼          ▼
   baseline   PR-A      PR-B       PR-C
              data+     sync      docs
              a11y      bridge    cleanup
```

**Execution order**:
1. W0 (explore) — always first, read-only
2. W1 + W2 (general-1) — sequential within, can start after W0
3. W3 (general-2) — starts after W1 completes (needs schema changes)
4. W4 (general-3) — starts after W2 completes (needs final metrics)
5. W5 (general-3) — starts after W3 + W4 complete

**Parallelism**:
- W1 and W2 run in the same PR (sequential within one agent)
- W3 is independent after W1, runs as separate PR
- W4 is independent after W2
- W5 is the final gate, blocks on all

## Quality Gates

| Gate | Command | Criteria |
|------|---------|----------|
| Lint | `pnpm run lint` | 0 warnings, 0 errors |
| Type | `pnpm run typecheck` | 0 errors |
| Unit | `pnpm run test` | All pass, coverage ≥ 30/30/22/20% |
| E2E | `pnpm run test:e2e` | All 58+ tests pass |
| Build | `pnpm run build` | Clean build, 0 warnings |
| Full gate | `./scripts/quality_gate.sh` | Exit 0 |
| A11y | axe-core scan | 0 critical, 0 serious violations |
| LOC | Per-file check | No file > 500 LOC |
| Code review | `code-review-assistant` | 0 P1, 0 P2 findings |

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Sync bridge echo loops | Medium | Origin tagging + comprehensive round-trip tests |
| Coverage threshold bump fails | Low | Write tests before bumping threshold |
| Touch target fixes break layout | Low | Visual regression via E2E, test at all viewports |
| ADR status changes are wrong | Low | Manual review of each ADR against current code |
| Import/export backward compat | Medium | Test old-format imports still work with new schema |

## Deferred to Plan 075

- Full Overlay primitive implementation (ADR 014 — shared `<Overlay>` component)
- Coverage target to 50% (incremental, not one-shot)
- Full screen reader verification (requires manual testing)
- 200% zoom / 400% reflow testing (requires manual + E2E)
- Claims version history / audit trail (beyond timestamps)
- PDF export polish (ADR 012)

## Success Criteria

1. All CI checks pass (22/22+)
2. Claims have `createdAt`/`updatedAt` timestamps
3. Sync bridge is bidirectional with validation
4. All touch targets ≥ 44px
5. Encrypted export dialog has proper ARIA
6. 16 stale ADRs reconciled
7. Coverage ≥ 30/30/22/20%
8. Agent docs accurate
9. Code review: 0 P1/P2 findings
10. `./scripts/quality_gate.sh` exits 0
