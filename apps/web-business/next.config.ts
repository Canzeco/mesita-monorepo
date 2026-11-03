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

// Old addresses, each in one hop (MESITA-3141). 307s: the console moves fast,
// so nothing here is cached as permanent. The query string rides along, so a
// Stripe return to /places/<id>/billing?boost=… still settles on Settings.
// /places/<id>/preview stays: web-admin links it.
const REDIRECTS: Array<{ source: string; destination: string }> = [
  // The phone's More page and Products left with the menu (MESITA-3117, 3128).
  { source: "/more", destination: "/places" },
  { source: "/products", destination: "/places" },
  // Settings, Payments, Prepayments and Rewards are a place's (MESITA-3120, 3136).
  { source: "/settings", destination: "/places" },
  { source: "/payments", destination: "/places" },
  { source: "/prepayments", destination: "/places" },
  { source: "/rewards", destination: "/places" },
  // The claim search is the head of Places (MESITA-3126); /claim/<id> stays.
  { source: "/claim", destination: "/places" },
  // One place: its index, and the views that folded (MESITA-3136).
  { source: "/places/:id", destination: "/places/:id/profile" },
  { source: "/places/:id/billing", destination: "/places/:id/premier" },
  { source: "/places/:id/future", destination: "/places/:id/payments" },
  { source: "/places/:id/preview", destination: "/places/:id/profile" },
  // Admin, never "internal", and only a place's (Pato, MESITA-3143: "its
  // only admin, and only at the place level"): the cross-place Claim
  // requests page is gone.
  { source: "/internal", destination: "/places" },
  { source: "/admin", destination: "/places" },
  { source: "/places/:id/internal", destination: "/places/:id/admin" },
];

const nextConfig: NextConfig = {
  agentRules: false,
  async redirects() {
    return REDIRECTS.map((r) => ({ ...r, permanent: false }));
  },
  transpilePackages: ["@mesita/place-profile"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // Tailwind reads packages/place-profile (the Preview tab). Turbopack refuses
  // that tree unless the root includes it. Aliases keep this app's own React
  // and Next.
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
};

export default nextConfig;
