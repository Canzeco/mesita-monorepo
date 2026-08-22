import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // MESITA-1174 — the console's entity routes moved /unit/* → /place/*.
  // Deployed sessions and old bookmarks still hold /unit URLs.
  async redirects() {
    return [
      { source: "/unit/:path*", destination: "/place/:path*", permanent: true },
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
