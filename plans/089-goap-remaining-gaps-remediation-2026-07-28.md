# Plan 089 — GOAP: Address Remaining plans/ Documentation & Implementation Gaps

**Generated**: 2026-07-28
**Method**: GOAP with Swarm Agents
**Goal**: Address outstanding implementation gaps, ADR acceptance criteria, and accessibility requirements identified in plans/ analysis.

## Task Analysis

**Primary Goal**: Close all high-priority gaps in documentation (ADR criteria) and implementation (A11y, PWA, AI Provider).
**Constraints**: All changes must pass CI, be reviewed, and merged.
**Complexity**: High (multi-domain: security, a11y, pwa, ai, infra).

## Task Decomposition

### Wave 1: ADR Acceptance Criteria & Overlay A11y (P1)
- **T1.1**: Verify ADR 002 (Security Export) acceptance criteria and check off.
- **T1.2**: Verify ADR 003 (Vite Env Security) acceptance criteria and check off.
- **T1.3**: Verify ADR 005 (Error Handling) acceptance criteria and check off.
- **T1.4**: Fix Overlay search list ARIA roles.

### Wave 2: Manual Accessibility Verification (P0)
- **T2.1**: Verify skip navigation link and keyboard navigation.
- **T2.2**: Verify 200% zoom and 400% reflow behavior.
- **T2.3**: Verify touch targets (44x44).

### Wave 3: PWA Features (P1)
- **T3.1**: Implement service worker with cache-first strategy.
- **T3.2**: Add PWA manifest and installability.
- **T3.3**: Add offline indicator and sync queue.

### Wave 4: AI Provider & Quality (P2)
- **T4.1**: Write unit tests for AI provider endpoint selection.
- **T4.2**: Verify named exports and string constants.

## Execution Strategy

**Strategy**: Hybrid (Parallel waves with sequential dependencies).
**Agents**:
- `general`: For implementation tasks (T1.x, T3.x, T4.1).
- `explore`: For verification tasks (T2.x, T1.x criteria check).

## Success Criteria

- [x] All ADR 002, 003, 005 acceptance criteria checked off.
- [x] Overlay A11y fixes implemented (search list uses native `<ul>/<li>` with `role="list"` and proper `aria-label`).
- [ ] Manual A11y evidence captured (zoom, reflow, keyboard) — **pending; deferred to future follow-up task**
- [x] PWA service worker and manifest functional — **completed in Plan 090**
- [x] AI provider unit tests added — **completed in Plan 090**
- [x] All CI checks pass.
- [ ] PR reviewed and merged — **pending**
