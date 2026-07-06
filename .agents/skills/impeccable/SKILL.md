---
name: impeccable
description: >
  Canonical skill for frontend UI design, visual polish, and UX critique.
  Prevents common AI design patterns and produces distinctive, high-quality
  frontend design. Covers typography, color, spacing, layout, motion, and
  interaction. Use for design polish, critique, audit, and responsive work.
---

# Impeccable — Frontend Design Skill

> Canonical skill for general frontend UI design, visual polish, and UX critique.
> KirriDesk-inspired clean SaaS aesthetic with emerald accent.

## Purpose

Prevent common AI design patterns and produce high-quality, distinctive frontend design. Use this skill for:
- Visual hierarchy and typography improvements
- Color palette and contrast refinement
- Layout, spacing, and alignment polish
- Motion and micro-interaction design
- UX writing and copy critique
- Responsive design across breakpoints

## When to Activate

Trigger on requests like:
- "Make this look better" / "Polish the UI"
- "Improve the design" / "Visual hierarchy"
- "Typography" / "Color palette" / "Spacing"
- "Critique this design" / "Design review"
- "Make it responsive" / "Mobile layout"
- `/impeccable`, `/polish`, `/critique`, `/audit`

## When NOT to Activate

- **Accessibility audits** → use `accessibility-auditor`
- **Anti-AI-slop copy** → use `anti-ai-slop`
- **Headless design system** → use `stitch-design`
- **UI/UX optimization swarm** → use `ui-ux-optimize`

---

## Design Principles

### Typography
- Use the project's design tokens from `src/styles/tokens.css`
- Font: Inter (clean sans-serif for SaaS aesthetic)
- Scale: `--size-xxs` (10px) through `--size-3xl` (30px)
- Line height: 1.5 for body, 1.25 for headings
- No `font-weight: 300` on small text (poor readability)
- Input/select MUST stay at `font-size: 16px` (prevents iOS zoom)

### Color
- Use CSS custom properties (`var(--text-primary)`, etc.)
- No pure black (`#000`) or pure white (`#fff`) — use tinted neutrals
- Minimum 4.5:1 contrast ratio for body text (WCAG AA)
- Use design tokens for all colors, no hardcoded hex values
- Accent: Emerald green (`#10b981` light, `#34d399` dark)
- Two themes only: `light` and `dark`

### Spacing
- Use the project's spacing scale (`var(--space-1)` through `var(--space-16)`)
- 4px grid alignment
- Minimum 44x44px touch targets
- Generous whitespace between sections

### Layout
- Mobile-first responsive design
- Breakpoints: mobile (< 768px), tablet (768–1100px), desktop (> 1100px)
- Max content width: 1200px
- Three-panel layout: sidebar (260px), main, detail

### Motion
- Use tokens: `--motion-fast` (100ms), `--motion-base` (200ms), `--motion-slow` (300ms)
- Hover states on all clickable elements
- Focus visible states for keyboard navigation
- Respect `prefers-reduced-motion`
- No animation for purely decorative purposes

### Interaction
- Every interactive element needs a hover state
- Disabled states should look disabled (reduced opacity + `cursor: not-allowed`)
- Loading states for async operations
- Error states with clear messaging
- Empty states with guidance

---

## Anti-Patterns to Avoid

1. **Gray text on colored backgrounds** — use white/dark with sufficient contrast
2. **Over-nested cards** — flatten the visual hierarchy
3. **Purple-to-blue gradients everywhere** — use color intentionally
4. **Hardcoded hex values** — always use design tokens
5. **Centered everything** — use alignment intentionally
6. **Monospace for all code** — only for actual code blocks
7. **Tiny click targets** — minimum 44x44px
8. **No focus styles** — every interactive element needs focus visible
9. **Status colors without icons** — color alone is not accessible
10. **Modals for everything** — prefer inline expansion when possible

---

## Commands

### `/polish [component]`
Refine visual details: spacing, alignment, typography, color contrast. Focus on making the component feel polished and intentional.

### `/critique [component]`
Provide a structured design critique covering hierarchy, contrast, spacing, typography, interaction, and responsiveness.

### `/audit [scope]`
Scan the UI for common anti-patterns and accessibility issues. Report findings with specific file/line references.

### `/responsive [component]`
Ensure the component works well across mobile, tablet, and desktop breakpoints.

---

## Project Context

- Design tokens: `src/styles/tokens.css` (loaded via `src/styles/index.css`)
- Themes: `light` (emerald accent on white) and `dark` (bright emerald on dark gray)
- Fonts: Inter (all UI), Courier New (code only)
- Components: `src/components/`, `src/features/`
- Mobile-first, 44px minimum touch targets
- CSS custom properties for theming (`data-theme` attribute)
- Lucide icons throughout
- TipTap editor for rich text
- KirriDesk-inspired clean SaaS aesthetic

---

## References

- `references/typography.md` - Typography Scale
- `references/color.md` - Color System
- `references/spacing.md` - Spacing & Layout
- `references/motion.md` - Motion Guidelines
