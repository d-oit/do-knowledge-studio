const STATIC_CACHE = "dks-static-v6";
const API_CACHE = "dks-api-v2";
/**
 * Model weights and tokenizer files, cached apart from the app shell.
 *
 * The semantic runtime pulls ~25 MB from a CDN on first use. Keeping it in its
 * own cache means clearing the shell (a new build) does not force a re-download,
 * and clearing the model does not evict the app.
 */
const MODEL_CACHE = "dks-model-v1";

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

// Explicit allowlisted same-origin API routes eligible for SW network-first caching.
// Dynamic AI routes (/api/chat, local/remote LLM calls), web research proxies,
// WebRTC signaling, and user-specific subpaths are strictly excluded.
const ALLOWED_API_PATHS = new Set(["/api"]);

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

function isAllowlistedApiRequest(url) {
  if (url.origin !== self.location.origin) return false;
  const normalizedPath = url.pathname.replace(/\/$/, "");
  return ALLOWED_API_PATHS.has(normalizedPath);
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
  const validCaches = [STATIC_CACHE, API_CACHE, MODEL_CACHE];
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

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (
      response.ok &&
      !isUncacheableRequest(request) &&
      !isUncacheableResponse(response)
    ) {
      const cache = await caches.open(STATIC_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline — resource not cached", {
      status: 503,
      statusText: "Service Unavailable",
    });
  }
}

/**
 * Cache-first for model weights: the bytes are immutable per revision, so a
 * network round trip would only cost latency. A failed fetch returns 503 and
 * (deliberately) caches nothing, so the next attempt retries instead of
 * pinning an error response for the life of the cache.
 */
async function modelFirst(request) {
  const cache = await caches.open(MODEL_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (!isUncacheableResponse(response)) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline — model not cached", {
      status: 503,
      statusText: "Service Unavailable",
    });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (
      response.ok &&
      !isUncacheableRequest(request) &&
      !isUncacheableResponse(response)
    ) {
      const cache = await caches.open(API_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: "offline", message: "No cached response available" }),
      {
        status: 503,
        statusText: "Service Unavailable",
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

async function navigationFallback(request) {
  try {
    const response = await fetch(request);
    if (
      response.ok &&
      !isUncacheableRequest(request) &&
      !isUncacheableResponse(response)
    ) {
      const cache = await caches.open(STATIC_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match("/");
    return cached || new Response("Offline — page not available", {
      status: 503,
      statusText: "Service Unavailable",
    });
  }
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

  // Allowlisted API calls: network-first
  if (isAllowlistedApiRequest(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Default: network-first pass-through (no caching)
  event.respondWith(fetch(request));
});
