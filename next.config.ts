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
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]);
  },
};

export default nextConfig;
