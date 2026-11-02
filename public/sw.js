const STATIC_CACHE = "dks-static-v6";
/**
 * Model weights and tokenizer files, cached apart from the app shell.
 *
 * The semantic runtime pulls ~25 MB from a CDN on first use. Keeping it in its
 * own cache means clearing the shell (a new build) does not force a re-download,
 * and clearing the model does not evict the app.
 */
const MODEL_CACHE = "dks-model-v1";

/**
 * Total bytes the model cache may hold before the oldest entries are dropped.
 *
 * The model is ~25 MB; the budget leaves room for a second model plus chunked
 * variants without letting a misconfigured host fill the origin's storage
 * quota. Mirrors `MODEL_CACHE_MAX_BYTES` in src/lib/studio/pwa-cache.ts.
 */
const MODEL_CACHE_MAX_BYTES = 120 * 1024 * 1024;

/**
 * Extensions served cache-first.
 *
 * Must cover every extension `scripts/generate-precache-manifest.mjs` can put in
 * the manifest (`MEDIA_EXTENSIONS` + the code extensions): a URL that is
 * precached but not matched here falls through to the network and is missing
 * offline — the exact failure the manifest exists to prevent (`.avif` was
 * precached-but-unserved until this list gained it).
 */
const STATIC_EXTENSIONS = [
  ".js",
  ".mjs",
  ".css",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".avif",
  ".gif",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
  ".json",
  ".webmanifest",
  ".txt",
];

// Fallback shell, used only if the generated manifest cannot be fetched.
// The manifest is derived from the selected local or adapter static inventory,
// with fixed shell URLs added by scripts/generate-precache-manifest.mjs.
const PRECACHE_MANIFEST_URL = "/precache-manifest.json";
const FALLBACK_PRECACHE_URLS = [
  "/",
  "/favicon.svg",
  "/logo.svg",
  "/manifest.webmanifest",
];

/** Fetches the generated precache list, falling back on any failure. */
async function resolvePrecacheUrls() {
  try {
    const response = await fetch(PRECACHE_MANIFEST_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`manifest ${response.status}`);
    const manifest = await response.json();
    if (!Array.isArray(manifest.urls) || manifest.urls.length === 0) {
      throw new Error("manifest has no urls");
    }
    return manifest.urls;
  } catch (error) {
    // A partial shell still beats none: the runtime cache-first strategy
    // backfills chunks as the user browses.
    console.warn(
      "[sw] precache manifest unavailable, using fallback list:",
      error instanceof Error ? error.message : error
    );
    return FALLBACK_PRECACHE_URLS;
  }
}

function isStaticAsset(url) {
  return STATIC_EXTENSIONS.some((ext) => url.pathname.endsWith(ext));
}

/**
 * Hosts that serve the embedding model to transformers.js.
 *
 * Mirrors `MODEL_ASSET_HOSTS` in src/lib/studio/pwa-cache.ts, which the unit
 * tests exercise; this file is plain JS served from public/ and cannot import
 * it. Keep the two lists identical.
 */
const MODEL_HOSTS = new Set([
  "huggingface.co",
  "www.huggingface.co",
  "cdn-lfs.huggingface.co",
  "cdn-lfs.hf.co",
]);

/**
 * Model assets are recognised by host, not extension. Matching on `.json`
 * (a static extension) would route the tokenizer into the shell cache, and
 * `.onnx` is not in that list at all — so the download only survives a reload
 * if it is handled before the static-asset branch.
 */
function isModelAsset(url) {
  return MODEL_HOSTS.has(url.hostname);
}

function isNavigationRequest(request) {
  return (
    request.mode === "navigate" ||
    (request.method === "GET" &&
      request.headers.get("accept")?.includes("text/html"))
  );
}

function isSafeMethod(method) {
  const m = method.toUpperCase();
  return m === "GET" || m === "HEAD";
}

function isUncacheableRequest(request) {
  if (!isSafeMethod(request.method)) return true;
  if (request.headers.get("authorization") || request.headers.get("cookie")) {
    return true;
  }
  const cacheControl = request.headers.get("cache-control") || "";
  const pragma = request.headers.get("pragma") || "";
  if (
    cacheControl.includes("no-store") ||
    cacheControl.includes("no-cache") ||
    pragma.includes("no-cache")
  ) {
    return true;
  }
  return false;
}

function isUncacheableResponse(response) {
  if (!response.ok) return true;
  const cacheControl = response.headers.get("cache-control") || "";
  if (cacheControl.includes("private") || cacheControl.includes("no-store")) {
    return true;
  }
  return false;
}

// ── Install: pre-cache static app shell ──

self.addEventListener("install", (event) => {
  event.waitUntil(
    resolvePrecacheUrls()
      .then((urls) =>
        caches.open(STATIC_CACHE).then((cache) =>
          Promise.all(
            urls.map((url) =>
              cache.add(new Request(url, { cache: "reload" })).catch((error) => {
                console.warn("[sw] precache miss", url, error);
              })
            )
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

// ── Activate: purge old caches ──

self.addEventListener("activate", (event) => {
  const validCaches = [STATIC_CACHE, MODEL_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => !validCaches.includes(name))
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Strategies ──

/**
 * Stores a response without letting the write decide the outcome.
 *
 * `cache.put` rejects for responses the Cache API refuses to store — a
 * redirected response, a `Vary: *` header, a full quota. When the write shared a
 * try block with the fetch, that rejection was caught and reported as a 503:
 * transformers.js surfaced "Service unavailable", the embedding model never
 * loaded, and every render of the semantic path fell back to BM25 — while the
 * bytes had actually arrived. A cache is an optimisation. A failed write is
 * logged, and the response is returned either way.
 */
async function cacheWrite(cache, request, response) {
  try {
    await cache.put(request, response.clone());
  } catch (error) {
    console.warn("[sw] cache write failed", request.url, error);
  }
}

/**
 * Drops the oldest model entries until the cache fits its budget.
 *
 * `cache.keys()` returns insertion order, so the first entries are the least
 * recently added. Bytes are read from `content-length`; an entry that does not
 * report one counts as zero, which can only make eviction more conservative.
 */
async function evictModelCacheOverBudget(cache) {
  // Every Cache API call here can reject (quota, invalidated cache, private
  // mode). This runs inside `respondWith`, so an unhandled rejection would
  // break the response the model loading depends on — the same defect as a
  // failed write masking a good fetch, one layer up. Eviction is maintenance:
  // log it and let the caller proceed.
  try {
    let total = 0;
    const entries = [];
    for (const request of await cache.keys()) {
      const response = await cache.match(request);
      const bytes = Number(response?.headers.get("content-length") ?? 0) || 0;
      entries.push({ request, bytes });
      total += bytes;
    }
    for (const entry of entries) {
      if (total <= MODEL_CACHE_MAX_BYTES) break;
      await cache.delete(entry.request);
      total -= entry.bytes;
    }
  } catch (error) {
    console.warn("[sw] model cache eviction failed", error);
  }
}

/**
 * Opens a named cache, or returns null when the Cache API is unavailable.
 *
 * `caches.open` rejects when storage is blocked or the origin is out of quota.
 * Returning null lets every caller fall through to the network instead of
 * rejecting a response it already had.
 */
async function openCache(name) {
  try {
    return await caches.open(name);
  } catch (error) {
    console.warn("[sw] cache unavailable", name, error);
    return null;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request).catch(() => undefined);
  if (cached) return cached;

  let response;
  try {
    response = await fetch(request);
  } catch {
    return new Response("Offline — resource not cached", {
      status: 503,
      statusText: "Service Unavailable",
    });
  }
  if (
    response.ok &&
    !isUncacheableRequest(request) &&
    !isUncacheableResponse(response)
  ) {
    const cache = await openCache(STATIC_CACHE);
    if (cache !== null) await cacheWrite(cache, request, response);
  }
  return response;
}

/**
 * Cache-first for model weights: the bytes are immutable per revision, so a
 * network round trip would only cost latency. A failed fetch returns 503 and
 * (deliberately) caches nothing, so the next attempt retries instead of
 * pinning an error response for the life of the cache.
 */
async function modelFirst(request) {
  const cache = await openCache(MODEL_CACHE);
  const cached = cache ? await cache.match(request).catch(() => undefined) : undefined;
  if (cached) return cached;

  let response;
  try {
    response = await fetch(request);
  } catch {
    // A real network failure, not a cache write failure: the distinction is the
    // whole point of separating them.
    return new Response("Offline — model not cached", {
      status: 503,
      statusText: "Service Unavailable",
    });
  }
  if (cache !== null && !isUncacheableResponse(response)) {
    await cacheWrite(cache, request, response);
    await evictModelCacheOverBudget(cache);
  }
  return response;
}

async function navigationFallback(request) {
  let response;
  try {
    response = await fetch(request);
  } catch {
    const cached = await caches.match("/").catch(() => undefined);
    return cached || new Response("Offline — page not available", {
      status: 503,
      statusText: "Service Unavailable",
    });
  }
  if (
    response.ok &&
    !isUncacheableRequest(request) &&
    !isUncacheableResponse(response)
  ) {
    const cache = await openCache(STATIC_CACHE);
    if (cache !== null) await cacheWrite(cache, request, response);
  }
  return response;
}

// ── Fetch handler ──

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-HTTP(S) and chrome-extension requests
  if (!url.protocol.startsWith("http")) return;

  // Pass non-GET/HEAD or uncacheable requests straight to network without SW strategy caching
  if (isUncacheableRequest(request)) {
    event.respondWith(fetch(request));
    return;
  }

  // Embedding model assets: cache-first, so a warm cache needs no CDN.
  if (isModelAsset(url)) {
    event.respondWith(modelFirst(request));
    return;
  }

  // Page navigations: network-first with / fallback
  if (isNavigationRequest(request)) {
    event.respondWith(navigationFallback(request));
    return;
  }

  // Static assets: cache-first
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Default: network-first pass-through (no caching)
  event.respondWith(fetch(request));
});
