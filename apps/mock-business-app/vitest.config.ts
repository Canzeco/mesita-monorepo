// THE MOCK HAS A TEST RUNNER (MESITA-2017). Copied from `apps/web-business`
// so the two packages run the same tool the same way: node environment, the
// `@` alias, tests beside the code they pin. `pnpm test`, and the mock's own
// workflow runs it.
//
// COMPONENT TESTS (MESITA-2034, Eng Review D20) opt INTO jsdom per file with
// a `// @vitest-environment jsdom` docblock at the top — `Group.test.tsx` and
// `Notice.test.tsx` are the first two. The default here stays `node`, so
// every existing pure-logic test is unaffected; `setupFiles` loads jest-dom's
// matchers globally, which is a no-op for a node-environment test that never
// touches a DOM node.
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
    setupFiles: ["./vitest.setup.ts"],
  },
});
