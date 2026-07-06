---
name: do-knowledge-studio
description: >
  Local-first knowledge studio. KirriDesk-inspired clean SaaS aesthetic.
  One restrained accent color. Strong typographic hierarchy.
  Minimal decoration. Purposeful motion.

# All color values below mirror src/styles/tokens.css verbatim.
# That file is the source of truth; this frontmatter is the portable
# export for agents and scripts. If a token changes in tokens.css,
# update BOTH files.

themes: [light, dark]

colors:
  bg-base: "#f9fafb"
  bg-surface: "#ffffff"
  bg-sidebar: "#111827"
  bg-elevated: "#ffffff"
  bg-overlay: "rgba(17, 24, 39, 0.5)"
  bg-active: "#d1fae5"
  bg-hover: "#f3f4f6"
  text-primary: "#111827"
  text-secondary: "#6b7280"
  text-muted: "#9ca3af"
  text-inverse: "#ffffff"
  interactive-primary: "#10b981"
  interactive-primary-subtle: "#d1fae5"
  interactive-hover: "#059669"
  interactive-active: "#047857"
  interactive-disabled: "#d1d5db"
  status-success: "#10b981"
  status-warning: "#f59e0b"
  status-danger: "#ef4444"
  status-info: "#3b82f6"
  border-default: "#e5e7eb"
  border-subtle: "#f3f4f6"
  border-focus: "#10b981"
  border-error: "#ef4444"

  themes:
    light:
      bg-base: "#f9fafb"
      bg-surface: "#ffffff"
      bg-sidebar: "#111827"
      bg-active: "#d1fae5"
      bg-hover: "#f3f4f6"
      text-primary: "#111827"
      text-secondary: "#6b7280"
      interactive-primary: "#10b981"
      interactive-hover: "#059669"
      border-default: "#e5e7eb"
      radius-xl: "12px"
    dark:
      bg-base: "#111827"
      bg-surface: "#1f2937"
      bg-sidebar: "#0a0f1a"
      bg-active: "#064e3b"
      bg-hover: "#374151"
      text-primary: "#f9fafb"
      text-secondary: "#9ca3af"
      text-muted: "#6b7280"
      interactive-primary: "#34d399"
      interactive-hover: "#6ee7b7"
      border-default: "#374151"
      status-success: "#34d399"
      status-warning: "#fbbf24"
      status-danger: "#f87171"

typography:
  display:
    fontFamily: "'Inter', -apple-system, sans-serif"
    fontSize: "clamp(1.5rem, 5vw, 2.5rem)"
    fontWeight: 700
    letterSpacing: "-0.01em"
    lineHeight: 1.25
  heading:
    fontFamily: "'Inter', -apple-system, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'Inter', -apple-system, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: "'Courier New', ui-monospace, Consolas, monospace"
    fontSize: "13px"

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
  sm: "4px"
  base: "6px"
  md: "8px"
  lg: "12px"
  xl: "12px"
  full: "9999px"

layout:
  sidebar-width: "260px"
  search-sidebar-width: "320px"
  inspector-width: "360px"
  header-height: "56px"
  content-max-width: "1200px"

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

KirriDesk-inspired clean SaaS aesthetic for a local-first knowledge studio.
One restrained interactive accent color. Strong typographic hierarchy.
Minimal decoration. Purposeful motion. Two themes share the same
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

Two themes via `data-theme` attribute on `<html>`.
Token file: `src/styles/tokens.css`. Loaded via: `src/styles/index.css`.

| Theme | Character | Accent | Surface |
|---|---|---|---|
| `light` | Clean, professional | `#10b981` emerald | white on `#f9fafb` |
| `dark` | High-contrast dark | `#34d399` bright emerald | dark gray on `#111827` |

**Rule:** Any new color MUST be declared in both `[data-theme]` blocks
in `tokens.css` AND in this file's `colors.themes` frontmatter. Never
hardcode a hex value in a component or feature file.

## Typography

One font family, loaded from Google Fonts in `src/styles/index.css`:
- **Inter** (`--font-sans`): everything — body, UI, headings, labels
- **Courier New** (`--font-mono`): code blocks, `.mono-text`, `.data-text`

**Font Size Rule:** `input` and `select` MUST stay at `font-size: 16px`
(prevents iOS auto-zoom). Body and heading sizes should use `clamp()`
when possible — fixed px values are a known debt item.

## CSS Architecture

Current stack (import order matters):
```
tokens.css → layout.css → components.css → features.css →
command-palette.css → utilities.css
```

**Rules (enforce now):**
- All colors via `var(--token-name)` — no hardcoded hex in components
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

- [ ] All new colors added to both theme blocks in `tokens.css` AND `DESIGN.md` frontmatter
- [ ] No hardcoded hex/rgb in component or feature files
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
- Do not use `px` font sizes for body/heading (use `clamp()` or rem)
- Do not bypass the `design/` output contract from `stitch-design`
