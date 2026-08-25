import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Memo has no editor (in-code defaults). Discovery Chat subroutes died
      // with MESITA-1182. Bookmarks land on Discovery.
      {
        source: "/memo-config",
        destination: "/filters-config",
        permanent: true,
      },
      {
        source: "/memo-config/:path*",
        destination: "/filters-config",
        permanent: true,
      },
      {
        source: "/filters-config/chat",
        destination: "/filters-config",
        permanent: true,
      },
      {
        source: "/filters-config/chat/:path*",
        destination: "/filters-config",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
