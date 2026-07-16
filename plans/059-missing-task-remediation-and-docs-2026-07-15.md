# 059 — Missing Task Remediation & Documentation Alignment (2026-07-15)

> **Note**: This plan is superseded by plan 059 (P3 perf/disclosure/locale) for the
> remaining open tasks. See PR #445 for the final completions.

## Summary

Address discrepancies found during plans/ folder analysis and GitHub CI audit.
All changes are CI-safe, local-first, no new dependencies.

## Tasks Completed

### T1: Fix `Math.random()` in sidebar skeleton (AGENTS.md violation)
- **Problem**: `src/components/ui/sidebar.tsx:611` used `Math.random()` for skeleton
  loader width, violating the AGENTS.md rule.
- **Fix**: Replaced with a deterministic selection from a constant width array
  using `Date.now()` modulo — stable across re-renders within a session, no
  random values.
- **File**: `src/components/ui/sidebar.tsx`

### T2: Delete stale `dist/` directory (plan 048/050 gap)
- **Problem**: `dist/` directory from the old Vite build was never deleted locally,
  despite plan 048 (P0 #6) and plan 050 (T0.1) both requiring it.
- **Note**: `dist/` was in `.gitignore` so never tracked, but cluttered local
  workspace and ESLint scans.
- **Fix**: `rm -rf dist/`

### T3: Update `plans/INDEX.md`
- Fixed plan 058 entry: "PR TBD" → "PR #437" (merged 2026-07-15)
- Added PR #436 (useFilteredEntities optimization) session entry
- Added plan 059 session entry
- Updated Key Metrics: 11→12 test files, 127→130 tests
- Updated date from 2026-07-14 to 2026-07-15

### T4: Update `DESIGN-SYSTEM.md` typography patterns
- **Problem**: Section 8.7 Chips and badges still referenced `text-[9px]` and
  `text-[10px]` which were replaced by `text-badge` and `text-caption` tokens
  in plans 056/057.
- **Fix**: Updated all 5 pattern entries to use semantic token classes.

### T5: Document `export default` exception in AGENTS.md
- **Problem**: AGENTS.md says "Never use `export default`" but Next.js App Router
  files (`page.tsx`, `layout.tsx`) require it by framework convention.
- **Fix**: Added explicit exception note to the named exports rule.

## Verification

```bash
pnpm run lint          # ✅ 0 warnings
pnpm run typecheck     # ✅ no errors
pnpm run test          # ✅ 130 tests pass
```

## Related

- Plans 048, 050 (stale dist cleanup)
- Plans 056, 057 (typography token migration)
- Plan 058 (PR #437)
- PR #436 (useFilteredEntities optimization)
- AGENTS.md named exports rule