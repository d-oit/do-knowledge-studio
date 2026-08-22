# ADR 036: E2E Responsive Test Matrix and Pyramid Integrity

## Status

Proposed — implemented via Plan 130
(`plans/130-goap-uiux-testpyramid-errorhandling-2026-08-22.md`).

## Context

Test inventory (2026-08-22 audit): 149 unit/integration files
(~2,216 Vitest tests, ~26.8k LOC) against 17 Playwright specs
(135 tests). The unit:E2E ratio is healthy; the E2E layer has
structural gaps:

1. **E2E runs against the dev server.** `playwright.config.ts`
   `webServer.command` is `pnpm run dev`. Plan 002
   (`plans/002-e2e-prod-build-tdz.md`) already demonstrated this bug
   class once: a circular-dep TDZ crash that only manifested in a
   production build. The production-mode harness built then has since
   regressed away, so Rolldown bundling / prod-only tree-shaking
   failures are again invisible to E2E.
2. **Only Chromium gates CI.** `.github/workflows/ci-and-labels.yml`
   runs `pnpm run test:e2e --project=chromium`. The configured
   `mobile` (iPhone 13), `tablet` (iPad Pro 11), and `desktop-xl`
   (1920×1080) projects never execute on PRs — drawer navigation,
   touch-target layout, and wide-viewport assertions ship unverified.
3. **Missing flow coverage.** No delete-entity spec (destructive flows
   incl. reset confirm), no export→import round-trip spec, no graph
   interaction spec, no mind-map editing spec, no functional sync-view
   spec. These core flows exist only as jsdom unit tests.
4. **No visual regression safety net.** Zero screenshot assertions;
   the dark theme (`data-theme="dark"`) is never activated by any E2E,
   so token/theme regressions pass silently. `contrast.spec.ts`
   hardcodes four hexes instead of reading the `@theme` tokens.
5. **Fixture duplication risk.** Store seeding via the Zustand persist
   envelope exists inline in exactly one spec
   (`library-virtualization.spec.ts`, key
   `'do-knowledge-studio-store'`, `version: CURRENT_SCHEMA_VERSION`);
   new data-driven specs would copy-paste it.
6. **Reporter/observability.** Bare `list` reporter everywhere; no HTML
   report or trace upload in CI beyond failure artifacts.

Playwright official best practices applied: test user-visible behavior
via role-based locators (already house style), keep tests isolated per
browser context, multi-browser projects, install only needed browsers
on CI, use web-first assertions, trace on first retry (already set),
HTML report for CI debugging.

## Decision

### Production build is the canonical E2E target

```ts
webServer: {
  command: process.env.PLAYWRIGHT_MODE === 'dev'
    ? 'pnpm run dev'
    : 'pnpm run build && pnpm run start',
  ...
}
```

Production build + start is the default; dev mode stays opt-in for
fast iteration via `PLAYWRIGHT_MODE=dev`. This restores Plan 002's
intent without losing local convenience.

### Tiered viewport/browser matrix

- **PR gate** — `chromium` + `mobile`; runs on every
  frontend-affecting PR.
- **Nightly** — `chromium`, `mobile`, `tablet`, `desktop-xl`,
  `webkit`; cron backfill on main.

Rationale: regressions concentrate where layouts switch (drawer vs
sidebar); iPhone 13 catches them cheaply. Full matrix + a WebKit
project (Safari-relevant CSS: vaul drawer, backdrop filters) runs
nightly to bound CI cost while keeping cross-engine drift visible.
CI installs only the browsers for the tier being run.

### Shared fixtures

Extract `e2e/helpers/store.ts` with a typed `seedStore(page, partial)`
helper wrapping the persist-envelope pattern (validated against the
Zod schema version), plus an export-download helper for the
round-trip spec.

### Visual regression — core set

`toHaveScreenshot` baselines for token/theme-sensitive surfaces:
home, library, editor, graph — × light/dark (`data-theme` attribute)
× 3 viewports (375, 768, 1280). Tolerance-based
(`maxDiffPixelRatio`) so font rasterization noise does not flake;
baselines committed per project config. Dark theme also activated in
the existing a11y/touch-target specs via context option.

### Observability

HTML reporter always; blob/JSON summary uploaded from CI shards;
traces remain `on-first-retry`.

## Consequences

- Prod-only failures (bundling, TDZ, minification) surface at PR time
  instead of production deploys.
- Mobile/wide-viewport layout regressions gate merges, not luck.
- Screenshot baselines add a maintenance cost on intentional visual
  changes (regenerate via `--update-snapshots`); scope kept to 4 views
  to stay reviewable.
- Nightly WebKit adds one browser install to the nightly job only.
- New flow specs (delete, import/export, graph, mind map) reuse
  helpers/navigation.ts, editor.ts, and the shared seed fixture — no
  selector-style divergence.
