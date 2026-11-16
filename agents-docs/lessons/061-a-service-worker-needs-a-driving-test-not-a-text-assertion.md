## LESSON-061: A service worker needs a driving test, not a text assertion

**Problem**: `pwa-service-worker.test.ts` was green for the whole round in which
`public/sw.js` answered "Service unavailable" for every embedding-model request.
It read the file with `readFileSync` and asserted that cache names and hosts
matched `pwa-cache.ts` — a consistency check on source text, which says nothing
about what the worker does at runtime. The worker was synthesising a 503 because
`cache.put` shared a `try` with the fetch, so a storage rejection was reported as
a network failure that never happened.

**Solution**:
```ts
const factory = new Function('self', 'caches', 'fetch', 'console', 'Request', source)
factory(fakeSelf, fakeCaches, fetchStub, quietConsole, ScopedRequest)
// fakeSelf.addEventListener captures the handlers; then drive them:
// handler({ request, respondWith: (p) => { responded = p } })
```

Two details make it usable rather than brittle: a fake `self` that records the
registered handlers instead of implementing them, and a `Request` subclass that
resolves relative URLs against the scope origin — a real worker resolves
`/_next/static/x.js` against its script URL, while Node's `Request` throws
`ERR_INVALID_URL`, so the harness would otherwise fail on correct code.

**Prevention**:
- A test that greps a file is a lint rule, not a test. If the module cannot be
  imported, evaluate it against a scope you control.
- For anything that runs inside `respondWith`, drive the failure path: a rejected
  cache write, a rejected eviction, a rejected `caches.open`. Those three are
  where the user-visible bug lived.
- When a static analyser flags an unhandled rejection inside a response handler,
  check whether it is the same class of defect you just fixed one layer down.
  Codacy's `detect-unhandled-async-errors` on `sw.js:237` was exactly that.

**Files Modified**:
- `src/lib/studio/pwa-service-worker.test.ts` - new harness, 13 tests
