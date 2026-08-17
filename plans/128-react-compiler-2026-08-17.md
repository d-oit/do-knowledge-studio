# Plan 128 — Enable React Compiler (completes deferred Task 141) (2026-08-17)

Date: 2026-08-17
Status: IMPLEMENTED — delivered via PR, closes issue #699

## Goal

Complete the **deferred Task 141** (rerender audit & React 19 optimization). Task 141
was deferred with the rationale that "React 19 compiler handles most automatic
optimizations" — but the React Compiler was **not enabled**. This plan enables it.

## Analysis (2026-08-17)

- Stack: React 19.0 + Next.js 16.2.12. Next.js 16 promotes `reactCompiler` from
  `experimental` to **stable** (not enabled by default).
- No `reactCompiler` config existed in `next.config.ts`.
- The codebase was already compiler-friendly:
  - Zustand selector subscriptions (`useStudioStore((s) => s.entities)`) throughout
  - `useMemo`/`useCallback` already applied in hot views (graph-view, mindmap-view,
    chat-view, library-entities)
  - No `any` in `src/`, no empty `catch {}` blocks, no LOC > 500 violations,
    no TODO/FIXME debt
  - Plan 122 already isolated `useVirtualizer` behind `useEntityListVirtualizer`
    with a scoped `react-hooks/incompatible-library` suppression — the compiler
    was anticipated.

## Changes

1. **`next.config.ts`** — `reactCompiler: true` (stable option in Next.js 16).
2. **`package.json`** — added devDependency `babel-plugin-react-compiler@^1.0.0`
   (Next.js SWC integration auto-includes the compiler runtime; no manual
   `react-compiler-runtime` install needed).
3. **`src/components/studio/views/library-entities.tsx`** — added `'use no memo'`
   to `useEntityListVirtualizer`, `EntityGrid`, and `EntityTable`.

## Regression found & fixed: @tanstack/react-virtual vs the compiler

Enabling the compiler broke the Plan 122 windowing E2E suite
(`e2e/library-virtualization.spec.ts`):

- `grid caps at 24 then windows the expanded list` — FAILED
- `list view windows rows and mounts more on scroll` — FAILED

**A/B verified**: with `reactCompiler: false` both tests pass; with it enabled they
fail consistently (not flaky). Root cause: the virtualizer drives re-renders from
DOM measurements (scroll position, `ResizeObserver`, `measureElement`), which the
compiler's auto-memoization does not track — so windowed rows stop mounting on scroll.

**Fix**: the documented React Compiler escape hatch — `'use no memo'` on the
virtualizer hook and its two consuming components. The virtualizer path keeps its
manual optimization; everything else in the app is auto-optimized. After the fix
both tests pass with the compiler enabled.

## Verification

- `pnpm run typecheck` — clean
- `pnpm run lint` — clean
- `pnpm run test` — 2264 passed | 1 skipped
- `pnpm run build` — successful (Next.js 16.2.12, Turbopack)
- `pnpm run test:e2e` — **538 passed | 2 skipped** across chromium / mobile /
  tablet / desktop-xl (all 17 specs, including the virtualization spec and all
  axe-core accessibility checks)
- Confirmed the compiler is active in the production bundle: `.next/static/chunks`
  contain `_c(` memoization markers from `react/compiler-runtime`.

## Acceptance Criteria

- [x] `pnpm run build` passes (Next.js 16 + Turbopack)
- [x] All unit tests pass
- [x] E2E suite passes (no behavioral regressions from auto-memoization)
- [x] No new lint/typecheck warnings
- [x] Task 141 marked complete with verification notes

## References

- Issue: #699 — perf: enable React Compiler (completes deferred Task 141)
- Task: `plans/task-141-rerender-audit.md` (DEFERRED → COMPLETE)
- Docs: https://nextjs.org/docs/app/api-reference/config/next-config-js/reactCompiler
- Docs: https://react.dev/learn/react-compiler/installation
