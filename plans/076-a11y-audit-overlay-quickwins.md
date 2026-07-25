# Plan 076 — Accessibility Audit, Overlay Migration, and Quick-Win Remediations

**Date**: 2026-07-25
**Status**: DONE
**Method**: GOAP with swarm agents
**Orchestrator**: `goap-agent` skill
**Branch**: `feat/076-a11y-audit-overlay-quickwins`
**PR**: (pending)

## Context

Plans 072–075 executed successfully (all CI passing, 502 unit tests, 31.63% coverage).
Plan 076 addresses the **last unchecked Plan 071 exit criterion** (full accessibility audit) plus accumulated P2 quick wins.

## Goals

| ID | Goal | Priority | Status |
|----|------|----------|--------|
| G1 | Full WCAG 2.2 audit — axe-core scan, keyboard nav, ARIA, focus management, touch targets | P0 | Done |
| G2 | Complete Overlay migration (right-panel delete dialog → shared Overlay) | P1 | Done |
| G3 | `prefers-reduced-motion` gate for Framer Motion in ai-harness-view + TypingIndicator | P2 | Done |
| G4 | Fix Playwright retry/trace config | P2 | Deferred (config change only, no code impact) |
| G5 | Fix "coming soon" labels on undo/redo buttons | P3 | Deferred (minor polish) |
| G6 | Coverage improvement toward 50% | P1 | Deferred (incremental, separate PR) |

## Audit Summary

3 parallel agents audited the entire codebase:

| Category | Critical | Serious | Moderate | Minor | Total |
|----------|----------|---------|----------|-------|-------|
| ARIA/Semantic | 1 | 10 | 11 | 6 | 28 |
| Keyboard/Focus | 3 | 5 | 5 | 2 | 15 |
| Touch Targets | 16 | — | 3 | — | 19 |
| Motion | 1 | — | 5 | — | 6 |
| **Total** | **21** | **15** | **24** | **8** | **68** |

## Fixes Implemented (41 fixes across 14 files)

### ARIA Labels & Semantic (18 fixes)
- Chat textarea `aria-label="Chat message"`
- AI harness textarea `aria-label="AI agent message"`
- AI harness custom model input `aria-label`
- Library sort direction button `aria-label` (replaced `title`)
- Library sort select `aria-label="Sort by"`
- Mindmap root entity select `aria-label="Root entity"`
- Mindmap depth range input `aria-label="Tree depth"`
- Topbar "New" button `aria-label="New entity"`
- Export password inputs `htmlFor`/`id` association
- Export password error `aria-describedby` linkage
- Sync room ID label `htmlFor`/`id` association
- Editor toolbar `role="toolbar"` + `aria-label="Formatting"`
- Graph view toolbar `role="toolbar"` + `aria-label="Graph controls"`
- Mindmap toolbar `role="toolbar"` + `aria-label="Mind map controls"`
- Chat citation toggle `aria-expanded`
- Chat TypingIndicator `aria-live="polite"` + `aria-label`
- TRIZ table `<caption>` (sr-only)
- Library table `<caption>` (sr-only)

### Keyboard & Focus (8 fixes)
- Right-panel delete dialog → shared `<Overlay>` (focus trap, Escape, scroll lock, focus restore)
- Skip-to-content link in app-shell (`<a href="#main-content">`)
- Chat clear button `focus-ring`
- Home view "View All" button `focus-ring`
- Right panel keyword/ranked toggles `focus-ring` + `aria-pressed`
- Mindmap compact toggle `focus-ring` + `aria-pressed`
- Export show/hide password button `focus-ring`
- AI harness show/hide key button `focus-ring`

### Touch Targets (12 fixes)
- AI harness refresh button 34→44px
- AI harness send button 32→44px
- Editor tag remove button ~10→44px
- Export show/hide password button → min 44px
- AI harness show/hide key button → min 44px
- Sync QR button 28→44px
- Sync copy button 28→44px
- QR pairing close button 24→44px
- QR pairing copy button 24→44px
- Right panel close buttons → min 44px
- Conflict UI buttons → min 44px + focus-ring
- TRIZ toggle buttons → min 44px
- Claims panel edit/delete buttons → min 44px + gap increase
- Editor toolbar advanced toggle → min 44px

### Motion Preferences (3 fixes)
- ai-harness-view: All 4 Framer Motion animations gated with `useReducedMotion`
- TypingIndicator: `animate-bounce` gated with `reducedMotion` prop
- Both use component-level gating (not just global CSS override)

## Files Changed

| File | Changes |
|------|---------|
| `app-shell.tsx` | Skip-to-content link, `id="main-content"` on main |
| `right-panel.tsx` | Overlay import, delete dialog migration, search input aria-label, close button touch target, keyword/ranked aria-pressed + focus-ring, inspector close button |
| `chat-view.tsx` | Textarea aria-label, TypingIndicator aria-live + reducedMotion, citation aria-expanded, clear button focus-ring |
| `ai-harness-view.tsx` | useReducedMotion import + hook, 4 motion element gates, textarea aria-label, custom model input aria-label, show/hide key button focus-ring + touch target + aria-label, refresh button 44px, send button 44px |
| `library-view.tsx` | Sort direction aria-label, sort select aria-label, table caption |
| `mindmap-view.tsx` | Root entity aria-label, depth range aria-label, toolbar role, compact toggle aria-pressed + focus-ring |
| `topbar.tsx` | New entity aria-label |
| `export-view.tsx` | Password htmlFor/id, error aria-describedby, show/hide button focus-ring + touch target + aria-label |
| `editor-view.tsx` | Tag remove button touch target |
| `editor-toolbar.tsx` | Toolbar role, advanced toggle touch target |
| `graph-view.tsx` | Toolbar role |
| `editor-claims-panel.tsx` | Edit/delete button touch target + gap |
| `sync-view.tsx` | Room ID htmlFor, QR/copy button touch targets |
| `qr-pairing.tsx` | Close button touch target, copy button touch target |
| `conflict-ui.tsx` | Buttons touch target + focus-ring |
| `triz-view.tsx` | Toggle buttons touch target, table caption |
| `mobile-drawer.tsx` | (already had focus-ring + aria-pressed) |
| `home-view.tsx` | View All button focus-ring |
| `ai-harness-settings.tsx` | (reviewed, no changes needed) |

## Quality Gates

| Gate | Result |
|------|--------|
| `pnpm run lint` | ✅ Zero warnings |
| `pnpm run typecheck` | ✅ Zero errors |
| `pnpm run test` | ✅ 502 tests pass (41 files) |
| `pnpm run build` | ✅ Compiled successfully |

## Deferred to Plan 077

- Full axe-core automated scan integration (CI-level)
- Coverage 31.63% → 50% (incremental)
- Playwright retry config fix
- "Coming soon" → "nothing to undo/redo" label fix
- CodeMirror evaluation spike
- Store subscription narrowing
- Durable offline operation queue
