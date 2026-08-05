import type { NextConfig } from "next";

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
  // Static legacy → canonical redirects live here as zero-render 308s
  // (MESITA-899). Redirects with logic (query/tab mapping — /home, /me/[tab],
  // /inbox aliases, /saved/*) stay as server pages. Query strings are
  // preserved automatically. The redirect table is pinned by
  // src/lib/__tests__/consumer-route-contract.test.ts.
  async redirects() {
    return [
      // Explore era (pre-Home).
      { source: "/explore", destination: "/home", permanent: true },
      { source: "/explore/swipe", destination: "/home", permanent: true },
      { source: "/explore/map", destination: "/search", permanent: true },
      { source: "/explore/add", destination: "/search", permanent: true },
      {
        source: "/explore/place/:id",
        destination: "/place/:id",
        permanent: true,
      },
      // Pay era (the Rewards surface used to live at /pay).
      {
        source: "/pay/ticket/:id",
        destination: "/rewards/ticket/:id",
        permanent: true,
      },
      {
        source: "/pay/tickets/:id",
        destination: "/rewards/ticket/:id",
        permanent: true,
      },
      { source: "/pay/:tab", destination: "/rewards", permanent: true },
      { source: "/pay", destination: "/rewards", permanent: true },
      { source: "/qr", destination: "/rewards", permanent: true },
      {
        source: "/ticket/:id",
        destination: "/rewards/ticket/:id",
        permanent: true,
      },
      // Renamed surfaces.
      { source: "/invite", destination: "/share", permanent: true },
      { source: "/profile", destination: "/me", permanent: true },
      { source: "/notifications", destination: "/inbox/mine", permanent: true },
    ];
  },
};

export default nextConfig;
