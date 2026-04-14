---
version: "1.0.0"
name: pwa-offline-sync
description: >
  Design Cache Storage + IndexedDB strategy and sync queue. Activate for service worker, cache, or offline bug investigation. Generic pattern for any offline-first application.
category: workflow
---

# PWA Offline Sync

Purpose: design, implement, and validate offline/PWA behavior (service worker, caches, IndexedDB, sync queue).

## When to run
- Editing service worker, cache strategies, or sync orchestration.
- Touching IndexedDB schema, permission caching, or zombie detection.
- Investigating offline bugs or data conflicts.

## Workflow
1. **Assess entity rules** -- confirm table of offline-first entities + conflict strategy.
2. **Plan caches** -- map static/assets/data to Cache Storage policies (cache-first vs stale-while-revalidate vs network-first).
3. **IndexedDB schema** -- define stores for progress, annotations, sync queue, permission cache; version migrations carefully.
4. **Service worker** -- implement install/activate/fetch with trace logging, offline fallback page, and error handling.
5. **Sync manager** -- queue writes locally, dedupe via mutation IDs, replay when online, implement exponential backoff + zombie detection.
6. **Testing** -- simulate offline/online in E2E tests; unit-test queue reducers; verify revoked access is blocked after reconnect.

## Checklist
- [ ] Cache + DB version numbers bumped intentionally (no silent clears).
- [ ] Headers sent even when offline data queued.
- [ ] Zombie detection notifies user + stops further reads upon revocation.
- [ ] Service worker cleans up old caches.
- [ ] Memory-safe listeners (remove event handlers when replaced).

## References
- `references/offline-strategies.md` - Offline-first architecture patterns
- `references/sync-queue.md` - Sync queue design and conflict resolution
