import { assertEquals } from "@std/assert";
import { closure, refusalsOf } from "./sync-shared.ts";

const read = (files: Record<string, string>) => (m: string) => Promise.resolve(files[m] ?? null);

Deno.test("sync-shared copies a module with everything it imports by relative path", async () => {
  const { files, refusals } = await closure(["a.ts"], read({
    "a.ts": 'import type { B } from "./lib/b";\nexport * from "./c";',
    "lib/b.ts": 'import { c } from "../c";',
    "c.ts": "export const c = 1;",
    "unused.ts": "",
  }));
  assertEquals([...files.keys()].sort(), ["a.ts", "c.ts", "lib/b.ts"]);
  assertEquals(refusals, []);
});

Deno.test("sync-shared refuses a package import and a browser global, by line", () => {
  const source = '// window.x and from "react" in a comment are fine\nimport { clsx } from "clsx";\nexport const w = window.innerWidth;\nexport const re = /(document|x)/;';
  assertEquals(refusalsOf("a.ts", source).map((r) => [r.line, r.what]), [
    [2, 'imports the package "clsx"'],
    [3, "reads the browser global window"],
  ]);
});

Deno.test("sync-shared refuses an import that leaves the package or is not plain .ts", async () => {
  const { refusals } = await closure(["a.ts"], read({ "a.ts": 'import "../out";\nimport "./screen";' }));
  assertEquals(refusals.map((r) => r.line), [1, 2]);
});
