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
  // (MESITA-899). Redirects with logic (query mapping — /me/[tab]) stay as
  // server pages. Query strings are preserved automatically. The redirect
  // table is pinned by src/lib/__tests__/consumer-route-contract.test.ts;
  // route-structure T4 proves every destination resolves in at most two hops
  // and T7 proves the load-bearing entries exist.
  //
  // A REDIRECT WHOSE SOURCE IS A LIVE ROUTE SHADOWS IT ENTIRELY — the page
  // never renders and typecheck, build and the whole vitest suite stay green.
  // Nothing here may name /pay, /discover/feed, /discover/scroll,
  // /discover/chat, /discover/favs, /search, /me or any live /me/<box>.
  async redirects() {
    return [
      // Explore era (pre-Home). Straight to the Discover default.
      { source: "/explore", destination: "/discover/feed", permanent: true },
      { source: "/explore/swipe", destination: "/discover/scroll", permanent: true },
      { source: "/explore/map", destination: "/discover/feed", permanent: true },
      { source: "/explore/add", destination: "/discover/feed", permanent: true },
      {
        source: "/explore/place/:id",
        destination: "/place/:id",
        permanent: true,
      },
      // THE SECOND STAGE (MESITA-2087). Pay is one page, the Soon state, and
      // every address that used to hang off the centre tab lands on it: the
      // QR place list (/new-visit), THE TICKET (/visit/:id and its /rewards,
      // /pay and /ticket era spellings), Wallet with Buy · Gift · Redeem ·
      // balance and its /credits, /inbox/credits and /new-visit/wallet
      // spellings, the Order tab, and the public gift landing. Each is ONE
      // hop. Deepest sources first so the intent survives a `:param` rewrite.
      { source: "/new-visit/wallet/:path*", destination: "/pay", permanent: true },
      { source: "/new-visit/wallet", destination: "/pay", permanent: true },
      { source: "/new-visit", destination: "/pay", permanent: true },
      { source: "/wallet/:path*", destination: "/pay", permanent: true },
      { source: "/wallet", destination: "/pay", permanent: true },
      { source: "/credits", destination: "/pay", permanent: true },
      { source: "/inbox/credits", destination: "/pay", permanent: true },
      { source: "/inbox/orders", destination: "/pay", permanent: true },
      { source: "/order", destination: "/pay", permanent: true },
      { source: "/rewards/ticket/:id", destination: "/pay", permanent: true },
      { source: "/rewards", destination: "/pay", permanent: true },
      { source: "/pay/ticket/:id", destination: "/pay", permanent: true },
      { source: "/pay/tickets/:id", destination: "/pay", permanent: true },
      { source: "/pay/:tab", destination: "/pay", permanent: true },
      { source: "/qr", destination: "/pay", permanent: true },
      { source: "/ticket/:id", destination: "/pay", permanent: true },
      { source: "/visit/:id", destination: "/pay", permanent: true },
      { source: "/gift/:code", destination: "/pay", permanent: true },
      // Me's Second Stage boxes (MESITA-2087): the class ladder, the Diamond
      // pair and its invite PIN, Plan and the Premium checkout, Visits,
      // Metrics, the Passport, the referral Share deck. The `/me/[tab]`
      // catch-all already 308s a retired ONE-segment /me address onto the
      // hub; the two-segment ones need an entry or they 404.
      { source: "/subscribe", destination: "/me", permanent: true },
      { source: "/subscribe/:plan", destination: "/me", permanent: true },
      { source: "/me/class/invite", destination: "/me", permanent: true },
      { source: "/me/class", destination: "/me", permanent: true },
      { source: "/me/diamond/invite", destination: "/me", permanent: true },
      { source: "/me/diamond", destination: "/me", permanent: true },
      { source: "/me/visits", destination: "/me", permanent: true },
      { source: "/me/settings/metrics", destination: "/me/settings", permanent: true },
      // The Passport (MESITA-2043). The member number lives on Profile.
      { source: "/me/passport", destination: "/me/profile", permanent: true },
      { source: "/share", destination: "/me", permanent: true },
      { source: "/invite", destination: "/me", permanent: true },
      // The retired Home hub (2026-09-01). Every leaf 308s straight to the
      // Discover default. NOTHING HERE MAY CHAIN THROUGH /discover/map OR
      // /discover/search — both are themselves 308s (below).
      { source: "/home", destination: "/discover/feed", permanent: true },
      { source: "/home/swipe", destination: "/discover/feed", permanent: true },
      { source: "/home/catalog", destination: "/discover/feed", permanent: true },
      { source: "/home/chat", destination: "/discover/feed", permanent: true },
      { source: "/home/ai", destination: "/discover/feed", permanent: true },
      { source: "/home/social", destination: "/discover/feed", permanent: true },
      { source: "/home/favorites", destination: "/discover/feed", permanent: true },
      // Search's two addresses under /discover (MESITA-1609 → MESITA-1616),
      // straight to the canonical /search. T7 pins both.
      { source: "/discover/search", destination: "/search", permanent: true },
      { source: "/discover/map", destination: "/search", permanent: true },
      // Catalog's day as Home, Swipe's week as the default, Catalog's own
      // segment (MESITA-1697). Swipe's sources forward to Scroll, the deck
      // Swipe became; every other retired Home address forwards to Home.
      { source: "/discover/home", destination: "/discover/feed", permanent: true },
      { source: "/discover/swipe", destination: "/discover/scroll", permanent: true },
      { source: "/discover/catalog", destination: "/discover/feed", permanent: true },
      // The Saved tab (reservations, favorites) and the /saved/place dual
      // path (MESITA-1585). One hop each, straight to the canonical surface.
      { source: "/saved", destination: "/me", permanent: true },
      { source: "/saved/reservations", destination: "/me/reservations", permanent: true },
      { source: "/saved/reservation/:id", destination: "/reservation/:id", permanent: true },
      { source: "/saved/place/:id", destination: "/place/:id", permanent: true },
      { source: "/profile", destination: "/me/profile", permanent: true },
      { source: "/notifications", destination: "/me/notifications", permanent: true },
      // ACTIVITY IS GONE AS A CONTAINER (MESITA-1626). /inbox 308s onto the
      // hub in ONE hop. /inbox/credits and /inbox/orders sit ABOVE this and
      // point at Pay: Next takes the first match.
      { source: "/inbox", destination: "/me", permanent: true },
      { source: "/inbox/:path*", destination: "/me", permanent: true },
    ];
  },
};

export default nextConfig;
