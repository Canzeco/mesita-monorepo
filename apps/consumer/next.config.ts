import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Photos can come from Google Places (lh*.googleusercontent.com),
    // Firecrawl-scraped place sites, Unsplash mocks, and partner CDNs.
    // The wildcard accepts any HTTPS host — tighten if/when we want
    // strict provenance.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async redirects() {
    return [
      { source: "/explore", destination: "/home", permanent: true },
      { source: "/explore/swipe", destination: "/home", permanent: true },
      { source: "/explore/map", destination: "/search", permanent: true },
      { source: "/explore/add", destination: "/search", permanent: true },
      {
        source: "/explore/place/:id",
        destination: "/place/:id",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
