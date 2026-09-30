const STATIC_CACHE = "dks-static-v3";
const API_CACHE = "dks-api-v2";

const STATIC_EXTENSIONS = [
  ".js",
  ".mjs",
  ".css",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
  ".json",
  ".txt",
];

// Fallback shell, used only if the generated manifest cannot be fetched.
// The manifest (written by scripts/generate-precache-manifest.mjs after
// `next build`) is the real precache list: it is derived from the emitted
// HTML plus the emitted chunk/media inventories, so it always matches the
// code and hashed asset names the app actually requests.
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

function isApiRequest(url) {
  return url.pathname.startsWith("/api/");
}

function isNavigationRequest(request) {
  return (
    request.mode === "navigate" ||
    (request.method === "GET" &&
      request.headers.get("accept")?.includes("text/html"))
  );
}

// ── Install: pre-cache static app shell ──

self.addEventListener("install", (event) => {
  event.waitUntil(
    resolvePrecacheUrls()
      // Carry `urls` through the chain: an earlier version opened the cache in
      // the same callback that received them, so the precache step referenced
      // an out-of-scope `urls` and the install threw before caching anything.
      .then((urls) =>
        caches.open(STATIC_CACHE).then((cache) =>
          // Each entry is added independently rather than with addAll, which
          // is atomic: one 404 would reject the whole install and the worker
          // would never activate, costing the entire precache over one miss.
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
  const validCaches = [STATIC_CACHE, API_CACHE];
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
    if (response.ok) {
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

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
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
    if (response.ok) {
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

  // API calls: network-first
  if (isApiRequest(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Default: network-first pass-through (no caching)
  event.respondWith(fetch(request));
});
