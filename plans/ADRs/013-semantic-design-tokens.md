# ADR 013: Semantic Design Tokens & Complete Theme Coverage

## Status
PROPOSED (2026-06-18) — Implementation tracked in `plans/041-goap-ui-ux-modernization-and-feature-gaps-2026-06-18.md` (G-TOKENS, G-PRIMITIVES, G-MOTION).

## Context
The studio has a 4px-grid token layer in `src/styles/tokens.css` with four themes (`app`, `game`, `neural`, `technical`). The system is good but incomplete, and several components bypass it:

1. **Undefined token references** (verified):
   - `--border-color` used in `src/features/search/SearchPanel.tsx:270,296` — the canonical token is `--border-default` (`tokens.css:41`). With no fallback the border declaration is invalid and disappears.
   - `--surface-primary` / `--surface-secondary` used in `src/features/ai/ChatView.tsx:29,31` and `src/features/ai/AIHarness.tsx:203` — canonical tokens are `--bg-surface` / `--bg-base`. Tool-call/setting backgrounds render transparent across themes.

2. **Partial theme overrides**: `[data-theme='game']` (`tokens.css:123-135`) and others override only a subset of semantic tokens. `--text-muted`, `--bg-overlay`, `--interactive-disabled`, `--status-*`, `--border-focus`, `--border-error`, `--border-subtle`, and shadows inherit light-mode values in dark/high-contrast themes.

3. **Hardcoded colors bypassing themes**:
   - Graph nodes/edges: `src/features/graph/GraphView.tsx:182-188,219-225,256-259` (`#2563eb`, `#ef4444`, `#8b5cf6`, `#94a3b8`, `#7c3aed`).
   - Status messages: `src/styles/utilities.css:23-32` (`#dcfce7`, `#fee2e2`).
   - Knowledge claims: `src/styles/features.css:267-278`.
   - Type badges: `src/styles/features.css:650-653`.

4. **No reduced-motion policy**: spinner (`utilities.css:91-98`), skeleton pulse (`utilities.css:100-108`), and chat smooth-scroll (`ChatView.tsx:95-97`) ignore `prefers-reduced-motion`.

5. **Off-token raw values** scattered across feature CSS and inline styles (`3px`, `6px`, `10px`, `13px`, etc.).

## Decision
Adopt a **complete semantic token system** as the single styling source of truth, and forbid undefined-token references and hardcoded colors in feature components.

### 1. Fix undefined tokens
Add intentional aliases in `tokens.css` so legacy references resolve, then migrate call sites to canonical names:

```css
:root {
  --border-color: var(--border-default);   /* alias — migrate call sites, then remove */
  --surface-primary: var(--bg-surface);
  --surface-secondary: var(--bg-base);
}
```

### 2. Add semantic token families
Define and theme these (per the four themes, with intentional fallbacks documented):

```css
/* Status surfaces */
--status-success-bg / --status-success-border
--status-warning-bg / --status-warning-border
--status-danger-bg  / --status-danger-border
--status-info-bg    / --status-info-border

/* Entity type identity */
--entity-note-bg / --entity-note-text
--entity-concept-bg / --entity-concept-text
--entity-person-bg / --entity-person-text
--entity-project-bg / --entity-project-text

/* Visualization (consumed by Sigma/MindElixir via getComputedStyle — see ADR 015) */
--graph-node-default / --graph-node-selected / --graph-node-fixed / --graph-node-snapshot
--graph-edge-default / --graph-edge-snapshot

/* Control sizing & layering */
--control-height-sm / --control-height-md / --control-height-lg
--z-header / --z-sidebar / --z-overlay / --z-modal / --z-popover
--focus-ring
```

### 3. Per-theme completeness rule
Each theme block must either override every semantic token or rely on an explicitly documented base fallback. A CI-style grep check (not a new lint config) verifies no feature component references an undefined token.

### 4. Reduced-motion policy
Add one global block:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```
Gate JS smooth-scroll with `matchMedia('(prefers-reduced-motion: reduce)')`.

### 5. UI primitive layer (token-governed)
Introduce small primitives (`Button`, `IconButton`, `Toolbar`/`ToolbarButton`, `EmptyState`, `ErrorState`, `Skeleton`) so repeated inline styles in Editor, ChatView, MindMapView, SearchPanel, GraphControls collapse onto tokens. Primitives are local CSS + TSX — **no new dependency**.

## Alternatives Considered
- **Adopt Tailwind / a CSS-in-JS lib**: rejected — large migration, conflicts with existing token CSS, adds a dependency, violates "reuse existing abstractions."
- **Leave undefined tokens with inline fallbacks**: rejected — hides theme drift and keeps colors hardcoded.
- **Only fix the two undefined tokens**: rejected — does not address theme coverage or hardcoded graph/status colors.

## Consequences
### Positive
- All four themes render consistently, including dark/high-contrast.
- Graph/status/badges adapt to themes via tokens.
- Accessibility improves (reduced motion, focus ring token).
- Inline-style drift collapses into reusable primitives.

### Negative
- One-time migration touching several CSS files and feature components.
- Temporary alias tokens must be tracked and removed after migration.

## Implementation Notes
- Do **not** modify `biome.json` / `eslint.config.js`.
- Keep `src/styles/*.css` and any split component under the 500 LOC rule.
- Verification: `grep -rn "var(--border-color)\|--surface-primary\|--surface-secondary" src/` returns nothing after migration; theme switch recolors graph; `prefers-reduced-motion` disables spin/skeleton/smooth-scroll.

## Files Affected (implementation)
- `src/styles/tokens.css`, `src/styles/utilities.css`, `src/styles/components.css`, `src/styles/features.css`
- `src/features/search/SearchPanel.tsx`, `src/features/ai/ChatView.tsx`, `src/features/ai/AIHarness.tsx`, `src/features/graph/GraphView.tsx`
- NEW `src/components/ui/*` primitives
