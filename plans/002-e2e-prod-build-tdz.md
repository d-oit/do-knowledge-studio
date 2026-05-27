# E2E Production Build Fix — 2026-05-27

> **Goal**: Fix E2E tests failing in CI due to production build TDZ error
> **Root Cause**: `Cannot access 'ae' before initialization` — minified `const/let` TDZ violation in production bundle

## Evidence

- All 96 E2E tests fail with `.layout-container` not found
- No error screen rendered either — React crashes during module init
- Dev mode (`pnpm run dev`) works fine; production build (`pnpm run build`) produces broken JS
- The error `Cannot access 'ae' before initialization` is a Temporal Dead Zone (TDZ) violation
- In Vite 8 + rolldown output, minified variable names obscure the source

## Reproduction

```bash
pnpm run build
PLAYWRIGHT_MODE=production npx playwright test tests/e2e/smoke.spec.ts --project=chromium --reporter=list
```

## Investigation Steps

1. **Identify the source variable** — Build with `--sourcemap` or disable minification:
   ```bash
   # Add to vite.config.ts build section:
   # minify: false
   # or
   NODE_ENV=development pnpm run build
   ```

2. **Check for circular dependencies** — The TDZ error in bundled JS typically comes from circular `import` chains:
   ```bash
   npx madge --circular src/
   ```

3. **Check specific modules** — Likely candidates:
   - `src/db/client.ts` imports `connection-pool.ts` which may have circular deps
   - `src/lib/search.ts` and its dependencies
   - Any barrel imports in `src/lib/` or `src/features/`

4. **Test with Vite 8 rolldown disabled** — Try `build.rolldownOptions` to see if it's a rolldown issue

## Fix Options

| Option | Effort | Risk | Description |
|--------|--------|------|-------------|
| Add `optimizeDeps.include` | Low | Low | Force specific deps to be pre-bundled |
| Disable rolldown code splitting | Low | Low | Use Vite 8 default bundler instead |
| Fix circular deps | Medium | Low | Restructure imports to remove cycles |
| Add `skipLibCheck: true` to tsconfig | Minimal | Low | May not help if it's a runtime issue |

## Verification

```bash
pnpm run build
PLAYWRIGHT_MODE=production npx playwright test tests/e2e/smoke.spec.ts --project=chromium --reporter=list
# Then run full E2E suite
pnpm run test:e2e:ci
```
