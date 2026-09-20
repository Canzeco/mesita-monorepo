// THE MOCK HAS A TEST RUNNER (MESITA-2017). Copied from `apps/web-business`
// so the two packages run the same tool the same way: node environment, the
// `@` alias, tests beside the code they pin. `pnpm test`, and the mock's own
// workflow runs it.
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
