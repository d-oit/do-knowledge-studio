import type { NextConfig } from "next";
import path from "path";

// `connect-src` has to permit the local AI endpoint. The Ollama adapter fetches
// `${validateOllamaUrl(url)}/api/chat`, and that validator only accepts `localhost`,
// loopback addresses, or `.local` hostnames (see src/lib/ai/providers.ts). Without
// these sources the default `http://localhost:11434` is rejected by CSP before the
// request ever reaches Ollama, silently breaking the built-in local provider.
// Plaintext `ws://` is permitted only for loopback: the independent-peer E2E
// suite runs the y-webrtc signaling server there, while production signaling
// remains `wss://`.
//
// IPv6 loopback is deliberately absent: a port wildcard on a bracketed IPv6
// host (`http://[::1]:*`) is rejected by the CSP parser as an invalid source
// and logged as an error on every page load, while matching nothing. Loopback
// Ollama is covered by the named-host sources below. Found by driving a
// production build in Chromium (plan 191).
// `'unsafe-eval'` is required in production, and that is measured rather than
// assumed: driving a production build in Chromium with the directive removed
// logged a real violation (script-src, blocked URI `eval`) from the semantic
// runtime (`onnxruntime-web` via transformers.js), which compiles with `eval`.
// `'wasm-unsafe-eval'` permits WebAssembly compilation and does NOT cover that,
// so it is an addition to `'unsafe-eval'`, never a substitute. With the
// directive restored, the same drive records no violation. Dropping it would
// ship a permanently lexical fallback behind a working-looking toggle. Issue
// #1051 keeps the remaining `'unsafe-inline'`
// from `script-src`, which needs a nonce pipeline Next does not emit today.
// One constant for both environments, deliberately. The branches were
// identical, and a per-environment shape invites the exact mistake this file
// already made once: "tightening" production by removing eval, which the
// semantic runtime needs. If a future Next build stops using eval, prove it
// with a drive that reaches the semantic runtime, not with the shell.
const scriptSrc = "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval';";

const cspHeader = `
  default-src 'self';
  ${scriptSrc}
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https:;
  font-src 'self' data:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  worker-src 'self' blob:;
  connect-src 'self' https: wss: ws://localhost:* ws://127.0.0.1:* http://localhost:* http://127.0.0.1:* http://*.local:*;
`.replace(/\s{2,}/g, ' ').trim();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The independent-peer E2E suite serves the same dev app on 127.0.0.1 as
  // well as localhost so the two contexts have distinct origins (and therefore
  // distinct storage/BroadcastChannel partitions). Next blocks HMR/dev
  // resources from unlisted origins, which prevents hydration on the second
  // origin. This only widens dev-server origin checks; production builds are
  // unaffected, and the address is loopback.
  allowedDevOrigins: ["127.0.0.1"],
  // P2-5: do not advertise the framework. This config already curates CSP,
  // nosniff, and frame-ancestors; the default x-powered-by header was the one
  // unhardened piece of the response.
  poweredByHeader: false,
  // React Compiler (stable in Next.js 16) auto-memoizes components and hooks,
  // completing the deferred Task 141 rerender audit (see plans/128 and issue #699).
  reactCompiler: true,
  // Next's CLI typechecker uses a separate app-only config during builds.
  // The test sources remain covered by `tsconfig.test.json` and Vitest's
  // configured typecheck, without relying on Next's compiler-API checker.
  typescript: {
    tsconfigPath: "tsconfig.build.json",
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  headers() {
    return Promise.resolve([
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: cspHeader },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          // Single source of truth for the referrer policy. The layout's
          // `metadata.referrer` used to disagree with this header
          // ('no-referrer' vs 'strict-origin-when-cross-origin'), so a
          // maintainer reading either one alone drew the wrong conclusion.
          // Plan 158 P1-3.
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ]);
  },
};

export default nextConfig;
