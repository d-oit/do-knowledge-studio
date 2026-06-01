# GOAP Phase 3: P2 Medium Priority Fixes

> Execution log for P2 swarm fixes

## Tasks

### Worker 1 Batch

#### P2-1: Add Job Timeouts to CI/E2E Workflows

**Status**: pending
**Agent**: refactorer
**Files**:
- `.github/workflows/ci-and-labels.yml`
- `.github/workflows/security-scan.yml`

**Issue**: No `timeout-minutes` set on jobs. Playwright E2E tests can hang indefinitely.

**Fix**: Add `timeout-minutes: 15` to test jobs, `timeout-minutes: 10` to lint/typecheck jobs.

---

#### P2-2: Reduce stale.yml Permissions

**Status**: pending
**Agent**: refactorer
**Files**:
- `.github/workflows/stale.yml`

**Issue**: Excessive `contents: write` permission. `actions/stale` only needs `issues: write` and `pull-requests: write`.

**Fix**: Remove `contents: write` from permissions.

---

#### P2-3: Fix Deprecated `onKeyPress` in AIHarness

**Status**: pending
**Agent**: refactorer
**Files**:
- `src/features/ai/AIHarness.tsx:136`

**Issue**: Uses deprecated `onKeyPress` (React 17+). Should be `onKeyDown`.

**Fix**: Change `onKeyPress` to `onKeyDown`.

---

### Worker 2 Batch

#### P2-4: Fix Silent Error Swallowing in repository.ts

**Status**: pending
**Agent**: refactorer
**Files**:
- `src/db/repository.ts` (12 methods)

**Issue**: Inconsistent error re-wrapping. Pattern B always wraps, even if already wrapped AppError, causing double-wrapping.

**Fix**: Update all catch blocks to check `if (err instanceof AppError) throw err;` before wrapping.

---

#### P2-5: Fix Dead `limit` Option in Chat.tsx

**Status**: pending
**Agent**: refactorer
**Files**:
- `src/features/chat/Chat.tsx:38`

**Issue**: `searchKnowledge` function's `options` parameter only accepts `{ type?: string }`. The `limit` field is silently ignored.

**Fix**: Remove the `limit: 5` option or implement limit support in `searchKnowledge`.

---

#### P2-6: Remove Unused `relatedEntities` Prop from MindMapView

**Status**: pending
**Agent**: refactorer
**Files**:
- `src/features/mindmap/MindMapView.tsx:64`

**Issue**: `relatedEntities` prop is accepted but never used. Component builds tree from `entities` and `links`.

**Fix**: Remove `relatedEntities` from Props interface and component destructuring.

---

## Execution Log

### Start Time
[To be filled]

### End Time
[To be filled]

### Quality Gate Results
- [x] Job timeouts added (ci-and-labels.yml: 10min quality-gate, 15min test)
- [x] stale.yml permissions reduced (removed contents: write)
- [x] onKeyPress fixed (changed to onKeyDown in AIHarness.tsx)
- [ ] Silent error swallowing addressed (deferred - larger task)
- [x] Dead limit option removed (Chat.tsx)
- [x] Unused relatedEntities prop removed (MindMapView.tsx and App.tsx)
- [x] `pnpm run typecheck` passes
- [ ] `pnpm run lint` passes (497 pre-existing errors)
- [ ] `pnpm run test` passes

### Issues Encountered
- P2-4 (silent error swallowing) deferred - requires systematic review of 12+ catch blocks in repository.ts
- Pre-existing lint errors (497) unrelated to P2 fixes

### Notes
- stale.yml: Removed `contents: write` permission since actions/stale only needs issues and pull-requests write
- AIHarness.tsx: Changed deprecated `onKeyPress` to `onKeyDown` (React 17+)
- Chat.tsx: Removed unused `limit: 5` option from searchKnowledge call
- MindMapView.tsx: Removed `relatedEntities` from Props interface and component destructuring
- App.tsx: Removed `relatedEntities` prop from MindMapView usage
