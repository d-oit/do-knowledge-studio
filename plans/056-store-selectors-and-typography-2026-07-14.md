# 056 — Store Selectors & Typography Scale (2026-07-14)

## Summary

Address P2 findings from the UI/UX audit: narrow Zustand subscriptions to
prevent unnecessary re-renders, and replace arbitrary inline font sizes with
semantic type-scale tokens.

## Tasks

### T1: Store subscription narrowing
- Convert broad `useStudioStore()` to focused `useStudioStore((s) => s.field)` selectors
- Target: all view components that destructure 4+ fields
- Expected impact: fewer re-renders during entity editing, chat, filtering

### T2: Typography scale tokens
- Add semantic type-scale CSS classes to globals.css: `.text-badge`, `.text-caption`, `.text-label`, `.text-body-sm`
- Replace `text-[9px]`, `text-[10px]`, `text-[11px]` across studio views
- Keep `text-[12px]`, `text-[13px]`, `text-[14px]`, `text-[15px]`, `text-[16px]` as-is (already at good sizes)

### T3: Update INDEX.md

## Verification

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```
