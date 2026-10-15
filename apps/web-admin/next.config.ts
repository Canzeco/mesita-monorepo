import path from "node:path";
import type { NextConfig } from "next";

const appDir = __dirname;
const repoRoot = path.resolve(appDir, "../..");

const nextConfig: NextConfig = {
  agentRules: false,
  transpilePackages: ["@mesita/place-profile"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // Tailwind reads packages/place-profile. Turbopack refuses that tree unless
  // the root includes it. Aliases keep this app's own React and Next.
  turbopack: {
    root: repoRoot,
    resolveAlias: {
      react: path.join(appDir, "node_modules/react"),
      "react-dom": path.join(appDir, "node_modules/react-dom"),
      next: path.join(appDir, "node_modules/next"),
      "lucide-react": path.join(appDir, "node_modules/lucide-react"),
      clsx: path.join(appDir, "node_modules/clsx"),
      "tailwind-merge": path.join(appDir, "node_modules/tailwind-merge"),
    },
  },
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
