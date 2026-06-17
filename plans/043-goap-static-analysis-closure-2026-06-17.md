# GOAP Plan 043: Static Analysis Findings Closure — 2026-06-17

**Generated**: 2026-06-17
**Source**: Codacy PR #326 analysis (48 issues) + DeepSource JS analysis (77 issues) + E2E timeout
**Method**: GOAP with ADR

## Investigated & Fixed in PR #326

| Finding | Tool | Fix |
|---------|------|-----|
| E2E timeout (93 tests, 1 worker, 30m) | CI | `workers: 1→2`, `retries: 2→1`, `timeout: 30→40m` |
| `aria-label` on unsupported element | Codacy/Biome | Removed redundant `aria-label` from `div.mobile-brand` |
| Non-null assertions (Editor.152/192/200/345) | Codacy/ESLint | Guarded with `if(entity.id)` checks |
| Void arrow functions (Editor/App/ExportPanel/CommandPalette/SearchPanel) | Codacy/ESLint | Added braces: `() => fn()` → `() => { fn(); }` |
| `role="button"` div (Editor.415) | Codacy/Biome | Changed `<div role="button">` to `<button>` |
| Namespace imports + short variables (db.test.ts) | DeepSource | `import * as fs` → named imports; `const a/b/p` → `first/second/dbPath` |
| Non-null assertion in test (CommandPalette.test.tsx) | Codacy/ESLint | Replaced `overlay!` with if-guard |
| Unnecessary optional chain (ErrorBoundary.52) | Codacy/ESLint | `navigator.clipboard?.writeText` → `.writeText` |
| Array index as key (Chat.tsx) | Codacy/Biome | Added `id` to Message interface, `crypto.randomUUID()` |
| 27 false positive suppressions | Codacy | Suppressed security rules that don't understand Tiptap/React |

## Remaining — Not Fixable in Current Run

### Structural Complexity (requires refactoring, out of scope)

| File | Issue | Tool | Reason |
|------|-------|------|--------|
| `src/app/App.tsx:50` | AppContent cyclomatic complexity 24 (high) | DeepSource JS-R1005 | Root component with 7 view states; splitting requires routing architecture change |
| `src/components/CommandPalette.tsx:48` | CommandPalette cyclomatic complexity 20 (high) | DeepSource JS-R1005 | Command palette handles search + commands + keyboard nav; extracting sub-components would change public API |
| `src/components/CommandPalette.tsx:142` | handleKeyDown complexity 9 | DeepSource JS-R1005 | Multi-key handler for arrow/enter/escape; extracting per-key handlers is cosmetic |

### Pre-existing Test File Issues (not in change set)

| File | Issue | Tool | Reason |
|------|-------|------|--------|
| `src/features/editor/__tests__/ClaimExtension.test.ts` | 7 findings | Codacy/ESLint | Pre-existing test file not modified in this PR; all false positives from security rules on Tiptap APIs |
| `src/features/editor/__tests__/MentionExtension.test.ts` | 7 findings | Codacy/ESLint | Same — pre-existing test file, security rule false positives on `editor.getHTML()` |
| `cli/__tests__/db.test.ts:20/35/48` | existsSync non-literal arg | Codacy/ESLint | Already fixed namespace imports; the non-literal arg is inherent to test tmpdir patterns |

### Third-party Tool False Positives (suppressed via Codacy CLI)

| Pattern | Count | Tool | Reason |
|---------|-------|------|--------|
| `Non-serializable expression` | 5 | Biome/Svelte | Svelte `$(...)` rule applied to React components — false positive |
| `Non-HTML variable` storing raw HTML | 8 | ESLint | Tiptap initial content strings `'<p>...</p>'` flagged as stored HTML |
| `HTML passed to function 'expect'` | 6 | ESLint | `expect(html).toContain(...)` flagged as HTML injection |
| `Unencoded return value from editor.getHTML()` | 2 | ESLint | Test assertions on serialized editor output, not browser rendering |
| `Generic Object Injection Sink` | 1 | ESLint | `onCitationClick?.(cite.id, cite.type)` — standard React callback pattern |
| `Function Call Object Injection Sink` | 1 | ESLint | `onResultClick?.(results[n])` — standard React callback pattern |

## Verification

```bash
pnpm run lint   # 0 errors
pnpm run typecheck  # 0 errors
pnpm run test   # 455 passed
pnpm run build  # success
```

## References

- PR #326 — `feat(plan-041+042): close gap-closure, add plan 042 + UI polish`
- Codacy analysis: https://app.codacy.com/gh/d-oit/do-knowledge-studio/pull-requests/326
- DeepSource analysis: https://app.deepsource.com/gh/d-oit/do-knowledge-studio/run/048fb6f6-05e6-4544-bc38-256073729f56/javascript/
