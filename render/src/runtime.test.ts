import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Render sets NODE_ENV=production, and npm then skips devDependencies.
// The worker's start command is tsx. If that package is missing, the
// process dies before a failed task can turn enriching off, and a place
// that already finished stays generating.
test("the start command's runner is installed in production", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    scripts: { start: string };
    dependencies: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  assert.equal(pkg.scripts.start, "tsx src/index.ts");
  assert.match(pkg.dependencies.tsx ?? "", /^\^/);
  assert.equal(pkg.devDependencies?.tsx, undefined);
});
