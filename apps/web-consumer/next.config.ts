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
  // (MESITA-899). Redirects with logic (query/tab mapping — /me/[tab],
  // /inbox aliases, /saved/*) stay as server pages. Query strings are
  // preserved automatically. The redirect table is pinned by
  // src/lib/__tests__/consumer-route-contract.test.ts.
  async redirects() {
    return [
      // Explore era (pre-Home). Repointed straight at the Discover default —
      // Swipe again as of MESITA-1615, was Catalog for one day, Search before
      // that — when /home was retired; chaining them through /home would
      // have made these two-hop, which route-structure T4 caps at exactly 2.
      { source: "/explore", destination: "/discover/scroll", permanent: true },
      { source: "/explore/swipe", destination: "/discover/scroll", permanent: true },
      { source: "/explore/map", destination: "/discover/scroll", permanent: true },
      { source: "/explore/add", destination: "/discover/scroll", permanent: true },
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
      { source: "/subscribe", destination: "/me/plan", permanent: true },
      { source: "/subscribe/:plan", destination: "/me/plan", permanent: true },
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
      // The retired Home hub (2026-09-01). Every leaf 308s straight to
      // Discover's default — Swipe again as of MESITA-1615 (was Catalog for
      // one day, Search before that; see consumer-route-contract.ts's
      // discoverDefault comment for the full reasoning). /home/ai points here
      // rather than chaining through /home/chat — that page is deleted, so
      // the old chain would both dangle and cost a second hop against T4's
      // cap of 2.
      //
      // NOTHING HERE MAY CHAIN THROUGH /discover/map OR /discover/search.
      // Both segments are themselves 308s now (below), so a chained /home
      // would cost two hops and leave zero margin under T4. The destination
      // is the canonical mode, always.
      //
      // /home/favorites goes with them: FavoritesList exists under components/
      // but nothing rendered it and it needs the parked shared-deck fetch, so
      // there was no live surface to promote.
      { source: "/home", destination: "/discover/scroll", permanent: true },
      { source: "/home/swipe", destination: "/discover/scroll", permanent: true },
      { source: "/home/catalog", destination: "/discover/scroll", permanent: true },
      { source: "/home/chat", destination: "/discover/scroll", permanent: true },
      { source: "/home/ai", destination: "/discover/scroll", permanent: true },
      { source: "/home/social", destination: "/discover/scroll", permanent: true },
      { source: "/home/favorites", destination: "/discover/scroll", permanent: true },
      // Explicit search intent, unlike the /home* leaves above — this one
      // stays pointed at Search's canonical route regardless of what the
      // Discover DEFAULT is, the same way /discover/map (below) does. /search
      // IS that canonical route now (MESITA-1616), not a legacy source —
      // dropped from this table; see /discover/search below for the entry
      // that replaced it.
      // The just-shipped Search route (MESITA-1609, six days, -> MESITA-1616).
      // Straight to the new canonical /search — never chained through
      // /discover/map, which points here too and would make that a 2-hop
      // path. T7 pins this entry.
      { source: "/discover/search", destination: "/search", permanent: true },
      // The map's own segment, for the ~26 hours it was the live url and the
      // Discover default (#1438 → this change). Search IS the map now, so the
      // word moved off the list mode and onto the map itself; /search is the
      // forwarding address — direct, not through /discover/search, which is
      // itself a redirect source above. T7 pins this entry — T4 can validate
      // a redirect's destination but never its absence.
      { source: "/discover/map", destination: "/search", permanent: true },
      // The browse mode shipped as "Home" for a day (#1448 -> 2026-09-02). It
      // was a live url that production deployed, so it forwards like the rest,
      // STRAIGHT to /discover/catalog.
      //
      // ITS SIBLING /discover/feed IS GONE FROM THIS TABLE (MESITA-1621).
      // Catalog also shipped as "Feed" for about an hour (#1447 -> #1448) and
      // 308'd here alongside Home ever since — but /discover/feed is a REAL
      // PAGE now, Home's Feed mode, and a redirect listed here shadows the
      // route entirely: the page would never render. So the entry is deleted,
      // not repointed, and Home must NOT be re-pointed through it either —
      // that would land Catalog's bookmarks on a different mode.
      { source: "/discover/home", destination: "/discover/feed", permanent: true },
      // MESITA-1697 — the two renamed segments. Swipe's address was
      // `discoverDefault` for a week (BottomNav's Home href, the post-signin
      // and onboarding targets, place detail's fallback), so its bookmarks are
      // the realest in the consumer surface. Both forward in ONE hop; every
      // /explore* and /home* entry above was re-pointed at /discover/scroll in
      // the same change rather than being left to chain through here.
      //
      // NOTHING MAY BE ADDED FOR /discover/scroll, /discover/feed,
      // /discover/chat OR /discover/favs. A redirect whose SOURCE is a live
      // route shadows it entirely — the page never renders, and typecheck,
      // build and the whole vitest suite stay green. That is exactly how
      // /discover/feed was unreachable before MESITA-1621 deleted its entry.
      // route-structure.test.tsx now asserts this directly.
      { source: "/discover/swipe", destination: "/discover/scroll", permanent: true },
      { source: "/discover/catalog", destination: "/discover/feed", permanent: true },
      // The Saved tab (reservations, favorites) and the /saved/place dual path.
      // The contract still lists these legacy sources; without entries they 404ed
      // (MESITA-1585). One hop each, straight to the canonical surface.
      { source: "/saved", destination: "/me", permanent: true },
      { source: "/saved/reservations", destination: "/me/reservations", permanent: true },
      { source: "/saved/reservation/:id", destination: "/reservation/:id", permanent: true },
      { source: "/saved/place/:id", destination: "/place/:id", permanent: true },
      { source: "/invite", destination: "/share", permanent: true },
      // Wallet's THREE former addresses, each live in production at some point
      // so all three sets of bookmarks are real: standalone /credits (#1429),
      // the Activity section /inbox/credits, and the top-level tab /wallet
      // (#1492, 2026-09-05 -> 09-06). Each points STRAIGHT at /new-visit/wallet
      // — chaining them would be 3 hops and route-structure T4 caps a chain at
      // 2. T7 asserts these entries still exist: T4 can only validate a
      // redirect's DESTINATION, never its absence.
      { source: "/credits", destination: "/new-visit/wallet", permanent: true },
      { source: "/inbox/credits", destination: "/new-visit/wallet", permanent: true },
      { source: "/wallet", destination: "/new-visit/wallet", permanent: true },
      { source: "/profile", destination: "/me/profile", permanent: true },
      { source: "/notifications", destination: "/me/notifications", permanent: true },
      // ACTIVITY IS GONE AS A CONTAINER (MESITA-1626). Its three sections are
      // pages under /me now (MESITA-1789), and /inbox still 308s onto the hub
      // in ONE hop — a bookmark of the container is not a bookmark of one
      // section. Ordering matters: /inbox/credits sits ABOVE this and still
      // points at Wallet, because Next takes the first match and Credits never
      // belonged to Activity.
      // Activity anyway (it is an instrument, not an event).
      { source: "/inbox", destination: "/me", permanent: true },
      { source: "/inbox/:path*", destination: "/me", permanent: true },
    ];
  },
};

export default nextConfig;
