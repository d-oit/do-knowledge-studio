# 066 — Phase 9: Performance, PWA & Polish (2026-07-17)

## Summary

Phase 9 focuses on production readiness: bundle optimization, PWA offline support, accessibility hardening, and UX polish across all views.

## Epics

### Epic 1: Bundle Optimization (Issues #476-#478)

| Issue | Title | Effort | Dependencies |
|-------|-------|--------|-------------|
| #476 | Bundle analysis and tree-shaking audit | 2-3h | None |
| #477 | Lazy-load heavy components (graph, mindmap, AI) | 3-4h | #476 |
| #478 | Dynamic imports for sync module (yjs, y-webrtc) | 2-3h | #476 |

### Epic 2: PWA Offline Support (Issues #479-#481)

| Issue | Title | Effort | Dependencies |
|-------|-------|--------|-------------|
| #479 | Service worker with cache-first strategy | 4-5h | None |
| #480 | Offline indicator and sync queue | 3-4h | #479 |
| #481 | PWA manifest and installability | 2-3h | #479 |

### Epic 3: Accessibility Hardening (Issues #482-#484)

| Issue | Title | Effort | Dependencies |
|-------|-------|--------|-------------|
| #482 | Keyboard navigation audit and fixes | 3-4h | None |
| #483 | Screen reader announcements for sync events | 2-3h | None |
| #484 | Color contrast and focus indicators | 2-3h | None |

### Epic 4: UX Polish (Issues #485-#487)

| Issue | Title | Effort | Dependencies |
|-------|-------|--------|-------------|
| #485 | Loading states and skeleton screens | 2-3h | None |
| #486 | Error boundaries per view | 2-3h | None |
| #487 | Keyboard shortcuts help dialog | 1-2h | None |

## Execution Order

```
Phase 9.1 (Foundation):
├── #476: Bundle analysis
├── #479: Service worker
├── #482: Keyboard navigation audit
└── #485: Loading states

Phase 9.2 (Enhancement):
├── #477: Lazy-load heavy components
├── #478: Dynamic imports for sync
├── #480: Offline indicator
├── #481: PWA manifest
├── #483: Screen reader announcements
├── #484: Color contrast fixes
├── #486: Error boundaries
└── #487: Keyboard shortcuts help

Phase 9.3 (Quality):
└── Final QA and performance testing
```

Total estimated effort: 25-35 hours

## Success Criteria

- Bundle size < 200KB gzipped (excluding vendor)
- Lighthouse Performance score > 90
- All views work offline after first load
- WCAG 2.1 AA compliance
- Zero console errors in production
