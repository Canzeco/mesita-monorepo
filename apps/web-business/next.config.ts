import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ONE place console (MESITA-1564). The `(console)` tree — /place/<id> under
  // Profile · Partnership · Performance · Settings — is deleted; `/places/<id>`
  // under Profile · Reviews · Capabilities · Rewards · Admin is the whole
  // surface now (MESITA-1841).
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
      // A RULE MAY NEVER SHADOW A LIVE ADDRESS. Config redirects run BEFORE
      // filesystem routes, so a stale entry here makes a real page unreachable
      // while CI stays green. It has happened once in production: `/settings`
      // forwarded to `/account` from MESITA-1564, MESITA-1832 then named a LIVE
      // page `/settings`, and for a day the rail's own row 308'd away from the
      // page it pointed at (MESITA-1839). `legacy-redirects.test.ts` now walks
      // every live address in lib/console-routes.ts through this table.
      //
      // MESITA-1841 reverses two rules and adds two.
      //
      // Capabilities took its name back — MESITA-1815 had renamed the view
      // Settings, label and segment together, and this rule pointed the other
      // way. `/settings` (flat) and `/places/<id>/settings` are the legacy
      // spellings now.
      {
        source: "/places/:id/settings",
        destination: "/places/:id/capabilities",
        permanent: true,
      },
      // The flat twin. PERMANENT is safe here and only here because the
      // destination is itself a resolver: `/capabilities` reads the remembered
      // place at request time, so a cached 308 cannot pin anyone to a stale
      // place the way a cached `/places/<id>/…` would.
      { source: "/settings", destination: "/capabilities", permanent: true },
      // Activity left the place for the organization (MESITA-1841). There is
      // no org id in this path to forward to, so it lands on the FLAT address,
      // which resolves the remembered organization. TEMPORARY: where a place's
      // numbers live is a product decision that has now moved once, and a 308
      // would cache this answer in every browser forever.
      {
        source: "/places/:id/activity",
        destination: "/activity",
        permanent: false,
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
      // NO `/orgs/:orgId/organization` RULE. One lived here between
      // MESITA-1842 and MESITA-1846, forwarding onto the bare id. The page is
      // back at that segment, and a config rule runs BEFORE filesystem routes
      // — so leaving it would make the rail's first row unreachable with every
      // check green, which is `/settings` in MESITA-1839 exactly.
      // CREDITS MERGED BACK INTO PAYMENTS (MESITA-1845). It was a `SoonStrip`
      // at the foot of Payments, MESITA-1841 gave it a room, and Pato answered
      // the question of where it goes once Payments had a row again with one
      // word: "merge." Both spellings forward.
      //
      // TEMPORARY, deliberately. Where Credits lives has now moved twice in
      // one day, and a 308 would cache today's answer in every browser that
      // ever followed it — which is the trap `/settings` fell into
      // (MESITA-1839). The flat twin lands on the flat destination, which
      // resolves the remembered organization at request time.
      {
        source: "/orgs/:orgId/credits",
        destination: "/orgs/:orgId/payments",
        permanent: false,
      },
      { source: "/credits", destination: "/payments", permanent: false },
      // NO BARE `/organization` RULE. It forwarded to `/` while the
      // Organization screen did not exist; MESITA-1841 made it a live flat
      // resolver, and leaving the rule would have swallowed it exactly the way
      // `/settings` was swallowed in MESITA-1839. The `has` rule above keeps
      // the `?org=` era working and cannot match without that query.
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
