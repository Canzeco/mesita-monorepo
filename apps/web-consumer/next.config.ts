import path from "node:path";
import type { NextConfig } from "next";

import { LEGACY_REDIRECTS, withSurfaceTwins } from "./src/lib/legacy-redirects";

const appDir = __dirname;
const repoRoot = path.resolve(appDir, "../..");

// Absolute aliases become `./vercel/path0/...` once turbopack.root is the
// repo. Paths are relative to that root so the server build can resolve them.
function packageAlias(name: string): string {
  const relative = path
    .relative(repoRoot, path.join(appDir, "node_modules", name))
    .split(path.sep)
    .join("/");
  return `./${relative}`;
}

// Identity of THIS build, baked into the client bundle. Vercel sets
// VERCEL_GIT_COMMIT_SHA at build time; locally it's "dev". The DeploymentWatcher
// compares this against the live /api/version to detect a newer production
// build and self-refresh (defeats deployment skew — stale JS in an open tab).
const buildSha =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.NEXT_PUBLIC_BUILD_SHA ??
  "dev";

const nextConfig: NextConfig = {
  agentRules: false,
  transpilePackages: ["@mesita/place-profile"],
  // Tailwind reads packages/place-profile. Turbopack refuses that tree unless
  // the root includes it. Aliases keep this app's own React and Next.
  turbopack: {
    root: repoRoot,
    resolveAlias: {
      react: packageAlias("react"),
      "react-dom": packageAlias("react-dom"),
      next: packageAlias("next"),
      "lucide-react": packageAlias("lucide-react"),
      clsx: packageAlias("clsx"),
      "tailwind-merge": packageAlias("tailwind-merge"),
    },
  },
  env: {
    NEXT_PUBLIC_BUILD_SHA: buildSha,
  },
  images: {
    // Photos can come from Google Places (lh*.googleusercontent.com),
    // Firecrawl-scraped place sites, and partner CDNs.
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
