### LESSON-059: Cross-origin model assets must be routed by host, not by extension

**Date**: 2026-11-01
**Component**: PWA / Service worker / Search
**Severity**: Medium

**Issue**: Adding offline caching for the embedding model, the obvious fix was
to let the existing static-asset strategy handle it — the files are `.json` and
`.onnx`, and `.json` is already in `STATIC_EXTENSIONS`.

**Symptoms**: None, until offline: the tokenizer landed in the shell cache that
every deploy wipes, the weights were never cached at all, and a cold cache still
needed the CDN.

**Root Cause**:
Two different mistakes in one shortcut. `.json` **is** a static extension, so the
tokenizer was routed to the wrong cache — the one cleared on every deploy.
`.onnx` is **not** in the list, so it fell through to the no-caching default.
Extension says nothing about where a model asset belongs; host does.

**Solution**:
```js
// Before the static-asset branch, and matched by host:
const MODEL_HOSTS = new Set(['huggingface.co', 'cdn-lfs.huggingface.co', /* … */])
function isModelAsset(url) { return MODEL_HOSTS.has(url.hostname) }
```
Plus: keep the model cache in `validCaches` so a build does not evict it, and do
**not** cache failed fetches, or a transient 503 gets pinned for the cache's life.

**Prevention**:
- Route by the property that actually determines ownership (origin, purpose),
  not by a filename suffix shared with unrelated assets.
- A duplicated constant in plain JS (`public/sw.js`) cannot import the typed
  module — assert the copies match by reading the file in a unit test. The drift
  would otherwise only appear offline.

**Files Modified**:
- `public/sw.js` - `dks-model-v1` cache, host-matched, cache-first
- `src/lib/studio/pwa-cache.ts` - mirrored host list and cache name
- `src/lib/studio/pwa-cache-policy.test.ts` - parity assertion against `sw.js`

---
