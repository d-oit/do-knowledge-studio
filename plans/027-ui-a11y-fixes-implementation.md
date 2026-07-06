# Plan 027: UI & Accessibility Fixes — Implementation Order

> 14 confirmed fixes with prioritized ordering, grouping, and verification strategy.

## Prioritized Implementation Order

### Phase 1 — Quick Wins (CSS-only, zero risk)

**Item 3: Add `color-scheme: dark` to game theme**
- File: `src/styles/tokens.css:178` — `[data-theme='game']` block
- Change: Add `color-scheme: dark;` inside the block (~1 LOC)
- Risk: Negligible — only affects native form/scrollbar styling
- Verify: Inspect `<html>` computed styles in DevTools; native inputs should use dark chrome
- **Standalone commit** — trivial, self-contained

**Item 4: Fix `--glass-bg` transparency**
- File: `src/styles/tokens.css:157` — root `--glass-bg: rgba(255, 255, 255, 0.01)`
- Change: Raise root value to `rgba(255, 255, 255, 0.6)`. This fixes both `app` and `technical` themes (neither overrides `--glass-bg`). The `game` theme (line 211) and `neural` theme (line 250) already have their own overrides and are unaffected.
- Risk: Low — visual change only; `backdrop-filter: blur()` in `src/styles/utilities.css:43` already wired
- Verify: Compare glass surfaces (sidebar, modals) before/after; blur should be visible
- **Standalone commit** — visual fix only

**Item 8: Add non-color active indicator to SidebarNav**
- File: `src/styles/components.css:188-193` — `.nav-button.active`
- Change: Add `border-left: 3px solid var(--interactive-primary);` and adjust `padding-left` from current to `calc(current - 3px)` (~2 LOC)
- Risk: Negligible — additive CSS
- Verify: Toggle nav items; border-left visible regardless of color scheme
- **Group with Item 7** (both SidebarNav changes)

### Phase 2 — Accessibility Attributes (low risk, high impact)

**Item 5: Add `role="alert"` to error screen**
- File: `src/app/App.tsx:165` — `<div className="error-screen">`
- Change: Add `role="alert"` and `aria-live="assertive"` (~1 LOC)
- Risk: Negligible — additive attributes
- Verify: Trigger an error; screen reader should announce it
- **Group with Item 1** (both App.tsx changes)

**Item 6: Add `aria-busy` to skeleton regions**
- File: `src/components/Skeletons.tsx` — six skeleton components
- Change: Add `aria-busy="true"` to each `<div className="skeleton-layout">` wrapper (~6 LOC)
- Risk: Negligible — additive attributes
- Verify: Inspect DOM during loading; `aria-busy="true"` present on skeleton containers
- **Standalone commit** — pure a11y, no visual change

**Item 9: Add desktop page title with `aria-live`**
- Files: `src/components/Header.tsx`, `src/app/App.tsx:169-172`
- Change: Add a visually-hidden `<h1 aria-live="polite">` in the main content area reflecting `currentView`. Use existing `sr-only` pattern or add `.visually-hidden` utility. (~8 LOC across 2 files)
- Risk: Low — no visual impact; screen reader only
- Verify: Change views; screen reader announces new page title
- **Standalone commit** — a11y enhancement

### Phase 3 — React Component Fixes (moderate risk)

**Item 1: Fix `window.innerWidth` anti-pattern**
- File: `src/app/App.tsx:216` — `hideToolbar={window.innerWidth < 768}`
- Change: Import `useMediaQuery` from `src/hooks/useMediaQuery.ts`, add `const isMobile = useMediaQuery('(max-width: 768px)')` in component body, replace with `hideToolbar={isMobile}` (~3 LOC)
- Risk: Low — existing hook is well-tested; replaces non-reactive check with reactive one
- Verify: Resize browser across 768px breakpoint; toolbar should toggle correctly
- **Group with Item 5** (both App.tsx changes)

**Item 2: Add `prefers-color-scheme` auto-init**
- File: `src/components/ThemeSwitcher.tsx:42-51` — `getStoredTheme()`
- Change: When no stored theme, check `window.matchMedia('(prefers-color-scheme: dark)').matches` and default to `'game'` if true, `'app'` otherwise (~4 LOC)
- Risk: Low — only affects first-visit default; existing stored themes preserved
- Verify: Clear localStorage, set OS to dark mode, reload → should default to Tactical theme
- **Standalone commit** — theme behavior change

**Item 7: Add icons to SidebarNav NavItem**
- File: `src/components/SidebarNav.tsx` — NavItem interface, NAV_GROUPS, rendering
- Change:
  - Add `icon?: LucideIcon` to NavItem interface
  - Import icons from `lucide-react` (FileText, Library, GitBranch, BrainCircuit, Search, MessageSquare, Download, FlaskConical, Grid3x3)
  - Add icon to each NAV_GROUPS entry
  - Render `{item.icon && <item.icon size={18} />}` before label (~15 LOC)
- Risk: Low — `lucide-react` already a dependency; additive change
- Verify: Icons visible beside each nav label; no layout breakage
- **Group with Item 8** (both SidebarNav changes)

### Phase 4 — CSS Layout Fixes (moderate risk, visual regression potential)

**Item 10: Fix chat height magic constants**
- File: `src/styles/features.css:96-103`
- Change: Replace `height: calc(100dvh - 120px)` with `flex: 1; min-height: 0;` and ensure parent is `display: flex; flex-direction: column; height: 100%`. Remove mobile media query override (~4 LOC changed)
- Risk: Medium — layout change; test on mobile + desktop
- Verify: Chat view fills available space; no overflow on small screens; keyboard dismiss works
- **Standalone commit** — layout behavior change

**Item 11: Fix inspector-panel `70vh`**
- File: `src/styles/features.css:623`
- Change: Replace `height: 70vh` with `height: clamp(300px, 60dvh, 80vh)` (~1 LOC)
- Risk: Low — responsive improvement; fallback safe
- Verify: Open inspector on mobile; panel should be usable at all viewport heights
- **Standalone commit** — single CSS property

### Phase 5 — Dependency & CI (higher risk, separate concerns)

**Item 12: Remove phantom dependencies**
- File: `package.json:51,54` — `@huggingface/transformers`, `@react-pdf/renderer`
- Change: Remove both lines, run `pnpm install` to update lockfile (~2 lines removed + lockfile update)
- Risk: Medium — must confirm zero imports exist (confirmed: never imported)
- Verify: `pnpm install` succeeds; `pnpm run build` passes; bundle size decreases
- **Standalone commit** — dependency change, lockfile update

**Item 13: Add Lighthouse CI to GitHub Actions**
- File: `.github/workflows/ci-and-labels.yml`
- Change: Add a `lighthouse` job using `treosh/lighthouse-ci-action@v13` after `e2e-tests`. Needs build step first. (~25 LOC YAML)
- Risk: Low — additive CI job; doesn't block merge
- Verify: Push branch; Lighthouse job runs and uploads report
- **Separate PR** — CI infrastructure change

**Item 14: Add axe accessibility scanning to E2E tests**
- Files: `package.json` (add `@axe-core/playwright` devDep), new test file `tests/e2e/accessibility.spec.ts`
- Change:
  - Add `@axe-core/playwright` to devDependencies
  - Create `tests/e2e/accessibility.spec.ts` with basic axe scan on smoke routes (~30 LOC)
- Risk: Low — additive test; may surface existing violations
- Verify: `pnpm run test:e2e` passes; axe report shows no critical violations
- **Separate PR** — new test infrastructure

---

## Commit Grouping Summary

| Commit | Items | Description |
|--------|-------|-------------|
| 1 | 3 | `color-scheme: dark` for game theme |
| 2 | 4 | Fix glass-bg transparency |
| 3 | 8, 7 | SidebarNav: icons + active indicator |
| 4 | 5, 1 | App.tsx: error role + media query fix |
| 5 | 6 | Skeleton aria-busy |
| 6 | 9 | Desktop page title |
| 7 | 2 | prefers-color-scheme auto-init |
| 8 | 10 | Chat flex layout |
| 9 | 11 | Inspector clamp height |
| 10 | 12 | Remove phantom deps |
| **PR-A** | 13 | Lighthouse CI |
| **PR-B** | 14 | axe E2E tests |

## LOC Estimates

| Item | LOC Δ | Type |
|------|-------|------|
| 3 | +1 | CSS |
| 4 | +1 | CSS |
| 8 | +2 | CSS |
| 7 | +15 | TSX |
| 5 | +2 | TSX |
| 6 | +6 | TSX |
| 9 | +8 | TSX + CSS |
| 1 | +3 | TSX |
| 2 | +4 | TSX |
| 10 | +2/-4 | CSS |
| 11 | +1/-1 | CSS |
| 12 | -2 | JSON |
| 13 | +25 | YAML |
| 14 | +30 | TS + JSON |

**Total: ~100 LOC net change across 10 files + 2 new files**

## Verification Checklist

After all commits:
1. `pnpm run lint` — zero warnings
2. `pnpm run typecheck` — clean
3. `pnpm run test` — all pass
4. `pnpm run build` — success, bundle smaller (after dep removal)
5. `pnpm run test:e2e` — all pass (including new axe test)
6. Manual: resize across 768px, toggle themes, check glass surfaces, inspect skeletons in DevTools
