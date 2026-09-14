import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ONE place console (MESITA-1564). The `(console)` tree — /place/<id> under
  // Profile · Partnership · Performance · Settings — is deleted; `/places/<id>`
  // under Profile · Capabilities · Activity · Admin is the whole surface now.
  //
  // The tab names do NOT map one to one (Partnership and Settings merged into
  // Capabilities), so a legacy tab cannot be forwarded to a matching tab
  // without guessing. Every one lands on the place itself, which always
  // exists — a bookmark that opens the right restaurant on the wrong tab beats
  // a 404, and beats a redirect that quietly picks a tab the operator did not
  // ask for.
  //
  // /unit/* predates all of this (MESITA-1174) and used to forward to /place/*,
  // which no longer exists — so it is repointed here rather than left to chain
  // through a deleted route.
  async redirects() {
    return [
      // Straight to Profile's real address (MESITA-1732). Landing these on the
      // bare /places/:id would chain a cached 308 into a 307 for every old
      // link; these are permanent either way, so one hop beats two.
      { source: "/unit/:id", destination: "/places/:id/profile", permanent: true },
      { source: "/unit/:id/:rest*", destination: "/places/:id/profile", permanent: true },
      { source: "/place/:id", destination: "/places/:id/profile", permanent: true },
      { source: "/place/:id/:rest*", destination: "/places/:id/profile", permanent: true },
      // NO RULE FOR /settings. It used to forward here to `/account`, from
      // MESITA-1564's deletion of the legacy console's own settings screen.
      // MESITA-1832 then named a LIVE page `/settings` without noticing, and
      // config redirects run BEFORE filesystem routes — so for a day the
      // rail's Settings row 308'd to Account and the page it pointed at could
      // not be reached at all (verified in production, MESITA-1839).
      //
      // `legacy-redirects.test.ts` now walks every live address through this
      // table and fails if one is swallowed again.
      // The Capabilities view became Settings (MESITA-1815) — label and
      // segment together, so the row and the address agree.
      {
        source: "/places/:id/capabilities",
        destination: "/places/:id/settings",
        permanent: true,
      },
      // THE ORGANIZATION MOVED INTO THE PATH (MESITA-1807). `?org=<id>` used
      // to name it on every console URL; the id is captured off the query
      // and becomes the segment. Stripe stores an Account Link's return_url
      // when the link is minted, so `/organization?org=&connect=return` links
      // minted before this shipped still arrive here — the rest of the query
      // rides through to `/orgs/<id>`, whose Overview hands `?connect=` on to
      // Payments. The no-org forms go to `/`, the resolver. The `has` rules
      // must stay ABOVE their bare twins: first match wins.
      {
        source: "/organization",
        has: [{ type: "query", key: "org", value: "(?<org>[^&]+)" }],
        destination: "/orgs/:org",
        permanent: true,
      },
      { source: "/organization", destination: "/", permanent: true },
      { source: "/organization/new", destination: "/orgs/new", permanent: true },
      {
        source: "/places",
        has: [{ type: "query", key: "org", value: "(?<org>[^&]+)" }],
        destination: "/orgs/:org/places",
        permanent: true,
      },
      { source: "/places", destination: "/", permanent: true },
      {
        source: "/places/new",
        has: [{ type: "query", key: "org", value: "(?<org>[^&]+)" }],
        destination: "/orgs/:org/places/new",
        permanent: true,
      },
      { source: "/places/new", destination: "/", permanent: true },
      // Org Places and Public Places merged into one list (MESITA-1614), and
      // the list moved under its organization (MESITA-1807): the resolver
      // knows which one.
      { source: "/pool", destination: "/", permanent: true },
    ];
  },
  images: {
    // Photos can come from Google Places (lh*.googleusercontent.com),
    // Firecrawl-scraped place sites, Unsplash mocks, and partner CDNs.
    // The wildcard accepts any HTTPS host — tighten if/when we want
    // strict provenance.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
