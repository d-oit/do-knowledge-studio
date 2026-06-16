# ADR 017: Motion System & Design Token Refresh

**Status**: ✅ Implemented
**Date**: 2026-06-16
**Source**: UI gap closure (Plan 041, PR #326)
**Deciders**: Engineering

## Context

The app had three legacy motion variables (`--motion-fast` / `--motion-base` / `--motion-slow`) mapped to `ease-in-out` — a single, physically unintuitive easing that makes UI feel robotic. There was no way to express:
- Different durations for different interaction types (press vs. overlay vs. page swap)
- Physically plausible easings (deceleration for entrances, acceleration for exits)
- Intentional waiting states (loaders)
- A11y `prefers-reduced-motion`

Separately, the CSS lacked safe-area-inset support for notched mobile devices, a drawer-width token for mobile overlays, and CSS hardening for mobile text zoom / horizontal overflow.

The changes scattered throughout components had no single source of truth for entrance/exit animations — some used inline `style={{ animation: ... }}`, others used disparate class names.

## Decision

### 1. Replace legacy motion tokens with six explicit durations

| Token | Value | Use |
|-------|-------|-----|
| `--duration-instant` | 80ms | Press feedback, focus rings, hover micro-shifts |
| `--duration-quick` | 150ms | Filter chip hover, list-item highlight |
| `--duration-base` | 200ms | Overlays (drawer, palette, sheet) entrance |
| `--duration-flow` | 280ms | Status messages, snackbars, list-item insert |
| `--duration-large` | 400ms | Page-level view swaps, layout reflows |
| `--duration-loader` | 800ms | Continuous waiting states (steady, not panicked) |

The three legacy tokens remain as aliases: `--motion-fast` → `--duration-quick`, `--motion-base` → `--duration-base`, `--motion-slow` → `--duration-large`.

### 2. Replace `ease-in-out` default with five curated easings

| Token | Curve | Use |
|-------|-------|-----|
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrance workhorse — decelerate |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Exit — accelerate |
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | Symmetric state swaps |
| `--ease-out-quart` | `cubic-bezier(0.25, 1, 0.5, 1)` | Sharper deceleration for confident arrivals |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Overshoot for tactile confirmations (sparing) |

### 3. Create `motion.css` as single source of truth for animations

Keyframes defined (all opted into via CSS class only):

| Keyframe | Class | Use |
|----------|-------|-----|
| `fade-in` / `fade-out` | `motion-fade-in` / `motion-fade-out` | Generic visibility |
| `rise-in` / `rise-out` | `motion-rise-in` / `motion-rise-out` | Content arrival (3-beat: appear, overshoot, settle) |
| `slide-from-left` / `slide-from-right` | `motion-slide-from-left` / `motion-slide-from-right` | Panel navigation |
| `sheet-up` | `motion-sheet-up` | Mobile search overlay |

Stagger groups for lists (`motion-stagger-1` through `motion-stagger-8` with 40ms delay increments).

All animations respect `prefers-reduced-motion: reduce` by disabling transition/animation at the `*` level.

### 4. Add utilities and hardening

- `--press-scale: 0.97` for consistent press feedback
- `--drawer-width: min(86vw, 320px)` mobile-first drawer
- `--safe-top/right/bottom/left` safe-area-inset tokens
- `* { min-width: 0 }` prevents horizontal overflow
- `-webkit-text-size-adjust: 100%` blocks iOS text zoom
- `will-change: transform` / `contain: layout style` on animated elements

## Alternatives

### A. Use a JS animation library (Framer Motion, GSAP)
- **Pros**: More expressiveness, spring physics, orchestration
- **Cons**: Bundle weight (+15-60 KB), JavaScript dependency, adds complexity for CSS animations that are inherently declarative and work with CSS transitions

### B. Keep legacy `ease-in-out` with three durations
- **Pros**: Simpler, less code
- **Cons**: Motion feels robotic; no way to differentiate press (80ms) from page swap (400ms); no reduced-motion support

### C. Use CSS `@media (prefers-reduced-motion: no-preference)` instead of `reduce`
- **Pros**: Default-is-animated
- **Cons**: Violates the "nothing animates by default" principle. Pages should arrive ready to use; motion explains state change.

## Consequences

### Positive
- Single source of truth for all entrance/exit animations — no more inline `style={{ animation: ... }}`
- Design tokens are documented and named by use case, not duration
- A11y-compliant: `prefers-reduced-motion: reduce` disables all motion
- Mobile-safe: safe-area insets, text zoom prevention, overflow prevention
- Backward-compatible: legacy `--motion-*` tokens preserved as aliases

### Negative
- Components must opt in by adding a CSS class — no automatic migration
- `var(--duration-*)` tokens are longer to type than the old `var(--motion-*)` aliases

### Neutral
- No new dependencies
- No runtime JavaScript cost — pure CSS

## Files Affected

| File | Change |
|------|--------|
| `src/styles/tokens.css` | Add 6 duration tokens, 5 easing tokens, press scale, drawer width, safe-area insets, CSS hardening |
| `src/styles/motion.css` | **New** — keyframes, utility classes, reduced-motion, stagger groups, performance hints |
| `src/styles/index.css` | Import `motion.css` |
| `src/styles/components.css` | Use new tokens in button/input/badge/filter-chip/card styles |
| `src/styles/features.css` | Use new tokens in graph/chat/editor/mindmap/export features |
| `src/styles/layout.css` | Use new tokens in sidebar/header/drawer grid styles |
| `src/styles/utilities.css` | Use new tokens, add motion utility classes |
| `src/styles/command-palette.css` | Use new motion tokens |
| `src/features/ai/ChatView.tsx` | `motion-rise-in` on messages and thinking indicator |
| `src/features/chat/Chat.tsx` | `motion-rise-in` on citation drawer, `motion-stagger` on nav-content |
| `src/features/editor/Editor.tsx` | `motion-rise-in` on advanced section |
| `src/components/SidebarNav.tsx` | `motion-stagger` on nav-content |
| `src/components/SyncToggle.tsx` | Remove inline styles, use CSS classes |
| `index.html` | `viewport-fit=cover` |

## Verification

```bash
# Tokens load correctly
grep -q "duration-flow" src/styles/tokens.css && grep -q "ease-out-quart" src/styles/tokens.css

# Motion CSS has keyframes
grep -c "@keyframes" src/styles/motion.css
# Expected: 7 (fade-in, fade-out, rise-in, rise-out, slide-from-left, slide-from-right, sheet-up)

# Reduced-motion query present
grep -q "prefers-reduced-motion" src/styles/motion.css

# No inline animation styles remain
grep -rn "style=.*animation\|style.*animation" src/features/ --include="*.tsx" || echo "✅ No inline animation styles"
```

## References

- Plan 041 (Gap Closure) — `plans/041-goap-remaining-gaps-tests-docs-logging-2026-06-16.md`
- PR #326 — `feat(plan-041+042): close gap-closure, add plan 042 + UI polish`
- CSS `prefers-reduced-motion` — MDN, "prefers-reduced-motion"
- Safe-area-inset — MDN, "env()" and "viewport-fit"
