# Plan 112 — Codacy Repo-Level Issue Remediation (2026-08-10)

## Status
**DONE** — implementation complete in PR #628 (`fix/codacy-repo-issues-2026-08-10`).

## Problem

Codacy reported **28 repo-level issues** on `main` (8× detect-object-injection, 6×
xss/no-mixed-html, 5× no-unnecessary-condition, 3× Semgrep SSRF, 2× SC2015, 2×
confusing-void-expression, 1× floating-promises, 1× misused-promises).

### Root cause (config mismatch)

`.codacy.yml` disabled `ESLint9_`-prefixed rules under the `eslint-9` engine, but
Codacy's cloud analysis **actually runs the legacy ESLint (v8)** engine, which
reports `ESLint8_`-prefixed pattern IDs. Every suppression in `.codacy.yml` was
**silently ineffective**:

```
tools endpoint:  ESLint9  enabled=False (config file: True)
                 ESLint   enabled=True  (config file: False)   ← actually running
issues reported: ESLint8_* (never matched by ESLint9_* disable_rules)
```

## Fixes

### Code fixes (9 real issues)

| File | Fix | Issues |
|------|-----|--------|
| `triz-view.tsx` | Clipboard promise: `void ... .catch()` + try/catch guard | floating-promises, unnecessary-condition |
| `type-selector.tsx` | `options.item(nextIdx).focus()` (non-null per lib.dom, in-bounds by construction) | unnecessary-condition, object-injection |
| `command-palette.tsx` | `||=` on `Record` → `Map` grouping | unnecessary-condition |
| `shared-primitives.tsx` | `current[0]` → `current.at(0)` so `?? container` is type-honest | unnecessary-condition |
| `form.tsx` | Removed dead `if (!fieldContext)` guard (never null; dereferenced above) | unnecessary-condition |
| `use-mobile.ts` | Braces around void-returning arrow cleanup | confusing-void-expression |
| `encrypt-export-dialog.tsx` | `void handleExport(...)` | misused-promises |
| `export-format-grid.tsx` | Braces around void setter | confusing-void-expression |
| `self-fix-loop.sh` | SC2015: `A && B || C` → grouped braces (×2) | shellcheck SC2015 |

### False positives suppressed (19)

- **`.codacy.yml`**: added `eslint-8` engine section with `ESLint8_`-prefixed
  `disable_rules` for `security/detect-object-injection` (8) and
  `xss/no-mixed-html` (6) — all verified false positives:
  - object-injection: indexing constant lookup tables (`TRIZ_PARAMETERS`,
    `BUTTON_VARIANTS`) with typed keys, or DOM NodeList indexes
  - xss/mixed-html: React JSX components (JSX ≠ raw HTML strings), DOM node
    references (`.activeElement`, `cloneNode`), and file downloads (encrypted
    export HTML is downloaded, never inserted into the DOM)
- **Inline `// nosemgrep` comments** on 3 guarded fetches (SSRF): all use
  `validateOllamaUrl` (localhost-only) or protocol + `isPrivateIP` guards
  before `fetch` — Semgrep can't see the interprocedural validation.

## Validation

- `tsc -p tsconfig.app.json --noEmit` ✅
- ESLint on all changed files ✅
- 95 tests across 8 affected suites ✅
- `shellcheck scripts/self-fix-loop.sh` ✅
- Codacy PR gate on #628: `isUpToStandards=True`, **0 new issues** ✅

## Dependencies / Follow-ups

1. **DeepSource on #628** remains red until **PR #627 merges** — DeepSource
   reads `.deepsource.toml` from `main`, which still has the invalid
   `javascript-typescript` analyzer name. #627 fixes it to `javascript` +
   `skip_doc_coverage`. After #627 merges, #628's DeepSource check will re-run
   green (config is read from the base branch).
2. **Repo-level count stays at 28 until #628 merges** — Codacy also reads
   `.codacy.yml` from `main`. After merge + reanalysis, repo issues drop to 0.
3. All 5 open PRs (#624–#628) remain `BLOCKED` by GitHub ruleset merge-state
   staleness (see Plan 098) — the code_scanning tool-name trailing-space fix
   was applied to ruleset 15161694, awaiting GitHub propagation.

## Lessons

- Codacy pattern IDs are engine-prefixed; **verify the actual engine** via the
  tools endpoint before writing `disable_rules` — `ESLint9_` suppressions do
  not match `ESLint8_`-prefixed findings from the legacy engine.
- `NodeListOf.item()` is typed **non-nullable** in lib.dom, so `?.` on it is a
  real `no-unnecessary-condition` finding; bracket indexing triggers
  `detect-object-injection`. `.item(i)` called directly is both type- and
  runtime-correct when the index is proven in-bounds.
