import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Memo Config moved into Filters Config › Chat (MESITA-1097): Home › Chat
      // IS Memo, so the surface and the agent behind it stopped being two
      // pages. Permanent — operators bookmark these.
      {
        source: "/memo-config",
        destination: "/filters-config/chat/memo",
        permanent: true,
      },
      {
        source: "/memo-config/config",
        destination: "/filters-config/chat/memo",
        permanent: true,
      },
      {
        source: "/memo-config/playground",
        destination: "/filters-config/chat/playground",
        permanent: true,
      },
      {
        source: "/memo-config/data-access",
        destination: "/filters-config/chat/data-access",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
