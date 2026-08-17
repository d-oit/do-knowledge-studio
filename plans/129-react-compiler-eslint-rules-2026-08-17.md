# Plan 129 — Enable React Compiler ESLint Rules (2026-08-17)

Date: 2026-08-17
Status: IMPLEMENTED — delivered via PR

## Goal

Surface any component the React Compiler cannot auto-optimize, so future
regressions are caught by lint instead of silently falling back to manual
memoization. Follow-up to Plan 128 (React Compiler enabled globally).

## Changes

1. **`eslint.config.mjs`** — enabled the React Compiler diagnostic rules from
   `eslint-plugin-react-hooks@7.1.1` (already a devDependency):
   - `react-hooks/purity` (was `off` → `warn`)
   - `react-hooks/use-memo` (`warn`)
   - `react-hooks/immutability` (`warn`)
   - `react-hooks/refs` (`warn`)
   - `react-hooks/static-components` (`warn`)
   - Registered the `react-hooks` plugin in the rules config object (flat config
     requires the plugin in the same object for non-`off` rules).
   - Deliberately did NOT enable the full `recommended-latest` preset (it would
     flip `exhaustive-deps`/`set-state-in-effect`/etc. and override the config's
     existing off-switches).

2. **`src/components/ui/sidebar.tsx`** — fixed the only `purity` finding: the
   skeleton width used `Date.now()` inside `useMemo` during render (impure).
   Hoisted the width-index computation to module scope (evaluated once at import,
   not during render), keeping the render function pure. Cosmetic only — skeleton
   widths were already effectively uniform per page load.

## Verification

- `pnpm run lint` — clean (0 warnings, 0 errors) with the rules enabled
- `pnpm run typecheck` — clean
- `pnpm run test` — 2264 passed | 1 skipped
- `pnpm run build` — successful

## Notes

- The project quality gate treats warnings as errors, so these rules are
  effectively enforced: any future component the compiler cannot optimize will
  fail lint and be addressed at code level (per the existing `'use no memo'`
  escape-hatch pattern from Plan 128).
- No ADR required: lint configuration + a cosmetic vendor-file purity fix.
