import type { NextConfig } from "next";

import { LEGACY_REDIRECTS, withSurfaceTwins } from "./src/lib/legacy-redirects";

// Identity of THIS build, baked into the client bundle. Vercel sets
// VERCEL_GIT_COMMIT_SHA at build time; locally it's "dev". The DeploymentWatcher
// compares this against the live /api/version to detect a newer production
// build and self-refresh (defeats deployment skew — stale JS in an open tab).
const buildSha =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.NEXT_PUBLIC_BUILD_SHA ??
  "dev";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_SHA: buildSha,
  },
  images: {
    // Photos can come from Google Places (lh*.googleusercontent.com),
    // Firecrawl-scraped place sites, Unsplash mocks, and partner CDNs.
    // The wildcard accepts any HTTPS host — tighten if/when we want
    // strict provenance.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // The legacy table lives in src/lib/legacy-redirects.ts. Every entry is
  // served bare AND under /web and /mob (MESITA-2138): redirects() matches
  // the browser's URL, which still carries the surface prefix.
  async redirects() {
    return [...LEGACY_REDIRECTS, ...withSurfaceTwins(LEGACY_REDIRECTS)];
  },
};

export default nextConfig;
