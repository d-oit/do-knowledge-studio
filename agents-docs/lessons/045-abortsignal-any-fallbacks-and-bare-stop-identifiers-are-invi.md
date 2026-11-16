### LESSON-045: `AbortSignal.any` fallbacks and bare `stop` identifiers are invisible to the type checker

**Date**: 2026-10-12
**Component**: AI harness / browser APIs
**Severity**: Medium

**Issue**: Two defects in the same feature survived a green unit suite and a
green CI run: a request timeout that silently did nothing on some engines, and a
"Stop" button that called `window.stop` instead of aborting the request.

**Symptoms**:
- `AbortSignal.timeout` existed and `AbortSignal.any` did not: the fallback
  passed only `controller.signal`, so the turn could hang forever
- `onStop={stop}` compiled and type-checked because `Window.stop` is `() => void`
  — the same signature as the hook's callback

**Root cause**:
1. Composing signals with a **fallback** turned "this API is missing" into
   "this feature is missing", with no error and no test coverage of that branch.
2. Passing a bare identifier that *also exists as a browser global* defers the
   mistake to the type checker, which cannot help because the shapes match.

**Prevention**:
- Do not feature-detect a *pair* of APIs to implement one behaviour. Arm the
  behaviour with `setTimeout` + `AbortController` (ES2017-era, no detection
  needed, one code path) and pass the controller's own signal.
- A "Stop/cancel/close" callback that is not destructured from its source is a
  trap in `'use client'` components: always destructure it (`const { stop } =
  useHook()`), and prove the wiring with a test that asserts the **in-flight
  request is aborted**, not that a handler was called.
- When a fix claims a compatibility fallback, test the fallback: delete the
  newer APIs (`delete AbortSignal.any`) inside the test before driving the path.

**Tags**: #react #browser-api #abort #timeout #types #verification

---
