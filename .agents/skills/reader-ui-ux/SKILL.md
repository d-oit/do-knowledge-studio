---
version: "1.0.0"
name: reader-ui-ux
description: >
  Build localized, accessible reader/admin UI with responsive layouts, telemetry, and state management. Activate for React screens or UX polish. Generic pattern for any document reader application.
category: workflow
---

# Reader UI/UX

Purpose: deliver intentional, localized, accessible reader/admin UX.

## When to run

- Modifying reader/admin React screens, layout primitives, or shared UI components.
- Adding localization copy, accessibility improvements, or design polish.
- Building locale switchers, typography controls, or comment/annotation panels.

## Workflow

1. **Define experience** -- confirm viewport-specific layout (mobile drawer vs desktop side panels) + theme rules.
2. **Localization** -- add strings to locale catalogs, ensure fallback, surface locale switcher.
3. **Accessibility** -- keyboard focus, ARIA labels, reduced motion, semantic regions.
4. **State** -- use state management selectors, avoid prop drilling, memoize heavy renders.
5. **Observability** -- log key UI actions with trace IDs.
6. **Testing** -- add component tests; E2E coverage for primary flows.

## Checklist

- [ ] Layout responsive (mobile/tablet/desktop) with deliberate spacing.
- [ ] Strings localized and locale header updated.
- [ ] Error states use ErrorBoundary + inline alerts.
- [ ] Async effects cancel via AbortController; cleanup functions implemented.
- [ ] UI interactions include aria-labels + focus traps where applicable.

## References
- `references/responsive-patterns.md` - Responsive layout patterns
- `references/accessibility-checklist.md` - WCAG compliance checklist
