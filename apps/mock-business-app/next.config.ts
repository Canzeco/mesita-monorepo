import type { NextConfig } from "next";

// THE MOCK HAS NO REDIRECT TABLE, and the emptiness is deliberate.
//
// `apps/web-business/next.config.ts` is ~240 lines of legacy forwards, each
// one a bookmark somebody holds. This app has no bookmarks and no history: it
// was born at today's address list. Copying that table would give the mock a
// set of rules whose only job is to be wrong later — a config redirect runs
// BEFORE filesystem routes, so a stale entry here would shadow a live mock
// page exactly the way `/settings` shadowed the real one (MESITA-1839) and
// nothing in this app has a reason to catch it.
const nextConfig: NextConfig = {
  // Unsplash for the fixture photos, and nothing else: a mock that could load
  // any host would be one env var away from rendering a REAL place, which is
  // the one thing it must never do.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
};

export default nextConfig;
