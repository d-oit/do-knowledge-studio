# 2026 Best Practices Audit - Compact

**Date**: 2026-04-30 | **Scope**: Vite 8 + React 18 lint, build, test, root files

## Root Files
| File | Verdict | Action |
|------|---------|--------|
| `NOTICE` | ✅ Keep | Legal attribution, not Markdown docs |
| `PHASES.md` | ❌ Move to `docs/` | Violates "Markdown is NOT canonical truth" |
| `index.html` | ✅ Keep | Correct Vite 8 root placement |

## Config Migrations Completed
- **ESLint**: `.eslintrc.cjs` → `eslint.config.js` (v9 flat config, `@eslint/js@9`, `eslint-plugin-react-hooks@5`)
- **Vite 8**: `build.rollupOptions` → `build.rolldownOptions` + `codeSplitting.groups`
- **Vitest**: `happy-dom` → `jsdom`, added `src/test/setup.ts`, coverage → 70%+
- **Playwright**: Added `timeout: 30000`, `outputDir: 'test-results'`

## CI Failure Notes
- `@eslint/js@10` requires ESLint v10 — pinned to `@eslint/js@9.28.0`
- `eslint-plugin-react-hooks@4.x` conflicts with ESLint v9 — upgraded to `5.2.0`
- Fix: `npm install --save-dev @eslint/js@9.28.0 eslint-plugin-react-hooks@5.2.0 --legacy-peer-deps`

## 2026 Stack Summary
- **Bundler**: Rolldown (Rust) + Oxc Minifier (Vite 8 default)
- **Lint**: ESLint v9 flat config, type-checked rules available
- **Test**: Vitest + jsdom, Playwright with trace-on-retry
- **Root**: `index.html` required; Markdown docs in `docs/` only

## Reference
Full report archived: `.agents/skills/learnings/2026-audit-detailed.md`
