### LESSON-057: `page.evaluate` bypasses CSP, so an in-page eval probe proves nothing

**Date**: 2026-11-01
**Component**: E2E / CSP / Playwright
**Severity**: Medium

**Issue**: Verifying that production CSP no longer allows `'unsafe-eval'`, an
in-page probe ran `new Function('return 1')()` and reported success — which read
as "the policy still permits eval" and contradicted the served header.

**Symptoms**:
- `curl -sI` showed `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'`: no
  `'unsafe-eval'`.
- The same page reported `new Function` evaluating fine and
  `WebAssembly.compile` succeeding, i.e. the probe said the opposite.
- No `securitypolicyviolation` events were logged while the app hydrated,
  navigated, searched, and chatted.

**Root Cause**:
Playwright's `page.evaluate` sends `Runtime.evaluate` over CDP. Chrome treats
protocol-initiated (DevTools/console) evaluation as exempt from the CSP script
checks, so both `new Function` and `WebAssembly.compile` run under any policy.
The probe could not fail, so it carried no information (LESSON-046).

**Solution**:
```bash
# Assert the policy itself, from the response — not from inside the page.
curl -sI http://127.0.0.1:3000 | grep -i content-security-policy
```
Then exercise real application code and count `securitypolicyviolation` events
and console CSP errors, which is what a broken policy actually produces.

**Prevention**:
- Before trusting an assertion executed inside the page under test, ask what
  would make it fail. If nothing can, it is decoration.
- Devtools/CDP-injected script is not subject to the page's CSP; header
  assertions belong on the transport, behaviour assertions in the app.
- A probe result that disagrees with a directly observed artifact (the header)
  is evidence about the probe first, not about the system.

**Files Modified**:
- `plans/192-real-model-eval-and-csp-hardening-2026-11-01.md` - records the
  invalid probe instead of claiming it verified the policy

---
