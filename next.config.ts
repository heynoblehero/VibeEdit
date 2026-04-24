import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@remotion/bundler",
    "@remotion/renderer",
    "@remotion/compositor-linux-x64-gnu",
    "@remotion/compositor-linux-x64-musl",
    "esbuild",
  ],
};

export default nextConfig;
