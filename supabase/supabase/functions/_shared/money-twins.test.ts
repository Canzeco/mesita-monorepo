// MESITA-3302 — money-state.ts and money-codes.ts have ONE source here and a
// byte-identical copy in packages/place-profile/src/, written by
// `deno task sync-shared` (the package cannot import _shared: each package is
// its own install root). A copy that drifts is a client naming a code or a
// rule the server no longer has, so this pins the two equal.

import { assertEquals } from "jsr:@std/assert@1";

const TWINS = ["money-state.ts", "money-codes.ts"] as const;

for (const name of TWINS) {
  Deno.test(`twin: ${name} is byte-identical in packages/place-profile`, async () => {
    const here = new URL(`./${name}`, import.meta.url);
    const there = new URL(`../../../../packages/place-profile/src/${name}`, import.meta.url);
    const [a, b] = await Promise.all([Deno.readTextFile(here), Deno.readTextFile(there)]);
    assertEquals(a, b, `${name} differs between _shared and packages/place-profile/src: run \`deno task sync-shared\` from the repo root`);
  });
}
