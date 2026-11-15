### LESSON-056: Codacy reads angle brackets in CLI usage text as HTML

**Date**: 2026-11-01
**Component**: CI / Codacy / ESLint security rules
**Severity**: Low

**Issue**: A new Node CLI script failed the Codacy gate with a security issue:
"HTML passed in to function 'console.error'" (`ESLint8_xss_no-mixed-html`).

**Symptoms**:
- Codacy reported `ACTION_REQUIRED` on a PR whose only new script had no DOM,
  no HTML, and no user-controlled markup.
- The flagged line was a `console.error` usage string.

**Root Cause**:
The usage text used a conventional placeholder, `<report.json>`. The
`xss/no-mixed-html` rule scans strings passed to sink-like functions for HTML
and parsed `<report.json>` as an unclosed tag. The rule's heuristic is correct
in a browser and wrong in a CLI.

**Solution**:
```js
// Before — reads as an HTML tag to the rule:
console.error('usage: node scripts/x.mjs <report.json> [--update]')
// After — same meaning, no markup:
console.error('usage: node scripts/x.mjs report.json [--update]')
```

**Prevention**:
- Prefer bracketed or bare placeholders (`report.json`, `[--flag]`) over
  `<placeholder>` in strings a linter may treat as markup.
- Read `toolInfo.name` from the Codacy API before deciding a finding is a false
  positive: `ESLint8_*` is the engine identifier, and the rule id names the
  actual heuristic.
- A finding you can satisfy by rewording is not a false positive — fix it.
  Reserve suppression for patterns that are structurally unavoidable (for
  example `readFileSync` on a caller-supplied path in a CLI), and record the
  reason on the PR.

**Files Modified**:
- `scripts/check-bench-baseline.mjs` - usage string no longer looks like a tag

---
