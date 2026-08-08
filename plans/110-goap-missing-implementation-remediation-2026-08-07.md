# Plan 110 — GOAP: Missing Implementation Remediation (2026-08-07)

**Status**: COMPLETE (2026-08-07 — all gaps resolved, quality gate green, PR submitted)
**Method**: GOAP orchestrator with parallel agent swarm
**Goal**: Address all missing implementations found in plans/ gap analysis; create PR with green CI.

## Gap Analysis

| # | Gap | Severity | Source |
|---|-----|----------|--------|
| G1 | `export-helpers.ts` at 544 LOC exceeds 500 LOC hard limit | P1 | AGENTS.md |
| G2 | `next-env.d.ts` uncommitted (Next.js 16 path change) | P1 | git status |
| G3 | Plan 109 status still "IN PROGRESS" — work is complete | P2 | plans/INDEX.md |
| G4 | `as unknown as` casts in `encrypt.ts` (3) and `qr-pairing.tsx` (1) — legitimate Web API type mismatches, suppressed in DeepSource | P2 | AGENTS.md |
| G5 | No missing view test coverage (all views have tests) | — | Verified |
| G6 | All ADRs are Implemented or Superseded | — | Verified |
| G7 | Coverage thresholds met (55/48/50/55) | — | Verified |

## Execution Log

### Phase 1 — Implementation (done 2026-08-07)
- **G1 (SPLIT)**: `export-helpers.ts` split into 3 modules, all under 500 LOC:
  - `export-types.ts` (155 LOC) — types, `FORMATS`, `COLOR_MAP`, `todayStamp`, `downloadBlob`/`downloadFile`, `buildClaimsByEntityId`, `ExportOptions`
  - `export-documents.ts` (213 LOC) — `buildPdfExport`, `buildDocxExport` (jspdf/docx heavy builders)
  - `export-helpers.ts` (181 LOC) — `buildJsonExport`, `buildMarkdownExport`, `buildHtmlExport`, `parseImportFile`
  - All 12 importers updated (7 source files + 5 test files) to import from the correct module; `vi.mock` paths updated to match.
- **G2 (NEXTJS)**: `next-env.d.ts` Next.js 16 path change committed.
- **G3 (DOCS)**: Plan 109 marked DONE; INDEX.md updated.
- **G4–G7**: Verified — casts are suppressed with documented justification; all views have tests; all ADRs Implemented/Superseded; coverage thresholds met.

### Phase 2 — Validation
1. `pnpm run lint`
2. `pnpm run typecheck`
3. `pnpm run test`
4. `pnpm run build`

### Phase 3 — PR creation & review
- Branch `feat/plan-110-export-helpers-split` pushed; **PR #616** opened (`8a3e720`)
- Code review performed; findings addressed

### Phase 4 — DeepSource JS remediation (2 rounds)
DeepSource flagged findings on the PR diff; resolved at code level in `e2e34c9` + `7e6f5b3`:
- **Round 1** (`e2e34c9`): JS-R1005 complexity on `buildPdfExport`/`buildDocxExport` (extracted `renderPdfEntity`/`buildDocxIntro`/`buildDocxEntityParagraphs`); JS-C1003 wildcard import; JS-0424 single-child fragments in 16 test `AnimatePresence` mocks.
- **Round 2** (`7e6f5b3`): JS-0357 used-before-defined in `export-view.test.tsx`; JS-0424 `CursorTracker` mock; JS-R1005 further complexity splits (`renderPdfHeader`/`renderPdfClaims`/`drawWrappedText`/`docxMetaText`/`buildDocxClaimParagraphs` — all functions ≤5) + `pressKey` destructured defaults; JS-0067 `function`→`const` arrows; JS-0320 dynamic `delete` replaced.
- **Result**: DeepSource: JavaScript green — "Analysis passed: No blocking issues or failing metrics found". All CI checks on PR #616 pass (Unit Tests, E2E, Build, Coverage, Codacy, CodeQL, Vercel).

## Success Criteria
- [x] `export-helpers.ts` split into files under 500 LOC each
- [x] All imports updated across codebase
- [x] `next-env.d.ts` committed
- [x] Plan 109 status updated to DONE
- [x] All CI checks pass (lint, typecheck, test, build)
- [x] PR created with code review
