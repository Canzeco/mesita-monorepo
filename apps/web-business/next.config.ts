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
      // THE FLAT `/settings` RULE IS DELETED (MESITA-1871), and this is the
      // whole point of the issue. It forwarded to `/capabilities` from
      // MESITA-1841 — permanently — which is the single reason MESITA-1852
      // had to name the organization's own page `configuration` instead of
      // `settings`: a config rule runs BEFORE filesystem routes, so the name
      // could be live in the contract and dead on arrival, which is
      // MESITA-1839 exactly. Pato asked for the name back, so the rule goes
      // rather than the name.
      //
      // IT WAS SAFE TO DELETE, AND THAT WAS CHECKED, NOT ASSUMED:
      // `curl -I business.mesita.ai/settings` answered `308` with
      // `cache-control: public, max-age=0, must-revalidate`, so every browser
      // that ever followed it revalidates before following it again. The
      // place-scoped `/places/:id/settings` rule above STAYS — a different
      // path, and still the retired spelling of a place view.
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
      //
      // AND PAYMENTS ITSELF IS GONE (MESITA-1869). Credits' forward follows it
      // onto Products, so neither chains through a deleted route — the mistake
      // `/unit/*` made when it still pointed at `/place/*`.
      {
        source: "/orgs/:orgId/credits",
        destination: "/orgs/:orgId/products",
        permanent: false,
      },
      { source: "/credits", destination: "/products", permanent: false },
      // PAYMENTS IS A PRODUCT NOW, not a page (MESITA-1869). Pato's list of
      // the organization's rows has no Payments on it: the page held two Soon
      // strips, and the two things anybody could act on — the Stripe account
      // and the Partner subscription — are cards in the catalogue. The row,
      // the address and every bookmark forward there.
      //
      // TEMPORARY, like every other rename on this page. A 308 caches today's
      // answer in every browser forever, and this answer has moved four times.
      {
        source: "/orgs/:orgId/payments",
        destination: "/orgs/:orgId/products",
        permanent: false,
      },
      { source: "/payments", destination: "/products", permanent: false },
      // MEMBERS IS CONTENT, NOT A PAGE (MESITA-1847). Pato: "members and
      // places in organization i mean, fuck nested things display shit
      // there." The people are ON the Organization page now, so the address
      // has nothing left to be. TEMPORARY: where the org's people live is a
      // product decision that has moved twice, and a 308 would cache today's
      // answer in every browser forever.
      // Both forwards were left pointing at `organization`, a segment
      // MESITA-1852 renamed to `configuration` — so `/members` had been
      // landing on a 404 since (MESITA-1869 repoints them, MESITA-1871 moves
      // them again with the rename). A redirect onto a deleted route is the
      // `/unit/*` → `/place/*` chain again, and it fails silently because no
      // test walks a LEGACY source to its destination.
      {
        source: "/orgs/:orgId/members",
        destination: "/orgs/:orgId/settings",
        permanent: false,
      },
      { source: "/members", destination: "/settings", permanent: false },
      // CONFIGURATION IS SETTINGS AGAIN (MESITA-1871). Pato: *"rename
      // configuration to settings."* MESITA-1852 had gone the other way, and
      // only because the flat `/settings` was claimed; that rule is deleted
      // above, so both spellings of the old name forward here instead.
      //
      // TEMPORARY, like every other rename on this page: where the
      // organization's own setup lives has moved four times, and a 308 caches
      // today's answer in every browser forever.
      {
        source: "/orgs/:orgId/configuration",
        destination: "/orgs/:orgId/settings",
        permanent: false,
      },
      { source: "/configuration", destination: "/settings", permanent: false },
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
