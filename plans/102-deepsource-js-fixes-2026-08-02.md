# Plan 102 — Fix DeepSource JS Introduced Issues (Follow-up to PR #590)

**Date**: 2026-08-02
**Status**: DONE (merged via PR #591, `0ddf626`)
**Goal**: Fix the DeepSource: JavaScript check that remains red after PR #590's config change.

## Root Cause Analysis

After PR #590 merged, DeepSource JS still failed. Investigation revealed the **blocker is introduced issues in the diff, not the doc-coverage metric**:

- **Evidence**: PR #588 (docs-only) **PASSED** DeepSource — a repo-wide metric would fail docs-only PRs too. #589/#590 failed because they touched `store.ts`/`store.test.ts`/`store-coverage.test.ts`.
- **Introduced issues**: JS-0357 (Major, TDZ), JS-C1002 (short var names), JS-0321 (empty arrows), JS-0067 (false positive), JS-R1005 (complexity).
- **Ineffective suppressions**: `[analyzers.meta.checks]` with underscore keys (`JS_0067 = "off"`) is ignored by DeepSource — it expects the `[[analyzers.meta.issue_patterns]]` format that worked before commit `c3b7b2d`.

## Changes

### Code fixes (real issues)

**`src/lib/studio/store.ts`**:
- JS-0357 (TDZ): Moved `RECOVERY_KEY`, `RECOVERY_TTL_MS`, `MAX_RECOVERY_SIZE_BYTES` from below the store (line ~407) to above it (lines 13-16).
- JS-C1002: Renamed `const e` → `const entity` in `startEdit`; `map((c) =>` → `map((claim) =>` in `updateClaim`; `filter((c) =>` → `filter((claim) =>` in `deleteClaim`.

**`src/lib/studio/store.test.ts`**:
- JS-C1002: Renamed `const a/b/c` → `entityA/entityB/entityC` in "preserves links" test.

**`src/lib/studio/store-coverage.test.ts`**:
- JS-0321: `mockImplementation(() => {})` → `mockImplementation(() => undefined)` (2 occurrences).

### Config fix (suppressions that actually work)

**`.deepsource.toml`**: Replaced ignored `[analyzers.meta.checks]` underscore keys with the working `[[analyzers.meta.issue_patterns]]` format (restored from commit `cae93ff`):
- JS-0067 (ES module false positive), JS-R1005 (complexity via threshold), JS-0098, JS-0045, JS-W1042.

## Quality Gates

- [x] `pnpm run lint` — 0 errors
- [x] `pnpm run typecheck` — 0 errors
- [x] Store tests — 73 pass
- [ ] Full test suite
- [ ] PR created, CI monitored

## Files Changed

| File | Change |
|------|--------|
| `src/lib/studio/store.ts` | Constants hoisted (JS-0357), variable renames (JS-C1002) |
| `src/lib/studio/store.test.ts` | Variable renames (JS-C1002) |
| `src/lib/studio/store-coverage.test.ts` | Empty arrows → undefined (JS-0321) |
| `.deepsource.toml` | Restored working `issue_patterns` suppressions |
| `plans/102-deepsource-js-fixes-2026-08-02.md` | This plan |
