import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  // React Compiler (stable in Next.js 16) auto-memoizes components and hooks,
  // completing the deferred Task 141 rerender audit (see plans/128 and issue #699).
  reactCompiler: true,
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
