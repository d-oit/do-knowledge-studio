---
name: do-knowledge-studio
description: >
  Local-first knowledge studio. Calm, intentional, readable.
  One restrained accent per theme. Strong typographic hierarchy.
  Minimal decoration. Purposeful motion.

# All color values below mirror src/styles/tokens.css verbatim.
# That file is the source of truth; this frontmatter is the portable
# export for agents and scripts. If a token changes in tokens.css,
# update BOTH files.

themes: [app, game, neural, technical]

colors:
  bg-base: "#f1f5f9"
  bg-surface: "#ffffff"
  bg-elevated: "#ffffff"
  bg-overlay: "rgba(15, 23, 42, 0.45)"
  bg-active: "#e8f0fe"
  text-primary: "#0f172a"
  text-secondary: "#475569"
  text-muted: "#94a3b8"
  text-inverse: "#ffffff"
  interactive-primary: "#2563eb"
  interactive-primary-subtle: "#e8f0fe"
  interactive-hover: "#1d4ed8"
  interactive-active: "#1e40af"
  interactive-disabled: "#cbd5e1"
  status-success: "#059669"
  status-warning: "#d97706"
  status-danger: "#dc2626"
  status-info: "#2563eb"
  border-default: "#e2e8f0"
  border-subtle: "#f1f5f9"
  border-focus: "#2563eb"
  border-error: "#dc2626"

  themes:
    app:
      bg-base: "#f1f5f9"
      bg-surface: "#ffffff"
      bg-active: "#e8f0fe"
      text-primary: "#0f172a"
      text-secondary: "#475569"
      interactive-primary: "#2563eb"
      interactive-hover: "#1d4ed8"
      border-default: "#e2e8f0"
      radius-xl: "32px"
    game:
      bg-base: "#0f172a"
      bg-surface: "#1e293b"
      bg-active: "#1e3a5f"
      text-primary: "#f1f5f9"
      text-secondary: "#94a3b8"
      text-muted: "#64748b"
      interactive-primary: "#38bdf8"
      interactive-hover: "#7dd3fc"
      border-default: "#334155"
      status-success: "#34d399"
      status-warning: "#fbbf24"
      status-danger: "#f87171"
    neural:
      bg-base: "#faf5ff"
      bg-surface: "#ffffff"
      bg-active: "#f3e8ff"
      text-primary: "#1a1a2e"
      text-secondary: "#6b21a8"
      text-muted: "#a78bfa"
      interactive-primary: "#7c3aed"
      interactive-hover: "#6d28d9"
      border-default: "#e9d5ff"
    technical:
      bg-base: "#ffffff"
      bg-surface: "#ffffff"
      text-primary: "#000000"
      text-secondary: "#334155"
      interactive-primary: "#000000"
      border-default: "#000000"
      radius-sm: "0px"
      radius-base: "0px"
      radius-md: "0px"
      radius-lg: "0px"
      radius-xl: "0px"
      shadow-sm: "none"
      shadow-md: "none"
      shadow-lg: "none"

typography:
  display:
    fontFamily: "'Anton', sans-serif"
    fontSize: "clamp(1.5rem, 5vw, 2.5rem)"
    fontWeight: 400
    textTransform: "uppercase"
    letterSpacing: "-0.02em"
    lineHeight: 1.1
  heading:
    fontFamily: "'Playfair Display', Georgia, serif"
    fontStyle: "italic"
    fontSize: "1.25rem"
    fontWeight: 600
    letterSpacing: "-0.01em"
  subheading:
    fontFamily: "'Inter', system-ui, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 600
    textTransform: "uppercase"
    letterSpacing: "0.05em"
  body:
    fontFamily: "'Inter', -apple-system, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: "'Courier New', ui-monospace, Consolas, monospace"
    fontSize: "12px"

spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
  10: "40px"
  12: "48px"
  16: "64px"

radius:
  sm: "2px"
  base: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"

layout:
  sidebar-width: "260px"
  search-sidebar-width: "300px"
  header-height: "56px"
  content-max-width: "960px"

motion:
  fast: "100ms ease-out"
  base: "200ms ease-in-out"
  slow: "300ms ease-in-out"

components:
  button:
    minHeight: "44px"
    borderRadius: "{radius.base}"
    fontWeight: 600
    fontSize: "14px"
  input:
    minHeight: "44px"
    fontSize: "16px"
    borderRadius: "{radius.base}"
  control-height-sm: "32px"
  control-height-md: "40px"
  control-height-lg: "48px"
---

# Design System — do-knowledge-studio

## Overview

A calm, intentional design system for a local-first knowledge studio.
One restrained interactive accent per theme. Strong typographic hierarchy.
Minimal decoration. Purposeful motion. All four themes share the same
token vocabulary — only values change, never token names.

**Source of truth for tokens:** `src/styles/tokens.css`
This `DESIGN.md` frontmatter mirrors it verbatim. If you change a value
in `tokens.css`, run `pnpm run design:validate` — it will fail if the
two files drift.

## Linked Agent Skills

| Skill | Path | When to invoke |
|---|---|---|
| impeccable | `.agents/skills/impeccable/` | Any CSS or component polish/critique |
| stitch-design | `.agents/skills/stitch-design/` | New component scaffolding |
| ui-ux-optimize | `.agents/skills/ui-ux-optimize/` | Performance or UX review swarm |
| accessibility-auditor | `.agents/skills/accessibility-auditor/` | Before every PR merge |
| reader-ui-ux | `.agents/skills/reader-ui-ux/` | Editor / reading surface work |
| validation-checklist | `.agents/skills/validation-checklist/` | Pre-commit design gate |

## Theme System

Four themes via `data-theme` attribute on `<body>` or root element.
Token file: `src/styles/tokens.css`. Loaded via: `src/styles/index.css`.

| Theme | Character | Accent | Surface |
|---|---|---|---|
| `app` | Professional, light | `#2563eb` blue | white on `#f1f5f9` |
| `game` | Dark, high contrast | `#38bdf8` sky | dark slate |
| `neural` | Soft, purple | `#7c3aed` violet | white on `#faf5ff` |
| `technical` | Brutalist mono | `#000000` black | white, zero radius |

**Rule:** Any new color MUST be declared in all four `[data-theme]` blocks
in `tokens.css` AND in this file's `colors.themes` frontmatter. Never
hardcode a hex value in a component or feature file.

## Typography

Three font faces, loaded from Google Fonts in `src/styles/index.css`:
- **Anton** (`--font-display`): h1, `.display-text` only — uppercase, weight 400
- **Playfair Display**: h2, `.serif-heading` only — italic, weight 600
- **Inter** (`--font-sans`): everything else — body, UI, labels
- **Courier New** (`--font-mono`): code blocks, `.mono-text`, `.data-text`

**The Two-Face Rule:** Anton is for display/hero only. Playfair for
section h2. Inter for all UI text. Never use a display face below `1.2rem`.

**Font Size Rule:** `input` and `select` MUST stay at `font-size: 16px`
(prevents iOS auto-zoom). Body and heading sizes should use `clamp()`
when possible — fixed px values are a known debt item.

## CSS Architecture

Current stack (import order matters):
```
tokens.css → layout.css → components.css → features.css →
command-palette.css → utilities.css
```

**Known debt to pay off progressively:**
- No `@layer` yet — add as files are touched
- Components use `@media` viewport queries — migrate to container queries
- Some hardcoded hex in `components.css` (theme preview cards)
- `!important` in `.btn-primary` — remove when cascade is fixed

**Rules (enforce now):**
- All colors via `var(--token-name)` — no hardcoded hex in components
- No `!important` except `.btn-primary` (flagged for removal)
- All interactive elements: `min-height: 44px`
- Focus rings via `box-shadow: 0 0 0 2px var(--border-focus)` — never `outline: none` without a replacement

## Spacing

4px grid. Scale: `--space-1` (4px) through `--space-16` (64px).
Use only tokens from the scale — no `margin: 6px` or similar off-grid values.

## Components

Design inventory (all in `src/styles/components.css` + `src/styles/features.css`):

**Primitive classes (do not reinvent):**
- `.btn-primary`, `.btn-secondary` — primary and secondary buttons
- `.icon-button` — 44×44 transparent icon button
- `.filter-chip` / `.filter-chip.active` — tag filters
- `.nav-button` / `.nav-button.active` — sidebar navigation items
- `.theme-card` — theme selector card
- `.search-result-item` — search list entry
- `.no-results-state` — empty state block
- `.provenance-tag` — `.tag-verified`, `.tag-draft`, `.tag-experimental`

**Components in `src/features/`:**
- Entity cards, graph nodes, mind-map nodes, TipTap editor toolbar

## PR Design Checklist

Agents MUST verify before merging any CSS or TSX change:

- [ ] All new colors added to all 4 theme blocks in `tokens.css` AND `DESIGN.md` frontmatter
- [ ] No hardcoded hex/rgb in component or feature files
- [ ] No `!important` (except flagged `.btn-primary` legacy)
- [ ] All interactive elements have `min-height: 44px`
- [ ] `aria-label` on all icon-only buttons
- [ ] Focus ring present (via `box-shadow`) on all interactive elements
- [ ] `prefers-reduced-motion` respected for all transitions
- [ ] Input/select `font-size` stays at `16px` (no iOS zoom)
- [ ] `pnpm run design:validate` passes (token sync check)
- [ ] `pnpm run lint` passes (includes `eslint-plugin-jsx-a11y`)

## Do and Do Not

### Do
- Use `var(--token-name)` for every color, spacing, radius, shadow
- Use the primitive classes before writing new ones
- Use `min-height: 44px` on every interactive element
- Add `aria-label` to icon-only buttons
- Gate all transitions on `prefers-reduced-motion`
- Keep `font-size: 16px` on inputs

### Do Not
- Do not hardcode hex values in `src/components/` or `src/features/`
- Do not add new font families without a token and a design decision
- Do not use `outline: none` without a visible focus replacement
- Do not add themes without updating all four `[data-theme]` blocks
- Do not use `px` font sizes for body/heading (use `clamp()` or rem)
- Do not bypass the `design/` output contract from `stitch-design`
