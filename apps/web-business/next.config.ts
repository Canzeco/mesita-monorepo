import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ONE place console (MESITA-1564). The `(console)` tree — /place/<id> under
  // Profile · Partnership · Performance · Settings — is deleted; `/places/<id>`
  // is the whole surface now: nine views plus four pages of its own
  // (MESITA-1892).
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
      // CAPABILITIES AND REWARDS ARE NOT VIEWS ANY MORE (MESITA-1885). The
      // rail lists all eight products, and three of them were rows on the one
      // Capabilities page — so the page split into a view per product and both
      // old segments are legacy spellings now.
      //
      // BOTH LAND ON VISITS. A Capabilities bookmark cannot be forwarded to a
      // MATCHING product because its six rows are now four products; landing
      // on the container beats guessing one of them. Visits is the honest
      // landing: it is the place's own room — the ladder's container, the
      // Partnership body, and the internal "How this place is run" box that
      // Capabilities used to hold.
      //
      // TEMPORARY, like every other rename on this page: a 308 caches today's
      // answer in every browser forever, and where the place's switches live
      // has now moved three times.
      //
      // `/places/:id/settings` IS NOT HERE ANY MORE (MESITA-1892), and its
      // absence is the assertion. It forwarded to Visits as the retired
      // spelling of a place view; the place has a Settings PAGE now — the
      // members and the developer keys that used to hang off the organization
      // — so leaving the rule would make that page unreachable with every
      // check green, which is `/settings` in MESITA-1839 exactly. It was safe
      // to delete because it was `permanent: false`: no browser cached it.
      {
        source: "/places/:id/capabilities",
        destination: "/places/:id/visits",
        permanent: false,
      },
      {
        source: "/places/:id/rewards",
        destination: "/places/:id/visits",
        permanent: false,
      },
      // AND THEIR FLAT TWINS, which is the half that is easy to forget. Both
      // were live flat resolvers until MESITA-1885 — `/capabilities` and
      // `/rewards` are in operators' bookmarks and in old links — and a name
      // dropped from `FLAT_ROUTES` does not fall through to anything: the
      // `[flat]` segment answers 404 for a name not in the contract, on
      // purpose, so that a typo never renders a generic page.
      //
      // So retiring a flat name WITHOUT adding its forward turns a working
      // bookmark into a 404, which is the mirror of the MESITA-1839 trap this
      // table's own comments are about: there a rule shadowed a live address,
      // here a missing rule strands a retired one. Both land on Visits, for
      // the reason the place-scoped rules above give.
      { source: "/capabilities", destination: "/visits", permanent: false },
      { source: "/rewards", destination: "/visits", permanent: false },
      // `/places/:id/activity` IS GONE FROM THIS TABLE TOO (MESITA-1892).
      // Activity left the place for the organization in MESITA-1841 and this
      // rule forwarded it to the flat address; the organization is gone and
      // Activity is the PLACE's page again, at the address it started from.
      // Same law as `/places/:id/settings` above: a rule over a live page is
      // MESITA-1839, and `permanent: false` is what made deleting it safe.
      //
      // ── THE ORGANIZATION IS GONE (MESITA-1892) ─────────────────────────
      //
      // `partnered`, `legal_name`, `rfc`, the Stripe account and the members
      // all live on `places` now, so every `/orgs/<id>/…` address is dead and
      // every one of them is in somebody's bookmarks. They forward to the FLAT
      // twin of the page they were, which resolves the remembered place at
      // request time — the closest honest answer, since an organization id
      // cannot be turned into a place id once the join table is dropped.
      //
      // TEMPORARY, all of them. They land on resolvers, and a 308 would cache
      // the hop in every browser that ever follows it; this table's own rule
      // is that a permanent rule never lands on a resolver.
      //
      // THE TWO STRIPE ADDRESSES LAND ON `/`, NOT ON A PAGE. Stripe stores an
      // Account Link's `return_url` when the link is MINTED, and every link
      // ever minted points at the bare `/orgs/<id>?connect=return` (or, older
      // still, `/organization?org=<id>&connect=return`). `/` is the one
      // address that reads `?connect=` and hands the whole query to the
      // selected place's Pay page. Any other destination would strand an owner
      // who just spent eight minutes uploading documents on a screen that does
      // not know they came back.
      { source: "/orgs/new", destination: "/", permanent: false },
      {
        source: "/orgs/:orgId/settings",
        destination: "/settings",
        permanent: false,
      },
      {
        source: "/orgs/:orgId/configuration",
        destination: "/settings",
        permanent: false,
      },
      // MEMBERS IS CONTENT, NOT A PAGE (MESITA-1847). Pato: "members and
      // places in organization i mean, fuck nested things display shit
      // there." The people are ON the Settings page now, so the address has
      // nothing left to be.
      {
        source: "/orgs/:orgId/members",
        destination: "/settings",
        permanent: false,
      },
      { source: "/members", destination: "/settings", permanent: false },
      // The three sub-steps under Products, above the page itself: first match
      // wins, and a deeper source must be listed before the shallower one it
      // shares a prefix with.
      {
        source: "/orgs/:orgId/products/pay",
        destination: "/products",
        permanent: false,
      },
      {
        source: "/orgs/:orgId/products/terminal",
        destination: "/products",
        permanent: false,
      },
      {
        source: "/orgs/:orgId/products",
        destination: "/products",
        permanent: false,
      },
      // CREDITS MERGED BACK INTO PAYMENTS (MESITA-1845), PAYMENTS BECAME A
      // PRODUCT (MESITA-1869), and both spellings have forwarded to the
      // catalogue ever since. They follow it down a level with everything
      // else.
      {
        source: "/orgs/:orgId/credits",
        destination: "/products",
        permanent: false,
      },
      {
        source: "/orgs/:orgId/payments",
        destination: "/products",
        permanent: false,
      },
      { source: "/payments", destination: "/products", permanent: false },
      {
        source: "/orgs/:orgId/customers",
        destination: "/customers",
        permanent: false,
      },
      {
        source: "/orgs/:orgId/activity",
        destination: "/activity",
        permanent: false,
      },
      // The organization's place list and its Add ceremony are the console's
      // own catalogue now, at the top level where they belong.
      {
        source: "/orgs/:orgId/places/new",
        destination: "/places/new",
        permanent: false,
      },
      {
        source: "/orgs/:orgId/places",
        destination: "/places",
        permanent: false,
      },
      // The switcher's mechanism. It wrote the organization cookie and cleared
      // the place one; there is one cookie left and no second scope to switch,
      // so the address has nothing to do.
      { source: "/orgs/:orgId/switch", destination: "/", permanent: false },
      // THE BARE ADDRESS — Stripe's stored return. Query and all, to `/`.
      { source: "/orgs/:orgId", destination: "/", permanent: false },
      // Anything else that ever hung under an organization. Last, so every
      // named page above wins first.
      { source: "/orgs/:orgId/:rest*", destination: "/", permanent: false },
      // The `?org=` era's own two addresses (MESITA-1807). `/organization`
      // carried the id in the query and was the OTHER address Stripe stored,
      // so it lands on `/` for the reason above; its ceremony has nothing left
      // to create.
      { source: "/organization", destination: "/", permanent: false },
      { source: "/organization/new", destination: "/", permanent: false },
      // THE ORG INVITE PAGE IS GONE (MESITA-1892). `organization_invites` is
      // dropped, so a token in an old email cannot be accepted by anything —
      // but `/accept-invite` is the page that accepts a place invite, and it
      // is the one screen that can say so. A 404 could not.
      {
        source: "/accept-org-invite",
        destination: "/accept-invite",
        permanent: false,
      },
      // `/pool` was Public Places before MESITA-1614 merged the two lists into
      // one. That list is `/places` again (MESITA-1892), so this points at it
      // rather than at the resolver it was parked on while the list lived
      // under an organization.
      { source: "/pool", destination: "/places", permanent: true },
      // NO `/places` OR `/places/new` RULE, and the absence is the assertion.
      // Both forwarded to `/` from MESITA-1807, when the list lived under an
      // organization and these two spellings could not name one. The list is
      // back at `/places` and the ceremony at `/places/new` (MESITA-1892), and
      // a config rule runs BEFORE filesystem routes — so leaving either would
      // make the catalogue unreachable with every check green, which is
      // `/settings` in MESITA-1839 exactly.
      //
      // THESE TWO WERE `permanent: true`, which makes them the riskiest
      // deletions in this file: a 308 is cached on disk by every browser that
      // followed it. Vercel serves Next redirects with
      // `cache-control: public, max-age=0, must-revalidate` (checked on the
      // live host for MESITA-1871's `/settings`), so every browser
      // revalidates before following one again and the rules stop applying at
      // once. Stated rather than assumed, because assuming it is how a live
      // page stays dark for a day.
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
