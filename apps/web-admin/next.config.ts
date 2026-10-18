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
    // Discovery is ONE page since MESITA-2327. Every retired subpage, and the
    // Memo editor before them, lands on it in one hop.
    const retired = [
      "/memo-config",
      "/filters-config/modes",
      "/filters-config/signals",
      "/filters-config/sources",
      "/filters-config/matrix",
      "/filters-config/modules",
      "/filters-config/catalog",
      "/filters-config/chat",
    ];
    return retired.flatMap((source) => [
      { source, destination: "/filters-config", permanent: false },
      { source: `${source}/:path*`, destination: "/filters-config", permanent: false },
    ]);
  },
};

export default nextConfig;
