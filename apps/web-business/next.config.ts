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
      // Account settings moved to the shell's own screen.
      { source: "/settings", destination: "/account", permanent: true },
      // Org Places and Public Places merged into one list (MESITA-1614).
      // Owned is a column now, not a screen.
      { source: "/pool", destination: "/places", permanent: true },
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
