# 2026 Best Practices Audit Report
## GOAP-Agent Orchestrated Analysis
**Date**: 2026-04-30  
**Scope**: TypeScript/React (Vite 8 + React 18) Linting, Build, Test, and Root File Conventions

---

## Executive Summary

This audit evaluated the `do-knowledge-studio` project against 2026 best practices for Vite 8 + React 18 projects. Key findings:

- **Root Files**: `index.html` correctly placed; `PHASES.md` violates project rules; `NOTICE` acceptable.
- **ESLint**: Using deprecated v8 config format; needs migration to flat config with type-checked rules.
- **Vite Config**: Uses deprecated `rollupOptions`—Vite 8 requires `rolldownOptions`.
- **Vitest**: Uses `happy-dom` (functional but `jsdom` recommended); missing setup files.
- **Playwright**: Well-configured; minor improvements for CI parallelization.
- **package.json**: Missing `test:e2e:ci` and lint/format helper scripts.

---

## 1. Web Research Findings (2026 Best Practices)

### 1.1 TypeScript/JavaScript Linting (ESLint)
**Sources**: ESLint v9 docs, typescript-eslint.io, Vite.js official templates (2025-2026)

| Practice | 2026 Standard |
|----------|---------------|
| Config Format | Flat config (`eslint.config.js`) — `.eslintrc*` deprecated in ESLint v9+ |
| Core Plugins | `@typescript-eslint` (parser + plugin combined), `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` |
| Type-Checked Rules | Use `tseslint.configs.recommendedTypeChecked` or `strictTypeChecked` |
| Accessibility | `eslint-plugin-jsx-a11y` recommended |
| Prettier Integration | `eslint-plugin-prettier` with `eslint-config-prettier` |
| React Version | Set `settings: { react: { version: 'detect' } }` |

**Recommended ESLint Flat Config (2026)**:
```js
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      react.configs.recommended,
      react.configs['jsx-runtime'],
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  }
);
```

---

### 1.2 Build Tooling (Vite 8)
**Sources**: Vite 8.0 Announcement (2026-03-12), Rolldown Migration Guide, Vite Build Options Docs

| Feature | Vite 8 (2026) | Vite 7 (Legacy) |
|---------|----------------|-----------------|
| Bundler | **Rolldown** (Rust-based) | esbuild (dev) + Rollup (build) |
| Config Prefix | `optimizeDeps.rolldownOptions` | `optimizeDeps.esbuildOptions` |
| Build Options | `build.rolldownOptions` | `build.rollupOptions` |
| Minifier | **Oxc Minifier** (default) | esbuild or terser |
| CSS Minification | **Lightning CSS** (default) | cssnano or esbuild |
| Code Splitting | `build.rolldownOptions.output.codeSplitting` | `manualChunks` |

**Key Vite 8 Migration Points**:
- `manualChunks` → `codeSplitting.groups`
- `build.rollupOptions` → `build.rolldownOptions`
- Oxc Minifier is 30-90x faster than terser

**Example Vite 8 Config**:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  optimizeDeps: {
    rolldownOptions: { /* replaces esbuildOptions */ },
  },
  build: {
    minify: 'oxc', // Explicit (default in Vite 8)
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /\/react(?:-dom)?/ },
          ],
        },
      },
    },
  },
});
```

---

### 1.3 Testing Best Practices

#### Vitest + React Testing Library
**Sources**: Vitest Docs (2026-04-08), helpmetest.com, dev.to, oneuptime.com

| Aspect | 2026 Best Practice |
|--------|-------------------|
| Environment | `jsdom` (more mature) or `happy-dom` (lighter/faster) |
| Globals | `globals: true` — avoids repetitive imports |
| Setup Files | `setupFiles: './src/test/setup.ts'` with `@testing-library/jest-dom` |
| CSS Support | `css: true` in test config for CSS Modules |
| Coverage | `@vitest/coverage-v8` provider; reporters: `['text', 'json', 'html']` |
| Test Patterns | `**/*.{test,spec}.{ts,tsx}` |
| RTL Queries | Priority: `getByRole` → `getByLabel` → `getByText` (avoid `getByTestId` when possible) |
| User Events | Use `@testing-library/user-event` v14+ (not `fireEvent`) |

#### Playwright 2026
**Sources**: Playwright Docs, oneuptime.com, starterpick.com, casaislabs/React-CI-CD

| Aspect | 2026 Best Practice |
|--------|-------------------|
| Config Format | TypeScript (`playwright.config.ts`) |
| CI Workers | `workers: process.env.CI ? 1 : undefined` |
| Retries | `retries: process.env.CI ? 2 : 0` |
| Forbid Only | `forbidOnly: !!process.env.CI` |
| Trace | `trace: 'on-first-retry'` (not 'on' — performance) |
| Screenshots/Videos | `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'` |
| Test Artifacts | Upload to CI on failure |
| Base URL | `baseURL: 'http://localhost:5173'` (Vite default) |
| webServer | `command: 'npm run dev'` with `reuseExistingServer: !process.env.CI` |
| Selectors | Prefer `data-testid` for stable selection |
| Cross-Browser | Test on Chromium + Firefox + WebKit (or at least Chromium + Firefox) |

---

### 1.4 Project Root File Conventions (Vite 8 + React 18)
**Sources**: Vite.js Guide, oneuptime.com, dev.to, medium.com, codingeasypeasy.com

**Standard Vite 8 Root Structure**:
```
my-react-app/
├── node_modules/
├── public/              # Static assets (served as-is)
│   └── favicon.ico
├── src/                 # All source code
│   ├── components/
│   ├── hooks/
│   ├── utils/
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── tests/               # E2E tests (optional, or use ./e2e)
│   └── e2e/
├── index.html           # ✅ REQUIRED in root (Vite entry point)
├── vite.config.ts       # ✅ REQUIRED
├── tsconfig.json        # ✅ REQUIRED
├── tsconfig.node.json   # Recommended for Node tools
├── eslint.config.js     # ✅ 2026 standard (flat config)
├── vitest.config.ts     # Optional (can merge into vite.config.ts)
├── playwright.config.ts  # E2E config
├── package.json         # ✅ REQUIRED
├── .env                 # Environment variables
├── .gitignore           # ✅ REQUIRED
└── ...
```

**Files that should NOT be in root**:
- Project management docs (use `docs/` or GitHub Projects)
- Markdown files for documentation (per AGENTS.md: "Markdown is NOT canonical truth")
- Build artifacts (`dist/`, `coverage/` — add to `.gitignore`)

---

## 2. Root File Analysis (Project: do-knowledge-studio)

### 2.1 `NOTICE`
| Aspect | Finding |
|--------|---------|
| **Purpose** | Legal attribution for third-party components (MIT, GPL-3.0 licenses) |
| **Compliance with AGENTS.md** | ✅ **COMPLIANT** — AGENTS.md states "Markdown is NOT canonical truth." `NOTICE` is plain text, not Markdown, and serves a legal purpose. |
| **2026 Best Practices** | ✅ **COMPLIANT** — NOTICE files are standard in open-source projects for license attribution. Location in root is conventional. |
| **Recommendation** | **Keep as-is**. Optionally rename to `NOTICE.md` for GitHub rendering, but plain text is acceptable. |

---

### 2.2 `PHASES.md`
| Aspect | Finding |
|--------|---------|
| **Purpose** | Project phase tracking (Foundation → Integration → Synthesis) |
| **Compliance with AGENTS.md** | ❌ **NON-COMPLIANT** — AGENTS.md explicitly states: *"Markdown is NOT canonical truth: Use only for export/import."* This is a project management document in Markdown at the root. |
| **2026 Best Practices** | ❌ **NON-COMPLIANT** — Not a standard Vite/React project file. Project status should use GitHub Projects/Issues or live in `docs/`. |
| **Content** | Tracks 3 phases; Phase 3 marked "In Progress" with 3 completed items. |
| **Recommendation** | **Move to `docs/PHASES.md`** or migrate to GitHub Project board. If kept in repo, `docs/` is the appropriate location. Alternatively, integrate into `README.md` or delete if redundant with GitHub Issues. |

---

### 2.3 `index.html`
| Aspect | Finding |
|--------|---------|
| **Purpose** | Main HTML entry point for Vite application |
| **Compliance with AGENTS.md** | ✅ **COMPLIANT** — Required by Vite; not documentation Markdown. |
| **2026 Best Practices** | ✅ **COMPLIANT** — Correctly placed in root. Vite 8 requires `index.html` in root (not `public/` like Create React App). |
| **Content Quality** | ✅ Well-configured: <br>- Proper `<meta charset="UTF-8">`<br>- Viewport meta present<br>- **CSP meta tag** (good security practice)<br>- `referrer` meta (privacy)<br>- `<div id="root">` for React mount<br>- `<script type="module" src="/src/main.tsx">` (correct Vite pattern) |
| **Recommendation** | **Keep as-is**. Correctly configured for Vite 8 + React 18. |

---

## 3. Project Config Audit

### 3.1 ESLint Configuration (`.eslintrc.cjs`)

**Current State**:
- Format: **Legacy `.eslintrc.cjs`** (deprecated in ESLint v9+)
- ESLint Version: `^8.57.0` (behind 2026 standard v9+)
- Parser: `@typescript-eslint/parser` (old integration)
- Plugins: `react-hooks`, `react-refresh` (missing `eslint-plugin-react`)
- Extends: `eslint:recommended`, `plugin:@typescript-eslint/recommended`, `plugin:react-hooks/recommended`
- Type-Checked: ❌ Not using `tseslint.configs.recommendedTypeChecked`

| Gap | Priority | 2026 Best Practice |
|-----|----------|-------------------|
| **Deprecated config format** | 🔴 High | Migrate to flat config (`eslint.config.js`) |
| **ESLint v8** | 🔴 High | Upgrade to ESLint v9+ |
| **Missing React plugin** | 🟠 Medium | Add `eslint-plugin-react` with `plugin:react/recommended` and `jsx-runtime` |
| **No type-checked rules** | 🟠 Medium | Use `tseslint.configs.recommendedTypeChecked` |
| **Missing jsx-a11y** | 🟡 Low | Add `eslint-plugin-jsx-a11y` for accessibility linting |
| **No Prettier integration** | 🟡 Low | Add `eslint-plugin-prettier` + `eslint-config-prettier` |

**Recommendations**:
1. Upgrade ESLint: `npm install -D eslint@^9 @typescript-eslint/eslint-plugin@^8`
2. Create `eslint.config.js` (flat config) — see Section 1.1 for template
3. Remove `.eslintrc.cjs` after migration
4. Add missing plugins: `eslint-plugin-react`, `eslint-plugin-jsx-a11y`
5. Update `package.json` lint script: `"lint": "eslint . --max-warnings 0"` (flat config auto-detects ts/tsx)

---

### 3.2 Vite Configuration (`vite.config.ts`)

**Current State**:
- Vite Version: `^8.0.8` ✅ (current)
- Plugin: `@vitejs/plugin-react@^6.0.1` ✅ (Vite 8 compatible)
- Alias: `@` → `./src` ✅
- `optimizeDeps.exclude`: `@sqlite.org/sqlite-wasm` ✅ (correct for WASM)
- `build.rollupOptions.output.manualChunks`: Present (⚠️ deprecated in Vite 8)

| Gap | Priority | 2026 Best Practice |
|-----|----------|-------------------|
| **Using `build.rollupOptions`** | 🔴 High | Vite 8 uses `build.rolldownOptions` |
| **Using `manualChunks`** | 🔴 High | Replace with `codeSplitting.groups` in `rolldownOptions.output` |
| **No explicit `build.minify`** | 🟡 Low | Set `build.minify: 'oxc'` (Vite 8 default, but explicit is clearer) |
| **No `build.target`** | 🟡 Low | Set `build.target: 'esnext'` or use browserslist |

**Current `manualChunks` → Vite 8 `codeSplitting` Migration**:
```ts
// OLD (Vite 7 and earlier)
build: {
  rollupOptions: {
    output: {
      manualChunks(id) {
        if (id.includes('sigma')) return 'vendor-graph';
        // ...
      }
    }
  }
}

// NEW (Vite 8)
build: {
  rolldownOptions: {
    output: {
      codeSplitting: {
        groups: [
          { name: 'vendor-graph', test: /sigma|graphology/ },
          { name: 'vendor-mindmap', test: /mind-elixir/ },
          { name: 'vendor-editor', test: /@tiptap/ },
          { name: 'vendor-sqlite', test: /@sqlite\.org\/sqlite-wasm/ },
          { name: 'vendor-search', test: /@orama\/orama/ },
        ]
      }
    }
  }
}
```

**Recommendations**:
1. Migrate `build.rollupOptions` → `build.rolldownOptions`
2. Replace `manualChunks` with `codeSplitting.groups`
3. Add explicit `build.minify: 'oxc'`
4. Consider adding `build.target: ['esnext']` for modern browser support

---

### 3.3 Vitest Configuration (`vitest.config.ts`)

**Current State**:
- Vitest Version: `^4.1.4` ✅ (current)
- Environment: `happy-dom` (⚠️ `jsdom` recommended for closer browser API support)
- `globals: true` ✅
- Coverage Provider: `@vitest/coverage-v8` ✅
- Coverage Thresholds: branches: 50%, functions: 60%, lines: 50%, statements: 50% (⚠️ low)
- Excludes `tests/e2e/**` ✅

| Gap | Priority | 2026 Best Practice |
|-----|----------|-------------------|
| **`happy-dom` environment** | 🟡 Low | `jsdom` is more mature, better browser API support |
| **Missing `setupFiles`** | 🟠 Medium | Add `setupFiles: './src/test/setup.ts'` with `@testing-library/jest-dom` |
| **Missing `css: true`** | 🟡 Low | Enable CSS parsing for CSS Modules |
| **Low coverage thresholds** | 🟠 Medium | Increase to 70-80% for production code |

**Recommendations**:
1. Create `src/test/setup.ts`:
   ```ts
   import '@testing-library/jest-dom/vitest';
   ```
2. Update `vitest.config.ts`:
   ```ts
   export default defineConfig({
     plugins: [react()],
     test: {
       environment: 'jsdom', // or keep happy-dom if preferred
       globals: true,
       setupFiles: './src/test/setup.ts',
       css: true,
       coverage: {
         provider: 'v8',
         reporter: ['text', 'json', 'html'],
         branches: 70, // Increase from 50
         functions: 80, // Increase from 60
         lines: 75,    // Increase from 50
         statements: 75 // Increase from 50
       }
     }
   });
   ```
3. Install `@testing-library/jest-dom` if not present: `npm install -D @testing-library/jest-dom`

---

### 3.4 Playwright Configuration (`playwright.config.ts`)

**Current State**:
- Playwright Version: `^1.42.1` ✅ (current)
- `testDir: './tests/e2e'` ✅
- `fullyParallel: true` ✅
- `forbidOnly: !!process.env.CI` ✅
- `retries: process.env.CI ? 2 : 0` ✅
- `workers: process.env.CI ? 1 : undefined` ✅
- `trace: 'on-first-retry'` ✅ (best practice)
- `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'` ✅
- Projects: chromium, mobile (iPhone 13), tablet (iPad Pro 11) ✅
- webServer: `npm run dev` with `http://localhost:5173` ✅

| Gap | Priority | 2026 Best Practice |
|-----|----------|-------------------|
| **Missing `timeout`** | 🟡 Low | Add `timeout: 30000` (30s) for test stability |
| **Missing `outputDir`** | 🟡 Low | Add `outputDir: 'test-results'` for artifact organization |
| **Only Chromium + mobile/tablet** | 🟡 Low | Consider adding Firefox and WebKit projects for cross-browser coverage |
| **No sharding config** | 🟡 Low | Add sharding for CI parallelization (Playwright built-in) |

**Recommendations**:
1. Add timeout and outputDir:
   ```ts
   export default defineConfig({
     testDir: './tests/e2e',
     timeout: 30000,
     outputDir: 'test-results',
     // ... rest of config
   });
   ```
2. Consider adding Firefox/WebKit projects:
   ```ts
   projects: [
     { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
     { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
     { name: 'webkit', use: { ...devices['Desktop Safari'] } },
     { name: 'mobile', use: { ...devices['iPhone 13'] } },
     { name: 'tablet', use: { ...devices['iPad Pro 11'] } },
   ]
   ```
3. Config is otherwise well-aligned with 2026 best practices.

---

### 3.5 package.json Scripts

**Current State**:
```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "test:e2e": "playwright test",
  "typecheck": "tsc --noEmit",
  "cli": "node --loader ts-node/esm cli/index.ts"
}
```

| Gap | Priority | 2026 Best Practice |
|-----|----------|-------------------|
| **Missing `test:e2e:ci`** | 🟠 Medium | Add script for CI with GitHub reporter |
| **Missing `lint:fix`** | 🟡 Low | Add auto-fix script |
| **Missing format scripts** | 🟡 Low | Add Prettier scripts if using Prettier |
| **`cli` uses `ts-node`** | 🟡 Low | Consider `tsx` for ESM-native execution |

**Recommendations**:
1. Add to `package.json`:
   ```json
   "scripts": {
     "test:e2e:ci": "playwright test --reporter=github",
     "lint:fix": "eslint . --ext ts,tsx --fix",
     "format": "prettier --write 'src/**/*.{ts,tsx,css,md}'",
     "format:check": "prettier --check 'src/**/*.{ts,tsx,css,md}'"
   }
   ```
2. For CLI: Consider `npm install -D tsx` and update script: `"cli": "tsx cli/index.ts"`

---

## 4. Priority Action Items

### 🔴 High Priority (Must Fix)
1. **Migrate ESLint to flat config** (`eslint.config.js`):
   - Upgrade to ESLint v9+
   - Create new flat config with type-checked rules
   - Remove `.eslintrc.cjs`

2. **Migrate Vite config to Vite 8 conventions**:
   - Replace `build.rollupOptions` → `build.rolldownOptions`
   - Replace `manualChunks` → `codeSplitting.groups`

3. **Move `PHASES.md` out of root**:
   - Move to `docs/PHASES.md` OR migrate to GitHub Projects

### 🟠 Medium Priority (Should Fix)
4. **Add Vitest setup file** (`src/test/setup.ts`) with `@testing-library/jest-dom`
5. **Increase coverage thresholds** (aim for 70%+)
6. **Add `test:e2e:ci` script** for CI integration
7. **Add missing ESLint plugins**: `eslint-plugin-react`, `eslint-plugin-jsx-a11y`

### 🟡 Low Priority (Nice to Have)
8. **Add Playwright timeout and outputDir config**
9. **Consider adding Firefox/WebKit to Playwright projects**
10. **Add `lint:fix`, `format` scripts to package.json**
11. **Evaluate `happy-dom` vs `jsdom`** for Vitest (keep happy-dom if it works for your needs)

---

## 5. Summary of Compliance

| Area | Status | Action Required |
|------|--------|-----------------|
| **Root Files** | ⚠️ 2/3 compliant | Move `PHASES.md` |
| **ESLint** | ❌ Non-compliant | Full migration to flat config + v9 |
| **Vite Config** | ⚠️ Partially compliant | Migrate to `rolldownOptions` |
| **Vitest** | ⚠️ Mostly compliant | Add setup files, increase thresholds |
| **Playwright** | ✅ Mostly compliant | Minor enhancements |
| **package.json** | ⚠️ Functional | Add helper scripts |

---

## 6. References

- Vite 8 Announcement: https://vite.dev/blog/announcing-vite8
- Vite 8 Build Options: https://github.com/vitejs/vite/blob/v8.0.8/docs/config/build-options.md
- ESLint Flat Config: https://eslint.org/docs/latest/use/configure/configuration-files
- typescript-eslint Getting Started: https://typescript-eslint.io/getting-started/
- Vitest Configuration: https://vitest.dev/config/
- Playwright Test Configuration: https://playwright.dev/docs/test-configuration
- React Project Structure (Vite): https://oneuptime.com/blog/post/2026-01-08-react-typescript-vite-production-setup/view

---

**Report Generated By**: GOAP-Agent Orchestrator  
**Date**: 2026-04-30  
**Next Review**: After implementing High Priority items
