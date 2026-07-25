# ADR 015: Mobile-First Responsive Strategy & Visualization Theming Contract

## Status
Implemented — Mobile-first responsive layout; Tailwind breakpoints; visualization theming in graph/mindmap views.

## Context
AGENTS.md mandates **mobile-first** design with interactive targets **≥ 44×44px**. The shell is responsive, but feature views are desktop-first and several rules are violated (all verified):

### Layout / viewport
- App shell and chat use `100vh` (`src/styles/layout.css:10-16`; `src/styles/features.css:92-103`) — ignores mobile dynamic viewport; composers/controls hide behind browser chrome.
- Viewport meta lacks `viewport-fit=cover` (`index.html:5`); safe-area insets unused on header/drawer.
- Search sidebar hidden below a wide **1200px** breakpoint (`layout.css:68-77`); nav "Search" opens the command palette on desktop but the search overlay on mobile (inconsistent).
- **Bug**: mobile drawer "Search" calls `setCurrentView('search')` but there is no `search` branch in `main-content`, so it routes to a blank view (`App.tsx:275-280` vs `App.tsx:177-256`; `SidebarNav.tsx:42,60-68`).

### Visualizations
- Graph/mind-map canvases force inline `600px`/`minHeight:600px` (`GraphView.tsx:412-416`; `MindMapView.tsx:441-442`), overriding `.viz-container { height: 60vh }` and overflowing short phones.
- Graph inspector is a fixed `360px` side panel (`features.css:424-436`) that covers/overflows phones — no bottom-sheet breakpoint.
- Mobile graph controls lose snapshot/export/layout/snapshot-mode because the drawer mounts `GraphControls` with partial props (`App.tsx:284-294` vs `GraphView.tsx:395-409`).
- Mind-map toolbar is a dense desktop bar with selects + chips + sync + export + keyboard hints; wraps/overflows on phones and shows keyboard hints on touch (`MindMapView.tsx:323-439`).
- Graph node/edge colors are hardcoded hex (see ADR 013), so non-DOM renderers (Sigma, MindElixir) don't follow the active theme.

### Touch targets below 44px
- `.filter-chip` 32px (`components.css:439-449`) — used for search filters and mind-map actions.
- `.source-chip-remove` 20px (`features.css:209-220`).
- `.close-button` 36px (`features.css:481-488`).
- `.layout-toggle button` 36px (`features.css:390-393`).
- `.input-clear-button` auto (`components.css:543-552`).

### Library
- 4-column desktop grid with no mobile card layout (`features.css:593-610`); virtualizer 64px estimate breaks if rows wrap (`LibraryView.tsx:63-68`).

## Decision
Adopt a **mobile-first responsive baseline** and a **CSS-token theming contract for non-DOM visualizations**.

### 1. Breakpoint scale (named constants, not magic numbers)
```
--bp-sm: 640px    (phone → large phone)
--bp-md: 768px    (tablet portrait)
--bp-lg: 1024px   (tablet landscape / small laptop)
--bp-xl: 1200px   (desktop with both sidebars)
```
- Re-evaluate the search sidebar hide point; provide a **tablet side-sheet** for search between `md` and `xl` so search is not modal-only on tablets.
- Make nav "Search" open the **same** search experience across desktop/tablet/mobile (fix the inconsistency + the dead-view bug).

### 2. Dynamic viewport + safe area
- Replace `100vh` shells with `100dvh` (fallback `100svh`/`100vh`).
- Add `viewport-fit=cover` to the viewport meta.
- Apply `env(safe-area-inset-*)` padding to mobile header, drawer, full-screen overlays, and bottom sheets.

### 3. Touch-target enforcement
Use a coarse-pointer media query so desktop can keep compact controls while touch gets ≥44px:
```css
@media (pointer: coarse) {
  .filter-chip, .close-button, .layout-toggle button,
  .input-clear-button, .source-chip-remove { min-height: 44px; min-width: 44px; }
}
```

### 4. Responsive visualization canvas
- Remove inline heights; size via CSS:
```css
.viz-container { min-height: clamp(360px, calc(100dvh - var(--header-height) - 160px), 720px); }
```
- Graph inspector becomes a **bottom sheet** (`<Overlay variant="sheet-bottom">`, ADR 014) below `--bp-md`.
- Mobile graph/mind-map controls move to a **compact action bar + bottom sheet** with **full action parity** to desktop (pass complete `GraphControls` props on mobile). Hide keyboard-shortcut hints under `--bp-md`.

### 5. Visualization theming contract
Non-DOM renderers must read theme values from CSS custom properties at render time and on theme change:
```ts
const cs = getComputedStyle(containerRef.current);
const nodeColor = cs.getPropertyValue('--graph-node-default').trim();
// re-apply Sigma node/edge reducers; re-render MindElixir on theme-change event
```
Token names are defined in ADR 013 (`--graph-*`). A theme-change broadcast (existing theme switcher) triggers re-read so colors stay in sync.

### 6. Library mobile layout
Below `--bp-sm`, hide the grid header and render each entity as a **card** (name + type/date metadata + action). Use dynamic row measurement in the virtualizer instead of a fixed 64px estimate when cards can vary in height.

## Alternatives Considered
- **JS `window.innerWidth` branching in render** (current pattern at `App.tsx:212`): rejected — not reactive to resize/orientation, causes hydration/SSR-style mismatches; prefer CSS + the existing `useMediaQuery` hook.
- **Single layout for all sizes**: rejected — violates mobile-first guardrails; visualizations are unusable on phones.
- **Bake theme colors into JS constants per theme**: rejected — duplicates token truth; ADR 013 makes CSS the source, read via `getComputedStyle`.

## Consequences
### Positive
- Every view usable at 320 / 390 / 768 / 1200px; visualizations adapt and stay on-theme.
- Touch targets meet the 44px rule on phones/tablets without bloating desktop density.
- Search reachable consistently across device classes; dead-view bug fixed.

### Negative
- Touches many CSS files and the two visualization components; needs device-class E2E.
- `GraphView.tsx` / `MindMapView.tsx` may approach the 500 LOC cap — extract control/inspector sub-components before extending.

## Implementation Notes
- Reuse the existing `useMediaQuery` hook; avoid `window.innerWidth` in render.
- Mobile inspector/control sheets use the `<Overlay>` primitive (ADR 014).
- Verification: manual device-class sweep (320/390/768/1200px) — no overflow, all actions reachable; `prefers-reduced-motion` honored; theme switch recolors graph and mind map; `tap-target` audit ≥44px on coarse pointer.

## Files Affected (implementation)
- `index.html`, `src/styles/layout.css`, `src/styles/components.css`, `src/styles/features.css`, `src/styles/tokens.css`
- `src/app/App.tsx`, `src/components/SidebarNav.tsx`, `src/components/Header.tsx`, `src/components/MobileDrawer.tsx`
- `src/features/graph/GraphView.tsx`, `src/features/graph/GraphControls.tsx`, `src/features/graph/GraphInspector.tsx`
- `src/features/mindmap/MindMapView.tsx`, `src/features/library/LibraryView.tsx`
