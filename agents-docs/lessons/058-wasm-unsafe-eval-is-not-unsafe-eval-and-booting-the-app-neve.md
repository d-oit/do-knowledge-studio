### LESSON-058: `'wasm-unsafe-eval'` is not `'unsafe-eval'`, and booting the app never tells you which you needed

**Date**: 2026-11-01
**Component**: CSP / Search / Verification
**Severity**: High

**Issue**: `'unsafe-eval'` was removed from the production `script-src` on the
reasoning that React's production build does not need it and
`'wasm-unsafe-eval'` covers the WebAssembly embedding runtime. The app booted,
hydrated, navigated, searched and chatted with zero violations — so the change
looked verified.

**Symptoms**:
- Nothing. Every user-visible flow worked; no console errors; no violation
  events during boot, navigation, lexical search or chat.
- Only the feature that needs `eval` could reveal it, and that feature sits
  behind a toggle that calls into the semantic runtime lazily.

**Root Cause**:
`'wasm-unsafe-eval'` permits **WebAssembly compilation** and nothing else.
`onnxruntime-web`, loaded through transformers.js, compiles JavaScript with
`eval`; with only the wasm directive present the browser refused it and the
semantic path fell back to lexical. Booting an app exercises none of the code
that fails, so "it works" was evidence about the shell, not about the policy.

**Solution**:
```ts
// A listener registered before hydration DOES observe refusals (unlike an
// in-page eval probe, which CDP exempts — LESSON-057).
await page.addInitScript(() => {
  window.__csp = []
  document.addEventListener('securitypolicyviolation', (e) =>
    window.__csp.push(`${e.violatedDirective} -> ${e.blockedURI}`),
  )
})
// With the directive removed this records: "script-src -> eval".
```
Then restore the directive the evidence says is required, and re-drive to
confirm zero refusals.

**Prevention**:
- A CSP tightening is verified by driving the feature that depends on the
directive, not by the app rendering. Enumerate which directives each runtime
  needs before removing one.
- Treat `'wasm-unsafe-eval'` as additive. It never stands in for `'unsafe-eval'`.
- When a policy removal "passes", say which flows ran. `securitypolicyviolation`
  counts after exercising the lazy path are the only counts worth quoting.

**Files Modified**:
- `next.config.ts` - production `script-src` restored, with the measurement and
  the reason recorded beside the constant
- `plans/192-real-model-eval-and-csp-hardening-2026-11-01.md` - round-2 evidence

---
