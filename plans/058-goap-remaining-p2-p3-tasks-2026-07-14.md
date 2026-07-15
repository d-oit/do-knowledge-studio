# 058 — GOAP Swarm: Remaining P2/P3 Task Remediation (2026-07-14)

## Summary

Implement the remaining actionable P2 and P3 items from plans 057 and the
UI/UX audit. All changes are CI-safe, local-first, no new dependencies.

## Task Dependency Graph

```
Wave 0 (Foundation — no dependencies)
├── T0.1: Saffron contrast — use --saffron-deep for small text on paper (P2) ✅
└── T0.2: Tablet breakpoint — right-panel at 1100px instead of 1024px (P3) ✅

Wave 1 (Component fixes — depends on Wave 0)
├── T1.1: Dialog semantics — command palette, export reset, right-panel delete (P2) ✅
└── T1.2: Home view redesign — recent-work-first, drop hero-metric cards (P3) ✅

Wave 2 (Tests + verification — depends on Wave 1)
└── T2.1: Tests for dialog semantics + home view ✅

Quality Gate: lint + typecheck + test + build ✅
```

## Tasks Completed

### T0.1: Saffron text contrast (P2) ✅
- **Problem**: `--saffron` #c77d3a on paper #faf8f3 = 3.08:1 (fails AA for small text)
- **Fix**: Switched `text-saffron` to `text-saffron-deep` for all small text (≤12px, labels, badges)
- **Files**: home-view.tsx, sidebar.tsx, mobile-drawer.tsx, editor-view.tsx, triz-view.tsx, ai-harness-view.tsx
- **Contrast improvement**: 3.08:1 → 5.47:1 (light), 3.88:1 → 5.66:1 (dark)

### T0.2: Tablet breakpoint (P3) ✅
- **Problem**: Three-pane layout activated at lg (1024px), too early for tablets
- **Fix**: Changed right-panel visibility from `lg:flex` to `wide:flex` (1100px)
- **Files**: right-panel.tsx (4 occurrences)

### T1.1: Dialog semantics (P2) ✅
- **Problem**: Command palette, export reset, right-panel delete were plain divs
- **Fix**: Added `role="dialog"`, `aria-modal="true"`, `aria-label`, Escape key handling, focus management
- **Files**: command-palette.tsx, export-view.tsx, right-panel.tsx

### T1.2: Home view redesign (P3) ✅
- **Problem**: Hero-metric dashboard template felt generic
- **Fix**: Replaced with compact greeting + recent work list + inline stats
- **Improvements**:
  - `Intl.DateTimeFormat` + `Intl.RelativeTimeFormat` for locale-safe dates
  - `useMemo`/`useCallback` for performance
  - Focused Zustand selectors
  - `text-saffron-deep` for small text
  - 334 LOC (down from 263, well under 500 limit)
- **Files**: home-view.tsx

### T2.1: Tests ✅
- `dialog-semantics.test.tsx`: 4 tests for command palette dialog attributes
- `home-view.test.tsx`: 9 tests for greeting, stats, recent entities, click handlers, empty state
- **Total**: 127 tests pass (was 114)

## Remaining Gaps (Tracked for Future Work)

| # | Gap | Priority | Effort |
|---|-----|----------|--------|
| 1 | CodeMirror evaluation spike | P3 | 4-6h |
| 2 | E2E test harness (Playwright) | P3 | 4-6h |
| 3 | Component consolidation (Button/Field/Dialog primitives) | P3 | 6-10h |
| 4 | Advanced TRIZ analysis features | P3 | 8h+ |
| 5 | Phase 8: P2P sync, multi-user, voice-to-knowledge | P3 | 30h+ |

## Verification

```bash
pnpm run lint          # ✅ 0 warnings
pnpm run typecheck     # ✅ no errors
pnpm run test          # ✅ 127 tests pass
pnpm run build         # ✅ compiles successfully
```
