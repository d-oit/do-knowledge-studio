# Plan 100 — GOAP: ADR 007 Stale Status & Codebase Gap Analysis

**Date**: 2026-08-02
**Status**: DONE
**Method**: GOAP with hybrid execution
**Goal**: Address the remaining ADR 007 gap and verify no other implementation gaps exist.

## Task Analysis

**Primary Goal**: Update ADR 007 status from PROPOSED to Superseded (the proposed integration doesn't fit the current architecture) and verify the codebase is complete.

**Constraints**:
- All CI must pass
- New PR required
- Address all PR feedback

**Complexity**: Low (documentation fix + verification)

## Gap Analysis

### ADR 007 Status Issue

**Current State**: ADR 007 is marked "PROPOSED" and proposes integrating `do-web-doc-resolver` (a Python CLI tool) into the knowledge studio's ingestion pipeline.

**Problem**: This ADR is stale because:
1. The `do-web-doc-resolver` is a **Python CLI tool** designed for agent workflows, not a JavaScript/TypeScript library
2. The app already has web fetching via Jina Reader (`src/lib/ai/research.ts`)
3. The project migrated from Vite to Next.js - this ADR was from the old architecture
4. Integrating a Python subprocess into a local-first Next.js web app doesn't make architectural sense

**Resolution**: Mark ADR 007 as "Superseded" with explanation that:
- The app uses Jina Reader for URL content fetching (simpler, browser-native)
- The Python tool is available as a skill for agent workflows, not app integration
- The proposed SQLite `web_cache` table was never implemented (localStorage is the persistence layer)

### Other Gap Verification

Based on analysis of all plans (001-099):
- **Plans 001-068**: Historical, from retired Vite/SQLite architecture - completed in later plans
- **Plans 069-099**: All marked DONE with successful PRs
- **Test count**: 1992 tests passing
- **Coverage**: 57% lines (target 55%)
- **Quality gates**: All passing (lint, typecheck, test, build)
- **Open PRs**: #588 (docs update), #589 (LOC fixes on fix/loc-violations branch)

**No other implementation gaps found.** The project is in a mature, complete state.

## Execution Plan

### Wave 1: ADR Status Fix (Sequential)
- Update ADR 007 status to "Superseded"
- Add explanation for why the integration was not pursued

### Wave 2: Verification (Parallel)
- Run quality gates
- Verify no other gaps exist

### Wave 3: PR Creation (Sequential)
- Create branch, commit, push
- Create PR
- Monitor CI
- Address feedback

## Success Criteria

- [x] ADR 007 status updated to "Superseded"
- [x] All CI checks pass
- [x] PR created and reviewed
- [x] No other implementation gaps remain

## Key Files

| File | Action |
|------|--------|
| `plans/ADRs/007-doc-resolver-integration.md` | Edit: status → Superseded, add explanation |
| `plans/100-goap-adr007-stale-status-and-codebase-gaps-2026-08-02.md` | Create: this plan |

---

**This is a planning artifact. Source code is modified by this document.**
