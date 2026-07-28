# Plan 090 — GOAP: PWA Service Worker, AI Provider Tests, A11y Automation

**Generated**: 2026-07-28
**Method**: GOAP with Swarm Agents (Parallel Execution)
**Goal**: Implement deferred items from Plan 089: PWA service worker, AI provider unit tests, and automated a11y checks.

## Task Analysis

**Primary Goal**: Close all deferred items from Plan 089 with a single PR.
**Constraints**: All CI must pass, new PR required, address all PR feedback.
**Complexity**: Medium (3 independent implementation domains).

## Task Decomposition

### Wave 1: Parallel Implementation (Swarm)

| ID | Task | Priority | Agent | Files |
|----|------|----------|-------|-------|
| T1.1 | Implement service worker with cache-first strategy | P1 | general | `public/sw.js` (new), `src/app/layout.tsx` |
| T1.2 | Add offline indicator component | P1 | general | `src/components/studio/offline-indicator.tsx` (new) |
| T1.3 | Write AI provider endpoint selection tests | P2 | general | `src/lib/ai/providers.test.ts` (new) |
| T1.4 | Add automated keyboard navigation tests | P2 | general | `src/components/studio/__tests__/keyboard-nav.test.tsx` (new) |

### Wave 2: Quality Gate

| ID | Task | Agent |
|----|------|-------|
| T2.1 | Run lint, typecheck, test, build | bash |
| T2.2 | Create branch, commit, push | bash |
| T2.3 | Create PR | bash |

## Success Criteria

- [ ] Service worker registered and caching static assets
- [ ] Offline indicator shows connection status
- [ ] AI provider tests cover endpoint selection, validation, error handling
- [ ] Keyboard navigation tests verify tab order and focus management
- [ ] All existing tests pass (1073+)
- [ ] Lint, typecheck, build pass
- [ ] PR created with all CI checks passing

## Key Files

| File | Action |
|------|--------|
| `public/sw.js` | Create: service worker with cache-first strategy |
| `src/app/layout.tsx` | Edit: register service worker |
| `src/components/studio/offline-indicator.tsx` | Create: connection status component |
| `src/lib/ai/providers.test.ts` | Create: provider unit tests |
| `src/components/studio/__tests__/keyboard-nav.test.tsx` | Create: keyboard nav tests |

---

**This is a planning artifact. Source code is modified by this document.**
