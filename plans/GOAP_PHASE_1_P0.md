# GOAP Phase 1: P0 Critical Fixes

> Execution log for P0 parallel fixes

## Tasks

### P0-1: Fix XSS in Export (Entity Descriptions)

**Status**: pending
**Agent**: refactorer
**Files**:
- `src/features/export/ExportPanel.tsx:170`
- `cli/index.ts:161-163`

**Issue**: Entity descriptions are injected raw into HTML without `escapeHtml()`. Claims are properly escaped, but entities are not.

**Fix**:
1. In `ExportPanel.tsx`, wrap `entity.description` with `escapeHtml()`
2. In `cli/index.ts`, wrap `entity.description` with `escapeHtml()`

**Validation**: Verify `escapeHtml()` is imported and used consistently

---

### P0-2: Fix `as any` in repository.ts

**Status**: pending
**Agent**: refactorer
**Files**:
- `src/db/repository.ts:119`
- `src/db/repository.ts:297`

**Issue**: Two instances of `as any` to access `rowid` from Zod-parsed results. Violates `strict: true` and ESLint `no-explicit-any`.

**Fix**: Change `(rows[0] as any).rowid` to `(rows[0] as unknown as { rowid: number }).rowid`

**Validation**: `pnpm run typecheck` passes, no ESLint errors

---

### P0-3: Fix Dependabot Auto-Merge Workflow

**Status**: pending
**Agent**: feature-implementer
**Files**:
- `.github/workflows/dependabot-auto-merge.yml`

**Issues**:
1. Polling anti-pattern (30 min timeout)
2. Uses `getCombinedStatusForRef` (misses check runs)
3. Auto-merges ALL dependabot PRs including major bumps
4. Triggers on ALL PRs, not just dependabot

**Fix**:
1. Replace polling with `gh pr merge --auto --squash`
2. Add dependabot metadata filtering for update-type
3. Add `if: github.actor == 'dependabot[bot]'` to job

**Validation**: Workflow syntax valid, security improved

---

## Execution Log

### Start Time
[To be filled]

### End Time
[To be filled]

### Quality Gate Results
- [x] XSS vulnerability fixed (ExportPanel.tsx and cli/index.ts)
- [x] `as any` casts removed (repository.ts:116, 297)
- [x] Dependabot workflow secured (replaced polling with gh pr merge --auto)
- [x] `pnpm run typecheck` passes
- [ ] `pnpm run lint` passes (497 pre-existing errors)
- [ ] `pnpm run test` passes

### Issues Encountered
- Pre-existing lint errors (497) unrelated to P0 fixes
- Initial edit attempt for `as any` didn't apply correctly; required second attempt

### Notes
- XSS fix: Wrapped entity.description with escapeHtml() in both ExportPanel.tsx and cli/index.ts
- Type safety: Changed `(rows[0] as any).rowid` to `(rows[0] as unknown as { rowid: number }).rowid`
- Dependabot: Replaced 30-min polling with `gh pr merge --auto --squash`, added update-type filtering to skip major bumps
