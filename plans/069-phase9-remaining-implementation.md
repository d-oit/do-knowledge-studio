# Plan 069 — Phase 9 Remaining: PWA, Accessibility, UX Polish

**Date**: 2026-07-17
**Branch**: feat/phase9-pwa-a11y-polish
**Status**: IN PROGRESS

## Summary

Implement all 9 remaining Phase 9 tasks (#479-#487) across 3 parallel workstreams.

## Workstreams

### A. PWA Offline Support (#479-#481)

| Issue | Task | Status |
|-------|------|--------|
| #479 | Service worker with cache-first strategy | IN PROGRESS |
| #480 | Offline indicator and sync queue | IN PROGRESS |
| #481 | PWA manifest and installability | IN PROGRESS |

**Implementation**:
- Manual service worker in `public/sw.js` (no extra deps)
- Cache-first for static assets, network-first for API calls
- `public/manifest.webmanifest` for PWA installability
- `src/components/studio/offline-indicator.tsx` — live online/offline status
- Register SW in `src/app/layout.tsx`
- No new npm packages required

### B. Accessibility Hardening (#482-#484)

| Issue | Task | Status |
|-------|------|--------|
| #482 | Keyboard navigation audit and fixes | IN PROGRESS |
| #483 | Screen reader announcements for sync events | IN PROGRESS |
| #484 | Color contrast and focus indicators | IN PROGRESS |

**Implementation**:
- `src/lib/a11y/announcer.tsx` — aria-live region for dynamic announcements
- `src/lib/a11y/use-keyboard-trap.ts` — focus trap hook for dialogs
- Keyboard nav fixes in sidebar, command palette, views
- Color contrast fixes in globals.css (saffron on white)
- Focus indicator improvements

### C. UX Polish (#485-#487)

| Issue | Task | Status |
|-------|------|--------|
| #485 | Loading states and skeleton screens | IN PROGRESS |
| #486 | Error boundaries per view | IN PROGRESS |
| #487 | Keyboard shortcuts help dialog | IN PROGRESS |

**Implementation**:
- `src/components/studio/ui/skeleton.tsx` — shadcn skeleton component
- Skeleton variants for each view type (entity card, list, graph, etc.)
- Wrap each lazy view in ErrorBoundary in app-shell.tsx (already partially done)
- Enhance shortcuts dialog with search/filter, more shortcuts
- Add sync view shortcut (G S)

## Quality Gates

1. `pnpm run lint` — zero warnings
2. `pnpm run typecheck` — zero errors
3. `pnpm run test` — all pass
4. `pnpm run build` — successful
5. No new npm dependencies (PWA is vanilla JS)

## Files to Create/Modify

### New Files
- `public/sw.js` — service worker
- `public/manifest.webmanifest` — PWA manifest
- `src/components/studio/offline-indicator.tsx` — offline status UI
- `src/lib/a11y/announcer.tsx` — screen reader announcer
- `src/lib/a11y/use-keyboard-trap.ts` — focus trap hook
- `src/components/studio/ui/skeleton.tsx` — skeleton primitives

### Modified Files
- `src/app/layout.tsx` — register SW, add manifest link
- `src/app/globals.css` — focus indicator, contrast fixes
- `src/components/studio/app-shell.tsx` — error boundaries per view, offline indicator
- `src/components/studio/shortcuts-dialog.tsx` — add sync shortcut, search
- `src/components/studio/sidebar.tsx` — keyboard nav fixes
- `src/components/studio/views/home-view.tsx` — skeleton loading
- `src/components/studio/views/library-view.tsx` — skeleton loading
- `src/lib/studio/types.ts` — add sync shortcut to ViewId
