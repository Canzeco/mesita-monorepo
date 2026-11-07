import path from "node:path";
import type { NextConfig } from "next";

// The proof page (MESITA-3304) imports two plain modules from
// packages/place-profile (the test band's words and the money format), so
// the build transpiles that package and Turbopack's root is the repo.
const repoRoot = path.resolve(__dirname, "../..");

const nextConfig: NextConfig = {
  agentRules: false,
  transpilePackages: ["@mesita/place-profile"],
  turbopack: { root: repoRoot },
};

export default nextConfig;
