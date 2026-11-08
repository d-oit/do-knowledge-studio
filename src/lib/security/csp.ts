/**
 * Content-Security-Policy allowlists for #1051.
 *
 * Single source of truth for the production CSP `connect-src` / `img-src`
 * contract. `next.config.ts` builds the header from these constants; unit
 * tests pin the invariant (no blanket `https:` / `wss:` in `connect-src`);
 * the service worker mirrors the model hosts (`MODEL_ASSET_HOSTS`).
 *
 * Residual risk: `script-src` keeps `'unsafe-eval'` because the semantic
 * runtime (`onnxruntime-web` via transformers.js) compiles with `eval` in
 * production — measured with a Chromium drive (see `next.config.ts`). Removing
 * it ships a permanently lexical fallback behind a working-looking toggle.
 * `'unsafe-inline'` for scripts stays until Next emits nonces without breaking
 * the precache/offline contract (ADR 041).
 */

/** AI provider origin (OpenRouter gateway). */
export const OPENROUTER_ORIGIN = 'https://openrouter.ai';

/** Embedding model hosts served to transformers.js / cached by the SW. */
export const MODEL_CSP_HOSTS = [
  'https://huggingface.co',
  'https://cdn-lfs.huggingface.co',
  'https://cdn-lfs.hf.co',
  'https://cdn.jsdelivr.net',
] as const;

/** Default public signaling endpoint for y-webrtc (see `discovery.ts`). */
export const SIGNALING_CSP_HOSTS = ['wss://y-webrtc-eu.fly.dev'] as const;

/** Loopback sources for local Ollama + local signaling (validator-checked). */
export const LOOPBACK_CSP_SOURCES = [
  'ws://localhost:*',
  'ws://127.0.0.1:*',
  'http://localhost:*',
  'http://127.0.0.1:*',
  'http://*.local:*',
] as const;

/** Explicit `connect-src` allowlist — no blanket `https:` / `wss:`. */
export const CONNECT_SRC_SOURCES: readonly string[] = [
  "'self'",
  OPENROUTER_ORIGIN,
  ...MODEL_CSP_HOSTS,
  ...SIGNALING_CSP_HOSTS,
  ...LOOPBACK_CSP_SOURCES,
];

/** `img-src` allowlist: app shell + model hosts + data/blob for local art. */
export const IMG_SRC_SOURCES: readonly string[] = [
  "'self'",
  'blob:',
  'data:',
  'https://huggingface.co',
  'https://cdn-lfs.huggingface.co',
];

/** Restrictive permissions policy — no camera/mic/geolocation need. */
export const PERMISSIONS_POLICY_VALUE =
  'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()';

export const CROSS_ORIGIN_OPENER_POLICY_VALUE = 'same-origin-allow-popups';
