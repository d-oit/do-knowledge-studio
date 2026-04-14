# Design Audit Template

Fill this in during Step 6 (Layout Engineer Safety Audit) to identify layout risks and design slop.

## Component: _________________  Date: __________  Mode: ______________

### 1. Stability

- [ ] Anti-flicker tokens applied (`will-change-transform transform-gpu backface-visibility-hidden`)
- [ ] `overflow-x-hidden` on root container
- [ ] `overflow-y-auto` on content containers
- [ ] No nested `min-h-screen` in scrollable parents
- [ ] State transitions use presence guards (`AnimatePresence` + `mode="wait"`)

### 2. Responsiveness

- [ ] Horizontal nav uses `overflow-x-auto` at <768px
- [ ] No text cutoff at 375px (responsive font sizes: `text-2xl md:text-4xl`)
- [ ] All breakpoints tested: 375, 768, 1024, 1440
- [ ] No horizontal scroll on any viewport
- [ ] Tap targets ≥ 44px on mobile

### 3. Layout Integrity

- [ ] No absolute positioning for core layout (Flexbox/Grid only)
- [ ] HUDs/overlays have defined safe zones
- [ ] No overlapping elements at any breakpoint
- [ ] Navigation wraps or collapses correctly

### 4. Anti-Slop

- [ ] No Inter/DM Sans/Space Grotesk without justification
- [ ] No generic purple-blue gradients
- [ ] No three-column feature grid cliché
- [ ] No vague adjectives remaining (modern, clean, sleek)
- [ ] All taste words translated to concrete token values

### 5. Typography

- [ ] Body text ≥ 16px on mobile
- [ ] Heading font has character (not default sans)
- [ ] Mono role present for technical data
- [ ] Line-heights appropriate (tight for display, relaxed for body)

### 6. Color & Contrast

- [ ] All text meets WCAG AA (4.5:1 ratio)
- [ ] Semantic color roles used (no raw hex in components)
- [ ] Interactive states defined (hover, focus, disabled)

### Issues Found

| # | Severity | Description | Fix |
|---|----------|-------------|-----|
|   |          |             |     |

### Verdict

- [ ] **PASS** — No critical issues, safe to proceed
- [ ] **REVISE** — Issues found, returning to Step 3/5
- [ ] **BLOCK** — Fundamental architecture issue, restart required
