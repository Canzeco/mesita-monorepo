import path from "node:path";
import { defineConfig } from "vitest/config";

// Tests read @mesita/place-profile from its live source, never the copy pnpm
// hard-linked into node_modules at install: a `git pull` rewrites the source
// files, the copy keeps the old code, and a test fails on a stale package
// (MESITA-2341, MESITA-2342). Its bare imports resolve to this app's own deps.
const placeProfile = path.resolve(__dirname, "../../packages/place-profile/src");

export default defineConfig({
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "src") },
      {
        find: /^@mesita\/place-profile$/,
        replacement: `${placeProfile}/index.ts`,
      },
      {
        find: /^@mesita\/place-profile\/types$/,
        replacement: `${placeProfile}/place-detail.ts`,
      },
      {
        find: /^@mesita\/place-profile\/map$/,
        replacement: `${placeProfile}/place-to-detail.ts`,
      },
      {
        find: /^@mesita\/place-profile\/helpers$/,
        replacement: `${placeProfile}/place-to-detail-helpers.ts`,
      },
    ],
    dedupe: [
      "clsx",
      "lucide-react",
      "next",
      "react",
      "react-dom",
      "tailwind-merge",
    ],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
