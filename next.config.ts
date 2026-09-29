import type { NextConfig } from "next";
import path from "path";

// `connect-src` has to permit the local AI endpoint. The Ollama adapter fetches
// `${validateOllamaUrl(url)}/api/chat`, and that validator only accepts `localhost`,
// loopback addresses, or `.local` hostnames (see src/lib/ai/providers.ts). Without
// these sources the default `http://localhost:11434` is rejected by CSP before the
// request ever reaches Ollama, silently breaking the built-in local provider.
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https:;
  font-src 'self' data:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  worker-src 'self' blob:;
  connect-src 'self' https: wss: http://localhost:* http://127.0.0.1:* http://[::1]:* http://*.local:*;
`.replace(/\s{2,}/g, ' ').trim();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // React Compiler (stable in Next.js 16) auto-memoizes components and hooks,
  // completing the deferred Task 141 rerender audit (see plans/128 and issue #699).
  reactCompiler: true,
  // Typecheck scope for `next build` (Plan 158 P1-1).
  //
  // Next 16 flipped the default typechecker to the raw CLI `tsc --project`,
  // which resolves this config. Previously `experimental.useTypeScriptCli:
  // false` swapped back to the compiler-API checker so `next build` would
  // skip the repo's intentionally-loose test sources — but that (a) printed
  // an "Experiments (use with caution)" banner on every build, which this
  // repo's zero-warning rule forbids, and (b) opts into the exact path
  // Next's own upgrade guide says breaks when TypeScript 7 drops the
  // compiler API.
  //
  // Pointing the CLI checker at a config that excludes test sources keeps
  // app code fully typechecked (the 94 pre-existing errors are all in tests,
  // which tsconfig.app.json already excluded for `pnpm typecheck`) with no
  // banner and no dependency on a compiler API that is going away.
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
