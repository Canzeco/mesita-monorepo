import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // /manager/{rewards,membership} → /manager/promos. The previous split
      // collapsed back into one surface: plan + fiscal type + Welcome
      // coupon + per-tier rates all live under Promos now.
      {
        source: "/manager/rewards",
        destination: "/manager/promos",
        permanent: true,
      },
      {
        source: "/manager/membership",
        destination: "/manager/promos",
        permanent: true,
      },
      {
        source: "/manager/subscription",
        destination: "/manager/promos",
        permanent: true,
      },
      // /manager/analytics renamed to /manager/performance.
      {
        source: "/manager/analytics",
        destination: "/manager/performance",
        permanent: true,
      },
      // /manager/console renamed to /manager/home — Home reads more like an
      // owner's daily landing pad than a SaaS "console".
      {
        source: "/manager/console",
        destination: "/manager/home",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      // Mock photography (legacy mock-data fallbacks).
      { protocol: "https", hostname: "images.unsplash.com" },
      // Google Places photo CDN — Places API returns photoUri pointing here.
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "lh4.googleusercontent.com" },
      { protocol: "https", hostname: "lh5.googleusercontent.com" },
      { protocol: "https", hostname: "lh6.googleusercontent.com" },
      // Firecrawl-extracted website images can come from anywhere — accept
      // any HTTPS host. Tighten later if you want strict provenance.
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
