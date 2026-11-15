### LESSON-062: ESLint v9 + Vite 8 Rolldown Migration (2026-04-30)

**Date**: 2026-04-30
**Component**: ESLint / Vite / Vitest / Playwright / Root Files
**Severity**: Medium

**Issue**: Project used deprecated ESLint v8 config (`.eslintrc.cjs`), Vite 8 `manualChunks` (Rollup API), and `happy-dom` for Vitest.

**Symptoms**:
- `@eslint/js@10` requires ESLint v10 — conflicts with ESLint v9
- `eslint-plugin-react-hooks@4.x` has peer conflicts with ESLint v9
- Vite 8 uses Rolldown — `build.rollupOptions` + `manualChunks` are deprecated
- `PHASES.md` in root violates AGENTS.md "Markdown is NOT canonical truth"
- Multiple `gh` accounts cause 403 on push — need `gh auth switch`

**Root Cause**:
1. **ESLint v9 flat config**: Legacy `.eslintrc.cjs` format deprecated in v9+
2. **Vite 8 Rolldown**: Replaces Rollup; `manualChunks` → `codeSplitting.groups`
3. **Package versioning**: `@eslint/js@10` needs ESLint v10, not v9 — pin to `@eslint/js@^9`
4. **React hooks plugin**: v4.x has peer `eslint@^3-8`; v5.x required for ESLint v9
5. **Markdown in root**: `PHASES.md` violates project rule — must be in `docs/`

**Solution**:
```bash
# Fix package versions
npm install --save-dev @eslint/js@^9 eslint-plugin-react-hooks@5.2.0 --legacy-peer-deps

# ESLint flat config (eslint.config.js)
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
// ... plugins, rules

# Vite 8 Rolldown config
build: {
  rolldownOptions: {
    output: {
      codeSplitting: { groups: [{ name: 'vendor-graph', test: /sigma/ }, ...] }
    }
  }
}

# Vitest jsdom
environment: 'jsdom', setupFiles: ['src/test/setup.ts']

# Playwright tuning
timeout: 30000, outputDir: 'test-results'
```

**Prevention**:
- Pin `@eslint/js@^9` (not `^10`) when using ESLint v9
- Use `eslint-plugin-react-hooks@5.x` with ESLint v9
- Vite 8: use `rolldownOptions` + `codeSplitting.groups`
- Markdown docs in `docs/` only (never root)
- Check `gh auth status` before push with multiple accounts

**Files Modified**:
- `eslint.config.js` (new), deleted `.eslintrc.cjs`
- `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`
- `src/test/setup.ts` (new), `docs/PHASES.md` (moved)
- `AGENTS.md`, `README.md`, `plans/2026-best-practices-audit.md`

---
