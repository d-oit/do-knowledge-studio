### LESSON-060: A cache write inside the fetch's `try` block reports a storage rejection as a network outage

**Date**: 2026-11-01
**Component**: Service worker / Search
**Severity**: High

**Issue**: Semantic search reported "Service unavailable" for the model's
`tokenizer_config.json` on every attempt, for days, across several rounds of
investigation. `curl` returned 200 for every header combination tried — including
browser `Origin`, `Referer`, a Chrome user agent and `Sec-Fetch-*` — and an
in-page `fetch()` of the same URL returned `200, type: cors`. The network was
never the problem.

**Symptoms**:
- transformers.js: `Service unavailable error occurred while trying to load file`.
- CORS-wise the file was fine; `curl` and page `fetch` both succeeded.

**Root Cause**:
Every strategy had `cache.put` inside the same `try` as `fetch`, and the `catch`
returned a 503 stub. `cache.put` *rejects* for responses the Cache API will not
store, so a storage rejection was caught and reported as a failed network
request. Instrumenting `window.fetch` and reading the failing body identified it
immediately — it was the service worker's own text:

```json
{ "status": 503, "type": "basic", "body": "Offline — model not cached" }
```

`type: "basic"` was the tell: the response never came off the network.

**Solution**:
```js
async function cacheWrite(cache, request, response) {
  try { await cache.put(request, response.clone()) }
  catch (error) { console.warn("[sw] cache write failed", request.url, error) }
}
// fetch first, return the response regardless; cache opportunistically
```

**Prevention**:
- Never let an optimisation decide the outcome. Cache reads and writes are
  separate `try` blocks from the fetch, always.
- A synthesised offline response must be distinguishable from a real one —
  `response.type` and a body nobody would confuse for server text.
- Read the failing response body before believing the error message a library
  reports. "Service unavailable" was a message about *our* stub, not the CDN.

**Files Modified**:
- `public/sw.js` - `cacheWrite` helper; all four strategies fetch-then-cache
- `next.config.ts` - `blob:` added to `script-src` for onnxruntime's WASM loader
