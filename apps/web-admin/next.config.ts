import path from "node:path";
import type { NextConfig } from "next";

const appDir = __dirname;
const repoRoot = path.resolve(appDir, "../..");

// Absolute aliases become `./vercel/path0/...` once turbopack.root is the
// repo. Paths are relative to that root so the server build can resolve them.
function packageAlias(name: string): string {
  const relative = path
    .relative(repoRoot, path.join(appDir, "node_modules", name))
    .split(path.sep)
    .join("/");
  return `./${relative}`;
}

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
      react: packageAlias("react"),
      "react-dom": packageAlias("react-dom"),
      next: packageAlias("next"),
      "lucide-react": packageAlias("lucide-react"),
      clsx: packageAlias("clsx"),
      "tailwind-merge": packageAlias("tailwind-merge"),
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
