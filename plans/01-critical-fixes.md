# Plan 01: Critical Fixes (P0)

**Priority**: P0 (Fix immediately)  
**Estimated Total Effort**: 4-6 hours  
**Sources**: Swarm analysis - code quality, documentation gaps

## Tasks

### 1.1 Fix `any` Type Violation (CRITICAL)
**File**: `src/lib/search.ts:14-15`  
**Status**: ✅ COMPLETED  
**Action**:
- Removed `/* eslint-disable @typescript-eslint/no-explicit-any */`
- Replaced `Orama<any>` with typed `Orama<OramaSchema>`
- Verified with `npm run typecheck`

---

### 1.2 Fix Version Inconsistencies
**Files**: `README.md`, `cli/index.ts`, `CHANGELOG.md`, `VERSION`  
**Issue**: Version mismatch (0.1.0 vs 0.2.4)  
**Action**:
1. Update `README.md` line 6: `0.1.0` → `0.2.4`
2. Update `cli/index.ts`: `version: '0.1.0'` → `version: '0.2.4'`
3. Add entries to `CHANGELOG.md` for 0.2.4 and 0.2.3.
**Effort**: 30min  
**Validation**: `grep -r "0.1.0" . --include="*.md" --include="*.ts"` returns no results

---

### 1.3 Fix Broken Doc References
**Files**: `AGENTS.md`, `QUICKSTART.md`, `CONTRIBUTING.md`, `README.md`  
**Issue**: Chaotic mix of `SKILLS.md`, `AVAILABLE_SKILLS.md`, and `AVAILABLE_SKILLS.md`.  
**Action**:
1. Standardize ALL references to point to `agents-docs/AVAILABLE_SKILLS.md`.
2. Fix typo in `README.md` and `CONTRIBUTING.md` where `AVAILABLE_SKILLS.md` is used.
3. Remove non-existent `agents-docs/AGENTS_REGISTRY.md` reference from `QUICKSTART.md`.
**Effort**: 1h  
**Validation**: `grep -rE "SKILLS.md|AVAILABLE_SKILLS.md" .` returns no results.

---

### 1.4 Fix Orama Remove Functionality
**File**: `src/lib/search.ts:117-141`  
**Status**: ✅ COMPLETED  
**Action**:
1. Implemented `oramaIdMap` to track internal IDs.
2. `removeFromSearchIndex()` now correctly cleans up associated claims.
**Validation**: Verified in `src/lib/search.ts`. Need to add unit test in `src/lib/__tests__/search.test.ts`.

---

## Completion Criteria
- [x] No `any` types in codebase (`grep -r "any" src/ --include="*.ts"` returns only comments)
- [x] All version references match `VERSION` file (0.1.0)
- [x] No broken markdown references (check with `find . -name "*.md" -exec grep -l "SKILLS.md" {} \;`)
- [x] Orama remove correctly cleans up entities and associated claims
- [x] All quality gates pass: `npm test`, `npm run lint`, `npm run typecheck`
