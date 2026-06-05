# Impeccable — Frontend Design Skill

> Canonical skill for general frontend UI design, visual polish, and UX critique.
> Adapted from [pbakaus/impeccable](https://github.com/pbakaus/impeccable) for shell-first architecture.

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
- Use the project's design tokens from `src/styles/index.css`
- Minimum 16px body text, 14px secondary
- Line height: 1.5 for body, 1.2 for headings
- Max 2 font families (system stack preferred)
- No `font-weight: 300` on small text (poor readability)

### Color
- Use CSS custom properties (`var(--text-primary)`, etc.)
- No pure black (`#000`) or pure white (`#fff`) — use tinted neutrals
- Minimum 4.5:1 contrast ratio for body text (WCAG AA)
- Use design tokens for all colors, no hardcoded hex values
- Accent colors: one primary, one secondary, one danger

### Spacing
- Use the project's spacing scale (`var(--space-1)` through `var(--space-8)`)
- Consistent padding within components (4px grid)
- Minimum 44x44px touch targets
- Generous whitespace between sections

### Layout
- Mobile-first responsive design
- Use CSS Grid for page layouts, Flexbox for component internals
- Max content width: 1200px (centered)
- Breakpoints: mobile (< 640px), tablet (640–1024px), desktop (> 1024px)

### Motion
- Use `transition: all 0.15s ease` for interactive elements
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
4. **Inter font as default** — use the project's type system
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

- Design tokens: `src/styles/index.css`
- Components: `src/components/`, `src/features/`
- Mobile-first, 44px minimum touch targets
- CSS custom properties for theming (`data-theme` attribute)
- Lucide icons throughout
- TipTap editor for rich text

---

## References

- [Typography Scale](references/typography.md)
- [Color System](references/color.md)
- [Spacing & Layout](references/spacing.md)
- [Motion Guidelines](references/motion.md)
