# Design Tokens — do-knowledge-studio

> Source of truth: `src/styles/tokens.css`
> Grid base: **4px**
> Philosophy: Calm, intentional, readable. One restrained accent color. Minimal decoration. Purposeful motion.

## Color Tokens

### Surface Layering

| Token | Default | App | Game | Neural | Technical |
|-------|---------|-----|------|--------|-----------|
| `--bg-base` | `#f1f5f9` | `#f1f5f9` | `#0f172a` | `#faf5ff` | `#ffffff` |
| `--bg-surface` | `#ffffff` | `#ffffff` | `#1e293b` | `#ffffff` | `#ffffff` |
| `--bg-elevated` | `#ffffff` | `#ffffff` | `#1e293b` | `#ffffff` | `#f8fafc` |
| `--bg-overlay` | `rgba(15,23,42,0.45)` | — | — | — | — |
| `--bg-active` | `#e8f0fe` | `#e8f0fe` | `#1e3a5f` | `#f3e8ff` | `#f1f5f9` |

### Text

| Token | Value | Contrast |
|-------|-------|----------|
| `--text-primary` | `#0f172a` | AA+ on surface |
| `--text-secondary` | `#475569` | AA on surface |
| `--text-muted` | `#94a3b8` | decorative only |
| `--text-inverse` | `#ffffff` | AA+ on primary |

### Interaction

| Token | Value | Use |
|-------|-------|-----|
| `--interactive-primary` | `#2563eb` | Buttons, links, active states |
| `--interactive-primary-subtle` | `#e8f0fe` | Hover/focus backgrounds |
| `--interactive-hover` | `#1d4ed8` | Button hover, darker variant |
| `--interactive-active` | `#1e40af` | Active/pressed state |
| `--interactive-disabled` | `#cbd5e1` | Disabled controls |

### Status

| Token | Value | Meaning |
|-------|-------|---------|
| `--status-success` | `#059669` | green |
| `--status-warning` | `#d97706` | amber |
| `--status-danger` | `#dc2626` | red |
| `--status-info` | `#2563eb` | blue |

### Borders

| Token | Value | Use |
|-------|-------|------|
| `--border-default` | `#e2e8f0` | Card outlines, dividers |
| `--border-subtle` | `#f1f5f9` | Very subtle separators |
| `--border-focus` | `#2563eb` | Focus ring |
| `--border-error` | `#dc2626` | Validation error |

## Typography

### Font Families

| Token | Stack | Use |
|-------|-------|-----|
| `--font-sans` | `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` | Body, UI text |
| `--font-display` | `'Anton', sans-serif` | Headings, brand |
| `--font-mono` | `'Courier New', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` | Code, data |

### Sizes

| Token | Value | Use |
|-------|-------|-----|
| `--size-xs` | `11px` | Labels, captions |
| `--size-sm` | `13px` | Secondary text, metadata |
| `--size-body` | `15px` | Body text |
| `--size-lg` | `17px` | Lead body |
| `--size-heading` | `1.25rem` | Section headings |
| `--size-display` | `clamp(1.5rem, 5vw, 2.5rem)` | Hero/display text |

### Weights

| Token | Value |
|-------|-------|
| `--weight-normal` | `400` |
| `--weight-medium` | `500` |
| `--weight-semibold` | `600` |
| `--weight-bold` | `700` |

### Line Height

| Token | Value | Use |
|-------|-------|-----|
| `--leading-tight` | `1.25` | Headings |
| `--leading-normal` | `1.5` | Body |
| `--leading-relaxed` | `1.625` | Reading prose |

### Letter Spacing

| Token | Value | Use |
|-------|-------|------|
| `--tracking-tight` | `-0.01em` | Headings |
| `--tracking-normal` | `0` | Body |
| `--tracking-wide` | `0.05em` | Uppercase labels |

## Spacing (4px Grid)

| Token | Pixels | Rem | Use |
|-------|--------|-----|-----|
| `--space-1` | 4px | 0.25rem | Micro paddings |
| `--space-2` | 8px | 0.5rem | Tight gaps |
| `--space-3` | 12px | 0.75rem | Button padding |
| `--space-4` | 16px | 1rem | Card padding |
| `--space-5` | 20px | 1.25rem | Section gap |
| `--space-6` | 24px | 1.5rem | Panel gap |
| `--space-8` | 32px | 2rem | Large gap |
| `--space-10` | 40px | 2.5rem | Section margin |
| `--space-12` | 48px | 3rem | Major gap |
| `--space-16` | 64px | 4rem | Page padding |

## Border Radius

| Token | Value | Use |
|-------|-------|------|
| `--radius-sm` | 2px | Chips, tags |
| `--radius-base` | 4px | Buttons, inputs |
| `--radius-md` | 8px | Cards, panels |
| `--radius-lg` | 12px | Modals, dialogs |
| `--radius-xl` | 16px | Sheets, drawers |
| `--radius-full` | 9999px | Pill, avatar |

**Technical theme** overrides all radii to `0px`.

## Elevation

| Token | Value | Use |
|-------|-------|------|
| `--shadow-sm` | `0 1px 2px rgba(15,23,42,0.06)` | Hover states |
| `--shadow-md` | `0 4px 12px rgba(15,23,42,0.08)` | Cards, panels |
| `--shadow-lg` | `0 8px 24px rgba(15,23,42,0.1)` | Modals, popovers |

**Technical theme** overrides all shadows to `none`.

## Motion

### Durations

| Token | Value | Use |
|-------|-------|------|
| `--duration-instant` | 80ms | Press feedback, focus rings, hover micro-shifts |
| `--duration-quick` | 150ms | Filter chip hover, list-item highlight |
| `--duration-base` | 200ms | Overlays (drawer, palette, sheet) entrance |
| `--duration-flow` | 280ms | Status messages, snackbars, list inserts |
| `--duration-large` | 400ms | Page-level view swaps, layout reflows |
| `--duration-loader` | 800ms | Continuous waiting states (steady, not panicked) |

### Easings

| Token | Curve | Physics | Use |
|-------|-------|---------|------|
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Decelerate | Entrance workhorse |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Accelerate | Exits |
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | Symmetric | State swaps |
| `--ease-out-quart` | `cubic-bezier(0.25, 1, 0.5, 1)` | Sharper decel | Confident arrivals |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Overshoot | Tactile confirmations (sparing) |

### Legacy Aliases

| Alias | Maps To |
|-------|---------|
| `--motion-fast` | `--duration-quick` |
| `--motion-base` | `--duration-base` |
| `--motion-slow` | `--duration-large` |

### Press Scale

`--press-scale: 0.97` — used in `:active` transforms for button press feedback.

### Animated Classes

Defined in `src/styles/motion.css`. Components opt in by adding a class.

| Class | Keyframe | Use |
|-------|----------|-----|
| `.motion-fade-in` | `fade-in` (0→1 opacity) | Generic entrance |
| `.motion-fade-out` | `fade-out` (1→0 opacity) | Generic exit |
| `.motion-rise-in` | `rise-in` (3-beat: appear, overshoot, settle) | Content arrival |
| `.motion-rise-out` | `rise-out` | Content departure |
| `.motion-slide-from-left` | `slide-from-left` | Panel nav |
| `.motion-slide-from-right` | `slide-from-right` | Panel nav |
| `.motion-sheet-up` | `sheet-up` | Mobile overlay |
| `.motion-stagger-N` | 40ms delay per item | Staggered lists |
| `.motion-stagger` | 40ms delay | Staggered children |

All animations respect `prefers-reduced-motion: reduce` (disabled).

## Layout

| Token | Value | Use |
|-------|-------|------|
| `--sidebar-width` | `260px` | Main navigation sidebar |
| `--search-sidebar-width` | `300px` | Right search panel |
| `--header-height` | `56px` | Top header bar |
| `--content-max-width` | `960px` | Main content area |
| `--drawer-width` | `min(86vw, 320px)` | Mobile drawer overlays |

### Safe-area Insets

| Token | Source | Fallback |
|-------|--------|----------|
| `--safe-top` | `env(safe-area-inset-top)` | `0px` |
| `--safe-right` | `env(safe-area-inset-right)` | `0px` |
| `--safe-bottom` | `env(safe-area-inset-bottom)` | `0px` |
| `--safe-left` | `env(safe-area-inset-left)` | `0px` |

Used for notched devices. Always check `@supports (padding-top: env(safe-area-inset-top))` if applying conditionally.

## Theme Variants

| Theme | Selector | Character |
|-------|----------|-----------|
| App | `[data-theme='app']` | Professional, light, blue accent |
| Game | `[data-theme='game']` | Dark, high contrast, cyan accent |
| Neural | `[data-theme='neural']` | Warm, soft, purple accent |
| Technical | `[data-theme='technical']` | Brutalist, black & white, zero radius |

Each theme overrides a subset of tokens (surface, text, interactive, border). Tokens not listed in a theme block fall through to the `:root` defaults.

## Usage

```css
/* Good — uses tokens */
.button {
  background: var(--interactive-primary);
  color: var(--text-inverse);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-base);
  transition: opacity var(--duration-instant) var(--ease-out);
}

/* Bad — hardcoded values */
.button {
  background: #2563eb;
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
}
```

Always use tokens. Never hardcode values.

## Verification

```bash
# No hardcoded hex values in component CSS (token overrides in tokens.css are exempt)
grep -rn '#[0-9a-fA-F]\{6\}' src/styles/components.css src/features/*.css || echo "✅ No hardcoded colors"

# No hardcoded px values (common offenders)
grep -rn 'border-radius: [0-9]' src/styles/components.css || echo "✅ No hardcoded radii"
```

## References

- Source tokens: `src/styles/tokens.css`
- Motion system: `src/styles/motion.css`
- Motion ADR: `plans/ADRs/017-motion-system-design-tokens.md`
