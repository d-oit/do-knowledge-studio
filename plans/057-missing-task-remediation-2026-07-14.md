# 057 — Missing Task Remediation (2026-07-14)

## Summary

Remediate outstanding P2/P3 gaps identified from the plans folder analysis and
the UI/UX audit (`ui-ux-audit-2026-07-11.md`). All changes are CI-safe,
local-first, and do not introduce new dependencies.

## Tasks Completed in This PR

### T1: Deterministic graph node positions
- **Problem**: `Math.random()` in `graph-view.tsx` caused nodes to shuffle on every
  render, destroying spatial memory (UI/UX audit P2 #9).
- **Fix**: Replaced with `seededRandom(entityId)` — a deterministic hash that
  produces the same float for the same entity ID every time.
- **File**: `src/components/studio/views/graph-view.tsx`

### T2: Honest export format states
- **Problem**: PDF and DOCX export cards were interactive but only showed
  `toast.info("coming soon")` on click — control theater (UI/UX audit P1 #6).
- **Fix**: Added `available` field to `ExportFormat`. PDF/DOCX cards are now
  disabled with dashed borders, muted text, "Planned" badge, and
  "Not yet available" label instead of misleading hover states.
- **Files**: `src/components/studio/views/export-helpers.ts`,
  `src/components/studio/views/export-view.tsx`

### T3: Contrast fixes for `--ink-faint`
- **Problem**: `--ink-faint` failed WCAG AA 4.5:1 contrast in both themes
  (light: 2.74:1, dark: 3.41:1 — UI/UX audit P1 #4).
- **Fix**:
  - Light: `#9c978d` → `#6a6660` (4.72:1 on paper)
  - Dark: `#6e685e` → `#827d72` (4.94:1 on dark paper)
- **File**: `src/app/globals.css`

### T4: Replace `text-[9px]` with `text-badge` token
- **Problem**: One remaining arbitrary `text-[9px]` in graph-view edge relation
  labels (UI/UX audit P2 #11).
- **Fix**: Replaced with the semantic `text-badge` utility class.
- **File**: `src/components/studio/views/graph-view.tsx`

## Remaining Gaps (Tracked for Future Work)

| # | Gap | Priority | Effort |
|---|-----|----------|--------|
| 1 | `--saffron` on paper fails AA for small text — use `--saffron-deep` in components | P2 | Component-level fix |
| 2 | Overlay/dialog semantics for export, command palette, right panel | P2 | 3-5h |
| 3 | Home view redesign (hero-metric → recent work first) | P3 | 3-4h |
| 4 | CodeMirror evaluation spike | P3 | 4-6h |
| 5 | E2E test harness (Playwright) | P3 | 4-6h |
| 6 | Tablet right-panel breakpoint adjustment | P3 | 2-3h |
| 7 | Component vocabulary consolidation (Button/Field/Dialog primitives) | P3 | 6-10h |
| 8 | Advanced TRIZ analysis features | P3 | 8h+ |
| 9 | Phase 8: P2P sync, multi-user, voice-to-knowledge | P3 | 30h+ |

## Verification

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```