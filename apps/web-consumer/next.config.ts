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
      // The centre tab: /pay -> /rewards -> /new-visit. Both the /pay era AND
      // the /rewards era forward here now; /rewards and /rewards/ticket/:id
      // were the LIVE urls until this change, so they need the forwarding
      // address most, and everything else in this block used to chain through
      // them (MESITA-1062 eng review, A5).
      // The plan moved from a page to a sheet on Me (MESITA-1129). Both the
      // bare prefix and the /subscribe/premium URL forward — the latter was
      // the LIVE url and is what any external link (an iOS link-out, a
      // receipt email) would still carry.
      { source: "/subscribe", destination: "/me", permanent: true },
      { source: "/subscribe/:plan", destination: "/me", permanent: true },
      { source: "/rewards", destination: "/new-visit", permanent: true },
      { source: "/pay", destination: "/new-visit", permanent: true },
      { source: "/pay/:tab", destination: "/new-visit", permanent: true },
      { source: "/qr", destination: "/new-visit", permanent: true },
      // A single visit. The OBJECT is still a ticket; only the URL says visit.
      {
        source: "/rewards/ticket/:id",
        destination: "/visit/:id",
        permanent: true,
      },
      { source: "/pay/ticket/:id", destination: "/visit/:id", permanent: true },
      {
        source: "/pay/tickets/:id",
        destination: "/visit/:id",
        permanent: true,
      },
      { source: "/ticket/:id", destination: "/visit/:id", permanent: true },
      // Renamed surfaces.
      { source: "/home/ai", destination: "/home/chat", permanent: true },
      { source: "/invite", destination: "/share", permanent: true },
      // Credits shipped standalone at /credits (#1429) and moved under Inbox
      // when it became a section. It was live in production, so the bookmarks
      // are real. route-structure.test.tsx T7 asserts this entry still exists
      // — T4 can only validate a redirect's DESTINATION, never its absence.
      { source: "/credits", destination: "/inbox/credits", permanent: true },
      { source: "/profile", destination: "/me", permanent: true },
      {
        source: "/notifications",
        destination: "/inbox/notifications",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
