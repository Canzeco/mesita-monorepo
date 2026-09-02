import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Memo has no editor (in-code defaults). Discovery Chat subroutes died
      // with MESITA-1182. Bookmarks land on Discovery.
      {
        source: "/memo-config",
        destination: "/filters-config/modes",
        permanent: true,
      },
      {
        source: "/memo-config/:path*",
        destination: "/filters-config/modes",
        permanent: true,
      },
      {
        source: "/filters-config/chat",
        destination: "/filters-config/modes",
        permanent: true,
      },
      {
        source: "/filters-config/chat/:path*",
        destination: "/filters-config/modes",
        permanent: true,
      },
      // `module` is retired as a Discovery noun; the subpage is Sources now.
      // An operator's bookmark still lands on the same boxes.
      {
        source: "/filters-config/modules",
        destination: "/filters-config/sources",
        permanent: true,
      },
      {
        source: "/filters-config/modules/:path*",
        destination: "/filters-config/sources",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
