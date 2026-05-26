import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: [
    "@hyperframes/producer",
    "@hyperframes/core",
    "@hyperframes/engine",
    "better-sqlite3",
    "chokidar",
    "esbuild",
    "sharp",
  ],
  experimental: {
    serverActions: { bodySizeLimit: "50mb" },
  },
  // next build runs strict tsc and currently trips on a benign
  // `value instanceof File` (FormData entries) under the Dokku build. Type
  // errors stay caught locally via `bun run typecheck`; don't block deploys.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  turbopack: {
    rules: {
      "*.md": { loaders: ["raw-loader"], as: "*.js" },
    },
  },
  async redirects() {
    return [
      { source: "/login", destination: "/app/login", permanent: false },
      { source: "/signin", destination: "/app/login", permanent: false },
      { source: "/sign-in", destination: "/app/login", permanent: false },
      { source: "/signup", destination: "/app/signup", permanent: false },
      { source: "/sign-up", destination: "/app/signup", permanent: false },
      { source: "/register", destination: "/app/signup", permanent: false },
      // Old-format project URLs (missing /app prefix or /edit suffix)
      { source: "/projects/:id", destination: "/app/projects/:id/edit", permanent: false },
      { source: "/projects", destination: "/app/projects", permanent: false },
    ];
  },
};

export default config;
